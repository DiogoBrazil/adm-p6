# RDPM — Contratos Eel (@eel.expose)

## listar_todas_transgressoes
```
Guard: login | Entrada: — | Saída: {success: true, transgressoes: [{id: int, artigo, gravidade, inciso, texto}]}
Nota: gravidade em title-case (aplicado na leitura, não no banco)
```

## obter_transgressao_por_id
```
Guard: login | Entrada: id: int | Saída ok: {success: true, transgressao: {...}} | Saída err: {success: false}
```

## cadastrar_transgressao
```
Guard: admin | Entrada: artigo: int, gravidade: str, inciso: str, texto: str
Saída ok: {sucesso: true} | Saída err: {sucesso: false, mensagem: str}
Efeito: INSERT + auditoria CREATE
```

## atualizar_transgressao
```
Guard: admin | Entrada: id: int + campos
Saída ok: {sucesso: true} | Saída err: {sucesso: false, mensagem: "Já existe transgressão com essa gravidade e inciso"}
Efeito: check unicidade + UPDATE + auditoria UPDATE
```

## excluir_transgressao
```
Guard: admin | Entrada: id: int
Saída ok: {sucesso: true} | Saída err: {sucesso: false, mensagem: str}
Efeito: DELETE real (hard delete) + auditoria DELETE
⚠️ RISCO: pode violar FK com pm_envolvido_rdpm se houver referências
```
