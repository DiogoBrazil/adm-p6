//! Exercita `proceedings::repository` contra um banco real.
//!
//! São 960 linhas de SQL cru que até aqui só o `cargo check` cobria — e SQL cru
//! não é verificado na compilação. Foi exatamente essa lacuna que deixou 62
//! consultas apodrecerem sem ninguém notar no ciclo anterior.
//!
//! O que os testes travam, em ordem de importância: as validações que leem
//! atributos de catálogo (e não literais), a aritmética do prazo (hoje coluna
//! gerada), e as invariantes que o PostgreSQL garante — FK composta, índices
//! únicos parciais, EXCLUDE de período e as duas constraint triggers.

use adm_p6_tauri_lib::deadlines::{
    domain::AddExtensionRequest, repository as deadlines_repository,
};
use adm_p6_tauri_lib::evidence::domain::{AcusacoesRequest, SelecaoInfracaoPenal};
use adm_p6_tauri_lib::proceedings::domain::{
    AtualizarSubstituicaoRequest, CartaPrecatoriaRequest, DesignacaoRequest, EnvolvidoRequest,
    PessoaRequest, ProceedingFilter, SaveProceedingRequest, SubstituirDesignacaoRequest,
    UpdateInvolvedOutcomeRequest, UpdateProceedingDatesRequest, UploadAttachmentRequest,
    VitimaRequest,
};
use adm_p6_tauri_lib::proceedings::repository;
use chrono::NaiveDate;
use sqlx::PgPool;

mod util;
use util::fixtures::{self, Mundo, PRAZO_APURATORIO, PRAZO_DOCUMENTO_CURTO};

fn data(ano: i32, mes: u32, dia: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(ano, mes, dia).unwrap()
}

/// Requisição mínima que passa em todas as validações do apuratório principal:
/// natureza informada (`exige_natureza_fato`) e o papel obrigatório designado.
fn base(m: &Mundo, numero: &str) -> SaveProceedingRequest {
    SaveProceedingRequest {
        id: None,
        apuratorio_id: m.apuratorio.clone(),
        documento_iniciador_id: m.documento.clone(),
        numero_documento: numero.to_string(),
        numero_controle: None,
        processo_sei: None,
        numero_rgf: None,
        unidade_origem_id: m.unidade.clone(),
        subunidade_secao_origem_id: None,
        municipio_fato_id: m.municipio.clone(),
        natureza_fato_id: Some(m.natureza.clone()),
        data_instauracao: data(2026, 1, 10),
        data_recebimento: None,
        resumo_fatos: None,
        envolvidos: vec![],
        designacoes: vec![designacao(m, &m.pm_um, &m.papel_encarregado)],
        pessoas: vec![],
        vitimas: vec![],
        carta_precatoria: None,
    }
}

/// Liga `permite_cadastro_vitima` no apuratório: a fixture nasce com ele
/// desligado, porque a carga da 0012 rodou com `apuratorios` vazia.
async fn habilitar_vitima(pool: &PgPool, apuratorio: &str, ligado: bool) {
    sqlx::query("UPDATE apuratorios SET permite_cadastro_vitima = $2 WHERE id = $1::uuid")
        .bind(apuratorio)
        .bind(ligado)
        .execute(pool)
        .await
        .unwrap();
}

fn vitima(nome: &str, ordem: i32) -> VitimaRequest {
    VitimaRequest {
        nome: nome.to_string(),
        ordem,
    }
}

/// Designação nova: sem `id`. Início, documento e motivo não entram porque são
/// derivados do cabeçalho do processo pelo repositório.
fn designacao(_m: &Mundo, pm: &str, papel: &str) -> DesignacaoRequest {
    DesignacaoRequest {
        id: None,
        policial_militar_id: pm.to_string(),
        papel_id: papel.to_string(),
    }
}

/// Designação que já existe no banco: o `id` é o que manda o repositório
/// ATUALIZAR a linha em vez de criar outra.
fn designacao_existente(id: &str, pm: &str, papel: &str) -> DesignacaoRequest {
    DesignacaoRequest {
        id: Some(id.to_string()),
        policial_militar_id: pm.to_string(),
        papel_id: papel.to_string(),
    }
}

/// Repõe no request os ids das designações já gravadas.
///
/// É o que a tela faz ao reabrir o formulário: ela lê o detalhe e leva o `id` de
/// cada designação vigente junto. Sem o id, o repositório entende "designação
/// nova" — e reenviar a mesma pessoa na mesma função vira duplicidade, não
/// edição.
async fn sincronizar_designacoes(pool: &PgPool, req: &mut SaveProceedingRequest, id: &str) {
    let detalhe = repository::get(pool, id).await.unwrap().unwrap();
    req.designacoes = detalhe
        .designacoes
        .into_iter()
        .filter(|d| d.data_fim.is_none())
        .map(|d| designacao_existente(&d.id, &d.policial_militar_id, &d.papel_id))
        .collect();
}

fn envolvido(m: &Mundo, pm: &str, ordem: i32) -> EnvolvidoRequest {
    EnvolvidoRequest {
        id: None,
        policial_militar_id: Some(pm.to_string()),
        status_envolvido_id: m.status_envolvido.clone(),
        ordem,
        e_condutor: false,
        acusacoes: None,
    }
}

fn envolvido_a_apurar(m: &Mundo, ordem: i32) -> EnvolvidoRequest {
    EnvolvidoRequest {
        id: None,
        policial_militar_id: None,
        status_envolvido_id: m.status_envolvido.clone(),
        ordem,
        e_condutor: false,
        acusacoes: None,
    }
}

/// Grava numa transação própria e devolve o erro já convertido em texto.
async fn salvar(pool: &PgPool, request: &SaveProceedingRequest) -> Result<String, String> {
    request.validate()?;
    let mut tx = pool.begin().await.unwrap();
    match repository::save(&mut tx, request).await {
        Ok(id) => {
            // O commit importa: as duas constraint triggers são DEFERRABLE
            // INITIALLY DEFERRED, então limite estourado só falha aqui.
            tx.commit().await.map_err(|e| e.to_string())?;
            Ok(id)
        }
        Err(e) => Err(e.message()),
    }
}

// ─────────────────────────────────────────────────────────── criação completa ──

#[tokio::test]
async fn acusacao_e_obrigatoria_no_processo_novo_e_preserva_legado_incompleto() {
    util::com_banco_descartavel("proc_acusacao_obrigatoria", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        sqlx::query(
            "UPDATE apuratorios
                SET permite_acusacao = true, permite_indicios = false,
                    permite_solucao_sugerida = false
              WHERE id = $1::uuid",
        )
        .bind(&m.apuratorio)
        .execute(&pool)
        .await
        .unwrap();

        let mut novo = base(&m, "AC-1");
        novo.envolvidos = vec![envolvido(&m, &m.pm_dois, 1)];
        assert!(salvar(&pool, &novo)
            .await
            .unwrap_err()
            .contains("ao menos uma acusação"));

        let transgressao: String =
            sqlx::query_scalar("SELECT id::text FROM transgressoes ORDER BY id LIMIT 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        novo.envolvidos[0].acusacoes = Some(AcusacoesRequest {
            transgressoes_ids: vec![transgressao],
            ..Default::default()
        });
        let id = salvar(&pool, &novo).await.unwrap();

        novo.id = Some(id.clone());
        sincronizar_designacoes(&pool, &mut novo, &id).await;
        novo.apuratorio_id = m.apuratorio_livre.clone();
        assert!(salvar(&pool, &novo)
            .await
            .unwrap_err()
            .contains("acusação ou indícios"));
        novo.apuratorio_id = m.apuratorio.clone();
        novo.envolvidos[0].acusacoes = Some(AcusacoesRequest::default());
        assert!(salvar(&pool, &novo)
            .await
            .unwrap_err()
            .contains("não pode ficar sem enquadramento"));

        // Um registro antigo que já estava vazio continua editável. Ele só não
        // pode nascer vazio depois que a capacidade foi ligada.
        sqlx::query("UPDATE apuratorios SET permite_acusacao = false WHERE id = $1::uuid")
            .bind(&m.apuratorio_livre)
            .execute(&pool)
            .await
            .unwrap();
        let mut legado = base(&m, "AC-LEGADO");
        legado.apuratorio_id = m.apuratorio_livre.clone();
        legado.envolvidos = vec![envolvido(&m, &m.pm_tres, 1)];
        let legado_id = salvar(&pool, &legado).await.unwrap();
        sqlx::query("UPDATE apuratorios SET permite_acusacao = true WHERE id = $1::uuid")
            .bind(&m.apuratorio_livre)
            .execute(&pool)
            .await
            .unwrap();
        legado.id = Some(legado_id.clone());
        legado.numero_documento = "AC-LEGADO-CORRIGIDO".to_string();
        sincronizar_designacoes(&pool, &mut legado, &legado_id).await;
        assert_eq!(salvar(&pool, &legado).await.unwrap(), legado_id);
    })
    .await;
}

#[tokio::test]
async fn acusacao_penal_depende_da_capacidade_do_apuratorio() {
    util::com_banco_descartavel("proc_acusacao_penal", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        sqlx::query("UPDATE apuratorios SET permite_acusacao = true WHERE id = $1::uuid")
            .bind(&m.apuratorio)
            .execute(&pool)
            .await
            .unwrap();
        let infracao: String =
            sqlx::query_scalar("SELECT id::text FROM infracoes_penais ORDER BY id LIMIT 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        let esfera: String =
            sqlx::query_scalar("SELECT id::text FROM esferas_penais ORDER BY id LIMIT 1")
                .fetch_one(&pool)
                .await
                .unwrap();

        let mut req = base(&m, "AC-PENAL");
        let mut acusado = envolvido(&m, &m.pm_dois, 1);
        acusado.acusacoes = Some(AcusacoesRequest {
            infracoes_penais: vec![SelecaoInfracaoPenal {
                infracao_penal_id: infracao,
                esfera_penal_id: esfera,
            }],
            ..Default::default()
        });
        req.envolvidos = vec![acusado];
        assert!(salvar(&pool, &req)
            .await
            .unwrap_err()
            .contains("disciplinares"));

        sqlx::query("UPDATE apuratorios SET permite_acusacao_penal = true WHERE id = $1::uuid")
            .bind(&m.apuratorio)
            .execute(&pool)
            .await
            .unwrap();
        assert!(salvar(&pool, &req).await.is_ok());
    })
    .await;
}

#[tokio::test]
async fn cria_processo_completo_em_uma_transacao() {
    util::com_banco_descartavel("proc_cria", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let mut req = base(&m, "001");
        req.numero_controle = Some("020".to_string());
        req.processo_sei = Some("SEI-1".to_string());
        req.resumo_fatos = Some("fato apurado".to_string());
        req.data_recebimento = Some(data(2026, 1, 12));
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1)];
        req.designacoes = vec![
            designacao(&m, &m.pm_um, &m.papel_encarregado),
            designacao(&m, &m.pm_tres, &m.papel_escrivao),
        ];
        req.pessoas = vec![
            PessoaRequest {
                papel_pessoa_id: m.papel_inquirido.clone(),
                nome: "ADMINISTRACAO PUBLICA".to_string(),
                ordem: 1,
            },
            PessoaRequest {
                papel_pessoa_id: m.papel_inquirido.clone(),
                nome: "FULANO DE TAL".to_string(),
                ordem: 2,
            },
        ];

        let id = salvar(&pool, &req).await.expect("criar processo completo");

        let detalhe = repository::get(&pool, &id).await.unwrap().expect("detalhe");
        assert_eq!(detalhe.cabecalho.numero_documento, "001");
        assert_eq!(detalhe.cabecalho.numero_controle, "020");
        assert!(!detalhe.cabecalho.concluido, "sem data_conclusao");
        assert_eq!(detalhe.envolvidos.len(), 1);
        assert_eq!(detalhe.designacoes.len(), 2);
        // Múltiplas vítimas: o legado guardava array JSON num campo TEXT.
        assert_eq!(detalhe.pessoas.len(), 2);

        // O responsável sai do papel marcado `e_responsavel`, sem nome de papel
        // no SQL — renomear "Encarregado" não pode quebrar a listagem.
        assert_eq!(detalhe.cabecalho.responsavel_nome.as_deref(), Some("PM UM"));
        assert_eq!(
            detalhe.cabecalho.responsavel_papel.as_deref(),
            Some("Encarregado Teste")
        );
        assert_eq!(detalhe.cabecalho.total_envolvidos, 1);
    })
    .await;
}

#[tokio::test]
async fn a_apurar_e_identificado_sem_perder_o_vinculo_e_os_indicios() {
    util::com_banco_descartavel("proc_a_apurar", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "A-APURAR-1");
        req.envolvidos = vec![envolvido_a_apurar(&m, 1)];

        let processo_id = salvar(&pool, &req).await.unwrap();
        let detalhe = repository::get(&pool, &processo_id).await.unwrap().unwrap();
        let envolvido_id = detalhe.envolvidos[0].id.clone();
        assert_eq!(detalhe.envolvidos[0].policial_militar_id, None);
        assert_eq!(detalhe.envolvidos[0].nome, "À apurar");

        sqlx::query(
            "INSERT INTO envolvido_categorias_indicio (envolvido_id, categoria_indicio_id)
             VALUES ($1::uuid, $2::uuid)",
        )
        .bind(&envolvido_id)
        .bind(&m.categoria_indicio)
        .execute(&pool)
        .await
        .unwrap();

        req.id = Some(processo_id.clone());
        req.envolvidos[0].id = Some(envolvido_id.clone());
        req.envolvidos[0].policial_militar_id = Some(m.pm_dois.clone());
        sincronizar_designacoes(&pool, &mut req, &processo_id).await;
        salvar(&pool, &req).await.unwrap();

        let detalhe = repository::get(&pool, &processo_id).await.unwrap().unwrap();
        assert_eq!(detalhe.envolvidos[0].id, envolvido_id);
        assert_eq!(
            detalhe.envolvidos[0].policial_militar_id.as_deref(),
            Some(m.pm_dois.as_str())
        );
        let indicios: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM envolvido_categorias_indicio WHERE envolvido_id = $1::uuid",
        )
        .bind(&detalhe.envolvidos[0].id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(indicios, 1);
    })
    .await;
}

#[tokio::test]
async fn prazo_inicial_nasce_com_os_dias_da_configuracao() {
    util::com_banco_descartavel("proc_prazo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // Sem data de recebimento não há prazo: o relógio começa quando o
        // encarregado recebe.
        let sem_prazo = salvar(&pool, &base(&m, "001")).await.unwrap();
        let n: i64 =
            sqlx::query_scalar("SELECT count(*) FROM processo_prazos WHERE processo_id = $1::uuid")
                .bind(&sem_prazo)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(n, 0);

        // Documento sem prazo próprio: herda os 30 dias do apuratório.
        let mut req = base(&m, "002");
        req.data_recebimento = Some(data(2026, 1, 12));
        let herdado = salvar(&pool, &req).await.unwrap();

        // Documento com prazo próprio: os 15 dias sobrepõem. É o
        // `if documento == "Feito Preliminar" { 15 }` que virou dado.
        let mut req = base(&m, "003");
        req.documento_iniciador_id = m.documento_curto.clone();
        req.data_recebimento = Some(data(2026, 1, 12));
        let proprio = salvar(&pool, &req).await.unwrap();

        for (processo, dias) in [
            (&herdado, PRAZO_APURATORIO),
            (&proprio, PRAZO_DOCUMENTO_CURTO),
        ] {
            let (ordem, inicio, d, vencimento): (i32, NaiveDate, i32, NaiveDate) = sqlx::query_as(
                "SELECT ordem, data_inicio, dias, data_vencimento FROM processo_prazos
                      WHERE processo_id = $1::uuid",
            )
            .bind(processo)
            .fetch_one(&pool)
            .await
            .unwrap();
            assert_eq!(ordem, 0, "prazo inicial e ordem 0");
            assert_eq!(inicio, data(2026, 1, 12));
            assert_eq!(d, dias);
            // Coluna gerada `data_inicio + dias`. A divergência +dias × +dias-1
            // que existia entre dois módulos ficou impossível.
            assert_eq!(vencimento, inicio + chrono::Duration::days(dias as i64));
        }
    })
    .await;
}

#[tokio::test]
async fn edicao_substitui_colecoes_e_nao_duplica_o_prazo_inicial() {
    util::com_banco_descartavel("proc_edita", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let mut req = base(&m, "001");
        req.data_recebimento = Some(data(2026, 1, 12));
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1)];
        req.pessoas = vec![PessoaRequest {
            papel_pessoa_id: m.papel_inquirido.clone(),
            nome: "VITIMA UM".to_string(),
            ordem: 1,
        }];
        let id = salvar(&pool, &req).await.unwrap();

        // Reenvia com outro envolvido e outra vítima: as coleções são
        // substituídas, não acumuladas.
        req.id = Some(id.clone());
        sincronizar_designacoes(&pool, &mut req, &id).await;
        req.envolvidos = vec![envolvido(&m, &m.pm_tres, 1)];
        req.pessoas = vec![PessoaRequest {
            papel_pessoa_id: m.papel_inquirido.clone(),
            nome: "VITIMA DOIS".to_string(),
            ordem: 1,
        }];
        req.resumo_fatos = Some("texto revisado".to_string());
        req.data_recebimento = Some(data(2026, 1, 15));
        let mesmo = salvar(&pool, &req).await.expect("editar");
        assert_eq!(mesmo, id, "edicao preserva o id");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.envolvidos.len(), 1);
        assert_eq!(
            detalhe.envolvidos[0].policial_militar_id.as_deref(),
            Some(m.pm_tres.as_str())
        );
        assert_eq!(detalhe.pessoas.len(), 1);
        assert_eq!(detalhe.pessoas[0].nome, "VITIMA DOIS");
        assert_eq!(
            detalhe.cabecalho.resumo_fatos.as_deref(),
            Some("texto revisado")
        );
        assert_eq!(detalhe.cabecalho.data_recebimento, Some(data(2026, 1, 15)));

        // A edição move o prazo existente em vez de criar outro. Os dias
        // originalmente concedidos permanecem, e a coluna gerada recalcula o
        // vencimento a partir da nova data.
        let prazos = deadlines_repository::list(&pool, &id).await.unwrap();
        assert_eq!(prazos.len(), 1);
        assert_eq!(prazos[0].data_inicio, data(2026, 1, 15));
        assert_eq!(prazos[0].dias, PRAZO_APURATORIO);
        assert_eq!(prazos[0].data_vencimento, data(2026, 2, 14));
    })
    .await;
}

#[tokio::test]
async fn edicao_cria_remove_e_repara_o_prazo_inicial() {
    util::com_banco_descartavel("proc_edita_prazo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "001");
        let id = salvar(&pool, &req).await.unwrap();
        req.id = Some(id.clone());
        sincronizar_designacoes(&pool, &mut req, &id).await;

        // Preencher o recebimento depois do cadastro cria a ordem zero.
        req.data_recebimento = Some(data(2026, 1, 12));
        salvar(&pool, &req).await.expect("adicionar recebimento");
        let prazos = deadlines_repository::list(&pool, &id).await.unwrap();
        assert_eq!(prazos.len(), 1);
        assert_eq!(prazos[0].data_inicio, data(2026, 1, 12));

        // Mesmo com a data do cabeçalho preenchida, uma inconsistência antiga
        // sem prazo é reparada na próxima edição.
        sqlx::query("DELETE FROM processo_prazos WHERE processo_id = $1::uuid")
            .bind(&id)
            .execute(&pool)
            .await
            .unwrap();
        salvar(&pool, &req).await.expect("reparar prazo ausente");
        assert_eq!(
            deadlines_repository::list(&pool, &id).await.unwrap().len(),
            1
        );

        // Limpar o recebimento remove também o prazo inicial.
        req.data_recebimento = None;
        salvar(&pool, &req).await.expect("limpar recebimento");
        assert!(deadlines_repository::list(&pool, &id)
            .await
            .unwrap()
            .is_empty());
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.cabecalho.data_recebimento, None);
    })
    .await;
}

#[tokio::test]
async fn recebimento_nao_muda_depois_de_prorrogacao() {
    util::com_banco_descartavel("proc_prazo_historico", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "001");
        req.data_recebimento = Some(data(2026, 1, 12));
        let id = salvar(&pool, &req).await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        deadlines_repository::add_extension(
            &mut tx,
            &AddExtensionRequest {
                processo_id: id.clone(),
                nova_data_vencimento: data(2026, 2, 21),
                motivo: "diligências pendentes".to_string(),
                documento_autorizador_id: None,
                numero_documento: None,
                data_documento: None,
                autoridade_id: None,
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        // Cria outro número para provar que a validação da data acontece antes
        // do UPDATE e não é mascarada por uma constraint do banco.
        let outro = base(&m, "002");
        salvar(&pool, &outro).await.unwrap();

        req.id = Some(id.clone());
        req.numero_documento = "002".to_string();
        req.data_recebimento = Some(data(2026, 1, 13));
        let erro = salvar(&pool, &req)
            .await
            .expect_err("nao reescreve cadeia prorrogada");
        assert!(erro.contains("já possui prorrogação"), "{erro}");
        assert!(!erro.contains("banco de dados"), "{erro}");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.cabecalho.data_recebimento, Some(data(2026, 1, 12)));
        assert_eq!(
            deadlines_repository::list(&pool, &id).await.unwrap().len(),
            2
        );
    })
    .await;
}

// ────────────────────────────────── validações dirigidas por configuração ──
//
// Cada uma destas substituiu um literal no código. O teste garante que quem
// decide é o atributo do catálogo, e não uma sigla escrita no Rust.

#[tokio::test]
async fn exige_natureza_do_fato_quando_o_apuratorio_manda() {
    util::com_banco_descartavel("proc_val_nat", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let mut req = base(&m, "001");
        req.natureza_fato_id = None;
        let erro = salvar(&pool, &req).await.expect_err("natureza obrigatoria");
        assert!(erro.contains("natureza"), "mensagem: {erro}");

        // O mesmo processo passa no apuratório que não exige natureza.
        let mut req = base(&m, "001");
        req.apuratorio_id = m.apuratorio_livre.clone();
        req.natureza_fato_id = None;
        salvar(&pool, &req).await.expect("apuratorio sem exigencia");
    })
    .await;
}

#[tokio::test]
async fn exige_condutor_quando_a_natureza_do_fato_pede() {
    util::com_banco_descartavel("proc_val_cond", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // Substitui o `natureza.includes('sinistro de trânsito')` do frontend.
        let mut req = base(&m, "001");
        req.natureza_fato_id = Some(m.natureza_transito.clone());
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1)];
        let erro = salvar(&pool, &req).await.expect_err("condutor obrigatorio");
        assert!(erro.contains("condutor"), "mensagem: {erro}");

        req.envolvidos[0].e_condutor = true;
        salvar(&pool, &req).await.expect("com condutor indicado");
    })
    .await;
}

#[tokio::test]
async fn penalidade_so_onde_a_solucao_permite_e_dias_so_onde_a_penalidade_usa() {
    util::com_banco_descartavel("proc_val_pena", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        sqlx::query("UPDATE apuratorios SET permite_punicao = true WHERE id = $1::uuid")
            .bind(&m.apuratorio)
            .execute(&pool)
            .await
            .unwrap();

        // Era `solucao_tipo == "Punido"`; virou `tipos_solucao_decidida.permite_penalidade`.
        let mut req = base(&m, "001");
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1)];
        let id = salvar(&pool, &req).await.unwrap();
        let envolvido_id = repository::get(&pool, &id)
            .await
            .unwrap()
            .unwrap()
            .envolvidos[0]
            .id
            .clone();

        let mut resultado = UpdateInvolvedOutcomeRequest {
            processo_id: id.clone(),
            envolvido_id,
            solucao_sugerida_id: None,
            solucao_decidida_id: Some(m.solucao_absolvido.clone()),
            penalidade_tipo_id: Some(m.penalidade_prisao.clone()),
            penalidade_dias: None,
        };
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_involved_outcome(&mut tx, &resultado)
            .await
            .expect_err("solucao nao permite penalidade")
            .message();
        assert!(erro.contains("penalidade"), "mensagem: {erro}");

        // Era `Some("Prisao") | Some("Detencao")`; virou
        // `tipos_penalidade.usa_quantidade_dias`.
        resultado.solucao_decidida_id = Some(m.solucao_punido.clone());
        resultado.penalidade_tipo_id = Some(m.penalidade_repreensao.clone());
        resultado.penalidade_dias = Some(5);
        let erro = repository::update_involved_outcome(&mut tx, &resultado)
            .await
            .expect_err("penalidade nao usa dias")
            .message();
        assert!(erro.contains("dias"), "mensagem: {erro}");

        // A combinação coerente passa.
        resultado.solucao_sugerida_id = Some(m.solucao_sugerida.clone());
        resultado.penalidade_tipo_id = Some(m.penalidade_prisao.clone());
        repository::update_involved_outcome(&mut tx, &resultado)
            .await
            .expect("punido com dias de prisao");
        tx.commit().await.unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        let e = &detalhe.envolvidos[0];
        assert_eq!(e.penalidade_dias, Some(5));
        // Sugerida e decidida são conceitos distintos: o encarregado sugere, a
        // autoridade decide. Dois campos, dois catálogos.
        assert_eq!(e.solucao_sugerida.as_deref(), Some("Sugerido Teste"));
        assert_eq!(e.solucao_decidida.as_deref(), Some("Punido Teste"));
    })
    .await;
}

#[tokio::test]
async fn processo_rejeita_solucao_sugerida_e_preserva_valor_historico() {
    util::com_banco_descartavel("proc_sem_sugerida", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "SEM-SUG");
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1)];
        let id = salvar(&pool, &req).await.unwrap();
        let envolvido_id = repository::get(&pool, &id)
            .await
            .unwrap()
            .unwrap()
            .envolvidos[0]
            .id
            .clone();

        sqlx::query(
            "UPDATE processo_envolvidos SET solucao_sugerida_id = $2::uuid WHERE id = $1::uuid",
        )
        .bind(&envolvido_id)
        .bind(&m.solucao_sugerida)
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("UPDATE apuratorios SET permite_solucao_sugerida = false WHERE id = $1::uuid")
            .bind(&m.apuratorio)
            .execute(&pool)
            .await
            .unwrap();

        let mut tx = pool.begin().await.unwrap();
        let mut resultado = UpdateInvolvedOutcomeRequest {
            processo_id: id.clone(),
            envolvido_id: envolvido_id.clone(),
            solucao_sugerida_id: Some(m.solucao_sugerida.clone()),
            solucao_decidida_id: Some(m.solucao_absolvido.clone()),
            penalidade_tipo_id: None,
            penalidade_dias: None,
        };
        let erro = repository::update_involved_outcome(&mut tx, &resultado)
            .await
            .unwrap_err()
            .message();
        assert!(erro.contains("somente para procedimentos"), "{erro}");
        tx.rollback().await.unwrap();

        resultado.solucao_sugerida_id = None;
        let mut tx = pool.begin().await.unwrap();
        repository::update_involved_outcome(&mut tx, &resultado)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(
            detalhe.envolvidos[0].solucao_sugerida_id.as_deref(),
            Some(m.solucao_sugerida.as_str())
        );
    })
    .await;
}

#[tokio::test]
async fn dados_pos_cadastro_sao_corrigidos_sem_o_save_geral_apaga_los() {
    util::com_banco_descartavel("proc_pos_cadastro", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        sqlx::query(
            "UPDATE apuratorios
                SET permite_punicao = true, permite_remessa_comissao = true,
                    permite_julgamento = true
              WHERE id = $1::uuid",
        )
        .bind(&m.apuratorio)
        .execute(&pool)
        .await
        .unwrap();
        let mut req = base(&m, "001");
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1)];
        let id = salvar(&pool, &req).await.unwrap();
        let envolvido_id = repository::get(&pool, &id)
            .await
            .unwrap()
            .unwrap()
            .envolvidos[0]
            .id
            .clone();

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: Some(data(2026, 1, 9)),
                data_julgamento: None,
                data_conclusao: None,
            },
        )
        .await
        .expect_err("data posterior nao antecede a instauracao")
        .message();
        assert!(erro.contains("anterior à instauração"), "{erro}");
        tx.rollback().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: Some(data(2026, 2, 2)),
                data_remessa_comissao: Some(data(2026, 2, 2)),
                data_julgamento: None,
                data_conclusao: None,
            },
        )
        .await
        .expect_err("rito de comissao tem uma unica remessa")
        .message();
        assert!(erro.contains("somente a remessa à comissão"), "{erro}");
        tx.rollback().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: Some(data(2026, 2, 2)),
                data_julgamento: Some(data(2026, 2, 3)),
                data_conclusao: Some(data(2026, 2, 4)),
            },
        )
        .await
        .unwrap();
        repository::update_involved_outcome(
            &mut tx,
            &UpdateInvolvedOutcomeRequest {
                processo_id: id.clone(),
                envolvido_id: envolvido_id.clone(),
                solucao_sugerida_id: Some(m.solucao_sugerida.clone()),
                solucao_decidida_id: Some(m.solucao_punido.clone()),
                penalidade_tipo_id: Some(m.penalidade_prisao.clone()),
                penalidade_dias: Some(3),
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        req.id = Some(id.clone());
        sincronizar_designacoes(&pool, &mut req, &id).await;
        req.resumo_fatos = Some("correção dos dados gerais".to_string());
        salvar(&pool, &req).await.unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.data_remessa_encarregado, None);
        assert_eq!(detalhe.data_remessa_comissao, Some(data(2026, 2, 2)));
        assert_eq!(detalhe.data_julgamento, Some(data(2026, 2, 3)));
        assert_eq!(detalhe.cabecalho.data_conclusao, Some(data(2026, 2, 4)));
        assert_eq!(detalhe.envolvidos[0].penalidade_dias, Some(3));

        // Desligar a configuração não apaga nem torna inacessível o fato já
        // registrado. Ele ainda pode ser corrigido ou removido no detalhe.
        sqlx::query(
            "UPDATE apuratorios
                SET permite_remessa_comissao = false, permite_julgamento = false
              WHERE id = $1::uuid",
        )
        .bind(&m.apuratorio)
        .execute(&pool)
        .await
        .unwrap();

        // Remessas e julgamento podem ser apagados, mas conclusão tem uma
        // operação explícita.
        let mut tx = pool.begin().await.unwrap();
        repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: None,
                data_julgamento: None,
                data_conclusao: Some(data(2026, 2, 5)),
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        // Depois de removido o fato histórico, a configuração volta a governar
        // novas datas e recusa comissão ou julgamento onde não são previstos.
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: Some(data(2026, 2, 4)),
                data_julgamento: None,
                data_conclusao: Some(data(2026, 2, 5)),
            },
        )
        .await
        .expect_err("comissao desligada nao aceita fato novo")
        .message();
        assert!(erro.contains("não prevê remessa"), "{erro}");

        let erro = repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: None,
                data_julgamento: Some(data(2026, 2, 4)),
                data_conclusao: Some(data(2026, 2, 5)),
            },
        )
        .await
        .expect_err("julgamento desligado nao aceita fato novo")
        .message();
        assert!(erro.contains("não prevê data de julgamento"), "{erro}");
        tx.rollback().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id,
                data_remessa_encarregado: None,
                data_remessa_comissao: None,
                data_julgamento: None,
                data_conclusao: None,
            },
        )
        .await
        .expect_err("conclusao so sai por reabrir")
        .message();
        assert!(erro.contains("Reabrir"), "{erro}");
    })
    .await;
}

#[tokio::test]
async fn datas_do_fluxo_respeitam_ordem_sem_tornar_etapas_obrigatorias() {
    util::com_banco_descartavel("proc_ordem_datas", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        sqlx::query(
            "UPDATE apuratorios
                SET permite_remessa_comissao = true, permite_julgamento = true
              WHERE id = $1::uuid",
        )
        .bind(&m.apuratorio)
        .execute(&pool)
        .await
        .unwrap();

        let mut invertido = base(&m, "001");
        invertido.data_recebimento = Some(data(2026, 1, 9));
        let erro = salvar(&pool, &invertido).await.unwrap_err();
        assert!(
            erro.contains("recebimento") && erro.contains("instauração"),
            "{erro}"
        );

        let mut req = base(&m, "002");
        req.data_recebimento = Some(data(2026, 1, 12));
        let id = salvar(&pool, &req).await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: Some(data(2026, 1, 11)),
                data_julgamento: None,
                data_conclusao: None,
            },
        )
        .await
        .unwrap_err()
        .message();
        assert!(
            erro.contains("remessa à comissão") && erro.contains("recebimento"),
            "{erro}"
        );
        tx.rollback().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: Some(data(2026, 1, 14)),
                data_julgamento: Some(data(2026, 1, 13)),
                data_conclusao: None,
            },
        )
        .await
        .unwrap_err()
        .message();
        assert!(
            erro.contains("julgamento") && erro.contains("remessa à comissão"),
            "{erro}"
        );
        tx.rollback().await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        let erro = repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: Some(data(2026, 1, 13)),
                data_julgamento: Some(data(2026, 1, 15)),
                data_conclusao: Some(data(2026, 1, 14)),
            },
        )
        .await
        .unwrap_err()
        .message();
        assert!(
            erro.contains("conclusão") && erro.contains("julgamento"),
            "{erro}"
        );
        tx.rollback().await.unwrap();

        // Igualdade é válida em toda a cadeia.
        let mut tx = pool.begin().await.unwrap();
        repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: Some(data(2026, 1, 12)),
                data_julgamento: Some(data(2026, 1, 12)),
                data_conclusao: Some(data(2026, 1, 12)),
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        // O cabeçalho não pode ser movido para depois dos fatos que a tela de
        // edição geral não exibe.
        req.id = Some(id.clone());
        sincronizar_designacoes(&pool, &mut req, &id).await;
        req.data_recebimento = Some(data(2026, 1, 13));
        let erro = salvar(&pool, &req).await.unwrap_err();
        assert!(
            erro.contains("remessa à comissão") && erro.contains("recebimento"),
            "{erro}"
        );

        req.data_recebimento = None;
        req.data_instauracao = data(2026, 1, 13);
        let erro = salvar(&pool, &req).await.unwrap_err();
        assert!(
            erro.contains("remessa à comissão") && erro.contains("instauração"),
            "{erro}"
        );

        // A ausência de Recebimento e Remessa não impede uma Conclusão; apenas
        // as datas que existem participam da comparação.
        let mut opcional = base(&m, "003");
        opcional.data_recebimento = None;
        let opcional_id = salvar(&pool, &opcional).await.unwrap();
        let mut tx = pool.begin().await.unwrap();
        repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: opcional_id,
                data_remessa_encarregado: None,
                data_remessa_comissao: None,
                data_julgamento: None,
                data_conclusao: Some(data(2026, 1, 10)),
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();
    })
    .await;
}

#[tokio::test]
async fn remessa_do_encarregado_continua_nos_apuratorios_sem_comissao() {
    util::com_banco_descartavel("proc_remessa_encarregado", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "001");
        req.apuratorio_id = m.apuratorio_livre;
        req.natureza_fato_id = None;
        let id = salvar(&pool, &req).await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: Some(data(2026, 2, 1)),
                data_remessa_comissao: None,
                data_julgamento: None,
                data_conclusao: None,
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.data_remessa_encarregado, Some(data(2026, 2, 1)));
        assert_eq!(detalhe.data_remessa_comissao, None);
    })
    .await;
}

#[tokio::test]
async fn recusa_salvar_sem_os_papeis_obrigatorios_do_apuratorio() {
    util::com_banco_descartavel("proc_val_papel", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // Um papel `obrigatorio` que não bloqueia não significaria nada. Quem
        // quiser permitir a ausência desmarca `obrigatorio` no apuratório —
        // quem decide é a configuração, não o código.
        let mut req = base(&m, "001");
        req.designacoes = vec![];
        let erro = salvar(&pool, &req)
            .await
            .expect_err("papel obrigatorio ausente");
        assert!(
            erro.contains("Falta designar quem responde por"),
            "mensagem: {erro}"
        );
        assert!(
            erro.contains("Encarregado Teste"),
            "o erro deve nomear o papel que falta: {erro}"
        );
    })
    .await;
}

#[tokio::test]
async fn exige_carta_precatoria_quando_o_apuratorio_tem_a_extensao() {
    util::com_banco_descartavel("proc_val_cp", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let mut req = base(&m, "001");
        req.apuratorio_id = m.apuratorio_cp.clone();
        req.natureza_fato_id = None;
        let erro = salvar(&pool, &req).await.expect_err("extensao exigida");
        assert!(erro.contains("deprecante"), "mensagem: {erro}");

        req.carta_precatoria = Some(CartaPrecatoriaRequest {
            deprecante: "Juizo Deprecante".to_string(),
            unidade_deprecada_id: m.unidade_deprecada.clone(),
        });
        let id = salvar(&pool, &req)
            .await
            .expect("com a extensao preenchida");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        let cp = detalhe.carta_precatoria.expect("extensao gravada");
        assert_eq!(cp.deprecante, "Juizo Deprecante");
        assert_eq!(cp.unidade_deprecada, "Unidade Deprecada");

        // Trocar a espécie do apuratório depois de haver designação é recusado
        // com uma regra de negócio legível — antes vazava a violação de FK
        // composta do PostgreSQL direto na tela do usuário.
        let mut req2 = base(&m, "001");
        req2.id = Some(id.clone());
        let erro = salvar(&pool, &req2)
            .await
            .expect_err("trocar a especie com designacao registrada");
        assert!(
            erro.contains("designacoes registradas") && erro.contains("TST-C"),
            "mensagem: {erro}"
        );
    })
    .await;
}

#[tokio::test]
async fn validacoes_puras_do_request() {
    util::com_banco_descartavel("proc_val_puro", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let mut req = base(&m, "001");
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1), envolvido(&m, &m.pm_tres, 1)];
        assert!(salvar(&pool, &req).await.unwrap_err().contains("ordem"));

        let mut req = base(&m, "001");
        req.envolvidos = vec![
            EnvolvidoRequest {
                e_condutor: true,
                ..envolvido(&m, &m.pm_dois, 1)
            },
            EnvolvidoRequest {
                e_condutor: true,
                ..envolvido(&m, &m.pm_tres, 2)
            },
        ];
        assert!(salvar(&pool, &req).await.unwrap_err().contains("condutor"));

        let mut req = base(&m, "001");
        req.envolvidos = vec![envolvido_a_apurar(&m, 1), envolvido_a_apurar(&m, 2)];
        assert!(salvar(&pool, &req).await.unwrap_err().contains("À apurar"));

        let mut req = base(&m, "001");
        req.envolvidos = vec![EnvolvidoRequest {
            e_condutor: true,
            ..envolvido_a_apurar(&m, 1)
        }];
        assert!(salvar(&pool, &req)
            .await
            .unwrap_err()
            .contains("identificado"));

        let mut req = base(&m, "001");
        req.data_instauracao = chrono::Local::now().date_naive() + chrono::Duration::days(1);
        assert!(salvar(&pool, &req).await.unwrap_err().contains("futura"));

        let datas = UpdateProceedingDatesRequest {
            processo_id: "nao-importa-na-validacao-pura".to_string(),
            data_remessa_encarregado: None,
            data_remessa_comissao: None,
            data_julgamento: Some(chrono::Local::now().date_naive() + chrono::Duration::days(1)),
            data_conclusao: None,
        };
        assert!(datas.validate().unwrap_err().contains("julgamento"));
    })
    .await;
}

// ─────────────────────────────── invariantes garantidas pelo PostgreSQL ──

#[tokio::test]
async fn limite_de_envolvidos_e_configuravel_e_nao_reescreve_o_passado() {
    util::com_banco_descartavel("proc_maxenv", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // O apuratório principal aceita 1 envolvido; o livre, ilimitado.
        let mut req = base(&m, "001");
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1), envolvido(&m, &m.pm_tres, 2)];
        let erro = salvar(&pool, &req)
            .await
            .expect_err("estoura max_envolvidos");
        assert!(erro.contains("envolvid"), "mensagem: {erro}");

        let mut livre = base(&m, "002");
        livre.apuratorio_id = m.apuratorio_livre.clone();
        livre.natureza_fato_id = None;
        livre.envolvidos = vec![envolvido(&m, &m.pm_dois, 1), envolvido(&m, &m.pm_tres, 2)];
        let id = salvar(&pool, &livre).await.expect("apuratorio ilimitado");

        // Baixar o limite depois BLOQUEIA escritas novas e NÃO invalida o que
        // já existe: configuração define o comportamento futuro, não reescreve
        // fatos registrados.
        sqlx::query("UPDATE apuratorios SET max_envolvidos = 1 WHERE id = $1::uuid")
            .bind(&m.apuratorio_livre)
            .execute(&pool)
            .await
            .unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.envolvidos.len(), 2, "linhas existentes preservadas");

        let mut novo = base(&m, "003");
        novo.apuratorio_id = m.apuratorio_livre.clone();
        novo.natureza_fato_id = None;
        novo.envolvidos = vec![envolvido(&m, &m.pm_dois, 1), envolvido(&m, &m.pm_tres, 2)];
        assert!(
            salvar(&pool, &novo).await.is_err(),
            "novo respeita o limite novo"
        );
    })
    .await;
}

#[tokio::test]
async fn banco_recusa_papel_nao_previsto_para_o_apuratorio() {
    util::com_banco_descartavel("proc_fkpapel", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // "Escrivão só em IPM" deixou de ser uma sigla no código: é a FK
        // composta (apuratorio_id, papel_id) → apuratorio_papeis que garante.
        // O apuratório livre não prevê Escrivão.
        let mut req = base(&m, "001");
        req.apuratorio_id = m.apuratorio_livre.clone();
        req.natureza_fato_id = None;
        req.designacoes = vec![
            designacao(&m, &m.pm_um, &m.papel_encarregado),
            designacao(&m, &m.pm_tres, &m.papel_escrivao),
        ];
        let erro = salvar(&pool, &req).await.expect_err("papel nao previsto");
        // A regra é a mesma; o que mudou é quem responde. Antes só a FK
        // composta recusava, e o usuário lia o fallback genérico do banco.
        // Agora a aplicação consulta `apuratorio_papeis` antes de escrever e
        // diz o que fazer — a FK segue no lugar, como rede.
        assert!(
            erro.contains("não está prevista para esta espécie de apuratório"),
            "esperado erro de dominio: {erro}"
        );
        assert!(!erro.contains("fk_designacao") && !erro.contains("foreign key"));
        assert!(!erro.contains("banco de dados"));
    })
    .await;
}

#[tokio::test]
async fn numeracao_e_unica_entre_processos_ativos() {
    util::com_banco_descartavel("proc_numero", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let id = salvar(&pool, &base(&m, "001")).await.unwrap();
        let erro = salvar(&pool, &base(&m, "001"))
            .await
            .expect_err("numero repetido");
        assert!(erro.contains("este número de documento"), "{erro}");
        assert!(!erro.contains("uq_processo") && !erro.contains("duplicate"));

        // O índice é PARCIAL (`WHERE ativo`): depois do soft delete o número
        // volta a ficar livre.
        let mut tx = pool.begin().await.unwrap();
        repository::soft_delete(&mut tx, &id).await.unwrap();
        tx.commit().await.unwrap();
        salvar(&pool, &base(&m, "001"))
            .await
            .expect("numero liberado");

        // Ano diferente não colide: a unicidade é por unidade, ano, apuratório
        // e documento.
        let mut outro_ano = base(&m, "001");
        outro_ano.data_instauracao = data(2025, 3, 4);
        salvar(&pool, &outro_ano).await.expect("outro ano");

        // `numero_controle` ausente significa "igual ao número do documento" —
        // materializado por COALESCE no índice, sem coluna redundante.
        let mut controle = base(&m, "009");
        controle.numero_controle = Some("001".to_string());
        let erro = salvar(&pool, &controle)
            .await
            .expect_err("controle colide com o numero de documento existente");
        assert!(erro.contains("este número de controle"), "{erro}");
        assert!(!erro.contains("uq_processo") && !erro.contains("duplicate"));
    })
    .await;
}

#[tokio::test]
async fn subunidade_compõe_numeracao_origem_e_integridade() {
    util::com_banco_descartavel("proc_subunidade", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let sem_subunidade = salvar(&pool, &base(&m, "SUB-001")).await.unwrap();

        let mut com_subunidade = base(&m, "SUB-001");
        com_subunidade.subunidade_secao_origem_id = Some(m.subunidade.clone());
        let com_subunidade_id = salvar(&pool, &com_subunidade)
            .await
            .expect("NULL e subunidade sao escopos diferentes");

        let erro = salvar(&pool, &com_subunidade)
            .await
            .expect_err("mesma subunidade colide");
        assert!(erro.contains("mesma unidade/subunidade"), "{erro}");

        let segunda: String = sqlx::query_scalar(
            "INSERT INTO subunidades_secoes (unidade_pm_id, nome)
             VALUES ($1::uuid, '2ª CIA Teste') RETURNING id::text",
        )
        .bind(&m.unidade)
        .fetch_one(&pool)
        .await
        .unwrap();
        let mut outra_subunidade = base(&m, "SUB-001");
        outra_subunidade.subunidade_secao_origem_id = Some(segunda);
        salvar(&pool, &outra_subunidade)
            .await
            .expect("subunidades diferentes nao colidem");

        let detalhe_sem = repository::get(&pool, &sem_subunidade)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(detalhe_sem.cabecalho.subunidade_secao_origem, None);
        assert_eq!(
            detalhe_sem.cabecalho.rotulo,
            "TST-A nº SUB-001/2026/Unidade Teste"
        );

        let detalhe_com = repository::get(&pool, &com_subunidade_id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            detalhe_com.cabecalho.subunidade_secao_origem.as_deref(),
            Some("1ª CIA Teste")
        );
        assert_eq!(
            detalhe_com.cabecalho.rotulo,
            "TST-A nº SUB-001/2026/Unidade Teste/1ª CIA Teste"
        );

        let mut incompativel = base(&m, "SUB-002");
        incompativel.subunidade_secao_origem_id = Some(m.subunidade_outra_unidade.clone());
        let erro = salvar(&pool, &incompativel)
            .await
            .expect_err("subunidade de outra unidade");
        assert!(erro.contains("não pertence à unidade"), "{erro}");
    })
    .await;
}

#[tokio::test]
async fn substituicao_de_designacao_encosta_os_periodos_sem_sobrepor() {
    util::com_banco_descartavel("proc_subst", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();

        let vigente = vigente_de(&pool, &id, &m.papel_encarregado).await;
        substituir(&pool, &id, &vigente, &m.pm_dois, data(2026, 2, 1))
            .await
            .expect("substituir o encarregado");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(
            detalhe.designacoes.len(),
            2,
            "a anterior e historico, nao some"
        );

        let anterior = detalhe
            .designacoes
            .iter()
            .find(|d| d.policial_militar_id == m.pm_um)
            .unwrap();
        let sucessor = detalhe
            .designacoes
            .iter()
            .find(|d| d.policial_militar_id == m.pm_dois)
            .unwrap();

        // `data_fim` é EXCLUSIVA: o sucessor começa exatamente no dia da troca.
        // Intervalo semiaberto `[)` — sem sobreposição e sem lacuna, com uma
        // única data registrada, como o legado fazia.
        assert_eq!(anterior.data_fim, Some(data(2026, 2, 1)));
        assert_eq!(sucessor.data_inicio, data(2026, 2, 1));
        assert_eq!(sucessor.data_fim, None, "o sucessor esta vigente");

        // O responsável da listagem passa a ser o sucessor.
        assert_eq!(
            detalhe.cabecalho.responsavel_nome.as_deref(),
            Some("PM DOIS")
        );
    })
    .await;
}

// ─────────────────────────────────────────── auxiliares da substituição ──

/// O id da designação vigente de um papel. A tela trabalha assim: a ação
/// "Substituir" nasce de uma linha da tabela, que é uma designação específica.
async fn vigente_de(pool: &PgPool, processo_id: &str, papel_id: &str) -> String {
    let detalhe = repository::get(pool, processo_id).await.unwrap().unwrap();
    detalhe
        .designacoes
        .into_iter()
        .find(|d| d.papel_id == papel_id && d.data_fim.is_none())
        .expect("designacao vigente do papel")
        .id
}

async fn substituir(
    pool: &PgPool,
    processo_id: &str,
    designacao_id: &str,
    sucessor: &str,
    quando: NaiveDate,
) -> Result<String, String> {
    substituir_com(
        pool,
        SubstituirDesignacaoRequest {
            processo_id: processo_id.to_string(),
            designacao_id: designacao_id.to_string(),
            sucessor_id: sucessor.to_string(),
            data_troca: quando,
            motivo: "ferias do titular".to_string(),
            documento_autorizador_id: None,
            numero_documento: None,
        },
    )
    .await
}

/// Percorre o mesmo caminho do comando: valida o request e só então grava.
async fn substituir_com(
    pool: &PgPool,
    request: SubstituirDesignacaoRequest,
) -> Result<String, String> {
    request.validate()?;
    let mut tx = pool.begin().await.unwrap();
    let resultado = repository::substituir_designacao(&mut tx, &request).await;
    match resultado {
        Ok(aplicada) => {
            tx.commit().await.map_err(|e| e.to_string())?;
            Ok(aplicada.designacao_id)
        }
        Err(erro) => Err(erro.message()),
    }
}

async fn atualizar_substituicao(
    pool: &PgPool,
    request: AtualizarSubstituicaoRequest,
) -> Result<(), String> {
    request.validate()?;
    let mut tx = pool.begin().await.unwrap();
    match repository::atualizar_substituicao(&mut tx, &request).await {
        Ok(_) => tx.commit().await.map_err(|e| e.to_string()),
        Err(erro) => Err(erro.message()),
    }
}

async fn remover_substituicao(
    pool: &PgPool,
    processo_id: &str,
    designacao_id: &str,
) -> Result<(), String> {
    let mut tx = pool.begin().await.unwrap();
    match repository::remover_substituicao(&mut tx, processo_id, designacao_id).await {
        Ok(_) => tx.commit().await.map_err(|e| e.to_string()),
        Err(erro) => Err(erro.message()),
    }
}

/// Correção padrão da última substituição: muda o que o teste pedir, mantendo o
/// resto igual.
fn correcao(
    processo_id: &str,
    designacao_id: &str,
    sucessor: &str,
    quando: NaiveDate,
) -> AtualizarSubstituicaoRequest {
    AtualizarSubstituicaoRequest {
        processo_id: processo_id.to_string(),
        designacao_id: designacao_id.to_string(),
        sucessor_id: sucessor.to_string(),
        data_troca: quando,
        motivo: "correcao do registro".to_string(),
        documento_autorizador_id: None,
        numero_documento: None,
    }
}

// ────────────────────────────────────────────── a cadeia de substituição ──

/// Cada função tem a SUA cadeia, e a "última" de uma não depende da outra.
///
/// É a regra que o `max_ocupantes` torna visível: o mesmo processo pode ter duas
/// cadeias correndo em paralelo. A versão anterior de `substituir_designacao`
/// encerrava por papel (`WHERE papel_id = $2 AND data_fim IS NULL`) e teria
/// derrubado as duas de uma vez.
#[tokio::test]
async fn cada_funcao_tem_a_propria_cadeia_e_a_propria_ultima() {
    util::com_banco_descartavel("proc_cadeias", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "001");
        req.designacoes = vec![
            designacao(&m, &m.pm_um, &m.papel_encarregado),
            designacao(&m, &m.pm_tres, &m.papel_escrivao),
        ];
        let id = salvar(&pool, &req).await.unwrap();

        let encarregado = vigente_de(&pool, &id, &m.papel_encarregado).await;
        let escrivao = vigente_de(&pool, &id, &m.papel_escrivao).await;

        let novo_encarregado = substituir(&pool, &id, &encarregado, &m.pm_dois, data(2026, 2, 1))
            .await
            .expect("substituir o encarregado");
        let novo_escrivao = substituir(&pool, &id, &escrivao, &m.pm_um, data(2026, 3, 1))
            .await
            .expect("substituir o escrivao");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.designacoes.len(), 4, "duas cadeias de dois elos");

        // A "última" é por cadeia: vigente E com antecessora. As duas são.
        let ultimas: Vec<&str> = detalhe
            .designacoes
            .iter()
            .filter(|d| d.data_fim.is_none() && d.designacao_anterior_id.is_some())
            .map(|d| d.id.as_str())
            .collect();
        assert_eq!(
            ultimas.len(),
            2,
            "uma ultima por cadeia, nao uma por processo"
        );
        assert!(ultimas.contains(&novo_encarregado.as_str()));
        assert!(ultimas.contains(&novo_escrivao.as_str()));

        // E cada uma se desfaz sozinha, sem exigir ordem entre as duas.
        remover_substituicao(&pool, &id, &novo_escrivao)
            .await
            .expect("desfazer a troca do escrivao nao depende da do encarregado");
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.designacoes.len(), 3);
        assert!(detalhe
            .designacoes
            .iter()
            .any(|d| d.id == novo_encarregado && d.data_fim.is_none()));
    })
    .await;
}

/// Corrigir a última substituição move a data das DUAS linhas: é uma data só, o
/// fim de uma e o início da outra. Alterar apenas um dos lados abriria a lacuna.
#[tokio::test]
async fn editar_a_ultima_substituicao_nao_abre_lacuna_nem_sobreposicao() {
    util::com_banco_descartavel("proc_subst_edit", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();
        let inicial = vigente_de(&pool, &id, &m.papel_encarregado).await;
        let sucessora = substituir(&pool, &id, &inicial, &m.pm_dois, data(2026, 2, 1))
            .await
            .unwrap();

        // Muda sucessor, data e motivo de uma vez.
        atualizar_substituicao(
            &pool,
            AtualizarSubstituicaoRequest {
                motivo: "afastamento medico".to_string(),
                ..correcao(&id, &sucessora, &m.pm_tres, data(2026, 2, 15))
            },
        )
        .await
        .expect("corrigir a ultima substituicao");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.designacoes.len(), 2, "corrigir nao cria elo novo");
        let anterior = detalhe
            .designacoes
            .iter()
            .find(|d| d.id == inicial)
            .unwrap();
        let atual = detalhe
            .designacoes
            .iter()
            .find(|d| d.id == sucessora)
            .unwrap();

        assert_eq!(anterior.data_fim, Some(data(2026, 2, 15)));
        assert_eq!(
            atual.data_inicio,
            data(2026, 2, 15),
            "as duas datas andam juntas"
        );
        assert_eq!(atual.policial_militar_id, m.pm_tres);
        assert_eq!(atual.motivo.as_deref(), Some("afastamento medico"));
        assert_eq!(
            atual.designacao_anterior_id.as_deref(),
            Some(inicial.as_str())
        );
    })
    .await;
}

/// Substituição do meio da cadeia é histórico: não se edita nem se remove.
#[tokio::test]
async fn substituicao_intermediaria_nao_pode_ser_editada_nem_removida() {
    util::com_banco_descartavel("proc_subst_meio", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();

        let inicial = vigente_de(&pool, &id, &m.papel_encarregado).await;
        let meio = substituir(&pool, &id, &inicial, &m.pm_dois, data(2026, 2, 1))
            .await
            .unwrap();
        let ponta = substituir(&pool, &id, &meio, &m.pm_tres, data(2026, 3, 1))
            .await
            .unwrap();

        let erro = atualizar_substituicao(&pool, correcao(&id, &meio, &m.pm_um, data(2026, 2, 10)))
            .await
            .expect_err("a do meio nao se edita");
        assert!(erro.contains("já foi sucedida por outra"), "{erro}");

        let erro = remover_substituicao(&pool, &id, &meio)
            .await
            .expect_err("a do meio nao se remove");
        assert!(erro.contains("Desfaça primeiro"), "{erro}");

        // A designação INICIAL também não é "uma substituição" — corrigi-la é
        // trabalho do cadastro, e a mensagem tem de dizer isso.
        let erro = remover_substituicao(&pool, &id, &inicial)
            .await
            .expect_err("a inicial nao e substituicao");
        assert!(erro.contains("é a inicial do processo"), "{erro}");

        // A ponta, sim.
        remover_substituicao(&pool, &id, &ponta).await.unwrap();
    })
    .await;
}

/// Desfazer de trás para frente devolve a cadeia ao estado anterior, elo a elo:
/// removida a ponta, a que era intermediária vira a nova ponta.
#[tokio::test]
async fn remover_sucessivamente_reabre_cada_antecessora() {
    util::com_banco_descartavel("proc_subst_desfaz", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();

        let inicial = vigente_de(&pool, &id, &m.papel_encarregado).await;
        let meio = substituir(&pool, &id, &inicial, &m.pm_dois, data(2026, 2, 1))
            .await
            .unwrap();
        let ponta = substituir(&pool, &id, &meio, &m.pm_tres, data(2026, 3, 1))
            .await
            .unwrap();

        remover_substituicao(&pool, &id, &ponta).await.unwrap();
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.designacoes.len(), 2);
        let vigente = detalhe
            .designacoes
            .iter()
            .find(|d| d.data_fim.is_none())
            .unwrap();
        assert_eq!(vigente.id, meio, "a antecessora voltou a ser vigente");
        assert_eq!(
            detalhe.cabecalho.responsavel_nome.as_deref(),
            Some("PM DOIS")
        );

        // E agora a que era intermediária é a última, e pode ser desfeita.
        remover_substituicao(&pool, &id, &meio).await.unwrap();
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.designacoes.len(), 1);
        assert_eq!(detalhe.designacoes[0].id, inicial);
        assert_eq!(detalhe.designacoes[0].data_fim, None, "reaberta");
        assert_eq!(detalhe.cabecalho.responsavel_nome.as_deref(), Some("PM UM"));
    })
    .await;
}

/// As seis recusas de entrada, todas com frase própria em português e todas
/// antes de qualquer escrita.
#[tokio::test]
async fn substituicao_recusa_cada_entrada_invalida_com_mensagem_propria() {
    util::com_banco_descartavel("proc_subst_recusa", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();
        let inicial = vigente_de(&pool, &id, &m.papel_encarregado).await;

        let pedido = |ajuste: &dyn Fn(&mut SubstituirDesignacaoRequest)| {
            let mut r = SubstituirDesignacaoRequest {
                processo_id: id.clone(),
                designacao_id: inicial.clone(),
                sucessor_id: m.pm_dois.clone(),
                data_troca: data(2026, 2, 1),
                motivo: "ferias".to_string(),
                documento_autorizador_id: None,
                numero_documento: None,
            };
            ajuste(&mut r);
            r
        };

        let casos: Vec<(&str, Box<dyn Fn(&mut SubstituirDesignacaoRequest)>, &str)> = vec![
            (
                "data futura",
                Box::new(|r| {
                    r.data_troca = chrono::Local::now().date_naive() + chrono::Duration::days(1)
                }),
                "não pode ser futura",
            ),
            (
                "data igual ao inicio",
                Box::new(|r| r.data_troca = data(2026, 1, 10)),
                "precisa ser posterior a 10/01/2026",
            ),
            (
                "data anterior ao inicio",
                Box::new(|r| r.data_troca = data(2026, 1, 5)),
                "precisa ser posterior a 10/01/2026",
            ),
            (
                "sucessor igual ao ocupante",
                Box::new(|r| r.sucessor_id = m.pm_um.clone()),
                "já ocupa a função",
            ),
            (
                "motivo em branco",
                Box::new(|r| r.motivo = "   ".to_string()),
                "Informe o motivo",
            ),
            (
                "documento sem numero",
                Box::new(|r| r.documento_autorizador_id = Some(m.documento.clone())),
                "Informe o número do documento",
            ),
            (
                "numero sem documento",
                Box::new(|r| r.numero_documento = Some("123".to_string())),
                "Escolha o tipo de documento",
            ),
        ];

        for (caso, ajuste, esperado) in casos {
            let erro = substituir_com(&pool, pedido(&*ajuste))
                .await
                .expect_err(caso);
            assert!(
                erro.contains(esperado),
                "{caso}: esperava {esperado:?}, veio {erro:?}"
            );
            // Nenhuma delas pode chegar ao PostgreSQL: a aplicação sabe qual
            // campo está errado, e é ela que responde.
            assert!(
                !erro.contains("banco de dados"),
                "{caso}: caiu no fallback do banco"
            );
        }

        // Militar desativado é o caso que precisa de estado no banco, não só de
        // um campo diferente no request.
        sqlx::query("UPDATE policiais_militares SET ativo = false WHERE id = $1::uuid")
            .bind(&m.pm_dois)
            .execute(&pool)
            .await
            .unwrap();
        let erro = substituir_com(&pool, pedido(&|_| {}))
            .await
            .expect_err("sucessor desativado");
        assert!(erro.contains("está desativado"), "{erro}");

        // E nada disso escreveu: a designação inicial segue sozinha e vigente.
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.designacoes.len(), 1);
        assert_eq!(detalhe.designacoes[0].data_fim, None);
    })
    .await;
}

/// O cadastro edita e remove a designação inicial — e só ela.
///
/// Antes o formulário só sabia acrescentar: lançar o encarregado errado e
/// reeditar criava uma SEGUNDA designação vigente em vez de corrigir a primeira.
#[tokio::test]
async fn cadastro_edita_e_remove_designacao_sem_historico() {
    util::com_banco_descartavel("proc_des_sync", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "001");
        let id = salvar(&pool, &req).await.unwrap();
        req.id = Some(id.clone());

        let inicial = vigente_de(&pool, &id, &m.papel_encarregado).await;

        // Corrigir o ocupante: a MESMA linha muda de dono.
        req.designacoes = vec![designacao_existente(
            &inicial,
            &m.pm_dois,
            &m.papel_encarregado,
        )];
        salvar(&pool, &req).await.expect("corrigir o encarregado");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(
            detalhe.designacoes.len(),
            1,
            "corrigir nao cria segunda linha"
        );
        assert_eq!(detalhe.designacoes[0].id, inicial, "e a mesma linha");
        assert_eq!(detalhe.designacoes[0].policial_militar_id, m.pm_dois);

        // Os três campos derivados vêm do cabeçalho, não do formulário.
        assert_eq!(detalhe.designacoes[0].data_inicio, req.data_instauracao);
        assert_eq!(
            detalhe.designacoes[0].documento_autorizador_id.as_deref(),
            Some(m.documento.as_str())
        );
        assert_eq!(
            detalhe.designacoes[0].numero_documento.as_deref(),
            Some("001")
        );
        assert_eq!(
            detalhe.designacoes[0].motivo.as_deref(),
            Some("Designação inicial")
        );

        // Corrigir a instauração leva junto o início da designação, pela mesma
        // razão que leva o prazo inicial: uma informação, uma fonte de verdade.
        req.data_instauracao = data(2026, 1, 5);
        salvar(&pool, &req).await.expect("corrigir a instauracao");
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.designacoes[0].data_inicio, data(2026, 1, 5));

        // Acrescentar um escrivão e depois removê-lo: sem histórico, sai.
        req.designacoes
            .push(designacao(&m, &m.pm_tres, &m.papel_escrivao));
        salvar(&pool, &req).await.expect("acrescentar escrivao");
        assert_eq!(
            repository::get(&pool, &id)
                .await
                .unwrap()
                .unwrap()
                .designacoes
                .len(),
            2
        );

        req.designacoes.pop();
        salvar(&pool, &req).await.expect("remover escrivao");
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(
            detalhe.designacoes.len(),
            1,
            "designacao sem historico e removivel"
        );
        assert_eq!(detalhe.designacoes[0].id, inicial);
    })
    .await;
}

/// Depois que existe substituição, a função fica fora do alcance do cadastro —
/// e o backend recusa mesmo com a tela contornada.
#[tokio::test]
async fn cadastro_nao_alcanca_designacao_com_historico() {
    util::com_banco_descartavel("proc_des_travada", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "001");
        let id = salvar(&pool, &req).await.unwrap();
        req.id = Some(id.clone());

        let inicial = vigente_de(&pool, &id, &m.papel_encarregado).await;
        let sucessora = substituir(&pool, &id, &inicial, &m.pm_dois, data(2026, 2, 1))
            .await
            .unwrap();

        // 1. Reenviar a vigente sem mudança é inofensivo: a tela a mostra
        //    bloqueada, mas ainda a manda.
        req.designacoes = vec![designacao_existente(
            &sucessora,
            &m.pm_dois,
            &m.papel_encarregado,
        )];
        salvar(&pool, &req)
            .await
            .expect("reenviar sem mudanca e no-op");
        assert_eq!(
            repository::get(&pool, &id)
                .await
                .unwrap()
                .unwrap()
                .designacoes
                .len(),
            2
        );

        // 2. Trocar o ocupante por fora é recusado.
        req.designacoes = vec![designacao_existente(
            &sucessora,
            &m.pm_tres,
            &m.papel_encarregado,
        )];
        let erro = salvar(&pool, &req).await.expect_err("alterar a travada");
        assert!(erro.contains("já tem histórico de substituição"), "{erro}");
        assert!(
            erro.contains("Substituir"),
            "a mensagem diz onde fazer: {erro}"
        );

        // 3. Omiti-la é recusado. O teste usa o Escrivão porque o Encarregado é
        //    obrigatório para esta espécie, e aí quem responderia primeiro seria
        //    a validação de papel obrigatório — outra regra, outra mensagem.
        let escrivao = salvar(&pool, &{
            let mut com_escrivao = base(&m, "002");
            com_escrivao.designacoes = vec![
                designacao(&m, &m.pm_um, &m.papel_encarregado),
                designacao(&m, &m.pm_tres, &m.papel_escrivao),
            ];
            com_escrivao
        })
        .await
        .unwrap();
        let vigente_escrivao = vigente_de(&pool, &escrivao, &m.papel_escrivao).await;
        substituir(
            &pool,
            &escrivao,
            &vigente_escrivao,
            &m.pm_dois,
            data(2026, 2, 1),
        )
        .await
        .unwrap();

        let mut so_encarregado = base(&m, "002");
        so_encarregado.id = Some(escrivao.clone());
        so_encarregado.designacoes = vec![designacao_existente(
            &vigente_de(&pool, &escrivao, &m.papel_encarregado).await,
            &m.pm_um,
            &m.papel_encarregado,
        )];
        let erro = salvar(&pool, &so_encarregado)
            .await
            .expect_err("remover a travada");
        assert!(erro.contains("não pode ser removida aqui"), "{erro}");

        // Nada disso escreveu.
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.designacoes.len(), 2);
        assert_eq!(
            detalhe.cabecalho.responsavel_nome.as_deref(),
            Some("PM DOIS")
        );
    })
    .await;
}

/// Dois Encarregados num papel de um ocupante só: mensagem da aplicação, não a
/// constraint trigger — que, por ser `DEFERRABLE`, só falharia no `commit`.
#[tokio::test]
async fn limite_de_ocupantes_fala_antes_da_constraint() {
    util::com_banco_descartavel("proc_ocupantes", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "001");

        req.designacoes = vec![
            designacao(&m, &m.pm_um, &m.papel_encarregado),
            designacao(&m, &m.pm_dois, &m.papel_encarregado),
        ];
        let erro = salvar(&pool, &req).await.expect_err("dois encarregados");
        assert!(
            erro.contains("Encarregado Teste"),
            "diz qual funcao: {erro}"
        );
        assert!(erro.contains("no máximo 1 ocupante"), "{erro}");
        assert!(
            !erro.contains("banco de dados"),
            "nao caiu na trigger: {erro}"
        );

        // O mesmo militar duas vezes na mesma função é outro erro, e tem frase
        // própria — quem valida é o request, sem tocar no banco.
        req.designacoes = vec![
            designacao(&m, &m.pm_um, &m.papel_encarregado),
            designacao(&m, &m.pm_um, &m.papel_encarregado),
        ];
        let erro = salvar(&pool, &req)
            .await
            .expect_err("mesmo militar repetido");
        assert!(erro.contains("duas vezes na mesma função"), "{erro}");

        // Escrivão aceita dois: o limite vem do cadastro, não de um número
        // escrito no código.
        req.designacoes = vec![
            designacao(&m, &m.pm_um, &m.papel_encarregado),
            designacao(&m, &m.pm_dois, &m.papel_escrivao),
            designacao(&m, &m.pm_tres, &m.papel_escrivao),
        ];
        salvar(&pool, &req).await.expect("dois escrivaes cabem");
    })
    .await;
}

// ────────────────────────────────────────────── leitura, filtros e anexos ──

/// Monta três processos com atributos distintos para exercitar cada filtro.
async fn cenario_de_listagem(pool: &PgPool, m: &Mundo) -> (String, String, String) {
    let mut a = base(m, "001");
    a.resumo_fatos = Some("furto de equipamento".to_string());
    a.data_recebimento = Some(data(2026, 1, 12));
    let a = salvar(pool, &a).await.unwrap();

    let mut b = base(m, "002");
    b.apuratorio_id = m.apuratorio_livre.clone();
    b.natureza_fato_id = None;
    b.data_instauracao = data(2025, 6, 1);
    let b = salvar(pool, &b).await.unwrap();
    let mut tx = pool.begin().await.unwrap();
    repository::update_dates(
        &mut tx,
        &UpdateProceedingDatesRequest {
            processo_id: b.clone(),
            data_remessa_encarregado: None,
            data_remessa_comissao: None,
            data_julgamento: None,
            data_conclusao: Some(data(2025, 8, 1)),
        },
    )
    .await
    .unwrap();
    tx.commit().await.unwrap();

    let mut c = base(m, "003");
    c.natureza_fato_id = Some(m.natureza_transito.clone());
    c.envolvidos = vec![EnvolvidoRequest {
        e_condutor: true,
        ..envolvido(m, &m.pm_dois, 1)
    }];
    c.designacoes = vec![designacao(m, &m.pm_dois, &m.papel_encarregado)];
    let c = salvar(pool, &c).await.unwrap();

    (a, b, c)
}

#[tokio::test]
async fn listagem_aplica_cada_filtro_e_pagina() {
    util::com_banco_descartavel("proc_lista", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let (a, b, c) = cenario_de_listagem(&pool, &m).await;

        let so = |f: ProceedingFilter| {
            let pool = pool.clone();
            async move { repository::list(&pool, &f).await.unwrap() }
        };

        let todos = so(ProceedingFilter::default()).await;
        assert_eq!(todos.total, 3);
        assert_eq!(todos.page, 1);

        // Busca textual no resumo dos fatos.
        let r = so(ProceedingFilter {
            busca: Some("EQUIPAMENTO".to_string()),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, a);

        // Escopo por espécie: substitui o `IN ('IPM','SR','SV')` de sigla.
        let r = so(ProceedingFilter {
            apuratorio_ids: Some(vec![m.apuratorio_livre.clone()]),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, b);

        let r = so(ProceedingFilter {
            natureza_fato_id: Some(m.natureza_transito.clone()),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, c);

        // Responsável resolvido pelo papel `e_responsavel`.
        let r = so(ProceedingFilter {
            responsavel_id: Some(m.pm_dois.clone()),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, c);

        let r = so(ProceedingFilter {
            ano: Some(2025),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 1);
        assert_eq!(r.items[0].id, b);

        // Concluído é derivado de `data_conclusao IS NOT NULL`.
        let r = so(ProceedingFilter {
            concluido: Some(true),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 1);
        assert!(r.items[0].concluido);
        let r = so(ProceedingFilter {
            concluido: Some(false),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 2);

        let r = so(ProceedingFilter {
            unidade_origem_id: Some(m.unidade.clone()),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 3);

        // Paginação: total continua sendo o do conjunto inteiro.
        let r = so(ProceedingFilter {
            page: Some(2),
            per_page: Some(2),
            ..Default::default()
        })
        .await;
        assert_eq!(r.total, 3);
        assert_eq!(r.items.len(), 1);
    })
    .await;
}

#[tokio::test]
async fn soft_delete_some_da_listagem_e_reopen_limpa_a_conclusao() {
    util::com_banco_descartavel("proc_ciclo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let req = base(&m, "001");
        let id = salvar(&pool, &req).await.unwrap();
        let mut tx = pool.begin().await.unwrap();
        repository::update_dates(
            &mut tx,
            &UpdateProceedingDatesRequest {
                processo_id: id.clone(),
                data_remessa_encarregado: None,
                data_remessa_comissao: None,
                data_julgamento: None,
                data_conclusao: Some(data(2026, 3, 1)),
            },
        )
        .await
        .unwrap();
        tx.commit().await.unwrap();

        assert!(
            repository::get(&pool, &id)
                .await
                .unwrap()
                .unwrap()
                .cabecalho
                .concluido
        );

        let mut tx = pool.begin().await.unwrap();
        repository::reopen(&mut tx, &id).await.unwrap();
        tx.commit().await.unwrap();
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert!(!detalhe.cabecalho.concluido);
        assert_eq!(detalhe.cabecalho.data_conclusao, None);

        let mut tx = pool.begin().await.unwrap();
        repository::soft_delete(&mut tx, &id).await.unwrap();
        tx.commit().await.unwrap();
        let r = repository::list(&pool, &ProceedingFilter::default())
            .await
            .unwrap();
        assert_eq!(r.total, 0, "processo inativo nao aparece na listagem");
    })
    .await;
}

#[tokio::test]
async fn anexos_sao_multiplos_e_a_remocao_e_logica() {
    util::com_banco_descartavel("proc_anexo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();

        let autor: String =
            sqlx::query_scalar("SELECT id::text FROM usuarios WHERE email = 'admin@sistema.com'")
                .fetch_one(&pool)
                .await
                .unwrap();

        let mut ids = vec![];
        for nome in ["a.pdf", "b.pdf"] {
            let mut tx = pool.begin().await.unwrap();
            ids.push(
                repository::upload_anexo(
                    &mut tx,
                    &UploadAttachmentRequest {
                        processo_id: id.clone(),
                        nome_arquivo: nome.to_string(),
                        mime_type: "application/pdf".to_string(),
                        // "ola" em base64.
                        conteudo: "b2xh".to_string(),
                    },
                    &autor,
                )
                .await
                .expect("anexar"),
            );
            tx.commit().await.unwrap();
        }

        // N anexos por processo — antes era um PDF inline por tabela de tipo.
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.anexos.len(), 2);
        assert_eq!(
            detalhe.anexos[0].tamanho_bytes, 3,
            "octet_length do conteudo"
        );

        let conteudo = repository::get_anexo(&pool, &ids[0])
            .await
            .unwrap()
            .unwrap();
        assert_eq!(conteudo.conteudo, "b2xh");

        let mut tx = pool.begin().await.unwrap();
        repository::remove_anexo(&mut tx, &ids[0]).await.unwrap();
        tx.commit().await.unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.anexos.len(), 1, "cancelado sai do indice parcial");
        assert!(repository::get_anexo(&pool, &ids[0])
            .await
            .unwrap()
            .is_none());

        // Base64 inválido é regra de negócio, não erro de banco.
        let mut tx = pool.begin().await.unwrap();
        let erro = repository::upload_anexo(
            &mut tx,
            &UploadAttachmentRequest {
                processo_id: id.clone(),
                nome_arquivo: "x.pdf".to_string(),
                mime_type: "application/pdf".to_string(),
                conteudo: "!!!".to_string(),
            },
            &autor,
        )
        .await
        .expect_err("base64 invalido");
        assert!(erro.message().contains("base64"));
    })
    .await;
}

#[tokio::test]
async fn dashboard_conta_o_que_foi_criado() {
    util::com_banco_descartavel("proc_dash", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        cenario_de_listagem(&pool, &m).await;

        let d = repository::dashboard(&pool).await.unwrap();
        assert_eq!(d.total, 3);
        assert_eq!(d.em_andamento, 2);
        assert_eq!(d.concluidos, 1);

        // Contagens rotuladas dinâmicas: os rótulos vêm do catálogo, não de uma
        // lista fixa de contadores.
        let por_apuratorio: Vec<(&str, i64)> = d
            .por_apuratorio
            .iter()
            .map(|c| (c.rotulo.as_str(), c.total))
            .collect();
        assert!(por_apuratorio.contains(&("TST-A", 2)), "{por_apuratorio:?}");
        assert!(por_apuratorio.contains(&("TST-B", 1)), "{por_apuratorio:?}");

        let anos: Vec<(&str, i64)> = d
            .por_ano
            .iter()
            .map(|c| (c.rotulo.as_str(), c.total))
            .collect();
        assert!(
            anos.contains(&("2026", 2)) && anos.contains(&("2025", 1)),
            "{anos:?}"
        );
    })
    .await;
}

#[tokio::test]
async fn processo_antigo_continua_exibindo_catalogo_desativado() {
    util::com_banco_descartavel("proc_inativo", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();

        // A regra de leitura que decorre do princípio "catálogo em uso se
        // desativa": lista de OPÇÕES filtra `ativo`; leitura de REGISTRO
        // EXISTENTE faz JOIN sem filtrar. Um processo de 2019 cuja natureza foi
        // desativada em 2026 tem de continuar exibindo aquela natureza. O código
        // antigo aplicava `coalesce(ativo,true)=true` em todo lugar — era bug.
        sqlx::query("UPDATE naturezas_fato SET ativo = false WHERE id = $1::uuid")
            .bind(&m.natureza)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("UPDATE status_envolvido SET ativo = false WHERE id = $1::uuid")
            .bind(&m.status_envolvido)
            .execute(&pool)
            .await
            .unwrap();

        let detalhe = repository::get(&pool, &id)
            .await
            .unwrap()
            .expect("continua legivel");
        assert_eq!(
            detalhe.cabecalho.natureza_fato.as_deref(),
            Some("Natureza Teste"),
            "natureza desativada nao pode sumir do processo que ja a usa"
        );

        let r = repository::list(&pool, &ProceedingFilter::default())
            .await
            .unwrap();
        assert_eq!(r.total, 1, "processo nao some da listagem");
        assert_eq!(r.items[0].responsavel_nome.as_deref(), Some("PM UM"));
    })
    .await;
}

#[tokio::test]
async fn listagem_traz_qualificacoes_sei_e_envolvidos_na_ordem() {
    util::com_banco_descartavel("proc_lista_qualificada", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        let mut req = base(&m, "001/2026/PM-7BPMP6");
        req.apuratorio_id = m.apuratorio_livre.clone();
        req.natureza_fato_id = None;
        req.numero_controle = Some("30/2026/PM-7BPMP6".to_string());
        req.processo_sei = Some("0021.050546/2026-19".to_string());
        req.envolvidos = vec![envolvido(&m, &m.pm_tres, 2), envolvido(&m, &m.pm_dois, 1)];
        let id = salvar(&pool, &req)
            .await
            .expect("criar processo para a lista");

        // O rótulo do papel é apresentação. Em CD/PAD/CJ ele pode ser
        // "Presidente"; quem resolve o responsável continua sendo a flag.
        sqlx::query("UPDATE papeis_processo SET nome = 'Presidente Teste' WHERE id = $1::uuid")
            .bind(&m.papel_encarregado)
            .execute(&pool)
            .await
            .unwrap();

        let lista = repository::list(&pool, &ProceedingFilter::default())
            .await
            .unwrap();
        let item = lista.items.iter().find(|item| item.id == id).unwrap();

        assert_eq!(item.numero_controle, "30/2026/PM-7BPMP6");
        assert_eq!(item.processo_sei.as_deref(), Some("0021.050546/2026-19"));
        assert_eq!(item.responsavel_nome.as_deref(), Some("PM UM"));
        assert_eq!(item.responsavel_matricula.as_deref(), Some("100000001"));
        assert_eq!(item.responsavel_posto_graduacao.as_deref(), Some("TST PM"));
        assert_eq!(item.responsavel_papel.as_deref(), Some("Presidente Teste"));

        let envolvidos = &item.envolvidos_resumo.0;
        assert_eq!(envolvidos.len(), 2);
        assert_eq!(envolvidos[0].nome, "PM DOIS");
        assert_eq!(envolvidos[0].matricula, "100000002");
        assert_eq!(envolvidos[0].posto_graduacao, "TST PM");
        assert_eq!(envolvidos[1].nome, "PM TRES");
    })
    .await;
}

#[tokio::test]
async fn papel_sem_documento_nao_grava_nem_exibe_citacao() {
    util::com_banco_descartavel("proc_papel_sem_doc", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        sqlx::query(
            "UPDATE apuratorio_papeis
                SET usa_documento_designacao = false
              WHERE apuratorio_id = $1::uuid AND papel_id = $2::uuid",
        )
        .bind(&m.apuratorio)
        .bind(&m.papel_escrivao)
        .execute(&pool)
        .await
        .unwrap();

        let mut req = base(&m, "001");
        req.designacoes
            .push(designacao(&m, &m.pm_tres, &m.papel_escrivao));
        let id = salvar(&pool, &req).await.unwrap();
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        let encarregado = detalhe
            .designacoes
            .iter()
            .find(|d| d.papel_id == m.papel_encarregado)
            .unwrap();
        let escrivao = detalhe
            .designacoes
            .iter()
            .find(|d| d.papel_id == m.papel_escrivao)
            .unwrap();
        assert!(encarregado.usa_documento_designacao);
        assert!(encarregado.documento_autorizador_id.is_some());
        assert!(!escrivao.usa_documento_designacao);
        assert!(escrivao.documento_autorizador_id.is_none());
        assert!(escrivao.numero_documento.is_none());

        let sucessora = substituir_com(
            &pool,
            SubstituirDesignacaoRequest {
                processo_id: id.clone(),
                designacao_id: escrivao.id.clone(),
                sucessor_id: m.pm_dois.clone(),
                data_troca: data(2026, 2, 1),
                motivo: "troca do escrivão".to_string(),
                documento_autorizador_id: Some(m.documento.clone()),
                numero_documento: Some("DOC-IGNORADO".to_string()),
            },
        )
        .await
        .unwrap();
        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        let sucessora = detalhe
            .designacoes
            .iter()
            .find(|d| d.id == sucessora)
            .unwrap();
        assert!(!sucessora.usa_documento_designacao);
        assert!(sucessora.documento_autorizador_id.is_none());
        assert!(sucessora.numero_documento.is_none());
    })
    .await;
}

#[tokio::test]
async fn processo_concluido_recusa_nova_substituicao_e_orienta_reabrir() {
    util::com_banco_descartavel("proc_subst_concluido", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();
        let inicial = vigente_de(&pool, &id, &m.papel_encarregado).await;
        sqlx::query(
            "UPDATE processos_procedimentos SET data_conclusao = DATE '2026-02-01'
              WHERE id = $1::uuid",
        )
        .bind(&id)
        .execute(&pool)
        .await
        .unwrap();

        let erro = substituir(&pool, &id, &inicial, &m.pm_dois, data(2026, 2, 2))
            .await
            .expect_err("processo concluido");
        assert!(erro.contains("concluído"), "{erro}");
        assert!(erro.contains("Reabra"), "{erro}");
        assert_eq!(
            repository::get(&pool, &id)
                .await
                .unwrap()
                .unwrap()
                .designacoes
                .len(),
            1
        );
    })
    .await;
}

// ──────────────────────────────────────────────────────────── ofendido/vítima ──
//
// Desde a 0012 o ofendido é `processo_vitimas`, e não uma pessoa citada com
// papel de catálogo. Quem decide se a espécie o registra é
// `apuratorios.permite_cadastro_vitima` — atributo, nunca a sigla.

#[tokio::test]
async fn procedimento_grava_zero_uma_ou_varias_vitimas() {
    util::com_banco_descartavel("proc_vitimas_varias", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        habilitar_vitima(&pool, &m.apuratorio, true).await;

        // Zero: a informação é opcional, e o cadastro tem de fechar sem ela.
        let id = salvar(&pool, &base(&m, "VIT-1")).await.unwrap();
        assert!(repository::get(&pool, &id)
            .await
            .unwrap()
            .unwrap()
            .vitimas
            .is_empty());

        // Três, e o nome é normalizado para maiúsculas como o das pessoas.
        let mut com_tres = base(&m, "VIT-1");
        com_tres.id = Some(id.clone());
        com_tres.vitimas = vec![
            vitima("Fulano de Tal", 1),
            vitima("ADMINISTRAÇÃO PÚBLICA", 2),
            vitima("Beltrana", 3),
        ];
        sincronizar_designacoes(&pool, &mut com_tres, &id).await;
        salvar(&pool, &com_tres).await.unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        let nomes: Vec<&str> = detalhe.vitimas.iter().map(|v| v.nome.as_str()).collect();
        assert_eq!(
            nomes,
            ["FULANO DE TAL", "ADMINISTRAÇÃO PÚBLICA", "BELTRANA"]
        );

        // E voltar a zero também: remover a última vítima é operação legítima
        // enquanto a espécie as registra.
        let mut sem = base(&m, "VIT-1");
        sem.id = Some(id.clone());
        sincronizar_designacoes(&pool, &mut sem, &id).await;
        salvar(&pool, &sem).await.unwrap();
        assert!(repository::get(&pool, &id)
            .await
            .unwrap()
            .unwrap()
            .vitimas
            .is_empty());
    })
    .await;
}

#[tokio::test]
async fn apuratorio_sem_cadastro_de_vitima_recusa_vitima() {
    util::com_banco_descartavel("proc_vitima_recusada", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        // Desligado é o estado de nascença — nada a fazer antes.

        let mut novo = base(&m, "VIT-2");
        novo.vitimas = vec![vitima("Fulano", 1)];

        // Recusa com mensagem de domínio, e não silêncio: a tela não desenha a
        // seção, então quem chega aqui chamou o IPC direto e precisa saber por
        // que o dado não entrou.
        let erro = salvar(&pool, &novo).await.unwrap_err();
        assert!(
            erro.contains("não registra ofendido/vítima"),
            "mensagem inesperada: {erro}"
        );
    })
    .await;
}

#[tokio::test]
async fn vitima_historica_sobrevive_ao_desligar_a_configuracao() {
    util::com_banco_descartavel("proc_vitima_historica", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        habilitar_vitima(&pool, &m.apuratorio, true).await;

        let mut com_vitima = base(&m, "VIT-3");
        com_vitima.vitimas = vec![vitima("Fulano de Tal", 1), vitima("Beltrana", 2)];
        let id = salvar(&pool, &com_vitima).await.unwrap();

        // A espécie deixa de registrar ofendido. É configuração, e configuração
        // define comportamento futuro — não reescreve fato já gravado.
        habilitar_vitima(&pool, &m.apuratorio, false).await;

        // A tela nem desenha a seção, então a edição seguinte não manda vítima
        // nenhuma. `gravar_vitimas` não toca na tabela, e as duas continuam lá.
        let mut edicao = base(&m, "VIT-3");
        edicao.id = Some(id.clone());
        edicao.resumo_fatos = Some("Alteração que nada tem a ver com a vítima.".to_string());
        sincronizar_designacoes(&pool, &mut edicao, &id).await;
        salvar(&pool, &edicao).await.unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(
            detalhe.vitimas.len(),
            2,
            "desligar o atributo apagou fato registrado — princípio 5"
        );
        assert_eq!(detalhe.vitimas[0].nome, "FULANO DE TAL");
    })
    .await;
}

#[tokio::test]
async fn ordem_repetida_de_vitima_da_mensagem_de_dominio() {
    util::com_banco_descartavel("proc_vitima_ordem", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        habilitar_vitima(&pool, &m.apuratorio, true).await;

        let mut novo = base(&m, "VIT-4");
        novo.vitimas = vec![vitima("Fulano", 1), vitima("Beltrana", 1)];

        // `uq_vitima_ordem` também recusaria, mas com o texto cru do
        // PostgreSQL — e a decisão 38 proíbe detalhe técnico na tela.
        let erro = salvar(&pool, &novo).await.unwrap_err();
        assert!(
            erro.contains("ordem diferente"),
            "mensagem inesperada: {erro}"
        );

        let vazio = {
            let mut r = base(&m, "VIT-5");
            r.vitimas = vec![vitima("   ", 1)];
            r
        };
        let erro = salvar(&pool, &vazio).await.unwrap_err();
        assert!(
            erro.contains("ofendido/vítima"),
            "mensagem inesperada: {erro}"
        );
    })
    .await;
}

#[tokio::test]
async fn pessoas_inquiridas_e_vitimas_sao_independentes() {
    util::com_banco_descartavel("proc_vitima_pessoa", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        habilitar_vitima(&pool, &m.apuratorio, true).await;

        let mut novo = base(&m, "VIT-6");
        novo.vitimas = vec![vitima("Ofendido Um", 1)];
        novo.pessoas = vec![PessoaRequest {
            papel_pessoa_id: m.papel_inquirido.clone(),
            nome: "Inquirido Um".to_string(),
            ordem: 1,
        }];
        let id = salvar(&pool, &novo).await.unwrap();

        // Mexer só nos inquiridos não pode alcançar a vítima, e vice-versa: são
        // duas tabelas, e cada `gravar_*` cuida da sua.
        let mut so_pessoas = base(&m, "VIT-6");
        so_pessoas.id = Some(id.clone());
        so_pessoas.vitimas = vec![vitima("Ofendido Um", 1)];
        so_pessoas.pessoas = vec![
            PessoaRequest {
                papel_pessoa_id: m.papel_inquirido.clone(),
                nome: "Inquirido Um".to_string(),
                ordem: 1,
            },
            PessoaRequest {
                papel_pessoa_id: m.papel_inquirido.clone(),
                nome: "Inquirido Dois".to_string(),
                ordem: 2,
            },
        ];
        sincronizar_designacoes(&pool, &mut so_pessoas, &id).await;
        salvar(&pool, &so_pessoas).await.unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.pessoas.len(), 2);
        assert_eq!(detalhe.vitimas.len(), 1);
        assert_eq!(detalhe.vitimas[0].nome, "OFENDIDO UM");
    })
    .await;
}

/// O caminho inverso: o militar registrado estava errado e o processo volta ao
/// estado "À apurar". A sincronização é pelo id do VÍNCULO, então a linha e o
/// que pendura nela sobrevivem — trocar o PM não é criar outro envolvido.
#[tokio::test]
async fn identificado_volta_a_ser_a_apurar_como_correcao() {
    util::com_banco_descartavel("proc_volta_a_apurar", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "CORRECAO-1");
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1)];

        let processo_id = salvar(&pool, &req).await.unwrap();
        let detalhe = repository::get(&pool, &processo_id).await.unwrap().unwrap();
        let envolvido_id = detalhe.envolvidos[0].id.clone();

        sqlx::query(
            "INSERT INTO envolvido_categorias_indicio (envolvido_id, categoria_indicio_id)
             VALUES ($1::uuid, $2::uuid)",
        )
        .bind(&envolvido_id)
        .bind(&m.categoria_indicio)
        .execute(&pool)
        .await
        .unwrap();

        req.id = Some(processo_id.clone());
        req.envolvidos[0].id = Some(envolvido_id.clone());
        req.envolvidos[0].policial_militar_id = None;
        sincronizar_designacoes(&pool, &mut req, &processo_id).await;
        salvar(&pool, &req).await.unwrap();

        let detalhe = repository::get(&pool, &processo_id).await.unwrap().unwrap();
        assert_eq!(detalhe.envolvidos.len(), 1, "não nasceu um segundo vínculo");
        assert_eq!(detalhe.envolvidos[0].id, envolvido_id);
        assert_eq!(detalhe.envolvidos[0].policial_militar_id, None);
        assert_eq!(detalhe.envolvidos[0].nome, "À apurar");
        assert_eq!(detalhe.envolvidos[0].posto_graduacao, "");
        assert_eq!(detalhe.envolvidos[0].matricula, "");

        let indicios: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM envolvido_categorias_indicio WHERE envolvido_id = $1::uuid",
        )
        .bind(&envolvido_id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(indicios, 1, "o enquadramento não some ao voltar a À apurar");

        // E o militar que estava errado continua no cadastro, intocado: a
        // correção do processo não mexe no catálogo de pessoas.
        let ativo: bool =
            sqlx::query_scalar("SELECT ativo FROM policiais_militares WHERE id = $1::uuid")
                .bind(&m.pm_dois)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(ativo);
    })
    .await;
}

/// "À apurar" é um envolvido como qualquer outro para efeito de teto: ocupa
/// uma vaga do `max_envolvidos` configurado no apuratório.
#[tokio::test]
async fn a_apurar_ocupa_vaga_no_limite_de_envolvidos() {
    util::com_banco_descartavel("proc_a_apurar_limite", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;

        // O apuratório principal aceita 1 envolvido.
        let mut req = base(&m, "LIMITE-1");
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1), envolvido_a_apurar(&m, 2)];
        let erro = salvar(&pool, &req)
            .await
            .expect_err("o marcador coletivo também conta");
        assert!(erro.contains("envolvid"), "mensagem: {erro}");

        // Sozinho ele cabe.
        req.envolvidos = vec![envolvido_a_apurar(&m, 1)];
        salvar(&pool, &req).await.expect("um só cabe no limite");
    })
    .await;
}

/// O mesmo militar em duas linhas é erro de digitação, não fato novo. A
/// mensagem é de domínio, e não o texto cru da constraint do PostgreSQL.
#[tokio::test]
async fn o_mesmo_militar_duas_vezes_como_envolvido_e_recusado_com_frase_propria() {
    util::com_banco_descartavel("proc_env_duplicado", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "DUPLICADO-1");
        req.apuratorio_id = m.apuratorio_livre.clone();
        req.natureza_fato_id = None;
        req.envolvidos = vec![envolvido(&m, &m.pm_dois, 1), envolvido(&m, &m.pm_dois, 2)];

        let erro = salvar(&pool, &req).await.expect_err("PM repetido");
        assert!(erro.contains("duas vezes"), "mensagem: {erro}");
        assert!(
            !erro.contains("uq_envolvido") && !erro.contains("duplicate"),
            "texto cru do PostgreSQL vazando: {erro}"
        );
    })
    .await;
}

/// Trocar o condutor entre dois envolvidos numa gravação só.
///
/// Falhava, e falhava mentindo: o índice parcial da 0001 colidia no meio da
/// transação — o de cima já marcado, o de baixo ainda não desmarcado — e o
/// usuário lia "Só pode haver um condutor por processo." com exatamente um
/// condutor na tela. A 0017 trocou o índice por uma constraint EXCLUDE adiada,
/// conferida no `commit`, quando o processo já está no estado pedido.
#[tokio::test]
async fn condutor_troca_de_envolvido_numa_gravacao_so() {
    util::com_banco_descartavel("proc_troca_condutor", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let mut req = base(&m, "CONDUTOR-1");
        req.apuratorio_id = m.apuratorio_livre.clone();
        req.natureza_fato_id = Some(m.natureza_transito.clone());
        req.envolvidos = vec![
            EnvolvidoRequest {
                e_condutor: false,
                ..envolvido(&m, &m.pm_dois, 1)
            },
            EnvolvidoRequest {
                e_condutor: true,
                ..envolvido(&m, &m.pm_tres, 2)
            },
        ];
        let id = salvar(&pool, &req).await.unwrap();

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        req.id = Some(id.clone());
        req.envolvidos[0].id = Some(detalhe.envolvidos[0].id.clone());
        req.envolvidos[1].id = Some(detalhe.envolvidos[1].id.clone());
        // O condutor sobe uma linha: o primeiro é marcado antes de o segundo
        // ser desmarcado, que é exatamente a ordem que colidia.
        req.envolvidos[0].e_condutor = true;
        req.envolvidos[1].e_condutor = false;
        sincronizar_designacoes(&pool, &mut req, &id).await;
        salvar(&pool, &req)
            .await
            .expect("a troca é um estado válido");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert!(detalhe.envolvidos[0].e_condutor);
        assert!(!detalhe.envolvidos[1].e_condutor);

        // A trava continua de pé: dois condutores de verdade seguem recusados,
        // e com a frase de domínio, não com o texto cru da constraint.
        req.envolvidos[1].e_condutor = true;
        sincronizar_designacoes(&pool, &mut req, &id).await;
        let erro = salvar(&pool, &req).await.expect_err("dois condutores");
        assert!(erro.contains("um condutor"), "mensagem: {erro}");
    })
    .await;
}
