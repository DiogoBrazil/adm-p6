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

    pub fn err(error: AppError) -> Self {
        if error.is_database() {
            eprintln!("Erro interno de banco de dados: {error:?}");
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
