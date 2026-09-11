//! Os comandos do aviso por e-mail.
//!
//! Dois caminhos, uma montagem só: a prévia e o envio chamam `montar` e
//! recebem o MESMO `AvisoMontado`. É isso que garante que o texto aprovado na
//! tela é o texto que sai — se fossem duas montagens, uma poderia mudar sem a
//! outra e ninguém veria.

use serde::Deserialize;
use tauri::State;

use crate::app_state::AppState;
use crate::auth::guards::{require_admin, require_session};
use crate::email::domain::{aplicar_marcadores, AvisoMontado, TipoAviso};
use crate::email::repository;
use crate::email::transporte::{EnviaEmail, Smtp};
use crate::error::AppError;
use crate::response::{from_result, ApiResponse};
use sqlx::PgPool;

/// Junta destinatário, dados e texto — as três leituras que podem faltar.
async fn montar(
    pool: &PgPool,
    processo_id: &str,
    tipo: TipoAviso,
) -> Result<AvisoMontado, AppError> {
    let destinatario = repository::destinatario(pool, processo_id).await?;
    let dados = repository::dados_do_aviso(pool, processo_id, &destinatario.nome).await?;
    let mensagem = repository::mensagem(pool, tipo).await?;
    Ok(AvisoMontado {
        destinatario: destinatario.email,
        destinatario_nome: destinatario.nome,
        assunto: aplicar_marcadores(&mensagem.assunto, &dados),
        corpo: aplicar_marcadores(&mensagem.corpo, &dados),
    })
}

/// O texto final, para a tela mostrar antes de qualquer envio.
///
/// Não toca no servidor de e-mail: quem só quer conferir o texto não deve
/// depender de o SMTP estar configurado nem de a rede estar de pé.
#[tauri::command]
pub async fn email_preview(
    state: State<'_, AppState>,
    processo_id: String,
    tipo: TipoAviso,
) -> Result<ApiResponse<AvisoMontado>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let pool = state.pool().await?;
            montar(&pool, &processo_id, tipo).await
        }
        .await,
    )
    .await)
}

#[tauri::command]
pub async fn email_send(
    state: State<'_, AppState>,
    processo_id: String,
    tipo: TipoAviso,
) -> Result<ApiResponse<AvisoMontado>, String> {
    Ok(from_result(
        async {
            // `require_admin` e não `require_session`: mandar e-mail em nome da
            // Seção para um militar é ato externo, e perfil somente leitura não
            // o pratica.
            require_admin(&state).await?;
            let pool = state.pool().await?;
            let aviso = montar(&pool, &processo_id, tipo).await?;
            let config = repository::configuracao(&pool).await?;
            Smtp.enviar(&config, &aviso).await?;
            Ok(aviso)
        }
        .await,
    )
    .await)
}

/// O que a tela de configuração pode mostrar. **Sem a senha** — ela entra, é
/// gravada, e não volta; mesma regra do `database_config.rs`, e pela mesma
/// razão: o que não trafega não vaza.
#[derive(serde::Serialize, sqlx::FromRow)]
pub struct ConfiguracaoVisivel {
    pub host: String,
    pub porta: i32,
    pub usuario: String,
    pub remetente: String,
    pub ativo: bool,
    /// Se já existe senha gravada. A tela usa isto para dizer "em branco mantém
    /// a senha atual" em vez de fingir que o campo está vazio porque não há
    /// senha nenhuma.
    pub tem_senha: bool,
}

#[tauri::command]
pub async fn email_config_get(
    state: State<'_, AppState>,
) -> Result<ApiResponse<Option<ConfiguracaoVisivel>>, String> {
    Ok(from_result(
        async {
            require_admin(&state).await?;
            let pool = state.pool().await?;
            Ok(sqlx::query_as::<_, ConfiguracaoVisivel>(
                "SELECT host, porta, usuario, remetente, ativo,
                        btrim(senha) <> '' AS tem_senha
                   FROM configuracao_email WHERE id = 1",
            )
            .fetch_optional(&pool)
            .await?)
        }
        .await,
    )
    .await)
}

#[derive(Deserialize)]
pub struct SaveEmailConfigRequest {
    pub host: String,
    pub porta: i32,
    pub usuario: String,
    /// Vazia mantém a senha já gravada — é o que permite corrigir a porta sem
    /// redigitar a senha de aplicativo de 16 caracteres.
    pub senha: String,
    pub remetente: String,
    pub ativo: bool,
}

#[tauri::command]
pub async fn email_config_save(
    state: State<'_, AppState>,
    request: SaveEmailConfigRequest,
) -> Result<ApiResponse<()>, String> {
    Ok(from_result(
        async {
            require_admin(&state).await?;
            if request.senha.trim().is_empty() {
                // Só faz sentido manter o que existe; sem linha anterior não há
                // o que manter, e a frase diz isso em vez de deixar o `CHECK`
                // do banco responder por uma regra que a tela conhece.
                let pool = state.pool().await?;
                let existe: bool = sqlx::query_scalar(
                    "SELECT EXISTS (SELECT 1 FROM configuracao_email WHERE id = 1)",
                )
                .fetch_one(&pool)
                .await?;
                if !existe {
                    return Err(AppError::Domain(
                        "Informe a senha de aplicativo do e-mail para salvar a configuração \
                         pela primeira vez."
                            .into(),
                    ));
                }
                sqlx::query(
                    "UPDATE configuracao_email
                        SET host = $1, porta = $2, usuario = $3, remetente = $4,
                            ativo = $5, updated_at = now()
                      WHERE id = 1",
                )
                .bind(request.host.trim())
                .bind(request.porta)
                .bind(request.usuario.trim())
                .bind(request.remetente.trim())
                .bind(request.ativo)
                .execute(&pool)
                .await?;
                return Ok(());
            }

            let pool = state.pool().await?;
            sqlx::query(
                "INSERT INTO configuracao_email (id, host, porta, usuario, senha, remetente, ativo)
                      VALUES (1, $1, $2, $3, $4, $5, $6)
                 ON CONFLICT (id) DO UPDATE
                    SET host = EXCLUDED.host, porta = EXCLUDED.porta,
                        usuario = EXCLUDED.usuario, senha = EXCLUDED.senha,
                        remetente = EXCLUDED.remetente, ativo = EXCLUDED.ativo,
                        updated_at = now()",
            )
            .bind(request.host.trim())
            .bind(request.porta)
            .bind(request.usuario.trim())
            .bind(request.senha.trim())
            .bind(request.remetente.trim())
            .bind(request.ativo)
            .execute(&pool)
            .await?;
            Ok(())
        }
        .await,
    )
    .await)
}
