//! Comandos Tauri exercitados pelo IPC de verdade.
//!
//! Os outros arquivos testam repositórios: SQL, transação, regra de negócio.
//! Fica de fora justamente a casca — o guard, a desserialização do request e o
//! envelope `ApiResponse` — que é onde mora a divergência mais barata de
//! cometer e mais cara de descobrir, porque só aparece quando alguém clica.
//!
//! Aqui o comando é chamado como o frontend chama: nome em `string`, argumentos
//! num JSON. Duas convenções são travadas de uma vez:
//!
//! - **argumento de comando em camelCase** (`processoId`), porque é o que o
//!   Tauri v2 faz e nenhum dos 75 comandos declara `rename_all`;
//! - **campo de request em snake_case**, dentro de `{ request: {...} }`, porque
//!   ali quem desserializa é o serde.
//!
//! O app de teste é montado por `registrar_comandos`, a MESMA função que o
//! `run()` usa: um comando que não estivesse registrado não passaria aqui.

use adm_p6_tauri_lib::app_state::AppState;
use adm_p6_tauri_lib::auth::domain::SessionUser;
use serde_json::{json, Value};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{mock_builder, mock_context, noop_assets, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{App, Manager, WebviewWindow};

mod util;
use util::fixtures;

/// Sobe o app de teste sobre o `MockRuntime`, com o estado apontando para o
/// banco descartável do teste.
fn app_de_teste(database_url: &str) -> (App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let app = adm_p6_tauri_lib::registrar_comandos(mock_builder())
        .manage(AppState::from_url(database_url.to_string()))
        .build(mock_context(noop_assets()))
        .expect("montar app de teste");
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("montar webview");
    (app, webview)
}

/// Chama um comando como o frontend chamaria e devolve o envelope como JSON.
fn invocar(webview: &WebviewWindow<MockRuntime>, comando: &str, args: Value) -> Value {
    let resposta = tauri::test::get_ipc_response(
        webview,
        InvokeRequest {
            cmd: comando.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: if cfg!(any(windows, target_os = "android")) {
                "http://tauri.localhost"
            } else {
                "tauri://localhost"
            }
            .parse()
            .unwrap(),
            body: InvokeBody::Json(args),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    );
    match resposta {
        Ok(corpo) => corpo.deserialize::<Value>().expect("envelope em json"),
        Err(erro) => panic!("o comando devolveu Err no IPC: {erro}"),
    }
}

fn ok(envelope: &Value) -> &Value {
    assert_eq!(envelope["ok"], json!(true), "esperava sucesso: {envelope}");
    assert_eq!(envelope["error"], Value::Null);
    &envelope["data"]
}

fn erro(envelope: &Value) -> String {
    assert_eq!(envelope["ok"], json!(false), "esperava falha: {envelope}");
    assert_eq!(envelope["data"], Value::Null);
    envelope["error"]
        .as_str()
        .expect("erro em texto")
        .to_string()
}

/// Marca a sessão sem passar pelo login — o alvo do teste é o guard, não a
/// autenticação, que `auth_login.rs` já cobre.
///
/// A conta é a do seed, e não um id inventado: toda escrita grava auditoria, e
/// `auditoria.usuario_id` tem FK para `usuarios`.
fn autenticar(app: &App<MockRuntime>, conta: &str, admin: bool) {
    let estado: tauri::State<'_, AppState> = app.state();
    tauri::async_runtime::block_on(estado.set_session(Some(SessionUser {
        id: conta.to_string(),
        nome: "SESSAO DE TESTE".into(),
        email: "teste@sistema.com".into(),
        perfil: "Administrador".into(),
        is_admin: admin,
        policial_militar_id: None,
    })));
}

/// Roda o corpo com um banco descartável já migrado e o app montado sobre ele.
///
/// O corpo é bloqueante e vai para `spawn_blocking`: `get_ipc_response` espera
/// numa fila síncrona, e bloquear direto dentro do runtime prenderia a thread
/// que precisa executar o próprio comando.
fn com_app_e_banco<F>(sufixo: &str, corpo: F)
where
    F: FnOnce(App<MockRuntime>, WebviewWindow<MockRuntime>, String) + Send + 'static,
{
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    rt.block_on(async move {
        util::com_banco_descartavel_com_url(sufixo, |pool, url| async move {
            fixtures::mundo_configurado(&pool).await;
            let conta = fixtures::conta_admin(&pool).await;
            tokio::task::spawn_blocking(move || {
                let (app, webview) = app_de_teste(&url);
                corpo(app, webview, conta);
            })
            .await
            .expect("corpo do teste");
        })
        .await;
    });
}

// ── Guards ───────────────────────────────────────────────────────────────────

/// Sem sessão, nenhum comando responde. O envelope é de erro, não uma exceção
/// crua — o frontend espera sempre `{ok, data, error}`.
#[test]
fn sem_sessao_todo_comando_recusa_com_envelope() {
    com_app_e_banco("ipc_sem_sessao", |_app, webview, _conta| {
        for (comando, args) in [
            ("dashboard_summary", json!({})),
            ("legal_catalogs_list", json!({ "catalogo": "apuratorios" })),
            ("proceedings_list", json!({})),
            ("reports_available_years", json!({})),
        ] {
            let envelope = invocar(&webview, comando, args);
            let mensagem = erro(&envelope);
            assert!(
                mensagem.to_lowercase().contains("sessao"),
                "{comando}: {mensagem}"
            );
        }
    });
}

/// Escrita exige administrador. As 13 escritas que rodavam só com
/// `require_session` passaram a exigir `require_admin`; um perfil de leitura
/// que voltasse a gravar seria um retrocesso silencioso.
#[test]
fn escrita_exige_administrador_e_leitura_nao() {
    com_app_e_banco("ipc_admin", |app, webview, conta| {
        autenticar(&app, &conta, false);

        // Leitura passa.
        ok(&invocar(&webview, "dashboard_summary", json!({})));

        // Escrita não.
        let mensagem = erro(&invocar(
            &webview,
            "legal_catalogs_save",
            json!({ "request": { "catalogo": "tipos_documento", "id": null,
                                 "valores": { "nome": "Ofício Teste" } } }),
        ));
        assert!(
            mensagem.to_lowercase().contains("somente leitura"),
            "mensagem do guard: {mensagem}"
        );

        // Com administrador, a mesma chamada grava.
        autenticar(&app, &conta, true);
        let dados = ok(&invocar(
            &webview,
            "legal_catalogs_save",
            json!({ "request": { "catalogo": "tipos_documento", "id": null,
                                 "valores": { "nome": "Ofício Teste" } } }),
        ))
        .clone();
        assert!(dados["id"].is_string(), "devolve o id gravado: {dados}");
    });
}

// ── Convenções de argumento ──────────────────────────────────────────────────

/// Argumento de comando é camelCase. Era o defeito mais comum do frontend
/// legado: `per_page` em vez de `perPage`, `usuario_id` em vez de `usuarioId`.
#[test]
fn argumento_de_comando_e_camel_case() {
    com_app_e_banco("ipc_camel", |app, webview, conta| {
        autenticar(&app, &conta, true);

        // A grafia correta funciona.
        let dados = ok(&invocar(
            &webview,
            "legal_catalogs_list",
            json!({ "catalogo": "apuratorios", "incluirInativos": true }),
        ))
        .clone();
        assert_eq!(dados.as_array().unwrap().len(), 3, "os 3 da fixture");

        // A grafia snake_case do parâmetro é simplesmente ignorada pelo serde,
        // e o comando roda com o default — foi assim que filtros inteiros do
        // frontend legado não faziam nada, sem erro nenhum.
        let envelope = invocar(
            &webview,
            "legal_catalogs_list",
            json!({ "catalogo": "apuratorios", "incluir_inativos": true }),
        );
        assert_eq!(envelope["ok"], json!(true), "nao falha: passa despercebido");
    });
}

/// Dentro de `{ request: {...} }` os campos seguem snake_case — ali quem
/// desserializa é o serde, não o Tauri. As duas convenções convivem, e é
/// exatamente por isso que confundem.
#[test]
fn campo_de_request_e_snake_case() {
    com_app_e_banco("ipc_snake", |app, webview, conta| {
        autenticar(&app, &conta, true);

        // Campo obrigatório com a grafia certa: a regra de negócio é alcançada.
        let mensagem = erro(&invocar(
            &webview,
            "legal_catalogs_save",
            json!({ "request": { "catalogo": "tipos_documento", "id": null,
                                 "valores": { "nome": "  " } } }),
        ));
        assert!(mensagem.contains("obrigatorio"), "{mensagem}");

        // Campo do request faltando é erro de DESSERIALIZAÇÃO, e o Tauri o
        // devolve como Err do IPC — não como envelope. Vale registrar a
        // diferença: o frontend cai no `catch` do `call()`.
        let resposta = tauri::test::get_ipc_response(
            &webview,
            InvokeRequest {
                cmd: "legal_catalogs_save".into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: if cfg!(any(windows, target_os = "android")) {
                    "http://tauri.localhost"
                } else {
                    "tauri://localhost"
                }
                .parse()
                .unwrap(),
                body: InvokeBody::Json(json!({ "request": { "catalogo": "tipos_documento" } })),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        );
        assert!(resposta.is_err(), "request incompleto nao chega ao comando");
    });
}

// ── Envelope ─────────────────────────────────────────────────────────────────

/// O envelope tem exatamente três campos, com estes nomes. É o contrato que
/// `src/api.ts::ApiResponse` declara; renomear um deles aqui quebraria todas as
/// telas de uma vez.
#[test]
fn o_envelope_tem_ok_data_e_error() {
    com_app_e_banco("ipc_envelope", |app, webview, conta| {
        autenticar(&app, &conta, true);

        let sucesso = invocar(&webview, "dashboard_summary", json!({}));
        let campos = sucesso.as_object().expect("envelope e objeto");
        assert_eq!(campos.len(), 3, "o envelope tem exatamente tres campos");
        for campo in ["ok", "data", "error"] {
            assert!(campos.contains_key(campo), "envelope sem '{campo}'");
        }
        assert_eq!(sucesso["data"]["total"], json!(0));

        // No erro, `data` é nulo e `error` traz texto legível.
        let falha = invocar(
            &webview,
            "legal_catalogs_list",
            json!({ "catalogo": "catalogo_que_nao_existe" }),
        );
        assert!(erro(&falha).contains("catalogo"), "{falha}");
    });
}

/// Um comando de leitura devolve o mesmo formato que `types.ts` declara. Se um
/// campo for renomeado no Rust, o frontend só descobriria em runtime.
#[test]
fn resposta_traz_os_campos_que_o_frontend_espera() {
    com_app_e_banco("ipc_formato", |app, webview, conta| {
        autenticar(&app, &conta, true);

        let resumo = invocar(&webview, "dashboard_summary", json!({}));
        let dados = ok(&resumo);
        for campo in [
            "total",
            "em_andamento",
            "concluidos",
            "prazos_vencidos",
            "por_apuratorio",
            "por_natureza",
            "por_unidade",
            "por_ano",
        ] {
            assert!(dados.get(campo).is_some(), "DashboardSummary sem '{campo}'");
        }

        let anos = invocar(&webview, "reports_available_years", json!({}));
        assert!(ok(&anos).is_array());
    });
}

/// `users_list_ativos` alimenta os seletores de militar do formulário de
/// processo. Passa pelo IPC aqui porque o defeito que ele corrige era
/// invisível justamente na fronteira: a tela pedia `perPage: 500` a um comando
/// que trava em 200, e recebia 200 sem erro nenhum.
#[test]
fn lista_de_opcoes_de_militar_responde_pelo_ipc() {
    com_app_e_banco("ipc_militares", |app, webview, conta| {
        autenticar(&app, &conta, false);

        // É leitura: não exige administrador.
        let dados = ok(&invocar(&webview, "users_list_ativos", json!({}))).clone();
        let itens = dados.as_array().expect("lista de militares");
        assert_eq!(itens.len(), 3, "os 3 da fixture, sem paginação no caminho");

        // Os campos que `selectMilitares` monta em `src/telas/processo.ts`.
        for campo in ["id", "nome", "matricula", "posto_graduacao", "ativo"] {
            assert!(
                itens[0].get(campo).is_some(),
                "UserListItem sem '{campo}' — o seletor monta o rótulo com ele"
            );
        }
    });
}
