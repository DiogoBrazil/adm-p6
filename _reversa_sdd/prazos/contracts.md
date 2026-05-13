# Prazos — Contratos Eel (@eel.expose)

## listar_prazos_processo

```
Guard: login
Entrada: processo_id: str (UUID)
Saída ok:  {sucesso: true, prazos: [{id, tipo_prazo, data_inicio, data_vencimento,
             dias_adicionados, motivo, numero_portaria, data_portaria,
             ordem_prorrogacao, ativo}]}
Saída err: {sucesso: false, mensagem: str}
```

## adicionar_prorrogacao

```
Guard: login
Entrada: processo_id: str, dias_prorrogacao: int,
         numero_portaria?: str, data_portaria?: str,
         motivo?: str, autorizado_por?: UUID, autorizado_tipo?: str
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPDATE prazo ativo → ativo=0;
           INSERT novo prazo tipo_prazo='prorrogacao' com nova data de vencimento
```

## obter_prazos_vencendo

```
Guard: login
Entrada: dias_antecedencia: int (default 7)
Saída ok:  {sucesso: true, prazos: [{processo_id, numero_processo, tipo_detalhe,
             data_vencimento, dias_restantes}]}
Saída err: {sucesso: false, mensagem: str}
```

## obter_prazos_vencidos

```
Guard: login
Saída ok:  {sucesso: true, prazos: [{processo_id, numero_processo, tipo_detalhe,
             data_vencimento, dias_atraso}]}
Saída err: {sucesso: false, mensagem: str}
```

## obter_dashboard_prazos

```
Guard: login
Saída ok:  {sucesso: true, dashboard: {
             vencidos: int,
             vencendo_em_7_dias: int,
             em_andamento: int,
             concluidos: int
           }}
Saída err: {sucesso: false, mensagem: str}
```

## gerar_relatorio_prazos

```
Guard: login
Entrada: filtros?: {data_inicio?: str, data_fim?: str, tipo_detalhe?: str, status?: str}
Saída ok:  {sucesso: true, relatorio: [{processo_id, numero, tipo_detalhe,
             data_instauracao, prazo_atual, data_vencimento, status}]}
Saída err: {sucesso: false, mensagem: str}
```

## concluir_prazo_processo

```
Guard: login
Entrada: processo_id: str (UUID), responsavel_id?: UUID
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    marca prazo ativo como concluído (ativo=0)
```

## registrar_andamento_processo

```
Guard: login
Entrada: processo_id: str, tipo_andamento: str, descricao: str,
         data_andamento?: str, responsavel_id?: UUID, observacoes?: str
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    INSERT em tabela de andamentos (ver módulo andamentos)
```

## Padrão de resposta

Todos os contratos usam `sucesso/mensagem` (pt-br).
