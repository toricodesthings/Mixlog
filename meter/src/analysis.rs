//! The JSON the meter hands back. `meter` and `source` are added by the caller (`METER` lives in `server/loudness.ts`).

use serde::Serialize;

#[derive(Serialize, Debug, Clone)]
pub struct Format {
    pub codec: &'static str,
    pub rate: u32,
    pub bits: Option<u32>,
    pub channels: usize,
    pub kbps: Option<u32>,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Correlation {
    pub mean: f64,
    pub min: f64,
    pub min_at_ms: u64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Loudest {
    pub at_ms: u64,
    pub lufs: f64,
}

#[derive(Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Readings {
    pub ms: u64,
    pub lufs: Option<f64>,
    pub lra: Option<f64>,
    pub momentary_max: Option<f64>,
    pub short_term_max: Option<f64>,
    pub true_peak: f64,
    pub sample_peak: f64,
    pub plr: Option<f64>,
    pub dr: Option<u32>,
    pub correlation: Option<Correlation>,
    pub clipped: u32,
    pub dc: Vec<f64>,
    pub loudest: Option<Loudest>,
    pub wave: Vec<f64>,
}

#[derive(Serialize, Debug, Clone)]
pub struct Analysis {
    pub format: Format,
    #[serde(flatten)]
    pub readings: Readings,
}

pub fn round1(v: f64) -> f64 {
    (v * 10.0).round() / 10.0
}
