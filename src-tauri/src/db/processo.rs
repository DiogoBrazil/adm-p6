//! Regras de estado compartilhadas pelas operações de um processo.

use chrono::NaiveDate;
use sqlx::{Postgres, Transaction};

use crate::error::AppError;

/// Trava o processo e garante que ele ainda aceita novos fatos operacionais.
///
/// A checagem fica no backend porque o IPC pode ser chamado sem passar pela
/// tela. O `FOR UPDATE` também serializa esta decisão com a conclusão/reabertura:
/// não existe intervalo em que uma janela conclui enquanto outra ainda insere.
pub async fn exigir_em_andamento(
    tx: &mut Transaction<'_, Postgres>,
    processo_id: &str,
    acao: &str,
) -> Result<(), AppError> {
    let conclusao: Option<Option<NaiveDate>> = sqlx::query_scalar(
        "SELECT data_conclusao
           FROM processos_procedimentos
          WHERE id = $1::uuid AND ativo
          FOR UPDATE",
    )
    .bind(processo_id)
    .fetch_optional(&mut **tx)
    .await?;

    match conclusao {
        None => Err(AppError::Domain("processo não encontrado".to_string())),
        Some(Some(_)) => Err(AppError::Domain(format!(
            "Este processo ou procedimento está concluído. Não é permitido {acao}. Reabra-o para continuar."
        ))),
        Some(None) => Ok(()),
    }
}
