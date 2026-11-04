//! One pass over decoded frames: every reading comes from the same samples (docs: what's measured, exactly).

use ebur128::{EbuR128, Mode};

use crate::analysis::{round1, Correlation, Loudest, Readings};

pub const WAVE_BARS: usize = 256;
const FLOOR: f64 = -70.0;
const CLIP: f32 = 1.0 - 1e-6;
const CLIP_RUN: u32 = 3;
/// Readings every 100 ms; the short-term window and the DR block are 3 s (30 hops).
const HOPS_PER_WINDOW: usize = 30;

pub struct Meter {
    rate: u32,
    channels: usize,
    hop: usize,
    ebu: EbuR128,
    pending: Vec<f32>,
    frames: u64,
    momentary: Vec<f64>,
    short_term: Vec<f64>,
    // Correlation, channels 1 and 2: the whole song, and each hop's sums for the 3 s windows.
    ll: f64,
    rr: f64,
    lr: f64,
    hop_sums: Vec<[f64; 3]>,
    // DR: per channel, each 3 s block's (sum of squares, peak) and the open block.
    blocks: Vec<Vec<(f64, f32, u64)>>,
    block: Vec<(f64, f32)>,
    block_frames: u64,
    runs: Vec<u32>,
    clipped: u32,
    sums: Vec<f64>,
}

impl Meter {
    pub fn new(rate: u32, channels: usize) -> Result<Meter, String> {
        let modes = Mode::I | Mode::S | Mode::M | Mode::LRA | Mode::TRUE_PEAK | Mode::SAMPLE_PEAK;
        let ebu = EbuR128::new(channels as u32, rate, modes).map_err(|e| e.to_string())?;
        Ok(Meter {
            rate,
            channels,
            hop: (rate / 10) as usize,
            ebu,
            pending: Vec::new(),
            frames: 0,
            momentary: Vec::new(),
            short_term: Vec::new(),
            ll: 0.0,
            rr: 0.0,
            lr: 0.0,
            hop_sums: Vec::new(),
            blocks: vec![Vec::new(); channels],
            block: vec![(0.0, 0.0); channels],
            block_frames: 0,
            runs: vec![0; channels],
            clipped: 0,
            sums: vec![0.0; channels],
        })
    }

    /// Interleaved frames, any count.
    pub fn push(&mut self, samples: &[f32]) -> Result<(), String> {
        self.pending.extend_from_slice(samples);
        let size = self.hop * self.channels;
        let mut at = 0;
        while self.pending.len() - at >= size {
            let chunk: Vec<f32> = self.pending[at..at + size].to_vec();
            self.hop_through(&chunk)?;
            at += size;
        }
        self.pending.drain(..at);
        Ok(())
    }

    fn hop_through(&mut self, chunk: &[f32]) -> Result<(), String> {
        self.ebu.add_frames_f32(chunk).map_err(|e| e.to_string())?;
        let n = chunk.len() / self.channels;
        let mut sums = [0.0; 3];
        let block_len = self.rate as u64 * 3;
        for frame in chunk.chunks_exact(self.channels) {
            for (c, &x) in frame.iter().enumerate() {
                let x64 = x as f64;
                self.sums[c] += x64;
                self.block[c].0 += x64 * x64;
                self.block[c].1 = self.block[c].1.max(x.abs());
                if x.abs() >= CLIP {
                    self.runs[c] += 1;
                    if self.runs[c] == CLIP_RUN {
                        self.clipped += 1;
                    }
                } else {
                    self.runs[c] = 0;
                }
            }
            if self.channels >= 2 {
                let (l, r) = (frame[0] as f64, frame[1] as f64);
                sums[0] += l * l;
                sums[1] += r * r;
                sums[2] += l * r;
            }
            self.block_frames += 1;
            if self.block_frames == block_len {
                self.close_block();
            }
        }
        self.frames += n as u64;
        self.ll += sums[0];
        self.rr += sums[1];
        self.lr += sums[2];
        self.hop_sums.push(sums);
        self.momentary.push(self.ebu.loudness_momentary().unwrap_or(f64::NEG_INFINITY));
        self.short_term.push(self.ebu.loudness_shortterm().unwrap_or(f64::NEG_INFINITY));
        Ok(())
    }

    fn close_block(&mut self) {
        for c in 0..self.channels {
            let (sq, peak) = self.block[c];
            self.blocks[c].push((sq, peak, self.block_frames));
            self.block[c] = (0.0, 0.0);
        }
        self.block_frames = 0;
    }

    pub fn finish(mut self) -> Result<Readings, String> {
        // The last partial hop still counts for loudness and peaks.
        if !self.pending.is_empty() {
            let rest = std::mem::take(&mut self.pending);
            self.ebu.add_frames_f32(&rest).map_err(|e| e.to_string())?;
            for frame in rest.chunks_exact(self.channels) {
                for (c, &x) in frame.iter().enumerate() {
                    self.sums[c] += x as f64;
                    self.block[c].0 += (x as f64) * (x as f64);
                    self.block[c].1 = self.block[c].1.max(x.abs());
                }
                if self.channels >= 2 {
                    let (l, r) = (frame[0] as f64, frame[1] as f64);
                    self.ll += l * l;
                    self.rr += r * r;
                    self.lr += l * r;
                }
                self.block_frames += 1;
            }
            self.frames += (rest.len() / self.channels) as u64;
        }
        if self.block_frames > 0 {
            self.close_block();
        }
        if self.frames == 0 {
            return Err("no audio".into());
        }

        let gated = |v: f64| if v.is_finite() && v >= FLOOR { Some(round1(v)) } else { None };
        let lufs = gated(self.ebu.loudness_global().map_err(|e| e.to_string())?);
        let lra = lufs.and(self.ebu.loudness_range().ok().map(round1));
        let max = |v: &[f64]| v.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

        let mut true_peak = 0.0f64;
        let mut sample_peak = 0.0f64;
        for c in 0..self.channels as u32 {
            true_peak = true_peak.max(self.ebu.true_peak(c).map_err(|e| e.to_string())?);
            sample_peak = sample_peak.max(self.ebu.sample_peak(c).map_err(|e| e.to_string())?);
        }
        let true_peak = db(true_peak, -200.0);
        let sample_peak = db(sample_peak, -200.0);

        let loudest = lufs.and_then(|_| {
            let (i, v) = self.short_term.iter().enumerate().fold((0, f64::NEG_INFINITY), |a, (i, &v)| if v > a.1 { (i, v) } else { a });
            gated(v).map(|lufs| Loudest { at_ms: ((i as i64 + 1) * 100 - 3000).max(0) as u64, lufs })
        });

        Ok(Readings {
            ms: self.frames * 1000 / self.rate as u64,
            lufs,
            lra,
            momentary_max: gated(max(&self.momentary)),
            short_term_max: gated(max(&self.short_term)),
            true_peak,
            sample_peak,
            plr: lufs.map(|l| round1((true_peak - l).max(0.0))),
            dr: dr(&self.blocks),
            correlation: self.correlation(),
            clipped: self.clipped,
            dc: self.sums.iter().map(|s| db((s / self.frames as f64).abs(), -120.0)).collect(),
            loudest,
            wave: wave(&self.short_term),
        })
    }

    fn correlation(&self) -> Option<Correlation> {
        if self.channels < 2 {
            return None;
        }
        let r = |ll: f64, rr: f64, lr: f64| if ll > 0.0 && rr > 0.0 { Some((lr / (ll * rr).sqrt()).clamp(-1.0, 1.0)) } else { None };
        let mean = r(self.ll, self.rr, self.lr).unwrap_or(0.0);
        let mut low = (mean, 0u64);
        if self.hop_sums.len() >= HOPS_PER_WINDOW {
            let mut w = [0.0; 3];
            for (i, s) in self.hop_sums.iter().enumerate() {
                for k in 0..3 {
                    w[k] += s[k];
                }
                if i >= HOPS_PER_WINDOW {
                    for k in 0..3 {
                        w[k] -= self.hop_sums[i - HOPS_PER_WINDOW][k];
                    }
                }
                if i + 1 >= HOPS_PER_WINDOW {
                    if let Some(v) = r(w[0], w[1], w[2]) {
                        if v < low.0 {
                            low = (v, ((i + 1 - HOPS_PER_WINDOW) * 100) as u64);
                        }
                    }
                }
            }
        }
        Some(Correlation { mean: round2(mean), min: round2(low.0), min_at_ms: low.1 })
    }
}

/// The TT Dynamic Range meter: 3 s blocks, RMS √(2·mean(x²)), the loudest 20% of blocks, the second-highest peak.
fn dr(blocks: &[Vec<(f64, f32, u64)>]) -> Option<u32> {
    let mut sum = 0.0;
    for ch in blocks {
        let mut rms: Vec<f64> = ch.iter().map(|&(sq, _, n)| (2.0 * sq / n as f64).sqrt()).collect();
        let mut peaks: Vec<f64> = ch.iter().map(|b| b.1 as f64).collect();
        rms.sort_by(|a, b| b.total_cmp(a));
        peaks.sort_by(|a, b| b.total_cmp(a));
        let top = ((rms.len() as f64 * 0.2).round() as usize).max(1);
        let rms20 = (rms[..top].iter().map(|r| r * r).sum::<f64>() / top as f64).sqrt();
        let peak2 = peaks.get(1).or(peaks.first()).copied()?;
        if rms20 <= 0.0 || peak2 <= 0.0 {
            return None;
        }
        sum += 20.0 * (peak2 / rms20).log10();
    }
    Some((sum / blocks.len() as f64).round().clamp(0.0, 40.0) as u32)
}

/// 256 bars, each the loudest short-term reading in its share of the song.
fn wave(readings: &[f64]) -> Vec<f64> {
    let n = readings.len().max(1);
    (0..WAVE_BARS)
        .map(|i| {
            let from = i * n / WAVE_BARS;
            let to = ((i + 1) * n / WAVE_BARS).max(from + 1).min(n);
            let v = readings.get(from..to).map_or(f64::NEG_INFINITY, |r| r.iter().cloned().fold(f64::NEG_INFINITY, f64::max));
            if v.is_finite() { round1(v.clamp(FLOOR, 10.0)) } else { FLOOR }
        })
        .collect()
}

fn db(linear: f64, floor: f64) -> f64 {
    if linear > 0.0 { round1((20.0 * linear.log10()).max(floor)) } else { floor }
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}
