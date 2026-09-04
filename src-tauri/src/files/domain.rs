use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Pedido para entregar ao usuário um arquivo montado pela aplicação.
///
/// O conteúdo trafega em base64 porque nem todo arquivo é texto e o IPC precisa
/// transportar anexos e planilhas pela mesma convenção.
#[derive(Debug, Deserialize)]
pub struct SaveFileRequest {
    /// Nome oferecido no diálogo. A extensão daqui vira o filtro do seletor.
    pub nome_sugerido: String,
    pub conteudo_base64: String,
}

/// Arquivo montado no backend e pronto para seguir pelo diálogo nativo.
#[derive(Debug, Serialize)]
pub struct GeneratedFile {
    pub nome_arquivo: String,
    pub conteudo_base64: String,
}

/// Descrição declarativa de uma pasta de trabalho XLSX.
///
/// As telas dizem quais dados existem e qual é o seu significado; o backend
/// concentra o formato físico, a paleta e as proteções contra planilha mal
/// formada. Assim as seis exportações não criam seis convenções visuais.
#[derive(Debug, Deserialize)]
pub struct SpreadsheetRequest {
    pub nome_sugerido: String,
    pub abas: Vec<SpreadsheetSheet>,
}

#[derive(Debug, Deserialize)]
pub struct SpreadsheetSheet {
    pub nome: String,
    pub titulo: String,
    #[serde(default)]
    pub metadados: Vec<SpreadsheetMetadata>,
    pub colunas: Vec<SpreadsheetColumn>,
    pub linhas: Vec<SpreadsheetRow>,
    #[serde(default)]
    pub congelar_colunas: u16,
}

#[derive(Debug, Deserialize)]
pub struct SpreadsheetMetadata {
    pub rotulo: String,
    pub valor: String,
}

#[derive(Debug, Deserialize)]
pub struct SpreadsheetColumn {
    pub rotulo: String,
    #[serde(default)]
    pub tipo: SpreadsheetColumnType,
    pub largura: f64,
    #[serde(default)]
    pub alinhamento: SpreadsheetAlignment,
    pub tom: Option<SpreadsheetTone>,
}

#[derive(Debug, Deserialize)]
pub struct SpreadsheetRow {
    pub celulas: Vec<Value>,
    pub tom: Option<SpreadsheetTone>,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpreadsheetColumnType {
    #[default]
    Texto,
    Inteiro,
    Data,
    DataHora,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpreadsheetAlignment {
    #[default]
    Esquerda,
    Centro,
    Direita,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpreadsheetTone {
    Informacao,
    Sucesso,
    Atencao,
    Perigo,
    Inativo,
}
