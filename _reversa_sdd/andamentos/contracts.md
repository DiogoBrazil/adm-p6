# Andamentos — Contratos Eel (@eel.expose)

## adicionar_andamento

```
Guard: login
Entrada: processo_id: str (UUID), texto: str, usuario_nome?: str (default "Sistema")
Saída ok:  {sucesso: true, mensagem: "Andamento adicionado com sucesso",
             andamento: {id: UUID, texto: str, data: "YYYY-MM-DD HH:MM:SS", usuario: str}}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPDATE processos_procedimentos SET andamentos = [novo, ...anteriores]
```

## listar_andamentos

```
Guard: login
Entrada: processo_id: str (UUID)
Saída ok:  {sucesso: true, andamentos: [{id, data, texto, descricao, usuario, usuario_nome}]}
Saída err: {sucesso: false, mensagem: str}
Nota:      campos duplicados (texto/descricao, usuario/usuario_nome) por compatibilidade frontend
```

## listar_andamentos_processo

```
Guard: login
Entrada: processo_id: str (UUID)
Saída: idêntica a listar_andamentos (alias para compatibilidade)
```

## remover_andamento

```
Guard: login
Entrada: processo_id: str (UUID), andamento_id: str (UUID)
Saída ok:  {sucesso: true, mensagem: str}
Saída err: {sucesso: false, mensagem: str}
Efeito:    UPDATE processos_procedimentos SET andamentos = [lista sem o andamento removido]
```

## obter_tipos_andamento

```
Guard: login
Saída: {sucesso: true, tipos: [str]}
```

## calcular_prazo_processo

```
Guard: login
Entrada: tipo_processo: str, data_inicio: str (ISO date), dias_prazo?: int
Saída ok:  {sucesso: true, data_vencimento: str (ISO date), dias_prazo: int}
Saída err: {sucesso: false, mensagem: str}
```

## Padrão de resposta

Todos os contratos usam `sucesso/mensagem` (pt-br).
`listar_andamentos` retorna campos duplicados (`texto`+`descricao`, `usuario`+`usuario_nome`) para compatibilidade com diferentes versões do frontend.
