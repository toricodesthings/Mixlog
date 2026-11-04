//! EBU Tech 3341 / 3342 signals synthesized here, checked at EBU's own tolerances; then DR, phase, clips and the wave.

use std::f64::consts::PI;

use mixlog_meter::analysis::Readings;
use mixlog_meter::measure::Meter;

const RATE: u32 = 48_000;

/// Stereo sine, the same on both channels unless `right` says otherwise.
fn sine(parts: &[(f64, f64)], hz: f64, phase: f64, right: f64) -> Vec<f32> {
    let mut out = Vec::new();
    let mut n = 0u64;
    for &(dbfs, secs) in parts {
        let a = 10f64.powf(dbfs / 20.0);
        for _ in 0..(secs * RATE as f64) as u64 {
            let x = a * (2.0 * PI * hz * n as f64 / RATE as f64 + phase).sin();
            out.push(x as f32);
            out.push((x * right) as f32);
            n += 1;
        }
    }
    out
}

fn run(samples: &[f32], channels: usize) -> Readings {
    let mut m = Meter::new(RATE, channels).unwrap();
    for chunk in samples.chunks(4096 * channels) {
        m.push(chunk).unwrap();
    }
    m.finish().unwrap()
}

fn near(got: Option<f64>, want: f64, tol: f64) {
    let got = got.expect("a reading");
    assert!((got - want).abs() <= tol, "got {got}, want {want} ± {tol}");
}

#[test]
fn tech_3341_integrated() {
    near(run(&sine(&[(-23.0, 20.0)], 1000.0, 0.0, 1.0), 2).lufs, -23.0, 0.1);
    near(run(&sine(&[(-33.0, 20.0)], 1000.0, 0.0, 1.0), 2).lufs, -33.0, 0.1);
    // Case 3: the relative gate drops the quiet ends.
    near(run(&sine(&[(-36.0, 10.0), (-23.0, 60.0), (-36.0, 10.0)], 1000.0, 0.0, 1.0), 2).lufs, -23.0, 0.1);
    // Case 4: the absolute gate drops the near-silent ends.
    near(run(&sine(&[(-72.0, 10.0), (-36.0, 10.0), (-23.0, 60.0), (-36.0, 10.0), (-72.0, 10.0)], 1000.0, 0.0, 1.0), 2).lufs, -23.0, 0.1);
}

#[test]
fn tech_3341_momentary_and_short_term() {
    let r = run(&sine(&[(-23.0, 20.0)], 1000.0, 0.0, 1.0), 2);
    near(r.momentary_max, -23.0, 0.1);
    near(r.short_term_max, -23.0, 0.1);
}

#[test]
fn tech_3341_true_peak() {
    // Cases 15–18: a −6 dBFS sine at fs/4, fs/6, fs/8 with phase offsets reads −6.0 dBTP (+0.2 / −0.4).
    for (hz, phase) in [(12_000.0, 0.0), (12_000.0, 45.0), (8_000.0, 60.0), (6_000.0, 67.5)] {
        // A 50 ms fade at each end: an abrupt start rings in the oversampler, which no real bounce does.
        let mut s = sine(&[(-6.0, 5.0)], hz, phase * PI / 180.0, 1.0);
        let fade = RATE as usize / 20;
        let frames = s.len() / 2;
        for i in 0..fade {
            let g = i as f32 / fade as f32;
            for j in [2 * i, 2 * i + 1, 2 * (frames - 1 - i), 2 * (frames - 1 - i) + 1] {
                s[j] *= g;
            }
        }
        let tp = run(&s, 2).true_peak;
        assert!((-6.4..=-5.8).contains(&tp), "{hz} Hz @ {phase}°: {tp}");
    }
}

#[test]
fn tech_3342_lra() {
    for (parts, want) in [
        ([(-20.0, 20.0), (-30.0, 20.0)], 10.0),
        ([(-20.0, 20.0), (-15.0, 20.0)], 5.0),
        ([(-40.0, 20.0), (-20.0, 20.0)], 20.0),
    ] {
        near(run(&sine(&parts, 1000.0, 0.0, 1.0), 2).lra, want, 1.0);
    }
}

#[test]
fn dr_of_a_sine_is_zero() {
    // TT DR's RMS is √(2·mean(x²)), so a sine's RMS equals its peak.
    assert_eq!(run(&sine(&[(0.0, 30.0)], 1000.0, 0.0, 1.0), 2).dr, Some(0));
}

#[test]
fn dr_of_two_levels() {
    // Loudest 20% of 3 s blocks sit at −20 dBFS, the peaks at 0 dBFS: a −20 dB sine with one full-scale click per block.
    let mut s = sine(&[(-20.0, 60.0)], 1000.0, 0.0, 1.0);
    for block in 0..20 {
        let i = (block * 3 * RATE as usize + 7) * 2;
        s[i] = 1.0;
        s[i + 1] = 1.0;
    }
    assert_eq!(run(&s, 2).dr, Some(20));
}

#[test]
fn correlation() {
    let same = run(&sine(&[(-20.0, 10.0)], 440.0, 0.0, 1.0), 2).correlation.unwrap();
    assert_eq!((same.mean, same.min), (1.0, 1.0));
    assert_eq!(run(&sine(&[(-20.0, 10.0)], 440.0, 0.0, -1.0), 2).correlation.unwrap().mean, -1.0);

    let mut seed = 1u64;
    let mut noise = || {
        seed ^= seed << 13;
        seed ^= seed >> 7;
        seed ^= seed << 17;
        (seed as f64 / u64::MAX as f64 - 0.5) as f32 * 0.5
    };
    let independent: Vec<f32> = (0..RATE * 20 * 2).map(|_| noise()).collect();
    assert!(run(&independent, 2).correlation.unwrap().mean.abs() < 0.05);

    let mono: Vec<f32> = sine(&[(-20.0, 5.0)], 440.0, 0.0, 1.0).into_iter().step_by(2).collect();
    assert!(run(&mono, 1).correlation.is_none());
}

#[test]
fn clipping_counts_runs_of_three() {
    let mut s = vec![0.1f32; RATE as usize * 2 * 2];
    s[100] = 1.0;
    s[102] = 1.0; // left channel: two in a row
    assert_eq!(run(&s, 2).clipped, 0);
    s[104] = 1.0; // three
    assert_eq!(run(&s, 2).clipped, 1);
}

#[test]
fn wave_always_has_256_bars() {
    assert_eq!(run(&sine(&[(-20.0, 10.0)], 440.0, 0.0, 1.0), 2).wave.len(), 256);
    assert_eq!(run(&sine(&[(-20.0, 600.0)], 440.0, 0.0, 1.0), 2).wave.len(), 256);
}

#[test]
fn silence_has_no_loudness() {
    let r = run(&vec![0.0; RATE as usize * 10 * 2], 2);
    assert!(r.lufs.is_none() && r.lra.is_none() && r.plr.is_none() && r.loudest.is_none());
    assert_eq!(r.true_peak, -200.0);
    assert!(r.wave.iter().all(|&b| b == -70.0));
}

#[test]
fn a_wav_decodes_and_measures() {
    // 24-bit / 48 kHz stereo, −23 dBFS sine, written here.
    let s = sine(&[(-23.0, 20.0)], 1000.0, 0.0, 1.0);
    let mut wav = Vec::new();
    let data = (s.len() * 3) as u32;
    wav.extend(b"RIFF");
    wav.extend((36 + data).to_le_bytes());
    wav.extend(b"WAVEfmt ");
    wav.extend(16u32.to_le_bytes());
    wav.extend(1u16.to_le_bytes());
    wav.extend(2u16.to_le_bytes());
    wav.extend(RATE.to_le_bytes());
    wav.extend((RATE * 6).to_le_bytes());
    wav.extend(6u16.to_le_bytes());
    wav.extend(24u16.to_le_bytes());
    wav.extend(b"data");
    wav.extend(data.to_le_bytes());
    for x in s {
        wav.extend(&(((x as f64) * 8_388_607.0).round() as i32).to_le_bytes()[..3]);
    }
    let a = mixlog_meter::measure_bytes(wav, "wav").unwrap();
    assert_eq!((a.format.codec, a.format.rate, a.format.bits, a.format.channels), ("pcm", 48_000, Some(24), 2));
    assert_eq!(a.readings.ms, 20_000);
    near(a.readings.lufs, -23.0, 0.1);
}

#[test]
fn unknown_bytes_are_unreadable() {
    assert!(matches!(mixlog_meter::measure_bytes(vec![7; 10_000], "ogg"), Err(mixlog_meter::decode::Fail::Unreadable)));
}
