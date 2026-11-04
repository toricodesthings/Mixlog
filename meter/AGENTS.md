# meter/ — Mixlog's meter

A Rust crate, built to WASM, with one job: **bytes in, an analysis out**. Symphonia decodes (WAV, AIFF, FLAC, MP3,
AAC/M4A, OGG Vorbis, ALAC) at the file's own rate, never resampled; `ebur128` reads BS.1770 / EBU R128 loudness
(integrated, momentary, short-term, LRA, true peak, sample peak); `measure.rs` reads the rest in the same pass:
TT DR, correlation (whole song and the lowest 3 s window), clip runs of ≥ 3 samples, DC offset, and the 256-bar
short-term loudness wave.

- `src/lib.rs`: the wasm-bindgen surface. `measure_seekable(size, read_at, hint)` for a source that can seek
  (`read_at(offset, length) → Uint8Array`, synchronous); `Pump` (`new(hint)`, `push(chunk)`, `finish()`) for one that
  only streams forward. A file it can't decode throws `unreadable`: no reading, never a failed upload.
- `src/decode.rs`: probe, decode, format facts. The meter is made from the first decoded buffer (AAC in MP4 states its
  channels only then).
- `src/measure.rs`: the one pass. `src/analysis.rs`: the JSON it returns. `meter` and `source` are added by the caller;
  the contract and `METER` live in `src/server/loudness.ts`. Any change that moves a reading bumps `METER`.
- `tests/calibration.rs`: EBU Tech 3341/3342 signals synthesized in code, at EBU's tolerances, plus DR, phase, clips,
  the wave and a WAV decode. `tests/unit/meter/meter.test.ts` measures through the committed `pkg/`.

**`pkg/` is committed**, so nothing else needs Rust. After changing `src/`: `pnpm meter:test`, then `pnpm meter:build`
(`scripts/meter-build.sh`: remaps paths so the `.wasm` is byte-identical anywhere; `wasm-opt` is off for the same
reason), and commit `pkg/` with the change. CI's Meter job rebuilds and fails on any diff. The toolchain is pinned in
`rust-toolchain.toml`; `wasm-pack` is 0.15.1.
