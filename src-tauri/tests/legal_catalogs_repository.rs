//! CRUD genérico dos 26 catálogos.
//!
//! Este módulo monta SQL com **nome de tabela e de coluna interpolados**. Isso
//! só é seguro porque esses nomes vêm sempre do registro `domain::CATALOGOS`,
//! nunca da requisição — o que o usuário manda são apenas VALORES, sempre
//! ligados como parâmetro. É a invariante que este arquivo existe para travar:
//! se algum dia um nome de coluna passar a vir de fora, é aqui que se vê.
//!
//! Os sete comandos genéricos substituíram 68 específicos e ~2.800 linhas de
//! CRUD repetido, então um defeito aqui não afeta uma tela: afeta 26.

use adm_p6_tauri_lib::legal_catalogs::domain::{catalogo, TipoColuna, CATALOGOS};
use adm_p6_tauri_lib::legal_catalogs::repository;
use serde_json::{json, Map, Value};
use sqlx::PgPool;

mod util;
use util::fixtures;

fn valores(pares: Value) -> Map<String, Value> {
    pares.as_object().expect("objeto").clone()
}

async fn gravar(pool: &PgPool, chave: &str, id: Option<&str>, pares: Value) -> String {
    let cat = catalogo(chave).expect("catalogo registrado");
    let mut tx = pool.begin().await.unwrap();
    let novo = repository::save(&mut tx, cat, id, &valores(pares))
        .await
        .unwrap();
    tx.commit().await.unwrap();
    novo
}

// ── O registro ───────────────────────────────────────────────────────────────

/// O registro é a fonte de tudo: a tela de catálogos é montada dele, e o SQL
/// também. Um catálogo cuja tabela não existe passaria despercebido até alguém
/// abrir a tela.
#[tokio::test]
async fn todo_catalogo_do_registro_existe_no_banco() {
    util::com_banco_descartavel("cat_registro", |pool| async move {
        assert_eq!(CATALOGOS.len(), 26, "o guia fala em 26 catalogos");

        for cat in CATALOGOS {
            // `list` monta o SELECT com todas as colunas declaradas: se alguma
            // não existir na tabela, o erro aparece aqui.
            repository::list(&pool, cat, true)
                .await
                .unwrap_or_else(|e| panic!("catalogo '{}' nao le: {e}", cat.chave));

            assert!(
                !cat.colunas.is_empty(),
                "catalogo '{}' sem coluna nenhuma",
                cat.chave
            );
            // Toda referência aponta para um catálogo que existe — é o que
            // permite a tela montar o `<select>` sozinha.
            for coluna in cat.colunas {
                if matches!(
                    coluna.tipo,
                    TipoColuna::Referencia | TipoColuna::ReferenciaOpcional
                ) {
                    let alvo = coluna.alvo.unwrap_or_else(|| {
                        panic!("{}.{} e referencia sem alvo", cat.chave, coluna.nome)
                    });
                    assert!(
                        catalogo(alvo).is_some(),
                        "{}.{} aponta para '{alvo}', que nao esta no registro",
                        cat.chave,
                        coluna.nome
                    );
                }
            }
        }
    })
    .await;
}

// ── Leitura ──────────────────────────────────────────────────────────────────

/// `incluir_inativos` separa os dois usos: o formulário mostra só o ativo, a
/// tela de administração precisa ver tudo para poder reativar.
#[tokio::test]
async fn listagem_separa_opcoes_de_administracao() {
    util::com_banco_descartavel("cat_ativo", |pool| async move {
        let id = gravar(
            &pool,
            "tipos_documento",
            None,
            json!({ "nome": "Ofício Teste" }),
        )
        .await;

        let cat = catalogo("tipos_documento").unwrap();
        let mut tx = pool.begin().await.unwrap();
        repository::set_ativo(&mut tx, cat, &id, false)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let opcoes = repository::list(&pool, cat, false).await.unwrap();
        assert!(
            !opcoes.iter().any(|l| l["id"] == json!(id)),
            "some das opcoes"
        );

        let administracao = repository::list(&pool, cat, true).await.unwrap();
        let linha = administracao
            .iter()
            .find(|l| l["id"] == json!(id))
            .expect("continua na administracao, para poder ser reativado");
        assert_eq!(linha["ativo"], json!(false));

        // E reativar traz de volta.
        let mut tx = pool.begin().await.unwrap();
        repository::set_ativo(&mut tx, cat, &id, true)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        assert!(repository::list(&pool, cat, false)
            .await
            .unwrap()
            .iter()
            .any(|l| l["id"] == json!(id)));
    })
    .await;
}

/// Cada tipo de coluna é lido com o tipo que declara — booleano vira `true`,
/// inteiro vira número, e o opcional vazio vira `null`, não `""`.
#[tokio::test]
async fn cada_tipo_de_coluna_e_lido_como_o_que_declara() {
    util::com_banco_descartavel("cat_tipos", |pool| async move {
        let tipo = gravar(
            &pool,
            "tipos_apuratorio",
            None,
            json!({ "nome": "Espécie Teste" }),
        )
        .await;
        let id = gravar(
            &pool,
            "apuratorios",
            None,
            json!({
                "sigla": "TST-Z",
                "nome": "Apuratório de Teste",
                "tipo_apuratorio_id": tipo,
                "prazo_base_dias": 45,
                "max_envolvidos": Value::Null,
                "exige_natureza_fato": true,
                "codigo_extensao": "  ",
            }),
        )
        .await;

        let cat = catalogo("apuratorios").unwrap();
        let linha = repository::get(&pool, cat, &id).await.unwrap().unwrap();
        assert_eq!(linha["sigla"], json!("TST-Z"));
        assert_eq!(linha["prazo_base_dias"], json!(45));
        assert_eq!(linha["exige_natureza_fato"], json!(true));
        assert_eq!(
            linha["max_envolvidos"],
            Value::Null,
            "opcional vazio e null"
        );
        assert_eq!(
            linha["codigo_extensao"],
            Value::Null,
            "texto opcional so com espacos vira null, nao string vazia"
        );
        assert_eq!(
            linha["tipo_apuratorio_id"],
            json!(tipo),
            "referencia sai como texto"
        );
    })
    .await;
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/// Gravar com `id` atualiza, sem `id` insere. É o mesmo comando para os dois.
#[tokio::test]
async fn gravar_insere_sem_id_e_atualiza_com_id() {
    util::com_banco_descartavel("cat_upsert", |pool| async move {
        let cat = catalogo("naturezas_fato").unwrap();
        let id = gravar(
            &pool,
            "naturezas_fato",
            None,
            json!({ "nome": "Rubrica Teste", "exige_condutor": false }),
        )
        .await;

        let mesmo = gravar(
            &pool,
            "naturezas_fato",
            Some(&id),
            json!({ "nome": "Rubrica Renomeada", "exige_condutor": true }),
        )
        .await;
        assert_eq!(mesmo, id, "atualizar devolve o mesmo id");

        let linha = repository::get(&pool, cat, &id).await.unwrap().unwrap();
        assert_eq!(linha["nome"], json!("Rubrica Renomeada"));
        assert_eq!(linha["exige_condutor"], json!(true));
        assert_eq!(repository::list(&pool, cat, true).await.unwrap().len(), 1);
    })
    .await;
}

/// Campo obrigatório em branco é recusado com o RÓTULO da coluna, não com o
/// nome físico — a mensagem vai para a tela.
#[tokio::test]
async fn campo_obrigatorio_e_recusado_com_mensagem_legivel() {
    util::com_banco_descartavel("cat_obrigatorio", |pool| async move {
        let cat = catalogo("tipos_documento").unwrap();

        for pares in [
            json!({}),
            json!({ "nome": "   " }),
            json!({ "nome": Value::Null }),
        ] {
            let mut tx = pool.begin().await.unwrap();
            let erro = repository::save(&mut tx, cat, None, &valores(pares))
                .await
                .expect_err("nome vazio tem de ser recusado");
            assert!(erro.message().contains("Nome"), "usa o rotulo: {erro}");
        }

        // Inteiro obrigatório com texto no lugar do número também é recusado.
        let tipo = gravar(
            &pool,
            "tipos_apuratorio",
            None,
            json!({ "nome": "Espécie Teste" }),
        )
        .await;
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::save(
            &mut tx,
            catalogo("apuratorios").unwrap(),
            None,
            &valores(json!({
                "sigla": "TST-Y", "nome": "X", "tipo_apuratorio_id": tipo,
                "prazo_base_dias": "quarenta", "exige_natureza_fato": false,
            })),
        )
        .await
        .expect_err("prazo textual tem de ser recusado");
        assert!(erro.message().contains("numerico"), "{erro}");
    })
    .await;
}

/// Atualizar id inexistente é erro de negócio legível, não silêncio.
#[tokio::test]
async fn atualizar_registro_inexistente_e_recusado() {
    util::com_banco_descartavel("cat_inexistente", |pool| async move {
        let cat = catalogo("tipos_documento").unwrap();
        let fantasma = "00000000-0000-4000-8000-000000000000";

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::save(
            &mut tx,
            cat,
            Some(fantasma),
            &valores(json!({ "nome": "X" })),
        )
        .await
        .expect_err("id inexistente");
        assert!(erro.message().contains("nao encontrado"), "{erro}");
        drop(tx);

        let mut tx = pool.begin().await.unwrap();
        assert!(repository::set_ativo(&mut tx, cat, fantasma, false)
            .await
            .is_err());
        drop(tx);

        let mut tx = pool.begin().await.unwrap();
        assert!(repository::delete(&mut tx, cat, fantasma).await.is_err());
    })
    .await;
}

/// Catálogo em uso se DESATIVA; não se apaga. As FKs são `ON DELETE RESTRICT`,
/// e a mensagem tem de dizer o que fazer em vez de vazar a violação crua.
#[tokio::test]
async fn item_em_uso_nao_e_apagado_e_a_mensagem_orienta() {
    util::com_banco_descartavel("cat_em_uso", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let cat = catalogo("naturezas_fato").unwrap();

        // A natureza da fixture está referenciada por `apuratorio`? Ainda não —
        // é preciso um processo que a use.
        fixtures::processo(
            &pool,
            &m,
            &m.apuratorio,
            "001",
            chrono::NaiveDate::from_ymd_opt(2026, 2, 1).unwrap(),
            None,
        )
        .await;

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::delete(&mut tx, cat, &m.natureza)
            .await
            .expect_err("item em uso nao pode sumir");
        assert!(
            erro.message().contains("desative-o"),
            "a mensagem orienta em vez de vazar a FK: {erro}"
        );
        drop(tx);

        // Desativar, esse sim, é permitido — e não apaga o vínculo existente.
        let mut tx = pool.begin().await.unwrap();
        repository::set_ativo(&mut tx, cat, &m.natureza, false)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let ainda_la: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM processos_procedimentos WHERE natureza_fato_id = $1::uuid",
        )
        .bind(&m.natureza)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(ainda_la, 1, "desativar nao reescreve fato ja registrado");
    })
    .await;
}

/// Item nunca referenciado pode ser removido de verdade — é o que permite
/// desfazer um cadastro errado recém-feito.
#[tokio::test]
async fn item_nunca_usado_pode_ser_apagado() {
    util::com_banco_descartavel("cat_apaga", |pool| async move {
        let cat = catalogo("tipos_documento").unwrap();
        let id = gravar(
            &pool,
            "tipos_documento",
            None,
            json!({ "nome": "Engano Teste" }),
        )
        .await;

        let mut tx = pool.begin().await.unwrap();
        repository::delete(&mut tx, cat, &id).await.unwrap();
        tx.commit().await.unwrap();

        assert!(repository::get(&pool, cat, &id).await.unwrap().is_none());
    })
    .await;
}

// ── Busca ────────────────────────────────────────────────────────────────────

/// A busca recebe o nome do campo do frontend, então valida contra o registro
/// antes de interpolar. Sem isto, o campo seria injeção de SQL.
#[tokio::test]
async fn busca_recusa_campo_fora_do_registro() {
    util::com_banco_descartavel("cat_busca", |pool| async move {
        let cat = catalogo("tipos_documento").unwrap();
        gravar(
            &pool,
            "tipos_documento",
            None,
            json!({ "nome": "Portaria Teste" }),
        )
        .await;
        let oculto = gravar(
            &pool,
            "tipos_documento",
            None,
            json!({ "nome": "Memorando Teste" }),
        )
        .await;

        let achados = repository::search(&pool, cat, "nome", "porta", 10)
            .await
            .unwrap();
        assert_eq!(achados.len(), 1);
        assert_eq!(achados[0]["nome"], json!("Portaria Teste"));

        // Desativado não aparece na busca: ela alimenta escolha, não leitura.
        let mut tx = pool.begin().await.unwrap();
        repository::set_ativo(&mut tx, cat, &oculto, false)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        assert!(repository::search(&pool, cat, "nome", "memo", 10)
            .await
            .unwrap()
            .is_empty());

        // Campo que não pertence ao catálogo é recusado — inclusive um que
        // exista na tabela, como `ativo`.
        for campo in ["ativo", "id", "nome; DROP TABLE tipos_documento"] {
            let erro = repository::search(&pool, cat, campo, "x", 10)
                .await
                .expect_err("campo fora do registro tem de ser recusado");
            assert!(erro.message().contains("nao pertence"), "{erro}");
        }

        // A tabela continua de pé.
        assert_eq!(repository::list(&pool, cat, true).await.unwrap().len(), 2);
    })
    .await;
}
