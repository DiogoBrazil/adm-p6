use serde::{Deserialize, Serialize};

use crate::legal_catalogs::domain::{CrimeItem, TransgressionItem};

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

/// Seleção de infração (art. 29 / art. 32) com a analogia obrigatória ao RDPM.
#[derive(Debug, Deserialize)]
pub struct ArtSelection {
    pub infracao_id: String,
    pub analogia_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveEvidenceRequest {
    pub pm_envolvido_id: String,
    pub categorias: Vec<String>,
    pub crimes_militares: Vec<String>,
    pub crimes_comuns: Vec<String>,
    pub rdpm: Vec<String>,
    pub art29: Vec<ArtSelection>,
    pub art32: Vec<ArtSelection>,
}

/// Infração (art. 29 / art. 32) com a transgressão usada por analogia, achatada para o frontend.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InfractionEvidence {
    pub id: String,
    pub infracao_id: String,
    pub infracao_inciso: Option<String>,
    pub infracao_texto: Option<String>,
    pub analogia_id: String,
    pub analogia_inciso: Option<String>,
    pub analogia_texto: Option<String>,
    pub analogia_artigo: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EvidenceData {
    pub pm_envolvido_id: String,
    pub categorias: Vec<String>,
    pub crimes_militares: Vec<CrimeItem>,
    pub crimes_comuns: Vec<CrimeItem>,
    pub rdpm: Vec<TransgressionItem>,
    pub art29: Vec<InfractionEvidence>,
    pub art32: Vec<InfractionEvidence>,
}

impl EvidenceData {
    pub fn empty(pm_envolvido_id: &str) -> Self {
        EvidenceData {
            pm_envolvido_id: pm_envolvido_id.to_string(),
            categorias: vec![],
            crimes_militares: vec![],
            crimes_comuns: vec![],
            rdpm: vec![],
            art29: vec![],
            art32: vec![],
        }
    }
}
