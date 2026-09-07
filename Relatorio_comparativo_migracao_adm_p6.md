# Relatório comparativo dos bancos ADM-P6

## 1. Escopo e conclusão executiva

Foram comparados integralmente os dumps:

- `adm-p6(1).sql`: aplicação desktop antiga em Python/Eel, PostgreSQL 16.10, exportado em 13/05/2026;
- `adm_p6_normalized.sql`: aplicação Rust/Tauri, PostgreSQL 16.14.

O segundo dump contém dois esquemas distintos:

- `public`: modelo normalizado da aplicação Rust/Tauri;
- `legado`: cópia de segurança operacional do modelo antigo, criada para apoiar a migração.

O esquema `legado` contém as mesmas 24 tabelas e as mesmas quantidades de registros do dump antigo, além da tabela auxiliar `map_papeis`. A comparação de conteúdo confirmou igualdade integral em todas as tabelas, exceto por uma diferença de representação de fuso horário em `processos_procedimentos.pdf_upload_em`, sem perda do registro. Portanto, a migração pode ser executada diretamente de `legado.*` para `public.*`, sem precisar reimportar o arquivo antigo.

O esquema novo é substancialmente melhor modelado: usa `uuid`, chaves estrangeiras, tabelas associativas, restrições de unicidade, datas com fuso horário, catálogos configuráveis, histórico de designações, anexos separados, vítimas em relação 1:N, prazos calculados e soluções por envolvido.

### Decisões confirmadas para a migração

1. Excluir os sete processos de teste existentes no modelo novo antes da migração, juntamente com os dados transacionais dependentes.
2. Quando uma solução antiga pertencer a processo com vários envolvidos, atribuir a mesma solução a todos os envolvidos.
3. Os papéis `Escrivão` e `Escrivão de Processo` são distintos e ambos continuam existindo.
4. O antigo `escrivao_processo_id` será migrado somente para o papel `Escrivão de Processo`; o papel `Escrivão` ficará vazio quando não houver informação no legado.
5. Três vínculos do art. 29 sem analogia registrada receberão provisoriamente uma transgressão ativa do RDPM escolhida de modo determinístico, apenas para evitar o bloqueio da FK obrigatória. Eles deverão ser corrigidos manualmente após a migração.

## 2. Inventário dos dados

### 2.1 Legado preservado dentro do dump novo

| Tabela | Registros |
|---|---:|
| `legado.processos_procedimentos` | 128 |
| `legado.usuarios` | 236 |
| `legado.procedimento_pms_envolvidos` | 156 |
| `legado.prazos_processo` | 141 |
| `legado.auditoria` | 448 |
| `legado.mapas_salvos` | 107 |
| `legado.transgressoes` | 95 |
| `legado.municipios_distritos` | 112 |
| `legado.crimes_contravencoes` | 27 |
| `legado.infracoes_estatuto_art29` | 23 |
| `legado.pm_envolvido_indicios` | 22 |
| `legado.pm_envolvido_rdpm` | 11 |
| `legado.pm_envolvido_crimes` | 12 |
| `legado.pm_envolvido_art29` | 3 |

As demais tabelas do legado são catálogos ou tabelas técnicas.

### 2.2 Dados existentes no modelo normalizado

| Grupo | Quantidade atual |
|---|---:|
| Processos de teste | 7 |
| Envolvidos de teste | 8 |
| Designações de teste | 11 |
| Prazos de teste | 9 |
| Vítimas de teste | 4 |
| Pessoas inquiridas de teste | 1 |
| Andamentos de teste | 1 |
| Mapa salvo de teste | 1 |
| Policiais militares | 236 |
| Usuários autenticáveis | 8 |
| Municípios e distritos | 112 |
| Transgressões | 95 |
| Infrações penais | 26 |
| Infrações do Estatuto | 20 |

Os sete processos novos não coincidem com os antigos por ID, número SEI ou RGF. Contudo, três colidem com registros reais nas restrições de numeração:

- SR nº 1/7ºBPM/2026;
- SR nº 2/7ºBPM/2026;
- PADS nº 1/7ºBPM/2026.

Isso confirma que os testes devem ser removidos antes da carga dos processos reais.

## 3. Dicionário do modelo normalizado

### 3.1 `processos_procedimentos`

Tabela central. Agora contém somente atributos próprios do processo; pessoas, envolvidos, designações, prazos, anexos, soluções e andamentos foram distribuídos em tabelas relacionadas.

| Coluna | Tipo | Finalidade |
|---|---|---|
| `id` | `uuid` | PK gerada por `gen_random_uuid()`. Os UUIDs antigos podem ser preservados. |
| `apuratorio_id` | `uuid` | Espécie concreta: SR, IPM, PADS, CD etc. FK para `apuratorios`. |
| `documento_iniciador_id` | `uuid` | FK para `tipos_documento`. A FK composta também garante que o documento é permitido para o apuratório. |
| `numero_documento` | `text` | Número da portaria, memorando ou feito preliminar. Obrigatório. |
| `numero_controle` | `text` | Numeração interna do apuratório. Pode ser diferente do documento. |
| `processo_sei` | `text` | Número do processo SEI. |
| `numero_rgf` | `text` | Registro Geral de Feitos. |
| `unidade_origem_id` | `uuid` | FK para `unidades_pm`. Substitui `local_origem`. |
| `subunidade_secao_origem_id` | `uuid` | FK composta para uma seção/subunidade pertencente à unidade informada. Não existia no legado. |
| `municipio_fato_id` | `uuid` | FK para `municipios_distritos`. Substitui `local_fatos`. |
| `natureza_fato_id` | `uuid` | FK para `naturezas_fato`. Substitui `natureza_procedimento`. |
| `data_instauracao` | `date` | Data obrigatória de instauração. |
| `data_recebimento` | `date` | Data de recebimento. |
| `data_remessa_encarregado` | `date` | Remessa ao encarregado. |
| `data_remessa_comissao` | `date` | Nova informação para apuratórios que tramitam por comissão. |
| `data_julgamento` | `date` | Data do julgamento. |
| `data_conclusao` | `date` | Data de conclusão; substitui o par redundante `concluido` + `data_conclusao`. |
| `resumo_fatos` | `text` | Síntese dos fatos. |
| `ativo` | `boolean` | Exclusão lógica, obrigatório e padrão `true`. |
| `created_at` | `timestamptz` | Criação com fuso horário. |
| `updated_at` | `timestamptz` | Última alteração com fuso horário. |

Restrições cronológicas impedem recebimento, remessa, julgamento ou conclusão em ordem temporal inválida. Dois índices únicos impedem duplicidade de número de controle e de documento dentro da unidade, subunidade, ano e apuratório.

### 3.2 Classificação dos apuratórios

#### `tipos_apuratorio`

- `id uuid`: PK;
- `nome text`: grupo geral (`Procedimento` ou `Processo`);
- `ativo boolean`: disponibilidade;
- `created_at`, `updated_at timestamptz`: auditoria temporal.

Substitui o texto `tipo_geral`.

#### `apuratorios`

- `id uuid`: PK;
- `sigla`, `nome`: código e nome da espécie;
- `tipo_apuratorio_id`: FK para o grupo geral;
- `prazo_base_dias`: prazo padrão;
- `max_envolvidos`: limite opcional de envolvidos;
- `exige_natureza_fato`: controla obrigatoriedade funcional da natureza;
- `codigo_extensao`: liga comportamentos especializados, como Carta Precatória;
- `permite_julgamento`, `permite_punicao`, `permite_remessa_comissao`, `permite_acusacao`, `permite_acusacao_penal`, `permite_indicios`, `permite_solucao_sugerida`, `permite_cadastro_vitima`: capacidades configuráveis da espécie;
- `ordem`: posição de exibição;
- `ativo`, `created_at`, `updated_at`: estado e datas.

Há dez espécies: PADE, CD, CJ, PAD, CP, FP, SV, SR, IPM e PADS. Essa estrutura substitui `tipo_detalhe` e torna o comportamento configurável.

#### `tipos_documento`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Possui Portaria, Memorando Disciplinar e Feito Preliminar.

#### `apuratorio_documentos_iniciadores`

- `apuratorio_id`, `tipo_documento_id`: PK composta e FKs;
- `prazo_base_dias`: prazo específico da combinação;
- `padrao`: documento padrão do apuratório;
- `ativo`, `created_at`, `updated_at`: controle.

Garante que, por exemplo, PADS use Memorando Disciplinar e FP use Feito Preliminar.

### 3.3 Policiais, postos e usuários

#### `policiais_militares`

- `id uuid`: PK; para 234 militares foi preservado o antigo `usuarios.id`;
- `matricula`, `nome`: identificação funcional;
- `posto_graduacao_id`: FK para `postos_graduacoes`;
- `is_encarregado`: habilitação para designação;
- `ativo`, `created_at`, `updated_at`: estado e datas.

Separa a pessoa militar da conta de acesso.

#### `usuarios`

- `id uuid`: PK da conta;
- `policial_militar_id`: FK opcional para o militar e `UNIQUE`;
- `nome_exibicao`: nome para usuário não militar;
- `email`: login obrigatório e único sem diferenciar maiúsculas;
- `senha_hash`: hash obrigatório e explicitamente nomeado;
- `perfil_id`: FK para `perfis_acesso`;
- `ativo`, `created_at`, `updated_at`: controle.

Os sete e-mails antigos já aparecem no novo cadastro. Há uma conta adicional criada no ambiente novo.

#### `perfis_acesso`

Campos `id`, `nome`, `pode_administrar`, `ativo`, `created_at` e `updated_at`. Substitui o texto livre `perfil` e os usos de `is_operador`.

#### `circulos_hierarquicos`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Possui Oficiais, Praças e Civil.

#### `postos_graduacoes`

Campos `id`, `sigla`, `nome`, `circulo_hierarquico_id`, `ativo`, `created_at` e `updated_at`. Substitui `codigo`, `descricao`, `tipo` e `ordem_hierarquica`; o círculo agora é uma FK.

O novo catálogo contém os 12 postos antigos e acrescenta Aspirante a Oficial e Usuário Civil.

### 3.4 Unidades e localidades

#### `municipios_distritos`

- `id`, `nome`: identificação;
- `municipio_pai_id`: autorrelacionamento por FK;
- `e_distrito`: substitui o texto `tipo`;
- `ativo`, `created_at`, `updated_at`: controle.

Checks obrigam distrito a possuir município-pai, proíbem município comum de ter pai e impedem autorreferência. Os 112 IDs antigos foram preservados.

#### `unidades_pm`

Campos `id`, `nome`, `municipio_id`, `ativo`, `created_at` e `updated_at`. Substitui `locais_origem` e admite localização da unidade.

#### `subunidades_secoes`

Campos `id`, `unidade_pm_id`, `nome`, `ativo`, `created_at` e `updated_at`. É uma informação nova. A unicidade é por unidade + nome.

### 3.5 Envolvidos e resultados

#### `status_envolvido`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Normaliza Acusado, Indiciado, Investigado e Sindicado.

#### `processo_envolvidos`

- `id`: PK;
- `processo_id`: FK para o processo;
- `policial_militar_id`: FK opcional; `NULL` representa “À apurar”;
- `status_envolvido_id`: FK para o status;
- `ordem`: ordem obrigatória, única por processo;
- `e_condutor`: identifica o único condutor do processo;
- `solucao_sugerida_id`: FK opcional;
- `solucao_decidida_id`: FK opcional;
- `penalidade_tipo_id`, `penalidade_dias`: sanção individual;
- `created_at`, `updated_at`: datas.

Substitui `procedimento_pms_envolvidos`, `nome_pm_id`, `status_pm`, `motorista_id`, `solucao_tipo`, `penalidade_tipo` e `penalidade_dias`.

#### `tipos_solucao_sugerida`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Valores: Arquivamento, IPM e Sindicância.

#### `tipos_solucao_decidida`

Campos `id`, `nome`, `permite_penalidade`, `ativo`, `created_at` e `updated_at`. Valores: Punido, Arquivado, Homologado, Absolvido e Avocado.

#### `tipos_penalidade`

Campos `id`, `nome`, `usa_quantidade_dias`, `ativo`, `created_at` e `updated_at`. Normaliza Prisão, Detenção, Repreensão, Licenciamento e Exclusão.

### 3.6 Designações e substituições

#### `papeis_processo`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Possui Encarregado, Presidente, Interrogante, Escrivão e Escrivão de Processo.

#### `apuratorio_papeis`

- `apuratorio_id`, `papel_id`: PK composta;
- `obrigatorio`: exigência funcional;
- `max_ocupantes`: limite simultâneo;
- `e_responsavel`: indica qual papel representa o responsável do apuratório;
- `usa_documento_designacao`: controla se a designação cita documento;
- `ativo`, `created_at`, `updated_at`: controle.

#### `processo_designacoes`

- `id`: PK;
- `processo_id`, `apuratorio_id`: FK composta que impede designação para espécie diferente da do processo;
- `policial_militar_id`: FK para o ocupante;
- `papel_id`: FK por meio da configuração do apuratório;
- `data_inicio`, `data_fim`: período da designação;
- `documento_autorizador_id`, `numero_documento`: documento de designação;
- `motivo`: justificativa da substituição;
- `designacao_anterior_id`: autorrelacionamento que forma a cadeia histórica;
- `created_at`, `updated_at`: datas.

Funções e triggers exigem continuidade entre designações sucessivas, troca efetiva de ocupante, mesmo processo/papel, limite de ocupantes e ausência de sobreposição.

### 3.7 Pessoas, vítimas e Carta Precatória

#### `papeis_pessoa`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Atualmente contém Pessoa Inquirida; o papel Vítima está inativo porque vítimas receberam tabela própria.

#### `processo_pessoas`

Campos `id`, `processo_id`, `papel_pessoa_id`, `nome`, `ordem` e `created_at`. Substitui o JSON textual `pessoas_inquiridas`.

#### `processo_vitimas`

Campos `id`, `processo_id`, `nome`, `ordem` e `created_at`. Permite qualquer quantidade de vítimas ou ofendidos e aceita inclusive pessoa jurídica. Substitui o único texto `nome_vitima`.

#### `carta_precatoria_detalhes`

- `processo_id`: PK e FK com exclusão em cascata;
- `deprecante`: texto da autoridade deprecante;
- `unidade_deprecada_id`: FK para `unidades_pm`;
- `created_at`, `updated_at`: datas.

Substitui `unidade_deprecada` e `deprecante` da tabela central.

### 3.8 Prazos

#### `processo_prazos`

- `id`, `processo_id`: identificação e FK;
- `ordem`: zero para prazo inicial e valores seguintes para prorrogações;
- `data_inicio`: início do período;
- `dias`: duração positiva;
- `data_vencimento`: coluna gerada como `data_inicio + dias`;
- `motivo`: obrigatório funcionalmente para ordem maior que zero;
- `documento_autorizador_id`, `numero_documento`, `data_documento`: dados do ato autorizador;
- `autoridade_id`: FK para `policiais_militares`;
- `created_at`, `updated_at`: datas.

Uma restrição GiST proíbe sobreposição de períodos e uma restrição única impede duas ordens iguais no mesmo processo.

### 3.9 Andamentos e anexos

#### `tipos_andamento`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`.

#### `processo_andamentos`

Campos `id`, `processo_id`, `tipo_andamento_id`, `descricao`, `ocorrido_em`, `registrado_por_id`, `cancelado_em` e `created_at`. Substitui o JSONB `andamentos` e permite cancelamento lógico.

#### `processo_anexos`

Campos `id`, `processo_id`, `nome_arquivo`, `mime_type`, `conteudo`, `enviado_por_id`, `cancelado_em` e `created_at`. Substitui os cinco campos `pdf_*` da tabela central e permite vários anexos.

### 3.10 Naturezas e legislação

#### `naturezas_fato`

Campos `id`, `nome`, `exige_condutor`, `ativo`, `created_at` e `updated_at`. Seus 16 registros correspondem exatamente às naturezas realmente usadas em `natureza_procedimento`; as duas naturezas de sinistro exigem condutor.

#### `naturezas_transgressao`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Normaliza Leve, Média e Grave.

#### `artigos_rdpm`

Campos `id`, `artigo`, `natureza_transgressao_id`, `ativo`, `created_at` e `updated_at`. Relaciona os arts. 15, 16 e 17 às respectivas naturezas.

#### `transgressoes`

Campos `id uuid`, `artigo_rdpm_id`, `inciso`, `texto`, `ativo`, `created_at` e `updated_at`. Substitui o ID inteiro, o número de artigo e a gravidade repetidos em cada linha.

#### `categorias_indicio`

Campos `id`, `nome`, `indica_ausencia`, `ativo`, `created_at` e `updated_at`. Normaliza as quatro categorias antigas e distingue “Não houve indícios”.

#### `envolvido_categorias_indicio`

PK composta por `envolvido_id` e `categoria_indicio_id`, mais `created_at`. Substitui `categorias_indicios` JSONB e `categoria` textual.

#### `dispositivos_legais`

Campos `id`, `nome`, `e_estatuto_militar`, `nome_feminino`, `ativo`, `created_at` e `updated_at`. Separa o diploma legal da infração e permite identificar o Estatuto dos Policiais Militares.

#### `especies_infracao_penal`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Possui Crime e Contravenção Penal.

#### `esferas_penais`

Campos `id`, `nome`, `ativo`, `created_at` e `updated_at`. Possui Militar e Comum.

#### `infracoes_penais`

Campos `id`, `dispositivo_legal_id`, `especie_id`, `artigo`, `descricao`, `paragrafo`, `inciso`, `alinea`, `ativo`, `created_at` e `updated_at`. Substitui `crimes_contravencoes` sem repetir nomes do diploma e da espécie.

#### `envolvido_infracoes_penais`

PK composta por `envolvido_id` e `infracao_penal_id`, com `esfera_penal_id` e `created_at`. A esfera é Militar para CPM e Comum para os demais diplomas.

#### `infracoes_estatuto`

Campos `id`, `dispositivo_legal_id`, `artigo`, `inciso`, `texto`, `ativo`, `created_at` e `updated_at`. Generaliza a antiga tabela limitada ao art. 29.

#### `envolvido_infracoes_estatuto`

PK composta por `envolvido_id` e `infracao_estatuto_id`, mais `analogia_transgressao_id` obrigatória e `created_at`. Normaliza o enquadramento do Estatuto e sua analogia no RDPM.

#### `envolvido_transgressoes`

PK composta por `envolvido_id` e `transgressao_id`, mais `created_at`. Substitui as tabelas antigas `pm_envolvido_rdpm` e parte do JSON textual `transgressoes_ids`.

### 3.11 Mapas e auditoria

#### `mapas_salvos`

Campos `id`, `titulo`, `apuratorio_id`, `periodo_inicio`, `periodo_fim`, `total_processos`, `total_concluidos`, `total_andamento`, `gerado_por_id`, `dados_mapa`, `ativo`, `created_at` e `updated_at`.

Foram removidas as duplicações `periodo_descricao` e `usuario_nome` e os campos de PDF. O tipo textual foi substituído por FK opcional: `NULL` pode representar mapa completo.

#### `auditoria`

Campos `id`, `entidade`, `registro_id`, `operacao`, `usuario_id`, `alteracoes jsonb`, `ocorrido_em`, `acao` e `assunto`. Além da operação, o modelo novo pode guardar diferenças, frase da ação e descrição histórica do objeto.

#### `_sqlx_migrations`

Campos `version`, `description`, `installed_on`, `success`, `checksum` e `execution_time`. É a tabela técnica do SQLx/Rust e substitui Alembic e `schema_migrations` no esquema operacional.

## 4. Mapeamento de migração

| Origem antiga | Destino normalizado | Regra principal |
|---|---|---|
| `usuarios` | `policiais_militares` | Usar matrícula; preservar ID dos 234 militares reais. Não criar PM para o administrador artificial nem para “À apurar”. |
| `usuarios` com credencial | `usuarios` + `perfis_acesso` | Associar à conta pelo PM e mapear `admin/comum`. Os sete e-mails antigos já existem. |
| `postos_graduacoes` | `postos_graduacoes` + `circulos_hierarquicos` | Mapear `codigo` para `sigla`. |
| `municipios_distritos` | `municipios_distritos` | Já migrado com IDs preservados; trocar nome do pai por FK. |
| `locais_origem` e valores dos processos | `unidades_pm` | Mapear por código/nome normalizado; os quatro valores usados pelos processos já possuem destino. |
| `tipo_geral` + `tipo_detalhe` | `tipos_apuratorio` + `apuratorios` | Mapear pelas siglas das dez espécies. |
| `documento_iniciador` | `tipos_documento` | Mapear por nome. |
| `numero_portaria`, `numero_memorando`, `numero_feito` | `numero_documento` | Escolher a coluna conforme o documento iniciador. Todos os 128 possuem valor. |
| `numero`/`numero_controle` | `numero_controle` | Preferir `numero_controle`, com fallback para `numero`. |
| `local_fatos` | `municipio_fato_id` | Mapear pelo nome; quatro nomes compostos exigem remoção do município entre parênteses. |
| `natureza_procedimento` | `natureza_fato_id` | Mapear por nome exato. Todas as 88 naturezas preenchidas têm destino. |
| `nome_pm_id` + `procedimento_pms_envolvidos` | `processo_envolvidos` | Formar a união sem duplicatas; `nome_pm_id` garante o principal nos 37 processos em que ele não estava na associativa. |
| PM “À apurar” | `processo_envolvidos.policial_militar_id = NULL` | Não migrar o registro artificial como policial. |
| `motorista_id` | `processo_envolvidos.e_condutor` | Marcar o envolvido correspondente; criar o vínculo se necessário. |
| `status_pm` | `status_envolvido_id` | Mapear por nome. |
| `solucao_tipo` | soluções sugerida/decidida | `Sugerido_*` vai para sugerida; demais valores para decidida; aplicar a todos os envolvidos, conforme decisão. |
| `penalidade_tipo`/`penalidade_dias` | campos de `processo_envolvidos` | Mapear por nome e replicar para envolvidos conforme a solução. |
| Responsáveis e membros | `processo_designacoes` | Converter campos em papéis e reconstruir substituições. |
| `historico_encarregados` | cadeia `designacao_anterior_id` | Os 25 eventos de 19 processos são cronológicos, contínuos e terminam no responsável atual. |
| `prazos_processo` | `processo_prazos` | Inicial recebe ordem 0; prorrogações usam `ordem_prorrogacao`; `dias` é a diferença entre vencimento e início. |
| `andamentos` | `processo_andamentos` | Criar uma linha por item JSON; descrição de `texto`, data de `data` e usuário resolvido pelo nome quando inequívoco. |
| Campos `pdf_*` | `processo_anexos` | Criar um anexo para o único PDF existente; `enviado_por_id` ficará nulo. |
| `nome_vitima` | `processo_vitimas` | Criar uma vítima de ordem 1 para cada um dos 87 valores. |
| `pessoas_inquiridas` | `processo_pessoas` | Expandir o JSON; existem três pessoas em três processos. |
| `unidade_deprecada`/`deprecante` | `carta_precatoria_detalhes` | Existem três processos; mapear unidade pelo nome. |
| `transgressoes` | artigos/naturezas/`transgressoes` | Catálogo já convertido integralmente: 95 de 95. |
| `transgressoes_ids` | vínculos do envolvido | Expandir os 73 itens JSON dos 32 PADS e associar ao envolvido principal. |
| `pm_envolvido_*` | tabelas `envolvido_*` | Resolver primeiro o novo `envolvido_id`, depois migrar categorias e enquadramentos. |
| `crimes_contravencoes` | dispositivos, espécies e `infracoes_penais` | 26 de 27 já convertidas; foi descartado somente um registro inativo de teste. |
| `infracoes_estatuto_art29` | `infracoes_estatuto` | 20 de 23 já convertidas; os três omitidos eram testes inativos. |
| `mapas_salvos` | `mapas_salvos` | Exige conversão do tipo textual em apuratório e adaptação do JSON ao formato esperado pelo Rust. |
| `auditoria` | `auditoria` | Mapear usuário para a nova conta; os 448 usuários são resolvíveis. `alteracoes`, `acao` e `assunto` ficarão nulos quando não puderem ser reconstruídos. |

## 5. Transformações que merecem atenção

### 5.1 Envolvidos

Há 156 associações antigas, sem pares duplicados. Trinta e quatro processos têm mais de um envolvido, chegando a nove em um único processo. A tabela antiga `nome_pm_id` não pode ser ignorada: em somente 91 dos 128 processos o militar principal também aparece em `procedimento_pms_envolvidos`. A carga deve usar a união das duas fontes.

Dois processos usam o militar artificial “À apurar”. No novo modelo isso é corretamente representado por um envolvido com `policial_militar_id NULL`.

### 5.2 Prazos

Os 141 prazos pertencem a 44 processos:

- 44 prazos iniciais;
- 97 prorrogações;
- 44 prorrogações finais marcadas como ativas;
- 97 períodos anteriores marcados como inativos.

Todos os intervalos são consecutivos ou não sobrepostos e a diferença entre `data_inicio` e `data_vencimento` coincide com `dias_adicionados`. Assim, todos os períodos — inclusive os antigos marcados como inativos — devem ser preservados como histórico em `processo_prazos`. O novo modelo não precisa do campo `ativo` porque cada linha representa um período histórico.

### 5.3 Datas e fuso horário

O legado usa `timestamp without time zone`; o novo usa `timestamptz`. Como os dados foram produzidos em Ariquemes/RO, a conversão deve interpretar os horários antigos como `America/Porto_Velho` e armazená-los corretamente em UTC. Não se deve simplesmente aplicar `::timestamptz` dependendo do fuso da sessão.

### 5.4 Municípios compostos

Onze processos não correspondem literalmente ao catálogo porque o legado guardou distrito e município juntos:

- `Bom Futuro (Ariquemes)`: 8;
- `Jaci-Paraná (Porto Velho)`: 1;
- `Joelândia (Ariquemes)`: 1;
- `Tarilândia (Jaru)`: 1.

O destino correto é o registro do distrito antes dos parênteses; o vínculo com o município-pai já está normalizado no catálogo.

### 5.5 Designações

O mapeamento deve ser:

- `responsavel_id` → Encarregado;
- `presidente_id` → Presidente;
- `interrogante_id` → Interrogante;
- `escrivao_id` → Escrivão;
- `escrivao_processo_id` → Escrivão de Processo.

Para a designação inicial, usar `data_instauracao` como início, pois o legado não guardava uma data específica da primeira designação. Para cada substituição, encerrar a anterior e iniciar a sucessora em `data_substituicao`, usando a justificativa como `motivo`. O processo e seu documento iniciador podem ser usados como documento da designação inicial; substituições sem ato registrado permanecerão sem documento.

Nos quatro registros antigos de CD, CJ e PAD existe apenas `escrivao_processo_id`. Conforme decisão, será criada somente a designação de Escrivão de Processo. A configuração atual também marca Escrivão como obrigatório, mas ele ficará sem ocupante até complementação manual.

### 5.6 Soluções e sanções

Há 75 processos com solução e 27 deles possuem vários envolvidos. A mesma solução será replicada para todos os envolvidos. As penalidades também serão replicadas quando existirem, respeitando `permite_penalidade` e `usa_quantidade_dias`.

### 5.7 Indícios e acusações

O antigo `indicios_categorias` da tabela central não contém categorias úteis: todos os valores são listas vazias. A fonte válida é `pm_envolvido_indicios`.

Os 32 PADS possuem 73 enquadramentos em `transgressoes_ids`, incluindo transgressões do RDPM e infrações do Estatuto com analogia explícita. Esses itens devem ser atribuídos ao envolvido principal.

Os vínculos das tabelas `pm_envolvido_rdpm`, `pm_envolvido_crimes` e `pm_envolvido_art29` são atribuídos ao envolvido indicado por `pm_envolvido_indicios.pm_envolvido_id`.

### 5.8 Mapas salvos

Os 107 mapas antigos são snapshots, sendo 36 ativos e 71 inativos. Nenhum possui PDF binário. O JSON antigo tem formato `{sucesso, meta, dados}`, enquanto o exemplo novo utiliza diretamente uma lista de linhas. A migração deve extrair `dados` quando ele for a lista consumida pela interface nova, converter `tipo_processo` em `apuratorio_id` e usar `NULL` para `COMPLETO`. Metadados sem coluna equivalente (`periodo_descricao`, `usuario_nome`, `nome_arquivo`) só podem permanecer dentro de `dados_mapa` caso seja desejável preservá-los.

## 6. Dados antigos sem destino operacional direto

| Dado antigo | Tratamento |
|---|---|
| `naturezas` com oito códigos genéricos | Não eram usadas pelos 128 processos e não correspondem às 16 naturezas reais. Preservar apenas em `legado`, salvo decisão futura. |
| `status_processo` | Não era referenciado pela tabela central. No novo modelo, andamento/conclusão é derivado das datas. |
| `tipos_processo` | Não era referenciado e foi substituído por `tipos_apuratorio` + `apuratorios`. |
| `infracao_id` | Vazio em todos os registros; não migrar. |
| `natureza_processo` | Vazio em todos os registros; não migrar. |
| `solucao_final` | Vazio em todos os registros; não migrar. |
| `responsavel_tipo`, `presidente_tipo`, `interrogante_tipo`, `escrivao_processo_tipo` | Sempre indicavam `usuario`; tornaram-se desnecessários após FKs tipadas. |
| `pm_tipo` | Sempre `operador`; tornou-se desnecessário. |
| `concluido` | Redundante; usar presença de `data_conclusao`. Não há divergências nos 128 registros. |
| tabelas `procedimentos_indicios_*` | Estão vazias; não migrar. |
| tabelas Alembic e `schema_migrations` | Manter somente no esquema `legado`; o operacional usa `_sqlx_migrations`. |

## 7. Sequência recomendada da migração

1. Fazer backup integral e executar tudo em uma única transação de homologação.
2. Excluir os sete processos de teste e suas dependências na ordem inversa das FKs; remover também mapa e auditorias exclusivamente ligados aos testes.
3. Preservar os catálogos novos e validar os cadastros já convertidos.
4. Criar tabelas temporárias de correspondência para unidade, apuratório, documento, natureza, PM, usuário, status, soluções, penalidades e legislação.
5. Inserir os 128 processos, preservando seus UUIDs.
6. Inserir envolvidos usando a união entre militar principal e tabela associativa.
7. Marcar condutores e distribuir soluções/penalidades.
8. Criar designações atuais e reconstruir as 25 substituições.
9. Inserir os 141 períodos de prazo.
10. Migrar vítimas, pessoas inquiridas e três Cartas Precatórias.
11. Migrar categorias, transgressões, infrações penais e infrações do Estatuto.
12. Migrar o único PDF para `processo_anexos`.
13. Expandir os 64 andamentos de 35 processos.
14. Converter mapas salvos e auditoria.
15. Executar validações de contagem, integridade, unicidade, órfãos e amostras funcionais na aplicação.
16. Confirmar `COMMIT` somente após relatório de reconciliação sem perdas inesperadas.

## 8. Validações mínimas após a carga

- 128 processos antigos inseridos e sete testes removidos;
- 234 militares antigos reais preservados, além dos novos que devam continuar;
- nenhum processo sem unidade, município, apuratório ou documento;
- nenhum envolvido duplicado no mesmo processo;
- representação dos dois casos “À apurar” por PM nulo;
- 141 prazos, sem sobreposição e com ordem única;
- 25 substituições formando cadeias válidas;
- 87 vítimas e três pessoas inquiridas;
- três detalhes de Carta Precatória;
- um anexo PDF com tamanho e hash conferidos;
- 64 andamentos;
- 95 transgressões de catálogo;
- 73 enquadramentos dos 32 PADS, além dos vínculos por militar;
- 448 auditorias com usuário resolvido;
- nenhuma violação de FK, check, unique ou exclusion constraint.

## 9. Pendência obrigatória após a migração

As analogias provisórias abaixo não possuem fundamento recuperável no banco antigo e deverão ser corrigidas manualmente:

1. **SR nº 2/2025 — 3º SGT PM Christiano Kauling Campanini — Estatuto, art. 29, inciso III**;
2. **SR nº 5/2026 — CB PM Adriano de São Paulo Assumpção — Estatuto, art. 29, inciso III**;
3. **SR nº 5/2026 — CB PM Adriano de São Paulo Assumpção — Estatuto, art. 29, inciso XIII**.

A transgressão provisória deve ser identificada no script e no relatório de execução com um marcador explícito, por exemplo `ANALOGIA_PROVISORIA_MIGRACAO`, para impedir que seja interpretada como decisão jurídica definitiva.

## 10. Avaliação final

A nova modelagem resolve os principais problemas do banco anterior: elimina listas e históricos embutidos na tabela central, separa militares de contas, normaliza domínios, permite múltiplos envolvidos e vítimas, registra designações temporais, protege cronologia e numeração e reforça integridade referencial.

A migração é tecnicamente viável e a maior parte pode ser determinística. Os principais cuidados são a remoção prévia dos testes conflitantes, a união das duas fontes de envolvidos, a reconstrução das designações, a replicação consciente das soluções antigas, a conversão explícita do fuso horário e a posterior correção das três analogias provisórias.
