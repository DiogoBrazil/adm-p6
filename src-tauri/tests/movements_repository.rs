//! Andamentos do processo.
//!
//! Duas coisas justificam o arquivo. A primeira é o **autor**: o jsonb legado
//! guardava o nome do usuário em texto, a tabela que o substituiu perdeu a
//! informação, e aqui ela volta como FK — se ela sumir de novo, este teste
//! quebra. A segunda é o cancelamento: andamento é fato datado, então em vez de
//! um booleano genérico registra-se QUANDO foi cancelado.

use adm_p6_tauri_lib::movements::domain::{AddMovementRequest, UpdateMovementRequest};
use adm_p6_tauri_lib::movements::repository;
use chrono::{DateTime, TimeZone, Utc};
use sqlx::PgPool;

mod util;
use util::fixtures::{self, conta_admin, processo};

fn data(ano: i32, mes: u32, dia: u32) -> chrono::NaiveDate {
    chrono::NaiveDate::from_ymd_opt(ano, mes, dia).unwrap()
}

fn momento(ano: i32, mes: u32, dia: u32) -> DateTime<Utc> {
    Utc.with_ymd_and_hms(ano, mes, dia, 12, 0, 0).unwrap()
}

async fn processo_de_teste(pool: &PgPool, m: &fixtures::Mundo) -> String {
    processo(pool, m, &m.apuratorio, "001", data(2026, 2, 1), None).await
}

fn pedido(processo_id: &str, descricao: &str, tipo: Option<&str>) -> AddMovementRequest {
    AddMovementRequest {
        processo_id: processo_id.to_string(),
        descricao: descricao.to_string(),
        tipo_andamento_id: tipo.map(str::to_string),
        ocorrido_em: None,
    }
}

/// O andamento guarda quem o registrou. O autor é uma CONTA, não um policial
/// militar: só 7 dos 236 usuários do sistema legado tinham conta.
#[tokio::test]
async fn andamento_guarda_o_autor_e_o_tipo_do_catalogo() {
    util::com_banco_descartavel("mov_autor", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo_de_teste(&pool, &m).await;
        let autor = conta_admin(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        let id = repository::add(
            &mut tx,
            &pedido(&p, "Autos conclusos.", Some(&m.tipo_andamento)),
            &autor,
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let itens = repository::list(&pool, &p).await.unwrap();
        assert_eq!(itens.len(), 1);
        assert_eq!(itens[0].id, id);
        assert_eq!(itens[0].registrado_por_id.as_deref(), Some(autor.as_str()));
        assert_eq!(
            itens[0].registrado_por.as_deref(),
            Some("ADMINISTRADOR DO SISTEMA"),
            "o nome sai da conta quando nao ha militar vinculado"
        );
        assert_eq!(itens[0].tipo_andamento.as_deref(), Some("Despacho Teste"));
    })
    .await;
}

/// O tipo é opcional: um andamento pode ser só texto. Era uma lista de 11
/// literais no Rust, sem coluna correspondente.
#[tokio::test]
async fn tipo_do_andamento_e_opcional() {
    util::com_banco_descartavel("mov_sem_tipo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo_de_teste(&pool, &m).await;
        let autor = conta_admin(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        repository::add(&mut tx, &pedido(&p, "Anotação livre.", None), &autor)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let itens = repository::list(&pool, &p).await.unwrap();
        assert!(itens[0].tipo_andamento_id.is_none());
        assert!(itens[0].tipo_andamento.is_none());
    })
    .await;
}

/// Do mais recente para o mais antigo — é a ordem em que a Seção lê a
/// movimentação, e é dela que o mapa tira o "último andamento".
#[tokio::test]
async fn lista_do_mais_recente_para_o_mais_antigo() {
    util::com_banco_descartavel("mov_ordem", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo_de_teste(&pool, &m).await;
        let autor = conta_admin(&pool).await;

        for (dia, texto) in [(5, "primeiro"), (20, "terceiro"), (12, "segundo")] {
            let mut tx = pool.begin().await.unwrap();
            repository::add(
                &mut tx,
                &AddMovementRequest {
                    processo_id: p.clone(),
                    descricao: texto.to_string(),
                    tipo_andamento_id: None,
                    ocorrido_em: Some(momento(2026, 3, dia)),
                },
                &autor,
            )
            .await
            .unwrap();
            tx.commit().await.unwrap();
        }

        let itens = repository::list(&pool, &p).await.unwrap();
        let textos: Vec<&str> = itens.iter().map(|i| i.descricao.as_str()).collect();
        assert_eq!(textos, vec!["terceiro", "segundo", "primeiro"]);
    })
    .await;
}

/// Editar corrige somente o que o operador digitou. O momento e o autor
/// identificam o lançamento original e não podem ser reescritos pela correção.
#[tokio::test]
async fn edicao_corrige_tipo_e_descricao_sem_reescrever_autor_e_data() {
    util::com_banco_descartavel("mov_edita", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo_de_teste(&pool, &m).await;
        let autor = conta_admin(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        let id = repository::add(
            &mut tx,
            &pedido(&p, "Texto original.", Some(&m.tipo_andamento)),
            &autor,
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let original = repository::list(&pool, &p).await.unwrap().remove(0);
        let ocorrido_em = original.ocorrido_em;
        let registrado_por_id = original.registrado_por_id;

        let mut tx = pool.begin().await.unwrap();
        assert_eq!(
            repository::update(
                &mut tx,
                &UpdateMovementRequest {
                    processo_id: p.clone(),
                    andamento_id: id,
                    descricao: "  Texto corrigido.  ".to_string(),
                    tipo_andamento_id: None,
                },
            )
            .await
            .unwrap(),
            1
        );
        tx.commit().await.unwrap();

        let corrigido = repository::list(&pool, &p).await.unwrap().remove(0);
        assert_eq!(corrigido.descricao, "Texto corrigido.");
        assert!(
            corrigido.tipo_andamento_id.is_none(),
            "o tipo pode ser removido"
        );
        assert_eq!(corrigido.ocorrido_em, ocorrido_em);
        assert_eq!(corrigido.registrado_por_id, registrado_por_id);
    })
    .await;
}

/// O par processo/andamento precisa casar, e um andamento cancelado deixa de
/// ser editável pelo mesmo critério que o retira da listagem da tela.
#[tokio::test]
async fn edicao_exige_processo_correto_e_andamento_ativo() {
    util::com_banco_descartavel("mov_edita_escopo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p1 = processo(&pool, &m, &m.apuratorio, "001", data(2026, 1, 5), None).await;
        let p2 = processo(&pool, &m, &m.apuratorio, "002", data(2026, 2, 5), None).await;
        let autor = conta_admin(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        let id = repository::add(&mut tx, &pedido(&p1, "Original.", None), &autor)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let pedido_edicao = |processo_id: &str| UpdateMovementRequest {
            processo_id: processo_id.to_string(),
            andamento_id: id.clone(),
            descricao: "Corrigido.".to_string(),
            tipo_andamento_id: None,
        };

        let mut tx = pool.begin().await.unwrap();
        assert_eq!(
            repository::update(&mut tx, &pedido_edicao(&p2))
                .await
                .unwrap(),
            0
        );
        tx.rollback().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        repository::cancel(&mut tx, &p1, &id).await.unwrap();
        tx.commit().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        assert_eq!(
            repository::update(&mut tx, &pedido_edicao(&p1))
                .await
                .unwrap(),
            0
        );
        tx.rollback().await.unwrap();
    })
    .await;
}

/// Cancelar não apaga: grava `cancelado_em`. O andamento sai da lista, mas o
/// fato de ter existido permanece no banco.
#[tokio::test]
async fn cancelar_e_logico_e_nao_se_repete() {
    util::com_banco_descartavel("mov_cancela", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo_de_teste(&pool, &m).await;
        let autor = conta_admin(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        let id = repository::add(&mut tx, &pedido(&p, "A cancelar.", None), &autor)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        assert_eq!(repository::cancel(&mut tx, &p, &id).await.unwrap(), 1);
        tx.commit().await.unwrap();

        assert!(repository::list(&pool, &p).await.unwrap().is_empty());

        // A linha continua lá, com a data do cancelamento.
        let cancelado: Option<DateTime<Utc>> =
            sqlx::query_scalar("SELECT cancelado_em FROM processo_andamentos WHERE id = $1::uuid")
                .bind(&id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(
            cancelado.is_some(),
            "cancelar registra quando, nao um booleano"
        );

        // Cancelar de novo não afeta linha nenhuma: é o que faz o comando
        // devolver "andamento nao encontrado" em vez de fingir sucesso.
        let mut tx = pool.begin().await.unwrap();
        assert_eq!(repository::cancel(&mut tx, &p, &id).await.unwrap(), 0);
        tx.commit().await.unwrap();
    })
    .await;
}

/// O cancelamento é amarrado ao processo: passar o processo errado não pode
/// atingir o andamento de outro.
#[tokio::test]
async fn cancelar_exige_o_processo_correto() {
    util::com_banco_descartavel("mov_escopo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p1 = processo(&pool, &m, &m.apuratorio, "001", data(2026, 1, 5), None).await;
        let p2 = processo(&pool, &m, &m.apuratorio, "002", data(2026, 2, 5), None).await;
        let autor = conta_admin(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        let id = repository::add(&mut tx, &pedido(&p1, "Do primeiro.", None), &autor)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        assert_eq!(
            repository::cancel(&mut tx, &p2, &id).await.unwrap(),
            0,
            "o par (processo, andamento) tem de casar"
        );
        tx.commit().await.unwrap();

        assert_eq!(repository::list(&pool, &p1).await.unwrap().len(), 1);
    })
    .await;
}

/// Leitura de registro não filtra `ativo`: um tipo de andamento desativado hoje
/// continua legível nos andamentos que o usaram.
#[tokio::test]
async fn tipo_desativado_continua_legivel_no_andamento_antigo() {
    util::com_banco_descartavel("mov_desativado", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo_de_teste(&pool, &m).await;
        let autor = conta_admin(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        repository::add(
            &mut tx,
            &pedido(&p, "Despachado.", Some(&m.tipo_andamento)),
            &autor,
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        sqlx::query("UPDATE tipos_andamento SET ativo = false WHERE id = $1::uuid")
            .bind(&m.tipo_andamento)
            .execute(&pool)
            .await
            .unwrap();

        let itens = repository::list(&pool, &p).await.unwrap();
        assert_eq!(itens[0].tipo_andamento.as_deref(), Some("Despacho Teste"));
    })
    .await;
}

/// Descrição em branco é recusada antes de chegar ao banco — o CHECK
/// `ck_andamento_descricao` é a segunda linha de defesa, não a primeira.
#[tokio::test]
async fn descricao_em_branco_e_recusada() {
    assert!(pedido("", "   ", None).validate().is_err());
    assert!(pedido("", "Texto.", None).validate().is_ok());

    let edicao = UpdateMovementRequest {
        processo_id: String::new(),
        andamento_id: String::new(),
        descricao: "   ".to_string(),
        tipo_andamento_id: None,
    };
    assert!(edicao.validate().unwrap_err().contains("andamento"));
}

#[tokio::test]
async fn processo_concluido_recusa_novo_andamento_e_orienta_reabrir() {
    util::com_banco_descartavel("mov_concluido", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo(
            &pool,
            &m,
            &m.apuratorio,
            "001",
            data(2026, 2, 1),
            Some(data(2026, 2, 2)),
        )
        .await;
        let autor = conta_admin(&pool).await;
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::add(&mut tx, &pedido(&p, "Novo andamento.", None), &autor)
            .await
            .expect_err("processo concluido")
            .message();
        assert!(erro.contains("concluído"), "{erro}");
        assert!(erro.contains("Reabra"), "{erro}");
        assert!(repository::list(&pool, &p).await.unwrap().is_empty());
    })
    .await;
}
