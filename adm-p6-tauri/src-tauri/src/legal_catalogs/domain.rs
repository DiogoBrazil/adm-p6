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

// ── LocalOrigem (schema reestruturado: unidade_pm + cidade FK) ──────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct LocalOrigemItem {
    pub id: String,
    pub unidade_pm: String,
    pub cidade_id: String,
    pub cidade_nome: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveLocalOrigemRequest {
    pub id: Option<String>,
    pub unidade_pm: String,
    pub cidade_id: String,
}

impl SaveLocalOrigemRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.unidade_pm.trim().is_empty() {
            return Err("unidade_pm e obrigatoria".to_string());
        }
        if self.cidade_id.trim().is_empty() {
            return Err("cidade e obrigatoria".to_string());
        }
        Ok(())
    }
}

// ── MunicipioDistrito ────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MunicipioCRUDItem {
    pub id: String,
    pub nome: String,
    pub tipo: String,
    pub is_distrito: bool,
    pub municipio_pai: Option<String>,
    pub municipio_pai_nome: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveMunicipioDistritoRequest {
    pub id: Option<String>,
    pub nome: String,
    pub is_distrito: bool,
    pub municipio_pai: Option<String>,
}

impl SaveMunicipioDistritoRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome.trim().is_empty() {
            return Err("nome e obrigatorio".to_string());
        }
        if self.is_distrito && self.municipio_pai.as_deref().unwrap_or("").trim().is_empty() {
            return Err("municipio pai e obrigatorio para distritos".to_string());
        }
        Ok(())
    }
}

// ── StatusEnvolvido ───────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct StatusEnvolvidoItem {
    pub id: String,
    pub nome_status: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveStatusEnvolvidoRequest {
    pub id: Option<String>,
    pub nome_status: String,
}

impl SaveStatusEnvolvidoRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome_status.trim().is_empty() {
            return Err("nome_status e obrigatorio".to_string());
        }
        Ok(())
    }
}

// ── SolucaoTipo ───────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SolucaoTipoItem {
    pub id: String,
    pub nome_solucao: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveSolucaoTipoRequest {
    pub id: Option<String>,
    pub nome_solucao: String,
}

impl SaveSolucaoTipoRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome_solucao.trim().is_empty() {
            return Err("nome_solucao e obrigatorio".to_string());
        }
        Ok(())
    }
}

// ── TipoPenalidade ────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoPenalidadeItem {
    pub id: String,
    pub nome_penalidade: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveTipoPenalidadeRequest {
    pub id: Option<String>,
    pub nome_penalidade: String,
}

impl SaveTipoPenalidadeRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome_penalidade.trim().is_empty() {
            return Err("nome_penalidade e obrigatorio".to_string());
        }
        Ok(())
    }
}

// ── TipoPrazo ─────────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoPrazoItem {
    pub id: String,
    pub nome_prazo: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveTipoPrazoRequest {
    pub id: Option<String>,
    pub nome_prazo: String,
}

impl SaveTipoPrazoRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome_prazo.trim().is_empty() {
            return Err("nome_prazo e obrigatorio".to_string());
        }
        Ok(())
    }
}

// ── TipoApuratorio ────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoApuratorioItem {
    pub id: String,
    pub tipo: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveTipoApuratorioRequest {
    pub id: Option<String>,
    pub tipo: String,
}

impl SaveTipoApuratorioRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.tipo.trim().is_empty() {
            return Err("tipo e obrigatorio".to_string());
        }
        Ok(())
    }
}

// ── Apuratorio ────────────────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ApuratorioItem {
    pub id: String,
    pub nome_apuratorio: String,
    pub tipo_apuratorio_id: String,
    pub tipo_apuratorio: Option<String>,
    pub prazo_base_dias: i32,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveApuratorioRequest {
    pub id: Option<String>,
    pub nome_apuratorio: String,
    pub tipo_apuratorio_id: String,
    pub prazo_base_dias: i32,
}

impl SaveApuratorioRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome_apuratorio.trim().is_empty() {
            return Err("nome_apuratorio e obrigatorio".to_string());
        }
        if self.tipo_apuratorio_id.trim().is_empty() {
            return Err("tipo_apuratorio e obrigatorio".to_string());
        }
        if self.prazo_base_dias <= 0 {
            return Err("prazo_base_dias deve ser positivo".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PostoGraduacaoItem {
    pub id: String,
    pub nome: String,
    pub tipo_usuario_id: Option<String>,
    pub tipo_usuario: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SavePostoGraduacaoRequest {
    pub id: Option<String>,
    pub nome: String,
    pub tipo_usuario_id: String,
}

impl SavePostoGraduacaoRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome.trim().is_empty() {
            return Err("nome e obrigatorio".to_string());
        }
        if self.tipo_usuario_id.trim().is_empty() {
            return Err("tipo_usuario e obrigatorio".to_string());
        }
        Ok(())
    }
}

// ── NaturezaTransgressao ─────────────────────────────────────────────────────
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NaturezaTransgressaoItem {
    pub id: String,
    pub nome_natureza: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveNaturezaTransgressaoRequest {
    pub id: Option<String>,
    pub nome_natureza: String,
}

impl SaveNaturezaTransgressaoRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.nome_natureza.trim().is_empty() {
            return Err("nome_natureza e obrigatorio".to_string());
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
    pub natureza_id: String,
    pub natureza: Option<String>,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveArtigoRdpmRequest {
    pub id: Option<String>,
    pub artigo: String,
    pub natureza_id: String,
}

impl SaveArtigoRdpmRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.artigo.trim().is_empty() {
            return Err("artigo e obrigatorio".to_string());
        }
        if self.natureza_id.trim().is_empty() {
            return Err("natureza e obrigatoria".to_string());
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

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoDocumentoItem {
    pub id: String,
    pub tipo: String,
    pub ativo: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct SaveTipoDocumentoRequest {
    pub id: Option<String>,
    pub tipo: String,
}

impl SaveTipoDocumentoRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.tipo.trim().is_empty() {
            return Err("tipo e obrigatorio".to_string());
        }
        Ok(())
    }
}
