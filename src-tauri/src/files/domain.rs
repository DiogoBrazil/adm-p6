use serde::Deserialize;

/// Pedido para entregar ao usuário um arquivo montado pela aplicação.
///
/// O conteúdo trafega em base64 porque nem todo relatório é texto — e porque é
/// o mesmo formato em que `CsvExport.conteudo` já chega do backend, evitando
/// uma segunda convenção.
#[derive(Debug, Deserialize)]
pub struct SaveFileRequest {
    /// Nome oferecido no diálogo. A extensão daqui vira o filtro do seletor.
    pub nome_sugerido: String,
    pub conteudo_base64: String,
}
