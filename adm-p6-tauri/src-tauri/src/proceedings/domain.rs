use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProceedingListItem {
    pub id: String,
    pub numero: String,
    pub tipo_geral: String,
    pub tipo_detalhe: String,
    pub documento_iniciador: String,
    pub local_origem: Option<String>,
    pub data_instauracao: Option<NaiveDate>,
    pub concluido: Option<bool>,
    pub ativo: Option<bool>,
    pub responsavel_nome: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProceedingFormSchema {
    pub title: &'static str,
    pub admin_only: bool,
    pub allowed_tipo_detalhe: Vec<&'static str>,
    pub forbidden_tipo_detalhe: Vec<&'static str>,
    pub sections: Vec<&'static str>,
    pub validations: Vec<&'static str>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProceedingRequest {
    pub numero: String,
    pub tipo_geral: String,
    pub tipo_detalhe: String,
    pub documento_iniciador: String,
    pub processo_sei: Option<String>,
    pub responsavel_id: Option<String>,
    pub local_origem: Option<String>,
    pub local_fatos: String,
    pub data_instauracao: Option<NaiveDate>,
    pub data_recebimento: Option<NaiveDate>,
    pub escrivao_id: Option<String>,
    pub nome_vitima: Option<String>,
    pub natureza_processo: Option<String>,
    pub resumo_fatos: Option<String>,
    pub numero_portaria: Option<String>,
    pub numero_memorando: Option<String>,
    pub numero_feito: Option<String>,
    pub numero_rgf: Option<String>,
    pub concluido: Option<bool>,
    pub data_conclusao: Option<NaiveDate>,
    pub solucao_final: Option<String>,
    pub data_remessa_encarregado: Option<NaiveDate>,
    pub data_remessa_comissao: Option<NaiveDate>,
    pub data_julgamento: Option<NaiveDate>,
    pub solucao_tipo: Option<String>,
    pub penalidade_tipo: Option<String>,
    pub penalidade_dias: Option<i32>,
    pub presidente_id: Option<String>,
    pub interrogante_id: Option<String>,
    pub escrivao_processo_id: Option<String>,
    pub unidade_deprecada: Option<String>,
    pub deprecante: Option<String>,
    pub pms_envolvidos: Option<Vec<String>>,
}

impl CreateProceedingRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.tipo_detalhe == "IPPM" {
            return Err("Tipo IPPM nao e permitido neste sistema".to_string());
        }

        let today = chrono::Local::now().date_naive();
        if let Some(d) = self.data_instauracao {
            if d > today {
                return Err("Data de instauracao nao pode ser futura".to_string());
            }
        }
        if let Some(d) = self.data_conclusao {
            if d > today {
                return Err("Data de conclusao nao pode ser futura".to_string());
            }
        }

        if self.local_fatos.trim().is_empty() {
            return Err("Local dos fatos e obrigatorio".to_string());
        }

        const DOCS_VALIDOS: &[&str] = &["Portaria", "Memorando Disciplinar", "Feito Preliminar"];
        if !DOCS_VALIDOS.contains(&self.documento_iniciador.as_str()) {
            return Err(format!(
                "Documento iniciador invalido. Permitidos: {}",
                DOCS_VALIDOS.join(", ")
            ));
        }

        if let Some(dias) = self.penalidade_dias {
            if dias > 0 {
                match self.penalidade_tipo.as_deref() {
                    Some("Prisao") | Some("Detencao") => {}
                    _ => {
                        return Err(
                            "penalidade_dias somente permitido para Prisao ou Detencao"
                                .to_string(),
                        )
                    }
                }
            }
        }

        Ok(())
    }

    pub fn deadline_days(&self) -> i32 {
        if self.documento_iniciador == "Feito Preliminar" {
            return 15;
        }
        match self.tipo_detalhe.as_str() {
            "SV" => 15,
            "IPM" => 40,
            _ => 30,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct CreateProceedingResult {
    pub id: String,
}

#[derive(Debug, Serialize)]
pub struct PmEnvolvido {
    pub id: String,
    pub pm_id: String,
    pub nome: Option<String>,
    pub posto_graduacao: Option<String>,
    pub matricula: Option<String>,
    pub status_pm: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ActiveDeadline {
    pub id: String,
    pub tipo_prazo: String,
    pub data_inicio: NaiveDate,
    pub data_vencimento: NaiveDate,
    pub dias_adicionados: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ProceedingDetail {
    pub id: String,
    pub numero: String,
    pub tipo_geral: String,
    pub tipo_detalhe: String,
    pub documento_iniciador: String,
    pub processo_sei: Option<String>,
    pub responsavel_id: Option<String>,
    pub local_origem: Option<String>,
    pub local_fatos: Option<String>,
    pub data_instauracao: Option<NaiveDate>,
    pub data_recebimento: Option<NaiveDate>,
    pub escrivao_id: Option<String>,
    pub nome_vitima: Option<String>,
    pub natureza_processo: Option<String>,
    pub resumo_fatos: Option<String>,
    pub numero_portaria: Option<String>,
    pub numero_memorando: Option<String>,
    pub numero_feito: Option<String>,
    pub numero_rgf: Option<String>,
    pub concluido: Option<bool>,
    pub data_conclusao: Option<NaiveDate>,
    pub solucao_final: Option<String>,
    pub data_remessa_encarregado: Option<NaiveDate>,
    pub data_remessa_comissao: Option<NaiveDate>,
    pub data_julgamento: Option<NaiveDate>,
    pub solucao_tipo: Option<String>,
    pub penalidade_tipo: Option<String>,
    pub penalidade_dias: Option<i32>,
    pub presidente_id: Option<String>,
    pub interrogante_id: Option<String>,
    pub escrivao_processo_id: Option<String>,
    pub unidade_deprecada: Option<String>,
    pub deprecante: Option<String>,
    pub indicios_categorias: Option<Value>,
    // joined user names
    pub responsavel_nome: Option<String>,
    pub responsavel_posto: Option<String>,
    pub responsavel_matricula: Option<String>,
    pub escrivao_nome: Option<String>,
    pub presidente_nome: Option<String>,
    pub interrogante_nome: Option<String>,
    pub escrivao_processo_nome: Option<String>,
    // PDF metadata
    pub pdf_nome: Option<String>,
    pub pdf_tamanho: Option<i64>,
    // aggregated
    pub pms_envolvidos: Vec<PmEnvolvido>,
    pub prazo_ativo: Option<ActiveDeadline>,
    pub andamentos: Vec<Value>,
    pub historico_encarregados: Vec<Value>,
}

#[derive(Debug, Deserialize)]
pub struct SubstituteResponsibleRequest {
    pub id: String,
    pub novo_responsavel_id: String,
    pub justificativa: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PadsSolutionCount {
    pub solucao_tipo: Option<String>,
    pub quantidade: i64,
}

#[derive(Debug, Serialize)]
pub struct IpmEvidenceStats {
    pub crimes_cpm: i64,
    pub transgressoes_rdpm: i64,
    pub transgressoes_art29: i64,
    pub sem_indicios: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CommonCrimeItem {
    pub artigo: String,
    pub descricao: Option<String>,
    pub classificacao: String,
    pub quantidade: i64,
}

#[derive(Debug, Serialize)]
pub struct SrEvidenceStats {
    pub crimes_comuns: i64,
    pub transgressoes: i64,
    pub sem_indicios: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TopTransgressionItem {
    pub transgressao_id: String,
    pub artigo_label: String,
    pub descricao_curta: String,
    pub quantidade: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DriverRankingItem {
    pub posto_graduacao: Option<String>,
    pub matricula: Option<String>,
    pub nome: Option<String>,
    pub total_sinistros: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct NatureStatItem {
    pub natureza: String,
    pub quantidade: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MilitaryCrimeItem {
    pub artigo: String,
    pub descricao: Option<String>,
    pub quantidade: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TipoCount {
    pub tipo: Option<String>,
    pub quantidade: i64,
}

#[derive(Debug, Serialize)]
pub struct InProgressStats {
    pub por_tipo: Vec<TipoCount>,
    pub concluidos: i64,
    pub total: i64,
}

#[derive(Debug, Deserialize, Default)]
pub struct ProceedingListFilter {
    pub tipo_geral: Option<String>,
    pub tipo_detalhe: Option<String>,
    pub concluido: Option<bool>,
    pub responsavel_id: Option<String>,
    pub ano: Option<i32>,
    pub search: Option<String>,
    pub offset: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ProceedingListResult {
    pub items: Vec<ProceedingListItem>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProceedingRequest {
    pub id: String,
    pub numero: String,
    pub tipo_geral: String,
    pub tipo_detalhe: String,
    pub documento_iniciador: String,
    pub processo_sei: Option<String>,
    pub responsavel_id: Option<String>,
    pub local_origem: Option<String>,
    pub local_fatos: String,
    pub data_instauracao: Option<NaiveDate>,
    pub data_recebimento: Option<NaiveDate>,
    pub escrivao_id: Option<String>,
    pub nome_vitima: Option<String>,
    pub natureza_processo: Option<String>,
    pub resumo_fatos: Option<String>,
    pub numero_portaria: Option<String>,
    pub numero_memorando: Option<String>,
    pub numero_feito: Option<String>,
    pub numero_rgf: Option<String>,
    pub concluido: Option<bool>,
    pub data_conclusao: Option<NaiveDate>,
    pub solucao_final: Option<String>,
    pub data_remessa_encarregado: Option<NaiveDate>,
    pub data_remessa_comissao: Option<NaiveDate>,
    pub data_julgamento: Option<NaiveDate>,
    pub solucao_tipo: Option<String>,
    pub penalidade_tipo: Option<String>,
    pub penalidade_dias: Option<i32>,
    pub presidente_id: Option<String>,
    pub interrogante_id: Option<String>,
    pub escrivao_processo_id: Option<String>,
    pub unidade_deprecada: Option<String>,
    pub deprecante: Option<String>,
    pub pms_envolvidos: Option<Vec<String>>,
}

impl UpdateProceedingRequest {
    pub fn validate(&self) -> Result<(), String> {
        if self.tipo_detalhe == "IPPM" {
            return Err("Tipo IPPM nao e permitido neste sistema".to_string());
        }
        let today = chrono::Local::now().date_naive();
        if let Some(d) = self.data_instauracao {
            if d > today {
                return Err("Data de instauracao nao pode ser futura".to_string());
            }
        }
        if let Some(d) = self.data_conclusao {
            if d > today {
                return Err("Data de conclusao nao pode ser futura".to_string());
            }
        }
        if self.local_fatos.trim().is_empty() {
            return Err("Local dos fatos e obrigatorio".to_string());
        }
        const DOCS_VALIDOS: &[&str] = &["Portaria", "Memorando Disciplinar", "Feito Preliminar"];
        if !DOCS_VALIDOS.contains(&self.documento_iniciador.as_str()) {
            return Err(format!(
                "Documento iniciador invalido. Permitidos: {}",
                DOCS_VALIDOS.join(", ")
            ));
        }
        if let Some(dias) = self.penalidade_dias {
            if dias > 0 {
                match self.penalidade_tipo.as_deref() {
                    Some("Prisao") | Some("Detencao") => {}
                    _ => {
                        return Err(
                            "penalidade_dias somente permitido para Prisao ou Detencao"
                                .to_string(),
                        )
                    }
                }
            }
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
pub struct UploadPdfRequest {
    pub processo_id: String,
    pub nome_arquivo: String,
    pub conteudo_base64: String,
    pub content_type: String,
}

impl UploadPdfRequest {
    const MAX_PDF_BYTES: usize = 100 * 1024 * 1024;

    pub fn decode_and_validate(&self) -> Result<Vec<u8>, String> {
        use base64::Engine as _;
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&self.conteudo_base64)
            .map_err(|_| "Base64 invalido".to_string())?;
        if bytes.len() > Self::MAX_PDF_BYTES {
            return Err(format!(
                "PDF excede o limite de 100 MB ({} MB recebidos)",
                bytes.len() / 1024 / 1024
            ));
        }
        Ok(bytes)
    }
}

#[derive(Debug, Serialize)]
pub struct PdfMetadata {
    pub nome: Option<String>,
    pub content_type: Option<String>,
    pub tamanho: Option<i64>,
    pub upload_em: Option<String>,
    pub conteudo: Option<String>,
}
