//! Impressão dos documentos em A4 com page setup nativo.
//!
//! POR QUE ISTO É UM COMANDO, E NÃO `window.print()` COM `@page`
//!
//! O motor do Tauri no Linux é o WebKitGTK, e ele **ignora o descritor `size`
//! do `@page`**. Foi medido, no mesmo `webkit2gtk-4.1` 2.48 que a aplicação
//! carrega, imprimindo o mesmo HTML de três formas:
//!
//! | CSS                                  | folha do PDF        |
//! |--------------------------------------|---------------------|
//! | `@page nome { size: A4 landscape }`  | 595×842 pt, retrato |
//! | `@page { size: A4 landscape }`       | 595×842 pt, retrato |
//! | `@page { size: 297mm 210mm }`        | 595×842 pt, retrato |
//! | qualquer um, com page setup deitado  | 842×595 pt, paisagem|
//!
//! Ou seja: a orientação da folha vem exclusivamente do `GtkPageSetup` da
//! operação de impressão. E `window.print()` não dá acesso a ele — quem monta a
//! operação lá dentro é o próprio WebKitGTK, com o padrão do sistema, que é
//! retrato. Por isso a operação é montada aqui, onde o page setup existe. O
//! Mapa Mensal continua no comando histórico de paisagem; os relatórios comuns
//! em retrato usam um comando separado para não depender do padrão lembrado.
//!
//! A `@page` nomeada que havia no `styles.css` era pior que inócua: como a
//! propriedade CSS `page` também não existe no WebKit, a regra nunca chegava a
//! casar, e o documento saía com o layout de 297mm espremido numa folha de
//! 210mm. Ela foi removida.
//!
//! O diálogo de impressão continua aparecendo — já com a folha certa. Quem
//! emite escolhe a impressora ou "Imprimir para arquivo", como antes.
//!
//! A medição acima é do 2.48, de quando o comando de paisagem nasceu, e
//! continua valendo: `tools/impressao` a repetiu no **2.52.6** e a folha sai
//! igual. O arnês de lá monta este mesmo page setup e imprime pelo
//! `WebKit2.PrintOperation`, o que torna qualquer uma destas afirmações
//! reproduzível sem abrir a aplicação.
//!
//! **Como a folha é declarada importa**, e a forma óbvia sai em branco: ver
//! `folha_a4_paisagem` logo abaixo antes de mexer nela.

use tauri::{Runtime, State, WebviewWindow};

use crate::app_state::AppState;
use crate::auth::guards::require_session;
use crate::error::AppError;
use crate::response::{from_result, ApiResponse};

/// Imprime a janela atual com a folha em A4 paisagem.
///
/// Devolve `true` quando a impressão foi conduzida aqui. `false` significa que
/// este caminho não deu conta — a plataforma não tem page setup, ou a operação
/// se desfez sem dizer o que houve — e aí o frontend cai no `window.print()`,
/// que basta nos motores que honram o `@page`.
///
/// A chamada só retorna quando a impressão termina (ou o diálogo é cancelado):
/// o documento do mapa vive fora do `#app` e é desmontado logo depois, e
/// retornar antes imprimiria folha em branco.
#[tauri::command]
pub async fn print_landscape<R: Runtime>(
    // Genérico no runtime para que o teste de integração possa montar o comando
    // sobre o `MockRuntime` — lá `with_webview` é um no-op que devolve `Ok`.
    webview: WebviewWindow<R>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            imprimir_paisagem(webview).await
        }
        .await,
    )
    .await)
}

/// Imprime os relatórios comuns em A4 paisagem, com margem física própria.
///
/// Não reutiliza `print_landscape`: aquele comando é o contrato congelado do
/// Mapa Mensal, cujo documento mede 297×210mm e põe as margens dentro de cada
/// página. Os relatórios comuns fluem pelo paginador do motor e precisam que a
/// margem venha do `GtkPageSetup`, para existir mesmo quando o WebKit ignora
/// uma folha construída dinamicamente no frontend.
#[tauri::command]
pub async fn print_report_landscape<R: Runtime>(
    webview: WebviewWindow<R>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            imprimir_relatorio(webview, OrientacaoRelatorio::Paisagem).await
        }
        .await,
    )
    .await)
}

/// Imprime os relatórios comuns que usam A4 retrato.
///
/// Este comando é separado de `print_landscape` de propósito: o Mapa Mensal
/// depende do caminho em paisagem já medido e não deve ser alcançado por uma
/// refatoração dos demais relatórios.
#[tauri::command]
pub async fn print_portrait<R: Runtime>(
    webview: WebviewWindow<R>,
    state: State<'_, AppState>,
) -> Result<ApiResponse<bool>, String> {
    Ok(from_result(
        async {
            require_session(&state).await?;
            imprimir_relatorio(webview, OrientacaoRelatorio::Retrato).await
        }
        .await,
    )
    .await)
}

#[cfg(target_os = "linux")]
async fn imprimir_paisagem<R: Runtime>(webview: WebviewWindow<R>) -> Result<bool, AppError> {
    use gtk::prelude::*;
    use webkit2gtk::{PrintOperation, PrintOperationExt, PrintOperationResponse};

    let (envia, recebe) = tokio::sync::oneshot::channel::<Result<(), String>>();

    // `with_webview` despacha para a thread principal do GTK, que é onde o
    // diálogo e a operação de impressão podem existir.
    webview
        .with_webview(move |plataforma| {
            use std::cell::RefCell;
            use std::rc::Rc;

            let vista = plataforma.inner();
            let operacao = PrintOperation::new(&vista);
            operacao.set_page_setup(&folha_a4_paisagem());

            // Um sinal do glib é `Fn`: pode ser chamado mais de uma vez, e os
            // dois sinais competem pelo mesmo remetente, que só serve uma. O
            // `take` entrega a primeira notícia e deixa `None` para as demais.
            let remetente = Rc::new(RefCell::new(Some(envia)));

            // A impressão corre **depois** que o diálogo fecha, e nada mais no
            // Rust segura a operação até lá. Esta referência é quem a mantém
            // viva; `finished` e `failed` a soltam, e é por isso que o ciclo
            // que ela forma com os próprios sinais não vaza.
            let viva: Rc<RefCell<Option<PrintOperation>>> = Rc::new(RefCell::new(None));

            let (r, v) = (remetente.clone(), viva.clone());
            operacao.connect_finished(move |_| {
                v.borrow_mut().take();
                if let Some(s) = r.borrow_mut().take() {
                    let _ = s.send(Ok(()));
                }
            });

            let (r, v) = (remetente.clone(), viva.clone());
            operacao.connect_failed(move |_, erro| {
                v.borrow_mut().take();
                if let Some(s) = r.borrow_mut().take() {
                    let _ = s.send(Err(erro.to_string()));
                }
            });

            let janela = vista
                .toplevel()
                .and_then(|topo| topo.downcast::<gtk::Window>().ok());

            *viva.borrow_mut() = Some(operacao.clone());
            if operacao.run_dialog(janela.as_ref()) == PrintOperationResponse::Cancel {
                // Cancelar não emite sinal nenhum, e também não é erro: nada
                // foi impresso e não há o que dizer a quem emitiu.
                viva.borrow_mut().take();
                if let Some(s) = remetente.borrow_mut().take() {
                    let _ = s.send(Ok(()));
                }
            }
        })
        .map_err(|erro| AppError::Impressao(format!("webview indisponivel: {erro}")))?;

    match recebe.await {
        Ok(Ok(())) => Ok(true),
        Ok(Err(motivo)) => Err(AppError::Impressao(motivo)),
        // Canal fechado sem resposta: a operação morreu antes de emitir sinal
        // nenhum, ou `with_webview` nem chamou o corpo — é o caso do
        // `MockRuntime` no teste. Nada foi impresso, então o honesto é dizer
        // que este caminho não deu conta e deixar o frontend tentar o comum,
        // em vez de afirmar sucesso e o usuário ficar sem documento e sem erro.
        Err(_) => Ok(false),
    }
}

#[derive(Clone, Copy)]
enum OrientacaoRelatorio {
    Retrato,
    Paisagem,
}

/// Caminho comum somente aos relatórios de fluxo.
///
/// O Mapa Mensal permanece em `imprimir_paisagem`, sem compartilhar função,
/// folha nem margem com este caminho. Retrato e paisagem comuns diferem apenas
/// nas dimensões físicas e podem dividir a operação sem alcançar o documento
/// especial.
#[cfg(target_os = "linux")]
async fn imprimir_relatorio<R: Runtime>(
    webview: WebviewWindow<R>,
    orientacao: OrientacaoRelatorio,
) -> Result<bool, AppError> {
    use gtk::prelude::*;
    use webkit2gtk::{PrintOperation, PrintOperationExt, PrintOperationResponse};

    let (envia, recebe) = tokio::sync::oneshot::channel::<Result<(), String>>();

    // Os `Rc<RefCell<Option<_>>>` abaixo existem pelos mesmos dois motivos de
    // `imprimir_paisagem`: sinal do glib é `Fn` e os dois competem pelo mesmo
    // remetente, e a operação precisa de alguém que a segure viva depois que o
    // diálogo fecha, porque a impressão só corre então.
    webview
        .with_webview(move |plataforma| {
            use std::cell::RefCell;
            use std::rc::Rc;

            let vista = plataforma.inner();
            let operacao = PrintOperation::new(&vista);
            operacao.set_page_setup(&folha_a4_relatorio(orientacao));

            let remetente = Rc::new(RefCell::new(Some(envia)));
            let viva: Rc<RefCell<Option<PrintOperation>>> = Rc::new(RefCell::new(None));

            let (r, v) = (remetente.clone(), viva.clone());
            operacao.connect_finished(move |_| {
                v.borrow_mut().take();
                if let Some(s) = r.borrow_mut().take() {
                    let _ = s.send(Ok(()));
                }
            });

            let (r, v) = (remetente.clone(), viva.clone());
            operacao.connect_failed(move |_, erro| {
                v.borrow_mut().take();
                if let Some(s) = r.borrow_mut().take() {
                    let _ = s.send(Err(erro.to_string()));
                }
            });

            let janela = vista
                .toplevel()
                .and_then(|topo| topo.downcast::<gtk::Window>().ok());

            *viva.borrow_mut() = Some(operacao.clone());
            if operacao.run_dialog(janela.as_ref()) == PrintOperationResponse::Cancel {
                viva.borrow_mut().take();
                if let Some(s) = remetente.borrow_mut().take() {
                    let _ = s.send(Ok(()));
                }
            }
        })
        .map_err(|erro| AppError::Impressao(format!("webview indisponivel: {erro}")))?;

    match recebe.await {
        Ok(Ok(())) => Ok(true),
        Ok(Err(motivo)) => Err(AppError::Impressao(motivo)),
        Err(_) => Ok(false),
    }
}

/// A folha do documento: 297×210mm, sem margem de página.
///
/// PAPEL DEITADO, E NÃO A4 ROTACIONADO
///
/// As duas formas dão a mesma folha de 842×595 pt, mas pedir a rotação ao GTK
/// **imprime as páginas em branco** quando a operação passa por `run_dialog`: a
/// contagem de páginas sai certa, a folha sai deitada, e não se pinta nada.
/// Medido no webkit2gtk-4.1 2.48, com o CSS compilado da aplicação:
///
/// | page setup                       | folha   | texto extraído |
/// |----------------------------------|---------|----------------|
/// | A4, mandando o GTK rotacionar    | 842×595 | **nenhum**     |
/// | papel de 297×210mm, sem rotação  | 842×595 | completo       |
///
/// Declarar o papel já deitado não passa pelo caminho de rotação do WebKit, e é
/// por isso que funciona. Não peça rotação aqui.
///
/// Margens zero porque as margens do documento são as do CSS
/// (`.mapa-pdf-pagina`), e somar as duas encolheria a área útil que a paginação
/// do frontend mediu.
#[cfg(target_os = "linux")]
fn folha_a4_paisagem() -> gtk::PageSetup {
    let folha = gtk::PageSetup::new();
    folha.set_paper_size(&gtk::PaperSize::new_custom(
        "a4-paisagem",
        "A4 paisagem",
        297.0,
        210.0,
        gtk::Unit::Mm,
    ));
    folha.set_top_margin(0.0, gtk::Unit::Mm);
    folha.set_bottom_margin(0.0, gtk::Unit::Mm);
    folha.set_left_margin(0.0, gtk::Unit::Mm);
    folha.set_right_margin(0.0, gtk::Unit::Mm);
    folha
}

/// A folha dos relatórios comuns, com margens físicas de 15×12mm.
///
/// Declarada como papel físico pelo mesmo motivo da folha do Mapa — não pedir
/// nada ao caminho de rotação do WebKit. A margem fica no GTK porque os PDFs
/// reais provaram que uma regra `@page` em `adoptedStyleSheets` não chega à
/// impressão, embora o restante do CSS escopado chegue.
///
/// Medido no webkit2gtk-4.1 **2.52.6**, imprimindo o CSS compilado por
/// `tools/impressao/imprimir.py`, que monta este mesmo page setup:
///
/// | page setup                       | folha do PDF        |
/// |----------------------------------|---------------------|
/// | papel de 210×297mm, sem rotação  | 595×842 pt, retrato |
/// | papel de 297×210mm, sem rotação  | 842×595 pt, paisagem|
///
#[cfg(target_os = "linux")]
fn folha_a4_relatorio(orientacao: OrientacaoRelatorio) -> gtk::PageSetup {
    let (nome, rotulo, largura, altura) = match orientacao {
        OrientacaoRelatorio::Retrato => ("a4-retrato", "A4 retrato", 210.0, 297.0),
        OrientacaoRelatorio::Paisagem => ("a4-paisagem-relatorio", "A4 paisagem", 297.0, 210.0),
    };
    let folha = gtk::PageSetup::new();
    folha.set_paper_size(&gtk::PaperSize::new_custom(
        nome,
        rotulo,
        largura,
        altura,
        gtk::Unit::Mm,
    ));
    folha.set_top_margin(15.0, gtk::Unit::Mm);
    folha.set_bottom_margin(15.0, gtk::Unit::Mm);
    folha.set_left_margin(12.0, gtk::Unit::Mm);
    folha.set_right_margin(12.0, gtk::Unit::Mm);
    folha
}

/// Fora do Linux o `@page` do CSS resolve a orientação, e o frontend imprime
/// pelo caminho comum.
#[cfg(not(target_os = "linux"))]
async fn imprimir_paisagem<R: Runtime>(_webview: WebviewWindow<R>) -> Result<bool, AppError> {
    Ok(false)
}

#[cfg(not(target_os = "linux"))]
async fn imprimir_relatorio<R: Runtime>(
    _webview: WebviewWindow<R>,
    _orientacao: OrientacaoRelatorio,
) -> Result<bool, AppError> {
    Ok(false)
}
