-- =============================================================================
-- RECORTE DO BANCO LEGADO — fixture de tests/importacao.rs
--
-- GERADO, não escrito à mão. 26 dos 128 processos, escolhidos para exercitar
-- cada caminho da importação:
--
--   IPM 1     8 prorrogações (o máximo do banco)
--   IPM 3     prazos + duas substituições, uma delas no mesmo dia
--   IPM 8     9 envolvidos (o máximo) + substituições no mesmo dia
--   IPM 1/P6  o anexo
--   IPM 9     4 transgressões do RDPM + 4 crimes
--   SR 1      RDPM + crimes das duas esferas penais
--   SR 2      condutor (motorista) + art. 29 sem analogia
--   SR 5      art. 29 sem analogia (2 vínculos) + prazos
--   SR 20     três substituições no MESMO DIA (o caso do colapso)
--   PADS 1    penalidade, e sem envolvido registrado (os 37 da decisão 14)
--   CP 1      carta precatória (extensão 1:0..1)
--   CD, CJ, PAD, PADE, SV, FP entram INTEIROS: são poucas linhas, e sem eles a
--   etapa 02 não derivaria Presidente, Interrogante nem o prazo do FP.
--
-- Catálogos e os 236 militares entram inteiros — são pequenos.
--
-- O ANEXO É TRUNCADO: o arquivo real tem 20 MB. Ficam os primeiros 512 bytes.
-- O teste afirma que o anexo existe com nome e mime corretos, não os bytes.
--
-- O schema chega como `amostra` e o teste o renomeia para `legado` — mesma
-- técnica do roteiro de produção, e sem editar uma linha do arquivo.
-- =============================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: amostra; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA amostra;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: crimes_contravencoes; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.crimes_contravencoes (
    id text,
    tipo text,
    dispositivo_legal text,
    artigo text,
    descricao_artigo text,
    paragrafo text,
    inciso text,
    alinea text,
    ativo boolean,
    data_criacao date,
    data_atualizacao date
);


--
-- Name: infracoes_estatuto_art29; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.infracoes_estatuto_art29 (
    inciso text,
    texto text,
    ativo boolean,
    created_at timestamp without time zone,
    id text
);


--
-- Name: locais_origem; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.locais_origem (
    id text,
    codigo text,
    descricao text,
    tipo text,
    ativo boolean,
    created_at timestamp without time zone
);


--
-- Name: municipios_distritos; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.municipios_distritos (
    id text,
    nome text,
    tipo text,
    municipio_pai text,
    created_at timestamp without time zone,
    ativo boolean
);


--
-- Name: pm_envolvido_art29; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.pm_envolvido_art29 (
    id text,
    pm_indicios_id text,
    created_at timestamp without time zone,
    art29_id text
);


--
-- Name: pm_envolvido_crimes; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.pm_envolvido_crimes (
    id text,
    pm_indicios_id text,
    crime_id text,
    created_at timestamp without time zone
);


--
-- Name: pm_envolvido_indicios; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.pm_envolvido_indicios (
    id text,
    procedimento_id text,
    pm_envolvido_id text,
    categorias_indicios jsonb,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    ativo boolean,
    categoria text
);


--
-- Name: pm_envolvido_rdpm; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.pm_envolvido_rdpm (
    id text,
    pm_indicios_id text,
    transgressao_id integer,
    created_at timestamp without time zone
);


--
-- Name: postos_graduacoes; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.postos_graduacoes (
    id text,
    codigo text,
    descricao text,
    tipo text,
    ordem_hierarquica integer,
    ativo boolean,
    created_at timestamp without time zone
);


--
-- Name: prazos_processo; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.prazos_processo (
    id text,
    processo_id text,
    tipo_prazo text,
    data_inicio date,
    data_vencimento date,
    dias_adicionados integer,
    motivo text,
    autorizado_por text,
    autorizado_tipo text,
    ativo boolean,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    numero_portaria text,
    data_portaria date,
    ordem_prorrogacao integer
);


--
-- Name: procedimento_pms_envolvidos; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.procedimento_pms_envolvidos (
    id text,
    procedimento_id text,
    pm_id text,
    pm_tipo text,
    ordem integer,
    created_at timestamp without time zone,
    status_pm text
);


--
-- Name: processos_procedimentos; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.processos_procedimentos (
    id text,
    numero text,
    tipo_geral text,
    tipo_detalhe text,
    documento_iniciador text,
    processo_sei text,
    responsavel_id text,
    responsavel_tipo text,
    local_origem text,
    local_fatos text,
    data_instauracao date,
    data_recebimento date,
    escrivao_id text,
    status_pm text,
    nome_pm_id text,
    nome_vitima text,
    natureza_processo text,
    natureza_procedimento text,
    resumo_fatos text,
    numero_portaria text,
    numero_memorando text,
    numero_feito text,
    numero_rgf text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    ativo boolean,
    numero_controle text,
    concluido boolean,
    data_conclusao date,
    infracao_id integer,
    transgressoes_ids text,
    solucao_final text,
    ano_instauracao text,
    andamentos jsonb,
    data_remessa_encarregado date,
    data_julgamento date,
    solucao_tipo text,
    penalidade_tipo text,
    penalidade_dias integer,
    indicios_categorias jsonb,
    presidente_id text,
    presidente_tipo text,
    interrogante_id text,
    interrogante_tipo text,
    escrivao_processo_id text,
    escrivao_processo_tipo text,
    historico_encarregados jsonb,
    motorista_id text,
    unidade_deprecada text,
    deprecante text,
    pessoas_inquiridas text,
    pdf_nome character varying(255),
    pdf_content_type character varying(100),
    pdf_tamanho bigint,
    pdf_upload_em timestamp with time zone,
    pdf_arquivo bytea
);


--
-- Name: transgressoes; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.transgressoes (
    id integer,
    gravidade text,
    inciso text,
    texto text,
    ativo boolean,
    created_at timestamp without time zone,
    artigo integer
);


--
-- Name: usuarios; Type: TABLE; Schema: amostra; Owner: -
--

CREATE TABLE amostra.usuarios (
    id text,
    tipo_usuario text,
    posto_graduacao text,
    nome text,
    matricula text,
    is_encarregado boolean,
    is_operador boolean,
    email text,
    senha text,
    perfil text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    ativo boolean
);


--
-- Data for Name: crimes_contravencoes; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.crimes_contravencoes VALUES
	('87d1f65b-2c73-4836-84a8-3e169e0d6238', 'Crime', 'Código Penal', '121', 'Matar alguém', '', '', '', true, '2025-08-06', '2025-08-06'),
	('99ebeba5-89d5-4866-9b9a-16907d655414', 'Crime', 'Código Penal', '121', 'Matar alguem', '1º', '', '', true, '2025-08-07', '2025-08-07'),
	('4ea511e0-1211-4684-8c97-c746dda151c8', 'Crime', 'Código Penal', '121', 'Matar alguem', '2º', 'VII', 'b', true, '2025-08-07', '2025-08-07'),
	('6da9979a-04c9-4fec-9c7c-f85155b8650c', 'Crime', 'Código Penal', '121', 'Matar alguem', '2º', 'II', '', true, '2025-08-07', '2025-08-07'),
	('d00b990b-d68e-43bf-a226-bab1e10f379c', 'Crime', 'Código Penal', '129', 'Lesão corporal - Ofender a integridade corporal ou a saúde de outrem', NULL, NULL, NULL, false, '2025-08-06', '2025-08-06'),
	('f861d1d1-810f-445f-a7c0-c76014999b12', 'Crime', 'Código Penal', '155', 'Subtrair, para si ou para outrem, coisa alheia móvel', '', '', '', true, '2025-08-06', '2025-08-06'),
	('6eba9def-5c9d-43a5-bc6f-fb857762d2a3', 'Crime', 'Código Penal', '157', 'Subtrair coisa móvel alheia, para si ou para outrem, mediante grave ameaça ou violência à pessoa, ou depois de havê-la, por qualquer meio, reduzido à impossibilidade de resistência', '', '', '', true, '2025-08-06', '2025-08-06'),
	('c33c5cb6-3eba-4ae1-87bc-db53f952859c', 'Crime', 'Código Penal', '213', 'Constranger alguém, mediante violência ou grave ameaça, a ter conjunção carnal ou a praticar ou permitir que com ele se pratique outro ato libidinoso', '', '', '', true, '2025-08-06', '2025-08-06'),
	('aec37341-7315-4634-9bd6-9f163406b352', 'Crime', 'Código Penal', '312', 'Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio', '', '', '', true, '2025-08-06', '2025-08-06'),
	('2e57a26f-4742-4025-915d-90b7d5ea636e', 'Crime', 'Código Penal', '317', 'Solicitar ou receber, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida, ou aceitar promessa de tal vantagem', '', '', '', true, '2025-08-06', '2025-08-06'),
	('3f9c89e1-b6e1-46ba-894a-1edaa1838f4a', 'Crime', 'Código Penal', '329', 'Opor-se à execução de ato legal, mediante violência ou ameaça a funcionário competente para executá-lo ou a quem lhe esteja prestando auxílio', '', '', '', true, '2025-08-06', '2025-08-06'),
	('8d543da8-1da0-494b-bee7-fcb9acea4134', 'Crime', 'Código Penal', '331', 'Desacato - ', '', '', '', true, '2025-08-06', '2025-08-06'),
	('0af78b20-07c9-43d1-8253-30415986cb5a', 'Crime', 'Código Penal Militar', '163', 'Recusar obedecer a ordem do superior sôbre assunto ou matéria de serviço, ou relativamente a dever impôsto em lei, regulamento ou instrução.', '', '', '', true, '2025-08-06', '2025-08-06'),
	('6faa63e9-e41d-4e25-964a-7b553e12e0a1', 'Crime', 'Código Penal Militar', '164', 'Opor-se às ordens da sentinela', '', '', '', true, '2025-08-06', '2025-08-06'),
	('2a7a72ae-530f-4ce6-8978-c375023461dc', 'Crime', 'Código Penal Militar', '165', 'Promover a reunião de militares, ou nela tomar parte, para discussão de ato de superior ou assunto atinente à disciplina militar.', '', '', '', true, '2025-08-06', '2025-08-06'),
	('0d4491e8-f49e-49af-8897-1b4f9a92802d', 'Crime', 'Código de Trânsito Brasileiro', '302', 'Praticar homicídio culposo na direção de veículo automotor', NULL, NULL, NULL, false, '2025-08-06', '2025-08-06'),
	('032654e8-f4da-4c30-adc9-c525c09a810e', 'Crime', 'Código de Trânsito Brasileiro', '303', 'Praticar lesão corporal culposa na direção de veículo automotor', NULL, NULL, NULL, true, '2025-08-06', '2025-08-06'),
	('f41173fc-ba86-4851-a111-84978e1f8ba6', 'Crime', 'Código de Trânsito Brasileiro', '306', 'Conduzir veículo automotor com capacidade psicomotora alterada em razão da influência de álcool ou de outra substância psicoativa que determine dependência', NULL, NULL, NULL, true, '2025-08-06', '2025-08-06'),
	('59f749ad-237c-43ad-89bd-1254c89dcce0', 'Crime', 'Código de Trânsito Brasileiro', '309', 'Dirigir veículo automotor, em via pública, sem a devida Permissão para Dirigir ou Carteira de Habilitação', NULL, NULL, NULL, false, '2025-08-06', '2025-08-06'),
	('50a1bb85-94e6-431e-8e71-69b2aa66913c', 'Contravenção Penal', 'Lei de Contravenções Penais', '21', 'Praticar vias de fato contra alguém', '', '', '', true, '2025-08-06', '2025-08-06'),
	('e5979c9a-fb7a-456a-ad0c-57eaab9a6fc3', 'Contravenção Penal', 'Lei de Contravenções Penais', '47', 'Exercício ilegal de profissão ou atividade - Exercer profissão ou atividade econômica ou anunciar que a exerce, sem preencher as condições a que por lei está subordinado o seu exercício', NULL, NULL, NULL, true, '2025-08-06', '2025-08-06'),
	('7d23cad3-c666-4ed7-af92-8e249e3d078c', 'Contravenção Penal', 'Lei de Contravenções Penais', '65', 'Perturbação do trabalho ou do sossego alheios - Molestar alguém ou perturbar-lhe a tranquilidade, por acinte ou por motivo reprovável', NULL, NULL, NULL, true, '2025-08-06', '2025-08-06'),
	('fb66575a-90aa-47f8-b98c-ff34fde80069', 'Contravenção Penal', 'Lei de Contravenções Penais', '42', 'Perturbar alguem o trabalho ou o sossego alheios', '', '', '', true, '2025-11-09', '2025-11-09'),
	('aeecaa4d-7fc3-4c7c-bf7c-a9086c187a2f', 'Contravenção Penal', 'Lei de Contravenções Penais', '42', 'Perturbar alguem o trabalho ou o sossego alheios', '', '', '', false, '2025-11-09', '2025-11-09'),
	('a8e21b6f-4ae6-40db-a217-e0b26e3c5dce', 'Crime', 'Código Penal Militar', '196', 'Deixar o militar de desempenhar a missão que lhe foi confiada.', '', '', '', true, '2026-04-15', '2026-04-15'),
	('ea53c242-52c3-4193-8799-adb54c1cf6da', 'Crime', 'Código Penal Militar', '312', 'Omitir, em documento público ou particular, declaração que dêle devia constar, ou nêle inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sôbre fato jurìdicamente relevante, desde que o fato atente contra a administração ou o serviço militar.', '', '', '', true, '2026-04-15', '2026-04-15'),
	('98ceb23e-a47e-4282-9219-2d668d23985c', 'Crime', 'Código Penal', '147', 'Ameaçar alguém, por palavra, escrito ou gesto, ou qualquer outro meio simbólico, de causar-lhe mal injusto e grave.', '', '', '', true, '2026-04-15', '2026-04-15');


--
-- Data for Name: infracoes_estatuto_art29; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.infracoes_estatuto_art29 VALUES
	('I', 'amar a verdade e a responsabilidade como fundamentos da dignidade pessoal', true, '2025-08-05 09:38:44', '34db7b7d-2cfc-4b9e-a553-c43d6fe42dae'),
	('II', 'exercer, com autoridade, eficiência e probidade, as funções que lhe couberem em decorrência do cargo', true, '2025-08-05 09:38:44', '1e79f383-df95-495f-acd7-c3602608c595'),
	('III', 'respeitar a dignidade da pessoa humana', true, '2025-08-05 09:38:44', '8c872579-9d65-4662-a9ff-e123e4b6aab0'),
	('IV', 'cumprir e fazer cumprir as leis, os regulamentos, as instruções e as ordens das autoridades competentes', true, '2025-08-05 09:38:44', '490300d1-ae25-4185-ba46-f8e67b7f5e6b'),
	('V', 'ser justo e imparcial, nos julgamentos dos atos e na apreciação do mérito dos subordinados', true, '2025-08-05 09:38:44', 'cc0fdfcc-c5b2-4e31-a874-e3aace071070'),
	('VI', 'zelar pelo preparo próprio, moral, intelectual e físico, e, também, pelo dos subordinados, tendo em vista o cumprimento da missão comum', true, '2025-08-05 09:38:44', 'c19af374-03a5-4e76-adf5-9d91ed74db7d'),
	('VII', 'empregar todas as suas energias em benefício do serviço', true, '2025-08-05 09:38:44', '43d69220-0d2a-4e37-b070-b4dc92479c7b'),
	('VIII', 'praticar a camaradagem e desenvolver, permanentemente, o espírito de cooperação', true, '2025-08-05 09:38:44', '4ba13658-190d-4fd4-bde5-d973775197d8'),
	('IX', 'ser discreto em suas atitudes e maneiras, e em sua linguagem escrita e falada', true, '2025-08-05 09:38:44', '01457ed9-67a9-4f2f-917f-0a55c7222dec'),
	('X', 'abster-se de tratar, fora do âmbito apropriado, de matéria relativa à Segurança Nacional, seja de caráter sigiloso ou não', true, '2025-08-05 09:38:44', 'a7908759-6976-474b-8d06-8d75b991f3ad'),
	('XI', 'acatar as autoridades constituídas', true, '2025-08-05 09:38:44', '8eba83e2-c58a-4f63-adaf-95ea0013b7e6'),
	('XII', 'cumprir seus deveres de cidadão', true, '2025-08-05 09:38:44', '3a95e469-079e-40f1-beea-2c3477cddeb7'),
	('XIII', 'proceder de maneira ilibada na vida pública e particular', true, '2025-08-05 09:38:44', '10a98220-a1d6-4e90-886a-589a638d7ba6'),
	('XIV', 'observar as normas de boa educação', true, '2025-08-05 09:38:44', '7b1d47d4-e0cc-4c93-8b14-00a59ad07197'),
	('XV', 'garantir assistência moral e material ao seu lar e conduzir-se como chefe de família modelar', true, '2025-08-05 09:38:44', 'bf8d1b66-6661-4c21-a0f1-de70c150f413'),
	('XVI', 'conduzir-se, mesmo fora do serviço, ou na inatividade, de modo que não sejam prejudicados os princípios da disciplina, do respeito e do decoro policial-militar', true, '2025-08-05 09:38:44', '8e2fca70-0d66-4963-b47b-5219b435fca2'),
	('XVII', 'abster-se de fazer uso do posto, ou graduação, para obter facilidades pessoais de qualquer natureza, ou para encaminhar negócios particulares ou de terceiros', true, '2025-08-05 09:38:44', 'd8957c51-776b-43d6-9b7d-4c9b1d5ce3d5'),
	('XVIII', 'abster-se o Militar do Estado, na inatividade, do uso das designações hierárquicas quando: a) em atividade político-partidária; b) em atividades comerciais; c) em atividades industriais; d) para discutir ou provocar discussões pela imprensa a respeito de assuntos políticos ou policiais-militares, excetuando-se as de natureza exclusivamente técnica, se devidamente autorizado; e) no exercício de funções de natureza não Militar do Estado, mesmo oficiais', true, '2025-08-05 09:38:44', '9254a3ba-c6da-4f02-90b9-bd98b3914083'),
	('XIX', 'zelar pelo bom nome da Polícia Militar e de cada um dos seus integrantes, obedecendo e fazendo obedecer aos preceitos da ética policial-militar', true, '2025-08-05 09:38:44', '9bfd9917-68a5-4963-b5ef-e34c6a3a05e2'),
	('LX', 'asfduaosfhbouahfouahfoasfas', false, '2025-08-07 23:30:31', '63c7d6ac-bf50-49b0-81e0-11f94afe849f'),
	('C', 'TESTETSTETSTETST', false, '2025-08-07 23:36:45', '43a5ef96-4d38-4d76-9f15-dcbee3099fa2'),
	('LX', 'Brigar na rua com velhos teste', false, '2025-11-08 22:14:24.385756', '0d3385f6-1283-4e39-a3b3-85f28fced264'),
	('LX', 'Brigar na rua com velhpos', false, '2025-11-08 22:22:29.56809', '98fb86c2-3900-43e8-89af-4c871d2eb201');


--
-- Data for Name: locais_origem; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.locais_origem VALUES
	('loc001', '1º BPM', '1º Batalhão de Polícia Militar', 'BPM', true, '2025-08-01 15:44:00'),
	('loc002', '2º BPM', '2º Batalhão de Polícia Militar', 'BPM', true, '2025-08-01 15:44:00'),
	('loc003', 'BOPE', 'Batalhão de Operações Especiais', 'BOPE', true, '2025-08-01 15:44:00'),
	('loc004', 'ROTAM', 'Rondas Ostensivas Táticas Metropolitanas', 'ROTAM', true, '2025-08-01 15:44:00'),
	('loc005', 'CG', 'Comando Geral', 'COMANDO', true, '2025-08-01 15:44:00'),
	('loc006', 'CORREGEDORIA', 'Corregedoria da PM', 'COMANDO', true, '2025-08-01 15:44:00');


--
-- Data for Name: municipios_distritos; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.municipios_distritos VALUES
	('663d82c1-b97f-4ef1-83c6-c462dc4e725e', 'Abunã', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('d04de498-a615-4443-baeb-6094e0db4f47', 'Alta Floresta D''Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('02755fe3-b1b6-47bd-be1d-69755c357525', 'Alto Alegre dos Parecis', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('7ec317b1-0fd2-4fe6-b071-a754abb81e85', 'Alto Paraíso', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('adb2a3f7-7f5b-4e51-9b73-ad482366fb7d', 'Alvorada D''Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('8d86b6ed-5433-4283-83b6-25fc5260e435', 'Araras', 'distrito', 'Nova Mamoré', '2025-08-05 21:50:24', true),
	('f1b8108b-5409-41db-a0bc-b812757e78bd', 'Ariquemes', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('8b2b2d7d-633c-43c2-9cfc-d9427b7e8624', 'Barra de Camaratuba', 'distrito', 'Santa Luzia D''Oeste', '2025-08-05 21:50:24', true),
	('768195df-2ba8-4f12-ac74-e97784ecd9c6', 'Boa Esperança', 'distrito', 'Chupinguaia', '2025-08-05 21:50:24', true),
	('3093c203-d978-47c7-9a33-4cae58fb1f58', 'Boa Vista do Pacarana', 'distrito', 'Espigão D''Oeste', '2025-08-05 21:50:24', true),
	('95feca84-642f-407b-8532-16b6b4c505f8', 'Bom Futuro', 'distrito', 'Ariquemes', '2025-08-05 21:50:24', true),
	('0fc00357-acc2-4ed3-b214-60e7e0a25ba2', 'Bom Jesus', 'distrito', 'Jaru', '2025-08-05 21:50:24', true),
	('13979f1c-5861-44c0-b7cc-5acaa3f59b15', 'Buritis', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('c293b32d-1a05-49d8-a909-fac6e68e4a7a', 'Cabixi', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('46944cd8-71b7-4c27-810a-3a2f933f7d4d', 'Cacaulândia', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('7df3c6ab-14dd-49f3-af1c-78f530d9ab9b', 'Cacoal', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('2e9da6c1-adb8-4c64-92a6-881047715a1d', 'Calama', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('c1726aa7-6fa8-43aa-8147-97167dbc969e', 'Campo Novo de Rondônia', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('02410564-af78-4eec-b348-f4c9db5a8e8b', 'Candeias do Jamari', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('975eeb6c-b813-4885-9499-a61d35b88eb2', 'Castanheiras', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('5d5b8cbf-5a95-4644-925f-65cb4105fab8', 'Cerejeiras', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('ecbeb180-7aca-4f87-a230-5ad63c118ad8', 'Chupinguaia', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('0a7c30ae-23cb-4864-b31e-d07a29eb4350', 'Colina Verde', 'distrito', 'Governador Jorge Teixeira', '2025-08-05 21:50:24', true),
	('113c1e3d-d19b-468b-9702-dd0a76343816', 'Colorado do Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('443f1f63-453f-4c18-a26f-0df6c5e69188', 'Corumbiara', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('8d75eb1e-851b-4624-872e-478f1d193cc0', 'Costa Marques', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('e8a28f1e-9d6b-4636-9210-da52531b9e23', 'Cujubim', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('c9b42f22-d69b-4dba-a264-429518c0fe6a', 'Demarcação', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('6afb3fc3-d88a-4099-8ef0-70cfd4098f32', 'Divinópolis', 'distrito', 'Cacoal', '2025-08-05 21:50:24', true),
	('7368e7c1-c76f-4084-b4f8-6ca947ef926f', 'Espigão D''Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('4cb04178-4c34-4da7-85b8-1416ec91a4dd', 'Estrela de Rondônia', 'distrito', 'Presidente Médici', '2025-08-05 21:50:24', true),
	('d3ed48b2-0ccf-4aa3-8e45-bd2cae09b690', 'Extrema', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('d04289fd-2a12-4012-bc78-e31f5d207e6f', 'Filadélfia D''Oeste', 'distrito', 'Alta Floresta D''Oeste', '2025-08-05 21:50:24', true),
	('f173e5a6-9ec3-49f6-bea2-9094d3b75728', 'Flor da Serra', 'distrito', 'Espigão D''Oeste', '2025-08-05 21:50:24', true),
	('5db68ab1-dbe9-4e2b-8a6c-13a545d0d6bc', 'Fortaleza do Abunã', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('6e74884a-fbdb-4c08-b67b-d91e3b3c6d27', 'Governador Jorge Teixeira', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('431d17a5-ada7-4ed4-a4d2-033c90647678', 'Guajará-Mirim', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('db519f02-24e4-4cd7-8fb5-362b80065656', 'Iata', 'distrito', 'Guajará-Mirim', '2025-08-05 21:50:24', true),
	('f4297002-4868-4836-a640-6616ee2f07b0', 'Itapuã do Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('10ad83ea-e826-4268-a072-ab89b4ba6d23', 'Izidolândia', 'distrito', 'Alta Floresta D''Oeste', '2025-08-05 21:50:24', true),
	('db5722b9-2362-4324-aeb8-39f2ee057055', 'Jaci-Paraná', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('3046ec8f-d837-41b2-99fe-8b35d74146c1', 'Jacynópolis', 'distrito', 'Nova Mamoré', '2025-08-05 21:50:24', true),
	('0b8a053e-8851-48b9-86ed-d334db8851ea', 'Jardinópolis', 'distrito', 'Castanheiras', '2025-08-05 21:50:24', true),
	('b58fe2a7-2f68-4459-aa97-639b32307033', 'Jaru', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('96910af6-0ae7-48e3-bfab-ba6bc11ee623', 'Ji-Paraná', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('7d52be33-087d-4b32-b3c6-893389040577', 'Joelândia', 'distrito', 'Ariquemes', '2025-08-05 21:50:24', true),
	('3991f884-1d8b-4757-8e11-49d2f51ab654', 'Machadinho D''Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('ba4657d3-b03f-4a56-95a7-28e6419998ca', 'Marco Rondon', 'distrito', 'Pimenta Bueno', '2025-08-05 21:50:24', true),
	('53a372f8-8992-4d07-be0b-f687b306373d', 'Migrantinópolis', 'distrito', 'Novo Horizonte do Oeste', '2025-08-05 21:50:24', true),
	('61b523c0-7bf4-4082-ade2-04f04bd339a5', 'Ministro Andreazza', 'municipio', NULL, '2025-08-05 21:50:24', true);
INSERT INTO amostra.municipios_distritos VALUES
	('c3e995c3-73a3-4f8c-b13c-8f626baa564f', 'Mirante da Serra', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('13f97fb6-3ef9-49ae-a5e6-04438f3845fb', 'Monte Negro', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('920134c3-3305-4e44-9991-eeb204f898a8', 'Mutum-Paraná', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('3d84386f-02bd-4895-9c8c-626e33192a1c', 'Nazaré', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('ea871dc4-7309-4334-b4f9-d8c0cbde7242', 'Nova Brasilândia D''Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('cdadc521-6257-46b8-bac4-291d4bca4283', 'Nova Califórnia', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('d93743fa-ce8b-4afa-8b75-05e714d11021', 'Nova Colina', 'distrito', 'Ji-Paraná', '2025-08-05 21:50:24', true),
	('fb169a72-381d-4e88-815c-1514b9691024', 'Nova Conquista', 'distrito', 'Vilhena', '2025-08-05 21:50:24', true),
	('a7dc8530-644f-417e-b01b-fede6660ee4e', 'Nova Dimensão', 'distrito', 'Nova Mamoré', '2025-08-05 21:50:24', true),
	('dfb8339f-4b19-4b1a-b081-430154b60a1b', 'Nova Esperança - Espigão', 'distrito', 'Espigão D''Oeste', '2025-08-05 21:50:24', true),
	('c12a3264-7049-4bf3-9fcb-86c875135561', 'Nova Estrela de Rondônia', 'distrito', 'Rolim de Moura', '2025-08-05 21:50:24', true),
	('ebb6ed7b-1fb4-4343-8899-d62aed34dfee', 'Nova Gease D''Oeste', 'distrito', 'Alta Floresta D''Oeste', '2025-08-05 21:50:24', true),
	('75c86184-6aac-4122-aa6b-7a78aba285a3', 'Nova Londrina', 'distrito', 'Ji-Paraná', '2025-08-05 21:50:24', true),
	('6fb724bf-cd85-4d9f-8a5b-4b8a1b449f6f', 'Nova Mamoré', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('e39e96f6-3b81-458f-aaf1-954e955ea174', 'Nova União', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('91ff1094-e40f-408b-ba58-2b183461dab9', 'Novo Horizonte do Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('4aaeef9e-5178-47d2-a9c0-2382b4a4c216', 'Novo Paraíso - Espigão', 'distrito', 'Espigão D''Oeste', '2025-08-05 21:50:24', true),
	('dd2453d9-12ac-4e4c-b24d-77370c32688c', 'Novo Paraíso - São Felipe', 'distrito', 'São Felipe D''Oeste', '2025-08-05 21:50:24', true),
	('65fbf848-21b7-4f3f-9139-c291f6e840f6', 'Novo Plano', 'distrito', 'Chupinguaia', '2025-08-05 21:50:24', true),
	('69925ca2-8b22-4c7f-a395-6a0f8c77c753', 'Novo Riachuelo', 'distrito', 'Presidente Médici', '2025-08-05 21:50:24', true),
	('11f4e476-b7ee-4ede-a497-90044b5b755f', 'Oriente Novo', 'distrito', 'Machadinho D''Oeste', '2025-08-05 21:50:24', true),
	('63c94afb-7094-49e5-a3ab-bf6af3726630', 'Ouro Preto do Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('90105997-c881-4a86-8977-e7e92a65f18a', 'Palmeiras', 'distrito', 'Nova Mamoré', '2025-08-05 21:50:24', true),
	('1421b998-dc7b-4532-9fac-5130636a0741', 'Parecis', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('b1459de7-3cc0-4bca-bee4-fcb3f498b179', 'Pimenta Bueno', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('e42774be-3290-4a1e-a951-6fb5ae5b7c95', 'Pimenteiras do Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('c1df7c49-49ec-4eb6-a467-bc6e05db9496', 'Porto Velho', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('6457b54f-f036-4b8e-be72-01a17c5e762c', 'Presidente Médici', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('3748ef2b-8554-4fce-b39a-9673a83b3d06', 'Primavera de Rondônia', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('fab7d3bd-3359-40fb-b0e4-a7fbdc9d65f2', 'Príncipe da Beira', 'distrito', 'Costa Marques', '2025-08-05 21:50:24', true),
	('588be546-5dd4-45dd-89d9-a2eb7498e84b', 'Quinto Bec', 'distrito', 'Machadinho D''Oeste', '2025-08-05 21:50:24', true),
	('3b4b483c-e85f-433c-8f6e-49ce47965fb3', 'Rio Branco', 'distrito', 'Campo Novo de Rondônia', '2025-08-05 21:50:24', true),
	('a67bdd97-bf58-4d07-8373-67001492a7b5', 'Rio Crespo', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('5464e30a-5a51-40a6-9a16-2c85e0920bd3', 'Rio Preto do Candeias', 'distrito', 'Candeias do Jamari', '2025-08-05 21:50:24', true),
	('8351c6ce-1e3b-46d6-901e-092cc9aa0754', 'Riozinho', 'distrito', 'Cacoal', '2025-08-05 21:50:24', true),
	('01b7b348-370f-4199-a19f-5c258d86781b', 'Rolim de Moura', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('0db9011a-2559-4288-bbbf-7ab56b0b847a', 'Rolim de Moura do Guaporé', 'distrito', 'Alta Floresta D''Oeste', '2025-08-05 21:50:24', true),
	('7378bc73-0ebc-44be-a43f-accfc33f14df', 'Rondominas', 'distrito', 'Ouro Preto do Oeste', '2025-08-05 21:50:24', true),
	('c7d6d7e8-1c37-4424-a215-fcb1c2011406', 'Santa Cruz da Serra', 'distrito', 'Jaru', '2025-08-05 21:50:24', true),
	('7bfbb9ed-31e7-4834-b994-ebe2ff965c01', 'Santa Luzia D''Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('3f6a20cf-ee00-4f9a-9a7d-f09e377e8e35', 'Santana do Guaporé', 'distrito', 'São Miguel do Guaporé', '2025-08-05 21:50:24', true),
	('ae48a942-c1b8-4cb4-937d-91cdfb7eb6af', 'Santo Antônio D''Oeste', 'distrito', 'Alta Floresta D''Oeste', '2025-08-05 21:50:24', true),
	('a86d1c3a-2106-407b-b7c7-94e87a53a7a8', 'Seringueiras', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('0c24c44a-fb22-42c7-995b-7e3b9d421b63', 'Surpresa', 'distrito', 'Guajará-Mirim', '2025-08-05 21:50:24', true),
	('6dfbb187-2685-4917-b5b5-ff538ad0efee', 'São Carlos', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true),
	('b65ce06d-31f9-40bf-892a-2f677c7cbc67', 'São Felipe D''Oeste', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('13e417e5-6041-49be-9ebc-883071af8de3', 'São Francisco do Guaporé', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('a8c63a64-c159-4c14-b7a6-7d5a9b9bdebd', 'São Miguel do Guaporé', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('c2cd39ef-d2cc-400c-af5b-48127c546a59', 'Tabajara', 'distrito', 'Machadinho D''Oeste', '2025-08-05 21:50:24', true),
	('c689e7e5-44d7-48c5-8f24-3fe82e83468f', 'Tancredópolis', 'distrito', 'Alvorada D''Oeste', '2025-08-05 21:50:24', true);
INSERT INTO amostra.municipios_distritos VALUES
	('0bca42de-4de1-4827-b045-b07b474f7cf5', 'Tarilândia', 'distrito', 'Jaru', '2025-08-05 21:50:24', true),
	('14347f04-3a1b-4f4d-ba46-9c6a0aaa68b1', 'Teixeirópolis', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('45370d1e-f5cd-442f-80f3-adcbd7861859', 'Terra Boa', 'distrito', 'Alvorada D''Oeste', '2025-08-05 21:50:24', true),
	('41eb85e6-9ab8-49f0-a044-8a60afec6442', 'Theobroma', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('bff3f114-d93e-4a8d-9362-3f0c0b020b15', 'Três Coqueiros', 'distrito', 'Campo Novo de Rondônia', '2025-08-05 21:50:24', true),
	('6579ede4-b08c-4f6d-85e8-d40c8714bd04', 'Urupá', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('5b6ee609-13b0-497f-885b-01444378ee46', 'Vale do Anari', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('7f35cc23-6ced-440e-8066-b6ec3246c787', 'Vale do Paraíso', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('870bdf4a-e9da-46c2-ab13-0edc04a176cf', 'Vila Bandeira Branca', 'distrito', 'Presidente Médici', '2025-08-05 21:50:24', true),
	('74277582-ed8f-4f88-a49b-06696c8f17ad', 'Vila Camargo', 'distrito', 'Presidente Médici', '2025-08-05 21:50:24', true),
	('75bf103c-9579-4fae-ab4f-6a9b327dab6c', 'Vilhena', 'municipio', NULL, '2025-08-05 21:50:24', true),
	('92530bca-81fb-42d6-bc81-94ebdb15b9e9', 'Vista Alegre do Abunã', 'distrito', 'Porto Velho', '2025-08-05 21:50:24', true);


--
-- Data for Name: pm_envolvido_art29; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.pm_envolvido_art29 VALUES
	('b1c264ee-c20c-4e0e-b2dd-8b67c9824a75', 'b40bb5d5-d389-4cb6-b3d7-199628268416', '2025-11-09 17:57:10.107859', '8c872579-9d65-4662-a9ff-e123e4b6aab0'),
	('8b68d166-cbbb-4f33-989c-4edc16b74cad', '9e17342e-a217-47f6-b7d1-b67c45f8ecba', '2026-04-15 11:20:34.639521', '10a98220-a1d6-4e90-886a-589a638d7ba6'),
	('f3192734-9cb8-4d21-921b-c67a609504dc', '9e17342e-a217-47f6-b7d1-b67c45f8ecba', '2026-04-15 11:20:34.639521', '8c872579-9d65-4662-a9ff-e123e4b6aab0');


--
-- Data for Name: pm_envolvido_crimes; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.pm_envolvido_crimes VALUES
	('94ccbe9b-2b81-44c4-b607-1bbd568c1ef0', '0c082fce-ad7c-4645-8bfc-97708cd63fda', 'ea53c242-52c3-4193-8799-adb54c1cf6da', '2026-04-15 07:54:35.387753'),
	('b893fd14-d18e-46d5-82ac-b9fa6b968d96', '0c082fce-ad7c-4645-8bfc-97708cd63fda', 'a8e21b6f-4ae6-40db-a217-e0b26e3c5dce', '2026-04-15 07:54:35.387753'),
	('979362f5-592a-48ab-9539-5b173ecaaf5a', 'c0469df7-f262-42df-b62a-0e73efdf8f8b', 'a8e21b6f-4ae6-40db-a217-e0b26e3c5dce', '2026-04-15 07:54:35.387753'),
	('f33ca53a-0954-4539-a743-8bce5ce54b24', 'b41b136b-28a6-47dc-b828-b13eafc588a7', 'a8e21b6f-4ae6-40db-a217-e0b26e3c5dce', '2026-04-15 07:54:35.387753'),
	('8f57aec9-dd35-42c2-9396-72115a170b2b', 'd7827f73-7d88-4a85-934b-645d45b9ad79', 'fb66575a-90aa-47f8-b98c-ff34fde80069', '2025-11-09 18:29:13.879323'),
	('cce4bf01-2ed6-4d07-b0d7-d0a373cfd132', 'd7827f73-7d88-4a85-934b-645d45b9ad79', 'f861d1d1-810f-445f-a7c0-c76014999b12', '2025-11-09 18:29:13.879323'),
	('1b1e25b9-7fdc-4b2b-8e30-31f286f91155', '9e17342e-a217-47f6-b7d1-b67c45f8ecba', '98ceb23e-a47e-4282-9219-2d668d23985c', '2026-04-15 11:20:34.639521');


--
-- Data for Name: pm_envolvido_indicios; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.pm_envolvido_indicios VALUES
	('d7827f73-7d88-4a85-934b-645d45b9ad79', '5e060c66-74be-407e-b176-7a8376e23653', '1ae7cf41-258f-43f4-9db4-cc0f05d8371d', '["Indícios de crime comum"]', '2025-11-08 17:36:38.118395', '2025-11-08 17:36:38.118395', true, 'Indícios de crime comum'),
	('08142036-4b65-4844-8013-35583b61de8f', '5e060c66-74be-407e-b176-7a8376e23653', '21257700-838e-43c4-935b-2b310435f0cf', '["Indícios de transgressão disciplinar"]', '2025-11-08 17:36:38.118395', '2025-11-08 17:36:38.118395', true, 'Indícios de transgressão disciplinar'),
	('a8eb5467-16d4-4df5-a40d-d603bfdd6263', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', '2afbfa41-6994-483e-9c9b-7be14e234916', '["Não houve indícios"]', '2025-11-28 09:53:52.558268', '2025-11-28 09:53:52.558268', true, 'Não houve indícios'),
	('30f78ca9-1c96-4cf0-9ece-7b42539f09d6', 'b0294d82-4d35-46d4-a10f-2bd2b555d462', '498b9987-7719-4ad8-bcb4-48fa21262865', '["Não houve indícios"]', '2025-11-14 10:46:37.593753', '2025-11-14 10:46:37.593753', true, 'Não houve indícios'),
	('b41b136b-28a6-47dc-b828-b13eafc588a7', '06d1dd69-ad23-490a-9492-80670ba3bae8', 'beda1761-b788-435b-b7b5-c3f9aac2ea81', '["Indícios de transgressão disciplinar", "Indícios de crime militar"]', '2026-03-17 12:53:34.032494', '2026-03-17 12:53:34.032494', true, 'Indícios de transgressão disciplinar'),
	('c0469df7-f262-42df-b62a-0e73efdf8f8b', '06d1dd69-ad23-490a-9492-80670ba3bae8', 'f8defb85-c6a7-416e-8c35-043ae1faac25', '["Indícios de transgressão disciplinar", "Indícios de crime militar"]', '2026-03-17 12:53:34.032494', '2026-03-17 12:53:34.032494', true, 'Indícios de transgressão disciplinar'),
	('0c082fce-ad7c-4645-8bfc-97708cd63fda', '06d1dd69-ad23-490a-9492-80670ba3bae8', 'f815b9be-3227-4176-b15b-05a0adf68385', '["Indícios de transgressão disciplinar", "Indícios de crime militar"]', '2026-03-17 12:53:34.032494', '2026-03-17 12:53:34.032494', true, 'Indícios de transgressão disciplinar'),
	('a81c9e1b-5f44-4228-a26f-78b7af465670', 'b566018e-459e-4269-be54-75cd7e41f63e', '3232dc92-5c64-4cf4-8d17-fc59785fa1e7', '["Não houve indícios"]', '2025-11-08 20:25:04.675677', '2025-11-08 20:25:04.675677', true, 'Não houve indícios'),
	('b40bb5d5-d389-4cb6-b3d7-199628268416', 'b5d79aa8-faca-4d2f-9cca-987cd453f80b', '772b8e14-acc0-43d1-946c-e5ec95a81c40', '["Indícios de transgressão disciplinar"]', '2025-11-08 22:36:10.598863', '2025-11-08 22:36:10.598863', true, 'Indícios de transgressão disciplinar'),
	('9e17342e-a217-47f6-b7d1-b67c45f8ecba', 'ef7a9b08-5f4a-4a43-96dc-0d4666f00914', 'db646d16-1e72-4986-b298-87d5dc25e6f4', '["Indícios de crime comum", "Indícios de transgressão disciplinar"]', '2026-04-15 11:20:34.639521', '2026-04-15 11:20:34.639521', true, 'Indícios de crime comum'),
	('c431d9e4-6bc9-42fa-b2f1-fce0926593b3', 'ec07f120-e4c5-4337-b628-592c5859339c', '1b9b22b1-a165-4702-b1a3-a5c8e89f7a2c', '["Não houve indícios"]', '2025-11-28 08:54:04.146716', '2025-11-28 08:54:04.146716', true, 'Não houve indícios');


--
-- Data for Name: pm_envolvido_rdpm; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.pm_envolvido_rdpm VALUES
	('c474d5c5-3654-46b7-8976-dcc90ec78e14', '0c082fce-ad7c-4645-8bfc-97708cd63fda', 59, '2026-04-15 07:54:35.387753'),
	('ea69e37c-a6b5-410f-8499-84225ad8528f', '08142036-4b65-4844-8013-35583b61de8f', 52, '2025-11-09 18:29:13.879323'),
	('716201ae-5ef3-419b-b413-999d9f8e72c2', 'c0469df7-f262-42df-b62a-0e73efdf8f8b', 32, '2026-04-15 07:54:35.387753'),
	('dc6b419e-10ef-454f-92d7-50d4cffc64ec', 'b41b136b-28a6-47dc-b828-b13eafc588a7', 32, '2026-04-15 07:54:35.387753');


--
-- Data for Name: postos_graduacoes; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.postos_graduacoes VALUES
	('pg001', 'CEL PM', 'Coronel PM', 'oficial', 10, true, '2025-08-01 15:44:00'),
	('pg002', 'TEN CEL PM', 'Tenente-Coronel PM', 'oficial', 9, true, '2025-08-01 15:44:00'),
	('pg003', 'MAJ PM', 'Major PM', 'oficial', 8, true, '2025-08-01 15:44:00'),
	('pg004', 'CAP PM', 'Capitão PM', 'oficial', 7, true, '2025-08-01 15:44:00'),
	('pg005', '1º TEN PM', 'Primeiro-Tenente PM', 'oficial', 6, true, '2025-08-01 15:44:00'),
	('pg006', '2º TEN PM', 'Segundo-Tenente PM', 'oficial', 5, true, '2025-08-01 15:44:00'),
	('pg007', 'SUB TEN PM', 'Subtenente PM', 'praca', 4, true, '2025-08-01 15:44:00'),
	('pg008', '1º SGT PM', 'Primeiro-Sargento PM', 'praca', 3, true, '2025-08-01 15:44:00'),
	('pg009', '2º SGT PM', 'Segundo-Sargento PM', 'praca', 2, true, '2025-08-01 15:44:00'),
	('pg010', '3º SGT PM', 'Terceiro-Sargento PM', 'praca', 1, true, '2025-08-01 15:44:00'),
	('pg011', 'CB PM', 'Cabo PM', 'praca', 0, true, '2025-08-01 15:44:00'),
	('pg012', 'SD PM', 'Soldado PM', 'praca', -1, true, '2025-08-01 15:44:00');


--
-- Data for Name: prazos_processo; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.prazos_processo VALUES
	('b41817c7-b493-4ec9-89d6-a98f36868598', '6f3e6cda-e97e-492e-adbc-e84e4fb79c54', 'inicial', '2025-11-02', '2025-11-17', 15, 'Prazo inicial automático', NULL, NULL, false, '2025-11-08 18:52:59.867238', '2025-11-08 18:54:30.376983', NULL, NULL, NULL),
	('1815fdac-1e34-4ec7-b91f-638f5dabb3a4', '6f3e6cda-e97e-492e-adbc-e84e4fb79c54', 'prorrogacao', '2025-11-17', '2025-11-27', 10, 'Encarregado precisa ouvir mais pessoas.', NULL, NULL, true, '2025-11-08 18:54:30.376983', '2025-11-08 18:54:30.376983', '1', '2025-11-08', 1),
	('f5218f83-53ce-4834-98ba-52ab9a2e40d3', 'd91c19ba-3aec-456b-889b-9cd793b3f262', 'inicial', '2025-10-15', '2025-10-30', 15, 'Prazo inicial automático', NULL, NULL, false, '2025-11-08 19:15:40.77411', '2025-11-08 19:15:40.793939', NULL, NULL, NULL),
	('a5704d4d-46a4-4c2b-8be1-a19b0efc60e2', 'd91c19ba-3aec-456b-889b-9cd793b3f262', 'prorrogacao', '2025-10-30', '2025-11-09', 10, NULL, NULL, NULL, true, '2025-11-08 19:15:40.793939', '2025-11-08 19:15:40.793939', '2', '2025-11-08', 1),
	('a3765604-6c65-4442-9d47-de282120a752', '5e060c66-74be-407e-b176-7a8376e23653', 'inicial', '2025-11-06', '2025-12-06', 30, 'Prazo inicial automático', NULL, NULL, false, '2025-11-08 19:51:00.941606', '2025-11-08 19:51:00.953274', NULL, NULL, NULL),
	('b6bd4a80-17d3-402f-a8af-ba0a4963b3c2', '5e060c66-74be-407e-b176-7a8376e23653', 'prorrogacao', '2025-12-06', '2025-12-16', 10, NULL, NULL, NULL, true, '2025-11-08 19:51:00.953274', '2025-11-08 19:51:00.953274', '3', '2025-11-05', 1),
	('f7918bb9-c541-45ab-919b-04b98c019802', 'ec07f120-e4c5-4337-b628-592c5859339c', 'inicial', '2024-01-22', '2024-03-02', 40, 'Prazo inicial automático', NULL, NULL, false, '2025-11-28 08:40:49.492229', '2025-11-28 08:40:49.496619', NULL, NULL, NULL),
	('a4b5b3fe-cd7e-4d00-bd37-3b31693dd488', 'ec07f120-e4c5-4337-b628-592c5859339c', 'prorrogacao', '2024-03-02', '2024-03-22', 20, NULL, NULL, NULL, false, '2025-11-28 08:40:49.496619', '2025-11-28 08:50:11.789911', '28', '2024-03-04', 1),
	('7c17d131-cc3b-4410-ba22-d8d525783ceb', 'ec07f120-e4c5-4337-b628-592c5859339c', 'prorrogacao', '2024-03-22', '2024-08-06', 137, NULL, NULL, NULL, false, '2025-11-28 08:50:11.789911', '2025-11-28 09:00:24.568163', '45880', '2024-05-15', 2),
	('bc988cad-66c0-4d0e-9500-2e3e553a808f', 'ec07f120-e4c5-4337-b628-592c5859339c', 'prorrogacao', '2024-08-06', '2025-01-19', 166, NULL, NULL, NULL, false, '2025-11-28 09:00:24.568163', '2025-11-28 09:07:41.960346', '110020', '2024-11-11', 3),
	('b2c68e43-919d-4d9c-81ca-fe39ad45914b', 'ec07f120-e4c5-4337-b628-592c5859339c', 'prorrogacao', '2025-01-19', '2025-06-10', 142, NULL, NULL, NULL, false, '2025-11-28 09:07:41.960346', '2025-11-28 09:10:49.357269', '24568', '2025-03-14', 4),
	('b1d7790a-492b-4a16-a13f-7395f7a032f5', 'ec07f120-e4c5-4337-b628-592c5859339c', 'prorrogacao', '2025-06-10', '2025-10-06', 118, NULL, NULL, NULL, false, '2025-11-28 09:10:49.357269', '2025-11-28 09:14:39.530022', '68260', '2025-07-14', 5),
	('087c803f-d2b9-46e5-b582-dbde745ea13f', 'ec07f120-e4c5-4337-b628-592c5859339c', 'prorrogacao', '2025-10-06', '2026-01-15', 101, NULL, NULL, NULL, false, '2025-11-28 09:14:39.530022', '2025-11-28 09:16:22.984898', '117278', '2025-11-24', 6),
	('78387069-3002-42d2-a922-77e1cab90054', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'inicial', '2023-08-01', '2023-09-10', 40, 'Prazo inicial automático', NULL, NULL, false, '2025-11-28 09:25:09.016484', '2025-11-28 09:25:09.021398', NULL, NULL, NULL),
	('d7c51c2a-0491-4bdd-8f7b-11643274e5ac', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'prorrogacao', '2023-09-10', '2023-09-30', 20, NULL, NULL, NULL, false, '2025-11-28 09:25:09.021398', '2025-11-28 09:33:59.266942', '6630', '2023-09-11', 1),
	('22edebb1-7c61-4fe6-b834-ba7d9282913b', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'prorrogacao', '2023-09-30', '2024-02-28', 151, NULL, NULL, NULL, false, '2025-11-28 09:33:59.266942', '2025-11-28 09:37:42.004598', '119991', '2023-12-04', 2),
	('794a3acc-8f54-40d6-98d0-51c79f469bb2', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'prorrogacao', '2024-02-28', '2024-07-09', 132, NULL, NULL, NULL, false, '2025-11-28 09:37:42.004598', '2025-11-28 09:47:23.671873', '34791', '2024-04-15', 3),
	('d1654034-6b76-40f9-9299-f6f454118ee2', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'prorrogacao', '2024-07-09', '2024-11-05', 119, NULL, NULL, NULL, false, '2025-11-28 09:47:23.671873', '2025-11-28 09:51:12.269559', '76937', '2024-08-13', 4),
	('fb5b7a0b-e121-4255-9504-d10e432ae831', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'prorrogacao', '2024-11-05', '2025-02-18', 105, NULL, NULL, NULL, false, '2025-11-28 09:51:12.269559', '2025-11-28 09:58:44.875162', '115573', '2024-11-27', 5),
	('c0377585-280e-424e-bdad-506fbb5b9d45', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'prorrogacao', '2025-02-18', '2025-09-27', 221, NULL, NULL, NULL, false, '2025-11-28 09:58:44.875162', '2025-11-28 10:03:34.930705', '63278', '2025-07-01', 6),
	('9f513f8b-dab6-41f4-8e65-86ea8bfad976', 'ec07f120-e4c5-4337-b628-592c5859339c', 'prorrogacao', '2026-01-15', '2026-01-18', 3, NULL, NULL, NULL, false, '2025-11-28 09:16:22.984898', '2026-03-17 11:57:27.215353', '117278', '2025-11-24', 7),
	('c88f59c9-7fa1-46c9-8cd2-6345538a15e4', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'prorrogacao', '2025-09-27', '2026-01-17', 112, NULL, NULL, NULL, false, '2025-11-28 10:03:34.930705', '2026-03-17 12:26:27.91199', '117299', '2025-11-24', 7),
	('d8d6bd11-e28e-4309-900d-1ea7876d1a28', 'ef7a9b08-5f4a-4a43-96dc-0d4666f00914', 'inicial', '2026-01-19', '2026-02-18', 30, 'Prazo inicial automático', NULL, NULL, false, '2026-02-20 13:47:04.335545', '2026-02-20 13:47:04.34143', NULL, NULL, NULL),
	('42c46e6c-cd7c-4b9b-82b1-cfb5e8dece59', 'ef7a9b08-5f4a-4a43-96dc-0d4666f00914', 'prorrogacao', '2026-02-18', '2026-03-10', 20, NULL, NULL, NULL, true, '2026-02-20 13:47:04.34143', '2026-02-20 13:47:04.34143', '18', '2026-02-20', 1),
	('e86635b9-215a-4a4a-a95a-7afd72040dd7', 'ec07f120-e4c5-4337-b628-592c5859339c', 'prorrogacao', '2026-01-18', '2026-06-04', 137, 'Foi acrescentado 59 dias para atualizar a prorrogação de prazo do sistema.', NULL, NULL, true, '2026-03-17 11:57:27.215353', '2026-03-17 11:57:27.215353', '20411', '2026-03-11', 8),
	('3a4ce8a1-c98e-4579-81c8-d64c07911fec', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', 'prorrogacao', '2026-01-17', '2026-06-04', 138, 'Foi acrecentado 60 para atualizar a prorrogação de prazo do sistema.', NULL, NULL, true, '2026-03-17 12:26:27.91199', '2026-03-17 12:26:27.91199', '20424', '2026-03-11', 8);


--
-- Data for Name: procedimento_pms_envolvidos; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.procedimento_pms_envolvidos VALUES
	('153a07bc-eec0-4cd9-a9b2-d7f716f7362b', '6f3e6cda-e97e-492e-adbc-e84e4fb79c54', '29414b19-aa02-4cdd-8bcd-118da0888a11', 'operador', 1, '2025-11-08 16:31:33.976575', 'Sindicado'),
	('3232dc92-5c64-4cf4-8d17-fc59785fa1e7', 'b566018e-459e-4269-be54-75cd7e41f63e', '7390d883-0448-4ab5-aa9c-b0afa52f22a7', 'operador', 1, '2025-11-08 16:30:23.414727', 'Investigado'),
	('a23ac38d-e22c-48cf-9146-9edc6cf29609', '806b8455-188c-479e-86c2-683eb5c9963c', '29414b19-aa02-4cdd-8bcd-118da0888a11', 'operador', 1, '2025-11-08 19:06:32.314837', 'Sindicado'),
	('ac8e99e4-64df-4308-818f-97fcbb9ea34c', 'd91c19ba-3aec-456b-889b-9cd793b3f262', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'operador', 1, '2025-11-08 19:11:55.79612', 'Sindicado'),
	('3ac7e519-e684-4bed-b295-c9afdf720721', '6b1f19a8-4ab8-4ecc-b596-27480bf9e017', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'operador', 1, '2025-11-08 16:33:07.652017', 'Acusado'),
	('eb0e6a5a-7815-4ceb-800e-d4af94d1348c', 'b1392144-cff3-483d-9906-df7e95163b4a', '29414b19-aa02-4cdd-8bcd-118da0888a11', 'operador', 1, '2025-11-08 20:41:36.133607', 'Investigado'),
	('2134b95f-46f1-471d-99f5-35fd5e3ab5d9', '2f72ed5b-5944-4449-9cb9-dc1574664b41', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'operador', 1, '2025-11-09 21:34:03.565609', 'Investigado'),
	('6325c711-8684-4b0e-ab32-cb592ec380dd', 'bf9f2e04-19eb-4692-9252-5330719d5cc5', 'ea7eaf79-d14a-4cb2-af96-11d7f88ea0ba', 'operador', 1, '2025-11-09 20:05:43.347815', 'Investigado'),
	('772b8e14-acc0-43d1-946c-e5ec95a81c40', 'b5d79aa8-faca-4d2f-9cca-987cd453f80b', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'operador', 1, '2025-11-08 20:56:01.758033', 'Sindicado'),
	('21257700-838e-43c4-935b-2b310435f0cf', '5e060c66-74be-407e-b176-7a8376e23653', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'operador', 1, '2025-11-08 16:20:37.311957', 'Sindicado'),
	('1ae7cf41-258f-43f4-9db4-cc0f05d8371d', '5e060c66-74be-407e-b176-7a8376e23653', '29414b19-aa02-4cdd-8bcd-118da0888a11', 'operador', 2, '2025-11-08 16:20:37.311957', 'Sindicado'),
	('498b9987-7719-4ad8-bcb4-48fa21262865', 'b0294d82-4d35-46d4-a10f-2bd2b555d462', 'fe15018e-fe8a-45f2-b352-f77ec9b1338b', 'operador', 1, '2025-11-14 10:46:37.593753', 'Investigado'),
	('1b9b22b1-a165-4702-b1a3-a5c8e89f7a2c', 'ec07f120-e4c5-4337-b628-592c5859339c', 'fe15018e-fe8a-45f2-b352-f77ec9b1338b', 'operador', 1, '2025-11-28 08:39:02.289647', 'Investigado'),
	('2afbfa41-6994-483e-9c9b-7be14e234916', 'f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', '0f31eeac-a556-4d40-9990-24958ebf980b', 'operador', 1, '2025-11-13 10:19:46.680765', 'Investigado'),
	('5c2a3ffe-8fbd-4120-96de-7811ec326fa5', '980f1a82-3771-4193-b43b-37a09eadf0c5', 'ae4df51e-e4cc-402c-b13d-ba4b7000c113', 'operador', 1, '2026-01-13 11:19:45.971283', 'Sindicado'),
	('f7c26a88-7519-4937-94d0-6e324fd2552b', '980f1a82-3771-4193-b43b-37a09eadf0c5', '82328a4f-678f-4d4e-b4f3-5fdd215f7ceb', 'operador', 2, '2026-01-13 11:57:42.336132', 'Sindicado'),
	('45c6ccdd-2b7b-4fc2-9500-93628853ed17', '980f1a82-3771-4193-b43b-37a09eadf0c5', '62e979ae-bc59-480d-8be2-e3a944a2ffc5', 'operador', 3, '2026-01-13 11:57:42.336132', 'Sindicado'),
	('1f12cdb0-a613-48a6-ae6a-9f564b95fd00', '10b39de3-fad8-4e93-9cea-7b2027118253', '7517063f-a1db-47b3-bf3d-77c9055c0598', 'operador', 1, '2026-03-02 09:30:27.800347', 'Indiciado'),
	('94f72bad-7a7a-471b-8360-23d9ed7648b2', '10b39de3-fad8-4e93-9cea-7b2027118253', '54c2f630-e6a6-41ab-a928-cea6f778d24e', 'operador', 2, '2026-03-02 09:13:16.084272', 'Indiciado'),
	('ef86eecf-b5e6-4dc0-a7c9-d8b521ee2756', '10b39de3-fad8-4e93-9cea-7b2027118253', 'c820dc69-3da5-4a2a-87c0-7e394342a694', 'operador', 3, '2026-03-02 09:30:27.800347', 'Indiciado'),
	('f1d91ccd-65e0-407c-8ab5-e22cb097da13', '10b39de3-fad8-4e93-9cea-7b2027118253', 'e1e242ec-8013-4546-8f00-83cb75d8dd1d', 'operador', 4, '2026-03-02 09:30:27.800347', 'Indiciado'),
	('6a423d4f-e7c7-4a3d-a50f-0941f3a0e078', '10b39de3-fad8-4e93-9cea-7b2027118253', '77225a8d-6a96-488c-b91b-346afc466ed0', 'operador', 5, '2026-03-02 09:30:27.800347', 'Indiciado'),
	('e6971e2d-a458-46e9-a80b-5fd2600fb53c', '10b39de3-fad8-4e93-9cea-7b2027118253', 'd049dcb3-6cb2-4dde-a88c-7e7576712b18', 'operador', 6, '2026-03-02 09:30:27.800347', 'Indiciado'),
	('e745afbe-d9b1-465e-9dad-b908cf45279f', '10b39de3-fad8-4e93-9cea-7b2027118253', 'e2d0bb63-c9f2-4076-9485-af5dbed6902b', 'operador', 7, '2026-03-02 09:30:27.800347', 'Indiciado'),
	('4b1de249-b063-4423-bb41-24860dde4b23', '10b39de3-fad8-4e93-9cea-7b2027118253', 'c7d50628-9e2f-4554-9c7d-fdd63650c6a9', 'operador', 8, '2026-03-02 09:30:27.800347', 'Indiciado'),
	('b2ec7c96-8dae-4f0b-9bd6-19ba65fa86e7', '10b39de3-fad8-4e93-9cea-7b2027118253', 'b1a1e111-0c11-4275-a7a6-7da4543ae337', 'operador', 9, '2026-03-02 09:30:27.800347', 'Indiciado'),
	('f815b9be-3227-4176-b15b-05a0adf68385', '06d1dd69-ad23-490a-9492-80670ba3bae8', '0f31eeac-a556-4d40-9990-24958ebf980b', 'operador', 1, '2026-03-17 12:53:34.032494', 'Indiciado'),
	('f8defb85-c6a7-416e-8c35-043ae1faac25', '06d1dd69-ad23-490a-9492-80670ba3bae8', '2faaf837-1dc9-4661-99ed-b6e31818121e', 'operador', 2, '2026-03-17 12:53:34.032494', 'Investigado'),
	('beda1761-b788-435b-b7b5-c3f9aac2ea81', '06d1dd69-ad23-490a-9492-80670ba3bae8', 'f86e090f-3e83-483c-8905-bbe3ac59aedd', 'operador', 3, '2026-03-17 12:53:34.032494', 'Investigado'),
	('db646d16-1e72-4986-b298-87d5dc25e6f4', 'ef7a9b08-5f4a-4a43-96dc-0d4666f00914', '0863482f-7f1b-4dcc-bd24-3fa49f8bc363', 'operador', 1, '2026-02-11 11:46:54.928379', 'Sindicado'),
	('eb2a9040-34fd-46e9-95de-62fd914ae234', '6810d0bb-5ea5-40d3-9bbf-8d224af3819d', '0863482f-7f1b-4dcc-bd24-3fa49f8bc363', 'operador', 1, '2026-03-27 12:19:05.996923', 'Investigado'),
	('7750e7f9-08e8-4bb0-96be-448e66d26636', '256d6cce-db0a-47c6-b803-84c783e2f3bc', '5516b512-b338-430b-9008-a7e8bc7008d0', 'operador', 1, '2026-03-31 10:27:39.940458', 'Investigado'),
	('b7cdc5ac-159d-4dfb-957d-33b37c849769', '256d6cce-db0a-47c6-b803-84c783e2f3bc', '29414b19-aa02-4cdd-8bcd-118da0888a11', 'operador', 2, '2026-03-31 10:27:39.940458', 'Investigado'),
	('9abe486e-0b9c-4019-8302-661ca897a824', '402e441a-43da-46d4-83d8-1250ebaa0bf8', '0a10a809-af90-4d21-b50e-6ede0d6f5bad', 'operador', 1, '2026-03-31 11:11:43.41728', 'Investigado'),
	('f3d01e7d-da05-4f57-b408-4078ea4ed25d', '402e441a-43da-46d4-83d8-1250ebaa0bf8', 'd865433c-7ec5-4831-b653-82e06216f245', 'operador', 2, '2026-03-31 11:11:43.41728', 'Investigado'),
	('c21917d0-fb63-4e50-8a80-6e87cd8a2d84', '402e441a-43da-46d4-83d8-1250ebaa0bf8', 'ac12b939-5f22-4115-8e9a-09d7c19d397d', 'operador', 3, '2026-03-31 11:11:43.41728', 'Investigado'),
	('61dfe502-95e5-4f5f-9498-c4e37657d522', '402e441a-43da-46d4-83d8-1250ebaa0bf8', '6ae75d7b-80e2-430e-9494-62b7e15c57c7', 'operador', 4, '2026-03-31 11:11:43.41728', 'Investigado');


--
-- Data for Name: processos_procedimentos; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.processos_procedimentos VALUES
	('806b8455-188c-479e-86c2-683eb5c9963c', '3', 'procedimento', 'SV', 'Portaria', '', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', '11ºBPM', 'Alto Paraíso', '2025-01-01', '2025-11-07', NULL, 'Sindicado', '29414b19-aa02-4cdd-8bcd-118da0888a11', 'ADMINISTRAÇÃO PUBLICA', NULL, 'Dos crimes contra a autoridade ou disciplina militar', NULL, '3', NULL, NULL, '', '2025-11-08 19:06:32.314837', '2025-11-08 19:06:32.314837', false, '3', false, NULL, NULL, NULL, NULL, '2025', '[]', NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('b566018e-459e-4269-be54-75cd7e41f63e', '1', 'procedimento', 'FP', 'Feito Preliminar', '0021.452120/2025-98', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', 'CORREGEPOM', 'Alto Alegre dos Parecis', '2025-11-07', '2025-11-08', NULL, 'Investigado', '7390d883-0448-4ab5-aa9c-b0afa52f22a7', 'JOSE AMANCIO', NULL, 'Dos crimes contra a pessoa', 'Alegou agressão policial no momento da prisão.', NULL, NULL, '1', '24.85.2025', '2025-11-08 16:30:23.414727', '2025-11-08 20:38:58.07005', false, '1', true, '2025-11-08', NULL, NULL, NULL, '2025', '[]', '2025-11-08', NULL, 'Sugerido_Arquivamento', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('d91c19ba-3aec-456b-889b-9cd793b3f262', '3', 'procedimento', 'SV', 'Portaria', '', '770e6aa4-6896-4faf-bfda-0e0645618c3b', 'usuario', '9ºBPM', 'Alto Paraíso', '2025-05-10', '2025-10-15', NULL, 'Sindicado', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'ADMINISTRAÇÃO PUBLICA', NULL, 'Crimes hediondos (Lei nº 8.072/1990)', NULL, '3', NULL, NULL, '', '2025-11-08 19:11:55.79612', '2025-11-08 19:16:36.174569', false, '3', false, NULL, NULL, NULL, NULL, '2025', '[{"id": "edcdaaae-e927-468c-a20e-a0d70dd093ef", "data": "2025-11-08 19:16:05", "texto": "Encaminhado a corregedoria", "usuario": "DIOGO RIBEIRO"}]', NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[{"justificativa": "Encarregado saiu de ferias", "novo_encarregado": {"id": "770e6aa4-6896-4faf-bfda-0e0645618c3b", "nome": "GERALDO DANIEL DE SOUZA", "matricula": "100085224", "posto_graduacao": "CAP PM"}, "data_substituicao": "2025-11-08 19:16:36", "encarregado_anterior": {"id": "f2bbbd16-f2a2-4369-a20b-86dbb90293a2", "nome": "JACKSON FACCO BRANDT", "matricula": "100094024", "posto_graduacao": "1º SGT PM"}}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('87b5b215-cd82-49e8-b5fc-82c8a0c2d3ac', '6', 'processo', 'CD', 'Portaria', '0021.857887/2024-85', NULL, NULL, 'CORREGEPOM', 'Alto Paraíso', '2025-11-04', '2025-11-06', NULL, 'Acusado', '46a02475-de2e-489a-84a9-7db28f6983ff', NULL, NULL, NULL, 'Usou viatura de forma para satisfazer interesses próprios', '6', NULL, NULL, '25.15.2024', '2025-11-09 20:54:44.043715', '2025-11-09 20:54:44.043715', false, '6', false, NULL, NULL, NULL, NULL, '2025', '[]', NULL, NULL, NULL, NULL, NULL, '[]', '9ade41f1-4f47-4f5f-abc8-6222d533b19a', 'usuario', '3d523227-b75c-412d-975a-ddfda20202f5', 'usuario', '1dcc1362-26af-4cc1-a8c6-6b55f99443b1', 'usuario', '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('392924ec-3df9-48a9-8c0f-7385abda0ee7', '1', 'processo', 'CD', 'Portaria', '0021.452120/2025-98', NULL, NULL, 'CORREGEPOM', 'Alta Floresta D''Oeste', '2025-11-01', '2025-11-02', NULL, 'Acusado', '29414b19-aa02-4cdd-8bcd-118da0888a11', NULL, NULL, NULL, NULL, '1', NULL, NULL, '24.85.2025', '2025-11-08 16:19:10.421713', '2025-11-08 18:43:19.266754', false, '1', true, '2025-11-05', NULL, NULL, NULL, '2025', '[]', '2025-11-03', '2025-11-03', 'Punido', 'Excluido_Disciplina', NULL, '[]', 'ecc7322c-5d86-40e4-a398-d24b75330362', 'usuario', '3d523227-b75c-412d-975a-ddfda20202f5', 'usuario', '9ade41f1-4f47-4f5f-abc8-6222d533b19a', 'usuario', '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('22ce21be-aa00-42b5-98cd-65e1d328ba4e', '1', 'processo', 'PADS', 'Memorando Disciplinar', '0021.452120/2025-98', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', '7ºBPM', 'Ariquemes', '2025-11-01', '2025-11-02', NULL, 'Acusado', 'f2bbbd16-f2a2-4369-a20b-86dbb90293a2', NULL, NULL, NULL, 'teste', NULL, '1', NULL, '24.85.2025', '2025-11-05 21:02:58.29766', '2025-11-08 18:38:15.810337', false, '1', true, '2025-11-05', NULL, '[{"id": 8, "natureza": "leve", "tipo": "rdpm"}, {"id": "34db7b7d-2cfc-4b9e-a553-c43d6fe42dae", "tipo": "estatuto", "rdmp_analogia": {"id": 59, "natureza": "grave"}}]', NULL, '2025', '[]', '2025-11-03', '2025-11-04', 'Punido', 'Detencao', 1, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('6f3e6cda-e97e-492e-adbc-e84e4fb79c54', '1', 'procedimento', 'SV', 'Portaria', '0021.452120/2025-98', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', '7ºBPM', 'Campo Novo de Rondônia', '2025-11-01', '2025-11-02', NULL, 'Sindicado', '29414b19-aa02-4cdd-8bcd-118da0888a11', 'ADMINISTRAÇÃO PUBLICA', NULL, 'Sinistro de trânsito com veículo oficial, exceto viatura policial militar', NULL, '1', NULL, NULL, '24.85.2025', '2025-11-08 16:31:33.976575', '2025-11-08 19:04:06.664103', false, '1', false, NULL, NULL, NULL, NULL, '2025', '[]', NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[{"justificativa": "Encarregado entrou de L.E.", "novo_encarregado": {"id": "14651a18-887c-48ef-8898-66caf9b133eb", "nome": "DIOGO RIBEIRO", "matricula": "100094023", "posto_graduacao": "1º SGT PM"}, "data_substituicao": "2025-11-08 19:04:06", "encarregado_anterior": {"id": "f2bbbd16-f2a2-4369-a20b-86dbb90293a2", "nome": "JACKSON FACCO BRANDT", "matricula": "100094024", "posto_graduacao": "1º SGT PM"}}]', '29414b19-aa02-4cdd-8bcd-118da0888a11', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('7e068ed4-de54-4429-b00a-d94944b0db8f', '1', 'processo', 'CJ', 'Portaria', '0021.452120/2025-98', NULL, NULL, 'CORREGEPOM', 'Cacoal', '2025-10-30', '2025-11-05', NULL, 'Acusado', '5eace056-05a1-42d7-b787-8926e2dc3414', NULL, NULL, NULL, NULL, '1', NULL, NULL, '24.85.2025', '2025-11-08 16:18:07.008032', '2025-11-08 16:18:07.008032', false, '1', false, NULL, NULL, NULL, NULL, '2025', '[]', NULL, NULL, NULL, NULL, NULL, '[]', '9ade41f1-4f47-4f5f-abc8-6222d533b19a', 'usuario', '1dcc1362-26af-4cc1-a8c6-6b55f99443b1', 'usuario', '4546d731-32f3-4490-945a-d8df112277ac', 'usuario', '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('a1d4ea74-26cc-4ea2-9823-7dd6c222110e', '1', 'processo', 'PADE', 'Portaria', '0021.487878/2025-65', '3d523227-b75c-412d-975a-ddfda20202f5', 'usuario', '9ºBPM', 'Alvorada D''Oeste', '2025-10-15', '2025-10-25', NULL, 'Acusado', 'ea7eaf79-d14a-4cb2-af96-11d7f88ea0ba', NULL, NULL, NULL, NULL, '1', NULL, NULL, '25.15.2024', '2025-11-08 16:16:57.9608', '2025-11-08 16:16:57.9608', false, '1', false, NULL, NULL, NULL, NULL, '2025', '[]', NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('15742d92-b66f-4ae9-95e3-211633cf9b4d', '1', 'processo', 'PAD', 'Portaria', '0021.452120/2025-98', NULL, NULL, '7ºBPM', 'Alto Paraíso', '2025-10-01', '2025-10-10', NULL, 'Acusado', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', NULL, NULL, NULL, NULL, '1', NULL, NULL, '25.15.2024', '2025-11-08 16:16:00.983139', '2025-11-08 20:21:18.075', false, '2', true, '2025-11-08', NULL, NULL, NULL, '2025', '[]', '2025-11-08', '2025-11-08', 'Punido', 'Licenciado_Disciplina', NULL, '[]', 'ecc7322c-5d86-40e4-a398-d24b75330362', 'usuario', '9ade41f1-4f47-4f5f-abc8-6222d533b19a', 'usuario', '4546d731-32f3-4490-945a-d8df112277ac', 'usuario', '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('6b1f19a8-4ab8-4ecc-b596-27480bf9e017', '1', 'procedimento', 'CP', 'Portaria', '0021.857887/2024-85', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', '7ºBPM', 'Mirante da Serra', '2025-10-01', '2025-10-02', NULL, 'Acusado', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', NULL, NULL, NULL, 'PM se envolveu em briga na cidade de Jaru e foi instaurado o PADS nº 10-2025/8ºBPM para apurar transgressão.', '1', NULL, NULL, '24.85.2025', '2025-11-08 16:33:07.652017', '2025-11-09 21:11:11.547911', false, '1', true, '2025-10-30', NULL, NULL, NULL, '2025', '[]', '2025-10-10', NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, '8ºBPM', 'CAP QPPM JOSE CARLOS DOS SANTOS', '["JOÃO NETO"]', NULL, NULL, NULL, NULL, NULL),
	('b5d79aa8-faca-4d2f-9cca-987cd453f80b', '2', 'procedimento', 'SR', 'Portaria', '0021.452120/2025-98', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', '7ºBPM', 'Monte Negro', '2025-11-06', '2025-11-07', NULL, 'Sindicado', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'ADMINISTRAÇÃO PUBLICA', NULL, 'Sinistro de trânsito com viatura policial militar', NULL, '2', NULL, NULL, '24.51.5625', '2025-11-08 20:56:01.758033', '2025-11-09 17:57:10.107859', false, '2', true, '2025-11-08', NULL, NULL, NULL, '2025', '[{"id": "35cb34aa-c241-4c77-b380-525cff6cef50", "data": "2025-11-09 04:15:18", "texto": "Encaminhado cópia 1ºDPC-ARIQUEMES", "usuario": "DIOGO RIBEIRO"}]', '2025-11-08', NULL, 'Avocado', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('5e060c66-74be-407e-b176-7a8376e23653', '1', 'procedimento', 'SR', 'Portaria', '0021.452120/2025-98', '4546d731-32f3-4490-945a-d8df112277ac', 'usuario', '7ºBPM', 'Cacoal', '2025-11-05', '2025-11-06', NULL, 'Sindicado', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'ADMINISTRAÇÃO PUBLICA', NULL, 'Sinistro de trânsito com viatura policial militar', 'Tocou o zaralho!', '1', NULL, NULL, '25.15.2024', '2025-11-08 16:20:37.311957', '2025-11-09 18:29:13.879323', false, '1', true, '2025-11-07', NULL, NULL, NULL, '2025', '[{"id": "632ab99a-c58e-42c4-a5cc-8a4da450f3cb", "data": "2025-11-08 19:37:10", "texto": "Foi enviado ao MP", "usuario": "DIOGO RIBEIRO"}]', '2025-11-07', NULL, 'Homologado', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[{"justificativa": "Encarregado saiu de ferias", "novo_encarregado": {"id": "4546d731-32f3-4490-945a-d8df112277ac", "nome": "ANTONIO FRANCISCO DOS SANTOS", "matricula": "100071695", "posto_graduacao": "1º TEN PM"}, "data_substituicao": "2025-11-08 19:35:44", "encarregado_anterior": {"id": "14651a18-887c-48ef-8898-66caf9b133eb", "nome": "DIOGO RIBEIRO", "matricula": "100094023", "posto_graduacao": "1º SGT PM"}}]', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('bf9f2e04-19eb-4692-9252-5330719d5cc5', '3', 'procedimento', 'FP', 'Feito Preliminar', '0021.857887/2024-85', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', 'CORREGEPOM', 'Jaci-Paraná (Porto Velho)', '2025-11-02', '2025-11-03', NULL, 'Investigado', 'ea7eaf79-d14a-4cb2-af96-11d7f88ea0ba', 'JUDITE MARCIA', NULL, 'Dos crimes contra a pessoa', 'Bateu no preso com soco', NULL, NULL, '3', '25.15.2024', '2025-11-09 20:05:43.347815', '2025-11-09 21:35:06.711382', false, '3', true, '2025-11-09', NULL, NULL, NULL, '2025', '[]', '2025-11-08', NULL, 'Sugerido_IPM', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('2f72ed5b-5944-4449-9cb9-dc1574664b41', '5', 'procedimento', 'FP', 'Feito Preliminar', '0021.452120/2025-98', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', 'CORREGEPOM', 'Alto Alegre dos Parecis', '2025-10-10', '2025-11-08', NULL, 'Investigado', '84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'PEDRO DOS SANTOS', NULL, 'Dos crimes contra a pessoa', 'Bateu no preso', NULL, NULL, '5', '24.85.2025', '2025-11-09 21:34:03.565609', '2025-11-09 21:34:03.565609', false, '5', false, NULL, NULL, NULL, NULL, '2025', '[]', NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('b1392144-cff3-483d-9906-df7e95163b4a', '1', 'procedimento', 'FP', 'Feito Preliminar', '0021.857887/2024-85', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', 'CORREGEPOM', 'Pimenta Bueno', '2025-01-01', '2025-11-01', NULL, 'Investigado', '29414b19-aa02-4cdd-8bcd-118da0888a11', 'MARIA ANTONIETA', NULL, 'Dos crimes contra a pessoa', 'Reclamou de agressão durante sua prisão', NULL, NULL, '1', '24.85.2025', '2025-11-08 20:41:36.133607', '2025-11-09 21:29:38.920028', false, '1', true, '2025-11-08', NULL, NULL, NULL, '2025', '[]', '2025-11-08', NULL, 'Sugerido_Sindicancia', NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, '[]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('ec07f120-e4c5-4337-b628-592c5859339c', '1', 'procedimento', 'IPM', 'Portaria', '0021.060128/2024-60', 'ecc7322c-5d86-40e4-a398-d24b75330362', 'usuario', '7ºBPM', 'Cujubim', '2024-01-16', '2024-01-22', '32956bf9-61dd-4e2f-ac38-db7c2d91877f', 'Investigado', 'fe15018e-fe8a-45f2-b352-f77ec9b1338b', '["ADMINISTRAÇÃO PÚBLICA"]', NULL, 'Dos crimes contra a administração pública', 'CORRUPÇÃO - A fim de apurar eventual crime praticado pelo investigado e por outro policial ainda não identificado, uma vez que, em tese, teriam recebido valores para recuperar  um trator Walmet 785 (com lâmina), roubado da propriedade rural do Sr. Edmilson Andrade Santana no dia 15/09/2023.', '1', NULL, NULL, '24.01.6273', '2025-11-28 08:39:02.289647', '2026-03-19 11:42:06.42401', true, '1', false, NULL, NULL, NULL, NULL, '2024', '[{"id": "b94099c7-e3d1-41e8-b086-7029080d8ce0", "data": "2026-03-19 11:42:06", "texto": "0021.022791/2024-66", "usuario": "LEANDRO JOSÉ BRISOLA NETO"}, {"id": "3e231278-79d9-47d7-98f8-790ddc891d11", "data": "2025-11-28 09:15:55", "texto": "Retornou da corregedoria através do Ofício nº 117278/2025/PM-CORREGIPM com novo prazo concedido pelo MP de 60 dias a contar de 19/11/2025. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 44 dias, serão acrescentados nessa prorrogação 104 dias  (44 + 60) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "dcce1de1-00a2-40fa-aaae-6cf06daf6341", "data": "2025-11-28 09:12:02", "texto": "Encaminhado à Corregedoria através do Ofício nº 002/IPM/7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}, {"id": "04fd8bec-c920-4c49-9dda-8e61e872051f", "data": "2025-11-28 09:10:30", "texto": "Retornou da corregedoria através do Ofício nº 68260/2025/PM-CORREGIPM com novo prazo concedido pelo MP de 90 dias a contar de 11/07/2025. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 28 dias, serão acrescentados nessa prorrogação 118 dias  (28 + 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "e4a50a9a-2c47-4a40-9aab-b74ba6843fa3", "data": "2025-11-28 09:08:31", "texto": "Encaminhado à Corregedoria através do Ofício nº 59699/2025/PM-7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}, {"id": "aae90570-8234-4abc-b30f-cc9e0d4f5a8b", "data": "2025-11-28 09:06:48", "texto": "Retornou da corregedoria através do Ofício nº 24568/2025/PM-CORREGIPM com novo prazo concedido pelo MP de 90 dias a contar de 14/03/2025. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 52 dias, serão acrescentados nessa prorrogação 142 dias  (52 + 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "19dffb0a-691a-42e5-b4c9-d9e7c7f05f51", "data": "2025-11-28 09:02:16", "texto": "Encaminhado à Corregedoria através do Ofício nº 9470/2025/PM-7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}, {"id": "3ce6e748-7649-4763-ae77-13b4024ce4f0", "data": "2025-11-28 09:00:06", "texto": "Retornou da corregedoria através do Ofício nº 110020/2024/PM-CORREGEPOM com novo prazo concedido pelo MP de 90 dias a contar de 22/10/2024 para cumprimento de cota ministerial. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 76 dias, serão acrescentados nessa prorrogação 166 dias  (76 + 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "8e5d0c37-c523-4d81-88b0-0c9443a3dde2", "data": "2025-11-28 08:55:34", "texto": "Encaminhado à corregedoria através do Ofício nº 80037/2024/PM-7BPMP6 devidamente concluído e homologado para eventuais novas deliberações.", "usuario": "DIOGO RIBEIRO"}, {"id": "c9a385ca-4830-46ae-a339-0f2a0cec7309", "data": "2025-11-28 08:49:36", "texto": "Retornou da corregedoria através do Ofício nº 45880/2024/PM-CORREGEPOM com novo prazo concedido pelo MP de 90 dias a contar de 09/05/2024. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 47 dias, serão acrescentados nessa prorrogação 137 dias  (47 + 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "c7e800a7-7b89-432a-b09c-bcab53624fa1", "data": "2025-11-28 08:42:58", "texto": "Encaminhado à Corregedoria através do Ofício nº 30095/2024/PM-7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}]', '2024-08-07', NULL, 'Homologado', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('cb22e21b-72d3-43db-a379-24fb1261bc01', '7', 'processo', 'PADS', 'Memorando Disciplinar', '0021.033289/2025-61', '0bf5ada4-e749-43ff-bd2d-d8778d634e48', 'usuario', '7ºBPM', 'Jaru', '2025-06-05', '2025-08-18', NULL, 'Acusado', '93b23869-12f4-4836-8d94-b5b5224bd7e8', NULL, NULL, NULL, 'Conforme documentos que ora seguem inclusos (Processo SEI 0021.050022/2024-58, contendo a Solução do IPM de Portaria n.º 8313, de 08 de outubro de 2024, e o Ofício n.º 92934/2024/PM-DSDPM), Vossa Senhoria, durante o período de setembro de 2024, enquanto se encontrava em gozo de Licença para Tratamento de Saúde (LTS), ter atuado ativamente na campanha eleitoral de 2024, na qual sua mãe era candidata a Vereadora no município de Jaru/RO. Tais ações são consideradas incompatíveis com os motivos do seu afastamento médico e com os deveres e preceitos éticos da conduta policial militar.', NULL, '7', NULL, '25.07.8413', '2026-01-12 10:18:09.865445', '2026-03-06 11:39:24.367969', true, '7', true, '2026-02-23', NULL, '[{"id":33,"natureza":"media","tipo":"rdpm"},{"id":59,"natureza":"grave","tipo":"rdpm"},{"id":"34db7b7d-2cfc-4b9e-a553-c43d6fe42dae","tipo":"estatuto","rdmp_analogia":{"id":68,"natureza":"grave"}},{"id":"490300d1-ae25-4185-ba46-f8e67b7f5e6b","tipo":"estatuto","rdmp_analogia":{"id":23,"natureza":"media"}},{"id":"10a98220-a1d6-4e90-886a-589a638d7ba6","tipo":"estatuto","rdmp_analogia":{"id":42,"natureza":"media"}},{"id":"8e2fca70-0d66-4963-b47b-5219b435fca2","tipo":"estatuto","rdmp_analogia":{"id":34,"natureza":"media"}},{"id":"9bfd9917-68a5-4963-b5ef-e34c6a3a05e2","tipo":"estatuto","rdmp_analogia":{"id":65,"natureza":"grave"}},{"id":98,"natureza":"media","tipo":"rdpm"}]', NULL, '2025', NULL, '2025-11-22', '2026-02-23', 'Absolvido', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('980f1a82-3771-4193-b43b-37a09eadf0c5', '20', 'procedimento', 'SR', 'Portaria', '0021.028316/2025-84', '9ade41f1-4f47-4f5f-abc8-6222d533b19a', 'usuario', '7ºBPM', 'Bom Futuro (Ariquemes)', '2025-05-15', '2025-05-19', NULL, 'Sindicado', 'ae4df51e-e4cc-402c-b13d-ba4b7000c113', '["ADMINISTRAÇÃO PÚBLICA"]', NULL, 'Dos crimes contra a paz pública', 'Investigar a conduta de policiais militares que supostamente estariam exercendo segurança privada no Garimpo Bom Futuro, conforme Análise 1 (0060158132) e das demais informações coligidas na Sindicância Regular nº 03/2025/SJD/CIPO 0060158121, que indicaram a suposta participação de militares da ativa em segurança privada armada, bem como policiais militares da reserva remunerada. Os militares supostamente envolvidos são: 3º SGT QPPM RR ******918 DAVINO DOS SANTOS SILVA, 3º SGT PM RR ******125 JOSÉ LUIZ DA SILVA e 3º SGT QPPM ******566 JUSCELINO NUNES RODRIGUES.', '20', NULL, NULL, '25.08.8325', '2026-01-13 11:19:45.971283', '2026-01-13 11:57:42.336132', true, '20', true, '2025-12-23', NULL, NULL, NULL, '2025', NULL, '2025-12-09', NULL, 'Homologado', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[{"justificativa": "Em  substituição ao 2º SGT QPPM ******471 LEANDRO JOSÉ BRISOLA NETO", "novo_encarregado": {"id": "42ab08a6-0c5c-428f-b430-4c84195cf87d", "nome": "LEANDERSON COUTO DE JESUS", "matricula": "100083971", "posto_graduacao": "1º TEN PM"}, "data_substituicao": "2026-01-13 11:23:39", "encarregado_anterior": {"id": "0bf5ada4-e749-43ff-bd2d-d8778d634e48", "nome": "LEANDRO JOSÉ BRISOLA NETO", "matricula": "100082471", "posto_graduacao": "2º SGT PM"}}, {"justificativa": "Em substituição ao 1º TEN QOAPM ******971 LEANDERSON COUTO DE JESU", "novo_encarregado": {"id": "ca7282a9-ac86-4688-89e9-cf083b935be6", "nome": "SIDNEI SILVA DE SOUZA", "matricula": "100072431", "posto_graduacao": "1º TEN PM"}, "data_substituicao": "2026-01-13 11:32:25", "encarregado_anterior": {"id": "42ab08a6-0c5c-428f-b430-4c84195cf87d", "nome": "LEANDERSON COUTO DE JESUS", "matricula": "100083971", "posto_graduacao": "1º TEN PM"}}, {"justificativa": "Em substituição ao 2º TEN QOAPM ******431 SIDNEI SILVA DE SOUZA", "novo_encarregado": {"id": "9ade41f1-4f47-4f5f-abc8-6222d533b19a", "nome": "FABIANA CAVALCANTE MIRANDA", "matricula": "100085466", "posto_graduacao": "CAP PM"}, "data_substituicao": "2026-01-13 11:33:10", "encarregado_anterior": {"id": "ca7282a9-ac86-4688-89e9-cf083b935be6", "nome": "SIDNEI SILVA DE SOUZA", "matricula": "100072431", "posto_graduacao": "1º TEN PM"}}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('10b39de3-fad8-4e93-9cea-7b2027118253', '8', 'procedimento', 'IPM', 'Portaria', '0021.084172/2024-65', '1dcc1362-26af-4cc1-a8c6-6b55f99443b1', 'usuario', '7ºBPM', 'Bom Futuro (Ariquemes)', '2024-12-05', '2024-12-06', 'e2e7401d-8265-4c64-90ff-e8b7d9dbe1e5', 'Indiciado', '7517063f-a1db-47b3-bf3d-77c9055c0598', '["MARIO HETKOWSKI","ELISANGELA LUZ SOARES","EDMARA DA LUZ SOARES"]', NULL, 'Dos crimes contra a pessoa', 'Apurar crimes de lesão corporal e ameaça, supostamente ocorridos no distrito de Garimpo Bom Futuro, durante atendimento de ocorrência por policiais militares no dia 13/02/2024, bem como no dia 19/02/2024, durante a prisão dos envolvidos: Mario Hetkowsi, Edmara da Luz Soares e Elizangela Luz Soares.
', '8', NULL, NULL, '24.01.7591', '2026-03-02 09:13:16.084272', '2026-03-02 09:31:42.996156', true, '8', true, '2025-11-28', NULL, NULL, NULL, '2024', NULL, '2025-11-05', NULL, 'Homologado', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[{"justificativa": "Em substituição ao Ten Couto", "novo_encarregado": {"id": "ca7282a9-ac86-4688-89e9-cf083b935be6", "nome": "SIDNEI SILVA DE SOUZA", "matricula": "100072431", "posto_graduacao": "1º TEN PM"}, "data_substituicao": "2026-03-02 09:31:17", "encarregado_anterior": {"id": "42ab08a6-0c5c-428f-b430-4c84195cf87d", "nome": "LEANDERSON COUTO DE JESUS", "matricula": "100083971", "posto_graduacao": "1º TEN PM"}}, {"justificativa": "Em substituição ao Ten Sidnei", "novo_encarregado": {"id": "1dcc1362-26af-4cc1-a8c6-6b55f99443b1", "nome": "ANA PAULA LELES DA SILVA", "matricula": "100093916", "posto_graduacao": "1º TEN PM"}, "data_substituicao": "2026-03-02 09:31:43", "encarregado_anterior": {"id": "ca7282a9-ac86-4688-89e9-cf083b935be6", "nome": "SIDNEI SILVA DE SOUZA", "matricula": "100072431", "posto_graduacao": "1º TEN PM"}}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('ef7a9b08-5f4a-4a43-96dc-0d4666f00914', '5', 'procedimento', 'SR', 'Portaria', '0021.003238/2026-96', '9ade41f1-4f47-4f5f-abc8-6222d533b19a', 'usuario', '7ºBPM', 'Ariquemes', '2026-01-16', '2026-01-19', NULL, 'Sindicado', '0863482f-7f1b-4dcc-bd24-3fa49f8bc363', '["JOICE LUZIA DOS SANTOS SILVA"]', NULL, 'Dos crimes contra a pessoa', 'Apurar suposta ocorrência de ameaça, em contexto de violência doméstica e familiar contra a mulher, ocorrida no dia 13 de janeiro de 2026, às 19h53min06s, no município de Ariquemes/Ro, supostamente praticada pelo CB QPPM Re*******931 ADRIANO DE SÃO PAULO ASSUMPÇÃO em desfavor da senhora JOICE LUZIA DOS SANTOS SILVA. A apuração visa verificar a materialidade e autoria dos fatos, bem como eventual responsabilidade administrativa disciplinar.', '5', NULL, NULL, '26.08.9569', '2026-02-11 11:46:54.928379', '2026-04-15 11:20:34.639521', true, '5', true, '2026-04-02', NULL, NULL, NULL, '2026', NULL, '2026-03-18', NULL, 'Homologado', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('6810d0bb-5ea5-40d3-9bbf-8d224af3819d', '7 - 2026', 'procedimento', 'FP', 'Feito Preliminar', '0021.018175/2026-72', '95ddf778-8267-43a2-8f1c-5b0468ae2f60', 'usuario', '7ºBPM', 'Ariquemes', '2026-03-26', '2026-03-26', NULL, 'Investigado', '0863482f-7f1b-4dcc-bd24-3fa49f8bc363', '["ADMINISTRAÇÃO PÚBLICA"]', NULL, 'Dos crimes contra a administração militar', 'Trata-se de feito preliminar instaurado através do Despacho (70587593), em desfavor do CB QPPM ******931 ADRIANO DE SÃO PAULO ASSUMPÇÃO, tendo recebido, de forma indevida, o pagamento de Derso correspondente no valor de R$ 289,25 (duzentos e oitenta e nove reais e vinte e cinco centavos), conforme consta na Liquidação de Despesa (70587011).', NULL, NULL, '7 - 2026', '26.13.9929', '2026-03-27 12:19:05.996923', '2026-03-31 10:11:39.052952', true, '7 - 2026', true, '2026-03-28', NULL, NULL, NULL, '2026', NULL, '2026-03-27', NULL, 'Sugerido_Arquivamento', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('256d6cce-db0a-47c6-b803-84c783e2f3bc', '625-2025', 'procedimento', 'FP', 'Feito Preliminar', '0021.078752/2025-02', '95ddf778-8267-43a2-8f1c-5b0468ae2f60', 'usuario', 'CORREGEPOM', 'Ariquemes', '2025-12-16', '2026-02-09', NULL, 'Investigado', '5516b512-b338-430b-9008-a7e8bc7008d0', '["EVANILSON ANDRADE DE SOUSA"]', NULL, 'Dos crimes contra a pessoa', 'Trata-se de denúncia de agressão supostamente praticada por militares em serviço durante a prisão de Evanilson Andrade de Sousa. O fato ocorreu em 03/11/2025, na Rua Montreal, nº 1442, Setor 10, em Ariquemes. Na ocasião, ele foi detido em flagrante pela prática do crime de tráfico de drogas, tipificado no Art. 33 da Lei nº 11.343/06.', NULL, NULL, '625-2025', '26.13.9621', '2026-03-31 10:27:39.940458', '2026-03-31 10:27:39.940458', true, '625-2025', true, '2026-02-13', NULL, NULL, NULL, '2025', NULL, '2026-02-13', NULL, 'Sugerido_Arquivamento', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('402e441a-43da-46d4-83d8-1250ebaa0bf8', '1 - 2025', 'procedimento', 'FP', 'Feito Preliminar', '0019.003804/2025-28', '14651a18-887c-48ef-8898-66caf9b133eb', 'usuario', '7ºBPM', 'Ariquemes', '2025-02-24', '2025-02-24', NULL, 'Investigado', '0a10a809-af90-4d21-b50e-6ede0d6f5bad', '["VAGNER ALVES GOMES"]', NULL, 'Dos crimes contra a administração militar', 'O presente Feito Preliminar tem como objetivo apurar a suposta prática de abandono de incapaz por parte de uma guarnição policial durante o atendimento da ocorrência policial nº 757081, registrada no dia 04/01/2025, por volta das 20h30min.
Na ocasião, os envolvidos diretos foram Lorraine de Jesus e seu ex-noivo, Jorge Luiz Gomes, conduzidos à delegacia em decorrência de uma situação de violência doméstica, conforme os termos da Lei Maria da Penha. Lorraine foi identificada como vítima e Jorge como autor.
No dia 05/01/2025, por volta das 00h13min, o senhor Vagner Alves Gomes, irmão de Jorge, compareceu à delegacia acompanhado do filho de Lorraine, de 5 anos de idade. Ele relatou que, ao saber da prisão de seu irmão, dirigiu-se à residência do casal e encontrou a criança sob os cuidados de uma mulher que aparentava ser moradora de rua.
Segundo seu relato, a guarnição policial teria entregado a criança para essa pessoa. Diante da impossibilidade de permanência da criança com essa mulher, Vagner levou-a à UNISP, onde foi entregue ao Conselho Tutelar de plantão.

O delegado plantonista comunicou o fato ao 7º BPM por meio do Ofício nº 2444/2025/PC-DEAM-ARQM, em 04/02/2025, solicitando providências. A investigação visa verificar se a guarnição composta pelos policiais 2º SGT PM 100085951 Cleilton Oliveira Barbosa, 3º SGT QPPM 100090193 Albone Andrade Souza, 3º SGT PM 100087951 Flávio Barbosa de Andrade e CB PM 100096057 Josué Mendes Cunha efetivamente entregou a criança a terceiros.', NULL, NULL, '1 - 2025', '25.13.7877', '2026-03-31 11:11:43.41728', '2026-03-31 11:11:43.41728', true, '1 - 2025', true, '2025-03-01', NULL, NULL, NULL, '2025', NULL, '2025-02-25', NULL, 'Sugerido_Arquivamento', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('06d1dd69-ad23-490a-9492-80670ba3bae8', '9', 'procedimento', 'IPM', 'Portaria', '0021.050403/2025-18', '1dcc1362-26af-4cc1-a8c6-6b55f99443b1', 'usuario', '7ºBPM', 'Ariquemes', '2025-08-26', '2025-09-01', 'e9adb72f-5465-4764-9dee-4b0ef654ffda', 'Indiciado', '0f31eeac-a556-4d40-9990-24958ebf980b', '["ADMINISTRAÇÃO PÚBLICA"]', NULL, 'Dos crimes contra a administração pública', 'Apurar os fatos em em razão de indícios de que a guarnição comandada pelo  2º SGT QPPM ******204 TIAGO ALEX MUCK teria registrado atendimentos de ocorrências sem, aparentemente, ter comparecido aos locais informados, no município de Ariquemes-Ro. As informações foram levantadas após análise dos dados de rastreamento das viaturas e dos dispositivos mobile utilizados a partir de 15/06/2025, sendo constatadas divergências em quatro ocorrências (nº 825231, 831706, 831708 e 835861). Embora a guarnição tenha registrado diligência nos locais, os dados de geolocalização indicam permanência em pontos distintos, havendo, inclusive, casos em que a viatura permaneceu desligada por longos períodos durante os horários de atendimento das ocorrências. Os fatos, em tese, configuram ilícito penal militar previsto no art. 319 do Código Penal Militar (prevaricação), sendo necessária a devida apuração para o esclarecimento de sua autoria e da materialidade delitiva.', '9', NULL, NULL, '25.01.8836', '2026-03-17 12:53:34.032494', '2026-04-15 07:54:35.387753', true, '9', true, '2025-11-14', NULL, NULL, NULL, '2025', NULL, '2025-11-05', NULL, 'Homologado', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('f2857757-ad85-40e3-8bc1-a3a27e2b9cc3', '3', 'procedimento', 'IPM', 'Portaria', '0021.016984/2024-88', 'ecc7322c-5d86-40e4-a398-d24b75330362', 'usuario', '7ºBPM', 'Ariquemes', '2023-07-31', '2023-08-01', '2d4a407d-e005-4db7-aed8-edc6ff75fab5', 'Investigado', '0f31eeac-a556-4d40-9990-24958ebf980b', '["JEFFERSON WON MILLER","JACKSON SOUSA DOS SANTOS","JHONATA SOUZA CRUPES"]', NULL, 'Dos crimes contra a pessoa', 'AGRESSÃO - LESÃO CORPORAL - A fim de apurar supostas agressões sofridas por Jefferson Won Miller, Jackson Sousa dos Santos e Jhonata Souza Crupes, praticadas por Policiais Militares, conforme noticiado e apurado inicialmente nos autos da Sindicância Regular nº. 14/2023/7ºBPM. Os fatos teriam ocorrido no dia 14/02/2023, por volta das 23h, neste município de Ariquemes, por ocasião da condução de Jefferson, Jackson, Jhonata e uma quarta pessoa identificada como Jarlys, pela prática de crime de roubo (BO 507035).', '3', NULL, NULL, '23.01.5847', '2025-11-13 10:19:46.680765', '2026-05-08 08:46:37.961756', true, '3', true, '2026-04-30', NULL, NULL, NULL, '2023', '[{"id": "46bf9801-1056-4a09-b2ee-7372f8f9644f", "data": "2026-05-08 08:46:37", "texto": "Encaminhado à Corregedoria através do Ofício nº 35842/2026/PM-7BPMP6, após o cumprimento das cotas, conforme relatório circunstanciado.", "usuario": "LEANDRO JOSÉ BRISOLA NETO"}, {"id": "92f90f49-af6a-4163-8e68-cae80930d1f3", "data": "2025-11-28 10:02:50", "texto": "Retornou da corregedoria através do Ofício nº 117299/2025/PM-CORREGIPM com novo prazo concedido pelo MP de 60 dias a contar de 19/11/2025. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 52 dias, serão acrescentados nessa prorrogação 112 dias  (52 + 60) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "0db33e88-50eb-4ef3-93da-a8fdcdf3d03f", "data": "2025-11-28 10:00:37", "texto": "Encaminhado à Corregedoria através do Ofício nº 101134/2025/PM-7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}, {"id": "30d0709e-9869-4593-b3c9-f9c907e8dfab", "data": "2025-11-28 09:58:23", "texto": "Retornou da corregedoria através do Ofício nº 63278/2025/PM-CORREGEPOM com novo prazo concedido pelo MP de 90 dias a contar de 30/06/2025 para cumprimento de cota ministerial. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 131 dias, serão acrescentados nessa prorrogação 221 dias  (131 + 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "e6895d71-0077-4475-9ac6-1259c5fc6e15", "data": "2025-11-28 09:54:45", "texto": "Encaminhado à corregedoria através do Ofício nº 24427/2025/PM-7BPMP6 devidamente concluído e homologado para eventuais novas deliberações.", "usuario": "DIOGO RIBEIRO"}, {"id": "ab44b1e0-e99a-45ed-afd6-230fecb14993", "data": "2025-11-28 09:50:35", "texto": "Retornou da corregedoria através do Ofício nº 115573/2024/PM-CORREGIPM com novo prazo concedido pelo MP de 90 dias a contar de 21/11/2024. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 15 dias, serão acrescentados nessa prorrogação 105 dias  (15 + 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "7099adc8-8e13-47c0-9c4d-af597079d646", "data": "2025-11-28 09:48:30", "texto": "Encaminhado à Corregedoria através do Ofício nº 105255/2024/PM-7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}, {"id": "d28b3639-8b38-4533-8bba-63bac053a92c", "data": "2025-11-28 09:46:57", "texto": "Retornou da corregedoria através do Ofício nº 76937/2024/PM-CORREGIPM com novo prazo concedido pelo MP de 90 dias a contar de 08/08/2024. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 29 dias, serão acrescentados nessa prorrogação 119 dias  (29 + 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "d16fa9db-9245-4978-a73b-6d2a5d0c132d", "data": "2025-11-28 09:45:34", "texto": "Encaminhado à Corregedoria através do Ofício nº 65977/2024/PM-7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}, {"id": "60649e82-1e45-41b4-970a-f686ad5fe59a", "data": "2025-11-28 09:37:18", "texto": "Retornou da corregedoria através do Ofício nº 34791/2024/PM-CORREGIPM com novo prazo concedido pelo MP de 90 dias a contar de 11/04/2024. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 42 dias, serão acrescentados nessa prorrogação 132 dias  (42 + 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "8790b9f8-6618-4b61-b698-87048e501cda", "data": "2025-11-28 09:35:19", "texto": "Encaminhado à Corregedoria através do Ofício nº 23935/2024/PM-7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}, {"id": "de2b2d49-882b-423f-8307-5671f085fbf3", "data": "2025-11-28 09:33:37", "texto": "Retornou da corregedoria através do Ofício nº 119991/2023/PM-CORREGIPM com novo prazo concedido pelo MP de 90 dias a contar de 01/12/2023. Considerando o tempo que ficou em análise no MP para nova concessão de prazo, 61 dias, serão acrescentados nessa prorrogação 151 dias  (61+ 90) para que o novo prazo fique com data de vencimento correta.", "usuario": "DIOGO RIBEIRO"}, {"id": "29d07168-2729-4bea-bf1a-c514a63ad7ab", "data": "2025-11-28 09:29:26", "texto": "Encaminhado à Corregedoria através do Ofício nº 108594/2023/PM-7BPMP6 solicitando concessão de novo prazo pelo MP.", "usuario": "DIOGO RIBEIRO"}]', '2025-02-18', NULL, 'Homologado', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '[{"justificativa": "Trânsferencia do encarregado para outra unidade.", "novo_encarregado": {"id": "42ab08a6-0c5c-428f-b430-4c84195cf87d", "nome": "LEANDERSON COUTO DE JESUS", "matricula": "100083971", "posto_graduacao": "1º TEN PM"}, "data_substituicao": "2025-11-28 09:43:06", "encarregado_anterior": {"id": "5a4d24de-7b0d-422f-b1e5-eb7a8bfb83cd", "nome": "VILMAR FERREIRA", "matricula": "100059738", "posto_graduacao": "1º TEN PM"}}, {"justificativa": "Encarregado entrou de gozo de licença paternidade.", "novo_encarregado": {"id": "ecc7322c-5d86-40e4-a398-d24b75330362", "nome": "JULIANO PEREIRA DE MIRANDA", "matricula": "100095131", "posto_graduacao": "MAJ PM"}, "data_substituicao": "2025-11-28 09:44:09", "encarregado_anterior": {"id": "42ab08a6-0c5c-428f-b430-4c84195cf87d", "nome": "LEANDERSON COUTO DE JESUS", "matricula": "100083971", "posto_graduacao": "1º TEN PM"}}]', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
	('b0294d82-4d35-46d4-a10f-2bd2b555d462', '1/P6', 'procedimento', 'IPM', 'Portaria', '0021.022791/2024-66', 'ecc7322c-5d86-40e4-a398-d24b75330362', 'usuario', '7ºBPM', 'Cujubim', '2024-01-16', '2024-01-22', '32956bf9-61dd-4e2f-ac38-db7c2d91877f', 'Investigado', 'fe15018e-fe8a-45f2-b352-f77ec9b1338b', '["ADMINISTRAÇÃO PÚBLICA"]', NULL, 'Dos crimes contra a administração pública', 'OUTROS - CORRUPÇÃO - A fim de apurar eventual crime praticado pelo investigado e por outro policial ainda não identificado, uma vez que, em tese, teriam recebido valores para recuperar  um trator Walmet 785 (com lâmina), roubado da propriedade rural do Sr. Edmilson Andrade Santana no dia 15/09/2023.', '1/P6', NULL, NULL, '24.01.6273', '2025-11-14 10:46:37.593753', '2025-11-25 11:20:21.374543', false, '1/P6', true, '2024-08-19', NULL, NULL, NULL, '2024', NULL, '2024-03-22', NULL, 'Homologado', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'IPM 01-2024 - RGF. 24.01.6273_compressed.pdf', 'application/pdf', 20595685, '2025-11-25 15:20:21.374543+00', '\x255044462d312e360a25e2e3cfd30a3131372030206f626a0a3c3c0a2f42697473506572436f6d706f6e656e7420380a2f436f6c6f725370616365202f4465766963655247420a2f48656967687420313735330a2f53756274797065202f496d6167650a2f54797065202f584f626a6563740a2f576964746820313234300a2f46696c746572205b2f466c6174654465636f6465202f4443544465636f64655d0a2f4465636f64655061726d73205b6e756c6c203c3c0a2f5175616c6974792036300a3e3e5d0a2f4c656e677468203232333034380a3e3e0a73747265616d0a789c9cfc655454df1b060c9f618001844160506208016990183a24a47b9006a561e84e514240c6a14b861466e810e9f207222d35a49434d2d20ac6e3ff594f7c793fbcefbbd73a5fcedeebac7ddd71ddd77deaeffcdf454015a022a7b8454146758be216144a454dc74e4f474b4bc70367bdcb2ecc272a22cc2724282eabad282ea92e2528a464a6acaeab8f34468a295ada591ada6a1b210dfe771110140aa5a3a1e3a6a7e73690109230f8ff79fced0668c848bf10cf83411c00110d084c03fafb096003001009e8ff1cc0ff3540446062125208d9bf4dff5bd0741b200281c144c460121262e27fb311ffe601621a12da7ba2caa4744676100e5f985854ea5b324e95fa1e7ae4e4772e717bbf68728a3b77191899ee73f3f0f2f1232424a5');


--
-- Data for Name: transgressoes; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.transgressoes VALUES
	(4, 'leve', 'I', 'portar-se inconvenientemente, desrespeitando as normas de boa educação, os costumes ou as convenções sociais', true, '2025-08-04 10:14:53', 15),
	(5, 'leve', 'II', 'não portar seu documento de identidade, quando uniformizado, ou não exibi-lo quando solicitado', true, '2025-08-04 10:14:53', 15),
	(6, 'leve', 'III', 'deixar de participar em tempo hábil, à autoridade competente, a impossibilidade de comparecer à OPM ou a qualquer ato de serviço de que deva participar ou a que deva assistir', true, '2025-08-04 10:14:53', 15),
	(7, 'leve', 'IV', 'permutar serviço sem autorização da autoridade competente', true, '2025-08-04 10:14:53', 15),
	(8, 'leve', 'V', 'deixar de comunicar a alteração de dados de qualificação pessoal ou mudança de endereço residencial', true, '2025-08-04 10:14:53', 15),
	(9, 'leve', 'VI', 'tomar parte em jogos proibidos ou jogar a dinheiro os permitidos, em local sob a administração policial militar ou em qualquer outro quando uniformizado', true, '2025-08-04 10:14:53', 15),
	(10, 'leve', 'VII', 'não comunicar ao superior a execução de ordem recebida, tão logo seja possível', true, '2025-08-04 10:14:53', 15),
	(11, 'leve', 'VIII', 'não transmitir ao seu sucessor as ordens em vigor, quando da passagem do serviço', true, '2025-08-04 10:14:53', 15),
	(12, 'leve', 'IX', 'usar, quando uniformizado, barba, cabelo, bigode, costeleta ou adereço em desacordo com as disposições a respeito', true, '2025-08-04 10:14:53', 15),
	(13, 'leve', 'X', 'usar a policial militar, quando uniformizada, penteado, maquilagem, unhas ou adereços em desacordo com as disposições a respeito', true, '2025-08-04 10:14:53', 15),
	(14, 'leve', 'XI', 'representar a Corporação ou a OPM sem estar devidamente autorizado', true, '2025-08-04 10:14:53', 15),
	(15, 'leve', 'XII', 'assumir compromisso pela Corporação sem estar devidamente autorizado', true, '2025-08-04 10:14:53', 15),
	(16, 'leve', 'XIII', 'realizar transações comerciais ou pecuniárias dentro de unidade da Polícia Militar, exceto quando devidamente autorizado', true, '2025-08-04 10:14:53', 15),
	(17, 'leve', 'XIV', 'entrar, permanecer ou sair de OPM em desacordo com as normas vigentes.', true, '2025-08-04 10:14:53', 15),
	(18, 'leve', 'XV', 'ausentar-se do local de trabalho, sem autorização da autoridade competente, para tratar de assuntos estranhos ao serviço', true, '2025-08-04 10:14:53', 15),
	(19, 'leve', 'XVI', 'utilizar os animais da Corporação em desacordo com as normas ou castigá-los inutilmente', true, '2025-08-04 10:14:53', 15),
	(20, 'media', 'XVII', 'transportar em viatura, aeronave ou embarcação que esteja sob seu comando ou responsabilidade pessoas e/ou materiais sem autorização da autoridade competente.', true, '2025-08-04 10:14:53', 16),
	(21, 'media', 'I', 'concorrer para a discórdia, desarmonia ou cultivar inimizade entre os policiais militares ou entre estes e os de outra Corporação', true, '2025-08-04 10:14:53', 16),
	(22, 'media', 'II', 'interferir na administração do serviço ou na execução de ordem ou missão sem ter a devida competência para tal, exceto para salvaguardar o interesse da Corporação', true, '2025-08-04 10:14:53', 16),
	(23, 'media', 'III', 'deixar de cumprir ou de fazer cumprir as normas, regulamentos ou instruções na esfera de suas atribuições', true, '2025-08-04 10:14:53', 16),
	(24, 'media', 'IV', 'omitir em boletim de ocorrência, relatório ou qualquer documento dados indispensáveis ao esclarecimento dos fatos', true, '2025-08-04 10:14:53', 16),
	(25, 'media', 'V', 'não comunicar ao superior imediato, ou na ausência deste a qualquer autoridade superior, toda informação que tiver sobre iminente perturbação da ordem pública ou grave alteração no serviço, logo que tenha conhecimento', true, '2025-08-04 10:14:53', 16),
	(26, 'media', 'VI', 'negar-se a receber documento ou processo que lhe for encaminhado por autoridade competente, exceto nos casos de impedimento justificável, hipótese em que deverá manifestar-se por escrito', true, '2025-08-04 10:14:53', 16),
	(27, 'media', 'VII', 'não encaminhar à autoridade competente, na linha de subordinação e no prazo legal, recurso ou documento que receber, desde que elaborado de acordo com os preceitos regulamentares, se não for de sua alçada a solução', true, '2025-08-04 10:14:53', 16),
	(28, 'media', 'VIII', 'apresentar parte ou recurso disciplinar sem ter seguido as normas e preceitos regulamentares, em termos desrespeitosos ou com argumentos falsos ou de má-fé', true, '2025-08-04 10:14:53', 16),
	(29, 'media', 'IX', 'dificultar ao subordinado a apresentação de recurso', true, '2025-08-04 10:14:53', 16),
	(30, 'media', 'X', 'retardar a execução de qualquer ordem recebida', true, '2025-08-04 10:14:53', 16),
	(31, 'media', 'XI', 'faltar a qualquer ato de serviço em que deva tomar parte ou assistir, quando prévia e nominalmente escalado', true, '2025-08-04 10:14:53', 16),
	(32, 'media', 'XII', 'trabalhar mal em serviço, instrução ou missão', true, '2025-08-04 10:14:53', 16),
	(33, 'media', 'XIII', 'simular doença para esquivar-se ao cumprimento do dever', true, '2025-08-04 10:14:53', 16),
	(34, 'media', 'XIV', 'afastar-se de qualquer lugar em que deva permanecer por força de disposição ou ordem legal', true, '2025-08-04 10:14:53', 16),
	(35, 'media', 'XV', 'utilizar inadequadamente, em desacordo com as normas técnicas, regulamentos ou instruções veículo automotor, aeronave, embarcação, animais, armamento ou equipamentos de qualquer natureza, pertencentes ao acervo da Polícia Militar', true, '2025-08-04 10:14:53', 16),
	(36, 'media', 'XVI', 'ausentar-se do posto sem fazer a passagem do serviço ao seu sucessor, ou antes do término do seu turno, sem autorização da autoridade competente', true, '2025-08-04 10:14:53', 16),
	(37, 'media', 'XVIII', 'violar ou deixar de preservar local de crime', true, '2025-08-04 10:14:53', 16),
	(38, 'media', 'XIX', 'não apresentar-se ao fim de afastamento temporário do serviço ou, ainda, logo que souber que o mesmo foi interrompido', true, '2025-08-04 10:14:53', 16),
	(39, 'media', 'XX', 'permanecer em dependência de outra OPM ou local de serviço sem consentimento ou ordem da autoridade competente', true, '2025-08-04 10:14:53', 16),
	(40, 'media', 'XXI', 'entrar ou sair com tropa da OPM, sem o prévio conhecimento da autoridade competente ou sem sua ordem', true, '2025-08-04 10:14:53', 16),
	(41, 'media', 'XXII', 'abrir qualquer dependência de OPM sem permissão da autoridade competente, salvo nos casos de emergência', true, '2025-08-04 10:14:53', 16),
	(42, 'media', 'XXIII', 'ter em seu poder ou introduzir em área sob administração policial militar material que atente contra a disciplina ou a moral', true, '2025-08-04 10:14:53', 16),
	(43, 'media', 'XXIV', 'utilizar subordinados para serviços não regulamentares', true, '2025-08-04 10:14:53', 16),
	(44, 'media', 'XXV', 'prestar, deliberadamente, informação falsa, errônea ou incompleta a superior, induzindo-o a erro', true, '2025-08-04 10:14:53', 16),
	(45, 'media', 'XXVI', 'dirigir-se à autoridade superior sem respeitar a cadeia de comando, para tratar de assuntos administrativos ou operacionais', true, '2025-08-04 10:14:53', 16),
	(46, 'media', 'XXVII', 'utilizar veículos oficiais para fins particulares ou não previstos em normas, regulamentos ou instruções', true, '2025-08-04 10:14:53', 16),
	(47, 'media', 'XXVIII', 'deixar de comunicar o extravio de documento de identidade policial militar', true, '2025-08-04 10:14:53', 16),
	(48, 'media', 'XXIX', 'deixar de apresentar a declaração de bens quando a norma assim o exigir', true, '2025-08-04 10:14:53', 16),
	(49, 'media', 'XXX', 'reter o preso, a vítima, as testemunhas ou demais partes envolvidas por mais tempo que o necessário para a solução de procedimento policial, administrativo ou penal', true, '2025-08-04 10:14:53', 16),
	(50, 'media', 'XXXI', 'permitir que pessoa não autorizada adentre a local interditado', true, '2025-08-04 10:14:53', 16),
	(51, 'media', 'XXXII', 'dormir durante o turno de serviço, quando isto não for permitido', true, '2025-08-04 10:14:53', 16),
	(52, 'media', 'XXXIII', 'desrespeitar regras de circulação de trânsito, de tráfego aéreo ou de navegação marítima, lacustre ou fluvial', true, '2025-08-04 10:14:53', 16),
	(53, 'media', 'XXXIV', 'autorizar, promover ou executar manobras perigosas com viaturas, aeronaves, embarcações ou animais', true, '2025-08-04 10:14:53', 16);
INSERT INTO amostra.transgressoes VALUES
	(54, 'media', 'XXXV', 'recorrer a órgãos, pessoas ou instituições, exceto os previstos em lei, para resolver assuntos de interesse pessoal relacionados com a Polícia Militar', true, '2025-08-04 10:14:53', 16),
	(55, 'media', 'XXXVI', 'atrasar a entrega de processo administrativo, inquérito, sindicância ou outro procedimento apuratório', true, '2025-08-04 10:14:53', 16),
	(56, 'media', 'XXXVII', 'retirar de local sob administração policial militar material, viatura, aeronave, embarcação ou animal, ou deles servir-se sem ordem do responsável ou proprietário', true, '2025-08-04 10:14:53', 16),
	(57, 'media', 'XXXVIII', 'ingerir bebida alcoólica, quando uniformizado, em cafés, bares, restaurantes ou similares, exceto quando estiver representando a Corporação em evento social e, neste caso, sempre com moderação', true, '2025-08-04 10:14:53', 16),
	(59, 'grave', 'I', 'faltar à verdade, espalhar boatos ou utilizar-se do anonimato', true, '2025-08-04 10:14:53', 17),
	(60, 'grave', 'II', 'filiar-se, quando na ativa, a partidos políticos, sindicatos, associações profissionais com caráter de sindicato ou associações cujos estatutos não estejam de conformidade com a lei', true, '2025-08-04 10:14:53', 17),
	(61, 'grave', 'III', 'tomar parte, uniformizado, em manifestação de caráter político ou reivindicatório', true, '2025-08-04 10:14:53', 17),
	(62, 'grave', 'IV', 'discutir ou promover discussão, por meio de qualquer veículo de comunicação, sobre assuntos estratégicos afetos à área da segurança pública', true, '2025-08-04 10:14:53', 17),
	(63, 'grave', 'V', 'tomar parte em qualquer manifestação coletiva, seja ela de caráter reivindicatório, de crítica ou de apoio a atos de superior', true, '2025-08-04 10:14:53', 17),
	(64, 'grave', 'VI', 'não providenciar a tempo, na esfera de suas atribuições, medidas contra irregularidade que tomar conhecimento', true, '2025-08-04 10:14:53', 17),
	(65, 'grave', 'VII', 'divulgar informações reservadas ou fazer publicamente comentários que coloquem em descrédito o Governo ou a Corporação', true, '2025-08-04 10:14:53', 17),
	(66, 'grave', 'VIII', 'desrespeitar os órgãos dos poderes constituídos ou qualquer um de seus membros, bem como criticar de maneira ofensiva, em público ou por meio dos canais de comunicação, seus atos ou decisões', true, '2025-08-04 10:14:53', 17),
	(67, 'grave', 'IX', 'deixar de cumprir ordem recebida, embaraçar ou retardar a sua execução', true, '2025-08-04 10:14:53', 17),
	(68, 'grave', 'X', 'deixar de assumir a responsabilidade por seus atos ou pelos atos praticados por subordinados quando decorrerem do cumprimento de sua ordem', true, '2025-08-04 10:14:53', 17),
	(69, 'grave', 'XI', 'empregar força ou medida desnecessária em ato de serviço, ainda que não resulte dano', true, '2025-08-04 10:14:53', 17),
	(70, 'grave', 'XII', 'ofender, provocar ou desafiar outro militar com atos, gestos ou palavras', true, '2025-08-04 10:14:53', 17),
	(71, 'grave', 'XIII', 'deixar de assumir, orientar ou auxiliar no atendimento de ocorrência, quando esta, por sua natureza ou amplitude, assim o exigir', true, '2025-08-04 10:14:53', 17),
	(72, 'grave', 'XIV', 'utilizar-se da condição de policial militar para obter facilidades pessoais de qualquer natureza ou para encaminhar negócios particulares ou de terceiros', true, '2025-08-04 10:14:53', 17),
	(73, 'grave', 'XV', 'liberar preso ou dispensar pessoa envolvida em ocorrência sem competência legal para isso', true, '2025-08-04 10:14:53', 17),
	(74, 'grave', 'XVI', 'na condição de testemunha, prestar declaração falsa ou calar-se em procedimento administrativo no âmbito da Corporação', true, '2025-08-04 10:14:53', 17),
	(75, 'grave', 'XVII', 'fazer uso, estar de posse, sob ação ou induzir outrem ao uso de substância proibida por lei, ou introduzi-la em local sujeito a administração policial militar', true, '2025-08-04 10:14:53', 17),
	(76, 'grave', 'XVIII', 'subtrair, extraviar, danificar ou inutilizar documentos de interesse da administração pública ou de terceiros', true, '2025-08-04 10:14:53', 17),
	(77, 'grave', 'XIX', 'receber ou permitir que subordinado receba, a título de recompensa, em razão da função pública, qualquer objeto ou valor, mesmo quando oferecido pelo proprietário', true, '2025-08-04 10:14:53', 17),
	(78, 'grave', 'XX', 'desrespeitar, desconsiderar ou ofender pessoa por meio de palavras, atos ou gestos, no atendimento de ocorrência policial ou em outras situações decorrentes do serviço', true, '2025-08-04 10:14:53', 17),
	(79, 'grave', 'XXI', 'promover ou participar de luta corporal com outro militar', true, '2025-08-04 10:14:53', 17),
	(80, 'grave', 'XXII', 'ausentar-se, sem prévia licença, por mais de 24 (vinte e quatro) horas, da unidade em que serve ou do local em que deveria permanecer ou apresentar-se por força de disposição ou ordem', true, '2025-08-04 10:14:53', 17),
	(81, 'grave', 'XXIII', 'deixar de observar rigorosamente as normas pertinentes ao serviço, colocando em risco a segurança de pessoas ou instalações', true, '2025-08-04 10:14:53', 17),
	(82, 'grave', 'XXIV', 'dar, por escrito ou verbalmente, ordem manifestamente ilegal, ainda que não chegue a ser cumprida', true, '2025-08-04 10:14:53', 17),
	(83, 'grave', 'XXV', 'portar arma pertencente à Corporação fora dos casos previstos em norma', true, '2025-08-04 10:14:53', 17),
	(84, 'grave', 'XXVI', 'esquivar-se de saldar dívidas ou de cumprir compromissos assumidos, mediante artifício, ardil ou qualquer outro meio fraudulento', true, '2025-08-04 10:14:53', 17),
	(85, 'grave', 'XXVII', 'maltratar ou permitir que se maltrate preso sob sua guarda', true, '2025-08-04 10:14:53', 17),
	(86, 'grave', 'XXVIII', 'desrespeitar, intencionalmente, as garantias constitucionais da pessoa no ato de sua prisão', true, '2025-08-04 10:14:53', 17),
	(87, 'grave', 'XXIX', 'empregar violência física ou psicológica para obter informações durante o atendimento de ocorrência policial ou, ainda, no curso de investigação, ainda que esta não seja de caráter oficial', true, '2025-08-04 10:14:53', 17),
	(58, 'grave', 'XXXIX', 'dirigir-se de maneira desrespeitosa ou desatenciosa a subordinado, par 
ou superior hierárquico.', true, '2025-08-04 10:14:53', 17),
	(88, 'grave', 'XXX', 'empregar arma ou equipamento em desacordo com a lei e os regulamentos, desde que o faça intencionalmente, para deter ou neutralizar a ação de infrator, causando-lhe, em razão do excesso, danos de qualquer natureza', true, '2025-08-04 10:14:53', 17),
	(89, 'grave', 'XXXI', 'envolver-se com pessoas ligadas à prática de crimes, ainda que não tenha sido acusado ou não seja suspeito de praticá-los; (Redação dada pelo Decreto n° 14.852, de 13/01/2010)', true, '2025-08-04 10:14:53', 17),
	(90, 'grave', 'XXXII', 'fazer ameaça a outro policial militar; (Redação dada pelo Decreto n° 14.852, de 13/01/2010)', true, '2025-08-04 10:14:53', 17),
	(91, 'grave', 'XXXIII', 'disparar arma de fogo contra militar, ainda que não venha a produzir-lhe lesões ou causarlhe a morte', true, '2025-08-04 10:14:53', 17),
	(92, 'grave', 'XXXIV', 'causar danos ao patrimônio de outro militar', true, '2025-08-04 10:14:53', 17),
	(93, 'grave', 'XXXV', 'fazer publicamente declaração que ofenda, perante a sociedade ou parte dela, o Estado, suas instituições ou os chefes dos poderes Executivo, Legislativo e Judiciário ou quem os represente', true, '2025-08-04 10:14:53', 17),
	(94, 'grave', 'XXXVI', 'ingerir bebida alcoólica quando em serviço ou apresentar-se alcoolizado para prestá-lo', true, '2025-08-04 10:14:53', 17),
	(95, 'grave', 'XXXVII', 'recusar-se a receber ou devolver insígnia, medalha ou diploma que lhe tenha sido outorgado ou cassado; e', true, '2025-08-04 10:14:53', 17),
	(96, 'grave', 'XXXVIII', 'exercer, o policial militar da ativa, atividade remunerada, exceto as previstas em lei.', true, '2025-08-04 10:14:53', 17),
	(98, 'media', 'XXXIX', 'exercer qualquer atividade incompatível com os motivos do afastamento, estando o policial militar dispensado ou licenciado para tratamento de saúde própria ou de dependente', true, '2026-01-13 09:36:51.669398', 16),
	(97, 'media', 'XLIII', 'chegar atrasado à atividade para a qual esteja escalado', true, '2026-01-13 09:30:00.970013', 16);


--
-- Data for Name: usuarios; Type: TABLE DATA; Schema: amostra; Owner: -
--

INSERT INTO amostra.usuarios VALUES
	('10e9ebd7-48de-4748-94d6-99bded4e8e09', 'Oficial', 'CEL PM', 'Administrador', 'ADMIN001', false, true, 'admin@sistema.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin', '2025-08-17 16:02:06.795583', '2025-08-17 16:02:06.795583', true),
	('ecc7322c-5d86-40e4-a398-d24b75330362', 'Oficial', 'MAJ PM', 'JULIANO PEREIRA DE MIRANDA', '100095131', true, false, NULL, NULL, NULL, '2025-11-08 16:03:48.196104', '2025-11-08 16:03:48.196104', true),
	('9ade41f1-4f47-4f5f-abc8-6222d533b19a', 'Oficial', 'CAP PM', 'FABIANA CAVALCANTE MIRANDA', '100085466', true, false, NULL, NULL, NULL, '2025-11-08 16:04:24.217891', '2025-11-08 16:04:24.217891', true),
	('770e6aa4-6896-4faf-bfda-0e0645618c3b', 'Oficial', 'CAP PM', 'GERALDO DANIEL DE SOUZA', '100085224', true, false, NULL, NULL, NULL, '2025-11-08 16:04:41.854453', '2025-11-08 16:04:41.854453', true),
	('fcf2d906-0d6d-4fca-a6f1-9df53c5f600e', 'Oficial', '1º TEN PM', 'FRANCINALDO ARAUJO SILVA', '100071918', true, false, NULL, NULL, NULL, '2025-11-08 16:05:49.993698', '2025-11-08 16:05:49.993698', true),
	('5eace056-05a1-42d7-b787-8926e2dc3414', 'Oficial', '1º TEN PM', 'ARACELI HAPUKIA NHEIFICI PEIXOTO', '100090800', true, false, NULL, NULL, NULL, '2025-11-08 16:06:08.212223', '2025-11-08 16:06:08.212223', true),
	('1dcc1362-26af-4cc1-a8c6-6b55f99443b1', 'Oficial', '1º TEN PM', 'ANA PAULA LELES DA SILVA', '100093916', true, true, 'leles@gmail.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'comum', '2025-11-08 16:07:00.715395', '2025-11-08 16:07:00.715395', true),
	('84ee6feb-5316-4c2d-981e-ed547b3f6e29', 'Praça', '3º SGT PM', 'CHRISTIANO KAULING CAMPANINI', '100093960', true, false, NULL, NULL, NULL, '2025-11-08 16:13:45.156883', '2025-11-08 16:13:45.156883', true),
	('7390d883-0448-4ab5-aa9c-b0afa52f22a7', 'Praça', '3º SGT PM', 'MARLON SANTOS OLIVEIRA', '100086613', true, false, NULL, NULL, NULL, '2025-11-08 16:14:00.574637', '2025-11-08 16:14:00.574637', true),
	('29414b19-aa02-4cdd-8bcd-118da0888a11', 'Praça', '3º SGT PM', 'MÁRCIO ALVES RODRIGUES', '100077895', true, false, NULL, NULL, NULL, '2025-11-08 16:14:14.718972', '2025-11-08 16:14:14.718972', true),
	('ea7eaf79-d14a-4cb2-af96-11d7f88ea0ba', 'Praça', '3º SGT PM', 'CÉLIO SOBREIRA RÉGIS', '100067515', true, false, NULL, NULL, NULL, '2025-11-08 16:14:40.920558', '2025-11-08 16:14:40.920558', true),
	('46a02475-de2e-489a-84a9-7db28f6983ff', 'Praça', '3º SGT PM', 'JOEL REIS DA SILVA', '100092576', true, false, NULL, NULL, NULL, '2025-11-09 04:14:15.140333', '2025-11-09 04:14:15.140333', true),
	('c1653b8e-0e9e-492a-80c5-cf8c25d317bd', 'Praça', '3º SGT PM', 'CLEBER AMALIO DOS SANTOS', '100091375', true, false, NULL, NULL, NULL, '2025-11-09 04:22:09.536153', '2025-11-09 04:22:09.536153', true),
	('95ddf778-8267-43a2-8f1c-5b0468ae2f60', 'Praça', 'ST PM', 'EDNEI FRUTUOSO MACHADO', '100086062', true, true, 'pmedinei@hotmail.com', '$2b$12$vIO1HqnkWwLOpl.3uuvX6OCHrA.s3ZCHgp/PeiH1HtXJz47bwpEl2', 'admin', '2025-11-10 11:06:46.93441', '2025-11-13 10:55:16.751768', true),
	('3d523227-b75c-412d-975a-ddfda20202f5', 'Oficial', 'CAP PM', 'JOSÉ CARLOS RODRIGUES FELICIO', '100086502', true, true, 'jose.carlos06@hotmail.com', '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92', 'admin', '2025-11-08 16:05:08.541008', '2025-11-08 16:05:08.541008', true),
	('6595634a-7342-404b-8625-bbe21f00720c', 'Oficial', 'MAJ PM', 'CARLOS EDUARDO LEITE OLIVEIRA', '100093952', true, false, NULL, NULL, NULL, '2025-11-11 10:07:49.438748', '2025-11-11 10:07:49.438748', true),
	('f6409381-cd12-4e4d-8682-bb9389f940e1', 'Praça', 'ST PM', 'REGINALDO MENDES MARTINS', '100072302', true, false, NULL, NULL, NULL, '2025-11-11 10:09:14.198162', '2025-11-11 10:09:14.198162', true),
	('028ce9cd-996f-4045-8bf2-c5f5b396fe81', 'Praça', 'ST PM', 'JOSÉ RUBENS PRUDÊNCIO', '100059673', true, false, NULL, NULL, NULL, '2025-11-11 10:09:36.274483', '2025-11-11 10:09:36.274483', true),
	('0275af31-b511-4c19-a4b3-bd134b3f77d9', 'Praça', '1º SGT PM', 'CLAUDEMIR ARAUJO DOS SANTOS SALVALAIO', '100062644', true, false, NULL, NULL, NULL, '2025-11-11 10:10:11.07328', '2025-11-11 10:10:11.07328', true),
	('03b22543-149f-42dd-b85f-7fcb37322948', 'Praça', '1º SGT PM', 'RONIVON PEREIRA DE ALMEIDA', '100072376', true, false, NULL, NULL, NULL, '2025-11-11 10:10:31.499288', '2025-11-11 10:10:31.499288', true),
	('691a1048-2dc0-4284-b4ac-36a5980b0755', 'Praça', '1º SGT PM', 'CLODOALDO OLIVEIRA DE ARAÚJO', '100062785', true, false, NULL, NULL, NULL, '2025-11-11 10:10:54.936795', '2025-11-11 10:10:54.936795', true),
	('94a67554-6613-4dcf-8c99-6252d0ad23a4', 'Praça', '1º SGT PM', 'ROCINEI SOUZA SANTOS', '100072340', true, false, NULL, NULL, NULL, '2025-11-11 10:11:16.725145', '2025-11-11 10:11:16.725145', true),
	('aec27df5-1dc1-47b6-90f5-7b3bd98f3d4b', 'Praça', '1º SGT PM', 'ALTAIR JOSÉ TÚRMINA', '100071671', true, false, NULL, NULL, NULL, '2025-11-11 10:11:38.654066', '2025-11-11 10:11:38.654066', true),
	('5516b512-b338-430b-9008-a7e8bc7008d0', 'Praça', '1º SGT PM', 'LUIZ MONTEIRO DA SILVA NETO', '100072156', true, false, NULL, NULL, NULL, '2025-11-11 10:12:02.030562', '2025-11-11 10:12:02.030562', true),
	('72ce2f67-f0c7-49f5-8e7a-5fa2bffdc95f', 'Praça', '1º SGT PM', 'MARCOS PEREIRA SOARES', '100072194', true, false, NULL, NULL, NULL, '2025-11-11 10:12:22.399821', '2025-11-11 10:12:22.399821', true),
	('3dfef253-84d9-4243-99a1-911d1048beec', 'Praça', '1º SGT PM', 'MELQUISEDEQUE ABRAMOVSKI', '100074075', true, false, NULL, NULL, NULL, '2025-11-11 10:13:02.190864', '2025-11-11 10:13:02.190864', true),
	('c2c7977d-ff30-4ec9-9c9a-fbc6fbfd7ad3', 'Praça', '1º SGT PM', 'JANICLÉCIO SOARES TORRES', '100094220', true, false, NULL, NULL, NULL, '2025-11-11 10:13:22.498535', '2025-11-11 10:13:22.498535', true),
	('59696929-d72c-42b6-9e02-cc04d1674d82', 'Praça', '2º SGT PM', 'FABIO JUNIOR KRAUSE', '100071889', true, false, NULL, NULL, NULL, '2025-11-11 10:14:31.954453', '2025-11-11 10:14:31.954453', true),
	('0a1d47c1-1d84-47d9-a2ab-0d3d60c63346', 'Praça', '2º SGT PM', 'RENILSO ALVES PINTO', '100072314', true, false, NULL, NULL, NULL, '2025-11-11 10:14:55.018661', '2025-11-11 10:14:55.018661', true),
	('7886db84-f48c-44cd-a29d-00441dee0e8a', 'Praça', '2º SGT PM', 'EMANUEL FERREIRA COSTA', '100068387', true, false, NULL, NULL, NULL, '2025-11-11 10:15:25.825857', '2025-11-11 10:15:25.825857', true),
	('fd4d4e69-0148-43b9-af99-fd3b0a2ce845', 'Praça', '2º SGT PM', 'MARCELO ANDRÉ DE OLIVEIRA BALTHAZAR', '100076562', true, false, NULL, NULL, NULL, '2025-11-11 10:15:48.893594', '2025-11-11 10:15:48.893594', true),
	('4d3a3295-3baa-472d-9e78-47136bb66358', 'Praça', '2º SGT PM', 'IVANOR LUIZ DOS SANTOS', '100072027', true, false, NULL, NULL, NULL, '2025-11-11 10:16:33.587371', '2025-11-11 10:16:33.587371', true),
	('0ce8b440-d58a-4e75-a632-0cdd34ecb094', 'Praça', '2º SGT PM', 'RONALDO PEREIRA DO NASCIMENTO', '100086299', true, false, NULL, NULL, NULL, '2025-11-11 10:17:18.89485', '2025-11-11 10:17:18.89485', true),
	('0f31eeac-a556-4d40-9990-24958ebf980b', 'Praça', '2º SGT PM', 'TIAGO ALEX MUCK', '100086204', true, false, NULL, NULL, NULL, '2025-11-11 10:17:47.507974', '2025-11-11 10:17:47.507974', true),
	('e03a59fb-b1c9-413f-8bb6-76d3e37a03d7', 'Praça', '2º SGT PM', 'FABIANO FARIA DA SILVA', '100088471', true, false, NULL, NULL, NULL, '2025-11-11 10:18:10.026385', '2025-11-11 10:18:10.026385', true),
	('0a72e6e8-edbf-4adb-aaf8-329073ed1333', 'Praça', '2º SGT PM', 'EDEMUNDO ALEXANDRINO DE SOUZA JUNIOR', '100088739', true, false, NULL, NULL, NULL, '2025-11-11 10:18:35.698108', '2025-11-11 10:18:35.698108', true),
	('4d592955-cac9-45ab-9196-5b84aac898d3', 'Praça', '2º SGT PM', 'DALCIONE MANENTI ZANATTA', '100084597', true, false, NULL, NULL, NULL, '2025-11-11 10:19:14.386014', '2025-11-11 10:19:14.386014', true),
	('69e478da-acfa-47b4-9443-20106a6063c1', 'Praça', '2º SGT PM', 'RENATO RODRIGUES PIRES', '100086264', true, false, NULL, NULL, NULL, '2025-11-11 10:19:39.667389', '2025-11-11 10:19:39.667389', true),
	('3995e80e-a91a-4590-96ba-38b9dc5f4207', 'Praça', '2º SGT PM', 'CAIOJUNIAS RIBEIRO ROSA', '100090522', true, false, NULL, NULL, NULL, '2025-11-11 10:20:01.76085', '2025-11-11 10:20:01.76085', true),
	('b813f289-e53f-4a91-89c4-108f7ec93661', 'Praça', '2º SGT PM', 'PATRICK DEPAILLER GHISLERI', '100070598', true, false, NULL, NULL, NULL, '2025-11-11 10:20:23.304305', '2025-11-11 10:20:23.304305', true),
	('19030e03-5ff0-4e0d-957f-d3fa1f4f36fc', 'Praça', '2º SGT PM', 'JOSÉ MARIA MEIRELES FILHO', '100072091', true, false, NULL, NULL, NULL, '2025-11-11 10:21:24.319654', '2025-11-11 10:21:24.319654', true),
	('e7963326-f3ae-4c41-8147-a59b8a2f1a3a', 'Praça', '2º SGT PM', 'VARLLEI BRAGA', '100075213', true, false, NULL, NULL, NULL, '2025-11-11 10:21:45.711425', '2025-11-11 10:21:45.711425', true),
	('3ac27f86-3f9d-4bbd-bc59-479c03a9190f', 'Praça', '2º SGT PM', 'VALMIR RODRIGUES DE BRITO', '100072481', true, false, NULL, NULL, NULL, '2025-11-11 10:22:08.54848', '2025-11-11 10:22:08.54848', true),
	('7f3e7fd2-b1c7-4f3b-a5e2-6ebe5324b01a', 'Praça', '2º SGT PM', 'WANDILSON CHAVES DA SILVA', '100076395', true, false, NULL, NULL, NULL, '2025-11-11 10:22:31.732795', '2025-11-11 10:22:31.732795', true),
	('f26bdc12-6060-4a1f-aa82-7cebd8a87e89', 'Praça', '1º SGT PM', 'WAGNER FERRAZ DE LIMA', '100072510', true, false, NULL, NULL, NULL, '2025-11-11 10:14:03.344263', '2025-11-11 10:14:03.344263', true),
	('0bf5ada4-e749-43ff-bd2d-d8778d634e48', 'Praça', '2º SGT PM', 'LEANDRO JOSÉ BRISOLA NETO', '100082471', true, true, 'dr.brisolaneto@gmail.com', '$2b$12$obUWw/X9tZN9TcoXNOOHQuXqeddxceX3Y2iZz7zi9bt4D99SAMaPG', 'admin', '2025-11-10 11:08:26.614814', '2025-11-13 11:01:21.932967', true),
	('f2bbbd16-f2a2-4369-a20b-86dbb90293a2', 'Praça', 'ST PM', 'JACKSON FACCO BRANDT', '100094024', true, false, NULL, NULL, NULL, '2025-11-05 20:18:47.124469', '2025-11-05 20:18:47.124469', true),
	('3110afa8-fc2a-4b93-a4e9-a863d3873a23', 'Praça', '2º SGT PM', 'MOISES GOMES CAITANO', '100083880', true, false, NULL, NULL, NULL, '2025-11-11 10:23:15.350467', '2025-11-11 10:23:15.350467', true),
	('0a10a809-af90-4d21-b50e-6ede0d6f5bad', 'Praça', '2º SGT PM', 'CLEILTON OLIVEIRA BARBOSA', '100085951', true, false, NULL, NULL, NULL, '2025-11-11 10:23:43.716606', '2025-11-11 10:23:43.716606', true),
	('ab15fe5a-8a3c-46d4-9ad3-928b8cbe00de', 'Praça', '2º SGT PM', 'EMERSON DA SILVA CARTAXO', '100092352', true, false, NULL, NULL, NULL, '2025-11-11 10:24:10.005502', '2025-11-11 10:24:10.005502', true);
INSERT INTO amostra.usuarios VALUES
	('58a7d158-8d0d-401c-8b79-903be7149e81', 'Praça', '2º SGT PM', 'EDER SANTOS GONÇALVES', '100092346', true, false, NULL, NULL, NULL, '2025-11-11 10:24:35.900043', '2025-11-11 10:24:35.900043', true),
	('d97aea4a-bf60-4ff1-8b6f-67e9d37872f0', 'Praça', '2º SGT PM', 'RUBINERI DE OLIVEIRA', '100086193', true, false, NULL, NULL, NULL, '2025-11-11 10:24:58.511933', '2025-11-11 10:24:58.511933', true),
	('b3414e54-701d-4989-b9b1-4ad26ba183e2', 'Praça', '2º SGT PM', 'IRISVALDO APARECIDO SILVA RODRIGUES', '100076522', true, false, NULL, NULL, NULL, '2025-11-11 10:25:20.931248', '2025-11-11 10:25:20.931248', true),
	('1e29ba13-c2b8-487b-84ff-07620d0f76a0', 'Praça', '2º SGT PM', 'ELVYS CASTRO SILVA', '100071827', true, false, NULL, NULL, NULL, '2025-11-11 10:25:47.021537', '2025-11-11 10:25:47.021537', true),
	('55c15486-c804-4394-82cf-ce4ab5023b34', 'Praça', '3º SGT PM', 'ALVARO CASTANHARO', '100088279', true, false, NULL, NULL, NULL, '2025-11-11 10:26:41.500403', '2025-11-11 10:26:41.500403', true),
	('80790a63-29b1-427f-9f76-cb851af25edf', 'Praça', '3º SGT PM', 'REINALDO MARQUES DOS SANTOS', '100085097', true, false, NULL, NULL, NULL, '2025-11-11 10:31:05.413324', '2025-11-11 10:31:05.413324', true),
	('5f525772-63b7-40dd-ad17-d1921b35deea', 'Praça', '3º SGT PM', 'THIAGO SILVA DOS SANTOS', '100089188', true, false, NULL, NULL, NULL, '2025-11-11 10:31:30.715298', '2025-11-11 10:31:30.715298', true),
	('91ae44ad-9410-45d8-b4cc-3966e851787b', 'Praça', '3º SGT PM', 'MARLON JOSÉ RIBEIRO MORAES', '100094394', true, false, NULL, NULL, NULL, '2025-11-11 10:31:54.371307', '2025-11-11 10:31:54.371307', true),
	('3d6da40c-0cd6-4f44-8354-d5bff660717d', 'Praça', '3º SGT PM', 'JADERSON CORADI FERRO', '100086471', true, false, NULL, NULL, NULL, '2025-11-11 10:32:16.420633', '2025-11-11 10:32:16.420633', true),
	('32956bf9-61dd-4e2f-ac38-db7c2d91877f', 'Praça', '3º SGT PM', 'ROSICLÉIA ALVES PAIVA', '100089284', true, false, NULL, NULL, NULL, '2025-11-11 10:32:42.092061', '2025-11-11 10:32:42.092061', true),
	('3bf7f436-b211-4257-aefb-dd00ca626d23', 'Praça', '3º SGT PM', 'PABLO DE PÁDUA NASCIMENTO', '100079431', true, false, NULL, NULL, NULL, '2025-11-11 10:33:20.760626', '2025-11-11 10:33:20.760626', true),
	('9981b9ec-a339-43fa-a49d-2a5dc8d78860', 'Praça', '3º SGT PM', 'REGINALDO MOREIRA CHAGAS', '100092775', true, false, NULL, NULL, NULL, '2025-11-11 10:34:28.242487', '2025-11-11 10:34:28.242487', true),
	('9fbcf766-39b0-4caa-8c01-42ee94b0bd7d', 'Praça', '3º SGT PM', 'RONALDO BECK RAMOS', '100092770', true, false, NULL, NULL, NULL, '2025-11-11 10:34:46.794248', '2025-11-11 10:34:46.794248', true),
	('a7e3b6eb-7a2c-4cc0-9080-decf4ba757c5', 'Praça', '3º SGT PM', 'ELIANE APARECIDA PAGANINI', '100092340', true, false, NULL, NULL, NULL, '2025-11-11 10:35:12.40552', '2025-11-11 10:35:12.40552', true),
	('14e42e3c-2787-474d-9519-e7ce13e892df', 'Praça', '3º SGT PM', 'GENILSON ALVES DA SILVA', '100092422', true, false, NULL, NULL, NULL, '2025-11-11 10:35:56.784981', '2025-11-11 10:35:56.784981', true),
	('2e5045f0-2ef5-49b8-a4d1-51bab5cfd6cf', 'Praça', '3º SGT PM', 'EZEQUIAS JOSÉ FERREIRA', '100092264', true, false, NULL, NULL, NULL, '2025-11-11 10:36:43.709315', '2025-11-11 10:36:43.709315', true),
	('b28727f2-a2ce-46d2-b95c-410dc3686eb1', 'Praça', '3º SGT PM', 'WESLEI ANDRADE DOS SANTOS', '100092897', true, false, NULL, NULL, NULL, '2025-11-11 10:37:08.4497', '2025-11-11 10:37:08.4497', true),
	('679da61e-28db-4be4-a842-28489e2a9f0d', 'Praça', '3º SGT PM', 'RODRIGO HAMER DA SILVA', '100092766', true, false, NULL, NULL, NULL, '2025-11-11 10:37:31.448325', '2025-11-11 10:37:31.448325', true),
	('560ad401-5a02-4330-b1ea-f1e6da87b5f6', 'Praça', '3º SGT PM', 'ANDERSON FARIA DA SILVA', '100078759', true, false, NULL, NULL, NULL, '2025-11-11 10:38:09.727462', '2025-11-11 10:38:09.727462', true),
	('264950db-d7ab-4765-8f03-db081e41f7f6', 'Praça', '3º SGT PM', 'TIAGO BESSAS ALVES', '100092852', true, false, NULL, NULL, NULL, '2025-11-11 10:38:30.82969', '2025-11-11 10:38:30.82969', true),
	('a012f926-6434-4304-92cd-c109d32ddb29', 'Praça', '3º SGT PM', 'ALEXANDRE MOREIRA DE SOUZA', '100089799', true, false, NULL, NULL, NULL, '2025-11-11 10:38:54.90186', '2025-11-11 10:38:54.90186', true),
	('5eb39ca5-1405-4310-a35b-41deef327e90', 'Praça', '3º SGT PM', 'FABIO VICENTE DA SILVA', '100092401', true, false, NULL, NULL, NULL, '2025-11-11 10:39:17.861245', '2025-11-11 10:39:17.861245', true),
	('a3ab0eb2-311c-47fa-9b51-fc7c2f39ff75', 'Praça', '3º SGT PM', 'REGINALDO TEODORO DE PAULA', '100092768', true, false, NULL, NULL, NULL, '2025-11-11 10:39:45.259166', '2025-11-11 10:39:45.259166', true),
	('9ff645c6-da80-4dce-9348-2e9764d771cc', 'Praça', '3º SGT PM', 'LÉIA SILVA SANTOS', '100092614', true, false, NULL, NULL, NULL, '2025-11-11 10:40:06.018821', '2025-11-11 10:40:06.018821', true),
	('32f8005f-d570-4036-a3f9-4a671f451411', 'Praça', '3º SGT PM', 'EDIMILSON ALENCAR DA SILVA', '100092338', true, false, NULL, NULL, NULL, '2025-11-11 10:40:37.391446', '2025-11-11 10:40:37.391446', true),
	('90a0f5bb-03bd-48fa-83d6-3b4824017a32', 'Praça', '3º SGT PM', 'PAULO CESAR NUNES RODRIGUES', '100092735', true, false, NULL, NULL, NULL, '2025-11-11 10:41:02.817995', '2025-11-11 10:41:02.817995', true),
	('db62a357-c63c-4d5e-85d1-b2fa2e4ce5d3', 'Praça', '3º SGT PM', 'REGIVANE BARBOSA DOS SANTOS', '100092754', true, false, NULL, NULL, NULL, '2025-11-11 10:41:34.65402', '2025-11-11 10:41:34.65402', true),
	('e9adb72f-5465-4764-9dee-4b0ef654ffda', 'Praça', '3º SGT PM', 'EDUARDO LEITE FRANCO', '100092316', true, false, NULL, NULL, NULL, '2025-11-11 10:41:59.986617', '2025-11-11 10:41:59.986617', true),
	('18e44c6f-95f1-4ae2-8f99-243d843b1930', 'Praça', '3º SGT PM', 'FABRÍCIO BORBA VASCONCELOS', '100092359', true, false, NULL, NULL, NULL, '2025-11-11 10:46:59.523988', '2025-11-11 10:46:59.523988', true),
	('ae4df51e-e4cc-402c-b13d-ba4b7000c113', 'Praça', '3º SGT PM', 'JUSCELINO NUNES RODRIGUES', '100092566', true, false, NULL, NULL, NULL, '2025-11-11 10:47:21.066001', '2025-11-11 10:47:21.066001', true),
	('17e272d3-79af-48e1-a0fd-670ffd225240', 'Praça', '3º SGT PM', 'HURANDIRA KLEVERSON DANIEL DE SOUZA', '100092445', true, false, NULL, NULL, NULL, '2025-11-11 10:47:44.21736', '2025-11-11 10:47:44.21736', true),
	('ac12b939-5f22-4115-8e9a-09d7c19d397d', 'Praça', '3º SGT PM', 'FLÁVIO BARBOSA DE ANDRADE', '100087951', true, false, NULL, NULL, NULL, '2025-11-11 10:48:10.780215', '2025-11-11 10:48:10.780215', true),
	('a863ecaa-3da3-423a-ac3a-c9180124ddc7', 'Praça', '3º SGT PM', 'EDUARDO CARVALHO JOCA DE SOUSA', '100092345', true, false, NULL, NULL, NULL, '2025-11-11 10:48:34.519089', '2025-11-11 10:48:34.519089', true),
	('2fefe7ef-268c-4f29-bd77-a124a5eef05a', 'Praça', '3º SGT PM', 'ANA CAROLINE RODRIGUES DA SILVA', '100079037', true, false, NULL, NULL, NULL, '2025-11-11 10:48:58.025323', '2025-11-11 10:48:58.025323', true),
	('224a4d5c-d50f-4024-80cc-a50e0166b6c6', 'Praça', '3º SGT PM', 'MARCOS JUNIOR DE OLIVEIRA', '100092631', true, false, NULL, NULL, NULL, '2025-11-11 10:49:19.403603', '2025-11-11 10:49:19.403603', true),
	('1215ae5b-1ced-458c-b88c-4a71275d011e', 'Praça', '3º SGT PM', 'JOIVAN APARECIDO GODOY DOS SANTOS', '100092511', true, false, NULL, NULL, NULL, '2025-11-11 10:49:46.780969', '2025-11-11 10:49:46.780969', true),
	('6bef91e9-d474-489d-bb05-b52ca8f56f43', 'Praça', '3º SGT PM', 'MAX THOMAS PIANA', '100092661', true, false, NULL, NULL, NULL, '2025-11-11 10:50:12.136209', '2025-11-11 10:50:12.136209', true),
	('d865433c-7ec5-4831-b653-82e06216f245', 'Praça', '3º SGT PM', 'ALBONE ANDRADE SOUZA', '100090193', true, false, NULL, NULL, NULL, '2025-11-11 10:51:11.486727', '2025-11-11 10:51:11.486727', true),
	('d4cf058d-5968-49e9-ad32-7549e7366d11', 'Praça', '3º SGT PM', 'GEDIVALDO DA SILVA SOUZA', '100094154', true, false, NULL, NULL, NULL, '2025-11-11 10:51:39.559865', '2025-11-11 10:51:39.559865', true),
	('18041515-ed7f-42ea-b2b7-be383762a6fb', 'Praça', '3º SGT PM', 'LEANDRO LUIZ PELISSARI', '100094328', true, false, NULL, NULL, NULL, '2025-11-11 10:51:59.374624', '2025-11-11 10:51:59.374624', true),
	('5e30dac9-080e-48c2-8ef4-1b7ea4aa0dc2', 'Praça', '3º SGT PM', 'VINÍCIUS RAFAEL ROZENDO BARIVIERA', '100094585', true, false, NULL, NULL, NULL, '2025-11-11 10:52:23.655498', '2025-11-11 10:52:23.655498', true),
	('c12fffa5-ddf1-4a70-b278-7e865f1c3813', 'Praça', '3º SGT PM', 'PAULO ROBERTO DOS SANTOS JÚNIOR', '100094438', true, false, NULL, NULL, NULL, '2025-11-11 10:52:42.096725', '2025-11-11 10:52:42.096725', true),
	('5e877f16-c2c0-46fe-b668-fb75a5f7b429', 'Praça', '3º SGT PM', 'DIEGO DE SOUZA', '100094014', true, false, NULL, NULL, NULL, '2025-11-11 10:53:02.508289', '2025-11-11 10:53:02.508289', true),
	('58a60d47-7c60-44e9-a948-ead200d7dcb3', 'Praça', '3º SGT PM', 'DIONE CLEITON OLIVEIRA BARBOSA', '100094027', true, false, NULL, NULL, NULL, '2025-11-11 10:53:29.748481', '2025-11-11 10:53:29.748481', true),
	('707de5e9-c6e2-4f23-b0b3-bcf7857b0f8b', 'Praça', '3º SGT PM', 'RENATO VANJURA FERREIRA', '100094465', true, false, NULL, NULL, NULL, '2025-11-11 10:54:00.32206', '2025-11-11 10:54:00.32206', true),
	('98555d2f-59ab-451a-9133-abfd0b038beb', 'Praça', '3º SGT PM', 'PASCOAL DE JESUS MOREIRA FILHO', '100094426', true, false, NULL, NULL, NULL, '2025-11-11 10:54:22.510964', '2025-11-11 10:54:22.510964', true),
	('200c67c9-599d-4b72-9eec-0d16858f7684', 'Praça', '3º SGT PM', 'ANDERSON PINTO SOARES', '100093927', true, false, NULL, NULL, NULL, '2025-11-11 10:54:58.71731', '2025-11-11 10:54:58.71731', true),
	('c08ef6a4-b883-4f89-9ca9-78de5b326618', 'Praça', '3º SGT PM', 'JEFERSON SILVEIRA DE ARAÚJO', '100094233', true, false, NULL, NULL, NULL, '2025-11-11 10:55:24.216621', '2025-11-11 10:55:24.216621', true),
	('9de75314-84cb-4d57-b2a7-e0eb59ace0b4', 'Praça', '3º SGT PM', 'EVERTON LUIS DAMAREM', '100094096', true, false, NULL, NULL, NULL, '2025-11-11 10:56:02.608122', '2025-11-11 10:56:02.608122', true),
	('2412de24-6a6f-4172-8dd8-a7cb27f0ff51', 'Praça', '3º SGT PM', 'ANDERSON DIEGO MORAES DE SOUZA', '100093920', true, false, NULL, NULL, NULL, '2025-11-11 10:56:27.997945', '2025-11-11 10:56:27.997945', true);
INSERT INTO amostra.usuarios VALUES
	('b102f9a1-b9ab-403b-a8b0-f084aeff93ab', 'Praça', 'CB PM', 'SILEIA FERREIRA SILVA', '100092824', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('2071897d-a312-41de-9358-5e450c4cd217', 'Praça', 'CB PM', 'MARCOS MOREIRA DIAS', '100094385', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('761879a7-b1f5-4b3d-8350-2e3963ca865f', 'Praça', 'CB PM', 'CASSIANO BAPTISTA DA SILVA FILHO', '100094632', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('9a740076-d720-401a-8b1d-5dd40f110c15', 'Praça', 'CB PM', 'EDNEY FRANÇOIR DE ANDRADE', '100094049', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('47badbaa-89c4-4872-801b-6ca949ea61be', 'Praça', 'CB PM', 'ÉRIKA DE OLIVEIRA ANDRADE', '100094948', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('0863482f-7f1b-4dcc-bd24-3fa49f8bc363', 'Praça', 'CB PM', 'ADRIANO DE SÃO PAULO ASSUMPÇÃO', '100094931', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('069bdb75-d03c-471b-a848-43b9608f3a5a', 'Praça', 'CB PM', 'LOURIVAL MENDES DOS SANTOS', '100094997', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('5ac76252-a297-447e-af17-4e591f5d3c75', 'Praça', 'CB PM', 'GEAN NOVAIS DA SILVA', '100095064', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('a6db8d36-4ea9-4573-ac6e-405d3062b85b', 'Praça', 'CB PM', 'FÁBIO BRAGA DE ALMEIDA', '100095010', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('b3ace783-3b46-4cff-8224-b7e71884da5d', 'Praça', 'CB PM', 'LEONARDO VINÍCIUS DA SILVA GREFFE', '100095023', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('0112f59e-1f7c-46e5-9be4-6ced6d41fbaa', 'Praça', 'CB PM', 'RONALDO SANTOS DA SILVA', '100095003', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('2b9fe196-10f2-475f-9e67-bea7fd617686', 'Praça', 'CB PM', 'ANTONIO MARCOS DE OLIVEIRA', '100095008', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('88a28800-3972-441a-a3ef-f24ec58edee0', 'Praça', 'CB PM', 'JANIO IDEAM DE FREITAS JÚNIOR', '100095021', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('dc85063d-1ad3-400d-a5a4-937d2e15f034', 'Praça', 'CB PM', 'CLAUDIO CAMPOS DE SOUZA', '100095083', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('aaaab763-b97b-45df-9a9c-b29199143653', 'Praça', 'CB PM', 'ANDERSON PAES INÁCIO', '100095080', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('1c9e56c1-d296-4094-9f61-c4dc44b5e5fc', 'Praça', 'CB PM', 'AVILAR JUNIOR DO CARMO', '100093938', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('71b8eac6-57af-4ef2-8cf1-bb6473ea165c', 'Praça', 'CB PM', 'ÉVERTON OLIVEIRA SIMÃO', '100094959', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('cb0db46b-1574-4888-b82e-22535d58c5cd', 'Praça', 'CB PM', 'JOABE LOURENCO VIEIRA', '100095400', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('05590467-621f-4bc1-8c30-6a1b0febee7a', 'Praça', 'CB PM', 'MARCOS ANTONIO BONFIM DOS SANTOS', '100095472', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('23abc3ce-75b2-4285-ae0b-6df1df988af0', 'Praça', 'CB PM', 'CLEITON WILLIAM DE ALENCAR', '100095263', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('95f78132-b0df-4cac-abf0-d9a32ead5584', 'Praça', 'CB PM', 'ADEILTON APARECIDO SOARES', '100095183', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('8fb5766b-f4c1-4a7b-a86a-fc811fe393ec', 'Praça', 'CB PM', 'CLEBERSON DE ALMEIDA PAIXAO', '100095257', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('448bb0d4-56cf-4417-929d-a40971b95b1c', 'Praça', 'CB PM', 'FLAVIO DOS SANTOS RIBAS', '100095340', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('1cd945ec-e13c-4792-9a48-44f4cce919e4', 'Praça', 'CB PM', 'JESSICA ALINE DE LARA', '100095392', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('a4b28326-b67e-4529-83bb-c4e7a8e6e066', 'Praça', 'CB PM', 'WELLINGTON VIEIRA MORAES', '100095599', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('f86e090f-3e83-483c-8905-bbe3ac59aedd', 'Praça', 'CB PM', 'PAULO RICARDO DE SOUZA', '100095505', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('423aec2a-10df-45b3-bc8d-5a25de1001b5', 'Praça', 'CB PM', 'VERONICA SANTOS SAMPAIO', '100095583', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('34a4f9b7-9bd9-4854-b81c-a52e3cba0e51', 'Praça', 'CB PM', 'GLADSTON KOHNLEIN', '100095364', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('0ab4f36e-05b3-4826-9dfb-c580b3c566a9', 'Praça', 'CB PM', 'FERNANDO PINHO DE CASTRO', '100095339', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('bd0139b9-1b8b-4bec-8017-785e5040a9a3', 'Praça', 'CB PM', 'LUCAS HENRIQUE DOS SANTOS SILVA', '100095452', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('985cdfbd-3316-48f0-9eb2-632ea316c44d', 'Praça', 'CB PM', 'EDILSON SOARES DE SOUSA', '100095295', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('d65de6d4-ceaa-411c-b726-3bdd42621ad6', 'Praça', 'CB PM', 'FRANKCIEL CESAR DA SILVA', '100095344', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('97ff2095-76a6-45b5-b725-85a009940850', 'Praça', 'CB PM', 'FERNANDO DOS SANTOS PENA', '100095337', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('a69a5158-0013-403b-b15b-21c384f513f8', 'Praça', 'CB PM', 'DIVALDO DOS SANTOS SERRA', '100095292', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('1e31aacf-49e0-49a6-a760-86a84ee2bcca', 'Praça', 'CB PM', 'ÉRMERSON GURGEL RODRIGUES DOS SANTOS', '100095321', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('bebab7bd-0a33-46bb-9dab-9617dcd69e0d', 'Praça', 'CB PM', 'ANTONIO CARLOS WANZELLER DOS SANTOS JUNIOR', '100095230', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('dc363567-7738-4df1-85e4-e06ce1b412a2', 'Praça', 'CB PM', 'ALESSANDRO CONCEICAO XAVIER', '100095196', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('eb2fbaf8-0ea2-4794-99be-abd2d911b614', 'Praça', 'CB PM', 'MARCELO LUCINDO SOARES', '100095467', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('7d6b1d99-974c-4d6c-ab7a-53848cba7bae', 'Praça', 'CB PM', 'JULIO CEZAR PEREIRA DE CARVALHO', '100095429', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('c7c0f194-08e4-4985-a405-7688f829a4f3', 'Praça', 'CB PM', 'TAFAREL FRANCO PEREIRA DA SILVA', '100095564', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('ffe04ad7-7520-46f9-9909-af6bf5d4e73c', 'Praça', 'CB PM', 'RAILTON COSTA PEIXOTO', '100095518', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('1a8cc95c-467f-45cc-90b6-784f1a44c2e5', 'Praça', 'CB PM', 'CLEOMAICON DA SILVA SARGES', '100095265', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('f1d7a8e1-fa44-4bd3-a77f-51dbe7580c83', 'Praça', 'CB PM', 'WESKLEY BRITO DE SOUSA', '100095602', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('e7d20a80-b93d-4172-b5b6-abc6bd43775b', 'Praça', 'CB PM', 'RODRIGO SANTOS MADEIRA', '100095951', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('977fecf6-4759-4b4c-a555-0f43f44da909', 'Praça', 'CB PM', 'WELLINGTON GUIMARAES PASSOS', '100095963', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('2f934ec2-10ab-44a7-9bcc-65a81c387714', 'Praça', 'CB PM', 'DEVANILSON RAMOS MENDES', '100095967', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('7d1cf994-89db-489c-82b7-d6fa1bf66640', 'Praça', 'CB PM', 'MAICON BENJAMIM GREGORIO', '100096021', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('ae8ac533-86cc-43e5-a025-89c91309ca90', 'Praça', 'CB PM', 'ISAQUE GONÇALVES DOS REIS JUNIOR', '100096036', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('5e4a01ec-4308-4c6e-b095-d724c052adad', 'Praça', 'CB PM', 'JOSÉ APARECIDO SOUZA MESA', '100096047', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('92a86ecb-e52f-4260-87a4-c9e93b23b3b6', 'Praça', 'CB PM', 'JOELSON DE SOUSA SILVA', '100096050', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true);
INSERT INTO amostra.usuarios VALUES
	('6ae75d7b-80e2-430e-9494-62b7e15c57c7', 'Praça', 'CB PM', 'JOSUÉ MENDES CUNHA', '100096057', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('f9c8c241-3587-4bc5-a445-bdafa230915a', 'Praça', 'CB PM', 'POLIANA PINHO RIBEIRO', '100096061', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('d7aac27d-9fe9-40ee-a1b4-ba05daeb5723', 'Praça', 'CB PM', 'LEANDRO COSMO DOS SANTOS', '100096111', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('2faaf837-1dc9-4661-99ed-b6e31818121e', 'Praça', 'CB PM', 'PEDRO BASILIO DE SOUZA JUNIOR', '100096112', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('50c75dd9-4f6e-4f8b-8c75-77b731f3b696', 'Praça', 'CB PM', 'WERNER RUBENS GAMBARTI', '100096626', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('8671aff7-b97d-46ed-80fc-410b10ef62ab', 'Praça', 'CB PM', 'MAICON WILLIAN PEREIRA GONÇALVES', '100096133', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('66c69542-4aa3-4a11-a754-750c269b950d', 'Praça', 'CB PM', 'PAULO CLEIDSON DE MORAIS PINTO', '100096137', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('612af795-6827-4a5f-bf58-c5e4b823ab93', 'Praça', 'CB PM', 'ALEX TURMINA DE ALMEIDA', '100096143', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('4e87bc35-d64c-4215-be17-82621a015e35', 'Praça', 'CB PM', 'WILLIAM MARINHO BENITES', '100096144', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('80cf297c-bc87-4525-9a10-02b31b727b57', 'Praça', 'CB PM', 'SAMUEL FERNANDES LUCENA', '100096627', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('a9de1f70-1377-4398-b6a4-14b6942abe54', 'Praça', 'CB PM', 'ÉRICA VANESSA RIBEIRO DA SILVA', '100096265', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('5f29f965-d7cd-4852-8be7-d1316175257a', 'Praça', 'CB PM', 'PAMILLA PAULA PUTTIN', '100096451', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('e8a82fad-7116-40b8-bbf6-84752a5759fb', 'Praça', 'CB PM', 'HENRIQUE DOS SANTOS JOCA', '100096540', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('922eda9d-6386-49fc-9d78-71cb2030b268', 'Praça', 'CB PM', 'EDMILSON GOMES PINTO', '100096518', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('fb2cb658-489d-4fb7-a770-8afbaafaddb5', 'Praça', 'CB PM', 'ALBERT DE OLIVEIRA MACHADO', '100096222', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('757c0cff-0627-486f-9c78-448955c59e6c', 'Praça', 'CB PM', 'JOSÉ AMANDO INACIO FILHO', '100096421', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('5673daaa-43c4-4391-98b8-f49e6bf4fec5', 'Praça', 'CB PM', 'ANTONIO BRAGA SILVINO', '100096234', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('47df4cd6-20b7-4014-95ab-44f22fd2b954', 'Praça', 'CB PM', 'VÍTOR FERREIRA SILVA CHAGAS', '100096337', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('93b23869-12f4-4836-8d94-b5b5224bd7e8', 'Praça', 'CB PM', 'JHIENIFFER LUANA DA SILVA DELFINO', '100096546', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('d049dcb3-6cb2-4dde-a88c-7e7576712b18', 'Praça', 'CB PM', 'ALEXSANDRO EVANGELISTA DE SOUZA', '100096484', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('8a8a8242-44ab-4dff-b6a3-8061fcdc87e1', 'Praça', 'CB PM', 'EMERSON RODRIGUES DOS SANTOS', '100096524', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('0e1fa0f1-309a-4be0-880c-c86fb371578e', 'Praça', 'CB PM', 'JURANDY SOUSA ARAÚJO JUNIOR', '100096429', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('23697b69-58cb-46f7-82b6-d4de7a1a4860', 'Praça', 'CB PM', 'ALESSANDRO VILAS BOAS DE PAULA', '100096350', false, false, NULL, NULL, NULL, '2025-11-11 11:47:39.500245', '2025-11-11 11:47:39.500245', true),
	('f8fdf33c-6e30-422c-a596-121f1af2d471', 'Praça', 'SD PM', 'JANDIRSON VIEIRA MAIA', '100063703', false, false, NULL, NULL, NULL, '2025-11-11 11:50:17.974111', '2025-11-11 11:50:17.974111', true),
	('2d4a407d-e005-4db7-aed8-edc6ff75fab5', 'Praça', '2º SGT PM', 'CLEBENILDO DE LIMA GOMES', '100075677', true, false, NULL, NULL, NULL, '2025-11-11 12:03:51.995068', '2025-11-11 12:03:51.995068', true),
	('af438d53-c3bc-453f-b7f3-02bbcc414411', 'Praça', '1º SGT PM', 'ALOIR FERREIRA DA SILVA', '100093910', true, false, NULL, NULL, NULL, '2025-11-14 10:07:59.419379', '2025-11-14 10:07:59.419379', true),
	('fe15018e-fe8a-45f2-b352-f77ec9b1338b', 'Praça', 'CB PM', 'RALILSON PEREIRA DE LIMA', '100094962', false, false, NULL, NULL, NULL, '2025-11-14 10:40:52.989236', '2025-11-14 10:40:52.989236', true),
	('def4cbb5-dda6-4c6a-8415-46255c59cfd6', 'Praça', '3º SGT PM', 'CLAUDEMIR BISCOLA MARTINS', '100062656', false, false, NULL, NULL, NULL, '2025-11-25 11:15:15.154493', '2025-11-25 11:15:15.154493', true),
	('711abb90-7296-4fb2-9476-adb97980b9c9', 'Praça', '3º SGT PM', 'EDINECIO BISCOLA MARTINS', '100056841', false, false, NULL, NULL, NULL, '2025-11-25 11:15:46.456446', '2025-11-25 11:15:46.456446', true),
	('b0ee2b71-8112-4dd0-bc84-29e503438933', 'Oficial', 'ASP OF PM', 'CARLOS DIEGO PEREIRA', '100095958', false, false, NULL, NULL, NULL, '2025-11-28 08:16:22.953546', '2025-11-28 08:16:22.953546', true),
	('cbf49be6-367e-479d-9643-8aeeda3d9369', 'Praça', '3º SGT PM', 'JOSMAR DA ROCHA ANDRADE', '100092565', false, false, NULL, NULL, NULL, '2025-11-28 08:17:16.054219', '2025-11-28 08:17:16.054219', true),
	('42ab08a6-0c5c-428f-b430-4c84195cf87d', 'Oficial', '1º TEN PM', 'LEANDERSON COUTO DE JESUS', '100083971', true, false, NULL, NULL, NULL, '2025-11-28 09:40:05.988675', '2025-11-28 09:40:05.988675', true),
	('5a4d24de-7b0d-422f-b1e5-eb7a8bfb83cd', 'Oficial', '1º TEN PM', 'VILMAR FERREIRA', '100059738', true, false, NULL, NULL, NULL, '2025-11-28 09:39:33.231969', '2025-11-28 09:39:33.231969', true),
	('031b4ddb-77d1-4e28-8c1f-03ff75724772', 'Praça', 'CB PM', 'HÉRIK HENRIQUE DE SOUZA', '100094193', false, false, NULL, NULL, NULL, '2026-01-13 08:04:52.109006', '2026-01-13 08:04:52.109006', true),
	('d15531b3-f142-42f4-8b23-4611fa36d4e0', 'Praça', '2º SGT PM', 'GILBERTO DOS SANTOS DORNELES', '100087224', false, false, NULL, NULL, NULL, '2026-01-13 08:12:40.470018', '2026-01-13 08:12:40.470018', true),
	('54c2f630-e6a6-41ab-a928-cea6f778d24e', 'Praça', 'CB PM', 'ZAQUEU DE ALMEIDA KVIATKOSKI', '100095606', false, false, NULL, NULL, NULL, '2026-01-13 08:13:09.853444', '2026-01-13 08:13:09.853444', true),
	('629d8cec-a85e-46ef-999a-aa3977225954', 'Oficial', '1º TEN PM', 'ANA CLAUDIA DORÉ GONÇALVES', '100089815', false, false, NULL, NULL, NULL, '2026-01-13 09:57:07.832829', '2026-01-13 09:57:07.832829', true),
	('9c20608c-d7b4-4f29-a800-a2f1ed8c7c84', 'Praça', 'CB PM', 'VALDECIR DA SILVEIRA', '100072467', false, false, NULL, NULL, NULL, '2026-01-13 09:57:37.126039', '2026-01-13 09:57:37.126039', true),
	('ca7282a9-ac86-4688-89e9-cf083b935be6', 'Oficial', '1º TEN PM', 'SIDNEI SILVA DE SOUZA', '100072431', true, false, NULL, NULL, NULL, '2026-01-13 11:25:38.506326', '2026-01-13 11:25:38.506326', true),
	('62e979ae-bc59-480d-8be2-e3a944a2ffc5', 'Praça', '3º SGT PM', 'JOSÉ LUIZ DA SILVA', '100047125', false, false, NULL, NULL, NULL, '2026-01-13 11:56:18.837435', '2026-01-13 11:56:18.837435', true),
	('82328a4f-678f-4d4e-b4f3-5fdd215f7ceb', 'Praça', '3º SGT PM', 'DAVINO DOS SANTOS SILVA', '100051918', false, false, NULL, NULL, NULL, '2026-01-13 11:56:50.59347', '2026-01-13 11:56:50.59347', true),
	('e746704b-9472-40d0-9199-3d8c463dfadb', 'Praça', 'ST PM', 'WALMIR DE SOUZA', '100059740', false, false, NULL, NULL, NULL, '2026-01-13 12:20:15.404852', '2026-01-13 12:20:15.404852', true),
	('38100541-d8e4-4153-807b-234b1b25a670', 'Praça', '2º SGT PM', 'MÁRCIO LEANDRO BEZERRA SALTON', '100072170', false, false, NULL, NULL, NULL, '2026-01-13 12:42:25.469011', '2026-01-13 12:42:25.469011', true),
	('93f0c4a3-de4a-400c-a9dd-d77922ca9982', 'Praça', '3º SGT PM', 'HEITOR RACANELLI PEREIRA CONTREIRAS', '100094189', false, false, NULL, NULL, NULL, '2026-01-13 12:42:53.99126', '2026-01-13 12:42:53.99126', true),
	('76230ba3-e8a7-4df2-b1e4-1fa51ce6c3e9', 'Praça', '3º SGT PM', 'RODRIGO RECO PORTEL', '100092758', false, false, NULL, NULL, NULL, '2026-01-13 13:19:01.664507', '2026-01-13 13:19:01.664507', true),
	('8d1e6de9-4294-4e82-9850-4cd1a4fd480f', 'Praça', 'CB PM', 'MOISSÉS ALVES DA CRUZ', '100095100', false, false, NULL, NULL, NULL, '2026-01-13 13:19:41.248202', '2026-01-13 13:19:41.248202', true),
	('4a80086a-a496-45ec-8f83-8659c1953082', 'Praça', 'CB PM', 'WANDO DALBEM DA SILVA', '100096338', false, false, NULL, NULL, NULL, '2026-01-13 13:20:13.666168', '2026-01-13 13:20:13.666168', true),
	('f16e7149-02fb-4c1e-845f-40847916ef38', 'Praça', 'CB PM', 'ADRIANO GALDINO DA COSTA', '100096157', false, false, NULL, NULL, NULL, '2026-01-14 07:51:52.286847', '2026-01-14 07:51:52.286847', true),
	('f1954894-e898-45d0-931c-215d1a542e23', 'Praça', 'CB PM', 'MAGNUM DE CARVALHO', '100096181', false, false, NULL, NULL, NULL, '2026-01-14 07:54:48.463855', '2026-01-14 07:54:48.463855', true),
	('14651a18-887c-48ef-8898-66caf9b133eb', 'Praça', 'ST PM', 'DIOGO RIBEIRO', '100094023', true, true, 'diogoifroads@gmail.com', '$2b$12$9uOEN.qKZ5Ei1jL1dgesLOemPwc5uhShlIgsLKbmNCHN/DUeMbRLu', 'admin', '2025-11-05 20:05:45.962484', '2025-11-13 10:08:44.858689', true);
INSERT INTO amostra.usuarios VALUES
	('f3bec4a7-4679-4fc7-8684-aec8ed4d03a4', 'Praça', '3º SGT PM', 'VAGNER LIMA DOS SANTOS', '100094563', false, false, NULL, NULL, NULL, '2026-01-14 11:39:15.659603', '2026-01-14 11:39:15.659603', true),
	('13839ad7-3fdd-421b-9b29-0680936f6bb3', 'Praça', '3º SGT PM', 'IURE SUED DOMBROSKI DOS SANTOS', '100094206', false, false, NULL, NULL, NULL, '2026-01-14 12:36:01.728446', '2026-01-14 12:36:01.728446', true),
	('a3e74b52-9e3c-4731-9524-0592d7378e01', 'Praça', '3º SGT PM', 'JÚLIO JANUÁRIO DOS SANTOS MARTINS', '100094301', false, false, NULL, NULL, NULL, '2026-01-14 12:46:34.977348', '2026-01-14 12:46:34.977348', true),
	('e48e8b6f-40e3-4908-9498-68ce7d6da0ac', 'Praça', 'CB PM', 'CLEITON DOS SANTOS BRAZ', '100096502', false, false, NULL, NULL, NULL, '2026-01-14 12:47:17.549207', '2026-01-14 12:47:17.549207', true),
	('e3277e80-8880-4b1b-9e5e-5f91d18ce231', 'Praça', 'CB PM', 'MARISVALDO LUCINDO DE ALMEIDA', '100094392', false, false, NULL, NULL, NULL, '2026-01-14 13:07:35.675771', '2026-01-14 13:07:35.675771', true),
	('429910a5-f47e-4743-ace8-f7866fd904cd', 'Praça', '3º SGT PM', 'BRUNO RODRIGUES DA SILVA', '100093945', false, false, NULL, NULL, NULL, '2026-01-14 13:08:06.024022', '2026-01-14 13:08:06.024022', true),
	('728f538f-a44f-4e44-a335-cfe1473abd45', 'Praça', '3º SGT PM', 'THYAGO VINÍCIUS MARQUES OLIVEIRA', '100089173', false, false, NULL, NULL, NULL, '2026-01-14 13:21:30.989774', '2026-01-14 13:21:30.989774', true),
	('2d3959d3-a6dc-42b7-8dec-81da68979782', 'Praça', 'CB PM', 'REBSON GALVÃO DA SILVA SOUZA', '100096588', false, false, NULL, NULL, NULL, '2026-01-14 13:25:29.379612', '2026-01-14 13:25:29.379612', true),
	('ff38512f-cf0b-418c-a084-28395e8b532d', 'Praça', 'CB PM', 'OSMÁRIO ALVES DE SOUZA JÚNIOR', '100087800', false, false, NULL, NULL, NULL, '2026-01-14 13:37:36.403312', '2026-01-14 13:37:36.403312', true),
	('eb21a088-e9ee-4ef0-ab36-1e7a062807fa', 'Praça', 'CB PM', 'JULIO CEZAR FERNANDES DA SILVA', '100095428', false, false, NULL, NULL, NULL, '2026-01-14 18:47:26.689314', '2026-01-14 18:47:26.689314', true),
	('e2e7401d-8265-4c64-90ff-e8b7d9dbe1e5', 'Praça', '1º SGT PM', 'FRANCISCO ALEXSANDRO FERNANDES JANUÁRIO', '100071920', false, false, NULL, NULL, NULL, '2026-01-14 19:05:48.225671', '2026-01-14 19:05:48.225671', true),
	('d140aad8-ab6c-4190-8dc7-4e1c0e328497', 'Praça', '1º SGT PM', 'PAULO ROBERTO LESSA DE LIMA', '100070225', true, false, NULL, NULL, NULL, '2026-02-19 13:21:02.257783', '2026-02-19 13:21:02.257783', true),
	('7517063f-a1db-47b3-bf3d-77c9055c0598', 'Praça', '2º SGT PM', 'CRISTIANO SANTOS COELHO', '100068090', true, false, NULL, NULL, NULL, '2026-03-02 09:15:16.247231', '2026-03-02 09:15:16.247231', true),
	('c820dc69-3da5-4a2a-87c0-7e394342a694', 'Praça', 'CB PM', 'LÚCIO JÚNIOR FERREIRA DA SILVA', '100096567', true, false, NULL, NULL, NULL, '2026-03-02 09:19:06.278756', '2026-03-02 09:19:06.278756', true),
	('e1e242ec-8013-4546-8f00-83cb75d8dd1d', 'Praça', 'CB PM', 'MARCOS JOSÉ TERENCIO', '100092681', true, false, NULL, NULL, NULL, '2026-03-02 09:20:07.253761', '2026-03-02 09:20:07.253761', true),
	('77225a8d-6a96-488c-b91b-346afc466ed0', 'Praça', 'CB PM', 'LUCAS RUIZ CAVALCANTE', '100096564', true, false, NULL, NULL, NULL, '2026-03-02 09:21:09.819449', '2026-03-02 09:21:09.819449', true),
	('e2d0bb63-c9f2-4076-9485-af5dbed6902b', 'Praça', 'CB PM', 'LEONARDO MENDANHA MACHADO', '100096558', true, false, NULL, NULL, NULL, '2026-03-02 09:22:19.761516', '2026-03-02 09:22:19.761516', true),
	('c7d50628-9e2f-4554-9c7d-fdd63650c6a9', 'Praça', 'CB PM', 'HÉBER FRANCO OLIVEIRA PEGO', '100096539', true, false, NULL, NULL, NULL, '2026-03-02 09:22:53.146829', '2026-03-02 09:22:53.146829', true),
	('b1a1e111-0c11-4275-a7a6-7da4543ae337', 'Praça', 'CB PM', 'MICHEL GOMES DE SOUZA', '100096572', true, false, NULL, NULL, NULL, '2026-03-02 09:23:23.192431', '2026-03-02 09:23:23.192431', true),
	('4546d731-32f3-4490-945a-d8df112277ac', 'Oficial', '1º TEN PM', 'ANTONIO FRANCISCO DOS SANTOS', '100071695', true, true, 'antoniof6955@gmail.com', '$2b$12$31/Mo/KPVgt93LYr1U52ROeWatDxmfF.d7xO3GBKxrJyLUiqjhZzi', 'admin', '2025-11-08 16:06:25.538021', '2026-03-04 08:28:27.057972', true),
	('6f461f16-4121-4993-b4ff-eb318f5f341d', 'Praça', 'CB PM', 'MARCELO CLARINDO DA SILVA', '100096440', false, false, NULL, NULL, NULL, '2026-03-05 12:17:58.116778', '2026-03-05 12:17:58.116778', true),
	('09a4f5ea-06e3-49e8-8f98-a13299983ec5', 'Oficial', 'MAJ PM', 'DENILSON LIMA GONÇALVES', '100095139', true, false, NULL, NULL, NULL, '2026-03-05 12:59:43.499538', '2026-03-05 12:59:43.499538', true),
	('d4b30989-e0c4-4546-a861-009ca627df96', 'Praça', '3º SGT PM', 'NILSON ROCHA VITORINO DOS SANTOS', '100094412', true, false, NULL, NULL, NULL, '2026-03-05 13:15:55.747934', '2026-03-05 13:15:55.747934', true),
	('5a35cf77-c57e-4484-9395-6be36fceb0ad', 'Praça', 'CB PM', 'JUCELINO DE CARVALHO SANTOS', '100096426', false, false, NULL, NULL, NULL, '2026-03-17 10:55:48.770984', '2026-03-17 10:55:48.770984', true),
	('f203392e-e258-442b-a3dd-4d61a843a111', 'Praça', '3º SGT PM', 'ALISSON ARARUNA PASSARELI', '100077133', false, false, NULL, NULL, NULL, '2026-03-17 11:19:46.979866', '2026-03-17 11:19:46.979866', true),
	('e7d72e9d-af3c-4e19-bd5a-c67709d87989', 'Praça', '1º SGT PM', 'LUIZ CARLOS DA SILVA NETO', '100059697', false, false, NULL, NULL, NULL, '2026-03-17 11:20:27.30784', '2026-03-17 11:20:27.30784', true),
	('fe755546-9a8a-41be-aecd-070b1c4ef050', 'Praça', 'ST PM', 'DANIEL DOS SANTOS', '100093985', true, false, NULL, NULL, NULL, '2026-03-18 12:48:23.741777', '2026-03-18 12:48:23.741777', true),
	('cf4bca09-60d7-41c6-a404-645e69c985e4', 'Oficial', 'TC PM', 'RUDINEI JOÃO BESSEGATTO POGERE', '100075586', true, false, NULL, NULL, NULL, '2026-03-20 08:13:25.755395', '2026-03-20 08:13:25.755395', true),
	('74f96b4b-414e-453d-87ac-8bc108bc32fb', 'Praça', '3º SGT PM', 'DIÓGINO FERREIRA VASCONCELOS', '100091764', true, false, NULL, NULL, NULL, '2026-03-23 08:50:52.914674', '2026-03-23 08:50:52.914674', true),
	('1a2f4518-69c1-4e93-8b2e-f3ee0705c44b', 'Praça', 'CB PM', 'CLEITON ALVES GALDINO', '100095259', false, false, NULL, NULL, NULL, '2026-03-25 09:04:04.256733', '2026-03-25 09:04:04.256733', true),
	('14b1ef00-d0c1-4e2a-8f59-be81ba07c2c2', 'Praça', 'CB PM', 'JAIME HUMBERTO SIQUEIRA RODRIGUES', '100094964', false, false, NULL, NULL, NULL, '2026-03-25 09:59:26.197266', '2026-03-25 09:59:26.197266', true),
	('784fb84f-1028-49cf-b4b0-189e8dcebcac', 'Oficial', '1º TEN PM', 'RICARDO JOSÉ BONFIM', '100072338', true, false, NULL, NULL, NULL, '2026-03-26 07:53:34.92206', '2026-03-26 07:53:34.92206', true),
	('b6575b2b-c077-493a-888d-290dfd4dd0a8', 'Praça', 'SD PM', 'À APURAR', '100000000', false, false, NULL, NULL, NULL, '2026-03-27 12:29:37.629676', '2026-03-27 12:29:37.629676', true),
	('fd9c993c-ddc8-44a9-89d9-c9e48d9f3191', 'Praça', 'CB PM', 'RODRIGO DUTRA DE CASTRO', '100095531', false, false, NULL, NULL, NULL, '2026-03-31 08:06:06.511043', '2026-03-31 08:06:06.511043', true),
	('284071ec-9679-46ff-b523-14bf8495178a', 'Praça', '3º SGT PM', 'MARCELLO MACHULA', '100094365', true, false, NULL, NULL, NULL, '2026-04-17 13:06:43.794065', '2026-04-17 13:06:43.794065', true),
	('20ab4c97-f5b8-43d2-a945-1900d67b06b9', 'Praça', 'CB PM', 'DANNER MARSON BRITO ALVES', '100096366', false, false, NULL, NULL, NULL, '2026-04-22 10:22:00.30756', '2026-04-22 10:22:00.30756', true);


--
-- PostgreSQL database dump complete
--


