use serde::{Deserialize, Serialize};

use crate::legal_catalogs::domain::{Art29Item, CrimeItem, TransgressionItem};

#[derive(Debug, Serialize)]
pub struct PmWithEvidence {
    pub pm_envolvido_id: String,
    pub pm_id: String,
    pub nome: Option<String>,
    pub posto_graduacao: Option<String>,
    pub matricula: Option<String>,
    pub status_pm: Option<String>,
    pub indicios: EvidenceData,
}

#[derive(Debug, Deserialize)]
pub struct SaveEvidenceRequest {
    pub pm_envolvido_id: String,
    pub categorias: Vec<String>,
    pub crimes: Vec<String>,  // TEXT ids
    pub rdpm: Vec<i32>,       // INTEGER ids
    pub art29: Vec<String>,   // TEXT ids
}

#[derive(Debug, Serialize)]
pub struct EvidenceData {
    pub pm_envolvido_id: String,
    pub categorias: Vec<String>,
    pub crimes: Vec<CrimeItem>,
    pub rdpm: Vec<TransgressionItem>,
    pub art29: Vec<Art29Item>,
}
