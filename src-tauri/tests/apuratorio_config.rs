//! Configuração do apuratório: as duas tabelas de associação sem as quais
//! nenhum processo pode existir.
//!
//! Antes deste módulo elas eram lidas em oito pontos do backend e não tinham
//! nenhum caminho de escrita — a FK composta de `processos_procedimentos`
//! recusava qualquer processo e nada preenchia a configuração.

use adm_p6_tauri_lib::apuratorio_config::domain::{
    SaveDocumentoIniciadorRequest, SavePapelRequest,
};
use adm_p6_tauri_lib::apuratorio_config::repository;
use sqlx::PgPool;

mod util;
use util::fixtures::{self, PRAZO_APURATORIO, PRAZO_DOCUMENTO_CURTO};

async fn salvar_papel(pool: &PgPool, r: SavePapelRequest) -> Result<(), String> {
    r.validate()?;
    let mut tx = pool.begin().await.unwrap();
    let saida = repository::save_papel(&mut tx, &r)
        .await
        .map_err(|e| e.message());
    if saida.is_ok() {
        tx.commit().await.unwrap();
    }
    saida
}

async fn salvar_documento(pool: &PgPool, r: SaveDocumentoIniciadorRequest) -> Result<(), String> {
    r.validate()?;
    let mut tx = pool.begin().await.unwrap();
    let saida = repository::save_documento(&mut tx, &r)
        .await
        .map_err(|e| e.message());
    if saida.is_ok() {
        tx.commit().await.unwrap();
    }
    saida
}

#[tokio::test]
async fn configura_documentos_e_papeis_de_um_apuratorio() {
    util::com_banco_descartavel("apconfig", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // 1. Leitura resolve o COALESCE do prazo: o documento sem prazo próprio
        //    herda o do apuratório; o que declara o seu, sobrepõe.
        let cfg = repository::get(&pool, &m.apuratorio)
            .await
            .unwrap()
            .expect("apuratorio existe");
        assert_eq!(cfg.prazo_base_dias, PRAZO_APURATORIO);
        assert_eq!(cfg.documentos.len(), 2);

        let herdado = cfg
            .documentos
            .iter()
            .find(|d| d.tipo_documento_id == m.documento)
            .unwrap();
        assert_eq!(herdado.prazo_base_dias, None);
        assert_eq!(herdado.prazo_efetivo_dias, PRAZO_APURATORIO);
        assert!(herdado.padrao, "documento padrao do apuratorio");

        let proprio = cfg
            .documentos
            .iter()
            .find(|d| d.tipo_documento_id == m.documento_curto)
            .unwrap();
        assert_eq!(proprio.prazo_base_dias, Some(PRAZO_DOCUMENTO_CURTO));
        assert_eq!(proprio.prazo_efetivo_dias, PRAZO_DOCUMENTO_CURTO);

        // 2. Trocar o padrão não viola `uq_apdoc_padrao`: o anterior é zerado
        //    na mesma transação.
        salvar_documento(
            &pool,
            SaveDocumentoIniciadorRequest {
                apuratorio_id: m.apuratorio.clone(),
                tipo_documento_id: m.documento_curto.clone(),
                prazo_base_dias: Some(PRAZO_DOCUMENTO_CURTO),
                padrao: true,
                ativo: true,
            },
        )
        .await
        .expect("trocar o documento padrao");

        let cfg = repository::get(&pool, &m.apuratorio)
            .await
            .unwrap()
            .unwrap();
        let padroes: Vec<&str> = cfg
            .documentos
            .iter()
            .filter(|d| d.padrao)
            .map(|d| d.tipo_documento_id.as_str())
            .collect();
        assert_eq!(padroes, vec![m.documento_curto.as_str()]);

        // 3. Mesma coisa para o responsável: `uq_appapel_responsavel` admite um.
        salvar_papel(
            &pool,
            SavePapelRequest {
                apuratorio_id: m.apuratorio.clone(),
                papel_id: m.papel_escrivao.clone(),
                obrigatorio: true,
                max_ocupantes: 1,
                e_responsavel: true,
                ativo: true,
            },
        )
        .await
        .expect("trocar o papel responsavel");

        let cfg = repository::get(&pool, &m.apuratorio)
            .await
            .unwrap()
            .unwrap();
        let responsaveis: Vec<&str> = cfg
            .papeis
            .iter()
            .filter(|p| p.e_responsavel)
            .map(|p| p.papel_id.as_str())
            .collect();
        assert_eq!(responsaveis, vec![m.papel_escrivao.as_str()]);
    })
    .await;
}

#[tokio::test]
async fn recusa_configuracao_que_deixaria_o_apuratorio_sem_responsavel() {
    util::com_banco_descartavel("apconfig_resp", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // Listagem, dashboard e relatórios resolvem o responsável por
        // `e_responsavel`. Um responsável inativo ou opcional faria o
        // responsável sumir de todos os processos daquela espécie.
        let erro = salvar_papel(
            &pool,
            SavePapelRequest {
                apuratorio_id: m.apuratorio.clone(),
                papel_id: m.papel_encarregado.clone(),
                obrigatorio: true,
                max_ocupantes: 1,
                e_responsavel: true,
                ativo: false,
            },
        )
        .await
        .expect_err("responsavel desativado deve ser recusado");
        assert!(erro.contains("desativado"), "mensagem inesperada: {erro}");

        let erro = salvar_papel(
            &pool,
            SavePapelRequest {
                apuratorio_id: m.apuratorio.clone(),
                papel_id: m.papel_encarregado.clone(),
                obrigatorio: false,
                max_ocupantes: 1,
                e_responsavel: true,
                ativo: true,
            },
        )
        .await
        .expect_err("responsavel opcional deve ser recusado");
        assert!(erro.contains("obrigatorio"), "mensagem inesperada: {erro}");

        // Desativar o responsável exige apontar outro antes.
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::deactivate_papel(&mut tx, &m.apuratorio, &m.papel_encarregado)
            .await
            .expect_err("desativar o responsavel deve ser recusado");
        assert!(erro.message().contains("responde pelo apuratorio"));
        drop(tx);

        // O papel opcional, esse sim, desativa.
        let mut tx = pool.begin().await.unwrap();
        assert!(
            repository::deactivate_papel(&mut tx, &m.apuratorio, &m.papel_escrivao)
                .await
                .unwrap()
        );
        tx.commit().await.unwrap();

        let cfg = repository::get(&pool, &m.apuratorio)
            .await
            .unwrap()
            .unwrap();
        let escrivao = cfg
            .papeis
            .iter()
            .find(|p| p.papel_id == m.papel_escrivao)
            .expect("papel desativado continua visivel na tela de configuracao");
        assert!(!escrivao.ativo);
    })
    .await;
}

#[tokio::test]
async fn desativar_documento_preserva_os_processos_que_ja_o_usam() {
    util::com_banco_descartavel("apconfig_desat", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        sqlx::query(
            "INSERT INTO processos_procedimentos
                 (apuratorio_id, documento_iniciador_id, numero_documento,
                  unidade_origem_id, municipio_fato_id, natureza_fato_id, data_instauracao)
             VALUES ($1::uuid, $2::uuid, '001', $3::uuid, $4::uuid, $5::uuid, DATE '2026-01-10')",
        )
        .bind(&m.apuratorio)
        .bind(&m.documento)
        .bind(&m.unidade)
        .bind(&m.municipio)
        .bind(&m.natureza)
        .execute(&pool)
        .await
        .expect("processo com o par configurado");

        let mut tx = pool.begin().await.unwrap();
        assert!(
            repository::deactivate_documento(&mut tx, &m.apuratorio, &m.documento)
                .await
                .unwrap()
        );
        tx.commit().await.unwrap();

        let cfg = repository::get(&pool, &m.apuratorio)
            .await
            .unwrap()
            .unwrap();
        let doc = cfg
            .documentos
            .iter()
            .find(|d| d.tipo_documento_id == m.documento)
            .unwrap();
        assert!(!doc.ativo, "desativado");
        assert!(!doc.padrao, "padrao desativado deixa de ser padrao");
        assert!(doc.em_uso, "o processo existente e sinalizado");

        // A FK composta aponta para a PK, não para `ativo`: o processo continua
        // íntegro. É o princípio de que configuração muda o comportamento
        // futuro e não reescreve fatos já registrados.
        let vivos: i64 =
            sqlx::query_scalar("SELECT count(*) FROM processos_procedimentos WHERE ativo")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(vivos, 1);
    })
    .await;
}

/// `apuratorio_config_get` entrega os **atributos de comportamento** do
/// apuratório, e não só as duas associações.
///
/// Este teste existe por um defeito que deixou uma espécie inteira impossível
/// de cadastrar, em silêncio. O formulário de processo lia `codigo_extensao` de
/// `legal_catalogs_list("apuratorios")`, que projeta apenas as colunas
/// declaradas no registro de administração. Quando a decisão 29 tirou
/// `codigo_extensao` do registro — de propósito, para sumir do formulário do
/// administrador —, a tela de processo parou de enxergá-lo junto: o bloco de
/// carta precatória nunca mais renderizou, enquanto o backend seguia exigindo
/// deprecante e unidade deprecada.
///
/// Nenhum teste pegou porque nenhum lia o apuratório pelo caminho da tela. A
/// lição, e o motivo de os atributos morarem aqui: o registro governa o que o
/// administrador **edita**; este comando entrega o que o formulário precisa
/// **saber**.
#[tokio::test]
async fn configuracao_entrega_os_atributos_de_comportamento() {
    util::com_banco_descartavel("apconfig_atributos", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // O apuratório de carta precatória: é o `codigo_extensao` que liga a
        // extensão de formulário, e ele NÃO está no registro de catálogos.
        let cp = repository::get(&pool, &m.apuratorio_cp)
            .await
            .unwrap()
            .expect("configuracao do apuratorio de carta precatoria");
        assert_eq!(
            cp.codigo_extensao.as_deref(),
            Some("carta_precatoria"),
            "sem isto o formulario nao mostra deprecante, e o salvamento e recusado"
        );

        // O apuratório comum não tem extensão, e os atributos novos nascem
        // desligados: quem os liga é o administrador, por apuratório.
        let comum = repository::get(&pool, &m.apuratorio)
            .await
            .unwrap()
            .expect("configuracao do apuratorio comum");
        assert!(comum.codigo_extensao.is_none());
        assert!(comum.exige_natureza_fato, "a fixture declara que exige");
        assert_eq!(comum.max_envolvidos, Some(1));
        assert!(!comum.permite_julgamento);
        assert!(!comum.permite_punicao);
        assert!(!comum.permite_remessa_comissao);

        // Ligados, chegam ligados — é o que o formulário consulta para revelar
        // julgamento, punição e remessa à comissão.
        sqlx::query(
            "UPDATE apuratorios
                SET permite_julgamento = true,
                    permite_punicao = true,
                    permite_remessa_comissao = true
              WHERE id = $1::uuid",
        )
        .bind(&m.apuratorio)
        .execute(&pool)
        .await
        .unwrap();

        let depois = repository::get(&pool, &m.apuratorio)
            .await
            .unwrap()
            .unwrap();
        assert!(depois.permite_julgamento);
        assert!(depois.permite_punicao);
        assert!(depois.permite_remessa_comissao);
    })
    .await;
}
