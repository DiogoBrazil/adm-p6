//! Entrega de arquivo ao usuário.
//!
//! POR QUE ISTO É UM COMANDO, E NÃO UM `<a download>` NO FRONTEND
//!
//! O caminho do navegador — âncora com `download` apontando para um blob — não
//! tem destino definido no WebView do Tauri: não abre "salvar como", não deixa
//! o usuário escolher a pasta, e o comportamento varia por plataforma (no
//! Linux quem decide é o WebKitGTK). O caminho suportado no Tauri v2 é o
//! diálogo nativo.
//!
//! O diálogo é aberto **aqui**, no Rust, e a escrita acontece aqui também.
//! A alternativa seria o frontend pedir o caminho e depois mandar gravá-lo,
//! mas isso daria à camada de tela uma primitiva de "escreva este conteúdo
//! neste caminho" — poder que nenhuma tela precisa ter.

use base64::Engine;
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_dialog::DialogExt;

use crate::app_state::AppState;
use crate::auth::guards::require_session;
use crate::error::AppError;
use crate::files::domain::SaveFileRequest;
use crate::response::{from_result, ApiResponse};

/// Grava um arquivo escolhido pelo usuário. Devolve o caminho gravado, ou
/// `None` se o diálogo foi cancelado — cancelar não é erro.
#[tauri::command]
pub async fn files_save_download<R: Runtime>(
    // Genérico no runtime para que o teste de integração possa montar o
    // comando sobre o `MockRuntime`. `AppHandle` sem parâmetro é `AppHandle<Wry>`.
    app: AppHandle<R>,
    state: State<'_, AppState>,
    request: SaveFileRequest,
) -> Result<ApiResponse<Option<String>>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;

            let bytes = base64::engine::general_purpose::STANDARD
                .decode(request.conteudo_base64.as_bytes())
                .map_err(|_| AppError::Domain("conteudo do arquivo invalido".into()))?;

            let extensao = request
                .nome_sugerido
                .rsplit_once('.')
                .map(|(_, ext)| ext.to_string());

            let mut dialogo = app.dialog().file().set_file_name(&request.nome_sugerido);
            if let Some(ext) = &extensao {
                dialogo = dialogo.add_filter(ext.to_uppercase(), &[ext.as_str()]);
            }

            // `save_file` é assíncrono por callback; o canal devolve a escolha
            // sem bloquear a thread do runtime.
            let (envia, recebe) = tokio::sync::oneshot::channel();
            dialogo.save_file(move |escolhido| {
                let _ = envia.send(escolhido);
            });
            let Ok(Some(destino)) = recebe.await else {
                return Ok(None); // cancelado
            };

            let caminho = destino
                .into_path()
                .map_err(|e| AppError::Domain(format!("caminho invalido: {e}")))?;
            std::fs::write(&caminho, &bytes)
                .map_err(|e| AppError::Domain(format!("falha ao gravar o arquivo: {e}")))?;

            Ok(Some(caminho.to_string_lossy().into_owned()))
        }
        .await,
    )
    .await)
}
