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
//!   Tauri v2 faz e os comandos não declaram `rename_all`;
//! - **campo de request em snake_case**, dentro de `{ request: {...} }`, porque
//!   ali quem desserializa é o serde.
//!
//! O app de teste é montado por `registrar_comandos`, a MESMA função que o
//! `run()` usa: um comando que não estivesse registrado não passaria aqui.

use adm_p6_tauri_lib::app_state::AppState;
use adm_p6_tauri_lib::auth::domain::SessionUser;
use adm_p6_tauri_lib::deadlines::domain::AddExtensionRequest;
use adm_p6_tauri_lib::deadlines::repository as deadlines_repository;
use chrono::NaiveDate;
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
        matricula: None,
        posto_graduacao: None,
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
    com_app_banco_e_mundo(sufixo, |app, webview, conta, _| corpo(app, webview, conta));
}

/// A mesma coisa, com os ids da fixture em mãos.
///
/// Comando que recebe id de catálogo precisa deles, e inventar um UUID aqui só
/// exercitaria o caminho do "não encontrado".
fn com_app_banco_e_mundo<F>(sufixo: &str, corpo: F)
where
    F: FnOnce(App<MockRuntime>, WebviewWindow<MockRuntime>, String, fixtures::Mundo)
        + Send
        + 'static,
{
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .unwrap();
    rt.block_on(async move {
        util::com_banco_descartavel_com_url(sufixo, |pool, url| async move {
            let mundo = fixtures::mundo_configurado(&pool).await;
            let conta = fixtures::conta_admin(&pool).await;
            tokio::task::spawn_blocking(move || {
                let (app, webview) = app_de_teste(&url);
                corpo(app, webview, conta, mundo);
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
            ("proceedings_filter_options", json!({})),
            ("reports_available_years", json!({})),
            ("print_landscape", json!({})),
        ] {
            let envelope = invocar(&webview, comando, args);
            let mensagem = erro(&envelope);
            assert!(
                mensagem.to_lowercase().contains("sessão"),
                "{comando}: {mensagem}"
            );
        }
    });
}

/// O filtro da listagem atravessa o serde inteiro pelo IPC.
///
/// É o único lugar onde `ProceedingSituation` e as datas do filtro são
/// exercitadas como o frontend as manda. Duas coisas se provam aqui e em
/// nenhum teste de repositório:
///
/// - `situacao` chega como a string do `rename_all = "snake_case"`
///   (`"no_prazo"`), e não como o nome da variante;
/// - `data_instauracao_inicio`/`_fim` aceitam a string ISO que o
///   `<input type="date">` produz, virando `Option<NaiveDate>`.
///
/// Os campos vão em snake_case porque estão **dentro** de `{ filter: {...} }`:
/// quem desserializa ali é o serde, não o Tauri. Grafia errada num deles não
/// seria erro — viraria `None`, e o filtro sumiria em silêncio.
#[test]
fn o_filtro_da_listagem_desserializa_situacao_e_datas() {
    com_app_e_banco("ipc_filtro_listagem", |app, webview, conta| {
        autenticar(&app, &conta, false);

        let envelope = invocar(
            &webview,
            "proceedings_list",
            json!({
                "filter": {
                    "situacao": "no_prazo",
                    "data_instauracao_inicio": "2026-01-10",
                    "data_instauracao_fim": "2026-12-31",
                    "per_page": 10
                }
            }),
        );
        let dados = ok(&envelope);
        assert_eq!(dados["total"], json!(0));
        assert_eq!(dados["per_page"], json!(10));
        assert_eq!(dados["items"], json!([]));
    });
}

/// As opções do modal saem dos apuratórios, não dos cadastros.
///
/// O mundo da fixture tem todos os catálogos semeados e **nenhum apuratório**.
/// As oito listas voltando vazias é exatamente a regra de
/// `repository::filter_options`: opção que não corta nada não é oferecida. Com
/// a regra antiga (`ativo OR em uso`) este teste falharia em seis das oito.
#[test]
fn opcoes_de_filtro_vem_vazias_sem_apuratorio_nenhum() {
    com_app_e_banco("ipc_opcoes_filtro", |app, webview, conta| {
        autenticar(&app, &conta, false);

        let envelope = invocar(&webview, "proceedings_filter_options", json!({}));
        let dados = ok(&envelope);
        for lista in [
            "tipos_apuratorio",
            "unidades",
            "responsaveis",
            "vitimas",
            "anos",
            "locais_fato",
            "envolvidos",
            "documentos_iniciadores",
        ] {
            assert_eq!(dados[lista], json!([]), "{lista}: {dados}");
        }
    });
}

/// Desativar uma função do apuratório **grava**.
///
/// Regressão de um defeito que ficou latente desde a 0001: o comando registrava
/// a auditoria com `operacao = "DEACTIVATE"`, e `ck_auditoria_operacao` só
/// aceita `CREATE`/`UPDATE`/`DELETE`. Como o `INSERT` da trilha corre na MESMA
/// transação da desativação, a violação do CHECK derrubava as duas — a função
/// nunca chegava a ser desativada, e o usuário via um erro de banco cru.
///
/// Nada acusava: o repositório tinha teste, o comando não. Desativação é
/// `ativo = false`, ou seja `UPDATE`; quem diz que foi uma desativação é a
/// `acao` da trilha, e não um quarto verbo que o banco recusa.
#[test]
fn desativar_funcao_do_apuratorio_grava_em_vez_de_derrubar_a_transacao() {
    com_app_banco_e_mundo("ipc_desativa_papel", |app, webview, conta, m| {
        autenticar(&app, &conta, true);

        let envelope = invocar(
            &webview,
            "apuratorio_config_deactivate_papel",
            json!({ "apuratorioId": m.apuratorio, "papelId": m.papel_escrivao }),
        );
        assert_eq!(ok(&envelope), &json!(true));

        // Comitou de verdade: a configuração relida já traz a função inativa.
        let config = invocar(
            &webview,
            "apuratorio_config_get",
            json!({ "apuratorioId": m.apuratorio }),
        );
        let papeis = ok(&config)["papeis"].as_array().unwrap().clone();
        let escrivao = papeis
            .iter()
            .find(|p| p["papel_id"] == json!(m.papel_escrivao))
            .expect("o Escrivão continua listado");
        assert_eq!(escrivao["ativo"], json!(false));

        // E a trilha registrou, em português, sem UUID à vista.
        let trilha = invocar(
            &webview,
            "audit_list",
            json!({ "entidade": "apuratorio_papeis" }),
        );
        let itens = ok(&trilha)["items"].as_array().unwrap().clone();
        assert_eq!(itens.len(), 1, "{itens:?}");
        assert_eq!(itens[0]["operacao"], json!("UPDATE"));
        assert_eq!(
            itens[0]["acao"],
            json!("Desativou uma função do apuratório")
        );
        // Sigla do apuratório e nome da função, e não o par de UUIDs que a PK
        // composta obriga a guardar em `registro_id`.
        assert_eq!(itens[0]["assunto"], json!("TST-A — Escrivao Teste"));
        assert_eq!(
            itens[0]["registro_id"],
            json!(format!("{}:{}", m.apuratorio, m.papel_escrivao))
        );
    });
}

/// A impressão em paisagem responde pelo IPC sem prender a chamada.
///
/// `print_landscape` espera num canal que só é fechado quando a operação de
/// impressão termina — e sob o `MockRuntime` `with_webview` é um no-op, de modo
/// que o remetente é descartado sem sinal nenhum. Este teste trava esse caminho:
/// se alguém trocar o `Err(_)` do canal por uma espera, ele deixa de terminar.
///
/// O `false` é o valor certo aqui: quem imprime em paisagem é o page setup do
/// GTK, que o `MockRuntime` não tem, e nesse caso o frontend cai no
/// `window.print()`. Ver `src/print/commands.rs`.
#[test]
fn impressao_em_paisagem_responde_pelo_ipc() {
    com_app_e_banco("ipc_print", |app, webview, conta| {
        autenticar(&app, &conta, false);
        let envelope = invocar(&webview, "print_landscape", json!({}));
        assert_eq!(ok(&envelope), &json!(false), "{envelope}");
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
        assert!(mensagem.contains("Preencha o campo Nome"), "{mensagem}");

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

#[test]
fn editar_e_excluir_prorrogacao_passam_pelo_ipc_e_auditoria() {
    com_app_e_banco("ipc_prazo_edicao", |app, webview, conta| {
        autenticar(&app, &conta, true);

        let (processo_id, prazo_id) = tauri::async_runtime::block_on(async {
            let estado: tauri::State<'_, AppState> = app.state();
            let pool = estado.pool().await.unwrap();
            let inicio = NaiveDate::from_ymd_opt(2026, 1, 10).unwrap();
            let processo_id: String = sqlx::query_scalar(
                "INSERT INTO processos_procedimentos
                     (apuratorio_id, documento_iniciador_id, numero_documento,
                      unidade_origem_id, municipio_fato_id, natureza_fato_id,
                      data_instauracao, data_recebimento)
                 VALUES ((SELECT id FROM apuratorios ORDER BY id LIMIT 1),
                         (SELECT tipo_documento_id FROM apuratorio_documentos_iniciadores ORDER BY tipo_documento_id LIMIT 1),
                         'IPC-PRAZO-001',
                         (SELECT id FROM unidades_pm ORDER BY id LIMIT 1),
                         (SELECT id FROM municipios_distritos ORDER BY id LIMIT 1),
                         (SELECT id FROM naturezas_fato ORDER BY id LIMIT 1),
                         $1, $1)
              RETURNING id::text",
            )
            .bind(inicio)
            .fetch_one(&pool)
            .await
            .unwrap();

            let mut tx = pool.begin().await.unwrap();
            deadlines_repository::create_initial(&mut tx, &processo_id, inicio, 30)
                .await
                .unwrap();
            let prazo_id = deadlines_repository::add_extension(
                &mut tx,
                &AddExtensionRequest {
                    processo_id: processo_id.clone(),
                    nova_data_vencimento: NaiveDate::from_ymd_opt(2026, 2, 24).unwrap(),
                    motivo: "teste do IPC".to_string(),
                    documento_autorizador_id: None,
                    numero_documento: None,
                    data_documento: None,
                    autoridade_id: None,
                },
            )
            .await
            .unwrap();
            tx.commit().await.unwrap();
            (processo_id, prazo_id)
        });

        assert_eq!(
            ok(&invocar(
                &webview,
                "deadlines_update_extension",
                json!({ "request": {
                    "processo_id": processo_id,
                    "prazo_id": prazo_id,
                    "nova_data_vencimento": "2026-03-01"
                } }),
            )),
            &json!(true)
        );

        let prazos = invocar(
            &webview,
            "deadlines_list",
            json!({ "processoId": processo_id }),
        );
        let itens = ok(&prazos).as_array().unwrap();
        assert_eq!(
            itens.last().unwrap()["data_vencimento"],
            json!("2026-03-01")
        );

        assert_eq!(
            ok(&invocar(
                &webview,
                "deadlines_delete_extension",
                json!({ "processoId": processo_id, "prazoId": prazo_id }),
            )),
            &json!(true)
        );

        let operacoes: Vec<String> = tauri::async_runtime::block_on(async {
            let estado: tauri::State<'_, AppState> = app.state();
            let pool = estado.pool().await.unwrap();
            sqlx::query_scalar(
                "SELECT operacao FROM auditoria
                  WHERE entidade = 'processo_prazos' AND registro_id = $1
                  ORDER BY ocorrido_em",
            )
            .bind(&prazo_id)
            .fetch_all(&pool)
            .await
            .unwrap()
        });
        assert_eq!(operacoes, vec!["UPDATE", "DELETE"]);
    });
}

#[test]
fn datas_pos_cadastro_e_resultado_passam_pelo_ipc_e_auditoria() {
    com_app_e_banco("ipc_resultado", |app, webview, conta| {
        autenticar(&app, &conta, true);
        let (processo_id, envolvido_id, sugerida, decidida, penalidade) =
            tauri::async_runtime::block_on(async {
                let estado: tauri::State<'_, AppState> = app.state();
                let pool = estado.pool().await.unwrap();
                sqlx::query(
                    "UPDATE apuratorios
                        SET permite_punicao = true, permite_remessa_comissao = true,
                            permite_julgamento = true
                      WHERE id = (SELECT id FROM apuratorios ORDER BY id LIMIT 1)",
                )
                .execute(&pool)
                .await
                .unwrap();
                let processo_id: String = sqlx::query_scalar(
                    "INSERT INTO processos_procedimentos
                         (apuratorio_id, documento_iniciador_id, numero_documento,
                          unidade_origem_id, municipio_fato_id, natureza_fato_id,
                          data_instauracao)
                     VALUES ((SELECT id FROM apuratorios WHERE permite_punicao LIMIT 1),
                             (SELECT tipo_documento_id
                                FROM apuratorio_documentos_iniciadores
                               WHERE apuratorio_id =
                                     (SELECT id FROM apuratorios WHERE permite_punicao LIMIT 1)
                               ORDER BY tipo_documento_id LIMIT 1),
                             'IPC-RESULTADO-001',
                             (SELECT id FROM unidades_pm ORDER BY id LIMIT 1),
                             (SELECT id FROM municipios_distritos ORDER BY id LIMIT 1),
                             (SELECT id FROM naturezas_fato ORDER BY id LIMIT 1),
                             DATE '2026-01-10')
                  RETURNING id::text",
                )
                .fetch_one(&pool)
                .await
                .unwrap();
                let envolvido_id: String = sqlx::query_scalar(
                    "INSERT INTO processo_envolvidos
                         (processo_id, policial_militar_id, status_envolvido_id, ordem)
                     VALUES ($1::uuid,
                             (SELECT id FROM policiais_militares WHERE ativo ORDER BY id LIMIT 1),
                             (SELECT id FROM status_envolvido WHERE ativo ORDER BY id LIMIT 1), 1)
                  RETURNING id::text",
                )
                .bind(&processo_id)
                .fetch_one(&pool)
                .await
                .unwrap();
                let sugerida: String = sqlx::query_scalar(
                    "SELECT id::text FROM tipos_solucao_sugerida WHERE ativo ORDER BY id LIMIT 1",
                )
                .fetch_one(&pool)
                .await
                .unwrap();
                let decidida: String = sqlx::query_scalar(
                    "SELECT id::text FROM tipos_solucao_decidida WHERE permite_penalidade ORDER BY id LIMIT 1",
                )
                .fetch_one(&pool)
                .await
                .unwrap();
                let penalidade: String = sqlx::query_scalar(
                    "SELECT id::text FROM tipos_penalidade WHERE usa_quantidade_dias ORDER BY id LIMIT 1",
                )
                .fetch_one(&pool)
                .await
                .unwrap();
                (processo_id, envolvido_id, sugerida, decidida, penalidade)
            });

        assert_eq!(
            ok(&invocar(
                &webview,
                "proceedings_update_dates",
                json!({ "request": {
                    "processo_id": processo_id,
                    "data_remessa_encarregado": null,
                    "data_remessa_comissao": "2026-02-02",
                    "data_julgamento": "2026-02-03",
                    "data_conclusao": "2026-02-04"
                } }),
            )),
            &json!(true)
        );
        assert_eq!(
            ok(&invocar(
                &webview,
                "proceedings_update_involved_outcome",
                json!({ "request": {
                    "processo_id": processo_id,
                    "envolvido_id": envolvido_id,
                    "solucao_sugerida_id": sugerida,
                    "solucao_decidida_id": decidida,
                    "penalidade_tipo_id": penalidade,
                    "penalidade_dias": 4
                } }),
            )),
            &json!(true)
        );

        let entidades: Vec<String> = tauri::async_runtime::block_on(async {
            let estado: tauri::State<'_, AppState> = app.state();
            let pool = estado.pool().await.unwrap();
            sqlx::query_scalar(
                "SELECT entidade FROM auditoria
                  WHERE registro_id = $1 OR registro_id = $2
                  ORDER BY entidade",
            )
            .bind(&processo_id)
            .bind(&envolvido_id)
            .fetch_all(&pool)
            .await
            .unwrap()
        });
        assert_eq!(
            entidades,
            vec!["processo_envolvidos", "processos_procedimentos"]
        );
    });
}

/// A edição de andamento atravessa o mesmo contrato usado pela tela e deixa a
/// trilha de auditoria, sem trocar o autor nem o momento do lançamento.
#[test]
fn editar_andamento_passa_pelo_ipc_e_preserva_os_fatos_originais() {
    com_app_e_banco("ipc_andamento_edicao", |app, webview, conta| {
        autenticar(&app, &conta, true);

        let (processo_id, andamento_id) = tauri::async_runtime::block_on(async {
            let estado: tauri::State<'_, AppState> = app.state();
            let pool = estado.pool().await.unwrap();
            let processo_id: String = sqlx::query_scalar(
                "INSERT INTO processos_procedimentos
                     (apuratorio_id, documento_iniciador_id, numero_documento,
                      unidade_origem_id, municipio_fato_id, natureza_fato_id,
                      data_instauracao)
                 VALUES ((SELECT id FROM apuratorios ORDER BY id LIMIT 1),
                         (SELECT tipo_documento_id FROM apuratorio_documentos_iniciadores ORDER BY tipo_documento_id LIMIT 1),
                         'IPC-ANDAMENTO-001',
                         (SELECT id FROM unidades_pm ORDER BY id LIMIT 1),
                         (SELECT id FROM municipios_distritos ORDER BY id LIMIT 1),
                         (SELECT id FROM naturezas_fato ORDER BY id LIMIT 1),
                         '2026-03-01')
              RETURNING id::text",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
            let andamento_id: String = sqlx::query_scalar(
                "INSERT INTO processo_andamentos
                     (processo_id, tipo_andamento_id, descricao, ocorrido_em, registrado_por_id)
                 VALUES ($1::uuid,
                         (SELECT id FROM tipos_andamento ORDER BY id LIMIT 1),
                         'Texto original.', '2026-03-04T12:00:00Z', $2::uuid)
              RETURNING id::text",
            )
            .bind(&processo_id)
            .bind(&conta)
            .fetch_one(&pool)
            .await
            .unwrap();
            (processo_id, andamento_id)
        });

        assert_eq!(
            ok(&invocar(
                &webview,
                "movements_update",
                json!({ "request": {
                    "processo_id": processo_id,
                    "andamento_id": andamento_id,
                    "descricao": "Texto corrigido.",
                    "tipo_andamento_id": null
                } }),
            )),
            &json!(true)
        );

        let itens = ok(&invocar(
            &webview,
            "movements_list",
            json!({ "processoId": processo_id }),
        ))
        .as_array()
        .unwrap()
        .clone();
        assert_eq!(itens.len(), 1);
        assert_eq!(itens[0]["descricao"], json!("Texto corrigido."));
        assert!(itens[0]["tipo_andamento_id"].is_null());
        assert_eq!(itens[0]["registrado_por_id"], json!(conta));
        assert_eq!(itens[0]["ocorrido_em"], json!("2026-03-04T12:00:00Z"));

        let operacao: String = tauri::async_runtime::block_on(async {
            let estado: tauri::State<'_, AppState> = app.state();
            let pool = estado.pool().await.unwrap();
            sqlx::query_scalar(
                "SELECT operacao FROM auditoria
                  WHERE entidade = 'processo_andamentos' AND registro_id = $1",
            )
            .bind(&andamento_id)
            .fetch_one(&pool)
            .await
            .unwrap()
        });
        assert_eq!(operacao, "UPDATE");
    });
}

/// O ciclo inteiro da substituição pelo IPC: criar, corrigir, desfazer — e a
/// trilha de auditoria das DUAS designações que cada operação mexe.
///
/// Trava de uma vez as duas convenções que o `main.ts` errava: argumento de
/// comando em camelCase (`processoId`, `designacaoId`) e campo de request em
/// snake_case dentro de `{ request: {...} }`.
#[test]
fn substituicao_de_designacao_passa_pelo_ipc_e_auditoria() {
    com_app_e_banco("ipc_substituicao", |app, webview, conta| {
        autenticar(&app, &conta, true);

        let (processo_id, inicial_id) = tauri::async_runtime::block_on(async {
            let estado: tauri::State<'_, AppState> = app.state();
            let pool = estado.pool().await.unwrap();
            let processo_id: String = sqlx::query_scalar(
                "INSERT INTO processos_procedimentos
                     (apuratorio_id, documento_iniciador_id, numero_documento,
                      unidade_origem_id, municipio_fato_id, natureza_fato_id, data_instauracao)
                 VALUES ((SELECT apuratorio_id FROM apuratorio_papeis ORDER BY apuratorio_id LIMIT 1),
                         (SELECT tipo_documento_id FROM apuratorio_documentos_iniciadores ORDER BY tipo_documento_id LIMIT 1),
                         'IPC-SUBST-001',
                         (SELECT id FROM unidades_pm ORDER BY id LIMIT 1),
                         (SELECT id FROM municipios_distritos ORDER BY id LIMIT 1),
                         (SELECT id FROM naturezas_fato ORDER BY id LIMIT 1),
                         $1)
              RETURNING id::text",
            )
            .bind(NaiveDate::from_ymd_opt(2026, 1, 10).unwrap())
            .fetch_one(&pool)
            .await
            .unwrap();

            let inicial_id: String = sqlx::query_scalar(
                "INSERT INTO processo_designacoes
                     (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
                 SELECT p.id, p.apuratorio_id,
                        (SELECT id FROM policiais_militares ORDER BY matricula LIMIT 1),
                        (SELECT papel_id FROM apuratorio_papeis
                          WHERE apuratorio_id = p.apuratorio_id AND e_responsavel LIMIT 1),
                        p.data_instauracao
                   FROM processos_procedimentos p WHERE p.id = $1::uuid
              RETURNING id::text",
            )
            .bind(&processo_id)
            .fetch_one(&pool)
            .await
            .unwrap();
            (processo_id, inicial_id)
        });

        let sucessor: String = tauri::async_runtime::block_on(async {
            let estado: tauri::State<'_, AppState> = app.state();
            let pool = estado.pool().await.unwrap();
            sqlx::query_scalar(
                "SELECT id::text FROM policiais_militares ORDER BY matricula OFFSET 1 LIMIT 1",
            )
            .fetch_one(&pool)
            .await
            .unwrap()
        });

        let criada = ok(&invocar(
            &webview,
            "proceedings_substitute_designation",
            json!({ "request": {
                "processo_id": processo_id,
                "designacao_id": inicial_id,
                "sucessor_id": sucessor,
                "data_troca": "2026-02-01",
                "motivo": "ferias do titular"
            } }),
        ))
        .as_str()
        .expect("id da designacao criada")
        .to_string();

        // O detalhe já devolve o vínculo e a matrícula que a tela desenha.
        let detalhe = invocar(&webview, "proceedings_get", json!({ "id": processo_id }));
        let designacoes = ok(&detalhe)["designacoes"].as_array().unwrap().clone();
        assert_eq!(designacoes.len(), 2);
        let nova = designacoes
            .iter()
            .find(|d| d["id"] == json!(criada))
            .unwrap();
        assert_eq!(nova["designacao_anterior_id"], json!(inicial_id));
        assert!(
            nova["matricula"].is_string(),
            "a matricula acompanha: {nova}"
        );
        assert!(nova["documento_autorizador_id"].is_null());

        // Corrigir: `motivo` obrigatório também aqui.
        let falha = invocar(
            &webview,
            "proceedings_update_substitution",
            json!({ "request": {
                "processo_id": processo_id,
                "designacao_id": criada,
                "sucessor_id": sucessor,
                "data_troca": "2026-02-10",
                "motivo": "  "
            } }),
        );
        assert!(erro(&falha).contains("Informe o motivo"), "{falha}");

        assert_eq!(
            ok(&invocar(
                &webview,
                "proceedings_update_substitution",
                json!({ "request": {
                    "processo_id": processo_id,
                    "designacao_id": criada,
                    "sucessor_id": sucessor,
                    "data_troca": "2026-02-10",
                    "motivo": "correcao da data"
                } }),
            )),
            &json!(true)
        );

        assert_eq!(
            ok(&invocar(
                &webview,
                "proceedings_delete_substitution",
                json!({ "processoId": processo_id, "designacaoId": criada }),
            )),
            &json!(true)
        );

        let designacoes = ok(&invocar(
            &webview,
            "proceedings_get",
            json!({ "id": processo_id }),
        ))["designacoes"]
            .as_array()
            .unwrap()
            .clone();
        assert_eq!(designacoes.len(), 1, "desfazer apaga a sucessora");
        assert!(
            designacoes[0]["data_fim"].is_null(),
            "a antecessora reabriu"
        );

        // A trilha registra as duas linhas em cada operação: a sucessora com a
        // operação própria, a antecessora sempre como UPDATE.
        let (da_sucessora, da_antecessora): (Vec<String>, Vec<String>) =
            tauri::async_runtime::block_on(async {
                let estado: tauri::State<'_, AppState> = app.state();
                let pool = estado.pool().await.unwrap();
                let consulta = |registro: String| {
                    let pool = pool.clone();
                    async move {
                        sqlx::query_scalar::<_, String>(
                            "SELECT operacao FROM auditoria
                              WHERE entidade = 'processo_designacoes' AND registro_id = $1
                              ORDER BY ocorrido_em",
                        )
                        .bind(registro)
                        .fetch_all(&pool)
                        .await
                        .unwrap()
                    }
                };
                (
                    consulta(criada.clone()).await,
                    consulta(inicial_id.clone()).await,
                )
            });
        assert_eq!(da_sucessora, vec!["CREATE", "UPDATE", "DELETE"]);
        assert_eq!(
            da_antecessora,
            vec!["UPDATE", "UPDATE", "UPDATE"],
            "a antecessora e alterada nas tres operacoes"
        );
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

        // O nome completo alimenta os seletores; a sigla fica disponível para
        // o título compacto do detalhe do usuário.
        for campo in [
            "id",
            "nome",
            "matricula",
            "posto_graduacao",
            "posto_graduacao_sigla",
            "ativo",
        ] {
            assert!(
                itens[0].get(campo).is_some(),
                "UserListItem sem '{campo}' — o seletor monta o rótulo com ele"
            );
        }
    });
}

/// As três listagens paginadas, pelo IPC de verdade.
///
/// Duas convenções se cruzam aqui, e errar qualquer uma **falha em silêncio**:
///
///   - o argumento do comando é **camelCase** (`perPage`). Em snake_case o
///     Tauri simplesmente ignora, o `Option` vira `None` e a tela recebe o
///     padrão achando que mandou o que pediu;
///   - os campos **dentro** do envelope e do `filter` seguem **snake_case**,
///     porque ali quem desserializa é o serde.
///
/// Cada um dos três já apareceu quebrado na tela por causa disso: a paginação
/// de usuários mandava `per_page` e nunca paginou (§5.6), e os três filtros da
/// auditoria mandavam nomes que o comando não recebe.
#[test]
fn listagens_paginadas_falam_a_mesma_lingua_pelo_ipc() {
    com_app_e_banco("ipc_paginacao", |app, webview, conta| {
        autenticar(&app, &conta, true);

        // Auditoria: `page`/`perPage` como argumentos de comando.
        let dados = ok(&invocar(
            &webview,
            "audit_list",
            json!({ "page": 1, "perPage": 5 }),
        ))
        .clone();
        for campo in ["items", "total", "page", "per_page"] {
            assert!(
                dados.get(campo).is_some(),
                "AuditPageResult sem '{campo}' — o rodape da tela monta o intervalo com ele"
            );
        }
        assert_eq!(dados["page"], json!(1));
        assert_eq!(dados["per_page"], json!(5));

        // Prazos: aqui a paginação vai **dentro** do `filter`, então volta a
        // ser snake_case. É a metade da armadilha que mais confunde.
        let dados = ok(&invocar(
            &webview,
            "deadlines_report",
            json!({ "filter": { "apenas_vencidos": true, "page": 1, "per_page": 5 } }),
        ))
        .clone();
        assert!(dados["items"].is_array());
        assert_eq!(dados["per_page"], json!(5));

        // Mapas salvos: argumento de comando outra vez.
        let dados = ok(&invocar(
            &webview,
            "reports_saved_maps",
            json!({ "page": 1, "perPage": 5 }),
        ))
        .clone();
        assert!(dados["items"].is_array());
        assert_eq!(dados["per_page"], json!(5));

        // Sem tamanho explícito, o padrão é o mesmo das telas: dez.
        let dados = ok(&invocar(&webview, "audit_list", json!({}))).clone();
        assert_eq!(
            dados["per_page"],
            json!(10),
            "o padrao do backend acompanha o da tela"
        );

        // E o teto corta o pedido em vez de servi-lo — mas conta que cortou.
        let dados = ok(&invocar(
            &webview,
            "audit_list",
            json!({ "page": 1, "perPage": 5000 }),
        ))
        .clone();
        assert_eq!(dados["per_page"], json!(200), "o envelope conta o teto");
    });
}
