//! Autenticação ponta a ponta contra um banco recém-migrado.
//!
//! Cobre o que o seed técnico promete: o administrador inicial existe, tem senha
//! utilizável, é reconhecido como administrador pelo atributo semântico do perfil
//! (e não pelo nome dele), e não depende de nenhum policial militar cadastrado.

use sqlx::Executor;

mod util;

#[tokio::test]
async fn administrador_do_seed_autentica_em_banco_sem_catalogos() {
    util::com_banco_descartavel("auth", |pool| async move {
        let row =
            adm_p6_tauri_lib::auth::repository::find_account_by_email(&pool, "admin@sistema.com")
                .await
                .expect("consulta de autenticacao")
                .expect("administrador do seed deve existir");

        assert_eq!(row.email, "admin@sistema.com");
        assert!(
            row.pode_administrar,
            "o perfil do seed deve poder administrar"
        );
        assert!(
            row.policial_militar_id.is_none(),
            "a conta tecnica nao deve depender de um policial militar"
        );
        assert!(
            bcrypt::verify("123456", &row.senha_hash).unwrap_or(false),
            "a senha de desenvolvimento do seed nao confere com o hash gravado"
        );

        // Busca por e-mail é case-insensitive.
        let maiusculo =
            adm_p6_tauri_lib::auth::repository::find_account_by_email(&pool, "ADMIN@SISTEMA.COM")
                .await
                .expect("consulta de autenticacao")
                .expect("busca por e-mail deve ignorar caixa");
        assert_eq!(maiusculo.id, row.id);

        // Conta desativada não autentica.
        pool.execute("UPDATE usuarios SET ativo = false")
            .await
            .unwrap();
        let inativo =
            adm_p6_tauri_lib::auth::repository::find_account_by_email(&pool, "admin@sistema.com")
                .await
                .expect("consulta de autenticacao");
        assert!(inativo.is_none(), "conta desativada nao pode autenticar");
    })
    .await;
}
