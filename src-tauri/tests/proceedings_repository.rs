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
use adm_p6_tauri_lib::proceedings::domain::{
    CartaPrecatoriaRequest, DesignacaoRequest, EnvolvidoRequest, PessoaRequest, ProceedingFilter,
    SaveProceedingRequest, UploadAttachmentRequest,
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
        municipio_fato_id: m.municipio.clone(),
        natureza_fato_id: Some(m.natureza.clone()),
        data_instauracao: data(2026, 1, 10),
        data_recebimento: None,
        data_remessa_encarregado: None,
        data_remessa_comissao: None,
        data_julgamento: None,
        data_conclusao: None,
        resumo_fatos: None,
        envolvidos: vec![],
        designacoes: vec![designacao(
            m,
            &m.pm_um,
            &m.papel_encarregado,
            data(2026, 1, 10),
        )],
        pessoas: vec![],
        carta_precatoria: None,
    }
}

fn designacao(_m: &Mundo, pm: &str, papel: &str, inicio: NaiveDate) -> DesignacaoRequest {
    DesignacaoRequest {
        policial_militar_id: pm.to_string(),
        papel_id: papel.to_string(),
        data_inicio: inicio,
        documento_autorizador_id: None,
        numero_documento: None,
        motivo: None,
    }
}

fn envolvido(m: &Mundo, pm: &str, ordem: i32) -> EnvolvidoRequest {
    EnvolvidoRequest {
        policial_militar_id: pm.to_string(),
        status_envolvido_id: m.status_envolvido.clone(),
        ordem,
        e_condutor: false,
        solucao_sugerida_id: None,
        solucao_decidida_id: None,
        penalidade_tipo_id: None,
        penalidade_dias: None,
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
            designacao(&m, &m.pm_um, &m.papel_encarregado, data(2026, 1, 10)),
            designacao(&m, &m.pm_tres, &m.papel_escrivao, data(2026, 1, 10)),
        ];
        req.pessoas = vec![
            PessoaRequest {
                papel_pessoa_id: m.papel_vitima.clone(),
                nome: "ADMINISTRACAO PUBLICA".to_string(),
                ordem: 1,
            },
            PessoaRequest {
                papel_pessoa_id: m.papel_vitima.clone(),
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
            papel_pessoa_id: m.papel_vitima.clone(),
            nome: "VITIMA UM".to_string(),
            ordem: 1,
        }];
        let id = salvar(&pool, &req).await.unwrap();

        // Reenvia com outro envolvido e outra vítima: as coleções são
        // substituídas, não acumuladas.
        req.id = Some(id.clone());
        req.envolvidos = vec![envolvido(&m, &m.pm_tres, 1)];
        req.pessoas = vec![PessoaRequest {
            papel_pessoa_id: m.papel_vitima.clone(),
            nome: "VITIMA DOIS".to_string(),
            ordem: 1,
        }];
        req.resumo_fatos = Some("texto revisado".to_string());
        req.data_recebimento = Some(data(2026, 1, 15));
        let mesmo = salvar(&pool, &req).await.expect("editar");
        assert_eq!(mesmo, id, "edicao preserva o id");

        let detalhe = repository::get(&pool, &id).await.unwrap().unwrap();
        assert_eq!(detalhe.envolvidos.len(), 1);
        assert_eq!(detalhe.envolvidos[0].policial_militar_id, m.pm_tres);
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

        // Era `solucao_tipo == "Punido"`; virou `tipos_solucao_decidida.permite_penalidade`.
        let mut req = base(&m, "001");
        req.envolvidos = vec![EnvolvidoRequest {
            solucao_decidida_id: Some(m.solucao_absolvido.clone()),
            penalidade_tipo_id: Some(m.penalidade_prisao.clone()),
            ..envolvido(&m, &m.pm_dois, 1)
        }];
        let erro = salvar(&pool, &req)
            .await
            .expect_err("solucao nao permite penalidade");
        assert!(erro.contains("penalidade"), "mensagem: {erro}");

        // Era `Some("Prisao") | Some("Detencao")`; virou
        // `tipos_penalidade.usa_quantidade_dias`.
        let mut req = base(&m, "001");
        req.envolvidos = vec![EnvolvidoRequest {
            solucao_decidida_id: Some(m.solucao_punido.clone()),
            penalidade_tipo_id: Some(m.penalidade_repreensao.clone()),
            penalidade_dias: Some(5),
            ..envolvido(&m, &m.pm_dois, 1)
        }];
        let erro = salvar(&pool, &req)
            .await
            .expect_err("penalidade nao usa dias");
        assert!(erro.contains("dias"), "mensagem: {erro}");

        // A combinação coerente passa.
        let mut req = base(&m, "001");
        req.envolvidos = vec![EnvolvidoRequest {
            solucao_sugerida_id: Some(m.solucao_sugerida.clone()),
            solucao_decidida_id: Some(m.solucao_punido.clone()),
            penalidade_tipo_id: Some(m.penalidade_prisao.clone()),
            penalidade_dias: Some(5),
            ..envolvido(&m, &m.pm_dois, 1)
        }];
        let id = salvar(&pool, &req)
            .await
            .expect("punido com dias de prisao");

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
            erro.contains("designacoes obrigatorias"),
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
        req.data_instauracao = chrono::Utc::now().date_naive() + chrono::Duration::days(1);
        assert!(salvar(&pool, &req).await.unwrap_err().contains("futura"));
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
            designacao(&m, &m.pm_um, &m.papel_encarregado, data(2026, 1, 10)),
            designacao(&m, &m.pm_tres, &m.papel_escrivao, data(2026, 1, 10)),
        ];
        let erro = salvar(&pool, &req).await.expect_err("papel nao previsto");
        assert!(
            erro.contains("Não foi possível concluir a operação no banco de dados"),
            "esperado erro seguro sem detalhes da FK: {erro}"
        );
        assert!(!erro.contains("fk_designacao") && !erro.contains("foreign key"));
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
async fn substituicao_de_designacao_encosta_os_periodos_sem_sobrepor() {
    util::com_banco_descartavel("proc_subst", |pool| async move {
        let m = fixtures::mundo_configurado(&pool).await;
        let id = salvar(&pool, &base(&m, "001")).await.unwrap();

        let mut tx = pool.begin().await.unwrap();
        repository::substituir_designacao(
            &mut tx,
            &id,
            &m.papel_encarregado,
            &m.pm_dois,
            data(2026, 2, 1),
            Some("ferias"),
            None,
            None,
        )
        .await
        .expect("substituir o encarregado");
        tx.commit().await.unwrap();

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
    b.data_conclusao = Some(data(2025, 8, 1));
    let b = salvar(pool, &b).await.unwrap();

    let mut c = base(m, "003");
    c.natureza_fato_id = Some(m.natureza_transito.clone());
    c.envolvidos = vec![EnvolvidoRequest {
        e_condutor: true,
        ..envolvido(m, &m.pm_dois, 1)
    }];
    c.designacoes = vec![designacao(
        m,
        &m.pm_dois,
        &m.papel_encarregado,
        data(2026, 1, 10),
    )];
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

        let mut req = base(&m, "001");
        req.data_conclusao = Some(data(2026, 3, 1));
        let id = salvar(&pool, &req).await.unwrap();

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
