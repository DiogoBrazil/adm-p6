use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeadlineSummary {
    pub total: i64,
    pub vencidos: i64,
    pub proximos: i64,
}

/// Um prazo do processo. `ordem` 0 é o prazo inicial; 1 em diante são as
/// prorrogações, na sequência em que foram concedidas. A distinção deixou de vir
/// de um catálogo cujo nome ("inicial"/"prorrogacao") dirigia o algoritmo.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeadlineItem {
    pub id: String,
    pub processo_id: String,
    pub ordem: i32,
    pub data_inicio: NaiveDate,
    pub dias: i32,
    pub data_vencimento: NaiveDate,
    pub motivo: Option<String>,
    pub documento_autorizador_id: Option<String>,
    pub documento_autorizador: Option<String>,
    pub numero_documento: Option<String>,
    pub data_documento: Option<NaiveDate>,
    pub autoridade_id: Option<String>,
    pub autoridade: Option<String>,
    /// Vigente = é o prazo de maior ordem do processo.
    pub vigente: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeadlineReportItem {
    pub processo_id: String,
    pub apuratorio_sigla: String,
    pub numero_controle: String,
    pub unidade_origem: String,
    pub responsavel_nome: Option<String>,
    pub responsavel_matricula: Option<String>,
    pub responsavel_posto_graduacao: Option<String>,
    pub data_vencimento: NaiveDate,
    /// Negativo = já venceu.
    pub dias_restantes: i32,
    pub ordem: i32,
}

#[derive(Debug, Deserialize, Default)]
pub struct DeadlineReportFilter {
    /// Espécies de apuratório a incluir. Vazio = todas. Substitui os `IN (...)`
    /// de siglas que existiam escritos no SQL.
    pub apuratorio_ids: Option<Vec<String>>,
    pub responsavel_id: Option<String>,
    /// Só o que venceu **antes de hoje**.
    pub apenas_vencidos: Option<bool>,
    /// Janela em dias: de hoje até hoje + N. **Não alcança o que já venceu** —
    /// ver o cabeçalho de `repository::report`.
    pub dias_ate_vencer: Option<i32>,
    pub ano: Option<i32>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

/// Envelope da listagem de prazos. Mesmo contrato de `UserListResult`.
#[derive(Debug, Serialize)]
pub struct DeadlineReportResult {
    pub items: Vec<DeadlineReportItem>,
    /// Total do **escopo filtrado**, não da página.
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Serialize)]
pub struct CalculateDeadlineResult {
    pub data_vencimento: NaiveDate,
    pub dias: i32,
    /// De onde veio o número de dias: a combinação apuratório × documento
    /// iniciador, ou o padrão do apuratório.
    pub origem: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct AddExtensionRequest {
    pub processo_id: String,
    /// Data final escolhida pelo usuário. O repositório deriva `dias` a partir
    /// do vencimento vigente, que também é o início da nova prorrogação.
    pub nova_data_vencimento: NaiveDate,
    pub motivo: String,
    pub documento_autorizador_id: Option<String>,
    pub numero_documento: Option<String>,
    pub data_documento: Option<NaiveDate>,
    /// Autoridade que concedeu a prorrogação, quando registrada.
    pub autoridade_id: Option<String>,
}

impl AddExtensionRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.motivo.trim().is_empty() {
            return Err("Informe o motivo da prorrogação.".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateExtensionRequest {
    pub processo_id: String,
    pub prazo_id: String,
    /// Corrige o vencimento da ultima prorrogacao. O inicio permanece sendo o
    /// vencimento anterior e `dias` e recalculado pelo repositorio.
    pub nova_data_vencimento: NaiveDate,
}
