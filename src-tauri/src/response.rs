use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T>
where
    T: Serialize,
{
    pub ok: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiResponse<T>
where
    T: Serialize,
{
    pub fn ok(data: T) -> Self {
        Self {
            ok: true,
            data: Some(data),
            error: None,
        }
    }

    /// O detalhe técnico fica no console do backend; para a tela vai só a
    /// mensagem em português. É esta separação que permite escrever mensagens
    /// úteis sem perder o que se precisa para diagnosticar.
    pub fn err(error: AppError) -> Self {
        if let Some(detalhe) = error.detalhe_tecnico() {
            eprintln!("[adm-p6] {detalhe}");
        }
        Self {
            ok: false,
            data: None,
            error: Some(error.message()),
        }
    }
}

pub async fn from_result<T>(result: Result<T, AppError>) -> ApiResponse<T>
where
    T: Serialize,
{
    match result {
        Ok(data) => ApiResponse::ok(data),
        Err(error) => ApiResponse::err(error),
    }
}
