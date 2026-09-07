-- =============================================================================
-- ADM-P6 - seed dos catalogos LEGAIS
--
-- Semeia apenas o que e legislacao e nao varia por instalacao: hierarquia de
-- postos, geografia de Rondonia, RDPM, Estatuto e legislacao penal. Extraido do
-- banco em producao (dump de 13/05/2026), nao inventado.
--
-- NAO semeia nada operacional -- apuratorios, papeis, tipos de documento,
-- unidades PM, naturezas de fato, status, solucoes, penalidades, categorias de
-- indicio, tipos de andamento e papeis de pessoa continuam a cargo do
-- administrador, porque variam por unidade e por periodo.
--
-- Todos os INSERT usam ON CONFLICT DO NOTHING: a migration e idempotente, como
-- exige tests/migrations.rs.
--
-- Os UUIDs sao deterministicos. Onde o dump ja tinha UUID (municipios, crimes,
-- infracoes do art. 29) ele e PRESERVADO, para que a importacao dos dados de
-- producao possa casar por id sem reconsultar.
-- =============================================================================

-- 1. Circulos hierarquicos. O legado guardava isso em `tipos_usuario`;
--    os 12 postos reais se dividem exatamente nestes dois.
INSERT INTO circulos_hierarquicos (id, nome) VALUES
    ('c0000000-0000-4000-8000-000000000001', 'Oficiais'),
    ('c0000000-0000-4000-8000-000000000002', 'Pracas')
ON CONFLICT DO NOTHING;

-- 2. Postos e graduacoes. `ordem_hierarquica` do legado multiplicada por 10
--    para abrir espaco entre postos vizinhos sem renumerar tudo depois.
--    ASP OF PM nao estava no catalogo legado mas e usado por 1 militar real;
--    entra entre 2o TEN e SUB TEN. Revise o circulo se a PMRO classificar
--    pracas especiais em circulo proprio.
INSERT INTO postos_graduacoes (id, sigla, nome, circulo_hierarquico_id, ordem_hierarquica, ativo) VALUES
    ('c1000000-0000-4000-8000-000000000001', 'CEL PM', 'Coronel PM', 'c0000000-0000-4000-8000-000000000001', 100, true),
    ('c1000000-0000-4000-8000-000000000002', 'TEN CEL PM', 'Tenente-Coronel PM', 'c0000000-0000-4000-8000-000000000001', 90, true),
    ('c1000000-0000-4000-8000-000000000003', 'MAJ PM', 'Major PM', 'c0000000-0000-4000-8000-000000000001', 80, true),
    ('c1000000-0000-4000-8000-000000000004', 'CAP PM', 'Capitão PM', 'c0000000-0000-4000-8000-000000000001', 70, true),
    ('c1000000-0000-4000-8000-000000000005', '1º TEN PM', 'Primeiro-Tenente PM', 'c0000000-0000-4000-8000-000000000001', 60, true),
    ('c1000000-0000-4000-8000-000000000006', '2º TEN PM', 'Segundo-Tenente PM', 'c0000000-0000-4000-8000-000000000001', 50, true),
    ('c1000000-0000-4000-8000-000000000007', 'SUB TEN PM', 'Subtenente PM', 'c0000000-0000-4000-8000-000000000002', 40, true),
    ('c1000000-0000-4000-8000-000000000008', '1º SGT PM', 'Primeiro-Sargento PM', 'c0000000-0000-4000-8000-000000000002', 30, true),
    ('c1000000-0000-4000-8000-000000000009', '2º SGT PM', 'Segundo-Sargento PM', 'c0000000-0000-4000-8000-000000000002', 20, true),
    ('c1000000-0000-4000-8000-000000000010', '3º SGT PM', 'Terceiro-Sargento PM', 'c0000000-0000-4000-8000-000000000002', 10, true),
    ('c1000000-0000-4000-8000-000000000011', 'CB PM', 'Cabo PM', 'c0000000-0000-4000-8000-000000000002', 0, true),
    ('c1000000-0000-4000-8000-000000000012', 'SD PM', 'Soldado PM', 'c0000000-0000-4000-8000-000000000002', -10, true),
    ('c1000000-0000-4000-8000-000000000099', 'ASP OF PM', 'Aspirante a Oficial PM', 'c0000000-0000-4000-8000-000000000002', 45, true)
ON CONFLICT DO NOTHING;

-- 3. Municipios e distritos de Rondonia. Os municipios entram primeiro:
--    `municipio_pai_id` e auto-referencial e os distritos apontam para eles.
INSERT INTO municipios_distritos (id, nome, tipo, municipio_pai_id, ativo) VALUES
    ('d04de498-a615-4443-baeb-6094e0db4f47', 'Alta Floresta D''Oeste', 'municipio', NULL, true),
    ('02755fe3-b1b6-47bd-be1d-69755c357525', 'Alto Alegre dos Parecis', 'municipio', NULL, true),
    ('7ec317b1-0fd2-4fe6-b071-a754abb81e85', 'Alto Paraíso', 'municipio', NULL, true),
    ('adb2a3f7-7f5b-4e51-9b73-ad482366fb7d', 'Alvorada D''Oeste', 'municipio', NULL, true),
    ('f1b8108b-5409-41db-a0bc-b812757e78bd', 'Ariquemes', 'municipio', NULL, true),
    ('13979f1c-5861-44c0-b7cc-5acaa3f59b15', 'Buritis', 'municipio', NULL, true),
    ('c293b32d-1a05-49d8-a909-fac6e68e4a7a', 'Cabixi', 'municipio', NULL, true),
    ('46944cd8-71b7-4c27-810a-3a2f933f7d4d', 'Cacaulândia', 'municipio', NULL, true),
    ('7df3c6ab-14dd-49f3-af1c-78f530d9ab9b', 'Cacoal', 'municipio', NULL, true),
    ('c1726aa7-6fa8-43aa-8147-97167dbc969e', 'Campo Novo de Rondônia', 'municipio', NULL, true),
    ('02410564-af78-4eec-b348-f4c9db5a8e8b', 'Candeias do Jamari', 'municipio', NULL, true),
    ('975eeb6c-b813-4885-9499-a61d35b88eb2', 'Castanheiras', 'municipio', NULL, true),
    ('5d5b8cbf-5a95-4644-925f-65cb4105fab8', 'Cerejeiras', 'municipio', NULL, true),
    ('ecbeb180-7aca-4f87-a230-5ad63c118ad8', 'Chupinguaia', 'municipio', NULL, true),
    ('113c1e3d-d19b-468b-9702-dd0a76343816', 'Colorado do Oeste', 'municipio', NULL, true),
    ('443f1f63-453f-4c18-a26f-0df6c5e69188', 'Corumbiara', 'municipio', NULL, true),
    ('8d75eb1e-851b-4624-872e-478f1d193cc0', 'Costa Marques', 'municipio', NULL, true),
    ('e8a28f1e-9d6b-4636-9210-da52531b9e23', 'Cujubim', 'municipio', NULL, true),
    ('7368e7c1-c76f-4084-b4f8-6ca947ef926f', 'Espigão D''Oeste', 'municipio', NULL, true),
    ('6e74884a-fbdb-4c08-b67b-d91e3b3c6d27', 'Governador Jorge Teixeira', 'municipio', NULL, true),
    ('431d17a5-ada7-4ed4-a4d2-033c90647678', 'Guajará-Mirim', 'municipio', NULL, true),
    ('f4297002-4868-4836-a640-6616ee2f07b0', 'Itapuã do Oeste', 'municipio', NULL, true),
    ('b58fe2a7-2f68-4459-aa97-639b32307033', 'Jaru', 'municipio', NULL, true),
    ('96910af6-0ae7-48e3-bfab-ba6bc11ee623', 'Ji-Paraná', 'municipio', NULL, true),
    ('3991f884-1d8b-4757-8e11-49d2f51ab654', 'Machadinho D''Oeste', 'municipio', NULL, true),
    ('61b523c0-7bf4-4082-ade2-04f04bd339a5', 'Ministro Andreazza', 'municipio', NULL, true),
    ('c3e995c3-73a3-4f8c-b13c-8f626baa564f', 'Mirante da Serra', 'municipio', NULL, true),
    ('13f97fb6-3ef9-49ae-a5e6-04438f3845fb', 'Monte Negro', 'municipio', NULL, true),
    ('ea871dc4-7309-4334-b4f9-d8c0cbde7242', 'Nova Brasilândia D''Oeste', 'municipio', NULL, true),
    ('6fb724bf-cd85-4d9f-8a5b-4b8a1b449f6f', 'Nova Mamoré', 'municipio', NULL, true),
    ('e39e96f6-3b81-458f-aaf1-954e955ea174', 'Nova União', 'municipio', NULL, true),
    ('91ff1094-e40f-408b-ba58-2b183461dab9', 'Novo Horizonte do Oeste', 'municipio', NULL, true),
    ('63c94afb-7094-49e5-a3ab-bf6af3726630', 'Ouro Preto do Oeste', 'municipio', NULL, true),
    ('1421b998-dc7b-4532-9fac-5130636a0741', 'Parecis', 'municipio', NULL, true),
    ('b1459de7-3cc0-4bca-bee4-fcb3f498b179', 'Pimenta Bueno', 'municipio', NULL, true),
    ('e42774be-3290-4a1e-a951-6fb5ae5b7c95', 'Pimenteiras do Oeste', 'municipio', NULL, true),
    ('c1df7c49-49ec-4eb6-a467-bc6e05db9496', 'Porto Velho', 'municipio', NULL, true),
    ('6457b54f-f036-4b8e-be72-01a17c5e762c', 'Presidente Médici', 'municipio', NULL, true),
    ('3748ef2b-8554-4fce-b39a-9673a83b3d06', 'Primavera de Rondônia', 'municipio', NULL, true),
    ('a67bdd97-bf58-4d07-8373-67001492a7b5', 'Rio Crespo', 'municipio', NULL, true),
    ('01b7b348-370f-4199-a19f-5c258d86781b', 'Rolim de Moura', 'municipio', NULL, true),
    ('7bfbb9ed-31e7-4834-b994-ebe2ff965c01', 'Santa Luzia D''Oeste', 'municipio', NULL, true),
    ('a86d1c3a-2106-407b-b7c7-94e87a53a7a8', 'Seringueiras', 'municipio', NULL, true),
    ('b65ce06d-31f9-40bf-892a-2f677c7cbc67', 'São Felipe D''Oeste', 'municipio', NULL, true),
    ('13e417e5-6041-49be-9ebc-883071af8de3', 'São Francisco do Guaporé', 'municipio', NULL, true),
    ('a8c63a64-c159-4c14-b7a6-7d5a9b9bdebd', 'São Miguel do Guaporé', 'municipio', NULL, true),
    ('14347f04-3a1b-4f4d-ba46-9c6a0aaa68b1', 'Teixeirópolis', 'municipio', NULL, true),
    ('41eb85e6-9ab8-49f0-a044-8a60afec6442', 'Theobroma', 'municipio', NULL, true),
    ('6579ede4-b08c-4f6d-85e8-d40c8714bd04', 'Urupá', 'municipio', NULL, true),
    ('5b6ee609-13b0-497f-885b-01444378ee46', 'Vale do Anari', 'municipio', NULL, true),
    ('7f35cc23-6ced-440e-8066-b6ec3246c787', 'Vale do Paraíso', 'municipio', NULL, true),
    ('75bf103c-9579-4fae-ab4f-6a9b327dab6c', 'Vilhena', 'municipio', NULL, true)
ON CONFLICT DO NOTHING;

INSERT INTO municipios_distritos (id, nome, tipo, municipio_pai_id, ativo) VALUES
    ('663d82c1-b97f-4ef1-83c6-c462dc4e725e', 'Abunã', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('8d86b6ed-5433-4283-83b6-25fc5260e435', 'Araras', 'distrito', '6fb724bf-cd85-4d9f-8a5b-4b8a1b449f6f', true),
    ('8b2b2d7d-633c-43c2-9cfc-d9427b7e8624', 'Barra de Camaratuba', 'distrito', '7bfbb9ed-31e7-4834-b994-ebe2ff965c01', true),
    ('768195df-2ba8-4f12-ac74-e97784ecd9c6', 'Boa Esperança', 'distrito', 'ecbeb180-7aca-4f87-a230-5ad63c118ad8', true),
    ('3093c203-d978-47c7-9a33-4cae58fb1f58', 'Boa Vista do Pacarana', 'distrito', '7368e7c1-c76f-4084-b4f8-6ca947ef926f', true),
    ('95feca84-642f-407b-8532-16b6b4c505f8', 'Bom Futuro', 'distrito', 'f1b8108b-5409-41db-a0bc-b812757e78bd', true),
    ('0fc00357-acc2-4ed3-b214-60e7e0a25ba2', 'Bom Jesus', 'distrito', 'b58fe2a7-2f68-4459-aa97-639b32307033', true),
    ('2e9da6c1-adb8-4c64-92a6-881047715a1d', 'Calama', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('0a7c30ae-23cb-4864-b31e-d07a29eb4350', 'Colina Verde', 'distrito', '6e74884a-fbdb-4c08-b67b-d91e3b3c6d27', true),
    ('c9b42f22-d69b-4dba-a264-429518c0fe6a', 'Demarcação', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('6afb3fc3-d88a-4099-8ef0-70cfd4098f32', 'Divinópolis', 'distrito', '7df3c6ab-14dd-49f3-af1c-78f530d9ab9b', true),
    ('4cb04178-4c34-4da7-85b8-1416ec91a4dd', 'Estrela de Rondônia', 'distrito', '6457b54f-f036-4b8e-be72-01a17c5e762c', true),
    ('d3ed48b2-0ccf-4aa3-8e45-bd2cae09b690', 'Extrema', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('d04289fd-2a12-4012-bc78-e31f5d207e6f', 'Filadélfia D''Oeste', 'distrito', 'd04de498-a615-4443-baeb-6094e0db4f47', true),
    ('f173e5a6-9ec3-49f6-bea2-9094d3b75728', 'Flor da Serra', 'distrito', '7368e7c1-c76f-4084-b4f8-6ca947ef926f', true),
    ('5db68ab1-dbe9-4e2b-8a6c-13a545d0d6bc', 'Fortaleza do Abunã', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('db519f02-24e4-4cd7-8fb5-362b80065656', 'Iata', 'distrito', '431d17a5-ada7-4ed4-a4d2-033c90647678', true),
    ('10ad83ea-e826-4268-a072-ab89b4ba6d23', 'Izidolândia', 'distrito', 'd04de498-a615-4443-baeb-6094e0db4f47', true),
    ('db5722b9-2362-4324-aeb8-39f2ee057055', 'Jaci-Paraná', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('3046ec8f-d837-41b2-99fe-8b35d74146c1', 'Jacynópolis', 'distrito', '6fb724bf-cd85-4d9f-8a5b-4b8a1b449f6f', true),
    ('0b8a053e-8851-48b9-86ed-d334db8851ea', 'Jardinópolis', 'distrito', '975eeb6c-b813-4885-9499-a61d35b88eb2', true),
    ('7d52be33-087d-4b32-b3c6-893389040577', 'Joelândia', 'distrito', 'f1b8108b-5409-41db-a0bc-b812757e78bd', true),
    ('ba4657d3-b03f-4a56-95a7-28e6419998ca', 'Marco Rondon', 'distrito', 'b1459de7-3cc0-4bca-bee4-fcb3f498b179', true),
    ('53a372f8-8992-4d07-be0b-f687b306373d', 'Migrantinópolis', 'distrito', '91ff1094-e40f-408b-ba58-2b183461dab9', true),
    ('920134c3-3305-4e44-9991-eeb204f898a8', 'Mutum-Paraná', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('3d84386f-02bd-4895-9c8c-626e33192a1c', 'Nazaré', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('cdadc521-6257-46b8-bac4-291d4bca4283', 'Nova Califórnia', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('d93743fa-ce8b-4afa-8b75-05e714d11021', 'Nova Colina', 'distrito', '96910af6-0ae7-48e3-bfab-ba6bc11ee623', true),
    ('fb169a72-381d-4e88-815c-1514b9691024', 'Nova Conquista', 'distrito', '75bf103c-9579-4fae-ab4f-6a9b327dab6c', true),
    ('a7dc8530-644f-417e-b01b-fede6660ee4e', 'Nova Dimensão', 'distrito', '6fb724bf-cd85-4d9f-8a5b-4b8a1b449f6f', true),
    ('dfb8339f-4b19-4b1a-b081-430154b60a1b', 'Nova Esperança - Espigão', 'distrito', '7368e7c1-c76f-4084-b4f8-6ca947ef926f', true),
    ('c12a3264-7049-4bf3-9fcb-86c875135561', 'Nova Estrela de Rondônia', 'distrito', '01b7b348-370f-4199-a19f-5c258d86781b', true),
    ('ebb6ed7b-1fb4-4343-8899-d62aed34dfee', 'Nova Gease D''Oeste', 'distrito', 'd04de498-a615-4443-baeb-6094e0db4f47', true),
    ('75c86184-6aac-4122-aa6b-7a78aba285a3', 'Nova Londrina', 'distrito', '96910af6-0ae7-48e3-bfab-ba6bc11ee623', true),
    ('4aaeef9e-5178-47d2-a9c0-2382b4a4c216', 'Novo Paraíso - Espigão', 'distrito', '7368e7c1-c76f-4084-b4f8-6ca947ef926f', true),
    ('dd2453d9-12ac-4e4c-b24d-77370c32688c', 'Novo Paraíso - São Felipe', 'distrito', 'b65ce06d-31f9-40bf-892a-2f677c7cbc67', true),
    ('65fbf848-21b7-4f3f-9139-c291f6e840f6', 'Novo Plano', 'distrito', 'ecbeb180-7aca-4f87-a230-5ad63c118ad8', true),
    ('69925ca2-8b22-4c7f-a395-6a0f8c77c753', 'Novo Riachuelo', 'distrito', '6457b54f-f036-4b8e-be72-01a17c5e762c', true),
    ('11f4e476-b7ee-4ede-a497-90044b5b755f', 'Oriente Novo', 'distrito', '3991f884-1d8b-4757-8e11-49d2f51ab654', true),
    ('90105997-c881-4a86-8977-e7e92a65f18a', 'Palmeiras', 'distrito', '6fb724bf-cd85-4d9f-8a5b-4b8a1b449f6f', true),
    ('fab7d3bd-3359-40fb-b0e4-a7fbdc9d65f2', 'Príncipe da Beira', 'distrito', '8d75eb1e-851b-4624-872e-478f1d193cc0', true),
    ('588be546-5dd4-45dd-89d9-a2eb7498e84b', 'Quinto Bec', 'distrito', '3991f884-1d8b-4757-8e11-49d2f51ab654', true),
    ('3b4b483c-e85f-433c-8f6e-49ce47965fb3', 'Rio Branco', 'distrito', 'c1726aa7-6fa8-43aa-8147-97167dbc969e', true),
    ('5464e30a-5a51-40a6-9a16-2c85e0920bd3', 'Rio Preto do Candeias', 'distrito', '02410564-af78-4eec-b348-f4c9db5a8e8b', true),
    ('8351c6ce-1e3b-46d6-901e-092cc9aa0754', 'Riozinho', 'distrito', '7df3c6ab-14dd-49f3-af1c-78f530d9ab9b', true),
    ('0db9011a-2559-4288-bbbf-7ab56b0b847a', 'Rolim de Moura do Guaporé', 'distrito', 'd04de498-a615-4443-baeb-6094e0db4f47', true),
    ('7378bc73-0ebc-44be-a43f-accfc33f14df', 'Rondominas', 'distrito', '63c94afb-7094-49e5-a3ab-bf6af3726630', true),
    ('c7d6d7e8-1c37-4424-a215-fcb1c2011406', 'Santa Cruz da Serra', 'distrito', 'b58fe2a7-2f68-4459-aa97-639b32307033', true),
    ('3f6a20cf-ee00-4f9a-9a7d-f09e377e8e35', 'Santana do Guaporé', 'distrito', 'a8c63a64-c159-4c14-b7a6-7d5a9b9bdebd', true),
    ('ae48a942-c1b8-4cb4-937d-91cdfb7eb6af', 'Santo Antônio D''Oeste', 'distrito', 'd04de498-a615-4443-baeb-6094e0db4f47', true),
    ('0c24c44a-fb22-42c7-995b-7e3b9d421b63', 'Surpresa', 'distrito', '431d17a5-ada7-4ed4-a4d2-033c90647678', true),
    ('6dfbb187-2685-4917-b5b5-ff538ad0efee', 'São Carlos', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true),
    ('c2cd39ef-d2cc-400c-af5b-48127c546a59', 'Tabajara', 'distrito', '3991f884-1d8b-4757-8e11-49d2f51ab654', true),
    ('c689e7e5-44d7-48c5-8f24-3fe82e83468f', 'Tancredópolis', 'distrito', 'adb2a3f7-7f5b-4e51-9b73-ad482366fb7d', true),
    ('0bca42de-4de1-4827-b045-b07b474f7cf5', 'Tarilândia', 'distrito', 'b58fe2a7-2f68-4459-aa97-639b32307033', true),
    ('45370d1e-f5cd-442f-80f3-adcbd7861859', 'Terra Boa', 'distrito', 'adb2a3f7-7f5b-4e51-9b73-ad482366fb7d', true),
    ('bff3f114-d93e-4a8d-9362-3f0c0b020b15', 'Três Coqueiros', 'distrito', 'c1726aa7-6fa8-43aa-8147-97167dbc969e', true),
    ('870bdf4a-e9da-46c2-ab13-0edc04a176cf', 'Vila Bandeira Branca', 'distrito', '6457b54f-f036-4b8e-be72-01a17c5e762c', true),
    ('74277582-ed8f-4f88-a49b-06696c8f17ad', 'Vila Camargo', 'distrito', '6457b54f-f036-4b8e-be72-01a17c5e762c', true),
    ('92530bca-81fb-42d6-bc81-94ebdb15b9e9', 'Vista Alegre do Abunã', 'distrito', 'c1df7c49-49ec-4eb6-a467-bc6e05db9496', true)
ON CONFLICT DO NOTHING;

-- 4. Dispositivos legais. Os 4 primeiros sao os efetivamente usados pelos 27
--    artigos do dump; o Estatuto e obrigatorio para as infracoes do art. 29.
INSERT INTO dispositivos_legais (id, nome) VALUES
    ('c3000000-0000-4000-8000-000000000001', 'Código Penal'),
    ('c3000000-0000-4000-8000-000000000002', 'Código Penal Militar'),
    ('c3000000-0000-4000-8000-000000000003', 'Código de Trânsito Brasileiro'),
    ('c3000000-0000-4000-8000-000000000004', 'Lei de Contravenções Penais'),
    ('c3000000-0000-4000-8000-000000000005', 'Estatuto dos Policiais Militares'),
    ('c3000000-0000-4000-8000-000000000006', 'Estatuto da Crianca e do Adolescente'),
    ('c3000000-0000-4000-8000-000000000007', 'Lei de Drogas')
ON CONFLICT DO NOTHING;

-- 5. Especie da infracao penal: propriedade DO ARTIGO (diferente da esfera).
INSERT INTO especies_infracao_penal (id, nome) VALUES
    ('c4000000-0000-4000-8000-000000000001', 'Contravenção Penal'),
    ('c4000000-0000-4000-8000-000000000002', 'Crime')
ON CONFLICT DO NOTHING;

-- 6. Esfera penal: escolhida NO VINCULO envolvido<->artigo, porque depende do
--    caso (art. 9o do CPM), nao do artigo.
INSERT INTO esferas_penais (id, nome) VALUES
    ('c5000000-0000-4000-8000-000000000001', 'Militar'),
    ('c5000000-0000-4000-8000-000000000002', 'Comum')
ON CONFLICT DO NOTHING;

-- 7. Natureza da transgressao disciplinar.
INSERT INTO naturezas_transgressao (id, nome) VALUES
    ('c6000000-0000-4000-8000-000000000001', 'Leve'),
    ('c6000000-0000-4000-8000-000000000002', 'Media'),
    ('c6000000-0000-4000-8000-000000000003', 'Grave')
ON CONFLICT DO NOTHING;

-- 8. Artigos do RDPM. A gravidade vem daqui e nao e duplicada no inciso.
INSERT INTO artigos_rdpm (id, artigo, natureza_transgressao_id) VALUES
    ('c7000000-0000-4000-8000-000000000001', 'Art. 15', 'c6000000-0000-4000-8000-000000000001'),
    ('c7000000-0000-4000-8000-000000000002', 'Art. 16', 'c6000000-0000-4000-8000-000000000002'),
    ('c7000000-0000-4000-8000-000000000003', 'Art. 17', 'c6000000-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

-- 9. Incisos do RDPM (95 transgressoes).
INSERT INTO transgressoes (id, artigo_rdpm_id, inciso, texto, ativo) VALUES
    ('c8000000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000001', 'I', 'portar-se inconvenientemente, desrespeitando as normas de boa educação, os costumes ou as convenções sociais', true),
    ('c8000000-0000-4000-8000-000000000002', 'c7000000-0000-4000-8000-000000000001', 'II', 'não portar seu documento de identidade, quando uniformizado, ou não exibi-lo quando solicitado', true),
    ('c8000000-0000-4000-8000-000000000003', 'c7000000-0000-4000-8000-000000000001', 'III', 'deixar de participar em tempo hábil, à autoridade competente, a impossibilidade de comparecer à OPM ou a qualquer ato de serviço de que deva participar ou a que deva assistir', true),
    ('c8000000-0000-4000-8000-000000000004', 'c7000000-0000-4000-8000-000000000001', 'IV', 'permutar serviço sem autorização da autoridade competente', true),
    ('c8000000-0000-4000-8000-000000000005', 'c7000000-0000-4000-8000-000000000001', 'V', 'deixar de comunicar a alteração de dados de qualificação pessoal ou mudança de endereço residencial', true),
    ('c8000000-0000-4000-8000-000000000006', 'c7000000-0000-4000-8000-000000000001', 'VI', 'tomar parte em jogos proibidos ou jogar a dinheiro os permitidos, em local sob a administração policial militar ou em qualquer outro quando uniformizado', true),
    ('c8000000-0000-4000-8000-000000000007', 'c7000000-0000-4000-8000-000000000001', 'VII', 'não comunicar ao superior a execução de ordem recebida, tão logo seja possível', true),
    ('c8000000-0000-4000-8000-000000000008', 'c7000000-0000-4000-8000-000000000001', 'VIII', 'não transmitir ao seu sucessor as ordens em vigor, quando da passagem do serviço', true),
    ('c8000000-0000-4000-8000-000000000009', 'c7000000-0000-4000-8000-000000000001', 'IX', 'usar, quando uniformizado, barba, cabelo, bigode, costeleta ou adereço em desacordo com as disposições a respeito', true),
    ('c8000000-0000-4000-8000-000000000010', 'c7000000-0000-4000-8000-000000000001', 'X', 'usar a policial militar, quando uniformizada, penteado, maquilagem, unhas ou adereços em desacordo com as disposições a respeito', true),
    ('c8000000-0000-4000-8000-000000000011', 'c7000000-0000-4000-8000-000000000001', 'XI', 'representar a Corporação ou a OPM sem estar devidamente autorizado', true),
    ('c8000000-0000-4000-8000-000000000012', 'c7000000-0000-4000-8000-000000000001', 'XII', 'assumir compromisso pela Corporação sem estar devidamente autorizado', true),
    ('c8000000-0000-4000-8000-000000000013', 'c7000000-0000-4000-8000-000000000001', 'XIII', 'realizar transações comerciais ou pecuniárias dentro de unidade da Polícia Militar, exceto quando devidamente autorizado', true),
    ('c8000000-0000-4000-8000-000000000014', 'c7000000-0000-4000-8000-000000000001', 'XIV', 'entrar, permanecer ou sair de OPM em desacordo com as normas vigentes.', true),
    ('c8000000-0000-4000-8000-000000000015', 'c7000000-0000-4000-8000-000000000001', 'XV', 'ausentar-se do local de trabalho, sem autorização da autoridade competente, para tratar de assuntos estranhos ao serviço', true),
    ('c8000000-0000-4000-8000-000000000016', 'c7000000-0000-4000-8000-000000000001', 'XVI', 'utilizar os animais da Corporação em desacordo com as normas ou castigá-los inutilmente', true),
    ('c8000000-0000-4000-8000-000000000017', 'c7000000-0000-4000-8000-000000000002', 'XVII', 'transportar em viatura, aeronave ou embarcação que esteja sob seu comando ou responsabilidade pessoas e/ou materiais sem autorização da autoridade competente.', true),
    ('c8000000-0000-4000-8000-000000000018', 'c7000000-0000-4000-8000-000000000002', 'I', 'concorrer para a discórdia, desarmonia ou cultivar inimizade entre os policiais militares ou entre estes e os de outra Corporação', true),
    ('c8000000-0000-4000-8000-000000000019', 'c7000000-0000-4000-8000-000000000002', 'II', 'interferir na administração do serviço ou na execução de ordem ou missão sem ter a devida competência para tal, exceto para salvaguardar o interesse da Corporação', true),
    ('c8000000-0000-4000-8000-000000000020', 'c7000000-0000-4000-8000-000000000002', 'III', 'deixar de cumprir ou de fazer cumprir as normas, regulamentos ou instruções na esfera de suas atribuições', true),
    ('c8000000-0000-4000-8000-000000000021', 'c7000000-0000-4000-8000-000000000002', 'IV', 'omitir em boletim de ocorrência, relatório ou qualquer documento dados indispensáveis ao esclarecimento dos fatos', true),
    ('c8000000-0000-4000-8000-000000000022', 'c7000000-0000-4000-8000-000000000002', 'V', 'não comunicar ao superior imediato, ou na ausência deste a qualquer autoridade superior, toda informação que tiver sobre iminente perturbação da ordem pública ou grave alteração no serviço, logo que tenha conhecimento', true),
    ('c8000000-0000-4000-8000-000000000023', 'c7000000-0000-4000-8000-000000000002', 'VI', 'negar-se a receber documento ou processo que lhe for encaminhado por autoridade competente, exceto nos casos de impedimento justificável, hipótese em que deverá manifestar-se por escrito', true),
    ('c8000000-0000-4000-8000-000000000024', 'c7000000-0000-4000-8000-000000000002', 'VII', 'não encaminhar à autoridade competente, na linha de subordinação e no prazo legal, recurso ou documento que receber, desde que elaborado de acordo com os preceitos regulamentares, se não for de sua alçada a solução', true),
    ('c8000000-0000-4000-8000-000000000025', 'c7000000-0000-4000-8000-000000000002', 'VIII', 'apresentar parte ou recurso disciplinar sem ter seguido as normas e preceitos regulamentares, em termos desrespeitosos ou com argumentos falsos ou de má-fé', true),
    ('c8000000-0000-4000-8000-000000000026', 'c7000000-0000-4000-8000-000000000002', 'IX', 'dificultar ao subordinado a apresentação de recurso', true),
    ('c8000000-0000-4000-8000-000000000027', 'c7000000-0000-4000-8000-000000000002', 'X', 'retardar a execução de qualquer ordem recebida', true),
    ('c8000000-0000-4000-8000-000000000028', 'c7000000-0000-4000-8000-000000000002', 'XI', 'faltar a qualquer ato de serviço em que deva tomar parte ou assistir, quando prévia e nominalmente escalado', true),
    ('c8000000-0000-4000-8000-000000000029', 'c7000000-0000-4000-8000-000000000002', 'XII', 'trabalhar mal em serviço, instrução ou missão', true),
    ('c8000000-0000-4000-8000-000000000030', 'c7000000-0000-4000-8000-000000000002', 'XIII', 'simular doença para esquivar-se ao cumprimento do dever', true),
    ('c8000000-0000-4000-8000-000000000031', 'c7000000-0000-4000-8000-000000000002', 'XIV', 'afastar-se de qualquer lugar em que deva permanecer por força de disposição ou ordem legal', true),
    ('c8000000-0000-4000-8000-000000000032', 'c7000000-0000-4000-8000-000000000002', 'XV', 'utilizar inadequadamente, em desacordo com as normas técnicas, regulamentos ou instruções veículo automotor, aeronave, embarcação, animais, armamento ou equipamentos de qualquer natureza, pertencentes ao acervo da Polícia Militar', true),
    ('c8000000-0000-4000-8000-000000000033', 'c7000000-0000-4000-8000-000000000002', 'XVI', 'ausentar-se do posto sem fazer a passagem do serviço ao seu sucessor, ou antes do término do seu turno, sem autorização da autoridade competente', true),
    ('c8000000-0000-4000-8000-000000000034', 'c7000000-0000-4000-8000-000000000002', 'XVIII', 'violar ou deixar de preservar local de crime', true),
    ('c8000000-0000-4000-8000-000000000035', 'c7000000-0000-4000-8000-000000000002', 'XIX', 'não apresentar-se ao fim de afastamento temporário do serviço ou, ainda, logo que souber que o mesmo foi interrompido', true),
    ('c8000000-0000-4000-8000-000000000036', 'c7000000-0000-4000-8000-000000000002', 'XX', 'permanecer em dependência de outra OPM ou local de serviço sem consentimento ou ordem da autoridade competente', true),
    ('c8000000-0000-4000-8000-000000000037', 'c7000000-0000-4000-8000-000000000002', 'XXI', 'entrar ou sair com tropa da OPM, sem o prévio conhecimento da autoridade competente ou sem sua ordem', true),
    ('c8000000-0000-4000-8000-000000000038', 'c7000000-0000-4000-8000-000000000002', 'XXII', 'abrir qualquer dependência de OPM sem permissão da autoridade competente, salvo nos casos de emergência', true),
    ('c8000000-0000-4000-8000-000000000039', 'c7000000-0000-4000-8000-000000000002', 'XXIII', 'ter em seu poder ou introduzir em área sob administração policial militar material que atente contra a disciplina ou a moral', true),
    ('c8000000-0000-4000-8000-000000000040', 'c7000000-0000-4000-8000-000000000002', 'XXIV', 'utilizar subordinados para serviços não regulamentares', true),
    ('c8000000-0000-4000-8000-000000000041', 'c7000000-0000-4000-8000-000000000002', 'XXV', 'prestar, deliberadamente, informação falsa, errônea ou incompleta a superior, induzindo-o a erro', true),
    ('c8000000-0000-4000-8000-000000000042', 'c7000000-0000-4000-8000-000000000002', 'XXVI', 'dirigir-se à autoridade superior sem respeitar a cadeia de comando, para tratar de assuntos administrativos ou operacionais', true),
    ('c8000000-0000-4000-8000-000000000043', 'c7000000-0000-4000-8000-000000000002', 'XXVII', 'utilizar veículos oficiais para fins particulares ou não previstos em normas, regulamentos ou instruções', true),
    ('c8000000-0000-4000-8000-000000000044', 'c7000000-0000-4000-8000-000000000002', 'XXVIII', 'deixar de comunicar o extravio de documento de identidade policial militar', true),
    ('c8000000-0000-4000-8000-000000000045', 'c7000000-0000-4000-8000-000000000002', 'XXIX', 'deixar de apresentar a declaração de bens quando a norma assim o exigir', true),
    ('c8000000-0000-4000-8000-000000000046', 'c7000000-0000-4000-8000-000000000002', 'XXX', 'reter o preso, a vítima, as testemunhas ou demais partes envolvidas por mais tempo que o necessário para a solução de procedimento policial, administrativo ou penal', true),
    ('c8000000-0000-4000-8000-000000000047', 'c7000000-0000-4000-8000-000000000002', 'XXXI', 'permitir que pessoa não autorizada adentre a local interditado', true),
    ('c8000000-0000-4000-8000-000000000048', 'c7000000-0000-4000-8000-000000000002', 'XXXII', 'dormir durante o turno de serviço, quando isto não for permitido', true),
    ('c8000000-0000-4000-8000-000000000049', 'c7000000-0000-4000-8000-000000000002', 'XXXIII', 'desrespeitar regras de circulação de trânsito, de tráfego aéreo ou de navegação marítima, lacustre ou fluvial', true),
    ('c8000000-0000-4000-8000-000000000050', 'c7000000-0000-4000-8000-000000000002', 'XXXIV', 'autorizar, promover ou executar manobras perigosas com viaturas, aeronaves, embarcações ou animais', true),
    ('c8000000-0000-4000-8000-000000000051', 'c7000000-0000-4000-8000-000000000002', 'XXXV', 'recorrer a órgãos, pessoas ou instituições, exceto os previstos em lei, para resolver assuntos de interesse pessoal relacionados com a Polícia Militar', true),
    ('c8000000-0000-4000-8000-000000000052', 'c7000000-0000-4000-8000-000000000002', 'XXXVI', 'atrasar a entrega de processo administrativo, inquérito, sindicância ou outro procedimento apuratório', true),
    ('c8000000-0000-4000-8000-000000000053', 'c7000000-0000-4000-8000-000000000002', 'XXXVII', 'retirar de local sob administração policial militar material, viatura, aeronave, embarcação ou animal, ou deles servir-se sem ordem do responsável ou proprietário', true),
    ('c8000000-0000-4000-8000-000000000054', 'c7000000-0000-4000-8000-000000000002', 'XXXVIII', 'ingerir bebida alcoólica, quando uniformizado, em cafés, bares, restaurantes ou similares, exceto quando estiver representando a Corporação em evento social e, neste caso, sempre com moderação', true),
    ('c8000000-0000-4000-8000-000000000055', 'c7000000-0000-4000-8000-000000000003', 'XXXIX', 'dirigir-se de maneira desrespeitosa ou desatenciosa a subordinado, par 
ou superior hierárquico.', true),
    ('c8000000-0000-4000-8000-000000000056', 'c7000000-0000-4000-8000-000000000003', 'I', 'faltar à verdade, espalhar boatos ou utilizar-se do anonimato', true),
    ('c8000000-0000-4000-8000-000000000057', 'c7000000-0000-4000-8000-000000000003', 'II', 'filiar-se, quando na ativa, a partidos políticos, sindicatos, associações profissionais com caráter de sindicato ou associações cujos estatutos não estejam de conformidade com a lei', true),
    ('c8000000-0000-4000-8000-000000000058', 'c7000000-0000-4000-8000-000000000003', 'III', 'tomar parte, uniformizado, em manifestação de caráter político ou reivindicatório', true),
    ('c8000000-0000-4000-8000-000000000059', 'c7000000-0000-4000-8000-000000000003', 'IV', 'discutir ou promover discussão, por meio de qualquer veículo de comunicação, sobre assuntos estratégicos afetos à área da segurança pública', true),
    ('c8000000-0000-4000-8000-000000000060', 'c7000000-0000-4000-8000-000000000003', 'V', 'tomar parte em qualquer manifestação coletiva, seja ela de caráter reivindicatório, de crítica ou de apoio a atos de superior', true),
    ('c8000000-0000-4000-8000-000000000061', 'c7000000-0000-4000-8000-000000000003', 'VI', 'não providenciar a tempo, na esfera de suas atribuições, medidas contra irregularidade que tomar conhecimento', true),
    ('c8000000-0000-4000-8000-000000000062', 'c7000000-0000-4000-8000-000000000003', 'VII', 'divulgar informações reservadas ou fazer publicamente comentários que coloquem em descrédito o Governo ou a Corporação', true),
    ('c8000000-0000-4000-8000-000000000063', 'c7000000-0000-4000-8000-000000000003', 'VIII', 'desrespeitar os órgãos dos poderes constituídos ou qualquer um de seus membros, bem como criticar de maneira ofensiva, em público ou por meio dos canais de comunicação, seus atos ou decisões', true),
    ('c8000000-0000-4000-8000-000000000064', 'c7000000-0000-4000-8000-000000000003', 'IX', 'deixar de cumprir ordem recebida, embaraçar ou retardar a sua execução', true),
    ('c8000000-0000-4000-8000-000000000065', 'c7000000-0000-4000-8000-000000000003', 'X', 'deixar de assumir a responsabilidade por seus atos ou pelos atos praticados por subordinados quando decorrerem do cumprimento de sua ordem', true),
    ('c8000000-0000-4000-8000-000000000066', 'c7000000-0000-4000-8000-000000000003', 'XI', 'empregar força ou medida desnecessária em ato de serviço, ainda que não resulte dano', true),
    ('c8000000-0000-4000-8000-000000000067', 'c7000000-0000-4000-8000-000000000003', 'XII', 'ofender, provocar ou desafiar outro militar com atos, gestos ou palavras', true),
    ('c8000000-0000-4000-8000-000000000068', 'c7000000-0000-4000-8000-000000000003', 'XIII', 'deixar de assumir, orientar ou auxiliar no atendimento de ocorrência, quando esta, por sua natureza ou amplitude, assim o exigir', true),
    ('c8000000-0000-4000-8000-000000000069', 'c7000000-0000-4000-8000-000000000003', 'XIV', 'utilizar-se da condição de policial militar para obter facilidades pessoais de qualquer natureza ou para encaminhar negócios particulares ou de terceiros', true),
    ('c8000000-0000-4000-8000-000000000070', 'c7000000-0000-4000-8000-000000000003', 'XV', 'liberar preso ou dispensar pessoa envolvida em ocorrência sem competência legal para isso', true),
    ('c8000000-0000-4000-8000-000000000071', 'c7000000-0000-4000-8000-000000000003', 'XVI', 'na condição de testemunha, prestar declaração falsa ou calar-se em procedimento administrativo no âmbito da Corporação', true),
    ('c8000000-0000-4000-8000-000000000072', 'c7000000-0000-4000-8000-000000000003', 'XVII', 'fazer uso, estar de posse, sob ação ou induzir outrem ao uso de substância proibida por lei, ou introduzi-la em local sujeito a administração policial militar', true),
    ('c8000000-0000-4000-8000-000000000073', 'c7000000-0000-4000-8000-000000000003', 'XVIII', 'subtrair, extraviar, danificar ou inutilizar documentos de interesse da administração pública ou de terceiros', true),
    ('c8000000-0000-4000-8000-000000000074', 'c7000000-0000-4000-8000-000000000003', 'XIX', 'receber ou permitir que subordinado receba, a título de recompensa, em razão da função pública, qualquer objeto ou valor, mesmo quando oferecido pelo proprietário', true),
    ('c8000000-0000-4000-8000-000000000075', 'c7000000-0000-4000-8000-000000000003', 'XX', 'desrespeitar, desconsiderar ou ofender pessoa por meio de palavras, atos ou gestos, no atendimento de ocorrência policial ou em outras situações decorrentes do serviço', true),
    ('c8000000-0000-4000-8000-000000000076', 'c7000000-0000-4000-8000-000000000003', 'XXI', 'promover ou participar de luta corporal com outro militar', true),
    ('c8000000-0000-4000-8000-000000000077', 'c7000000-0000-4000-8000-000000000003', 'XXII', 'ausentar-se, sem prévia licença, por mais de 24 (vinte e quatro) horas, da unidade em que serve ou do local em que deveria permanecer ou apresentar-se por força de disposição ou ordem', true),
    ('c8000000-0000-4000-8000-000000000078', 'c7000000-0000-4000-8000-000000000003', 'XXIII', 'deixar de observar rigorosamente as normas pertinentes ao serviço, colocando em risco a segurança de pessoas ou instalações', true),
    ('c8000000-0000-4000-8000-000000000079', 'c7000000-0000-4000-8000-000000000003', 'XXIV', 'dar, por escrito ou verbalmente, ordem manifestamente ilegal, ainda que não chegue a ser cumprida', true),
    ('c8000000-0000-4000-8000-000000000080', 'c7000000-0000-4000-8000-000000000003', 'XXV', 'portar arma pertencente à Corporação fora dos casos previstos em norma', true),
    ('c8000000-0000-4000-8000-000000000081', 'c7000000-0000-4000-8000-000000000003', 'XXVI', 'esquivar-se de saldar dívidas ou de cumprir compromissos assumidos, mediante artifício, ardil ou qualquer outro meio fraudulento', true),
    ('c8000000-0000-4000-8000-000000000082', 'c7000000-0000-4000-8000-000000000003', 'XXVII', 'maltratar ou permitir que se maltrate preso sob sua guarda', true),
    ('c8000000-0000-4000-8000-000000000083', 'c7000000-0000-4000-8000-000000000003', 'XXVIII', 'desrespeitar, intencionalmente, as garantias constitucionais da pessoa no ato de sua prisão', true),
    ('c8000000-0000-4000-8000-000000000084', 'c7000000-0000-4000-8000-000000000003', 'XXIX', 'empregar violência física ou psicológica para obter informações durante o atendimento de ocorrência policial ou, ainda, no curso de investigação, ainda que esta não seja de caráter oficial', true),
    ('c8000000-0000-4000-8000-000000000085', 'c7000000-0000-4000-8000-000000000003', 'XXX', 'empregar arma ou equipamento em desacordo com a lei e os regulamentos, desde que o faça intencionalmente, para deter ou neutralizar a ação de infrator, causando-lhe, em razão do excesso, danos de qualquer natureza', true),
    ('c8000000-0000-4000-8000-000000000086', 'c7000000-0000-4000-8000-000000000003', 'XXXI', 'envolver-se com pessoas ligadas à prática de crimes, ainda que não tenha sido acusado ou não seja suspeito de praticá-los; (Redação dada pelo Decreto n° 14.852, de 13/01/2010)', true),
    ('c8000000-0000-4000-8000-000000000087', 'c7000000-0000-4000-8000-000000000003', 'XXXII', 'fazer ameaça a outro policial militar; (Redação dada pelo Decreto n° 14.852, de 13/01/2010)', true),
    ('c8000000-0000-4000-8000-000000000088', 'c7000000-0000-4000-8000-000000000003', 'XXXIII', 'disparar arma de fogo contra militar, ainda que não venha a produzir-lhe lesões ou causarlhe a morte', true),
    ('c8000000-0000-4000-8000-000000000089', 'c7000000-0000-4000-8000-000000000003', 'XXXIV', 'causar danos ao patrimônio de outro militar', true),
    ('c8000000-0000-4000-8000-000000000090', 'c7000000-0000-4000-8000-000000000003', 'XXXV', 'fazer publicamente declaração que ofenda, perante a sociedade ou parte dela, o Estado, suas instituições ou os chefes dos poderes Executivo, Legislativo e Judiciário ou quem os represente', true),
    ('c8000000-0000-4000-8000-000000000091', 'c7000000-0000-4000-8000-000000000003', 'XXXVI', 'ingerir bebida alcoólica quando em serviço ou apresentar-se alcoolizado para prestá-lo', true),
    ('c8000000-0000-4000-8000-000000000092', 'c7000000-0000-4000-8000-000000000003', 'XXXVII', 'recusar-se a receber ou devolver insígnia, medalha ou diploma que lhe tenha sido outorgado ou cassado; e', true),
    ('c8000000-0000-4000-8000-000000000093', 'c7000000-0000-4000-8000-000000000003', 'XXXVIII', 'exercer, o policial militar da ativa, atividade remunerada, exceto as previstas em lei.', true),
    ('c8000000-0000-4000-8000-000000000094', 'c7000000-0000-4000-8000-000000000002', 'XLIII', 'chegar atrasado à atividade para a qual esteja escalado', true),
    ('c8000000-0000-4000-8000-000000000095', 'c7000000-0000-4000-8000-000000000002', 'XXXIX', 'exercer qualquer atividade incompatível com os motivos do afastamento, estando o policial militar dispensado ou licenciado para tratamento de saúde própria ou de dependente', true)
ON CONFLICT DO NOTHING;

-- 10. Infracoes penais (26 artigos, de 27 no legado). O `tipo`
--     Crime/Contravencao do legado virou FK para especies_infracao_penal.
--     Descartada(s) 1 linha(s) duplicada(s) na chave unica
--     (dispositivo, artigo, paragrafo, inciso, alinea): art. 42 da LCP estava
--     cadastrado duas vezes com o mesmo texto. Preservada a versao ativa.
INSERT INTO infracoes_penais
    (id, dispositivo_legal_id, especie_id, artigo, descricao, paragrafo, inciso, alinea, ativo) VALUES
    ('87d1f65b-2c73-4836-84a8-3e169e0d6238', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '121', 'Matar alguém', NULL, NULL, NULL, true),
    ('99ebeba5-89d5-4866-9b9a-16907d655414', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '121', 'Matar alguem', '1º', NULL, NULL, true),
    ('4ea511e0-1211-4684-8c97-c746dda151c8', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '121', 'Matar alguem', '2º', 'VII', 'b', true),
    ('6da9979a-04c9-4fec-9c7c-f85155b8650c', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '121', 'Matar alguem', '2º', 'II', NULL, true),
    ('f861d1d1-810f-445f-a7c0-c76014999b12', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '155', 'Subtrair, para si ou para outrem, coisa alheia móvel', NULL, NULL, NULL, true),
    ('6eba9def-5c9d-43a5-bc6f-fb857762d2a3', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '157', 'Subtrair coisa móvel alheia, para si ou para outrem, mediante grave ameaça ou violência à pessoa, ou depois de havê-la, por qualquer meio, reduzido à impossibilidade de resistência', NULL, NULL, NULL, true),
    ('c33c5cb6-3eba-4ae1-87bc-db53f952859c', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '213', 'Constranger alguém, mediante violência ou grave ameaça, a ter conjunção carnal ou a praticar ou permitir que com ele se pratique outro ato libidinoso', NULL, NULL, NULL, true),
    ('aec37341-7315-4634-9bd6-9f163406b352', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '312', 'Apropriar-se o funcionário público de dinheiro, valor ou qualquer outro bem móvel, público ou particular, de que tem a posse em razão do cargo, ou desviá-lo, em proveito próprio ou alheio', NULL, NULL, NULL, true),
    ('2e57a26f-4742-4025-915d-90b7d5ea636e', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '317', 'Solicitar ou receber, para si ou para outrem, direta ou indiretamente, ainda que fora da função ou antes de assumi-la, mas em razão dela, vantagem indevida, ou aceitar promessa de tal vantagem', NULL, NULL, NULL, true),
    ('3f9c89e1-b6e1-46ba-894a-1edaa1838f4a', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '329', 'Opor-se à execução de ato legal, mediante violência ou ameaça a funcionário competente para executá-lo ou a quem lhe esteja prestando auxílio', NULL, NULL, NULL, true),
    ('8d543da8-1da0-494b-bee7-fcb9acea4134', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '331', 'Desacato - ', NULL, NULL, NULL, true),
    ('0af78b20-07c9-43d1-8253-30415986cb5a', 'c3000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000002', '163', 'Recusar obedecer a ordem do superior sôbre assunto ou matéria de serviço, ou relativamente a dever impôsto em lei, regulamento ou instrução.', NULL, NULL, NULL, true),
    ('6faa63e9-e41d-4e25-964a-7b553e12e0a1', 'c3000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000002', '164', 'Opor-se às ordens da sentinela', NULL, NULL, NULL, true),
    ('2a7a72ae-530f-4ce6-8978-c375023461dc', 'c3000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000002', '165', 'Promover a reunião de militares, ou nela tomar parte, para discussão de ato de superior ou assunto atinente à disciplina militar.', NULL, NULL, NULL, true),
    ('032654e8-f4da-4c30-adc9-c525c09a810e', 'c3000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000002', '303', 'Praticar lesão corporal culposa na direção de veículo automotor', NULL, NULL, NULL, true),
    ('f41173fc-ba86-4851-a111-84978e1f8ba6', 'c3000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000002', '306', 'Conduzir veículo automotor com capacidade psicomotora alterada em razão da influência de álcool ou de outra substância psicoativa que determine dependência', NULL, NULL, NULL, true),
    ('50a1bb85-94e6-431e-8e71-69b2aa66913c', 'c3000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000001', '21', 'Praticar vias de fato contra alguém', NULL, NULL, NULL, true),
    ('e5979c9a-fb7a-456a-ad0c-57eaab9a6fc3', 'c3000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000001', '47', 'Exercício ilegal de profissão ou atividade - Exercer profissão ou atividade econômica ou anunciar que a exerce, sem preencher as condições a que por lei está subordinado o seu exercício', NULL, NULL, NULL, true),
    ('7d23cad3-c666-4ed7-af92-8e249e3d078c', 'c3000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000001', '65', 'Perturbação do trabalho ou do sossego alheios - Molestar alguém ou perturbar-lhe a tranquilidade, por acinte ou por motivo reprovável', NULL, NULL, NULL, true),
    ('fb66575a-90aa-47f8-b98c-ff34fde80069', 'c3000000-0000-4000-8000-000000000004', 'c4000000-0000-4000-8000-000000000001', '42', 'Perturbar alguem o trabalho ou o sossego alheios', NULL, NULL, NULL, true),
    ('a8e21b6f-4ae6-40db-a217-e0b26e3c5dce', 'c3000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000002', '196', 'Deixar o militar de desempenhar a missão que lhe foi confiada.', NULL, NULL, NULL, true),
    ('ea53c242-52c3-4193-8799-adb54c1cf6da', 'c3000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000002', '312', 'Omitir, em documento público ou particular, declaração que dêle devia constar, ou nêle inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sôbre fato jurìdicamente relevante, desde que o fato atente contra a administração ou o serviço militar.', NULL, NULL, NULL, true),
    ('98ceb23e-a47e-4282-9219-2d668d23985c', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '147', 'Ameaçar alguém, por palavra, escrito ou gesto, ou qualquer outro meio simbólico, de causar-lhe mal injusto e grave.', NULL, NULL, NULL, true),
    ('d00b990b-d68e-43bf-a226-bab1e10f379c', 'c3000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002', '129', 'Lesão corporal - Ofender a integridade corporal ou a saúde de outrem', NULL, NULL, NULL, false),
    ('0d4491e8-f49e-49af-8897-1b4f9a92802d', 'c3000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000002', '302', 'Praticar homicídio culposo na direção de veículo automotor', NULL, NULL, NULL, false),
    ('59f749ad-237c-43ad-89bd-1254c89dcce0', 'c3000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000002', '309', 'Dirigir veículo automotor, em via pública, sem a devida Permissão para Dirigir ou Carteira de Habilitação', NULL, NULL, NULL, false)
ON CONFLICT DO NOTHING;

-- 11. Infracoes do Estatuto (20 incisos do art. 29, de 23 no legado).
--     A tabela funde os antigos _art29 e _art32: o artigo virou coluna.
--     Descartadas 3 linhas de teste, todas ja inativas e todas no
--     inciso "LX" (textos como "Brigar na rua com velhos teste").
INSERT INTO infracoes_estatuto (id, dispositivo_legal_id, artigo, inciso, texto, ativo) VALUES
    ('34db7b7d-2cfc-4b9e-a553-c43d6fe42dae', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'I', 'amar a verdade e a responsabilidade como fundamentos da dignidade pessoal', true),
    ('1e79f383-df95-495f-acd7-c3602608c595', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'II', 'exercer, com autoridade, eficiência e probidade, as funções que lhe couberem em decorrência do cargo', true),
    ('8c872579-9d65-4662-a9ff-e123e4b6aab0', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'III', 'respeitar a dignidade da pessoa humana', true),
    ('490300d1-ae25-4185-ba46-f8e67b7f5e6b', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'IV', 'cumprir e fazer cumprir as leis, os regulamentos, as instruções e as ordens das autoridades competentes', true),
    ('cc0fdfcc-c5b2-4e31-a874-e3aace071070', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'V', 'ser justo e imparcial, nos julgamentos dos atos e na apreciação do mérito dos subordinados', true),
    ('c19af374-03a5-4e76-adf5-9d91ed74db7d', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'VI', 'zelar pelo preparo próprio, moral, intelectual e físico, e, também, pelo dos subordinados, tendo em vista o cumprimento da missão comum', true),
    ('43d69220-0d2a-4e37-b070-b4dc92479c7b', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'VII', 'empregar todas as suas energias em benefício do serviço', true),
    ('4ba13658-190d-4fd4-bde5-d973775197d8', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'VIII', 'praticar a camaradagem e desenvolver, permanentemente, o espírito de cooperação', true),
    ('01457ed9-67a9-4f2f-917f-0a55c7222dec', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'IX', 'ser discreto em suas atitudes e maneiras, e em sua linguagem escrita e falada', true),
    ('a7908759-6976-474b-8d06-8d75b991f3ad', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'X', 'abster-se de tratar, fora do âmbito apropriado, de matéria relativa à Segurança Nacional, seja de caráter sigiloso ou não', true),
    ('8eba83e2-c58a-4f63-adaf-95ea0013b7e6', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XI', 'acatar as autoridades constituídas', true),
    ('3a95e469-079e-40f1-beea-2c3477cddeb7', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XII', 'cumprir seus deveres de cidadão', true),
    ('10a98220-a1d6-4e90-886a-589a638d7ba6', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XIII', 'proceder de maneira ilibada na vida pública e particular', true),
    ('7b1d47d4-e0cc-4c93-8b14-00a59ad07197', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XIV', 'observar as normas de boa educação', true),
    ('bf8d1b66-6661-4c21-a0f1-de70c150f413', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XV', 'garantir assistência moral e material ao seu lar e conduzir-se como chefe de família modelar', true),
    ('8e2fca70-0d66-4963-b47b-5219b435fca2', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XVI', 'conduzir-se, mesmo fora do serviço, ou na inatividade, de modo que não sejam prejudicados os princípios da disciplina, do respeito e do decoro policial-militar', true),
    ('d8957c51-776b-43d6-9b7d-4c9b1d5ce3d5', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XVII', 'abster-se de fazer uso do posto, ou graduação, para obter facilidades pessoais de qualquer natureza, ou para encaminhar negócios particulares ou de terceiros', true),
    ('9254a3ba-c6da-4f02-90b9-bd98b3914083', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XVIII', 'abster-se o Militar do Estado, na inatividade, do uso das designações hierárquicas quando: a) em atividade político-partidária; b) em atividades comerciais; c) em atividades industriais; d) para discutir ou provocar discussões pela imprensa a respeito de assuntos políticos ou policiais-militares, excetuando-se as de natureza exclusivamente técnica, se devidamente autorizado; e) no exercício de funções de natureza não Militar do Estado, mesmo oficiais', true),
    ('9bfd9917-68a5-4963-b5ef-e34c6a3a05e2', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'XIX', 'zelar pelo bom nome da Polícia Militar e de cada um dos seus integrantes, obedecendo e fazendo obedecer aos preceitos da ética policial-militar', true),
    ('43a5ef96-4d38-4d76-9f15-dcbee3099fa2', 'c3000000-0000-4000-8000-000000000005', 'Art. 29', 'C', 'TESTETSTETSTETST', false)
ON CONFLICT DO NOTHING;

