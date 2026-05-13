# Art. 29 — Contratos Eel (@eel.expose)

## listar_infracoes_estatuto_art29
```
Guard: login | Saída: {success: true, infracoes: [{id: UUID, inciso, texto, ativo}]}
Nota: ordenação SQL romana — incisos com ^[IVXLC] por LENGTH, demais por texto
```

## obter_infracao_estatuto_art29
```
Guard: login | Entrada: id: str (UUID)
Saída ok: {success: true, infracao: {...}} | Saída err: {success: false}
```

## criar_infracao_estatuto_art29
```
Guard: admin | Entrada: inciso: str (obrigatório), texto: str (obrigatório)
Saída ok: {sucesso: true} | Saída err: {sucesso: false, mensagem: "Inciso já existe"}
Efeito: INSERT com UUID
```

## editar_infracao_estatuto_art29
```
Guard: admin | Entrada: id: UUID, inciso: str, texto: str
Saída ok: {sucesso: true} | Saída err: {sucesso: false, mensagem: str}
Efeito: check unicidade (excluindo próprio id) + UPDATE
```

## excluir_infracao_estatuto_art29
```
Guard: admin | Entrada: id: UUID
Saída ok: {sucesso: true} | Efeito: ativo=FALSE (soft delete)
```
