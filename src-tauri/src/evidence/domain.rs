use serde::{Deserialize, Serialize};

/// Categoria de indício vinculada ao envolvido. `indica_ausencia` vem do catálogo
/// e é o que permite validar a exclusividade de "Não houve indícios" sem que o
/// código precise conhecer o nome da opção.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct CategoriaIndicioItem {
    pub id: String,
    pub nome: String,
    pub indica_ausencia: bool,
}

/// Artigo penal com o rótulo já montado a partir do dado — dispositivo legal,
/// artigo, parágrafo, inciso e alínea. Substitui os `format!` que traziam o nome
/// da lei escrito no código.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InfracaoPenalItem {
    pub id: String,
    pub dispositivo_legal: String,
    pub especie: String,
    pub artigo: String,
    pub descricao: String,
    pub rotulo: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct TransgressaoItem {
    pub id: String,
    pub artigo: String,
    pub natureza: String,
    pub inciso: String,
    pub texto: String,
    pub rotulo: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InfracaoEstatutoItem {
    pub id: String,
    pub dispositivo_legal: String,
    pub artigo: String,
    pub inciso: String,
    pub texto: String,
    pub rotulo: String,
}

/// Enquadramento penal do envolvido. A esfera (militar/comum) é do VÍNCULO: pelo
/// art. 9º do CPM a mesma conduta pode ser crime militar ou comum conforme as
/// circunstâncias do fato, então não pode morar no catálogo do artigo.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InfracaoPenalVinculo {
    pub infracao_penal_id: String,
    pub esfera_penal_id: String,
    pub esfera_penal: String,
    pub dispositivo_legal: String,
    pub especie: String,
    pub artigo: String,
    pub descricao: String,
    pub rotulo: String,
}

/// Infração estatutária com a transgressão do RDPM usada por analogia —
/// obrigatória, garantida por NOT NULL no banco.
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct InfracaoEstatutoVinculo {
    pub infracao_estatuto_id: String,
    pub rotulo: String,
    pub analogia_transgressao_id: String,
    pub analogia_rotulo: String,
}

#[derive(Debug, Deserialize)]
pub struct SelecaoInfracaoPenal {
    pub infracao_penal_id: String,
    pub esfera_penal_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SelecaoInfracaoEstatuto {
    pub infracao_estatuto_id: String,
    pub analogia_transgressao_id: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveEvidenceRequest {
    pub envolvido_id: String,
    pub categorias_ids: Vec<String>,
    pub infracoes_penais: Vec<SelecaoInfracaoPenal>,
    pub transgressoes_ids: Vec<String>,
    pub infracoes_estatuto: Vec<SelecaoInfracaoEstatuto>,
}

#[derive(Debug, Serialize)]
pub struct EvidenceData {
    pub envolvido_id: String,
    pub categorias: Vec<CategoriaIndicioItem>,
    pub infracoes_penais: Vec<InfracaoPenalVinculo>,
    pub transgressoes: Vec<TransgressaoItem>,
    pub infracoes_estatuto: Vec<InfracaoEstatutoVinculo>,
}

impl EvidenceData {
    pub fn empty(envolvido_id: &str) -> Self {
        Self {
            envolvido_id: envolvido_id.to_string(),
            categorias: vec![],
            infracoes_penais: vec![],
            transgressoes: vec![],
            infracoes_estatuto: vec![],
        }
    }
}

/// Envolvido do processo com o respectivo enquadramento, para o painel de indícios.
#[derive(Debug, Serialize)]
pub struct EnvolvidoComIndicios {
    pub envolvido_id: String,
    pub policial_militar_id: String,
    pub nome: String,
    pub matricula: String,
    pub posto_graduacao: String,
    pub status_envolvido: String,
    pub ordem: i32,
    pub indicios: EvidenceData,
}
