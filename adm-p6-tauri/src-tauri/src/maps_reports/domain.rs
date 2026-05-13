use chrono::{NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DashboardSummary {
    pub total_processos: i64,
    pub em_andamento: i64,
    pub concluidos: i64,
    pub prazos_vencidos: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SavedMapListItem {
    pub id: String,
    pub titulo: Option<String>,
    pub tipo_processo: Option<String>,
    pub periodo_descricao: Option<String>,
    pub total_processos: Option<i32>,
    pub total_concluidos: Option<i32>,
    pub total_andamento: Option<i32>,
    pub usuario_nome: Option<String>,
    pub data_geracao: Option<NaiveDateTime>,
    pub nome_arquivo: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct SavedMapFull {
    pub id: String,
    pub titulo: Option<String>,
    pub tipo_processo: Option<String>,
    pub periodo_descricao: Option<String>,
    pub total_processos: Option<i32>,
    pub total_concluidos: Option<i32>,
    pub total_andamento: Option<i32>,
    pub usuario_nome: Option<String>,
    pub data_geracao: Option<NaiveDateTime>,
    pub nome_arquivo: Option<String>,
    pub dados_mapa: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct GenerateMapRequest {
    pub mes: i32,
    pub ano: i32,
    pub tipo_processo: String,
}

#[derive(Debug, Deserialize)]
pub struct GenerateCompleteMapRequest {
    pub mes: i32,
    pub ano: i32,
}

#[derive(Debug, Deserialize)]
pub struct SaveMapRequest {
    pub dados_mapa: Value,
}

#[derive(Debug, Serialize)]
pub struct MonthlyMapResult {
    pub dados: Vec<Value>,
    pub meta: Value,
}

#[derive(Debug, Serialize)]
pub struct CompleteMapResult {
    pub dados: HashMap<String, Value>,
    pub meta: Value,
}

#[derive(Debug, Serialize)]
pub struct SaveMapResult {
    pub mapa_id: String,
}

#[derive(Debug, Serialize)]
pub struct ReportContract {
    pub name: &'static str,
    pub parity: &'static str,
    pub commands: Vec<&'static str>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoProcessoItem {
    pub codigo: String,
    pub total: i64,
}

// ── Relatórios ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoStatusCount {
    pub tipo_detalhe: Option<String>,
    pub total: i64,
    pub concluidos: i64,
    pub em_andamento: i64,
}

#[derive(Debug, Serialize)]
pub struct AnnualStatistics {
    pub ano: i32,
    pub total_processos: i64,
    pub total_procedimentos: i64,
    pub total_geral: i64,
    pub processos_por_tipo: Vec<TipoStatusCount>,
    pub procedimentos_por_tipo: Vec<TipoStatusCount>,
    pub ipm_sindicancia_indicios_crime: i64,
    pub ipm_sindicancia_indicios_transgressao: i64,
    pub pad_pads_punidos: i64,
    pub pad_pads_absolvidos_arquivados: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ResponsavelRelatorio {
    pub responsavel_id: Option<String>,
    pub responsavel_nome: String,
    pub responsavel_posto: String,
    pub responsavel_matricula: String,
    pub total: i64,
    pub concluidos: i64,
    pub em_andamento: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoRelatorio {
    pub tipo_detalhe: Option<String>,
    pub categoria: String,
    pub total: i64,
    pub concluidos: i64,
    pub em_andamento: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PrazoVencidoItem {
    pub id: String,
    pub numero: Option<String>,
    pub tipo_detalhe: Option<String>,
    pub responsavel_nome: String,
    pub data_vencimento: NaiveDate,
    pub dias_atraso: i32,
    pub prazo_tipo: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CsvExportRequest {
    pub tipo_relatorio: String,
    pub ano: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct CsvExportResult {
    pub csv_base64: String,
    pub filename: String,
}
