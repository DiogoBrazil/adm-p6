//! Aplica as migrations do zero num banco descartável e confere o schema resultante.
//!
//! É a rede mínima contra o modo de falha que produziu 62 queries quebradas no
//! schema anterior: nada, no `cargo build`, olha para o SQL. Este teste olha.
//!
//! Precisa de um PostgreSQL acessível. Configure `DATABASE_URL` (o `.env.example`
//! traz a URL que o `docker-compose.yml` deste repositório sobe). Sem a variável,
//! o teste é ignorado com aviso.

use sqlx::{Connection, Executor, PgConnection, Row};

mod util;

/// Devolve (url_de_manutencao, url_do_banco_de_teste, nome_do_banco).
fn urls() -> Option<(String, String, String)> {
    let _ = dotenvy::from_filename("../.env");
    let base = std::env::var("DATABASE_URL").ok()?;
    let (prefix, _) = base.rsplit_once('/')?;
    let nome = format!("adm_p6_test_{}", std::process::id());
    Some((
        format!("{prefix}/postgres"),
        format!("{prefix}/{nome}"),
        nome,
    ))
}

#[tokio::test]
async fn migrations_aplicam_do_zero_e_produzem_o_schema_esperado() {
    let Some((manutencao, teste, nome)) = urls() else {
        eprintln!("DATABASE_URL ausente: teste ignorado");
        return;
    };

    let mut admin = PgConnection::connect(&manutencao)
        .await
        .expect("conectar ao banco de manutencao");
    admin
        .execute(&*format!(
            r#"DROP DATABASE IF EXISTS "{nome}" WITH (FORCE)"#
        ))
        .await
        .expect("descartar banco de teste anterior");
    admin
        .execute(&*format!(r#"CREATE DATABASE "{nome}""#))
        .await
        .expect("criar banco de teste");

    let resultado = verificar(&teste).await;

    admin
        .execute(&*format!(
            r#"DROP DATABASE IF EXISTS "{nome}" WITH (FORCE)"#
        ))
        .await
        .expect("remover banco de teste");

    resultado.unwrap();
}

async fn verificar(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let mut conn = PgConnection::connect(url).await?;

    sqlx::migrate!("./migrations").run(&mut conn).await?;
    // Reaplicar tem de ser inócuo: é o que acontece a cada startup do app.
    sqlx::migrate!("./migrations").run(&mut conn).await?;

    // O hub e as tabelas por espécie não podem ressuscitar.
    for extinta in [
        "historico_processo_procedimentos",
        "sindicancia_regular",
        "inquerito_policial_militar",
        "processo_apuratorio_disciplinar_sumario",
        "conselho_disciplina",
        "carta_precatoria",
        "pm_envolvido_crimes_militares",
        "pm_envolvido_crimes_comuns",
        "infracoes_estatuto_art29",
        "infracoes_estatuto_art32",
        "tipos_prazo",
        "crimes_contravencoes",
        // Nunca teve uma linha, aqui ou no legado, e nenhuma consulta a
        // projetava. Removida pela 0006 — ver decisão 30.
        "subdivisao_textos_normativos",
    ] {
        let existe: bool = sqlx::query_scalar("SELECT to_regclass($1) IS NOT NULL")
            .bind(format!("public.{extinta}"))
            .fetch_one(&mut conn)
            .await?;
        assert!(!existe, "tabela {extinta} deveria ter sido eliminada");
    }

    // Toda FK precisa de ON DELETE explícito. No schema anterior as 111 FKs
    // ficavam todas em NO ACTION por omissão.
    let sem_acao: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM pg_constraint
          WHERE connamespace = 'public'::regnamespace
            AND contype = 'f' AND confdeltype = 'a'",
    )
    .fetch_one(&mut conn)
    .await?;
    assert_eq!(sem_acao, 0, "ha FK sem ON DELETE explicito");

    // JSONB só nas duas colunas justificadas: snapshot de mapa e diff de auditoria.
    let jsonb: Vec<(String, String)> = sqlx::query(
        "SELECT table_name::text, column_name::text
           FROM information_schema.columns
          WHERE table_schema = 'public' AND data_type = 'jsonb'
          ORDER BY 1, 2",
    )
    .fetch_all(&mut conn)
    .await?
    .into_iter()
    .map(|r| (r.get(0), r.get(1)))
    .collect();
    assert_eq!(
        jsonb,
        vec![
            ("auditoria".to_string(), "alteracoes".to_string()),
            ("mapas_salvos".to_string(), "dados_mapa".to_string()),
        ],
        "JSONB inesperado no schema"
    );

    // As duas constraint triggers de configuração existem.
    let triggers: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal
          AND tgname IN ('tg_max_envolvidos', 'tg_max_ocupantes', 'tg_cadeia_designacao')",
    )
    .fetch_one(&mut conn)
    .await?;
    assert_eq!(triggers, 3, "constraint triggers de configuracao ausentes");

    // A regra de citação do documento pertence à relação apuratório × papel.
    // Ela precisa nascer obrigatória e ligada; a 0009 desliga apenas as linhas
    // legadas correspondentes ao Escrivão do IPM.
    let configuracao_documento: (String, Option<String>) = sqlx::query_as(
        "SELECT is_nullable::text, column_default::text
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'apuratorio_papeis'
            AND column_name = 'usa_documento_designacao'",
    )
    .fetch_one(&mut conn)
    .await?;
    assert_eq!(configuracao_documento.0, "NO");
    assert_eq!(configuracao_documento.1.as_deref(), Some("true"));

    // Seed técnico: uma conta administrativa, sem policial associado.
    let admins: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM usuarios u
           JOIN perfis_acesso p ON p.id = u.perfil_id
          WHERE p.pode_administrar AND u.ativo AND u.policial_militar_id IS NULL",
    )
    .fetch_one(&mut conn)
    .await?;
    assert_eq!(admins, 1, "esperado exatamente um administrador tecnico");

    // A fronteira da decisão de seed: o que é LEI vem semeado pela 0003 (não
    // varia por instalação); o que é OPERACIONAL nasce vazio e é cadastrado
    // pelo administrador da unidade. Este teste é o que trava essa fronteira —
    // semear um catálogo operacional aqui é uma decisão, não um descuido.
    for (tabela, esperado) in [
        ("circulos_hierarquicos", 2),
        ("postos_graduacoes", 13),
        ("municipios_distritos", 112),
        ("dispositivos_legais", 7),
        ("especies_infracao_penal", 2),
        ("esferas_penais", 2),
        ("naturezas_transgressao", 3),
        ("artigos_rdpm", 3),
        ("transgressoes", 95),
        // 26 e 20, não 27 e 23: a 0003 descarta explicitamente 1 duplicata de
        // chave única (art. 42 da LCP) e 3 linhas de teste já inativas do
        // legado (inciso "LX" do art. 29).
        ("infracoes_penais", 26),
        ("infracoes_estatuto", 20),
    ] {
        let n: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM {tabela}"))
            .fetch_one(&mut conn)
            .await?;
        assert_eq!(
            n, esperado,
            "catalogo legal {tabela} com contagem inesperada"
        );
    }

    for vazio in [
        "apuratorios",
        "tipos_apuratorio",
        "apuratorio_documentos_iniciadores",
        "apuratorio_papeis",
        "tipos_documento",
        "policiais_militares",
        "naturezas_fato",
        "tipos_penalidade",
        "tipos_solucao_decidida",
        "tipos_solucao_sugerida",
        "status_envolvido",
        "categorias_indicio",
        "unidades_pm",
        "papeis_processo",
        "papeis_pessoa",
        "tipos_andamento",
    ] {
        let n: i64 = sqlx::query_scalar(&format!("SELECT count(*) FROM {vazio}"))
            .fetch_one(&mut conn)
            .await?;
        assert_eq!(n, 0, "catalogo operacional {vazio} nao deveria vir semeado");
    }

    // A 0007 traz um bloco que SEPARA o escrivão do IPM do escrivão do
    // processo, e para isso insere uma linha em `papeis_processo` — catálogo
    // operacional, que a asserção acima exige VAZIO num banco novo.
    //
    // Os dois convivem porque o bloco é condicionado a haver o que separar: sem
    // papel 'Escrivão' cadastrado, ele retorna sem tocar em nada. É uma
    // migration de DADO, corretiva, para a instalação que já importou o legado;
    // numa instalação nova quem cadastra os papéis é o administrador (§7.1).
    //
    // Esta asserção é o que impede alguém "melhorar" a 0007 tirando a condição:
    // sem ela, todo banco novo nasceria com um papel que ninguém pediu.
    let escrivaes: i64 =
        sqlx::query_scalar("SELECT count(*) FROM papeis_processo WHERE nome ILIKE 'escriv%'")
            .fetch_one(&mut conn)
            .await?;
    assert_eq!(
        escrivaes, 0,
        "a separacao do escrivao da 0007 nao pode semear papel em banco novo"
    );

    Ok(())
}

/// Os atributos que decidem quais campos o formulário de processo mostra.
///
/// Nascem **desligados**: o comportamento vem do dado, e quem o liga é o
/// administrador, por apuratório. Antes da 0007 o formulário mostrava os mesmos
/// campos para as dez espécies — data de julgamento num IPM, remessa à comissão
/// numa sindicância.
#[tokio::test]
async fn atributos_de_comportamento_do_apuratorio_nascem_desligados() {
    util::com_banco_descartavel("mig_atributos", |pool| async move {
        for coluna in [
            "permite_julgamento",
            "permite_punicao",
            "permite_remessa_comissao",
            "permite_acusacao",
            "permite_acusacao_penal",
            "permite_indicios",
            "permite_solucao_sugerida",
        ] {
            let (tipo, anulavel, padrao): (String, String, Option<String>) = sqlx::query_as(
                "SELECT data_type, is_nullable, column_default
                   FROM information_schema.columns
                  WHERE table_name = 'apuratorios' AND column_name = $1",
            )
            .bind(coluna)
            .fetch_one(&pool)
            .await
            .unwrap_or_else(|_| panic!("coluna {coluna} nao existe em apuratorios"));

            assert_eq!(tipo, "boolean", "{coluna} tem de ser booleana (§3.2)");
            assert_eq!(anulavel, "NO", "{coluna} nao pode ser nula");
            assert_eq!(
                padrao.as_deref(),
                Some("false"),
                "{coluna} nasce desligada: quem liga e o administrador"
            );
        }
    })
    .await;
}

#[tokio::test]
async fn remessa_legada_vira_remessa_da_comissao_quando_o_rito_usa_comissao() {
    util::com_banco_descartavel("mig_remessa_comissao", |pool| async move {
        let m = util::fixtures::mundo_configurado(&pool).await;
        sqlx::query("UPDATE apuratorios SET permite_remessa_comissao = true WHERE id = $1::uuid")
            .bind(&m.apuratorio)
            .execute(&pool)
            .await
            .unwrap();

        let id: String = sqlx::query_scalar(
            "INSERT INTO processos_procedimentos
                 (apuratorio_id, documento_iniciador_id, numero_documento,
                  unidade_origem_id, municipio_fato_id, natureza_fato_id,
                  data_instauracao, data_remessa_encarregado)
             VALUES ($1::uuid, $2::uuid, 'REMESSA-LEGADA', $3::uuid, $4::uuid,
                     $5::uuid, DATE '2026-01-10', DATE '2026-02-01')
          RETURNING id::text",
        )
        .bind(&m.apuratorio)
        .bind(&m.documento)
        .bind(&m.unidade)
        .bind(&m.municipio)
        .bind(&m.natureza)
        .fetch_one(&pool)
        .await
        .unwrap();

        let migration = std::fs::read_to_string("migrations/0010_unificar_remessa_comissao.sql")
            .expect("ler migration de remessa");
        sqlx::raw_sql(&migration).execute(&pool).await.unwrap();

        let datas: (Option<chrono::NaiveDate>, Option<chrono::NaiveDate>) = sqlx::query_as(
            "SELECT data_remessa_encarregado, data_remessa_comissao
               FROM processos_procedimentos WHERE id = $1::uuid",
        )
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(datas.0, None);
        assert_eq!(
            datas.1,
            Some(chrono::NaiveDate::from_ymd_opt(2026, 2, 1).unwrap())
        );
    })
    .await;
}

/// A view é contrato: quatro módulos leem dela. Uma coluna renomeada quebraria
/// os quatro de uma vez, e só em runtime.
#[tokio::test]
async fn a_view_de_processos_e_um_contrato_estavel() {
    util::com_banco_descartavel("view_processos", |pool| async move {
        let colunas: Vec<String> = sqlx::query_scalar(
            "SELECT column_name::text FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'v_processos_detalhados'
              ORDER BY 1",
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        let esperadas = vec![
            "apuratorio_id",
            "apuratorio_nome",
            "apuratorio_sigla",
            "ativo",
            "concluido",
            "data_conclusao",
            "data_instauracao",
            "data_recebimento",
            "documento_iniciador",
            "documento_iniciador_id",
            "id",
            "municipio_fato",
            "municipio_fato_id",
            "natureza_fato",
            "natureza_fato_id",
            "numero_controle",
            "numero_documento",
            "numero_rgf",
            "prazo_dias_restantes",
            "prazo_ordem",
            "prazo_vencimento",
            "processo_sei",
            "responsavel_id",
            "responsavel_nome",
            "responsavel_papel",
            "resumo_fatos",
            "rotulo",
            "tipo_apuratorio",
            "tipo_apuratorio_id",
            "total_envolvidos",
            "unidade_origem",
            "unidade_origem_id",
        ];
        assert_eq!(colunas, esperadas, "o contrato da view mudou");

        // NÃO é a antiga `v_processos`, que existia para esconder dez tabelas
        // quase idênticas — o problema que a remodelagem eliminou.
        let antiga: bool = sqlx::query_scalar(
            "SELECT EXISTS (SELECT 1 FROM information_schema.views
                             WHERE table_schema='public' AND table_name='v_processos')",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(!antiga, "a antiga v_processos nao pode voltar");
    })
    .await;
}

/// A retroalimentação da 0008 sobre histórico que já existia.
///
/// Os 19 processos importados do legado e qualquer substituição feita antes
/// desta migration têm a cadeia no dado — `data_fim` de uma igual a
/// `data_inicio` da outra — mas nenhum vínculo explícito. A migration liga o que
/// é inequívoco e **deixa NULL o que é ambíguo**, que é o comportamento que
/// importa: um papel de dois ocupantes com duas trocas no mesmo dia daria dois
/// pares possíveis, e ligar a sucessora de uma cadeia à antecessora da outra
/// seria pior do que não ligar.
///
/// O teste roda a mesma função que a migration chamou (`fn_vincular_cadeias_existentes`),
/// sobre histórico montado à mão sem vínculo — que é exatamente a situação do
/// banco de produção no instante em que a 0008 subir.
#[tokio::test]
async fn a_retroalimentacao_liga_o_inequivoco_e_deixa_o_ambiguo_em_branco() {
    util::com_banco_descartavel("mig_cadeia", |pool| async move {
        let m = util::fixtures::mundo_configurado(&pool).await;

        // Cadeia inequívoca no Encarregado (um ocupante): PM UM → PM DOIS.
        let processo = util::fixtures::processo(
            &pool,
            &m,
            &m.apuratorio,
            "HIST-001",
            chrono::NaiveDate::from_ymd_opt(2026, 1, 10).unwrap(),
            None,
        )
        .await;

        // Duas cadeias do Escrivão trocando no MESMO dia: par ambíguo.
        let processo_ambiguo = util::fixtures::processo(
            &pool,
            &m,
            &m.apuratorio,
            "HIST-002",
            chrono::NaiveDate::from_ymd_opt(2026, 1, 10).unwrap(),
            None,
        )
        .await;

        let designar =
            |processo: String, pm: String, papel: String, inicio: &str, fim: Option<&str>| {
                let pool = pool.clone();
                let apuratorio = m.apuratorio.clone();
                let inicio = inicio.to_string();
                let fim = fim.map(str::to_string);
                async move {
                    sqlx::query_scalar::<_, String>(
                        "INSERT INTO processo_designacoes
                         (processo_id, apuratorio_id, policial_militar_id, papel_id,
                          data_inicio, data_fim)
                     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::date, $6::date)
                  RETURNING id::text",
                    )
                    .bind(processo)
                    .bind(apuratorio)
                    .bind(pm)
                    .bind(papel)
                    .bind(inicio)
                    .bind(fim)
                    .fetch_one(&pool)
                    .await
                    .unwrap()
                }
            };

        let antecessora = designar(
            processo.clone(),
            m.pm_um.clone(),
            m.papel_encarregado.clone(),
            "2026-01-10",
            Some("2026-02-01"),
        )
        .await;
        let sucessora = designar(
            processo.clone(),
            m.pm_dois.clone(),
            m.papel_encarregado.clone(),
            "2026-02-01",
            None,
        )
        .await;

        // Escrivão aceita 2: duas cadeias em paralelo, ambas trocando em 01/02.
        for (saindo, entrando) in [(&m.pm_um, &m.pm_dois), (&m.pm_dois, &m.pm_tres)] {
            designar(
                processo_ambiguo.clone(),
                saindo.clone(),
                m.papel_escrivao.clone(),
                "2026-01-10",
                Some("2026-02-01"),
            )
            .await;
            designar(
                processo_ambiguo.clone(),
                entrando.clone(),
                m.papel_escrivao.clone(),
                "2026-02-01",
                None,
            )
            .await;
        }

        // Nada está vinculado ainda: é o estado que a migration encontra.
        let soltas: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM processo_designacoes WHERE designacao_anterior_id IS NULL",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(soltas, 6);

        let vinculadas: i32 = sqlx::query_scalar("SELECT fn_vincular_cadeias_existentes()")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(vinculadas, 1, "so a cadeia inequivoca e ligada");

        let anterior: Option<String> = sqlx::query_scalar(
            "SELECT designacao_anterior_id::text FROM processo_designacoes WHERE id = $1::uuid",
        )
        .bind(&sucessora)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(anterior.as_deref(), Some(antecessora.as_str()));

        // As quatro do processo ambíguo continuam sem palpite.
        let ambiguas: i64 = sqlx::query_scalar(
            "SELECT count(*) FROM processo_designacoes
              WHERE processo_id = $1::uuid AND designacao_anterior_id IS NOT NULL",
        )
        .bind(&processo_ambiguo)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(ambiguas, 0, "par ambiguo fica em branco, nao chutado");

        // Idempotente: reaplicar a migration num banco já atualizado não muda
        // nada — é o que acontece a cada startup do app.
        let segunda: i32 = sqlx::query_scalar("SELECT fn_vincular_cadeias_existentes()")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(segunda, 0);
    })
    .await;
}
