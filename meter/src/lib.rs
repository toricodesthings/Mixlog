//! Mixlog's meter: bytes in, an analysis out. The wasm-bindgen surface the browser and the Worker call.

pub mod analysis;
pub mod decode;
pub mod measure;

use std::cell::RefCell;
use std::io::{self, Read, Seek, SeekFrom};
use std::rc::Rc;

use serde::Serialize;
use symphonia::core::io::MediaSource;
use wasm_bindgen::prelude::*;

use decode::{Fail, Session, Shared, Stream};

/// Decode while at least this much is buffered past the read position; the rest on finish.
const PUMP_AHEAD: u64 = 2 << 20;

fn to_js(result: Result<analysis::Analysis, Fail>) -> Result<JsValue, JsError> {
    match result {
        Ok(a) => a.serialize(&serde_wasm_bindgen::Serializer::json_compatible()).map_err(|e| JsError::new(&e.to_string())),
        Err(Fail::Unreadable) => Err(JsError::new("unreadable")),
        Err(Fail::Other(e)) => Err(JsError::new(&e)),
    }
}

struct JsSource {
    read_at: js_sys::Function,
    size: u64,
    pos: u64,
}

// The meter runs on one thread (a Web Worker, a Worker isolate); Symphonia's trait asks for Send + Sync regardless.
unsafe impl Send for JsSource {}
unsafe impl Sync for JsSource {}

impl Read for JsSource {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        let n = (out.len() as u64).min(self.size - self.pos.min(self.size));
        if n == 0 {
            return Ok(0);
        }
        let got = self
            .read_at
            .call2(&JsValue::NULL, &JsValue::from_f64(self.pos as f64), &JsValue::from_f64(n as f64))
            .map_err(|_| io::Error::other("read_at threw"))?;
        let bytes = js_sys::Uint8Array::new(&got);
        let len = (bytes.length() as usize).min(n as usize);
        bytes.subarray(0, len as u32).copy_to(&mut out[..len]);
        self.pos += len as u64;
        Ok(len)
    }
}

impl Seek for JsSource {
    fn seek(&mut self, to: SeekFrom) -> io::Result<u64> {
        self.pos = match to {
            SeekFrom::Start(n) => n,
            SeekFrom::Current(d) => (self.pos as i64 + d) as u64,
            SeekFrom::End(d) => (self.size as i64 + d) as u64,
        };
        Ok(self.pos)
    }
}

impl MediaSource for JsSource {
    fn is_seekable(&self) -> bool {
        true
    }
    fn byte_len(&self) -> Option<u64> {
        Some(self.size)
    }
}

/// A source that can seek: `read_at(offset, length) -> Uint8Array`, called synchronously.
#[wasm_bindgen]
pub fn measure_seekable(size: f64, read_at: &js_sys::Function, hint: &str) -> Result<JsValue, JsError> {
    let size = size as u64;
    to_js(decode::measure(JsSource { read_at: read_at.clone(), size, pos: 0 }, size, hint))
}

struct PumpSource(Shared);
unsafe impl Send for PumpSource {}
unsafe impl Sync for PumpSource {}
impl Read for PumpSource {
    fn read(&mut self, out: &mut [u8]) -> io::Result<usize> {
        self.0.read(out)
    }
}
impl Seek for PumpSource {
    fn seek(&mut self, to: SeekFrom) -> io::Result<u64> {
        self.0.seek(to)
    }
}
impl MediaSource for PumpSource {
    fn is_seekable(&self) -> bool {
        false
    }
    fn byte_len(&self) -> Option<u64> {
        None
    }
}

/// A source that only streams forward: chunks pushed in order (large WAV, AIFF, FLAC).
#[wasm_bindgen]
pub struct Pump {
    hint: String,
    stream: Rc<RefCell<Stream>>,
    session: Option<Session>,
}

#[wasm_bindgen]
impl Pump {
    #[wasm_bindgen(constructor)]
    pub fn new(hint: &str) -> Pump {
        Pump { hint: hint.into(), stream: Rc::default(), session: None }
    }

    pub fn push(&mut self, chunk: &[u8]) -> Result<(), JsError> {
        self.stream.borrow_mut().push(chunk);
        self.drain(PUMP_AHEAD).map_err(fail)
    }

    pub fn finish(mut self) -> Result<JsValue, JsError> {
        self.stream.borrow_mut().ended = true;
        let result = self.drain(0).and_then(|_| {
            let total = self.stream.borrow().total();
            self.session.take().ok_or(Fail::Unreadable)?.finish(total)
        });
        to_js(result)
    }
}

impl Pump {
    fn drain(&mut self, ahead: u64) -> Result<(), Fail> {
        if self.session.is_none() {
            if self.stream.borrow().ahead() < ahead.max(1) {
                return Ok(());
            }
            self.session = Some(Session::open(Box::new(PumpSource(Shared(self.stream.clone()))), &self.hint)?);
        }
        let s = self.session.as_mut().unwrap();
        while self.stream.borrow().ahead() > ahead || (ahead == 0 && self.stream.borrow().ended) {
            if !s.step()? {
                break;
            }
        }
        Ok(())
    }
}

fn fail(f: Fail) -> JsError {
    JsError::new(match &f {
        Fail::Unreadable => "unreadable",
        Fail::Other(e) => e,
    })
}

/// Native entry for `cargo test`: measures bytes already in memory.
pub fn measure_bytes(bytes: Vec<u8>, hint: &str) -> Result<analysis::Analysis, Fail> {
    let size = bytes.len() as u64;
    decode::measure(io::Cursor::new(bytes), size, hint)
}
