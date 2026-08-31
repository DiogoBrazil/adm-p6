//! Trilha de auditoria.
//!
//! O que este arquivo trava: o autor de uma operação é uma **conta**
//! (`usuarios`), não um policial militar — a conta técnica do seed não tem
//! militar vinculado, e mesmo assim precisa aparecer identificada. E o diff em
//! `alteracoes` é um dos dois únicos JSONB justificados do schema: existe
//! porque, agora que o comportamento do sistema é configurável, importa saber
//! quem baixou o prazo base de um apuratório.

use adm_p6_tauri_lib::audit::domain::AuditStatisticsFilter;
use adm_p6_tauri_lib::audit::repository::{self, Acao};
use adm_p6_tauri_lib::db::paginacao::Recorte;
use chrono::NaiveDate;
use serde_json::json;
use sqlx::PgPool;

mod util;
use util::fixtures::{self, conta_admin};

/// Registra uma operação. `dias` desloca a data, para exercitar o período.
async fn registrar(
    pool: &PgPool,
    entidade: &str,
    registro_id: &str,
    operacao: &str,
    autor: Option<&str>,
    dias_atras: i64,
) {
    let mut tx = pool.begin().await.unwrap();
    repository::registrar(
        &mut tx,
        Acao {
            entidade,
            registro_id,
            operacao,
            acao: "Registrou algo",
            assunto: Some("Assunto de teste".to_string()),
            alteracoes: None,
        },
        autor,
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();

    if dias_atras != 0 {
        sqlx::query(
            "UPDATE auditoria SET ocorrido_em = now() - ($1 || ' days')::interval
              WHERE id = (SELECT id FROM auditoria ORDER BY ocorrido_em DESC LIMIT 1)",
        )
        .bind(dias_atras.to_string())
        .execute(pool)
        .await
        .unwrap();
    }
}

/// O nome do autor sai da conta. A conta técnica não tem policial militar
/// vinculado — `policial_militar_id` é opcional justamente para isso — e ainda
/// assim não pode aparecer como "—".
#[tokio::test]
async fn o_autor_e_a_conta_e_a_conta_tecnica_nao_inventa_militar() {
    util::com_banco_descartavel("aud_autor", |pool| async move {
        let autor = conta_admin(&pool).await;
        registrar(&pool, "apuratorios", "reg-1", "UPDATE", Some(&autor), 0).await;

        let itens = repository::list(&pool, Recorte::novo(None, Some(50)), None, None, None)
            .await
            .unwrap()
            .items;
        assert_eq!(itens.len(), 1);
        assert_eq!(itens[0].usuario_id.as_deref(), Some(autor.as_str()));
        assert_eq!(
            itens[0].usuario_nome.as_deref(),
            Some("ADMINISTRADOR DO SISTEMA")
        );
        assert!(itens[0].usuario_posto.is_none(), "sem militar, sem posto");
        assert!(
            itens[0].usuario_matricula.is_none(),
            "sem militar, sem matricula"
        );
        assert!(
            itens[0].alteracoes.is_none(),
            "registro simples nao tem diff"
        );
    })
    .await;
}

/// Quando há militar vinculado, o nome e o posto vêm dele.
#[tokio::test]
async fn autor_com_militar_vinculado_traz_nome_e_posto() {
    util::com_banco_descartavel("aud_militar", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let perfil: String = sqlx::query_scalar("SELECT id::text FROM perfis_acesso LIMIT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        let conta: String = sqlx::query_scalar(
            "INSERT INTO usuarios (policial_militar_id, nome_exibicao, email, senha_hash, perfil_id)
             VALUES ($1::uuid, NULL, 'operador@teste.com', 'x', $2::uuid)
          RETURNING id::text",
        )
        .bind(&m.pm_um)
        .bind(&perfil)
        .fetch_one(&pool)
        .await
        .unwrap();

        registrar(
            &pool,
            "processos_procedimentos",
            "p-1",
            "CREATE",
            Some(&conta),
            0,
        )
        .await;

        let itens = repository::list(&pool, Recorte::novo(None, Some(50)), None, None, None)
            .await
            .unwrap()
            .items;
        assert_eq!(itens[0].usuario_nome.as_deref(), Some("PM UM"));
        assert_eq!(itens[0].usuario_posto.as_deref(), Some("TST PM"));
        assert_eq!(itens[0].usuario_matricula.as_deref(), Some("100000001"));
    })
    .await;
}

/// O diff só é gravado onde importa: mudanças de configuração, que alteram o
/// comportamento futuro do sistema.
#[tokio::test]
async fn o_diff_registra_o_que_mudou_na_configuracao() {
    util::com_banco_descartavel("aud_diff", |pool| async move {
        let autor = conta_admin(&pool).await;
        let diff = json!({ "prazo_base_dias": { "de": 40, "para": 30 } });

        let mut tx = pool.begin().await.unwrap();
        repository::registrar(
            &mut tx,
            Acao {
                entidade: "apuratorios",
                registro_id: "ap-1",
                operacao: "UPDATE",
                acao: "Alterou um item de apuratórios",
                assunto: Some("IPM - Inquérito Policial Militar".to_string()),
                alteracoes: Some(diff.clone()),
            },
            Some(&autor),
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let itens = repository::list(&pool, Recorte::novo(None, Some(50)), None, None, None)
            .await
            .unwrap()
            .items;
        assert_eq!(itens[0].alteracoes.as_ref(), Some(&diff));

        let detalhe = repository::get_by_id(&pool, &itens[0].id).await.unwrap();
        assert_eq!(detalhe.unwrap().alteracoes.as_ref(), Some(&diff));
        assert!(repository::get_by_id(&pool, &uuid_inexistente())
            .await
            .unwrap()
            .is_none());
    })
    .await;
}

fn uuid_inexistente() -> String {
    "00000000-0000-4000-8000-000000000000".to_string()
}

/// Os três filtros da listagem recortam de forma independente e combinada. É o
/// que a tela de auditoria oferece, e o que ela mandava com os nomes errados.
#[tokio::test]
async fn a_listagem_aplica_cada_filtro() {
    util::com_banco_descartavel("aud_filtros", |pool| async move {
        let autor = conta_admin(&pool).await;
        registrar(&pool, "apuratorios", "a-1", "CREATE", Some(&autor), 0).await;
        registrar(&pool, "apuratorios", "a-1", "UPDATE", Some(&autor), 0).await;
        registrar(
            &pool,
            "processos_procedimentos",
            "p-1",
            "CREATE",
            Some(&autor),
            0,
        )
        .await;
        registrar(&pool, "processos_procedimentos", "p-2", "DELETE", None, 0).await;

        let contar = |entidade, operacao, usuario| {
            let pool = pool.clone();
            async move {
                repository::list(
                    &pool,
                    Recorte::novo(None, Some(50)),
                    entidade,
                    operacao,
                    usuario,
                )
                .await
                .unwrap()
                .items
                .len()
            }
        };

        assert_eq!(contar(None, None, None).await, 4);
        assert_eq!(contar(Some("apuratorios"), None, None).await, 2);
        assert_eq!(contar(None, Some("CREATE"), None).await, 2);
        assert_eq!(contar(Some("apuratorios"), Some("CREATE"), None).await, 1);
        assert_eq!(contar(None, None, Some(autor.as_str())).await, 3);
        // Entidade que não existe devolve vazio, não tudo.
        assert_eq!(contar(Some("inexistente"), None, None).await, 0);
    })
    .await;
}

/// A paginação devolve o total do escopo, não o tamanho da página — sem isso a
/// tela não sabe se há mais.
#[tokio::test]
async fn por_usuario_devolve_pagina_e_total() {
    util::com_banco_descartavel("aud_pagina", |pool| async move {
        let autor = conta_admin(&pool).await;
        for i in 0..5 {
            registrar(
                &pool,
                "apuratorios",
                &format!("a-{i}"),
                "UPDATE",
                Some(&autor),
                i,
            )
            .await;
        }

        let pagina = repository::list_by_user(&pool, &autor, Recorte::novo(Some(1), Some(2)))
            .await
            .unwrap();
        assert_eq!(pagina.items.len(), 2);
        assert_eq!(pagina.total, 5, "o total e do escopo, nao da pagina");

        let segunda = repository::list_by_user(&pool, &autor, Recorte::novo(Some(2), Some(2)))
            .await
            .unwrap();
        assert_eq!(segunda.items.len(), 2);
        assert_ne!(segunda.items[0].id, pagina.items[0].id);

        // Mais recente primeiro: o registro de hoje (dias_atras = 0) encabeça.
        assert_eq!(pagina.items[0].registro_id, "a-0");
    })
    .await;
}

/// O histórico de um registro específico — é como se responde "o que já
/// aconteceu com este processo".
#[tokio::test]
async fn historico_de_um_registro_isola_a_entidade() {
    util::com_banco_descartavel("aud_registro", |pool| async move {
        let autor = conta_admin(&pool).await;
        registrar(&pool, "apuratorios", "mesmo-id", "CREATE", Some(&autor), 2).await;
        registrar(&pool, "apuratorios", "mesmo-id", "UPDATE", Some(&autor), 0).await;
        // Mesmo `registro_id`, outra entidade: não pode se misturar.
        registrar(
            &pool,
            "processos_procedimentos",
            "mesmo-id",
            "CREATE",
            Some(&autor),
            0,
        )
        .await;

        let historico = repository::list_by_record(&pool, "apuratorios", "mesmo-id")
            .await
            .unwrap();
        assert_eq!(historico.len(), 2);
        assert_eq!(historico[0].operacao, "UPDATE", "mais recente primeiro");
        assert_eq!(historico[1].operacao, "CREATE");
    })
    .await;
}

/// As estatísticas alimentam o filtro de entidade da tela, e respeitam o
/// período.
#[tokio::test]
async fn estatisticas_agrupam_e_respeitam_o_periodo() {
    util::com_banco_descartavel("aud_stats", |pool| async move {
        let autor = conta_admin(&pool).await;
        registrar(&pool, "apuratorios", "a-1", "CREATE", Some(&autor), 0).await;
        registrar(&pool, "apuratorios", "a-2", "CREATE", Some(&autor), 0).await;
        registrar(
            &pool,
            "processos_procedimentos",
            "p-1",
            "UPDATE",
            Some(&autor),
            0,
        )
        .await;
        // Antigo: fora de qualquer janela recente.
        registrar(&pool, "usuarios", "u-1", "DELETE", Some(&autor), 40).await;

        let tudo = repository::statistics(&pool, &AuditStatisticsFilter::default())
            .await
            .unwrap();
        assert_eq!(tudo.total, 4);
        let apuratorios = tudo
            .por_entidade
            .iter()
            .find(|e| e.entidade == "apuratorios")
            .unwrap();
        assert_eq!(apuratorios.total, 2);
        assert_eq!(
            tudo.por_operacao[0].operacao, "CREATE",
            "ordena pela contagem"
        );

        let hoje = chrono::Utc::now().date_naive();
        let recente = repository::statistics(
            &pool,
            &AuditStatisticsFilter {
                data_inicio: Some(hoje - chrono::Duration::days(7)),
                data_fim: None,
            },
        )
        .await
        .unwrap();
        assert_eq!(recente.total, 3, "o de 40 dias atras fica de fora");
        assert!(!recente
            .por_entidade
            .iter()
            .any(|e| e.entidade == "usuarios"));

        // Janela que não alcança nada devolve zero, não erro.
        let vazio = repository::statistics(
            &pool,
            &AuditStatisticsFilter {
                data_inicio: Some(NaiveDate::from_ymd_opt(2000, 1, 1).unwrap()),
                data_fim: Some(NaiveDate::from_ymd_opt(2000, 12, 31).unwrap()),
            },
        )
        .await
        .unwrap();
        assert_eq!(vazio.total, 0);
        assert!(vazio.por_operacao.is_empty());
    })
    .await;
}

/// A listagem principal pagina, preserva os filtros e não repete linha.
///
/// Antes ela recebia `limit`/`offset` **sem teto** e devolvia um `Vec` sem
/// total: a tela anunciava "últimos 200 registros" porque era tudo que podia
/// saber — não havia como descobrir que existia um 201º nem como alcançá-lo.
/// Monta mais registros que o teto de propósito: com a fixture crua o clamp
/// nunca é exercido e o teste passaria sem provar nada.
#[tokio::test]
async fn lista_pagina_preservando_filtros() {
    util::com_banco_descartavel("aud_lista_pagina", |pool| async move {
        let autor = conta_admin(&pool).await;
        const QUANTOS: i64 = 205;

        for i in 0..QUANTOS {
            // Metade em cada entidade, para que o filtro recorte de verdade.
            let entidade = if i % 2 == 0 {
                "apuratorios"
            } else {
                "processos_procedimentos"
            };
            registrar(
                &pool,
                entidade,
                &format!("r-{i}"),
                "UPDATE",
                Some(&autor),
                i,
            )
            .await;
        }

        // Acima do teto o pedido é corrigido, e o envelope conta que foi.
        let demais = repository::list(&pool, Recorte::novo(Some(1), Some(500)), None, None, None)
            .await
            .unwrap();
        assert_eq!(demais.items.len(), 200, "o teto corta");
        assert_eq!(demais.per_page, 200, "e o envelope conta que cortou");
        assert_eq!(demais.total, QUANTOS, "o total e do escopo, nao da pagina");

        // O total acompanha o filtro: senão o rodapé conta um escopo que a
        // tabela não mostra, e ninguem percebe.
        let filtrada = repository::list(
            &pool,
            Recorte::novo(Some(1), Some(10)),
            Some("apuratorios"),
            None,
            None,
        )
        .await
        .unwrap();
        assert_eq!(filtrada.total, QUANTOS / 2 + QUANTOS % 2);
        assert!(filtrada.items.iter().all(|i| i.entidade == "apuratorios"));

        let primeira = repository::list(&pool, Recorte::novo(Some(1), Some(3)), None, None, None)
            .await
            .unwrap();
        let segunda = repository::list(&pool, Recorte::novo(Some(2), Some(3)), None, None, None)
            .await
            .unwrap();
        assert_eq!(segunda.page, 2);
        for item in &primeira.items {
            assert!(
                !segunda.items.iter().any(|s| s.id == item.id),
                "a mesma linha caiu em duas paginas"
            );
        }

        // Mais recente primeiro, e a ordem é estável entre as páginas.
        assert_eq!(primeira.items[0].registro_id, "r-0");
        assert!(primeira.items.last().unwrap().ocorrido_em >= segunda.items[0].ocorrido_em);

        // Página além do fim é vazia, não erro.
        let longe = repository::list(&pool, Recorte::novo(Some(999), Some(10)), None, None, None)
            .await
            .unwrap();
        assert!(longe.items.is_empty());
        assert_eq!(longe.total, QUANTOS);
    })
    .await;
}

/// O assunto sobrevive à exclusão física da linha que ele nomeia.
///
/// É a razão de ele ser gravado no momento da ação em vez de resolvido na
/// leitura. `processo_prazos` e `processo_designacoes` são `DELETE FROM`, e na
/// trilha antiga 7 dos 8 prazos já tinham virado UUID órfão: a exclusão, que é
/// o que mais importa auditar, era justamente o que não se conseguia mais ler.
#[tokio::test]
async fn o_assunto_continua_legivel_depois_de_a_linha_ser_apagada() {
    util::com_banco_descartavel("aud_apagado", |pool| async move {
        let autor = conta_admin(&pool).await;
        let m = fixtures::mundo_configurado(&pool).await;
        let processo = fixtures::processo(
            &pool,
            &m,
            &m.apuratorio,
            "001",
            NaiveDate::from_ymd_opt(2026, 1, 10).unwrap(),
            None,
        )
        .await;

        // Uma linha filha do apuratório, com id próprio.
        let prazo: String = sqlx::query_scalar(
            "INSERT INTO processo_prazos (processo_id, ordem, data_inicio, dias)
             VALUES ($1::uuid, 0, DATE '2026-01-10', 30) RETURNING id::text",
        )
        .bind(&processo)
        .fetch_one(&pool)
        .await
        .unwrap();

        // O assunto é lido ANTES da exclusão, que é a ordem que
        // `audit::assunto` documenta e os comandos seguem.
        let mut tx = pool.begin().await.unwrap();
        let assunto = adm_p6_tauri_lib::audit::assunto::de_prazo(&mut tx, &prazo).await;
        assert!(assunto.is_some(), "o prazo ainda existe, então tem rótulo");
        sqlx::query("DELETE FROM processo_prazos WHERE id = $1::uuid")
            .bind(&prazo)
            .execute(&mut *tx)
            .await
            .unwrap();
        repository::registrar(
            &mut tx,
            Acao {
                entidade: "processo_prazos",
                registro_id: &prazo,
                operacao: "DELETE",
                acao: "Removeu uma prorrogação de prazo",
                assunto,
                alteracoes: None,
            },
            Some(&autor),
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        // A linha não existe mais, e mesmo assim a trilha diz de qual apuratório
        // se tratava. Resolvendo na leitura, aqui não haveria o que mostrar.
        let vazio: Option<String> =
            sqlx::query_scalar("SELECT id::text FROM processo_prazos WHERE id = $1::uuid")
                .bind(&prazo)
                .fetch_optional(&pool)
                .await
                .unwrap();
        assert!(vazio.is_none());

        let itens = repository::list(&pool, Recorte::novo(None, Some(50)), None, None, None)
            .await
            .unwrap()
            .items;
        let linha = itens
            .iter()
            .find(|i| i.registro_id == prazo)
            .expect("a trilha registrou a exclusão");
        assert_eq!(
            linha.acao.as_deref(),
            Some("Removeu uma prorrogação de prazo")
        );
        assert!(
            linha
                .assunto
                .as_deref()
                .unwrap()
                .starts_with("TST-A nº 001/2026/"),
            "o apuratório continua nomeado: {:?}",
            linha.assunto
        );
    })
    .await;
}

/// Registro anterior à `0018` continua listável, só que sem as duas frases.
///
/// A tela cobre o `None` com uma reserva; o que não pode é a listagem quebrar
/// por causa de linha antiga — são 74 delas no banco de produção.
#[tokio::test]
async fn registro_sem_acao_nem_assunto_continua_na_listagem() {
    util::com_banco_descartavel("aud_legado", |pool| async move {
        let autor = conta_admin(&pool).await;
        sqlx::query(
            "INSERT INTO auditoria (entidade, registro_id, operacao, usuario_id)
             VALUES ('processos_procedimentos', 'antigo-1', 'UPDATE', $1::uuid)",
        )
        .bind(&autor)
        .execute(&pool)
        .await
        .unwrap();

        let itens = repository::list(&pool, Recorte::novo(None, Some(50)), None, None, None)
            .await
            .unwrap()
            .items;
        assert_eq!(itens.len(), 1);
        assert!(itens[0].acao.is_none());
        assert!(itens[0].assunto.is_none());
    })
    .await;
}
