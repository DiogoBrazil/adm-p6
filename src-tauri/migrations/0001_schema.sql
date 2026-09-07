-- =============================================================================
-- ADM-P6 — schema inicial
--
-- Controle dos processos e procedimentos administrativos da Seção de Justiça e
-- Disciplina do 7º BPM.
--
-- Princípios que este schema materializa:
--   1. Todo conceito de negócio é um cadastro administrável, não um literal no código.
--   2. Nome e sigla são apresentação; o comportamento vem de atributos semânticos.
--   3. Relações conhecidas do domínio são tabelas com FK, nunca JSONB nem lista em TEXT.
--   4. Cada informação tem uma única fonte de verdade.
--   5. Configuração define o comportamento futuro; não reescreve fatos já registrados.
--   6. Catálogo em uso se desativa (ativo = false); não se apaga (ON DELETE RESTRICT).
--
-- Ordem: extensões -> catálogos -> pessoas -> núcleo -> filhas -> sistema
--        -> índices -> triggers.
-- =============================================================================

-- Necessária para os EXCLUDE que combinam igualdade de uuid com sobreposição de
-- daterange no mesmo índice GiST (prazos e designações).
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- =============================================================================
-- 1. CATÁLOGOS SEM DEPENDÊNCIA
--
-- Todos seguem a mesma forma: id UUID, nome TEXT, ativo, timestamps, e um índice
-- único case-insensitive sobre o nome. As colunas extras de cada um carregam a
-- SEMÂNTICA que antes estava hardcoded no Rust/JS.
-- =============================================================================

-- processo / procedimento. Substitui a coluna livre `tipo_geral`.
CREATE TABLE tipos_apuratorio (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_tipos_apuratorio_nome ON tipos_apuratorio (lower(nome));

-- Portaria, Memorando Disciplinar, Feito Preliminar... Serve tanto como documento
-- iniciador do apuratório quanto como documento autorizador de prorrogação/designação.
CREATE TABLE tipos_documento (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_tipos_documento_nome ON tipos_documento (lower(nome));

-- Encarregado, Escrivão, Presidente, Interrogante. Quais papéis cada apuratório
-- usa é configuração (apuratorio_papeis), não regra de código.
CREATE TABLE papeis_processo (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_papeis_processo_nome ON papeis_processo (lower(nome));

-- Gravidade da transgressão disciplinar do RDPM (Leve/Média/Grave hoje, mas o
-- número de classificações é livre). NÃO confundir com naturezas_fato.
CREATE TABLE naturezas_transgressao (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_naturezas_transgressao_nome ON naturezas_transgressao (lower(nome));

-- Rubrica do fato apurado ("Dos crimes contra a pessoa", "Sinistro de trânsito
-- com viatura policial militar"...). No legado eram 38 <option> fixas no HTML.
-- `exige_condutor` substitui o `natureza.includes('sinistro de trânsito')`.
CREATE TABLE naturezas_fato (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome           TEXT        NOT NULL,
    exige_condutor BOOLEAN     NOT NULL DEFAULT false,
    ativo          BOOLEAN     NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_naturezas_fato_nome ON naturezas_fato (lower(nome));

-- Situação do PM no apuratório: Sindicado, Acusado, Indiciado, Investigado.
CREATE TABLE status_envolvido (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_status_envolvido_nome ON status_envolvido (lower(nome));

-- O que o ENCARREGADO propõe ao fim da apuração (arquivamento, instauração de
-- IPM, instauração de sindicância...). Conceito distinto da decisão da autoridade.
CREATE TABLE tipos_solucao_sugerida (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_tipos_solucao_sugerida_nome ON tipos_solucao_sugerida (lower(nome));

-- O que a AUTORIDADE decide (homologa, pune, absolve, arquiva, avoca).
-- `permite_penalidade` substitui o `solucao_tipo == "Punido"` do Rust e do Python.
CREATE TABLE tipos_solucao_decidida (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome               TEXT        NOT NULL,
    permite_penalidade BOOLEAN     NOT NULL DEFAULT false,
    ativo              BOOLEAN     NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_tipos_solucao_decidida_nome ON tipos_solucao_decidida (lower(nome));

-- Prisão, Detenção, Repreensão, Licenciado a bem da disciplina...
-- `usa_quantidade_dias` substitui o `Some("Prisao") | Some("Detencao")` do Rust.
CREATE TABLE tipos_penalidade (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                TEXT        NOT NULL,
    usa_quantidade_dias BOOLEAN     NOT NULL DEFAULT false,
    ativo               BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_tipos_penalidade_nome ON tipos_penalidade (lower(nome));

-- "Indícios de transgressão disciplinar", "Indícios de crime militar",
-- "Não houve indícios"... `indica_ausencia` marca a categoria que não pode
-- coexistir com nenhuma outra, sem que o código precise conhecer o nome dela.
CREATE TABLE categorias_indicio (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT        NOT NULL,
    indica_ausencia BOOLEAN     NOT NULL DEFAULT false,
    ativo           BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_categorias_indicio_nome ON categorias_indicio (lower(nome));

-- Militar / Comum. É escolhida NO VÍNCULO com o envolvido, não no catálogo do
-- artigo: pelo art. 9º do CPM um crime previsto na lei comum pode ser militar
-- conforme as circunstâncias do fato.
CREATE TABLE esferas_penais (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_esferas_penais_nome ON esferas_penais (lower(nome));

-- Crime / Contravenção Penal. Diferente da esfera, esta É propriedade do artigo.
CREATE TABLE especies_infracao_penal (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_especies_infracao_penal_nome ON especies_infracao_penal (lower(nome));

-- Código Penal Militar, Código Penal, Lei de Contravenções Penais, Estatuto dos
-- Policiais Militares, RDPM, leis especiais... Cadastrar legislação nova é
-- operação de usuário, não migration.
CREATE TABLE dispositivos_legais (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_dispositivos_legais_nome ON dispositivos_legais (lower(nome));

-- Classificação do andamento (despacho, remessa, retorno, juntada...).
-- No Rust eram 11 literais em movements/commands.rs sem coluna correspondente.
CREATE TABLE tipos_andamento (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_tipos_andamento_nome ON tipos_andamento (lower(nome));

-- Papel de pessoa citada no processo que NÃO é PM apurado: Vítima/Ofendido,
-- Pessoa a inquirir. Vítima pode ser pessoa jurídica ("ADMINISTRAÇÃO PÚBLICA"),
-- por isso processo_pessoas guarda nome e não referência a policial.
CREATE TABLE papeis_pessoa (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_papeis_pessoa_nome ON papeis_pessoa (lower(nome));

-- Oficiais / Praças. No schema anterior chamava-se `tipos_usuario`, nome que não
-- correspondia ao conceito: é o círculo hierárquico do posto, não um tipo de conta.
CREATE TABLE circulos_hierarquicos (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome       TEXT        NOT NULL,
    ativo      BOOLEAN     NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_circulos_hierarquicos_nome ON circulos_hierarquicos (lower(nome));

-- `pode_administrar` substitui o `perfil == "admin"` de auth/domain.rs.
-- O nome do perfil passa a ser livremente editável sem quebrar a autorização.
CREATE TABLE perfis_acesso (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             TEXT        NOT NULL,
    pode_administrar BOOLEAN     NOT NULL DEFAULT false,
    ativo            BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_perfis_acesso_nome ON perfis_acesso (lower(nome));

-- Municípios e distritos. `municipio_pai_id` é FK auto-referencial de verdade —
-- no banco legado era texto livre.
CREATE TABLE municipios_distritos (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome             TEXT        NOT NULL,
    tipo             TEXT        NOT NULL,
    municipio_pai_id UUID        NULL,
    ativo            BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_municipio_pai FOREIGN KEY (municipio_pai_id)
        REFERENCES municipios_distritos (id) ON DELETE RESTRICT,
    CONSTRAINT ck_municipio_nao_e_pai_de_si
        CHECK (municipio_pai_id IS NULL OR municipio_pai_id <> id)
);
CREATE UNIQUE INDEX uq_municipios_distritos_nome ON municipios_distritos (lower(nome), tipo);
CREATE INDEX ix_municipios_pai ON municipios_distritos (municipio_pai_id);


-- =============================================================================
-- 2. CATÁLOGOS DEPENDENTES
-- =============================================================================

-- Unidade da PM. Serve tanto como unidade de instauração do apuratório quanto
-- como unidade deprecada de uma carta precatória — no legado eram a mesma lista
-- de <option>, repetida em dois selects.
CREATE TABLE unidades_pm (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome         TEXT        NOT NULL,
    municipio_id UUID        NULL,
    ativo        BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_unidade_municipio FOREIGN KEY (municipio_id)
        REFERENCES municipios_distritos (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_unidades_pm_nome ON unidades_pm (lower(nome));
CREATE INDEX ix_unidades_pm_municipio ON unidades_pm (municipio_id);

-- `ordem_hierarquica` foi restaurada: existia no banco legado (CEL = 10 até
-- SD = -1) e é o que permite ordenar por hierarquia em vez de por nome.
-- `sigla` é apresentação apenas — nenhuma regra depende dela.
CREATE TABLE postos_graduacoes (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sigla                   TEXT        NOT NULL,
    nome                    TEXT        NOT NULL,
    circulo_hierarquico_id  UUID        NOT NULL,
    ordem_hierarquica       INTEGER     NOT NULL,
    ativo                   BOOLEAN     NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_posto_circulo FOREIGN KEY (circulo_hierarquico_id)
        REFERENCES circulos_hierarquicos (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_postos_graduacoes_sigla ON postos_graduacoes (lower(sigla));
CREATE UNIQUE INDEX uq_postos_graduacoes_nome  ON postos_graduacoes (lower(nome));
CREATE INDEX ix_postos_circulo ON postos_graduacoes (circulo_hierarquico_id);

-- Espécie de apuratório: SR, SV, IPM, FP, CP, PADS, PADE, PAD, CD, CJ — e o que
-- mais for cadastrado. Esta tabela substitui as 10 tabelas físicas e o
-- tipo_to_table() do Rust.
--
--   prazo_base_dias  : prazo inicial padrão desta espécie (era `match tipo_detalhe`)
--   max_envolvidos   : NULL = ilimitado. Hoje 1 para processos, NULL p/ procedimentos
--   exige_natureza_fato : CP não exige rubrica; os demais procedimentos exigem
--   codigo_extensao  : CÓDIGO TÉCNICO ESTÁVEL. Único do schema. Identifica que o
--                      apuratório usa uma tabela de extensão específica
--                      (hoje só 'carta_precatoria'). NULL = sem extensão.
--                      Existe porque adicionar extensão é inerentemente mudança de
--                      código; fica separado de `sigla`/`nome`, que continuam
--                      livremente editáveis pelo administrador.
CREATE TABLE apuratorios (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sigla               TEXT        NOT NULL,
    nome                TEXT        NOT NULL,
    tipo_apuratorio_id  UUID        NOT NULL,
    prazo_base_dias     INTEGER     NOT NULL DEFAULT 30,
    max_envolvidos      INTEGER     NULL,
    exige_natureza_fato BOOLEAN     NOT NULL DEFAULT false,
    codigo_extensao     TEXT        NULL,
    ativo               BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_apuratorio_tipo FOREIGN KEY (tipo_apuratorio_id)
        REFERENCES tipos_apuratorio (id) ON DELETE RESTRICT,
    CONSTRAINT ck_apuratorio_prazo_base    CHECK (prazo_base_dias > 0),
    CONSTRAINT ck_apuratorio_max_envolvidos CHECK (max_envolvidos IS NULL OR max_envolvidos > 0)
);
CREATE UNIQUE INDEX uq_apuratorios_sigla ON apuratorios (lower(sigla));
CREATE UNIQUE INDEX uq_apuratorios_nome  ON apuratorios (lower(nome));
CREATE INDEX ix_apuratorios_tipo ON apuratorios (tipo_apuratorio_id);

-- Quais documentos podem iniciar cada apuratório, e o prazo que cada combinação
-- impõe. Substitui o `if documento_iniciador == "Feito Preliminar" { 15 }`.
--   prazo_base_dias NULL -> usa apuratorios.prazo_base_dias
--   padrao               -> documento pré-selecionado no formulário
--
-- A PK (apuratorio_id, tipo_documento_id) é o alvo da FK COMPOSTA de
-- processos_procedimentos: é ela que impede gravar um par que o administrador
-- não cadastrou.
CREATE TABLE apuratorio_documentos_iniciadores (
    apuratorio_id     UUID        NOT NULL,
    tipo_documento_id UUID        NOT NULL,
    prazo_base_dias   INTEGER     NULL,
    padrao            BOOLEAN     NOT NULL DEFAULT false,
    ativo             BOOLEAN     NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_apuratorio_doc PRIMARY KEY (apuratorio_id, tipo_documento_id),
    CONSTRAINT fk_apdoc_apuratorio FOREIGN KEY (apuratorio_id)
        REFERENCES apuratorios (id) ON DELETE RESTRICT,
    CONSTRAINT fk_apdoc_documento FOREIGN KEY (tipo_documento_id)
        REFERENCES tipos_documento (id) ON DELETE RESTRICT,
    CONSTRAINT ck_apdoc_prazo CHECK (prazo_base_dias IS NULL OR prazo_base_dias > 0)
);
-- No máximo um documento iniciador padrão por apuratório.
CREATE UNIQUE INDEX uq_apdoc_padrao ON apuratorio_documentos_iniciadores (apuratorio_id)
    WHERE padrao;
CREATE INDEX ix_apdoc_documento ON apuratorio_documentos_iniciadores (tipo_documento_id);

-- Quais papéis cada apuratório usa. Substitui as regras hardcoded
-- "escrivão só em IPM", "presidente/interrogante/escrivão do processo só em
-- PAD/CD/CJ", "PAD/CD/CJ não têm encarregado".
--
--   obrigatorio   : o papel precisa estar designado para o processo ser salvo.
--                   Validado na aplicação (proceedings::validar_contra_configuracao),
--                   não no banco: a designação chega na mesma transação do
--                   processo, e um CHECK não enxerga outra tabela. Para permitir
--                   que o papel fique vago, desmarque `obrigatorio` neste
--                   apuratório — quem decide é a configuração, não o código.
--   max_ocupantes : quantas pessoas simultâneas nesse papel (constraint trigger)
--   e_responsavel : ESTE é o papel que responde pelo apuratório. Varia por
--                   apuratório: Encarregado nos procedimentos, Presidente em
--                   PAD/CD/CJ. Substitui o `responsavel_id` fixo e permite que
--                   "Encarregado" seja renomeado sem quebrar dashboard,
--                   relatórios, listagem ou substituição.
CREATE TABLE apuratorio_papeis (
    apuratorio_id UUID        NOT NULL,
    papel_id      UUID        NOT NULL,
    obrigatorio   BOOLEAN     NOT NULL DEFAULT false,
    max_ocupantes INTEGER     NOT NULL DEFAULT 1,
    e_responsavel BOOLEAN     NOT NULL DEFAULT false,
    ativo         BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_apuratorio_papel PRIMARY KEY (apuratorio_id, papel_id),
    CONSTRAINT fk_appapel_apuratorio FOREIGN KEY (apuratorio_id)
        REFERENCES apuratorios (id) ON DELETE RESTRICT,
    CONSTRAINT fk_appapel_papel FOREIGN KEY (papel_id)
        REFERENCES papeis_processo (id) ON DELETE RESTRICT,
    CONSTRAINT ck_appapel_max CHECK (max_ocupantes > 0)
);
-- No máximo um papel responsável por apuratório.
CREATE UNIQUE INDEX uq_appapel_responsavel ON apuratorio_papeis (apuratorio_id)
    WHERE e_responsavel;
CREATE INDEX ix_appapel_papel ON apuratorio_papeis (papel_id);

-- Títulos, capítulos e seções de um texto normativo.
CREATE TABLE subdivisao_textos_normativos (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                 TEXT        NOT NULL,
    dispositivo_legal_id UUID        NOT NULL,
    ativo                BOOLEAN     NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_subdivisao_dispositivo FOREIGN KEY (dispositivo_legal_id)
        REFERENCES dispositivos_legais (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_subdivisao_nome ON subdivisao_textos_normativos (dispositivo_legal_id, lower(nome));
CREATE INDEX ix_subdivisao_dispositivo ON subdivisao_textos_normativos (dispositivo_legal_id);

-- Artigo penal (crime ou contravenção). Substitui `crimes_contravencoes` e
-- devolve o eixo Crime x Contravenção que a migration 0008 havia removido.
-- A esfera (militar/comum) NÃO fica aqui: é escolhida por vínculo, em
-- envolvido_infracoes_penais.
CREATE TABLE infracoes_penais (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_legal_id UUID        NOT NULL,
    especie_id           UUID        NOT NULL,
    subdivisao_id        UUID        NULL,
    artigo               TEXT        NOT NULL,
    descricao            TEXT        NOT NULL,
    paragrafo            TEXT        NULL,
    inciso               TEXT        NULL,
    alinea               TEXT        NULL,
    ativo                BOOLEAN     NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_infpenal_dispositivo FOREIGN KEY (dispositivo_legal_id)
        REFERENCES dispositivos_legais (id) ON DELETE RESTRICT,
    CONSTRAINT fk_infpenal_especie FOREIGN KEY (especie_id)
        REFERENCES especies_infracao_penal (id) ON DELETE RESTRICT,
    CONSTRAINT fk_infpenal_subdivisao FOREIGN KEY (subdivisao_id)
        REFERENCES subdivisao_textos_normativos (id) ON DELETE RESTRICT
);
-- NULLS NOT DISTINCT: dois artigos sem parágrafo/inciso/alínea colidem, como deve ser.
CREATE UNIQUE INDEX uq_infracoes_penais ON infracoes_penais
    (dispositivo_legal_id, artigo, paragrafo, inciso, alinea) NULLS NOT DISTINCT;
CREATE INDEX ix_infpenal_dispositivo ON infracoes_penais (dispositivo_legal_id);
CREATE INDEX ix_infpenal_especie     ON infracoes_penais (especie_id);

-- Artigo do RDPM que define a gravidade (art. 15 = leve, 16 = média, 17 = grave
-- na configuração atual — mas isso é dado, não código). Substitui o
-- rdpm_artigo(gravidade) que existia duplicado em Rust e em SQL.
CREATE TABLE artigos_rdpm (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    artigo                   TEXT        NOT NULL,
    natureza_transgressao_id UUID        NOT NULL,
    ativo                    BOOLEAN     NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_artrdpm_natureza FOREIGN KEY (natureza_transgressao_id)
        REFERENCES naturezas_transgressao (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_artigos_rdpm_artigo ON artigos_rdpm (lower(artigo));
CREATE INDEX ix_artrdpm_natureza ON artigos_rdpm (natureza_transgressao_id);

-- Inciso do RDPM. A gravidade vem do artigo — não é duplicada aqui.
CREATE TABLE transgressoes (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    artigo_rdpm_id  UUID        NOT NULL,
    inciso          TEXT        NOT NULL,
    texto           TEXT        NOT NULL,
    ativo           BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_transgressao_artigo FOREIGN KEY (artigo_rdpm_id)
        REFERENCES artigos_rdpm (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_transgressoes ON transgressoes (artigo_rdpm_id, lower(inciso));
CREATE INDEX ix_transgressoes_artigo ON transgressoes (artigo_rdpm_id);

-- Infração estatutária. FUNDE infracoes_estatuto_art29 e _art32: o artigo virou
-- coluna, então cadastrar o art. 33 amanhã é operação de usuário.
-- `dispositivo_legal_id` é o que permite montar o rótulo completo
-- ("Art. 29, Inciso X, do Decreto-Lei 09A/1982") a partir do dado, em vez do
-- format!() hardcoded que existia em maps_reports.
CREATE TABLE infracoes_estatuto (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    dispositivo_legal_id UUID        NOT NULL,
    artigo               TEXT        NOT NULL,
    inciso               TEXT        NOT NULL,
    texto                TEXT        NOT NULL,
    ativo                BOOLEAN     NOT NULL DEFAULT true,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_infestatuto_dispositivo FOREIGN KEY (dispositivo_legal_id)
        REFERENCES dispositivos_legais (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_infracoes_estatuto ON infracoes_estatuto
    (dispositivo_legal_id, lower(artigo), lower(inciso));
CREATE INDEX ix_infestatuto_dispositivo ON infracoes_estatuto (dispositivo_legal_id);


-- =============================================================================
-- 3. PESSOAS E ACESSO
--
-- O schema anterior misturava dois conceitos numa tabela `usuarios`: o policial
-- militar cadastrado (236 no banco legado) e a conta de acesso (7 no banco
-- legado). Aqui são entidades separadas: toda referência de NEGÓCIO aponta para
-- policiais_militares; autenticação e auditoria apontam para usuarios.
-- =============================================================================

CREATE TABLE policiais_militares (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    matricula          TEXT        NOT NULL,
    nome               TEXT        NOT NULL,
    posto_graduacao_id UUID        NOT NULL,
    is_encarregado     BOOLEAN     NOT NULL DEFAULT false,
    ativo              BOOLEAN     NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_pm_posto FOREIGN KEY (posto_graduacao_id)
        REFERENCES postos_graduacoes (id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_pm_matricula ON policiais_militares (lower(matricula));
CREATE INDEX ix_pm_nome  ON policiais_militares (nome);
CREATE INDEX ix_pm_posto ON policiais_militares (posto_graduacao_id);
CREATE INDEX ix_pm_encarregado ON policiais_militares (is_encarregado) WHERE ativo;

-- Conta de acesso. `policial_militar_id` é opcional: existem contas técnicas
-- (o administrador inicial) que não correspondem a nenhum militar.
-- O CHECK garante UMA origem para o nome exibido — ou vem do PM vinculado, ou a
-- conta carrega o próprio rótulo. Nunca as duas, nunca nenhuma.
CREATE TABLE usuarios (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    policial_militar_id UUID        NULL,
    nome_exibicao       TEXT        NULL,
    email               TEXT        NOT NULL,
    senha_hash          TEXT        NOT NULL,
    perfil_id           UUID        NOT NULL,
    ativo               BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_usuario_pm FOREIGN KEY (policial_militar_id)
        REFERENCES policiais_militares (id) ON DELETE RESTRICT,
    CONSTRAINT fk_usuario_perfil FOREIGN KEY (perfil_id)
        REFERENCES perfis_acesso (id) ON DELETE RESTRICT,
    CONSTRAINT uq_usuario_pm UNIQUE (policial_militar_id),
    CONSTRAINT ck_usuario_tem_nome
        CHECK (policial_militar_id IS NOT NULL OR nome_exibicao IS NOT NULL)
);
CREATE UNIQUE INDEX uq_usuarios_email ON usuarios (lower(email));
CREATE INDEX ix_usuarios_perfil ON usuarios (perfil_id);


-- =============================================================================
-- 4. NÚCLEO
--
-- UMA tabela para todo processo/procedimento. Substitui as 10 tabelas por
-- espécie mais o hub `historico_processo_procedimentos`, cuja ligação 1:1 era
-- feita por código Rust e não tinha FK nenhuma.
-- =============================================================================

CREATE TABLE processos_procedimentos (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identidade. tipo_geral não existe: vem de apuratorio -> tipo_apuratorio.
    apuratorio_id            UUID        NOT NULL,
    documento_iniciador_id   UUID        NOT NULL,
    numero_documento         TEXT        NOT NULL,  -- nº da Portaria/Memorando/Feito
    numero_controle          TEXT        NULL,      -- NULL = igual ao numero_documento
    processo_sei             TEXT        NULL,
    numero_rgf               TEXT        NULL,

    -- Localização
    unidade_origem_id        UUID        NOT NULL,
    municipio_fato_id        UUID        NOT NULL,
    natureza_fato_id         UUID        NULL,

    -- Datas. `concluido` não existe: concluído <=> data_conclusao IS NOT NULL
    -- (equivalência verificada em 128/128 registros do banco legado).
    data_instauracao         DATE        NOT NULL,
    data_recebimento         DATE        NULL,  -- dispara o prazo inicial
    data_remessa_encarregado DATE        NULL,
    data_remessa_comissao    DATE        NULL,
    data_julgamento          DATE        NULL,
    data_conclusao           DATE        NULL,

    resumo_fatos             TEXT        NULL,

    ativo                    BOOLEAN     NOT NULL DEFAULT true,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- FK COMPOSTA: o par apuratório x documento iniciador precisa estar cadastrado
    -- em apuratorio_documentos_iniciadores. É o que faz o PostgreSQL proteger a
    -- configuração que o próprio administrador definiu, em vez de confiar no
    -- formulário. A integridade com apuratorios e tipos_documento vem por
    -- transitividade, pelas FKs da tabela de associação.
    CONSTRAINT fk_processo_apuratorio_documento
        FOREIGN KEY (apuratorio_id, documento_iniciador_id)
        REFERENCES apuratorio_documentos_iniciadores (apuratorio_id, tipo_documento_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_processo_unidade FOREIGN KEY (unidade_origem_id)
        REFERENCES unidades_pm (id) ON DELETE RESTRICT,
    CONSTRAINT fk_processo_municipio FOREIGN KEY (municipio_fato_id)
        REFERENCES municipios_distritos (id) ON DELETE RESTRICT,
    CONSTRAINT fk_processo_natureza FOREIGN KEY (natureza_fato_id)
        REFERENCES naturezas_fato (id) ON DELETE RESTRICT,

    -- Coerência cronológica. "Data não pode ser futura" NÃO vira CHECK:
    -- CURRENT_DATE não é imutável. Fica na validação de domínio.
    CONSTRAINT ck_processo_recebimento
        CHECK (data_recebimento IS NULL OR data_recebimento >= data_instauracao),
    CONSTRAINT ck_processo_remessa_enc
        CHECK (data_remessa_encarregado IS NULL OR data_remessa_encarregado >= data_instauracao),
    CONSTRAINT ck_processo_remessa_com
        CHECK (data_remessa_comissao IS NULL OR data_remessa_comissao >= data_instauracao),
    CONSTRAINT ck_processo_julgamento
        CHECK (data_julgamento IS NULL OR data_julgamento >= data_instauracao),
    CONSTRAINT ck_processo_conclusao
        CHECK (data_conclusao IS NULL OR data_conclusao >= data_instauracao),

    -- Chave alternativa redundante, mas necessária: é o alvo da FK composta de
    -- processo_designacoes, que assim carrega o apuratório do processo sem poder
    -- divergir dele. Ver comentário em processo_designacoes.
    CONSTRAINT uq_processo_apuratorio UNIQUE (id, apuratorio_id)
);

-- Numeração. Ambos os índices são PARCIAIS: validado contra o dump legado, as
-- duas chaves são únicas entre os 99 registros ativos, mas colidem se os
-- inativos forem incluídos (7 grupos duplicados).
--
-- 1) Número do documento iniciador, por unidade/ano/apuratório/documento.
CREATE UNIQUE INDEX uq_processo_numero_documento ON processos_procedimentos (
    unidade_origem_id,
    (EXTRACT(YEAR FROM data_instauracao)::INTEGER),
    apuratorio_id,
    documento_iniciador_id,
    lower(numero_documento)
) WHERE ativo;

-- 2) Número de controle EFETIVO, sequencial da Seção por unidade/ano/apuratório.
-- O COALESCE materializa a regra "numero_controle NULL significa igual ao número
-- do documento" sem precisar duplicar o valor numa coluna.
CREATE UNIQUE INDEX uq_processo_numero_controle ON processos_procedimentos (
    unidade_origem_id,
    (EXTRACT(YEAR FROM data_instauracao)::INTEGER),
    apuratorio_id,
    lower(COALESCE(numero_controle, numero_documento))
) WHERE ativo;

CREATE INDEX ix_processo_apuratorio  ON processos_procedimentos (apuratorio_id);
CREATE INDEX ix_processo_documento   ON processos_procedimentos (documento_iniciador_id);
CREATE INDEX ix_processo_unidade     ON processos_procedimentos (unidade_origem_id);
CREATE INDEX ix_processo_municipio   ON processos_procedimentos (municipio_fato_id);
CREATE INDEX ix_processo_natureza    ON processos_procedimentos (natureza_fato_id);
CREATE INDEX ix_processo_instauracao ON processos_procedimentos (data_instauracao);
CREATE INDEX ix_processo_conclusao   ON processos_procedimentos (data_conclusao);
CREATE INDEX ix_processo_em_andamento ON processos_procedimentos (data_instauracao)
    WHERE ativo AND data_conclusao IS NULL;

-- Extensão 1:0..1 — a única espécie com atributos realmente exclusivos.
-- A aplicação descobre que precisa dela por apuratorios.codigo_extensao,
-- nunca por sigla ou nome.
-- `deprecante` é autoridade externa à PM: texto por natureza, não catálogo.
CREATE TABLE carta_precatoria_detalhes (
    processo_id          UUID        PRIMARY KEY,
    deprecante           TEXT        NOT NULL,
    unidade_deprecada_id UUID        NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_cp_processo FOREIGN KEY (processo_id)
        REFERENCES processos_procedimentos (id) ON DELETE CASCADE,
    CONSTRAINT fk_cp_unidade FOREIGN KEY (unidade_deprecada_id)
        REFERENCES unidades_pm (id) ON DELETE RESTRICT
);
CREATE INDEX ix_cp_unidade ON carta_precatoria_detalhes (unidade_deprecada_id);


-- =============================================================================
-- 5. TABELAS FILHAS DO PROCESSO
-- =============================================================================

-- PMs apurados. Substitui `procedimento_pms_envolvidos` e absorve o `nome_pm_id`
-- da tabela principal: no banco legado nome_pm_id era sempre o PM de ordem 1
-- (91/91 procedimentos), então não existe conceito separado de "PM principal".
--
-- Solução e penalidade ficam AQUI, não no processo. Motivo: quantos envolvidos
-- cada apuratório aceita é configurável (apuratorios.max_envolvidos). Com
-- max_envolvidos = 1 o comportamento é idêntico ao de hoje; se amanhã um processo
-- passar a aceitar 2 acusados, cada um já tem seu desfecho, sem migration.
--
-- `e_condutor` substitui o `motorista_id` da tabela principal: no banco legado o
-- motorista era sempre um dos envolvidos (15/15), então é um papel, não outra
-- pessoa. O índice parcial garante no máximo um condutor por processo.
CREATE TABLE processo_envolvidos (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id         UUID        NOT NULL,
    policial_militar_id UUID        NOT NULL,
    status_envolvido_id UUID        NOT NULL,
    ordem               INTEGER     NOT NULL,
    e_condutor          BOOLEAN     NOT NULL DEFAULT false,
    solucao_sugerida_id UUID        NULL,
    solucao_decidida_id UUID        NULL,
    penalidade_tipo_id  UUID        NULL,
    penalidade_dias     INTEGER     NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_envolvido_processo FOREIGN KEY (processo_id)
        REFERENCES processos_procedimentos (id) ON DELETE RESTRICT,
    CONSTRAINT fk_envolvido_pm FOREIGN KEY (policial_militar_id)
        REFERENCES policiais_militares (id) ON DELETE RESTRICT,
    CONSTRAINT fk_envolvido_status FOREIGN KEY (status_envolvido_id)
        REFERENCES status_envolvido (id) ON DELETE RESTRICT,
    CONSTRAINT fk_envolvido_sol_sug FOREIGN KEY (solucao_sugerida_id)
        REFERENCES tipos_solucao_sugerida (id) ON DELETE RESTRICT,
    CONSTRAINT fk_envolvido_sol_dec FOREIGN KEY (solucao_decidida_id)
        REFERENCES tipos_solucao_decidida (id) ON DELETE RESTRICT,
    CONSTRAINT fk_envolvido_penalidade FOREIGN KEY (penalidade_tipo_id)
        REFERENCES tipos_penalidade (id) ON DELETE RESTRICT,
    CONSTRAINT uq_envolvido_pm    UNIQUE (processo_id, policial_militar_id),
    CONSTRAINT uq_envolvido_ordem UNIQUE (processo_id, ordem),
    CONSTRAINT ck_envolvido_ordem CHECK (ordem > 0),
    CONSTRAINT ck_envolvido_pena_dias
        CHECK (penalidade_dias IS NULL OR penalidade_dias > 0),
    -- Penalidade só existe onde houve decisão. Se a decisão específica PERMITE
    -- penalidade é regra configurável (tipos_solucao_decidida.permite_penalidade),
    -- validada na aplicação.
    CONSTRAINT ck_envolvido_pena_exige_decisao
        CHECK (penalidade_tipo_id IS NULL OR solucao_decidida_id IS NOT NULL)
);
CREATE UNIQUE INDEX uq_envolvido_condutor ON processo_envolvidos (processo_id)
    WHERE e_condutor;
CREATE INDEX ix_envolvido_processo ON processo_envolvidos (processo_id);
CREATE INDEX ix_envolvido_pm       ON processo_envolvidos (policial_militar_id);
CREATE INDEX ix_envolvido_status   ON processo_envolvidos (status_envolvido_id);
CREATE INDEX ix_envolvido_sol_dec  ON processo_envolvidos (solucao_decidida_id);

-- Quem exerce cada papel no processo, e desde quando. Substitui de uma vez:
--   responsavel_id, escrivao_id, presidente_id, interrogante_id,
--   escrivao_processo_id (5 colunas espalhadas pelas 10 tabelas)
--   + a coluna jsonb historico_encarregados
--   + a tabela historico_encarregados criada na migration 0028 e nunca usada.
--
-- O histórico de substituição passa a ser consequência natural: o encarregado
-- anterior é a designação com data_fim preenchida.
--
-- SEMÂNTICA DE data_fim: é EXCLUSIVA — o dia em que o sucessor assume. Assim a
-- substituição registra UMA data (como no legado) e não há sobreposição nem
-- buraco entre designações. Vigente = data_fim IS NULL.
CREATE TABLE processo_designacoes (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id              UUID        NOT NULL,
    apuratorio_id            UUID        NOT NULL,
    policial_militar_id      UUID        NOT NULL,
    papel_id                 UUID        NOT NULL,
    data_inicio              DATE        NOT NULL,
    data_fim                 DATE        NULL,
    documento_autorizador_id UUID        NULL,
    numero_documento         TEXT        NULL,
    motivo                   TEXT        NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Par de FKs compostas. A primeira amarra apuratorio_id ao apuratório real do
    -- processo (não pode divergir); a segunda exige que o papel esteja cadastrado
    -- para aquele apuratório. Juntas, o PostgreSQL garante que "escrivão só existe
    -- em IPM" e "PAD/CD/CJ não têm encarregado" — regras que hoje são literais em
    -- procedure_form.js:2374-2380 — sem que nenhum nome apareça no código.
    CONSTRAINT fk_designacao_processo FOREIGN KEY (processo_id, apuratorio_id)
        REFERENCES processos_procedimentos (id, apuratorio_id) ON DELETE RESTRICT,
    CONSTRAINT fk_designacao_apuratorio_papel FOREIGN KEY (apuratorio_id, papel_id)
        REFERENCES apuratorio_papeis (apuratorio_id, papel_id) ON DELETE RESTRICT,
    CONSTRAINT fk_designacao_pm FOREIGN KEY (policial_militar_id)
        REFERENCES policiais_militares (id) ON DELETE RESTRICT,
    CONSTRAINT fk_designacao_documento FOREIGN KEY (documento_autorizador_id)
        REFERENCES tipos_documento (id) ON DELETE RESTRICT,
    CONSTRAINT ck_designacao_periodo CHECK (data_fim IS NULL OR data_fim > data_inicio),
    -- A mesma pessoa não pode ocupar o mesmo papel do mesmo processo em períodos
    -- que se sobrepõem. Intervalo semiaberto [inicio, fim): data_fim é o dia da troca.
    CONSTRAINT ex_designacao_sobreposicao EXCLUDE USING gist (
        processo_id         WITH =,
        papel_id            WITH =,
        policial_militar_id WITH =,
        daterange(data_inicio, data_fim, '[)') WITH &&
    )
);
CREATE INDEX ix_designacao_processo ON processo_designacoes (processo_id);
CREATE INDEX ix_designacao_pm       ON processo_designacoes (policial_militar_id);
CREATE INDEX ix_designacao_papel    ON processo_designacoes (papel_id);
CREATE INDEX ix_designacao_vigente  ON processo_designacoes (processo_id, papel_id)
    WHERE data_fim IS NULL;

-- Prazo inicial e prorrogações.
--   ordem = 0 -> prazo inicial;  ordem >= 1 -> n-ésima prorrogação.
-- Isso substitui o catálogo `tipos_prazo`, cujo NOME ('inicial'/'prorrogacao')
-- dirigia o algoritmo — renomear a linha quebrava o cálculo.
--
-- data_vencimento é COLUNA GERADA. A aritmética do prazo passa a existir num
-- único lugar, no schema. Isso elimina a divergência que havia entre
-- proceedings/repository.rs (data_inicio + dias) e deadlines/commands.rs
-- (data_inicio + dias - 1). A regra correta é `+ dias`: verificada contra
-- 141/141 prazos reais do banco legado, iniciais e prorrogações.
-- Correção administrativa de um vencimento se faz ajustando `dias`.
--
-- Não há coluna `ativo`: o prazo vigente é o de maior `ordem`, e o EXCLUDE
-- garante que os períodos de um processo nunca se sobrepõem — invariante mais
-- forte do que o booleano que existia antes.
CREATE TABLE processo_prazos (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id              UUID        NOT NULL,
    ordem                    INTEGER     NOT NULL,
    data_inicio              DATE        NOT NULL,
    dias                     INTEGER     NOT NULL,
    data_vencimento          DATE        GENERATED ALWAYS AS (data_inicio + dias) STORED,
    motivo                   TEXT        NULL,
    documento_autorizador_id UUID        NULL,
    numero_documento         TEXT        NULL,
    data_documento           DATE        NULL,
    autoridade_id            UUID        NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_prazo_processo FOREIGN KEY (processo_id)
        REFERENCES processos_procedimentos (id) ON DELETE RESTRICT,
    CONSTRAINT fk_prazo_documento FOREIGN KEY (documento_autorizador_id)
        REFERENCES tipos_documento (id) ON DELETE RESTRICT,
    CONSTRAINT fk_prazo_autoridade FOREIGN KEY (autoridade_id)
        REFERENCES policiais_militares (id) ON DELETE RESTRICT,
    CONSTRAINT uq_prazo_ordem UNIQUE (processo_id, ordem),
    CONSTRAINT ck_prazo_ordem CHECK (ordem >= 0),
    CONSTRAINT ck_prazo_dias  CHECK (dias > 0),
    -- Prorrogação exige motivo; prazo inicial não.
    CONSTRAINT ck_prazo_motivo
        CHECK (ordem = 0 OR (motivo IS NOT NULL AND btrim(motivo) <> '')),
    CONSTRAINT ex_prazo_sobreposicao EXCLUDE USING gist (
        processo_id WITH =,
        daterange(data_inicio, data_inicio + dias, '[]') WITH &&
    )
);
CREATE INDEX ix_prazo_processo   ON processo_prazos (processo_id);
CREATE INDEX ix_prazo_vencimento ON processo_prazos (data_vencimento);
CREATE INDEX ix_prazo_documento  ON processo_prazos (documento_autorizador_id);

-- Andamentos. Substitui a coluna jsonb `andamentos` das 10 tabelas E a tabela
-- andamentos_processo_procedimentos da migration 0031 — que havia PERDIDO o
-- autor que o jsonb legado guardava (`{id, data, texto, usuario}`).
-- `cancelado_em` em vez de um booleano genérico: um andamento é um fato datado.
CREATE TABLE processo_andamentos (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id       UUID        NOT NULL,
    tipo_andamento_id UUID        NULL,
    descricao         TEXT        NOT NULL,
    ocorrido_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
    registrado_por_id UUID        NULL,
    cancelado_em      TIMESTAMPTZ NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_andamento_processo FOREIGN KEY (processo_id)
        REFERENCES processos_procedimentos (id) ON DELETE RESTRICT,
    CONSTRAINT fk_andamento_tipo FOREIGN KEY (tipo_andamento_id)
        REFERENCES tipos_andamento (id) ON DELETE RESTRICT,
    CONSTRAINT fk_andamento_usuario FOREIGN KEY (registrado_por_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT,
    CONSTRAINT ck_andamento_descricao CHECK (btrim(descricao) <> '')
);
CREATE INDEX ix_andamento_processo ON processo_andamentos (processo_id, ocorrido_em DESC);
CREATE INDEX ix_andamento_tipo     ON processo_andamentos (tipo_andamento_id);
CREATE INDEX ix_andamento_usuario  ON processo_andamentos (registrado_por_id);

-- Pessoas citadas que não são PMs apurados: vítimas/ofendidos e pessoas a
-- inquirir. Substitui `nome_vitima TEXT` (que no legado guardava array JSON em
-- 71 de 87 registros) e `pessoas_inquiridas` (array JSON dentro de uma coluna
-- TEXT). Não referencia policiais: vítima pode ser "ADMINISTRAÇÃO PÚBLICA".
CREATE TABLE processo_pessoas (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id     UUID        NOT NULL,
    papel_pessoa_id UUID        NOT NULL,
    nome            TEXT        NOT NULL,
    ordem           INTEGER     NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_pessoa_processo FOREIGN KEY (processo_id)
        REFERENCES processos_procedimentos (id) ON DELETE RESTRICT,
    CONSTRAINT fk_pessoa_papel FOREIGN KEY (papel_pessoa_id)
        REFERENCES papeis_pessoa (id) ON DELETE RESTRICT,
    CONSTRAINT uq_pessoa_ordem UNIQUE (processo_id, papel_pessoa_id, ordem),
    CONSTRAINT ck_pessoa_ordem CHECK (ordem > 0),
    CONSTRAINT ck_pessoa_nome  CHECK (btrim(nome) <> '')
);
CREATE INDEX ix_pessoa_processo ON processo_pessoas (processo_id);
CREATE INDEX ix_pessoa_papel    ON processo_pessoas (papel_pessoa_id);

-- Anexos. Substitui as 5 colunas pdf_* inline das 10 tabelas E a tabela
-- pdf_processo_procedimentos da migration 0030 — as duas coexistiam.
-- Permite mais de um anexo por processo.
-- O tamanho NÃO é armazenado: octet_length(conteudo) devolve o valor e nunca
-- pode divergir do arquivo.
CREATE TABLE processo_anexos (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id    UUID        NOT NULL,
    nome_arquivo   TEXT        NOT NULL,
    mime_type      TEXT        NOT NULL,
    conteudo       BYTEA       NOT NULL,
    enviado_por_id UUID        NULL,
    cancelado_em   TIMESTAMPTZ NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_anexo_processo FOREIGN KEY (processo_id)
        REFERENCES processos_procedimentos (id) ON DELETE RESTRICT,
    CONSTRAINT fk_anexo_usuario FOREIGN KEY (enviado_por_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT,
    CONSTRAINT ck_anexo_nome CHECK (btrim(nome_arquivo) <> '')
);
CREATE INDEX ix_anexo_processo ON processo_anexos (processo_id) WHERE cancelado_em IS NULL;
CREATE INDEX ix_anexo_usuario  ON processo_anexos (enviado_por_id);


-- =============================================================================
-- 6. ENQUADRAMENTO POR ENVOLVIDO
--
-- Todas penduram em processo_envolvidos.id. Assim o PostgreSQL garante que só
-- recebe enquadramento quem realmente é envolvido daquele processo — antes, as 5
-- tabelas pm_envolvido_* carregavam o par (processo_procedimento_id, envolvido_id)
-- separadamente, sem nada impedindo a combinação inexistente.
--
-- ON DELETE por FK, não por tabela:
--   envolvido_id -> CASCADE  (o vínculo não tem significado sem o envolvido)
--   catálogo     -> RESTRICT (apagar um artigo não pode apagar silenciosamente o
--                             enquadramento jurídico de processos passados)
-- =============================================================================

CREATE TABLE envolvido_categorias_indicio (
    envolvido_id         UUID        NOT NULL,
    categoria_indicio_id UUID        NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_env_cat_indicio PRIMARY KEY (envolvido_id, categoria_indicio_id),
    CONSTRAINT fk_eci_envolvido FOREIGN KEY (envolvido_id)
        REFERENCES processo_envolvidos (id) ON DELETE CASCADE,
    CONSTRAINT fk_eci_categoria FOREIGN KEY (categoria_indicio_id)
        REFERENCES categorias_indicio (id) ON DELETE RESTRICT
);
CREATE INDEX ix_eci_categoria ON envolvido_categorias_indicio (categoria_indicio_id);

-- Transgressão disciplinar do RDPM imputada ao envolvido.
CREATE TABLE envolvido_transgressoes (
    envolvido_id    UUID        NOT NULL,
    transgressao_id UUID        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_env_transgressao PRIMARY KEY (envolvido_id, transgressao_id),
    CONSTRAINT fk_et_envolvido FOREIGN KEY (envolvido_id)
        REFERENCES processo_envolvidos (id) ON DELETE CASCADE,
    CONSTRAINT fk_et_transgressao FOREIGN KEY (transgressao_id)
        REFERENCES transgressoes (id) ON DELETE RESTRICT
);
CREATE INDEX ix_et_transgressao ON envolvido_transgressoes (transgressao_id);

-- Infração estatutária imputada ao envolvido. `analogia_transgressao_id` é
-- NOT NULL: toda infração estatutária exige uma transgressão do RDPM por
-- analogia — regra universal do domínio, não particularidade dos arts. 29/32.
CREATE TABLE envolvido_infracoes_estatuto (
    envolvido_id             UUID        NOT NULL,
    infracao_estatuto_id     UUID        NOT NULL,
    analogia_transgressao_id UUID        NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_env_inf_estatuto PRIMARY KEY (envolvido_id, infracao_estatuto_id),
    CONSTRAINT fk_eie_envolvido FOREIGN KEY (envolvido_id)
        REFERENCES processo_envolvidos (id) ON DELETE CASCADE,
    CONSTRAINT fk_eie_infracao FOREIGN KEY (infracao_estatuto_id)
        REFERENCES infracoes_estatuto (id) ON DELETE RESTRICT,
    CONSTRAINT fk_eie_analogia FOREIGN KEY (analogia_transgressao_id)
        REFERENCES transgressoes (id) ON DELETE RESTRICT
);
CREATE INDEX ix_eie_infracao ON envolvido_infracoes_estatuto (infracao_estatuto_id);
CREATE INDEX ix_eie_analogia ON envolvido_infracoes_estatuto (analogia_transgressao_id);

-- Infração penal imputada ao envolvido. UMA tabela — substitui
-- pm_envolvido_crimes_militares e pm_envolvido_crimes_comuns.
-- A esfera (militar/comum) é escolhida AQUI, no vínculo, porque pelo art. 9º do
-- CPM a mesma conduta pode ser crime militar ou comum conforme as circunstâncias
-- do fato. Não é propriedade do artigo nem do dispositivo legal.
CREATE TABLE envolvido_infracoes_penais (
    envolvido_id      UUID        NOT NULL,
    infracao_penal_id UUID        NOT NULL,
    esfera_penal_id   UUID        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_env_inf_penal PRIMARY KEY (envolvido_id, infracao_penal_id),
    CONSTRAINT fk_eip_envolvido FOREIGN KEY (envolvido_id)
        REFERENCES processo_envolvidos (id) ON DELETE CASCADE,
    CONSTRAINT fk_eip_infracao FOREIGN KEY (infracao_penal_id)
        REFERENCES infracoes_penais (id) ON DELETE RESTRICT,
    CONSTRAINT fk_eip_esfera FOREIGN KEY (esfera_penal_id)
        REFERENCES esferas_penais (id) ON DELETE RESTRICT
);
CREATE INDEX ix_eip_infracao ON envolvido_infracoes_penais (infracao_penal_id);
CREATE INDEX ix_eip_esfera   ON envolvido_infracoes_penais (esfera_penal_id);


-- =============================================================================
-- 7. SISTEMA
-- =============================================================================

-- Trilha de auditoria. A referência genérica (entidade + registro_id) é adequada
-- aqui: é histórico técnico sobre tabelas heterogêneas, não uma relação do
-- domínio. Gravada na mesma transação da operação auditada.
--
-- `alteracoes` é JSONB e é justificado: diff heterogêneo e imutável, nunca
-- consultado campo a campo. Passa a importar muito agora que o comportamento do
-- sistema é configurável — sem ele não há como saber quem baixou o
-- prazo_base_dias de um apuratório, ou desmarcou permite_penalidade.
CREATE TABLE auditoria (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    entidade    TEXT        NOT NULL,
    registro_id TEXT        NOT NULL,
    operacao    TEXT        NOT NULL,
    usuario_id  UUID        NULL,
    alteracoes  JSONB       NULL,
    ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_auditoria_usuario FOREIGN KEY (usuario_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT,
    CONSTRAINT ck_auditoria_operacao
        CHECK (operacao IN ('CREATE', 'UPDATE', 'DELETE'))
);
CREATE INDEX ix_auditoria_entidade ON auditoria (entidade, registro_id);
CREATE INDEX ix_auditoria_usuario  ON auditoria (usuario_id);
CREATE INDEX ix_auditoria_data     ON auditoria (ocorrido_em DESC);

-- Mapa mensal salvo. `dados_mapa` é JSONB e é justificado: snapshot IMUTÁVEL de
-- um relatório já emitido, preservado exatamente como foi gerado, nunca
-- consultado campo a campo. Recalcular a partir do schema devolveria outro
-- resultado — é essa a razão de o mapa ser salvo.
--
-- `apuratorio_id` NULL = mapa de todas as espécies.
-- A coluna arquivo_pdf do schema anterior foi removida: nunca foi escrita, nem
-- no sistema legado (NULL em 107/107 mapas).
CREATE TABLE mapas_salvos (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo           TEXT        NOT NULL,
    apuratorio_id    UUID        NULL,
    periodo_inicio   DATE        NOT NULL,
    periodo_fim      DATE        NOT NULL,
    total_processos  INTEGER     NOT NULL DEFAULT 0,
    total_concluidos INTEGER     NOT NULL DEFAULT 0,
    total_andamento  INTEGER     NOT NULL DEFAULT 0,
    gerado_por_id    UUID        NULL,
    dados_mapa       JSONB       NOT NULL,
    ativo            BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_mapa_apuratorio FOREIGN KEY (apuratorio_id)
        REFERENCES apuratorios (id) ON DELETE RESTRICT,
    CONSTRAINT fk_mapa_usuario FOREIGN KEY (gerado_por_id)
        REFERENCES usuarios (id) ON DELETE RESTRICT,
    CONSTRAINT ck_mapa_periodo CHECK (periodo_fim >= periodo_inicio)
);
CREATE INDEX ix_mapa_periodo    ON mapas_salvos (periodo_inicio, periodo_fim);
CREATE INDEX ix_mapa_apuratorio ON mapas_salvos (apuratorio_id);
CREATE INDEX ix_mapa_usuario    ON mapas_salvos (gerado_por_id);


-- =============================================================================
-- 8. CONSTRAINT TRIGGERS — a exceção deliberada
--
-- Estas são as ÚNICAS duas triggers do schema. Existem porque as invariantes que
-- elas guardam dependem de valores CONFIGURÁVEIS (max_envolvidos, max_ocupantes),
-- e por isso não cabem em índice único nem em CHECK — o limite muda quando o
-- administrador muda, e uma constraint estática o congelaria.
--
-- Semântica obtida de graça, e desejada: baixar um limite BLOQUEIA novas escritas
-- e NÃO invalida as linhas já existentes. Configuração define o futuro; não
-- reescreve o passado.
--
-- DEFERRABLE INITIALLY DEFERRED: a verificação roda no COMMIT, então a aplicação
-- pode reordenar/substituir envolvidos dentro de uma transação sem tropeçar em
-- estados intermediários.
-- =============================================================================

CREATE FUNCTION fn_valida_max_envolvidos() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    limite    INTEGER;
    existente INTEGER;
BEGIN
    SELECT a.max_envolvidos INTO limite
      FROM processos_procedimentos p
      JOIN apuratorios a ON a.id = p.apuratorio_id
     WHERE p.id = NEW.processo_id;

    IF limite IS NULL THEN
        RETURN NULL;  -- apuratório sem limite configurado
    END IF;

    SELECT count(*) INTO existente
      FROM processo_envolvidos
     WHERE processo_id = NEW.processo_id;

    IF existente > limite THEN
        RAISE EXCEPTION
            'apuratorio aceita no maximo % envolvido(s); o processo % tem %',
            limite, NEW.processo_id, existente
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER tg_max_envolvidos
    AFTER INSERT OR UPDATE OF processo_id ON processo_envolvidos
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_valida_max_envolvidos();


CREATE FUNCTION fn_valida_max_ocupantes() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    limite    INTEGER;
    vigentes  INTEGER;
BEGIN
    -- Designação encerrada não disputa vaga.
    IF NEW.data_fim IS NOT NULL THEN
        RETURN NULL;
    END IF;

    SELECT ap.max_ocupantes INTO limite
      FROM apuratorio_papeis ap
     WHERE ap.apuratorio_id = NEW.apuratorio_id
       AND ap.papel_id      = NEW.papel_id;

    IF limite IS NULL THEN
        RETURN NULL;  -- a FK composta já garante que a linha existe
    END IF;

    SELECT count(*) INTO vigentes
      FROM processo_designacoes
     WHERE processo_id = NEW.processo_id
       AND papel_id    = NEW.papel_id
       AND data_fim IS NULL;

    IF vigentes > limite THEN
        RAISE EXCEPTION
            'papel aceita no maximo % ocupante(s) simultaneo(s); o processo % tem %',
            limite, NEW.processo_id, vigentes
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER tg_max_ocupantes
    AFTER INSERT OR UPDATE OF papel_id, data_fim ON processo_designacoes
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION fn_valida_max_ocupantes();
