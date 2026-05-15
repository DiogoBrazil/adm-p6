use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CrimeItem {
    pub id: String,
    pub tipo: Option<String>,
    pub dispositivo_legal: Option<String>,
    pub artigo: Option<String>,
    pub descricao_artigo: Option<String>,
    pub paragrafo: Option<String>,
    pub inciso: Option<String>,
    pub alinea: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TransgressionItem {
    pub id: String,
    pub artigo: Option<i32>,
    pub gravidade: Option<String>,
    pub inciso: Option<String>,
    pub texto: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Art29Item {
    pub id: String,
    pub inciso: Option<String>,
    pub texto: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ProceedingCatalogs {
    pub crimes: Vec<CrimeItem>,
    pub transgressoes: Vec<TransgressionItem>,
    pub art29: Vec<Art29Item>,
}

#[derive(Debug, Deserialize)]
pub struct SaveCrimeRequest {
    pub id: Option<String>,
    pub tipo: Option<String>,
    pub dispositivo_legal: Option<String>,
    pub artigo: String,
    pub descricao_artigo: Option<String>,
    pub paragrafo: Option<String>,
    pub inciso: Option<String>,
    pub alinea: Option<String>,
}

impl SaveCrimeRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.artigo.trim().is_empty() {
            return Err("artigo e obrigatorio".to_string());
        }
        if let Some(alinea) = self.alinea.as_deref() {
            if !alinea.is_empty() && (alinea.len() != 1 || !alinea.chars().all(|c| c.is_ascii_lowercase())) {
                return Err("alinea deve ser uma letra minuscula".to_string());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct SaveTransgressionRequest {
    pub id: Option<String>,
    pub artigo: Option<i32>,
    pub gravidade: Option<String>,
    pub inciso: Option<String>,
    pub texto: String,
}

impl SaveTransgressionRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.texto.trim().is_empty() {
            return Err("texto e obrigatorio".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct SaveArt29Request {
    pub id: Option<String>,
    pub inciso: String,
    pub texto: String,
}

impl SaveArt29Request {
    pub fn validate(&self) -> Result<(), String> {
        if self.inciso.trim().is_empty() {
            return Err("inciso e obrigatorio".to_string());
        }
        if self.texto.trim().is_empty() {
            return Err("texto e obrigatorio".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
pub struct SaveCatalogResult {
    pub id: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LocalOrigemItem {
    pub id: String,
    pub nome: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PostoGraduacaoItem {
    pub id: String,
    pub nome: String,
    pub sigla: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NaturezaItem {
    pub id: String,
    pub nome: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MunicipalityItem {
    pub id: String,
    pub nome: String,
    pub tipo: Option<String>,
    pub municipio_pai: Option<String>,
    pub nome_exibicao: String,
}
