use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditDetailItem {
    pub id: String,
    pub entidade: String,
    pub registro_id: String,
    pub operacao: String,
    pub usuario_id: Option<String>,
    pub usuario_nome: Option<String>,
    pub usuario_posto: Option<String>,
    pub usuario_matricula: Option<String>,
    /// O que foi feito, em português: "Reabriu o apuratório". `None` só nos
    /// registros anteriores à `0018`, que a tela cobre com uma frase genérica.
    pub acao: Option<String>,
    /// Sobre o quê, como o registro se chamava no momento da ação. `None`
    /// quando a linha já tinha sido apagada antes da `0018` poder nomeá-la.
    pub assunto: Option<String>,
    /// Diff da operação, quando registrado. Preenchido nas alterações de
    /// configuração, que mudam o comportamento futuro do sistema.
    pub alteracoes: Option<Value>,
    pub ocorrido_em: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditOperationStat {
    pub operacao: String,
    pub total: i64,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AuditTableStat {
    pub entidade: String,
    pub total: i64,
    /// O mesmo em português, para o filtro da tela. Preenchido depois da
    /// consulta por `rotulo_da_entidade`; não sai do banco.
    #[sqlx(default)]
    pub rotulo: String,
}

/// Nome de tabela traduzido para quem opera a Seção.
///
/// Os 26 catálogos administráveis já se apresentam em `CATALOGOS.rotulo` — não
/// há por que manter uma segunda lista que envelheceria sozinha quando alguém
/// acrescentasse um catálogo. O que sobra aqui são as tabelas que não são
/// catálogo, e o fallback devolve o nome cru: entidade desconhecida é melhor
/// mostrada feia do que escondida.
pub fn rotulo_da_entidade(entidade: &str) -> String {
    let fixo = match entidade {
        "processos_procedimentos" => "Apuratório",
        "processo_envolvidos" => "Envolvido",
        "processo_designacoes" => "Designação",
        "processo_prazos" => "Prazo",
        "processo_andamentos" => "Andamento",
        "processo_anexos" => "Anexo",
        "policiais_militares" => "Militar",
        "mapas_salvos" => "Mapa salvo",
        "apuratorio_papeis" => "Função do apuratório",
        "apuratorio_documentos_iniciadores" => "Documento iniciador do apuratório",
        _ => "",
    };
    if !fixo.is_empty() {
        return fixo.to_string();
    }
    crate::legal_catalogs::domain::CATALOGOS
        .iter()
        .find(|c| c.tabela == entidade)
        .map(|c| c.rotulo.to_string())
        .unwrap_or_else(|| entidade.to_string())
}

/// A operação em português, para quem não lê SQL. Só serve de reserva: a partir
/// da `0018` quem descreve a ação é `auditoria.acao`, escrita pelo comando.
pub fn rotulo_da_operacao(operacao: &str) -> &'static str {
    match operacao {
        "CREATE" => "Cadastrou",
        "UPDATE" => "Alterou",
        "DELETE" => "Excluiu",
        _ => "Registrou",
    }
}

#[derive(Debug, Serialize)]
pub struct AuditStatistics {
    pub total: i64,
    pub por_operacao: Vec<AuditOperationStat>,
    pub por_entidade: Vec<AuditTableStat>,
}

/// Envelope das listagens paginadas de auditoria.
///
/// `page` e `per_page` voltam junto porque o backend os corrige: pedir a página
/// 0 ou 3.000 por página não é erro, é pedido ajustado — e a tela precisa saber
/// o que de fato foi servido para desenhar o controle de página. É o mesmo
/// contrato de `UserListResult` e `ProceedingListResult`.
#[derive(Debug, Serialize)]
pub struct AuditPageResult {
    pub items: Vec<AuditDetailItem>,
    /// Total do **escopo filtrado**, não da página.
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize, Default)]
pub struct AuditStatisticsFilter {
    pub data_inicio: Option<NaiveDate>,
    pub data_fim: Option<NaiveDate>,
}
