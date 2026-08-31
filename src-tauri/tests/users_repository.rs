//! Exercita o repositório de `users` contra um banco real.
//!
//! O ponto central: policial militar e conta de acesso são entidades separadas,
//! mas continuam sendo gravadas por um único formulário, numa única transação.

use adm_p6_tauri_lib::users::domain::{SaveAccountRequest, SaveUserRequest};
use adm_p6_tauri_lib::users::repository;
use sqlx::{Executor, PgPool};

mod util;

async fn catalogos_minimos(pool: &PgPool) -> (String, String) {
    pool.execute(
        // Nomes com "Teste": a migration 0003 semeia os catálogos legais
        // (círculos, postos) e os índices únicos são case-insensitive.
        "INSERT INTO circulos_hierarquicos (id, nome) VALUES
            ('10000000-0000-0000-0000-000000000001', 'Circulo Teste');
         INSERT INTO postos_graduacoes (id, sigla, nome, circulo_hierarquico_id)
         VALUES ('10000000-0000-0000-0000-000000000002', 'TST PM', 'Soldado Teste PM',
                 '10000000-0000-0000-0000-000000000001');
         INSERT INTO perfis_acesso (id, nome, pode_administrar) VALUES
            ('10000000-0000-0000-0000-000000000003', 'Comum', false);",
    )
    .await
    .expect("catalogos minimos");
    (
        "10000000-0000-0000-0000-000000000002".to_string(),
        "10000000-0000-0000-0000-000000000003".to_string(),
    )
}

#[tokio::test]
async fn grava_policial_com_e_sem_conta_de_acesso() {
    util::com_banco_descartavel("users", |pool| async move {
        let (posto_id, perfil_comum) = catalogos_minimos(&pool).await;

        // 1. Militar que não opera o sistema nasce sem conta.
        let mut tx = pool.begin().await.unwrap();
        let (pm_sem_conta, conta) = repository::save(
            &mut tx,
            &SaveUserRequest {
                id: None,
                nome: "joao da silva".to_string(),
                matricula: "100000001".to_string(),
                posto_graduacao_id: posto_id.clone(),
                is_encarregado: true,
                conta: None,
            },
        )
        .await
        .expect("gravar policial sem conta");
        tx.commit().await.unwrap();
        assert!(
            conta.is_none(),
            "militar sem credenciais nao deve ganhar conta"
        );

        // 2. Militar que opera o sistema: conta criada na mesma transação.
        let mut tx = pool.begin().await.unwrap();
        let (pm_com_conta, conta) = repository::save(
            &mut tx,
            &SaveUserRequest {
                id: None,
                nome: "maria souza".to_string(),
                matricula: "100000002".to_string(),
                posto_graduacao_id: posto_id.clone(),
                is_encarregado: false,
                conta: Some(SaveAccountRequest {
                    email: "Maria.Souza@PM.RO".to_string(),
                    perfil_id: perfil_comum.clone(),
                    senha: Some("segredo".to_string()),
                }),
            },
        )
        .await
        .expect("gravar policial com conta");
        tx.commit().await.unwrap();
        let conta_id = conta.expect("conta deveria ter sido criada");

        // Nome em maiúsculas, e-mail em minúsculas, catálogos resolvidos por join.
        let item = repository::get_by_id(&pool, &pm_com_conta)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(item.nome, "MARIA SOUZA");
        assert_eq!(item.conta_email.as_deref(), Some("maria.souza@pm.ro"));
        assert_eq!(item.posto_graduacao, "Soldado Teste PM");
        assert_eq!(item.circulo_hierarquico, "Circulo Teste");

        // 3. Editar sem enviar senha mantém o hash existente.
        let hash_antes: String =
            sqlx::query_scalar("SELECT senha_hash FROM usuarios WHERE id = $1::uuid")
                .bind(&conta_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        let mut tx = pool.begin().await.unwrap();
        repository::save(
            &mut tx,
            &SaveUserRequest {
                id: Some(pm_com_conta.clone()),
                nome: "maria souza lima".to_string(),
                matricula: "100000002".to_string(),
                posto_graduacao_id: posto_id.clone(),
                is_encarregado: true,
                conta: Some(SaveAccountRequest {
                    email: "maria.souza@pm.ro".to_string(),
                    perfil_id: perfil_comum.clone(),
                    senha: None,
                }),
            },
        )
        .await
        .expect("editar sem trocar senha");
        tx.commit().await.unwrap();
        let hash_depois: String =
            sqlx::query_scalar("SELECT senha_hash FROM usuarios WHERE id = $1::uuid")
                .bind(&conta_id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(hash_antes, hash_depois, "senha nao deveria ter mudado");

        // 4. Retirar o acesso DESATIVA a conta; nunca a apaga, porque ela é
        //    referenciada por andamentos, anexos e auditoria.
        let mut tx = pool.begin().await.unwrap();
        repository::save(
            &mut tx,
            &SaveUserRequest {
                id: Some(pm_com_conta.clone()),
                nome: "maria souza lima".to_string(),
                matricula: "100000002".to_string(),
                posto_graduacao_id: posto_id.clone(),
                is_encarregado: true,
                conta: None,
            },
        )
        .await
        .expect("retirar acesso");
        tx.commit().await.unwrap();
        let ativa: bool = sqlx::query_scalar("SELECT ativo FROM usuarios WHERE id = $1::uuid")
            .bind(&conta_id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert!(!ativa, "a conta deveria ter sido desativada, nao removida");

        // 5. Desativar o militar tira o acesso junto.
        let mut tx = pool.begin().await.unwrap();
        repository::set_ativo(&mut tx, &pm_sem_conta, false)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        let ativo: bool =
            sqlx::query_scalar("SELECT ativo FROM policiais_militares WHERE id = $1::uuid")
                .bind(&pm_sem_conta)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(!ativo);

        // 6. Listagem, busca e ordenação por hierarquia.
        let lista = repository::list_paginated(&pool, None, 1, 50)
            .await
            .unwrap();
        assert_eq!(lista.total, 2);
        let busca = repository::list_paginated(&pool, Some("maria"), 1, 50)
            .await
            .unwrap();
        assert_eq!(busca.total, 1);
        assert_eq!(busca.items[0].matricula, "100000002");

        // 7. Estatísticas partem de zero e não dependem de nomes fixos.
        let stats = repository::statistics(&pool, &pm_com_conta).await.unwrap();
        assert!(stats.designacoes_por_papel.is_empty());
        assert!(stats.designacoes_por_apuratorio.is_empty());
        assert!(stats.envolvimentos_por_status.is_empty());

        // 8. As duas listagens de processos respondem sem erro em banco vazio.
        assert!(
            repository::proceedings_as_designated(&pool, &pm_com_conta, None)
                .await
                .unwrap()
                .is_empty()
        );
        assert!(repository::proceedings_as_involved(&pool, &pm_com_conta)
            .await
            .unwrap()
            .is_empty());

        // 9. A trava do último administrador enxerga o administrador do seed.
        assert_eq!(
            repository::outros_administradores_ativos(&pool, None)
                .await
                .unwrap(),
            1
        );
    })
    .await;
}

// ── Leitura ──────────────────────────────────────────────────────────────────
//
// As consultas abaixo montam SQL em tempo de execução (`SELECT_PM`,
// `COLUNAS_PROCESSO`, `JOIN_PROCESSO`), então não há verificação possível em
// compilação nem por `PREPARE`: só executá-las. É o que `sql_prepare.rs` cobra.

use adm_p6_tauri_lib::users::domain::UserListItem;
use chrono::NaiveDate;
use util::fixtures::{self, envolvido, processo};

fn data(ano: i32, mes: u32, dia: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(ano, mes, dia).unwrap()
}

fn achar<'a>(itens: &'a [UserListItem], matricula: &str) -> &'a UserListItem {
    itens
        .iter()
        .find(|u| u.matricula == matricula)
        .unwrap_or_else(|| panic!("militar {matricula} nao esta na lista"))
}

/// A listagem pagina, busca por nome ou matrícula e ordena pela hierarquia —
/// não pelo nome, que era o critério do sistema legado.
#[tokio::test]
async fn listagem_pagina_busca_e_ordena_pela_hierarquia() {
    util::com_banco_descartavel("users_lista", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let tudo = repository::list_paginated(&pool, None, 1, 50)
            .await
            .unwrap();
        assert_eq!(tudo.total, 3, "os tres da fixture");
        assert_eq!(tudo.items.len(), 3);
        assert_eq!(tudo.page, 1);

        // Busca casa nome e matrícula, sem diferenciar maiúsculas.
        let por_nome = repository::list_paginated(&pool, Some("pm um"), 1, 50)
            .await
            .unwrap();
        assert_eq!(por_nome.total, 1);
        assert_eq!(por_nome.items[0].nome, "PM UM");

        let matricula = &tudo.items[0].matricula.clone();
        let por_matricula = repository::list_paginated(&pool, Some(matricula), 1, 50)
            .await
            .unwrap();
        assert_eq!(por_matricula.total, 1);

        // A paginação devolve o total do escopo, não o tamanho da página.
        let pagina = repository::list_paginated(&pool, None, 1, 2).await.unwrap();
        assert_eq!(pagina.items.len(), 2);
        assert_eq!(pagina.total, 3);
        let segunda = repository::list_paginated(&pool, None, 2, 2).await.unwrap();
        assert_eq!(segunda.items.len(), 1);
        assert_ne!(segunda.items[0].id, pagina.items[0].id);

        // Página fora do intervalo devolve vazio, não erro.
        let longe = repository::list_paginated(&pool, None, 99, 2)
            .await
            .unwrap();
        assert!(longe.items.is_empty());
        assert_eq!(longe.total, 3);

        let _ = m;
    })
    .await;
}

/// Só quem pode ser designado entra na lista de encarregados — é o que alimenta
/// o formulário de processo.
#[tokio::test]
async fn lista_de_encarregados_traz_so_quem_pode_ser_designado() {
    util::com_banco_descartavel("users_encarregados", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let encarregados = repository::list_encarregados(&pool).await.unwrap();
        assert_eq!(encarregados.len(), 2, "PM TRES nao e encarregado");
        assert!(encarregados.iter().all(|u| u.is_encarregado));

        // Desativar o militar o tira da lista, sem apagar nada.
        let mut tx = pool.begin().await.unwrap();
        repository::set_ativo(&mut tx, &m.pm_um, false)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let depois = repository::list_encarregados(&pool).await.unwrap();
        assert_eq!(depois.len(), 1);
    })
    .await;
}

/// A lista de **opções** de militar não pode paginar.
///
/// Este teste existe por um defeito que atravessou a migração inteira sem ser
/// visto: os seletores do formulário de processo eram alimentados por
/// `list_paginated`, que trava `per_page` em 200. A tela pedia 500 e recebia
/// 200 — o clamp corta calado, sem erro e sem aviso. Com 235 militares no
/// efetivo real, os 35 últimos em ordem alfabética não apareciam em seletor
/// nenhum, e não havia como lançá-los como envolvido ou designado.
///
/// Nenhum teste pegou porque nenhum exercitava uma lista maior que o clamp: a
/// fixture tem 3 militares. Por isso este monta **mais de 200**.
#[tokio::test]
async fn lista_de_opcoes_de_militar_nao_pagina() {
    util::com_banco_descartavel("users_opcoes", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // 250 militares além dos 3 da fixture, para passar do teto de 200.
        // O posto sai do banco: `Mundo` não o expõe, e um posto qualquer serve.
        let posto: String = sqlx::query_scalar("SELECT id::text FROM postos_graduacoes LIMIT 1")
            .fetch_one(&pool)
            .await
            .expect("posto da fixture");

        let extras: String = (0..250)
            .map(|i| {
                format!(
                    "('2000{:05}', 'PM EXTRA {:03}', '{posto}', {})",
                    i,
                    i,
                    i % 2 == 0
                )
            })
            .collect::<Vec<_>>()
            .join(",\n");
        pool.execute(
            format!(
                "INSERT INTO policiais_militares
                     (matricula, nome, posto_graduacao_id, is_encarregado)
                 VALUES {extras};"
            )
            .as_str(),
        )
        .await
        .expect("inserir os 250 militares extras");

        let total_esperado = 253;

        // O comando paginado corta em 200, e é isso que ele deve fazer:
        // é a listagem de tela, onde paginar é o certo.
        let paginado = repository::list_paginated(&pool, None, 1, 500)
            .await
            .unwrap();
        assert_eq!(
            paginado.items.len(),
            200,
            "list_paginated trava em 200 — se isso mudar, o motivo deste teste mudou"
        );
        assert_eq!(
            paginado.total, total_esperado,
            "o total e do escopo inteiro"
        );

        // A lista de opções devolve todos. É a diferença que o defeito escondia.
        let opcoes = repository::list_ativos(&pool).await.unwrap();
        assert_eq!(
            opcoes.len(),
            total_esperado as usize,
            "lista de opcoes nao pagina: todo militar ativo tem de ser selecionavel"
        );

        // E o último em ordem alfabética é alcançável — era exatamente quem
        // sumia (no efetivo real, ZAQUEU DE ALMEIDA KVIATKOSKI).
        let ultimo = opcoes.last().expect("lista nao vazia");
        assert!(
            opcoes.iter().any(|u| u.id == ultimo.id),
            "o ultimo alfabetico precisa estar na lista"
        );
        let mut nomes: Vec<&str> = opcoes.iter().map(|u| u.nome.as_str()).collect();
        let ordenados = {
            let mut c = nomes.clone();
            c.sort();
            c
        };
        assert_eq!(nomes, ordenados, "a lista de opcoes sai ordenada por nome");
        nomes.clear();

        // Desativar tira da lista de opções (princípio 6), sem apagar nada.
        let mut tx = pool.begin().await.unwrap();
        repository::set_ativo(&mut tx, &m.pm_um, false)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        let depois = repository::list_ativos(&pool).await.unwrap();
        assert_eq!(depois.len(), total_esperado as usize - 1);
        assert!(
            !depois.iter().any(|u| u.id == m.pm_um),
            "militar desativado sai da lista de opcoes"
        );
    })
    .await;
}

/// O detalhe traz o militar com a conta ao lado — ou sem ela, que é o caso de
/// 229 dos 236 usuários do sistema legado.
#[tokio::test]
async fn detalhe_traz_militar_com_e_sem_conta() {
    util::com_banco_descartavel("users_detalhe", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let sem_conta = repository::get_by_id(&pool, &m.pm_um)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(sem_conta.nome, "PM UM");
        assert_eq!(
            sem_conta.posto_graduacao, "Posto Teste PM",
            "vem o nome, nao a sigla"
        );
        assert_eq!(sem_conta.posto_graduacao_sigla, "TST PM");
        assert!(
            sem_conta.conta_id.is_none(),
            "militar da fixture nao tem conta"
        );
        assert!(sem_conta.conta_email.is_none());

        // Com conta, os campos da conta vêm preenchidos.
        let perfil: String = sqlx::query_scalar("SELECT id::text FROM perfis_acesso LIMIT 1")
            .fetch_one(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO usuarios (policial_militar_id, email, senha_hash, perfil_id)
             VALUES ($1::uuid, 'pmum@teste.com', 'x', $2::uuid)",
        )
        .bind(&m.pm_um)
        .bind(&perfil)
        .execute(&pool)
        .await
        .unwrap();

        let com_conta = repository::get_by_id(&pool, &m.pm_um)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(com_conta.conta_email.as_deref(), Some("pmum@teste.com"));
        assert_eq!(com_conta.conta_perfil.as_deref(), Some("Administrador"));

        // Id inexistente é `None`, não erro.
        assert!(
            repository::get_by_id(&pool, &fixtures::conta_admin(&pool).await)
                .await
                .unwrap()
                .is_none()
        );
    })
    .await;
}

/// As duas listas do detalhe do usuário: onde ele foi designado e onde figurou
/// como envolvido. São perguntas diferentes e não podem se misturar.
#[tokio::test]
async fn processos_do_militar_separam_designacao_de_envolvimento() {
    util::com_banco_descartavel("users_processos", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let p1 = processo(&pool, &m, &m.apuratorio, "001", data(2026, 1, 5), None).await;
        let p2 = processo(&pool, &m, &m.apuratorio, "002", data(2026, 2, 5), None).await;

        // PM UM encarregado do primeiro, escrivão do segundo.
        for (proc, papel) in [(&p1, &m.papel_encarregado), (&p2, &m.papel_escrivao)] {
            sqlx::query(
                "INSERT INTO processo_designacoes
                     (processo_id, apuratorio_id, policial_militar_id, papel_id, data_inicio)
                 SELECT $1::uuid, p.apuratorio_id, $2::uuid, $3::uuid, p.data_instauracao
                   FROM processos_procedimentos p WHERE p.id = $1::uuid",
            )
            .bind(proc)
            .bind(&m.pm_um)
            .bind(papel)
            .execute(&pool)
            .await
            .unwrap();
        }
        // E envolvido no segundo.
        envolvido(&pool, &m, &p2, &m.pm_um, 1).await;

        let designados = repository::proceedings_as_designated(&pool, &m.pm_um, None)
            .await
            .unwrap();
        assert_eq!(designados.len(), 2);
        assert_eq!(designados[0].apuratorio_sigla, "TST-A");
        assert!(designados.iter().all(|p| p.papel.is_some()));
        assert!(
            designados.iter().all(|p| p.status_envolvido.is_none()),
            "designacao nao traz status de envolvido"
        );
        // Mais recente primeiro.
        assert_eq!(designados[0].numero_documento, "002");

        // O filtro de papel é o que substitui a coluna "como escrivão".
        let so_escrivao =
            repository::proceedings_as_designated(&pool, &m.pm_um, Some(&m.papel_escrivao))
                .await
                .unwrap();
        assert_eq!(so_escrivao.len(), 1);
        assert_eq!(so_escrivao[0].numero_documento, "002");

        let envolvido_em = repository::proceedings_as_involved(&pool, &m.pm_um)
            .await
            .unwrap();
        assert_eq!(envolvido_em.len(), 1);
        assert!(envolvido_em[0].papel.is_none());
        assert_eq!(
            envolvido_em[0].status_envolvido.as_deref(),
            Some("Sindicado Teste")
        );

        // Quem não tem nada devolve listas vazias.
        assert!(
            repository::proceedings_as_designated(&pool, &m.pm_tres, None)
                .await
                .unwrap()
                .is_empty()
        );
        assert!(repository::proceedings_as_involved(&pool, &m.pm_tres)
            .await
            .unwrap()
            .is_empty());
    })
    .await;
}

/// O militar sem vínculo sai do banco; o vinculado é barrado **antes** da
/// tentativa, para que a mensagem diga qual vínculo segurou.
///
/// A conferência não substitui as FKs — as quatro são `ON DELETE RESTRICT` e
/// recusariam de qualquer jeito. É por isso que o teste também tenta o `DELETE`
/// direto e exige o erro do banco: se um dia a conferência esquecer um caso, é
/// a rede embaixo que tem de estar de pé.
#[tokio::test]
async fn so_o_militar_sem_vinculo_pode_ser_apagado() {
    util::com_banco_descartavel("users_exclusao", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // `pm_tres` não aparece em processo nenhum na fixture — é o cadastro
        // que ainda dá para apagar.
        let mut tx = pool.begin().await.unwrap();
        let livre = repository::vinculos(&mut tx, &m.pm_tres).await.unwrap();
        assert!(!livre.existe(), "pm_tres nasce sem vínculo");
        repository::delete(&mut tx, &m.pm_tres).await.unwrap();
        tx.commit().await.unwrap();

        let sobrou: i64 =
            sqlx::query_scalar("SELECT count(*) FROM policiais_militares WHERE id = $1::uuid")
                .bind(&m.pm_tres)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(sobrou, 0, "o militar sem vínculo sai do banco");

        // `pm_um` vira envolvido: um vínculo basta para barrar.
        let processo = processo(
            &pool,
            &m,
            &m.apuratorio,
            "001",
            NaiveDate::from_ymd_opt(2026, 1, 10).unwrap(),
            None,
        )
        .await;
        envolvido(&pool, &m, &processo, &m.pm_um, 1).await;

        let mut tx = pool.begin().await.unwrap();
        let preso = repository::vinculos(&mut tx, &m.pm_um).await.unwrap();
        assert!(preso.existe());
        assert_eq!(preso.envolvimentos, 1);
        assert_eq!(preso.designacoes, 0);
        assert!(!preso.conta, "a fixture não dá conta de acesso ao pm_um");

        // E a rede embaixo: o banco recusa mesmo sem a conferência.
        let erro = repository::delete(&mut tx, &m.pm_um).await.unwrap_err();
        assert!(
            matches!(&erro, sqlx::Error::Database(e) if e.code().as_deref() == Some("23503")),
            "esperava foreign_key_violation, veio {erro:?}"
        );
        tx.rollback().await.unwrap();

        // A conta de acesso também segura, e sozinha.
        let mut tx = pool.begin().await.unwrap();
        fixtures::conta_militar(&pool, &m.pm_dois, "pm.dois@teste.com").await;
        let com_conta = repository::vinculos(&mut tx, &m.pm_dois).await.unwrap();
        assert!(com_conta.conta);
        assert!(com_conta.existe());
        tx.rollback().await.unwrap();
    })
    .await;
}
