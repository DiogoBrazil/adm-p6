// Cliente tipado do backend Tauri.
//
// POR QUE ESTE ARQUIVO EXISTE
//
// O `main.ts` invocava 118 comandos, dos quais 87 não existiam mais no backend
// — e nada acusava. `invoke()` recebe o nome do comando como `string` cru, o
// erro só aparece em runtime, e `call()` engolia a exceção devolvendo
// `{ ok: false, error }`, que a tela mostra como texto. Um comando renomeado no
// Rust virava uma mensagem de erro na cara do usuário, nunca um erro de build.
//
// Aqui o nome do comando é `keyof Commands`, e argumentos e resposta saem do
// mesmo mapa. Comando inexistente, argumento errado ou campo de resposta
// inventado passam a ser erro de compilação.
//
// DUAS REGRAS QUE O MAPA CODIFICA
//
// 1. As chaves de argumento são **camelCase**. É a convenção do Tauri v2: um
//    parâmetro `processo_id` no Rust é recebido como `processoId` no JS, salvo
//    se o comando declarar `rename_all = "snake_case"` — e nenhum declara. O
//    `main.ts` mandava snake_case, então toda chamada com argumento de mais de
//    uma palavra falhava. São 16 parâmetros nessa situação.
// 2. Argumento `Option<T>` no Rust é opcional aqui; omitir é válido.
//
// COMO REGERAR DEPOIS DE MEXER NO BACKEND
//
// `types.ts` e o mapa `Commands` saem das assinaturas em
// `src-tauri/src/*/commands.rs` e das structs em `src-tauri/src/*/domain.rs`.
// Ao acrescentar ou mudar um comando, ajuste os dois — o `tsc` aponta o resto.

import { invoke } from "@tauri-apps/api/core";

import type {
  AddExtensionRequest,
  AddMovementRequest,
  AnexoItem,
  ApuratorioConfig,
  AttachmentContent,
  AuditDetailItem,
  AuditOperationStat,
  AuditPageResult,
  AuditStatistics,
  AuditStatisticsFilter,
  AuditTableStat,
  CalculateDeadlineResult,
  CartaPrecatoriaDetalhes,
  CartaPrecatoriaRequest,
  Catalogo,
  CategoriaIndicioItem,
  Coluna,
  ContagemRotulada,
  CsvExport,
  DashboardSummary,
  DeadlineItem,
  DeadlineReportFilter,
  DeadlineReportItem,
  DeadlineSummary,
  DesignacaoItem,
  DesignacaoRequest,
  DocumentoIniciadorItem,
  DriverRankingItem,
  EnvolvidoComIndicios,
  EnvolvidoItem,
  EnvolvidoRequest,
  EvidenceData,
  InfracaoEstatutoItem,
  InfracaoEstatutoVinculo,
  InfracaoPenalItem,
  InfracaoPenalVinculo,
  MapPeriodRequest,
  MapRow,
  MovementItem,
  PapelItem,
  PessoaItem,
  PessoaRequest,
  ProceedingDetail,
  ProceedingFilter,
  ProceedingListItem,
  ProceedingListResult,
  ReportFilter,
  SaveAccountRequest,
  SaveCatalogRequest,
  SaveCatalogResult,
  SaveDocumentoIniciadorRequest,
  SaveEvidenceRequest,
  SaveMapRequest,
  SavePapelRequest,
  SaveProceedingRequest,
  SaveUserRequest,
  SaveUserResult,
  SavedMapFull,
  SavedMapListItem,
  SelecaoInfracaoEstatuto,
  SelecaoInfracaoPenal,
  SessionUser,
  SubstituirDesignacaoRequest,
  TipoColuna,
  TransgressaoItem,
  UploadAttachmentRequest,
  UserAuthRow,
  UserFormSchema,
  UserListItem,
  UserListResult,
  UserProcessItem,
  UserStatistics,
} from "./types";

export type * from "./types";

/** Envelope de toda resposta do backend (`src-tauri/src/response.rs`). */
export type ApiResponse<T> = {
  ok: boolean;
  data: T | null;
  error: string | null;
};

/**
 * Contrato dos 67 comandos registrados em `src-tauri/src/lib.rs`.
 *
 * Se `generate_handler!` mudar lá, este mapa precisa mudar aqui — é
 * deliberado: a divergência vira erro de compilação em vez de erro de runtime.
 */
export interface Commands {
  // ── Sessão ────────────────────────────────────────────────────────
  auth_login: { args: { email: string, senha: string }; result: SessionUser };
  auth_logout: { args: Record<string, never>; result: boolean };
  auth_current_user: { args: Record<string, never>; result: SessionUser };

  // ── Policiais militares e contas de acesso ────────────────────────
  users_list: { args: { search?: string | null, page?: number | null, perPage?: number | null }; result: UserListResult };
  users_save: { args: { request: SaveUserRequest }; result: SaveUserResult };
  users_delete: { args: { id: string }; result: boolean };
  users_reactivate: { args: { id: string }; result: boolean };
  users_list_encarregados: { args: Record<string, never>; result: UserListItem[] };
  users_get: { args: { id: string }; result: UserListItem | null };
  users_statistics: { args: { id: string }; result: UserStatistics };
  users_proceedings_designated: { args: { id: string, papelId?: string | null }; result: UserProcessItem[] };
  users_proceedings_involved: { args: { id: string }; result: UserProcessItem[] };
  users_form_schema: { args: Record<string, never>; result: UserFormSchema };

  // ── Catálogos administráveis (7 comandos genéricos, 26 catálogos) ─
  legal_catalogs_definitions: { args: Record<string, never>; result: Catalogo[] };
  legal_catalogs_list: { args: { catalogo: string, incluirInativos?: boolean | null }; result: Record<string, unknown>[] };
  legal_catalogs_get: { args: { catalogo: string, id: string }; result: Record<string, unknown> | null };
  legal_catalogs_search: { args: { catalogo: string, campo: string, termo: string, limite?: number | null }; result: Record<string, unknown>[] };
  legal_catalogs_save: { args: { request: SaveCatalogRequest }; result: SaveCatalogResult };
  legal_catalogs_deactivate: { args: { catalogo: string, id: string }; result: boolean };
  legal_catalogs_reactivate: { args: { catalogo: string, id: string }; result: boolean };
  legal_catalogs_delete: { args: { catalogo: string, id: string }; result: boolean };

  // ── Configuração do apuratório: documentos iniciadores e papéis ───
  apuratorio_config_get: { args: { apuratorioId: string }; result: ApuratorioConfig | null };
  apuratorio_config_save_documento: { args: { request: SaveDocumentoIniciadorRequest }; result: boolean };
  apuratorio_config_save_papel: { args: { request: SavePapelRequest }; result: boolean };
  apuratorio_config_deactivate_documento: { args: { apuratorioId: string, tipoDocumentoId: string }; result: boolean };
  apuratorio_config_deactivate_papel: { args: { apuratorioId: string, papelId: string }; result: boolean };

  // ── Processos e procedimentos ─────────────────────────────────────
  proceedings_list: { args: { filter?: ProceedingFilter | null }; result: ProceedingListResult };
  proceedings_get: { args: { id: string }; result: ProceedingDetail | null };
  proceedings_save: { args: { request: SaveProceedingRequest }; result: string };
  proceedings_delete: { args: { id: string }; result: boolean };
  proceedings_reopen: { args: { id: string }; result: boolean };
  proceedings_substitute_designation: { args: { request: SubstituirDesignacaoRequest }; result: string };
  proceedings_list_attachments: { args: { processoId: string }; result: AnexoItem[] };
  proceedings_upload_attachment: { args: { request: UploadAttachmentRequest }; result: string };
  proceedings_get_attachment: { args: { anexoId: string }; result: AttachmentContent | null };
  proceedings_remove_attachment: { args: { anexoId: string }; result: boolean };
  dashboard_summary: { args: Record<string, never>; result: DashboardSummary };

  // ── Prazos ────────────────────────────────────────────────────────
  deadlines_dashboard: { args: { diasJanela?: number | null }; result: DeadlineSummary };
  deadlines_list: { args: { processoId: string }; result: DeadlineItem[] };
  deadlines_calculate: { args: { apuratorioId: string, documentoIniciadorId: string, dataInicio: string, dias?: number | null }; result: CalculateDeadlineResult };
  deadlines_report: { args: { filter?: DeadlineReportFilter | null }; result: DeadlineReportItem[] };
  deadlines_add_extension: { args: { request: AddExtensionRequest }; result: string };

  // ── Andamentos ────────────────────────────────────────────────────
  movements_list: { args: { processoId: string }; result: MovementItem[] };
  movements_add: { args: { request: AddMovementRequest }; result: string };
  movements_remove: { args: { processoId: string, andamentoId: string }; result: boolean };

  // ── Indícios e enquadramento ──────────────────────────────────────
  evidence_save_for_pm: { args: { request: SaveEvidenceRequest }; result: boolean };
  evidence_load_for_pm: { args: { envolvidoId: string }; result: EvidenceData };
  evidence_list_for_proceeding: { args: { processoId: string }; result: EnvolvidoComIndicios[] };
  evidence_remove_for_pm: { args: { envolvidoId: string }; result: boolean };
  evidence_search_infracoes_penais: { args: { termo: string, dispositivoLegalId?: string | null }; result: InfracaoPenalItem[] };
  evidence_search_transgressoes: { args: { termo: string, naturezaId?: string | null }; result: TransgressaoItem[] };
  evidence_search_infracoes_estatuto: { args: { termo: string, artigo?: string | null }; result: InfracaoEstatutoItem[] };

  // ── Mapas e relatórios ────────────────────────────────────────────
  reports_map_rows: { args: { request: MapPeriodRequest }; result: MapRow[] };
  reports_save_map: { args: { request: SaveMapRequest }; result: string };
  reports_saved_maps: { args: Record<string, never>; result: SavedMapListItem[] };
  reports_get_saved_map: { args: { id: string }; result: SavedMapFull | null };
  reports_delete_saved_map: { args: { id: string }; result: boolean };
  reports_by_responsible: { args: { filter?: ReportFilter | null }; result: ContagemRotulada[] };
  reports_by_nature: { args: { filter?: ReportFilter | null }; result: ContagemRotulada[] };
  reports_driver_ranking: { args: { filter?: ReportFilter | null }; result: DriverRankingItem[] };
  reports_available_years: { args: Record<string, never>; result: number[] };
  reports_export_csv: { args: { request: MapPeriodRequest }; result: CsvExport };

  // ── Auditoria ─────────────────────────────────────────────────────
  audit_list: { args: { limit?: number | null, offset?: number | null, entidade?: string | null, operacao?: string | null, usuarioId?: string | null }; result: AuditDetailItem[] };
  audit_get: { args: { id: string }; result: AuditDetailItem | null };
  audit_by_record: { args: { entidade: string, registroId: string }; result: AuditDetailItem[] };
  audit_by_user: { args: { usuarioId: string, page?: number | null, perPage?: number | null }; result: AuditPageResult };
  audit_statistics: { args: { filter?: AuditStatisticsFilter | null }; result: AuditStatistics };

}

/** Nome de qualquer comando válido. */
export type CommandName = keyof Commands;

/**
 * Invoca um comando do backend.
 *
 * Nunca lança: uma falha de IPC vira o mesmo envelope `{ ok: false }` que um
 * erro de domínio, para a tela ter um caminho de tratamento só. O que muda é
 * que agora o erro de *nome* ou de *argumento* não chega até aqui — o
 * compilador o pega antes.
 */
export async function call<K extends CommandName>(
  ...[command, args]: Commands[K]["args"] extends Record<string, never>
    ? [command: K, args?: Commands[K]["args"]]
    : [command: K, args: Commands[K]["args"]]
): Promise<ApiResponse<Commands[K]["result"]>> {
  try {
    return await invoke<ApiResponse<Commands[K]["result"]>>(
      command,
      args as Record<string, unknown>,
    );
  } catch (error) {
    return { ok: false, data: null, error: String(error) };
  }
}

/**
 * Igual a `call`, mas devolve `data` direto e lança em caso de erro.
 *
 * Serve para o caminho em que a tela já trata a falha num `try/catch` acima e
 * não quer desembrulhar o envelope campo a campo.
 */
export async function callOrThrow<K extends CommandName>(
  ...args: Parameters<typeof call<K>>
): Promise<Commands[K]["result"]> {
  const resposta = await call<K>(...args);
  if (!resposta.ok || resposta.data === null) {
    throw new Error(resposta.error ?? "falha desconhecida no backend");
  }
  return resposta.data;
}
