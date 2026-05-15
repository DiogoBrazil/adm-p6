use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CrimeItem {
    pub id: String,
    pub dispositivo_legal: Option<String>,
    pub dispositivo_legal_id: Option<String>,
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
    pub artigo: Option<String>,
    pub natureza: Option<String>,
    pub artigo_id: Option<String>,
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
    pub dispositivo_legal_id: Option<String>,
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
    pub artigo_id: Option<String>,
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

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Art32Item {
    pub id: String,
    pub inciso: Option<String>,
    pub texto: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveArt32Request {
    pub id: Option<String>,
    pub inciso: String,
    pub texto: String,
}

impl SaveArt32Request {
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
    pub tipo: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SavePostoGraduacaoRequest {
    pub id: Option<String>,
    pub nome: String,
    pub tipo: String,
}

impl SavePostoGraduacaoRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome.trim().is_empty() {
            return Err("nome e obrigatorio".to_string());
        }
        if self.tipo.trim().is_empty() {
            return Err("tipo e obrigatorio".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NaturezaItem {
    pub id: String,
    pub nome: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoUsuarioItem {
    pub id: String,
    pub nome: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveTipoUsuarioRequest {
    pub id: Option<String>,
    pub nome: String,
}

impl SaveTipoUsuarioRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome.trim().is_empty() {
            return Err("nome e obrigatorio".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DispositivoLegalItem {
    pub id: String,
    pub nome: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveDispositivoLegalRequest {
    pub id: Option<String>,
    pub nome: String,
}

impl SaveDispositivoLegalRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome.trim().is_empty() {
            return Err("nome e obrigatorio".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ArtigoRdpmItem {
    pub id: String,
    pub nome: String,
    pub artigo: String,
    pub natureza: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveArtigoRdpmRequest {
    pub id: Option<String>,
    pub artigo: String,
    pub natureza: String,
}

impl SaveArtigoRdpmRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.artigo.trim().is_empty() {
            return Err("artigo e obrigatorio".to_string());
        }
        if !["Leve", "Média", "Grave"].contains(&self.natureza.as_str()) {
            return Err("natureza deve ser Leve, Media ou Grave".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MunicipalityItem {
    pub id: String,
    pub nome: String,
    pub tipo: Option<String>,
    pub municipio_pai: Option<String>,
    pub nome_exibicao: String,
}
