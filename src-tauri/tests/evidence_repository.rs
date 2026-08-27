//! Enquadramento do envolvido: categorias, transgressões, Estatuto e penais.
//!
//! É o módulo com mais SQL do backend e o que carrega a decisão de negócio mais
//! sutil: a esfera penal (militar/comum) é escolhida **no vínculo**, não no
//! catálogo do artigo, porque pelo art. 9º do CPM a mesma conduta pode ser um
//! crime ou outro conforme as circunstâncias do fato.
//!
//! As cinco tabelas de enquadramento do schema anterior viraram três, e a
//! escrita passou a ser substituição completa: o que o formulário mandou é a
//! verdade, e não um acréscimo ao que já havia.

use adm_p6_tauri_lib::evidence::domain::{
    SaveEvidenceRequest, SelecaoInfracaoEstatuto, SelecaoInfracaoPenal,
};
use adm_p6_tauri_lib::evidence::repository;
use chrono::NaiveDate;
use sqlx::PgPool;

mod util;
use util::fixtures::{self, envolvido, processo};

fn data(ano: i32, mes: u32, dia: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(ano, mes, dia).unwrap()
}

/// Ids de dado legal real: a fixture monta os catálogos operacionais, mas
/// transgressões e infrações vêm da migration 0003.
async fn ids(pool: &PgPool, tabela: &str, quantos: i64) -> Vec<String> {
    sqlx::query_scalar(&format!(
        "SELECT id::text FROM {tabela} ORDER BY id LIMIT $1"
    ))
    .bind(quantos)
    .fetch_all(pool)
    .await
    .unwrap()
}

async fn esferas(pool: &PgPool) -> (String, String) {
    let lista: Vec<String> =
        sqlx::query_scalar("SELECT id::text FROM esferas_penais ORDER BY nome")
            .fetch_all(pool)
            .await
            .unwrap();
    assert_eq!(lista.len(), 2, "a 0003 semeia duas esferas");
    (lista[0].clone(), lista[1].clone())
}

/// Um envolvido pronto para receber enquadramento.
async fn cenario(pool: &PgPool, m: &fixtures::Mundo) -> String {
    let p = processo(pool, m, &m.apuratorio_livre, "001", data(2026, 2, 1), None).await;
    envolvido(pool, m, &p, &m.pm_um, 1).await
}

#[tokio::test]
async fn indicios_dependem_da_capacidade_do_apuratorio() {
    util::com_banco_descartavel("ev_capacidade", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let env = cenario(&pool, &m).await;

        let mut tx = pool.begin().await.unwrap();
        repository::exigir_permissao_indicios(&mut tx, &env)
            .await
            .expect("procedimento permite indicios");
        tx.rollback().await.unwrap();

        sqlx::query("UPDATE apuratorios SET permite_indicios = false WHERE id = $1::uuid")
            .bind(&m.apuratorio_livre)
            .execute(&pool)
            .await
            .unwrap();
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::exigir_permissao_indicios(&mut tx, &env)
            .await
            .unwrap_err()
            .message();
        assert!(erro.contains("somente em procedimentos"), "{erro}");
    })
    .await;
}

// ── Buscas do formulário ─────────────────────────────────────────────────────

/// O rótulo é montado a partir do dado. No schema anterior o nome da lei estava
/// escrito num `format!` do Rust, e por isso um dispositivo novo aparecia sem
/// identificação.
#[tokio::test]
async fn busca_monta_o_rotulo_a_partir_do_dado() {
    util::com_banco_descartavel("ev_busca", |pool| async move {
        let penais = repository::search_infracoes_penais(&pool, "art", None)
            .await
            .unwrap();
        assert!(!penais.is_empty(), "a 0003 semeia 26 infracoes penais");
        let item = &penais[0];
        assert!(
            item.rotulo.contains(&item.dispositivo_legal) && item.rotulo.contains(&item.artigo),
            "o rotulo carrega dispositivo e artigo: {}",
            item.rotulo
        );

        let transgressoes = repository::search_transgressoes(&pool, "portar", None)
            .await
            .unwrap();
        assert!(!transgressoes.is_empty());
        let t = &transgressoes[0];
        assert!(t.rotulo.contains(&t.natureza), "a gravidade vem do artigo");
        // O artigo já vem com o prefixo do catálogo ("Art. 15"): o rótulo não
        // pode repeti-lo.
        assert!(
            !t.rotulo.contains("Art. Art."),
            "rotulo com prefixo duplicado: {}",
            t.rotulo
        );

        let estatuto = repository::search_infracoes_estatuto(&pool, "verdade", None)
            .await
            .unwrap();
        assert!(!estatuto.is_empty());
        assert!(
            !estatuto[0].rotulo.contains("Art. Art."),
            "rotulo com prefixo duplicado: {}",
            estatuto[0].rotulo
        );
    })
    .await;
}

/// A busca é por termo e por filtro; o filtro é id de catálogo, nunca nome.
#[tokio::test]
async fn busca_filtra_por_termo_e_por_catalogo() {
    util::com_banco_descartavel("ev_filtro", |pool| async move {
        let naturezas: Vec<String> =
            sqlx::query_scalar("SELECT id::text FROM naturezas_transgressao ORDER BY nome")
                .fetch_all(&pool)
                .await
                .unwrap();

        let todas = repository::search_transgressoes(&pool, "", None)
            .await
            .unwrap();
        let de_uma = repository::search_transgressoes(&pool, "", Some(&naturezas[0]))
            .await
            .unwrap();
        assert!(!de_uma.is_empty());
        assert!(de_uma.len() < todas.len(), "o filtro de natureza recorta");
        assert!(de_uma.iter().all(|t| t.natureza == de_uma[0].natureza));

        // Termo que não casa com nada devolve vazio, não erro.
        let nenhuma = repository::search_transgressoes(&pool, "zzzzzz", None)
            .await
            .unwrap();
        assert!(nenhuma.is_empty());
    })
    .await;
}

/// Lista de opções filtra `ativo` — ao contrário da leitura de registro, que
/// não filtra. É a distinção do princípio 6 do guia.
#[tokio::test]
async fn busca_de_opcoes_esconde_o_desativado() {
    util::com_banco_descartavel("ev_ativo_busca", |pool| async move {
        let antes = repository::search_transgressoes(&pool, "portar", None)
            .await
            .unwrap();
        assert!(!antes.is_empty());
        let desativada = antes[0].id.clone();

        sqlx::query("UPDATE transgressoes SET ativo = false WHERE id = $1::uuid")
            .bind(&desativada)
            .execute(&pool)
            .await
            .unwrap();

        let depois = repository::search_transgressoes(&pool, "portar", None)
            .await
            .unwrap();
        assert_eq!(depois.len(), antes.len() - 1);
        assert!(
            !depois.iter().any(|t| t.id == desativada),
            "opcao desativada sai da lista de escolha"
        );
    })
    .await;
}

// ── Escrita ──────────────────────────────────────────────────────────────────

/// Salvar substitui tudo. O formulário manda o enquadramento completo, então o
/// que não veio foi removido — acrescentar deixaria lixo de uma edição anterior.
#[tokio::test]
async fn salvar_substitui_o_enquadramento_inteiro() {
    util::com_banco_descartavel("ev_substitui", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let env = cenario(&pool, &m).await;
        let transgressoes = ids(&pool, "transgressoes", 3).await;
        let penais = ids(&pool, "infracoes_penais", 1).await;
        let (militar, _comum) = esferas(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        repository::save_for_envolvido(
            &mut tx,
            &SaveEvidenceRequest {
                envolvido_id: env.clone(),
                categorias_ids: vec![m.categoria_indicio.clone()],
                infracoes_penais: vec![SelecaoInfracaoPenal {
                    infracao_penal_id: penais[0].clone(),
                    esfera_penal_id: militar.clone(),
                }],
                transgressoes_ids: vec![transgressoes[0].clone(), transgressoes[1].clone()],
                infracoes_estatuto: vec![],
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let dados = repository::load_for_envolvido(&pool, &env).await.unwrap();
        assert_eq!(dados.transgressoes.len(), 2);
        assert_eq!(dados.infracoes_penais.len(), 1);
        assert_eq!(dados.categorias.len(), 1);

        // Segunda gravação: só uma transgressão, e nenhuma infração penal.
        let mut tx = pool.begin().await.unwrap();
        repository::save_for_envolvido(
            &mut tx,
            &SaveEvidenceRequest {
                envolvido_id: env.clone(),
                categorias_ids: vec![],
                infracoes_penais: vec![],
                transgressoes_ids: vec![transgressoes[2].clone()],
                infracoes_estatuto: vec![],
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let dados = repository::load_for_envolvido(&pool, &env).await.unwrap();
        assert_eq!(dados.transgressoes.len(), 1);
        assert_eq!(dados.transgressoes[0].id, transgressoes[2]);
        assert!(
            dados.infracoes_penais.is_empty(),
            "o que nao veio foi removido"
        );
        assert!(dados.categorias.is_empty());
    })
    .await;
}

/// A esfera é do vínculo: o mesmo artigo pode ser militar num processo e comum
/// em outro. Se ela morasse no catálogo, isto seria impossível de representar.
#[tokio::test]
async fn a_esfera_penal_e_do_vinculo_e_nao_do_artigo() {
    util::com_banco_descartavel("ev_esfera", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p1 = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "001",
            data(2026, 1, 5),
            None,
        )
        .await;
        let p2 = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "002",
            data(2026, 2, 5),
            None,
        )
        .await;
        let e1 = envolvido(&pool, &m, &p1, &m.pm_um, 1).await;
        let e2 = envolvido(&pool, &m, &p2, &m.pm_um, 1).await;
        let penais = ids(&pool, "infracoes_penais", 1).await;
        let (a, b) = esferas(&pool).await;

        for (env, esfera) in [(&e1, &a), (&e2, &b)] {
            let mut tx = pool.begin().await.unwrap();
            repository::save_for_envolvido(
                &mut tx,
                &SaveEvidenceRequest {
                    envolvido_id: env.clone(),
                    categorias_ids: vec![],
                    infracoes_penais: vec![SelecaoInfracaoPenal {
                        infracao_penal_id: penais[0].clone(),
                        esfera_penal_id: esfera.clone(),
                    }],
                    transgressoes_ids: vec![],
                    infracoes_estatuto: vec![],
                },
            )
            .await
            .unwrap();
            tx.commit().await.unwrap();
        }

        let d1 = repository::load_for_envolvido(&pool, &e1).await.unwrap();
        let d2 = repository::load_for_envolvido(&pool, &e2).await.unwrap();
        assert_eq!(d1.infracoes_penais[0].infracao_penal_id, penais[0]);
        assert_eq!(d2.infracoes_penais[0].infracao_penal_id, penais[0]);
        assert_ne!(
            d1.infracoes_penais[0].esfera_penal, d2.infracoes_penais[0].esfera_penal,
            "o mesmo artigo, esferas diferentes"
        );
    })
    .await;
}

/// A analogia com o RDPM é `NOT NULL` no schema: regra universal do domínio,
/// não particularidade dos arts. 29/32. O repositório não pode contorná-la.
#[tokio::test]
async fn infracao_do_estatuto_carrega_a_analogia_do_rdpm() {
    util::com_banco_descartavel("ev_analogia", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let env = cenario(&pool, &m).await;
        let estatuto = ids(&pool, "infracoes_estatuto", 1).await;
        let transgressao = ids(&pool, "transgressoes", 1).await;

        let mut tx = pool.begin().await.unwrap();
        repository::save_for_envolvido(
            &mut tx,
            &SaveEvidenceRequest {
                envolvido_id: env.clone(),
                categorias_ids: vec![],
                infracoes_penais: vec![],
                transgressoes_ids: vec![],
                infracoes_estatuto: vec![SelecaoInfracaoEstatuto {
                    infracao_estatuto_id: estatuto[0].clone(),
                    analogia_transgressao_id: transgressao[0].clone(),
                }],
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let dados = repository::load_for_envolvido(&pool, &env).await.unwrap();
        assert_eq!(dados.infracoes_estatuto.len(), 1);
        let vinculo = &dados.infracoes_estatuto[0];
        assert_eq!(vinculo.analogia_transgressao_id, transgressao[0]);
        assert!(
            !vinculo.analogia_rotulo.is_empty(),
            "a analogia vem rotulada"
        );
        assert!(!vinculo.rotulo.contains("Art. Art."));
    })
    .await;
}

/// A categoria que indica ausência de indícios não convive com nenhuma outra —
/// e a regra é lida de `indica_ausencia`, não do nome da opção. O administrador
/// pode renomear "Não houve indícios" à vontade.
#[tokio::test]
async fn ausencia_de_indicios_nao_convive_com_outra_categoria() {
    util::com_banco_descartavel("ev_ausencia", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let env = cenario(&pool, &m).await;

        // Uma segunda categoria, esta sem `indica_ausencia`.
        let outra: String = sqlx::query_scalar(
            "INSERT INTO categorias_indicio (nome, indica_ausencia)
             VALUES ('Indicios de Crime Teste', false) RETURNING id::text",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        let pedido = |categorias: Vec<String>| SaveEvidenceRequest {
            envolvido_id: env.clone(),
            categorias_ids: categorias,
            infracoes_penais: vec![],
            transgressoes_ids: vec![],
            infracoes_estatuto: vec![],
        };

        // Sozinha, passa.
        let mut tx = pool.begin().await.unwrap();
        repository::save_for_envolvido(&mut tx, &pedido(vec![m.categoria_indicio.clone()]))
            .await
            .unwrap();
        tx.commit().await.unwrap();

        // Combinada, é recusada.
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::save_for_envolvido(
            &mut tx,
            &pedido(vec![m.categoria_indicio.clone(), outra.clone()]),
        )
        .await
        .expect_err("a combinacao tem de ser recusada");
        assert!(
            erro.message().contains("ausência de indícios"),
            "erro legivel: {erro}"
        );
        drop(tx);

        // Renomear a categoria não muda nada: quem manda é o atributo.
        sqlx::query("UPDATE categorias_indicio SET nome = 'Outro Nome' WHERE id = $1::uuid")
            .bind(&m.categoria_indicio)
            .execute(&pool)
            .await
            .unwrap();
        let mut tx = pool.begin().await.unwrap();
        assert!(
            repository::save_for_envolvido(
                &mut tx,
                &pedido(vec![m.categoria_indicio.clone(), outra.clone()])
            )
            .await
            .is_err(),
            "a regra e do atributo, nao do nome"
        );
        drop(tx);

        // Duas categorias comuns convivem.
        let mut tx = pool.begin().await.unwrap();
        repository::save_for_envolvido(&mut tx, &pedido(vec![outra]))
            .await
            .unwrap();
        tx.commit().await.unwrap();
    })
    .await;
}

// ── Leitura ──────────────────────────────────────────────────────────────────

/// Leitura de registro NÃO filtra `ativo`: um enquadramento de 2019 continua
/// legível mesmo que o artigo tenha sido desativado depois.
#[tokio::test]
async fn enquadramento_sobrevive_a_desativacao_do_catalogo() {
    util::com_banco_descartavel("ev_desativado", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let env = cenario(&pool, &m).await;
        let transgressao = ids(&pool, "transgressoes", 1).await;

        let mut tx = pool.begin().await.unwrap();
        repository::save_for_envolvido(
            &mut tx,
            &SaveEvidenceRequest {
                envolvido_id: env.clone(),
                categorias_ids: vec![m.categoria_indicio.clone()],
                infracoes_penais: vec![],
                transgressoes_ids: vec![transgressao[0].clone()],
                infracoes_estatuto: vec![],
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        sqlx::query("UPDATE transgressoes SET ativo = false WHERE id = $1::uuid")
            .bind(&transgressao[0])
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE categorias_indicio SET ativo = false WHERE id = $1::uuid")
            .bind(&m.categoria_indicio)
            .execute(&pool)
            .await
            .unwrap();

        let dados = repository::load_for_envolvido(&pool, &env).await.unwrap();
        assert_eq!(
            dados.transgressoes.len(),
            1,
            "o que ja foi imputado continua legivel"
        );
        assert_eq!(dados.categorias.len(), 1);
    })
    .await;
}

/// O painel de indícios lista os envolvidos na ordem, cada um com o próprio
/// enquadramento — inclusive quem ainda não tem nenhum.
#[tokio::test]
async fn painel_lista_os_envolvidos_na_ordem_com_o_que_cada_um_tem() {
    util::com_banco_descartavel("ev_painel", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p = processo(
            &pool,
            &m,
            &m.apuratorio_livre,
            "001",
            data(2026, 2, 1),
            None,
        )
        .await;
        let segundo = envolvido(&pool, &m, &p, &m.pm_dois, 2).await;
        let primeiro = envolvido(&pool, &m, &p, &m.pm_um, 1).await;
        let transgressao = ids(&pool, "transgressoes", 1).await;

        let mut tx = pool.begin().await.unwrap();
        repository::save_for_envolvido(
            &mut tx,
            &SaveEvidenceRequest {
                envolvido_id: segundo.clone(),
                categorias_ids: vec![],
                infracoes_penais: vec![],
                transgressoes_ids: vec![transgressao[0].clone()],
                infracoes_estatuto: vec![],
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let painel = repository::list_for_proceeding(&pool, &p).await.unwrap();
        assert_eq!(painel.len(), 2);
        assert_eq!(painel[0].envolvido_id, primeiro, "ordena por `ordem`");
        assert_eq!(painel[0].ordem, 1);
        assert!(painel[0].indicios.transgressoes.is_empty());
        assert_eq!(painel[1].envolvido_id, segundo);
        assert_eq!(painel[1].indicios.transgressoes.len(), 1);
        assert!(!painel[0].posto_graduacao.is_empty());
        assert!(!painel[0].status_envolvido.is_empty());
    })
    .await;
}

/// Remover o enquadramento limpa as quatro tabelas — é o que permite excluir o
/// envolvido de um processo sem esbarrar nas FKs.
#[tokio::test]
async fn remover_limpa_as_quatro_tabelas_de_vinculo() {
    util::com_banco_descartavel("ev_remove", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let env = cenario(&pool, &m).await;
        let (militar, _) = esferas(&pool).await;

        let mut tx = pool.begin().await.unwrap();
        repository::save_for_envolvido(
            &mut tx,
            &SaveEvidenceRequest {
                envolvido_id: env.clone(),
                categorias_ids: vec![m.categoria_indicio.clone()],
                infracoes_penais: vec![SelecaoInfracaoPenal {
                    infracao_penal_id: ids(&pool, "infracoes_penais", 1).await[0].clone(),
                    esfera_penal_id: militar,
                }],
                transgressoes_ids: vec![ids(&pool, "transgressoes", 1).await[0].clone()],
                infracoes_estatuto: vec![SelecaoInfracaoEstatuto {
                    infracao_estatuto_id: ids(&pool, "infracoes_estatuto", 1).await[0].clone(),
                    analogia_transgressao_id: ids(&pool, "transgressoes", 1).await[0].clone(),
                }],
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        repository::remove_for_envolvido(&mut tx, &env)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let dados = repository::load_for_envolvido(&pool, &env).await.unwrap();
        assert!(dados.categorias.is_empty());
        assert!(dados.infracoes_penais.is_empty());
        assert!(dados.transgressoes.is_empty());
        assert!(dados.infracoes_estatuto.is_empty());
    })
    .await;
}
