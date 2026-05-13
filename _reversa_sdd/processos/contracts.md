# Processos e Procedimentos — Contratos Eel (@eel.expose)

## registrar_processo

```
Guard: login
Entrada: numero, tipo_geral, tipo_detalhe, documento_iniciador, local_origem,
         data_instauracao, data_conclusao, concluido, ano_instauracao,
         responsavel_id, responsavel_tipo,
         presidente_id, presidente_tipo,
         escrivao_processo_id, escrivao_processo_tipo,
         interrogante_id, interrogante_tipo,
         natureza, solucao_tipo,
         penalidade_tipo, penalidade_dias,
         nome_vitima, observacao,
         transgressoes (list[dict]),
         pms_envolvidos (list[dict])
Saída ok:  {sucesso: true, processo_id: UUID}
Saída err: {sucesso: false, mensagem: str}
Efeito:    INSERT processos_procedimentos; INSERT procedimento_pms_envolvidos[];
           registrar_auditoria CREATE; criar prazo_base automático
```

## atualizar_processo

```
Guard: login
Entrada: id: UUID + mesmos parâmetros do registrar_processo (exceto pms_envolvidos)
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPDATE processos_procedimentos; registrar_auditoria UPDATE
Nota:      mesmas regras de negócio de normalização (penalidade, natureza)
```

## listar_processos

```
Guard: login
Entrada: tipo_geral?: str, tipo_detalhe?: str, concluido?: bool,
         responsavel_id?: UUID, ano?: int,
         offset?: int (default 0), limit?: int (default 50)
Saída ok: {sucesso: true, processos: [{id, numero, tipo_geral, tipo_detalhe,
           documento_iniciador, local_origem, data_instauracao, concluido,
           responsavel_nome, presidente_nome, natureza, solucao_tipo}],
           total: int}
```

## obter_processo

```
Guard: login
Entrada: id: str (UUID)
Saída ok:  {sucesso: true, processo: {
             ...todos os campos de processos_procedimentos,
             pms_envolvidos: [{pm_id, nome_completo, posto_graduacao,
                               matricula, status_pm, indicios: [...]}]
           }}
Saída err: {sucesso: false}
```

## excluir_processo

```
Guard: login
Entrada: id: str (UUID)
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPDATE processos_procedimentos SET ativo=FALSE;
           registrar_auditoria DELETE
```

## substituir_encarregado

```
Guard: login
Entrada: id: UUID, novo_responsavel_id: UUID, justificativa: str
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPDATE responsavel_id; JSONB append em historico_encarregados
           [{id, nome, data_substituicao, justificativa}]
```

## salvar_pdf_processo

```
Guard: login
Entrada: processo_id: str (UUID), nome_arquivo: str,
         conteudo_base64: str, content_type: str
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    base64.b64decode → bytes;
           UPDATE SET pdf_arquivo=BYTEA, pdf_nome, pdf_content_type,
                      pdf_tamanho, pdf_upload_em=NOW()
```

## obter_pdf_processo

```
Guard: login
Entrada: processo_id: str (UUID), incluir_conteudo: bool (default false)
Saída ok:  {sucesso: true, pdf: {nome, content_type, tamanho, upload_em,
                                 conteudo?: str (base64)}}
Saída sem PDF: {sucesso: true, pdf: null}
Saída err: {sucesso: false}
```

## remover_pdf_processo

```
Guard: login
Entrada: processo_id: str (UUID)
Saída ok:  {sucesso: true}
Saída err: {sucesso: false}
Efeito:    UPDATE SET pdf_arquivo=NULL, pdf_nome=NULL, pdf_content_type=NULL,
                      pdf_tamanho=NULL, pdf_upload_em=NULL
```

## obter_estatistica_pads_solucoes

```
Guard: login
Entrada: ano?: int
Saída ok: {sucesso: true, estatisticas: [
            {solucao_tipo: str, quantidade: int}
           ]}
Critério: tipo_detalhe='PADS', concluido=TRUE, ativo=TRUE;
          filtro opcional por ano_instauracao
```

## obter_estatistica_ipm_indicios

```
Guard: login
Entrada: ano?: int
Saída ok: {sucesso: true, estatisticas: {
            crimes_cpm: int,
            transgressoes_rdpm: int,
            transgressoes_art29: int,
            sem_indicios: int
           }}
Critério: tipo_detalhe IN ('IPM','IPPM'), ativo=TRUE;
          categorias de indícios de pm_envolvido_indicios.categorias_indicios JSONB
```

## Padrão de resposta

Todos os contratos usam chaves em **português** (`sucesso`, `mensagem`, `processo`, `processos`).
O campo `mensagem` está presente em erros; omitido em sucesso.
