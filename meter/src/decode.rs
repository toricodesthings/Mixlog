//! Symphonia: probe, decode to f32 frames, read the format facts. No resampling: the meter runs at the file's rate.

use std::cell::RefCell;
use std::io::{self, Read, Seek, SeekFrom};
use std::rc::Rc;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::{self, Decoder, DecoderOptions};
use symphonia::core::errors::Error as SymError;
use symphonia::core::formats::{FormatOptions, FormatReader};
use symphonia::core::io::{MediaSource, MediaSourceStream, MediaSourceStreamOptions};
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

use crate::analysis::{Analysis, Format};
use crate::measure::Meter;

#[derive(Debug)]
pub enum Fail {
    /// A format or codec the meter can't decode (Opus, DRM). Not a failed upload, only no reading.
    Unreadable,
    Other(String),
}

impl From<String> for Fail {
    fn from(s: String) -> Fail {
        Fail::Other(s)
    }
}

pub struct Session {
    reader: Box<dyn FormatReader>,
    decoder: Box<dyn Decoder>,
    track: u32,
    /// Made on the first decoded buffer: AAC in MP4 states its channels only then.
    meter: Option<Meter>,
    buf: Option<SampleBuffer<f32>>,
    codec: &'static str,
    rate: u32,
    bits: Option<u32>,
    channels: usize,
}

impl Session {
    pub fn open(source: Box<dyn MediaSource>, hint: &str) -> Result<Session, Fail> {
        let stream = MediaSourceStream::new(source, MediaSourceStreamOptions { buffer_len: 1 << 20 });
        let mut h = Hint::new();
        h.with_extension(hint);
        let probed = symphonia::default::get_probe()
            .format(&h, stream, &FormatOptions { enable_gapless: true, ..Default::default() }, &MetadataOptions::default())
            .map_err(|_| Fail::Unreadable)?;
        let reader = probed.format;
        let track = reader.tracks().iter().find(|t| t.codec_params.codec != codecs::CODEC_TYPE_NULL).ok_or(Fail::Unreadable)?;
        let p = &track.codec_params;
        let codec = codec_name(p.codec).ok_or(Fail::Unreadable)?;
        let lossless = matches!(codec, "pcm" | "flac" | "alac");
        let bits = if lossless { p.bits_per_sample.or(p.bits_per_coded_sample) } else { None };
        let decoder = symphonia::default::get_codecs().make(p, &DecoderOptions::default()).map_err(|_| Fail::Unreadable)?;
        let id = track.id;
        Ok(Session { reader, decoder, track: id, meter: None, buf: None, codec, rate: 0, bits, channels: 0 })
    }

    /// Decodes one packet. `false` once the file has ended.
    pub fn step(&mut self) -> Result<bool, Fail> {
        let packet = match self.reader.next_packet() {
            Ok(p) => p,
            Err(SymError::IoError(e)) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(false),
            Err(SymError::ResetRequired) => return Ok(false),
            Err(e) => return Err(Fail::Other(e.to_string())),
        };
        if packet.track_id() != self.track {
            return Ok(true);
        }
        match self.decoder.decode(&packet) {
            Ok(audio) => {
                let spec = *audio.spec();
                if self.meter.is_none() {
                    self.rate = spec.rate;
                    self.channels = spec.channels.count();
                    self.meter = Some(Meter::new(self.rate, self.channels)?);
                }
                let buf = self.buf.get_or_insert_with(|| SampleBuffer::new(audio.capacity() as u64, *audio.spec()));
                if buf.capacity() < audio.capacity() * self.channels {
                    *buf = SampleBuffer::new(audio.capacity() as u64, *audio.spec());
                }
                buf.copy_interleaved_ref(audio);
                self.meter.as_mut().unwrap().push(buf.samples())?;
                Ok(true)
            }
            // A damaged packet is skipped, as a player would.
            Err(SymError::DecodeError(_)) => Ok(true),
            Err(e) => Err(Fail::Other(e.to_string())),
        }
    }

    pub fn finish(self, size: u64) -> Result<Analysis, Fail> {
        let readings = self.meter.ok_or(Fail::Unreadable)?.finish()?;
        let lossless = self.bits.is_some() || matches!(self.codec, "pcm" | "flac" | "alac");
        let kbps = if lossless || readings.ms == 0 { None } else { Some((size * 8 / readings.ms) as u32) };
        Ok(Analysis {
            format: Format { codec: self.codec, rate: self.rate, bits: self.bits, channels: self.channels, kbps },
            readings,
        })
    }
}

fn codec_name(c: codecs::CodecType) -> Option<&'static str> {
    use codecs::*;
    Some(match c {
        CODEC_TYPE_FLAC => "flac",
        CODEC_TYPE_MP3 => "mp3",
        CODEC_TYPE_AAC => "aac",
        CODEC_TYPE_ALAC => "alac",
        CODEC_TYPE_VORBIS => "vorbis",
        c if symphonia::default::get_codecs().get_codec(c).is_some_and(|d| d.short_name.starts_with("pcm")) => "pcm",
        _ => return None,
    })
}

/// Measures a file that can seek, read through `read_at`.
pub fn measure<S: MediaSource + 'static>(source: S, size: u64, hint: &str) -> Result<Analysis, Fail> {
    let mut s = Session::open(Box::new(source), hint)?;
    while s.step()? {}
    s.finish(size)
}

/// Bytes pushed forward only, shared between the `Pump` and the decoder reading them.
#[derive(Default)]
pub struct Stream {
    bytes: Vec<u8>,
    /// Absolute offset of `bytes[0]`.
    start: u64,
    pos: u64,
    pub ended: bool,
}

impl Stream {
    pub fn push(&mut self, chunk: &[u8]) {
        // Drop what the decoder has read, past 8 MB, so memory stays flat.
        let read = (self.pos - self.start) as usize;
        if read > 8 << 20 {
            self.bytes.drain(..read);
            self.start = self.pos;
        }
        self.bytes.extend_from_slice(chunk);
    }
    pub fn total(&self) -> u64 {
        self.start + self.bytes.len() as u64
    }
    pub fn ahead(&self) -> u64 {
        self.total() - self.pos
    }
}

#[derive(Clone)]
pub struct Shared(pub Rc<RefCell<Stream>>);

impl Read for Shared {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        let mut s = self.0.borrow_mut();
        let at = (s.pos - s.start) as usize;
        let n = out.len().min(s.bytes.len() - at);
        if n == 0 && !s.ended {
            return Err(io::Error::new(io::ErrorKind::WouldBlock, "pump ran dry"));
        }
        out[..n].copy_from_slice(&s.bytes[at..at + n]);
        s.pos += n as u64;
        Ok(n)
    }
}

impl Seek for Shared {
    fn seek(&mut self, to: SeekFrom) -> io::Result<u64> {
        // Forward only; MediaSourceStream asks for the current position now and then.
        let mut s = self.0.borrow_mut();
        let target = match to {
            SeekFrom::Start(n) => n,
            SeekFrom::Current(d) => (s.pos as i64 + d) as u64,
            SeekFrom::End(_) => return Err(io::Error::new(io::ErrorKind::Unsupported, "pump can't seek")),
        };
        if target < s.start || target > s.total() {
            return Err(io::Error::new(io::ErrorKind::Unsupported, "pump can't seek"));
        }
        s.pos = target;
        Ok(target)
    }
}
