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
use crate::files::domain::{GeneratedFile, SaveFileRequest, SpreadsheetRequest};
use crate::files::spreadsheet;
use crate::response::{from_result, ApiResponse};

/// Monta uma pasta de trabalho XLSX em memória.
///
/// A gravação continua separada em `files_save_download`: assim este comando
/// é testável sem abrir diálogo e todos os arquivos mantêm uma única via de
/// escolha do destino.
#[tauri::command]
pub async fn files_generate_spreadsheet(
    state: State<'_, AppState>,
    request: SpreadsheetRequest,
) -> Result<ApiResponse<GeneratedFile>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            let nome_arquivo = spreadsheet::nome_xlsx(&request.nome_sugerido)?;
            let bytes = spreadsheet::gerar(&request)?;
            Ok(GeneratedFile {
                nome_arquivo,
                conteudo_base64: base64::engine::general_purpose::STANDARD.encode(bytes),
            })
        }
        .await,
    )
    .await)
}

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
                .map_err(|erro| AppError::Interno(format!("base64 invalido: {erro}")))?;

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
                .map_err(|erro| AppError::Arquivo(format!("caminho invalido: {erro}")))?;
            std::fs::write(&caminho, &bytes)
                .map_err(|erro| AppError::Arquivo(format!("{}: {erro}", caminho.display())))?;

            Ok(Some(caminho.to_string_lossy().into_owned()))
        }
        .await,
    )
    .await)
}
