use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Banco de dados indisponivel: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Credenciais invalidas.")]
    InvalidCredentials,
    #[error("Sessao expirada ou inexistente.")]
    Unauthorized,
    #[error("Seu perfil e somente leitura.")]
    Forbidden,
    #[error("Regra de negocio violada: {0}")]
    Domain(String),
}

impl AppError {
    pub fn message(&self) -> String {
        self.to_string()
    }
}
