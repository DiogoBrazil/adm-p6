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
         INSERT INTO postos_graduacoes (id, sigla, nome, circulo_hierarquico_id, ordem_hierarquica)
         VALUES ('10000000-0000-0000-0000-000000000002', 'TST PM', 'Soldado Teste PM',
                 '10000000-0000-0000-0000-000000000001', -1);
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
        assert_eq!(item.ordem_hierarquica, -1);

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
