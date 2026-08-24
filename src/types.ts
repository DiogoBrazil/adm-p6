// GERADO a partir de `src-tauri/src/*/domain.rs`. Não editar à mão.
//
// Regerar com o script descrito em `src/api.ts`. A conversão segue:
//   String/NaiveDate/DateTime<Utc> -> string      Option<T>      -> T | null
//   i32/i64/f64                    -> number      Vec<T>         -> T[]
//   bool                           -> boolean     Map<String,Value> -> Record<string, unknown>
//
// Em structs de request e de filtro, `Option<T>` e `#[serde(default)]` viram
// campos OPCIONAIS: omitir é válido do lado do Rust, e o compilador reproduz
// exatamente essa regra.

/** `legal_catalogs` */
export type TipoColuna = "texto" | "texto_opcional" | "booleano" | "inteiro" | "inteiro_opcional" | "referencia" | "referencia_opcional" | "referencia_fixa";

/** `apuratorio_config` */
export interface ApuratorioConfig {
  apuratorio_id: string;
  sigla: string;
  nome: string;
  /** Prazo herdado por um documento iniciador que não declare o seu. */
  prazo_base_dias: number;

  // Atributos de comportamento: é o que o formulário de processo consulta para
  // saber quais campos existem nesta espécie. Vêm daqui, e não de
  // `legal_catalogs_list("apuratorios")`, que projeta só o que está no registro
  // de administração — ver o cabeçalho de `ApuratorioConfig` no Rust.

  /** Em branco = sem limite de envolvidos. */
  max_envolvidos: number | null;
  /** A rubrica do fato é obrigatória nesta espécie. */
  exige_natureza_fato: boolean;
  /** A espécie é julgada: revela a data de julgamento. */
  permite_julgamento: boolean;
  /** Da espécie pode resultar punição: revela penalidade e dias no envolvido. */
  permite_punicao: boolean;
  /** A espécie tramita por comissão: revela a data de remessa à comissão. */
  permite_remessa_comissao: boolean;
  /** Único código técnico do schema. Hoje só `carta_precatoria`. */
  codigo_extensao: string | null;

  documentos: DocumentoIniciadorItem[];
  papeis: PapelItem[];
}

/** `apuratorio_config` */
export interface DocumentoIniciadorItem {
  tipo_documento_id: string;
  tipo_documento: string;
  /** NULL = herda o prazo do apuratório. */
  prazo_base_dias: number | null;
  /** O `COALESCE` já resolvido: é este o prazo que o processo vai receber. */
  prazo_efetivo_dias: number;
  padrao: boolean;
  ativo: boolean;
  /** Já existe processo com este par. Desativar continua permitido; apagar não. */
  em_uso: boolean;
}

/** `apuratorio_config` */
export interface PapelItem {
  papel_id: string;
  papel: string;
  obrigatorio: boolean;
  max_ocupantes: number;
  e_responsavel: boolean;
  ativo: boolean;
  em_uso: boolean;
}

/** `apuratorio_config` */
export interface SaveDocumentoIniciadorRequest {
  apuratorio_id: string;
  tipo_documento_id: string;
  prazo_base_dias?: number | null;
  padrao?: boolean;
  ativo?: boolean;
}

/** `apuratorio_config` */
export interface SavePapelRequest {
  apuratorio_id: string;
  papel_id: string;
  obrigatorio?: boolean;
  max_ocupantes: number;
  e_responsavel?: boolean;
  ativo?: boolean;
}

/** `audit` */
export interface AuditDetailItem {
  id: string;
  entidade: string;
  registro_id: string;
  operacao: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_posto: string | null;
  /** Diff da operação, quando registrado. Preenchido nas alterações de */
  /** configuração, que mudam o comportamento futuro do sistema. */
  alteracoes: unknown | null;
  ocorrido_em: string;
}

/** `audit` */
export interface AuditOperationStat {
  operacao: string;
  total: number;
}

/** `audit` */
export interface AuditTableStat {
  entidade: string;
  total: number;
}

/** `audit` */
export interface AuditStatistics {
  total: number;
  por_operacao: AuditOperationStat[];
  por_entidade: AuditTableStat[];
}

/** `audit` */
export interface AuditPageResult {
  items: AuditDetailItem[];
  total: number;
}

/** `audit` */
export interface AuditStatisticsFilter {
  data_inicio?: string | null;
  data_fim?: string | null;
}

/** `auth` */
export interface UserAuthRow {
  id: string;
  /** Nome de exibição da conta: vem do policial militar vinculado ou, quando a */
  /** conta não representa um militar, do próprio `nome_exibicao`. */
  nome: string;
  email: string;
  senha_hash: string;
  perfil: string;
  /** Autorização vem deste atributo semântico, nunca do nome do perfil — o */
  /** administrador pode renomear "Administrador" sem perder o acesso. */
  pode_administrar: boolean;
  policial_militar_id: string | null;
}

/** `auth` */
export interface SessionUser {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  is_admin: boolean;
  policial_militar_id: string | null;
}

/** `deadlines` */
export interface DeadlineSummary {
  total: number;
  vencidos: number;
  proximos: number;
}

/** `deadlines` */
export interface DeadlineItem {
  id: string;
  processo_id: string;
  ordem: number;
  data_inicio: string;
  dias: number;
  data_vencimento: string;
  motivo: string | null;
  documento_autorizador_id: string | null;
  documento_autorizador: string | null;
  numero_documento: string | null;
  data_documento: string | null;
  autoridade_id: string | null;
  autoridade: string | null;
  /** Vigente = é o prazo de maior ordem do processo. */
  vigente: boolean;
}

/** `deadlines` */
export interface DeadlineReportItem {
  processo_id: string;
  apuratorio_sigla: string;
  numero_controle: string;
  unidade_origem: string;
  responsavel_nome: string | null;
  data_vencimento: string;
  /** Negativo = já venceu. */
  dias_restantes: number;
  ordem: number;
}

/** `deadlines` */
export interface DeadlineReportFilter {
  /** Espécies de apuratório a incluir. Vazio = todas. Substitui os `IN (...)` */
  /** de siglas que existiam escritos no SQL. */
  apuratorio_ids?: string[] | null;
  responsavel_id?: string | null;
  apenas_vencidos?: boolean | null;
  /** Janela em dias a partir de hoje. Negativo não é aceito. */
  dias_ate_vencer?: number | null;
  ano?: number | null;
  limit?: number | null;
}

/** `deadlines` */
export interface CalculateDeadlineResult {
  data_vencimento: string;
  dias: number;
  /** De onde veio o número de dias: a combinação apuratório × documento */
  /** iniciador, ou o padrão do apuratório. */
  origem: string;
}

/** `deadlines` */
export interface AddExtensionRequest {
  processo_id: string;
  dias: number;
  motivo: string;
  documento_autorizador_id?: string | null;
  numero_documento?: string | null;
  data_documento?: string | null;
  /** Autoridade que concedeu a prorrogação, quando registrada. */
  autoridade_id?: string | null;
}

/** `evidence` */
export interface CategoriaIndicioItem {
  id: string;
  nome: string;
  indica_ausencia: boolean;
}

/** `evidence` */
export interface InfracaoPenalItem {
  id: string;
  dispositivo_legal: string;
  especie: string;
  artigo: string;
  descricao: string;
  rotulo: string;
}

/** `evidence` */
export interface TransgressaoItem {
  id: string;
  artigo: string;
  natureza: string;
  inciso: string;
  texto: string;
  rotulo: string;
}

/** `evidence` */
export interface InfracaoEstatutoItem {
  id: string;
  dispositivo_legal: string;
  artigo: string;
  inciso: string;
  texto: string;
  rotulo: string;
}

/** `evidence` */
export interface InfracaoPenalVinculo {
  infracao_penal_id: string;
  esfera_penal_id: string;
  esfera_penal: string;
  dispositivo_legal: string;
  especie: string;
  artigo: string;
  descricao: string;
  rotulo: string;
}

/** `evidence` */
export interface InfracaoEstatutoVinculo {
  infracao_estatuto_id: string;
  rotulo: string;
  analogia_transgressao_id: string;
  analogia_rotulo: string;
}

/** `evidence` */
export interface SelecaoInfracaoPenal {
  infracao_penal_id: string;
  esfera_penal_id: string;
}

/** `evidence` */
export interface SelecaoInfracaoEstatuto {
  infracao_estatuto_id: string;
  analogia_transgressao_id: string;
}

/** `evidence` */
export interface SaveEvidenceRequest {
  envolvido_id: string;
  categorias_ids: string[];
  infracoes_penais: SelecaoInfracaoPenal[];
  transgressoes_ids: string[];
  infracoes_estatuto: SelecaoInfracaoEstatuto[];
}

/** `evidence` */
export interface EvidenceData {
  envolvido_id: string;
  categorias: CategoriaIndicioItem[];
  infracoes_penais: InfracaoPenalVinculo[];
  transgressoes: TransgressaoItem[];
  infracoes_estatuto: InfracaoEstatutoVinculo[];
}

/** `evidence` */
export interface EnvolvidoComIndicios {
  envolvido_id: string;
  policial_militar_id: string;
  nome: string;
  matricula: string;
  posto_graduacao: string;
  status_envolvido: string;
  ordem: number;
  indicios: EvidenceData;
}

/** `legal_catalogs` */
export interface Coluna {
  nome: string;
  rotulo: string;
  tipo: TipoColuna;
  /** Catálogo referenciado, quando o tipo é uma referência. */
  alvo: string | null;
  /** Explicação do efeito da coluna quando ela carrega comportamento, e não só */
  /** apresentação. É o texto que a tela mostra ao lado do campo. */
  efeito: string | null;
  /** Coluna booleana do catálogo `alvo` que marca a linha a usar, quando o */
  /** tipo é `referencia_fixa`. */
  marcador: string | null;
  /** Nome de uma coluna booleana DESTE catálogo que revela este campo. */
  visivel_se: string | null;
}

/** `legal_catalogs` */
export interface Catalogo {
  /** Identificador estável usado pelo frontend e pela auditoria. Não é exibido. */
  chave: string;
  /** Nome físico da tabela. Só sai daqui — nunca de um parâmetro de requisição. */
  tabela: string;
  rotulo: string;
  colunas: Coluna[];
  ordenacao: string;
}

/** `legal_catalogs` */
export interface SaveCatalogRequest {
  catalogo: string;
  id?: string | null;
  valores: Record<string, unknown>;
}

/** `legal_catalogs` */
export interface SaveCatalogResult {
  id: string;
}

/** `maps_reports` */
export interface SavedMapListItem {
  id: string;
  titulo: string;
  apuratorio_id: string | null;
  apuratorio_sigla: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  total_processos: number;
  total_concluidos: number;
  total_andamento: number;
  gerado_por: string | null;
  created_at: string;
}

/** `maps_reports` */
export interface SavedMapFull extends SavedMapListItem {
  /** Snapshot imutável do mapa como foi emitido. É o único JSONB de domínio do */
  /** schema, e é justificado: recalcular hoje daria outro resultado — preservar */
  /** exatamente o que foi publicado é a razão de o mapa ser salvo. */
  dados_mapa: unknown;
}

/** `maps_reports` */
export interface MapPeriodRequest {
  periodo_inicio: string;
  periodo_fim: string;
  /** Espécies a incluir. Vazio = todas. Substitui o `tipo_processo` textual com */
  /** o sentinela "TODOS" que existia antes. */
  apuratorio_ids?: string[] | null;
}

/** `maps_reports` */
export interface SaveMapRequest {
  titulo: string;
  apuratorio_id?: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  total_processos: number;
  total_concluidos: number;
  total_andamento: number;
  dados_mapa: unknown;
}

/** `maps_reports` */
export interface MapRow {
  processo_id: string;
  apuratorio_sigla: string;
  rotulo: string;
  unidade_origem: string;
  natureza_fato: string | null;
  data_instauracao: string;
  data_conclusao: string | null;
  responsavel_nome: string | null;
  envolvidos: string | null;
  prazo_vencimento: string | null;
  ultimo_andamento: string | null;
  ultimo_andamento_em: string | null;
}

/** `maps_reports` */
export interface ContagemRotulada {
  id: string;
  rotulo: string;
  total: number;
}

/** `maps_reports` */
export interface DriverRankingItem {
  policial_militar_id: string;
  nome: string;
  matricula: string;
  posto_graduacao: string;
  total: number;
}

/** `maps_reports` */
export interface ReportFilter {
  apuratorio_ids?: string[] | null;
  ano?: number | null;
  limit?: number | null;
}

/** `maps_reports` */
export interface CsvExport {
  nome_arquivo: string;
  /** CSV em base64, pronto para o frontend oferecer como download. */
  conteudo: string;
}

/**
 * `files` — arquivo a entregar ao usuário.
 *
 * O conteúdo vai em base64 porque é o mesmo formato em que `CsvExport.conteudo`
 * já chega do backend, e porque nem todo relatório é texto.
 */
export interface SaveFileRequest {
  /** Nome oferecido no diálogo; a extensão daqui vira o filtro do seletor. */
  nome_sugerido: string;
  conteudo_base64: string;
}

/** `maps_reports` — situação dos processos de um apuratório no escopo do filtro. */
export interface StatusPorApuratorio {
  apuratorio_id: string;
  sigla: string;
  nome: string;
  /** Permite agrupar processo × procedimento sem conhecer sigla nenhuma. */
  tipo_apuratorio_id: string;
  tipo_apuratorio_nome: string;
  em_andamento: number;
  concluidos: number;
  total: number;
}

/** `maps_reports` — o encarregado sugere, a autoridade decide. Dois catálogos. */
export interface SolucoesResumo {
  sugeridas: ContagemRotulada[];
  decididas: ContagemRotulada[];
}

/**
 * `maps_reports` — contagem de um enquadramento imputado a envolvidos.
 *
 * `classificacao` vem sempre de JOIN: a esfera penal escolhida no vínculo, a
 * espécie do artigo ou a gravidade do artigo do RDPM. Nas infrações penais a
 * mesma infração pode aparecer em duas linhas, uma por esfera — é o art. 9º do
 * CPM, não duplicata.
 */
export interface EnquadramentoContagem {
  id: string;
  rotulo: string;
  descricao: string;
  classificacao: string | null;
  total: number;
}

/** `maps_reports` — `ReportFilter` mais o recorte por papel. */
export interface DesignacaoMatrizFiltro {
  apuratorio_ids?: string[] | null;
  papel_ids?: string[] | null;
  ano?: number | null;
  limit?: number | null;
}

/**
 * `maps_reports` — linha da matriz militar × apuratório.
 *
 * `celulas` traz só os apuratórios em que o militar foi designado (`id` =
 * apuratório, `rotulo` = sigla); as colunas da tabela saem do catálogo.
 */
export interface DesignacaoMatrizLinha {
  policial_militar_id: string;
  nome: string;
  matricula: string;
  posto_graduacao: string;
  celulas: ContagemRotulada[];
  total: number;
}

/** `movements` */
export interface MovementItem {
  id: string;
  descricao: string;
  ocorrido_em: string;
  tipo_andamento_id: string | null;
  tipo_andamento: string | null;
  /** Autor do andamento. O jsonb legado guardava o nome do usuário e a tabela */
  /** que o substituiu havia perdido essa informação; aqui ela volta como FK. */
  registrado_por_id: string | null;
  registrado_por: string | null;
}

/** `movements` */
export interface AddMovementRequest {
  processo_id: string;
  descricao: string;
  /** Classificação vinda do catálogo `tipos_andamento`. Opcional: um andamento */
  /** pode ser só texto. */
  tipo_andamento_id?: string | null;
  ocorrido_em?: string | null;
}

/** `proceedings` */
export interface ProceedingListItem {
  id: string;
  apuratorio_id: string;
  apuratorio_sigla: string;
  apuratorio_nome: string;
  tipo_apuratorio: string;
  documento_iniciador_id: string;
  documento_iniciador: string;
  numero_documento: string;
  /** Número de controle efetivo: o informado ou, quando ausente, o do documento. */
  numero_controle: string;
  /** Rótulo montado a partir do dado, no formato usado pela Seção: */
  /** `SIGLA nº CONTROLE/UNIDADE/ANO`. */
  rotulo: string;
  /** Os ids acompanham os rótulos porque o formulário de edição precisa */
  /** repopular os selects. Resolver por nome falharia justamente no caso que */
  /** o modelo protege: um catálogo desativado não aparece na lista de opções, */
  /** e o processo antigo perderia o vínculo em silêncio. */
  unidade_origem_id: string;
  unidade_origem: string;
  municipio_fato_id: string;
  municipio_fato: string;
  natureza_fato_id: string | null;
  natureza_fato: string | null;
  data_instauracao: string;
  data_recebimento: string | null;
  data_conclusao: string | null;
  /** Derivado de `data_conclusao IS NOT NULL` — não existe coluna booleana. */
  concluido: boolean;
  resumo_fatos: string | null;
  /** Quem ocupa, neste apuratório, o papel configurado como responsável. */
  responsavel_nome: string | null;
  responsavel_papel: string | null;
  total_envolvidos: number;
  prazo_vencimento: string | null;
  prazo_dias_restantes: number | null;
}

/** `proceedings` */
export interface EnvolvidoItem {
  id: string;
  policial_militar_id: string;
  nome: string;
  matricula: string;
  posto_graduacao: string;
  status_envolvido_id: string;
  status_envolvido: string;
  ordem: number;
  e_condutor: boolean;
  solucao_sugerida_id: string | null;
  solucao_sugerida: string | null;
  solucao_decidida_id: string | null;
  solucao_decidida: string | null;
  penalidade_tipo_id: string | null;
  penalidade_tipo: string | null;
  penalidade_dias: number | null;
}

/** `proceedings` */
export interface DesignacaoItem {
  id: string;
  papel_id: string;
  papel: string;
  e_responsavel: boolean;
  policial_militar_id: string;
  nome: string;
  posto_graduacao: string;
  data_inicio: string;
  /** Exclusiva: é o dia em que o sucessor assume. Nula = designação vigente. */
  data_fim: string | null;
  documento_autorizador: string | null;
  numero_documento: string | null;
  motivo: string | null;
}

/** `proceedings` */
export interface PessoaItem {
  id: string;
  papel_pessoa_id: string;
  papel_pessoa: string;
  nome: string;
  ordem: number;
}

/** `proceedings` */
export interface AnexoItem {
  id: string;
  nome_arquivo: string;
  mime_type: string;
  tamanho_bytes: number;
  enviado_por: string | null;
  created_at: string;
}

/** `proceedings` */
export interface CartaPrecatoriaDetalhes {
  deprecante: string;
  unidade_deprecada_id: string;
  unidade_deprecada: string;
}

/** `proceedings` */
export interface ProceedingDetail extends ProceedingListItem {
  processo_sei: string | null;
  numero_rgf: string | null;
  data_remessa_encarregado: string | null;
  data_remessa_comissao: string | null;
  data_julgamento: string | null;
  envolvidos: EnvolvidoItem[];
  designacoes: DesignacaoItem[];
  pessoas: PessoaItem[];
  anexos: AnexoItem[];
  carta_precatoria: CartaPrecatoriaDetalhes | null;
}

/** `proceedings` */
export interface EnvolvidoRequest {
  policial_militar_id: string;
  status_envolvido_id: string;
  ordem: number;
  e_condutor?: boolean;
  solucao_sugerida_id?: string | null;
  solucao_decidida_id?: string | null;
  penalidade_tipo_id?: string | null;
  penalidade_dias?: number | null;
}

/** `proceedings` */
export interface DesignacaoRequest {
  policial_militar_id: string;
  papel_id: string;
  data_inicio: string;
  documento_autorizador_id?: string | null;
  numero_documento?: string | null;
  motivo?: string | null;
}

/** `proceedings` */
export interface PessoaRequest {
  papel_pessoa_id: string;
  nome: string;
  ordem: number;
}

/** `proceedings` */
export interface CartaPrecatoriaRequest {
  deprecante: string;
  unidade_deprecada_id: string;
}

/** `proceedings` */
export interface SubstituirDesignacaoRequest {
  processo_id: string;
  papel_id: string;
  sucessor_id: string;
  /** Dia em que o sucessor assume. É também o fim (exclusivo) da designação */
  /** anterior, então não há sobreposição nem lacuna. */
  data_troca: string;
  motivo?: string | null;
  documento_autorizador_id?: string | null;
  numero_documento?: string | null;
}

/** `proceedings` */
export interface SaveProceedingRequest {
  id?: string | null;
  apuratorio_id: string;
  documento_iniciador_id: string;
  numero_documento: string;
  /** Ausente = igual ao número do documento. É assim que o índice único trata. */
  numero_controle?: string | null;
  processo_sei?: string | null;
  numero_rgf?: string | null;
  unidade_origem_id: string;
  municipio_fato_id: string;
  natureza_fato_id?: string | null;
  data_instauracao: string;
  data_recebimento?: string | null;
  data_remessa_encarregado?: string | null;
  data_remessa_comissao?: string | null;
  data_julgamento?: string | null;
  data_conclusao?: string | null;
  resumo_fatos?: string | null;
  envolvidos?: EnvolvidoRequest[];
  designacoes?: DesignacaoRequest[];
  pessoas?: PessoaRequest[];
  carta_precatoria?: CartaPrecatoriaRequest | null;
}

/** `proceedings` */
export interface ProceedingFilter {
  busca?: string | null;
  /** Espécies a incluir. Vazio = todas. Substitui os `IN (...)` de sigla. */
  apuratorio_ids?: string[] | null;
  tipo_apuratorio_id?: string | null;
  unidade_origem_id?: string | null;
  natureza_fato_id?: string | null;
  responsavel_id?: string | null;
  ano?: number | null;
  concluido?: boolean | null;
  page?: number | null;
  per_page?: number | null;
}

/** `proceedings` */
export interface ProceedingListResult {
  items: ProceedingListItem[];
  total: number;
  page: number;
  per_page: number;
}

/** `proceedings` */
export interface UploadAttachmentRequest {
  processo_id: string;
  nome_arquivo: string;
  mime_type: string;
  /** Conteúdo em base64. */
  conteudo: string;
}

/** `proceedings` */
export interface AttachmentContent {
  nome_arquivo: string;
  mime_type: string;
  conteudo: string;
}

/** `proceedings` */
export interface DashboardSummary {
  total: number;
  em_andamento: number;
  concluidos: number;
  prazos_vencidos: number;
  por_apuratorio: ContagemRotulada[];
  por_natureza: ContagemRotulada[];
  por_unidade: ContagemRotulada[];
  por_ano: ContagemRotulada[];
}

/** `users` */
export interface UserListItem {
  id: string;
  nome: string;
  matricula: string;
  posto_graduacao_id: string;
  posto_graduacao: string;
  circulo_hierarquico: string;
  is_encarregado: boolean;
  ativo: boolean;
  conta_id: string | null;
  conta_email: string | null;
  conta_perfil_id: string | null;
  conta_perfil: string | null;
  conta_ativa: boolean | null;
}

/** `users` */
export interface UserFormSchema {
  title: string;
  admin_only: boolean;
  fields: string[];
  validations: string[];
}

/** `users` */
export interface SaveAccountRequest {
  email: string;
  perfil_id: string;
  /** Obrigatória ao criar a conta; ausente numa edição mantém a senha atual. */
  senha?: string | null;
}

/** `users` */
export interface SaveUserRequest {
  /** Identidade do policial militar. Ausente = cadastro novo. */
  id?: string | null;
  nome: string;
  matricula: string;
  /** Catálogo resolvido por id, nunca por nome — renomear um posto não pode */
  /** quebrar o cadastro. */
  posto_graduacao_id: string;
  is_encarregado: boolean;
  conta?: SaveAccountRequest | null;
}

/** `users` */
export interface SaveUserResult {
  id: string;
  conta_id: string | null;
}

/** `users` */
export interface UserListResult {
  items: UserListItem[];
  total: number;
  page: number;
  per_page: number;
}

/** `users` */
export interface UserStatistics {
  /** Quantas designações o militar teve em cada papel (encarregado, escrivão…). */
  designacoes_por_papel: ContagemRotulada[];
  /** Quantas designações em cada espécie de apuratório. */
  designacoes_por_apuratorio: ContagemRotulada[];
  /** Em quantos processos figurou com cada status de envolvido. */
  envolvimentos_por_status: ContagemRotulada[];
}

/** `users` */
export interface UserProcessItem {
  id: string;
  apuratorio_id: string;
  apuratorio_sigla: string;
  apuratorio_nome: string;
  tipo_apuratorio: string;
  numero_documento: string;
  numero_controle: string;
  resumo_fatos: string | null;
  data_instauracao: string;
  data_conclusao: string | null;
  /** Papel exercido, quando a listagem é de designações. */
  papel: string | null;
  /** Status no processo, quando a listagem é de envolvimentos. */
  status_envolvido: string | null;
}
