use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeadlineSummary {
    pub total: i64,
    pub vencidos: i64,
    pub proximos_7_dias: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeadlineItem {
    pub id: String,
    pub processo_id: String,
    pub tipo_prazo: String,
    pub data_inicio: NaiveDate,
    pub data_vencimento: NaiveDate,
    pub dias_adicionados: Option<i32>,
    pub motivo: Option<String>,
    pub autorizado_por: Option<String>,
    pub autorizado_tipo: Option<String>,
    pub ativo: Option<bool>,
    pub numero_portaria: Option<String>,
    pub data_portaria: Option<NaiveDate>,
    pub ordem_prorrogacao: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UpcomingDeadlineItem {
    pub processo_id: String,
    pub numero_processo: String,
    pub tipo_detalhe: String,
    pub data_vencimento: NaiveDate,
    pub dias_restantes: i32,
}

#[derive(Debug, Serialize)]
pub struct CalculateDeadlineResult {
    pub data_vencimento: NaiveDate,
    pub dias_prazo: i32,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct OverdueDeadlineItem {
    pub processo_id: String,
    pub numero_processo: String,
    pub tipo_detalhe: String,
    pub responsavel_nome: Option<String>,
    pub data_vencimento: NaiveDate,
    pub dias_atraso: i32,
}

#[derive(Debug, Deserialize, Default)]
pub struct DeadlineReportFilter {
    pub tipo_detalhe: Option<String>,
    pub responsavel_id: Option<String>,
    pub apenas_vencidos: Option<bool>,
    pub ano: Option<i32>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DeadlineReportItem {
    pub processo_id: String,
    pub numero_processo: String,
    pub tipo_detalhe: String,
    pub responsavel_nome: Option<String>,
    pub data_vencimento: NaiveDate,
    pub dias_restantes: i32,
    pub tipo_prazo: String,
}

#[derive(Debug, Deserialize)]
pub struct AddExtensionRequest {
    pub processo_id: String,
    pub dias_prorrogacao: i32,
    pub motivo: String,
    pub autorizado_por: String,
    pub autorizado_tipo: String,
    pub numero_portaria: Option<String>,
    pub data_portaria: Option<NaiveDate>,
}

impl AddExtensionRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.dias_prorrogacao <= 0 {
            return Err("Dias de prorrogacao deve ser maior que zero".to_string());
        }
        if self.motivo.trim().is_empty() {
            return Err("Motivo e obrigatorio para prorrogacao".to_string());
        }
        Ok(())
    }
}
