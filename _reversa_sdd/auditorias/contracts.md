# Auditorias — Contratos Eel (@eel.expose)

## listar_auditorias

```
Guard: admin
Entrada: search_term?: str,
         page: int (default 1),
         per_page: int (default 10),
         filtros?: {operacao?: "CREATE"|"UPDATE"|"DELETE", tabela?: str}
Saída ok:  {sucesso: true,
             auditorias: [{tabela, registro_id, operacao, timestamp,
                            usuario_nome, usuario_posto}],
             total: int,
             total_pages: int,
             current_page: int,
             per_page: int}
Saída err: {sucesso: false, mensagem: str}
```

## obter_auditoria_detalhada

```
Guard: admin
Entrada: auditoria_id: str (UUID)
Saída ok:  {sucesso: true, auditoria: {id, tabela, registro_id, operacao, timestamp,
             usuario_id, usuario_nome, usuario_posto}}
Saída err: {sucesso: false, mensagem: str}
```

## obter_auditorias_por_registro

```
Guard: admin
Entrada: tabela: str, registro_id: str
Saída ok:  {sucesso: true, auditorias: [{operacao, timestamp, usuario_nome, usuario_posto}]}
Saída err: {sucesso: false, mensagem: str}
```

## obter_auditorias_por_usuario

```
Guard: admin
Entrada: usuario_id: str (UUID), page: int (default 1), per_page: int (default 10)
Saída ok:  {sucesso: true,
             auditorias: [{tabela, registro_id, operacao, timestamp}],
             total: int, total_pages: int, current_page: int, per_page: int}
Saída err: {sucesso: false, mensagem: str}
```

## obter_estatisticas_auditoria

```
Guard: admin
Entrada: data_inicio?: str (ISO date), data_fim?: str (ISO date)
Saída ok:  {sucesso: true, estatisticas: {
             por_operacao: [{operacao, total}],
             por_tabela: [{tabela, total}],
             total_geral: int
           }}
Saída err: {sucesso: false, mensagem: str}
```

## Padrão de resposta

Todos os contratos usam `sucesso/mensagem` (pt-br).
Apenas admins (`guard_admin`) têm acesso a qualquer função deste módulo.
