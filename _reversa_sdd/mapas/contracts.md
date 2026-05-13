# Mapas — Contratos Eel (@eel.expose)

## gerar_mapa_mensal

```
Guard: login
Entrada: mes: int (1-12), ano: int, tipo_processo: str
Saída ok:  {sucesso: true,
             dados: [{id, numero, tipo_detalhe, status_processo, concluido,
                       data_instauracao, data_conclusao, responsavel_nome,
                       responsavel_posto, responsavel_matricula, ...}],
             meta: {mes, ano, tipo_processo, total, total_andamento, total_concluidos}}
Saída err: {sucesso: false, mensagem: str}
```

## gerar_mapa_mensal_completo

```
Guard: login
Entrada: mes: int, ano: int
Saída ok:  {sucesso: true,
             dados: {
               "IPM": {dados: [...], totais: {total, andamento, concluidos}},
               "PAD": {dados: [...], totais: {...}},
               ...
             }}
Saída err: {sucesso: false, mensagem: str}
```

## salvar_mapa_mensal

```
Guard: login
Entrada: mes: int, ano: int, tipo_processo: str,
         dados_mapa: list | dict,
         usuario_id?: UUID
Saída ok:  {sucesso: true, mapa_id: UUID}
Saída err: {sucesso: false, mensagem: str}
Efeito:    INSERT na tabela de mapas com metadados calculados (total_processos, etc.)
```

## listar_mapas_salvos

```
Guard: login
Entrada: mes?: int, ano?: int, tipo_processo?: str (filtros IGNORADOS atualmente)
Saída ok:  {sucesso: true, mapas: [{id, mes, ano, tipo_processo, total_processos,
             total_concluidos, total_andamento, criado_em, usuario_nome}]}
Saída err: {sucesso: false, mensagem: str}
```

## obter_mapa_salvo

```
Guard: login
Entrada: mapa_id: str (UUID)
Saída ok:  {sucesso: true, mapa: {meta: {...}, dados: [...]}}
Saída err: {sucesso: false, mensagem: str}
```

## excluir_mapa_salvo

```
Guard: login
Entrada: mapa_id: str (UUID)
Saída ok:  {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito:    DELETE da tabela de mapas
```

## obter_tipos_processo_para_mapa

```
Guard: login
Saída: {sucesso: true, tipos: [{valor: str, label: str}]}
```

## Padrão de resposta

Todos os contratos usam `sucesso/mensagem` (pt-br).
