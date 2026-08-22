use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

/// Único código técnico do sistema. Identifica que um apuratório usa a tabela de
/// extensão `carta_precatoria_detalhes`. Vive em `apuratorios.codigo_extensao`,
/// separado de `sigla` e `nome`, que o administrador renomeia à vontade.
pub const EXTENSAO_CARTA_PRECATORIA: &str = "carta_precatoria";

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ProceedingListItem {
    pub id: String,
    pub apuratorio_id: String,
    pub apuratorio_sigla: String,
    pub apuratorio_nome: String,
    pub tipo_apuratorio: String,
    pub documento_iniciador: String,
    pub numero_documento: String,
    /// Número de controle efetivo: o informado ou, quando ausente, o do documento.
    pub numero_controle: String,
    /// Rótulo montado a partir do dado, no formato usado pela Seção:
    /// `SIGLA nº CONTROLE/UNIDADE/ANO`.
    pub rotulo: String,
    pub unidade_origem: String,
    pub municipio_fato: String,
    pub natureza_fato: Option<String>,
    pub data_instauracao: NaiveDate,
    pub data_recebimento: Option<NaiveDate>,
    pub data_conclusao: Option<NaiveDate>,
    /// Derivado de `data_conclusao IS NOT NULL` — não existe coluna booleana.
    pub concluido: bool,
    pub resumo_fatos: Option<String>,
    /// Quem ocupa, neste apuratório, o papel configurado como responsável.
    pub responsavel_nome: Option<String>,
    pub responsavel_papel: Option<String>,
    pub total_envolvidos: i64,
    pub prazo_vencimento: Option<NaiveDate>,
    pub prazo_dias_restantes: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct EnvolvidoItem {
    pub id: String,
    pub policial_militar_id: String,
    pub nome: String,
    pub matricula: String,
    pub posto_graduacao: String,
    pub status_envolvido_id: String,
    pub status_envolvido: String,
    pub ordem: i32,
    pub e_condutor: bool,
    pub solucao_sugerida_id: Option<String>,
    pub solucao_sugerida: Option<String>,
    pub solucao_decidida_id: Option<String>,
    pub solucao_decidida: Option<String>,
    pub penalidade_tipo_id: Option<String>,
    pub penalidade_tipo: Option<String>,
    pub penalidade_dias: Option<i32>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct DesignacaoItem {
    pub id: String,
    pub papel_id: String,
    pub papel: String,
    pub e_responsavel: bool,
    pub policial_militar_id: String,
    pub nome: String,
    pub posto_graduacao: String,
    pub data_inicio: NaiveDate,
    /// Exclusiva: é o dia em que o sucessor assume. Nula = designação vigente.
    pub data_fim: Option<NaiveDate>,
    pub documento_autorizador: Option<String>,
    pub numero_documento: Option<String>,
    pub motivo: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct PessoaItem {
    pub id: String,
    pub papel_pessoa_id: String,
    pub papel_pessoa: String,
    pub nome: String,
    pub ordem: i32,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AnexoItem {
    pub id: String,
    pub nome_arquivo: String,
    pub mime_type: String,
    pub tamanho_bytes: i64,
    pub enviado_por: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CartaPrecatoriaDetalhes {
    pub deprecante: String,
    pub unidade_deprecada_id: String,
    pub unidade_deprecada: String,
}

#[derive(Debug, Serialize)]
pub struct ProceedingDetail {
    #[serde(flatten)]
    pub cabecalho: ProceedingListItem,
    pub processo_sei: Option<String>,
    pub numero_rgf: Option<String>,
    pub data_remessa_encarregado: Option<NaiveDate>,
    pub data_remessa_comissao: Option<NaiveDate>,
    pub data_julgamento: Option<NaiveDate>,
    pub envolvidos: Vec<EnvolvidoItem>,
    pub designacoes: Vec<DesignacaoItem>,
    pub pessoas: Vec<PessoaItem>,
    pub anexos: Vec<AnexoItem>,
    pub carta_precatoria: Option<CartaPrecatoriaDetalhes>,
}

// ── Escrita ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct EnvolvidoRequest {
    pub policial_militar_id: String,
    pub status_envolvido_id: String,
    pub ordem: i32,
    #[serde(default)]
    pub e_condutor: bool,
    pub solucao_sugerida_id: Option<String>,
    pub solucao_decidida_id: Option<String>,
    pub penalidade_tipo_id: Option<String>,
    pub penalidade_dias: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct DesignacaoRequest {
    pub policial_militar_id: String,
    pub papel_id: String,
    pub data_inicio: NaiveDate,
    pub documento_autorizador_id: Option<String>,
    pub numero_documento: Option<String>,
    pub motivo: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PessoaRequest {
    pub papel_pessoa_id: String,
    pub nome: String,
    pub ordem: i32,
}

#[derive(Debug, Deserialize)]
pub struct CartaPrecatoriaRequest {
    pub deprecante: String,
    pub unidade_deprecada_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SubstituirDesignacaoRequest {
    pub processo_id: String,
    pub papel_id: String,
    pub sucessor_id: String,
    /// Dia em que o sucessor assume. É também o fim (exclusivo) da designação
    /// anterior, então não há sobreposição nem lacuna.
    pub data_troca: NaiveDate,
    pub motivo: Option<String>,
    pub documento_autorizador_id: Option<String>,
    pub numero_documento: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveProceedingRequest {
    pub id: Option<String>,
    pub apuratorio_id: String,
    pub documento_iniciador_id: String,
    pub numero_documento: String,
    /// Ausente = igual ao número do documento. É assim que o índice único trata.
    pub numero_controle: Option<String>,
    pub processo_sei: Option<String>,
    pub numero_rgf: Option<String>,
    pub unidade_origem_id: String,
    pub municipio_fato_id: String,
    pub natureza_fato_id: Option<String>,
    pub data_instauracao: NaiveDate,
    pub data_recebimento: Option<NaiveDate>,
    pub data_remessa_encarregado: Option<NaiveDate>,
    pub data_remessa_comissao: Option<NaiveDate>,
    pub data_julgamento: Option<NaiveDate>,
    pub data_conclusao: Option<NaiveDate>,
    pub resumo_fatos: Option<String>,
    #[serde(default)]
    pub envolvidos: Vec<EnvolvidoRequest>,
    #[serde(default)]
    pub designacoes: Vec<DesignacaoRequest>,
    #[serde(default)]
    pub pessoas: Vec<PessoaRequest>,
    pub carta_precatoria: Option<CartaPrecatoriaRequest>,
}

impl SaveProceedingRequest {
    /// Validações que não dependem do banco. As que dependem de configuração
    /// (natureza obrigatória, condutor exigido, solução que permite penalidade,
    /// penalidade que usa dias) ficam no repositório, que lê os atributos
    /// semânticos dos catálogos.
    pub fn validate(&self) -> Result<(), String> {
        let hoje = Utc::now().date_naive();
        if self.numero_documento.trim().is_empty() {
            return Err("numero do documento e obrigatorio".to_string());
        }
        if self.data_instauracao > hoje {
            return Err("data de instauracao nao pode ser futura".to_string());
        }
        if self.data_conclusao.is_some_and(|d| d > hoje) {
            return Err("data de conclusao nao pode ser futura".to_string());
        }
        if self.data_recebimento.is_some_and(|d| d > hoje) {
            return Err("data de recebimento nao pode ser futura".to_string());
        }

        let mut ordens: Vec<i32> = self.envolvidos.iter().map(|e| e.ordem).collect();
        ordens.sort_unstable();
        ordens.dedup();
        if ordens.len() != self.envolvidos.len() {
            return Err("a ordem dos envolvidos nao pode se repetir".to_string());
        }
        if self.envolvidos.iter().filter(|e| e.e_condutor).count() > 1 {
            return Err("so pode haver um condutor por processo".to_string());
        }
        for pessoa in &self.pessoas {
            if pessoa.nome.trim().is_empty() {
                return Err("nome de pessoa nao pode ficar em branco".to_string());
            }
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, Default)]
pub struct ProceedingFilter {
    pub busca: Option<String>,
    /// Espécies a incluir. Vazio = todas. Substitui os `IN (...)` de sigla.
    pub apuratorio_ids: Option<Vec<String>>,
    pub tipo_apuratorio_id: Option<String>,
    pub unidade_origem_id: Option<String>,
    pub natureza_fato_id: Option<String>,
    pub responsavel_id: Option<String>,
    pub ano: Option<i32>,
    pub concluido: Option<bool>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct ProceedingListResult {
    pub items: Vec<ProceedingListItem>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct UploadAttachmentRequest {
    pub processo_id: String,
    pub nome_arquivo: String,
    pub mime_type: String,
    /// Conteúdo em base64.
    pub conteudo: String,
}

#[derive(Debug, Serialize)]
pub struct AttachmentContent {
    pub nome_arquivo: String,
    pub mime_type: String,
    pub conteudo: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ContagemRotulada {
    pub id: String,
    pub rotulo: String,
    pub total: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub total: i64,
    pub em_andamento: i64,
    pub concluidos: i64,
    pub prazos_vencidos: i64,
    pub por_apuratorio: Vec<ContagemRotulada>,
    pub por_natureza: Vec<ContagemRotulada>,
    pub por_unidade: Vec<ContagemRotulada>,
    pub por_ano: Vec<ContagemRotulada>,
}
