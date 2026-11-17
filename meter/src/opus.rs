//! Opus for Symphonia (which demuxes Ogg but has no Opus decoder), over `opus-rs`: pure Rust, so it builds to WASM and
//! runs in the browser and the cron alike. Always 48 kHz, as Opus is. Honours the `OpusHead` pre-skip and output gain,
//! as every player does; R128 gain tags are metadata and ignored, as the meter ignores ReplayGain.

use symphonia::core::audio::{AsAudioBufferRef, AudioBuffer, AudioBufferRef, Channels, Signal, SignalSpec};
use symphonia::core::codecs::{CodecDescriptor, CodecParameters, Decoder, DecoderOptions, FinalizeResult, CODEC_TYPE_OPUS};
use symphonia::core::errors::{decode_error, unsupported_error, Result};
use symphonia::core::formats::Packet;
use symphonia::core::support_codec;

const RATE: u32 = 48_000;
/// The longest Opus packet: 120 ms.
const MAX_FRAMES: usize = 5_760;

pub struct OpusDecoder {
    params: CodecParameters,
    opus: opus_rs::OpusDecoder,
    channels: usize,
    /// Frames still to drop from the start (the encoder's look-ahead).
    skip: usize,
    gain: f32,
    pcm: Vec<f32>,
    buf: AudioBuffer<f32>,
}

impl Decoder for OpusDecoder {
    fn try_new(params: &CodecParameters, _: &DecoderOptions) -> Result<Self> {
        let head = match params.extra_data.as_deref() {
            Some(h) if params.codec == CODEC_TYPE_OPUS && h.len() >= 19 && &h[..8] == b"OpusHead" => h,
            _ => return unsupported_error("opus: no OpusHead"),
        };
        let channels = head[9] as usize;
        // Mapping family 0 (mono, stereo) or 1 at ≤ 2 channels: one stream. Surround Opus is multistream.
        if !(1..=2).contains(&channels) || head[18] > 1 {
            return unsupported_error("opus: multistream");
        }
        let skip = u16::from_le_bytes([head[10], head[11]]) as usize;
        let gain_q8 = i16::from_le_bytes([head[16], head[17]]) as f32;
        let opus = opus_rs::OpusDecoder::new(RATE as i32, channels).or_else(|_| unsupported_error("opus: decoder"))?;
        let layout = if channels == 1 { Channels::FRONT_LEFT } else { Channels::FRONT_LEFT | Channels::FRONT_RIGHT };
        Ok(OpusDecoder {
            params: params.clone(),
            opus,
            channels,
            skip,
            gain: 10f32.powf(gain_q8 / 256.0 / 20.0),
            pcm: vec![0.0; MAX_FRAMES * channels],
            buf: AudioBuffer::new(MAX_FRAMES as u64, SignalSpec::new(RATE, layout)),
        })
    }

    fn supported_codecs() -> &'static [CodecDescriptor] {
        &[support_codec!(CODEC_TYPE_OPUS, "opus", "Opus")]
    }

    fn reset(&mut self) {}

    fn codec_params(&self) -> &CodecParameters {
        &self.params
    }

    fn decode(&mut self, packet: &Packet) -> Result<AudioBufferRef<'_>> {
        self.buf.clear();
        let n = match self.opus.decode(&packet.data, MAX_FRAMES, &mut self.pcm) {
            Ok(n) => n,
            Err(_) => return decode_error("opus: bad packet"),
        };
        self.buf.render_reserved(Some(n));
        for c in 0..self.channels {
            for (i, x) in self.buf.chan_mut(c).iter_mut().enumerate() {
                *x = self.pcm[i * self.channels + c] * self.gain;
            }
        }
        let skip = self.skip.min(n);
        self.skip -= skip;
        // The Ogg reader trims the end from the granule; the start's pre-skip is ours to drop.
        self.buf.trim(packet.trim_start as usize + skip, packet.trim_end as usize);
        Ok(self.buf.as_audio_buffer_ref())
    }

    fn finalize(&mut self) -> FinalizeResult {
        FinalizeResult::default()
    }

    fn last_decoded(&self) -> AudioBufferRef<'_> {
        self.buf.as_audio_buffer_ref()
    }
}
