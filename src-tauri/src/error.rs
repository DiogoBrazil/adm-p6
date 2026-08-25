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
        match self {
            Self::Database(error) => mensagem_banco(error),
            Self::Domain(message) => message.clone(),
            _ => self.to_string(),
        }
    }

    pub fn is_database(&self) -> bool {
        matches!(self, Self::Database(_))
    }
}

/// Texto seguro para atravessar o IPC. O erro completo continua disponível no
/// backend para diagnóstico, mas SQL, nomes de constraints desconhecidas e
/// detalhes do PostgreSQL nunca devem aparecer para o usuário.
fn mensagem_banco(error: &sqlx::Error) -> String {
    let constraint = match error {
        sqlx::Error::Database(database_error) => database_error.constraint(),
        _ => None,
    };

    match constraint {
        Some("uq_processo_numero_documento") =>
            "Já existe um processo ou procedimento ativo com este número de documento para a mesma unidade, ano, apuratório e documento iniciador.".to_string(),
        Some("uq_processo_numero_controle") =>
            "Já existe um processo ou procedimento ativo com este número de controle para a mesma unidade, ano e apuratório.".to_string(),
        _ => "Não foi possível concluir a operação no banco de dados. Tente novamente e, se o problema persistir, procure o suporte.".to_string(),
    }
}
