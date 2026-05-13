# Catálogos — Contratos Eel (@eel.expose)

## listar_crimes_contravencoes
```
Guard: login
Entrada: (nenhuma)
Saída: {success: true, crimes: [{id, tipo, dispositivo_legal, artigo, descricao_artigo, paragrafo, inciso, alinea, ativo}]}
```

## obter_crime_por_id
```
Guard: login
Entrada: id: str (UUID)
Saída ok: {success: true, crime: {...}}
Saída err: {success: false, error: "Crime não encontrado"}
```

## cadastrar_crime
```
Guard: admin
Entrada: tipo, dispositivo_legal, artigo, descricao_artigo, paragrafo?, inciso?, alinea?
Saída ok: {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito: INSERT + auditoria CREATE
```

## atualizar_crime
```
Guard: admin
Entrada: id: str + mesmos campos do cadastro
Saída ok: {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito: UPDATE + auditoria UPDATE
```

## excluir_crime_contravencao
```
Guard: admin
Entrada: id: str (UUID)
Saída ok: {sucesso: true}
Saída err: {sucesso: false, mensagem: str}
Efeito: UPDATE ativo=FALSE (soft delete)
```

## buscar_municipios_distritos
```
Guard: login
Entrada: termo: str
Saída: {success: true, municipios: [{id, nome, tipo, municipio_pai, nome_exibicao}]}
Nota: nome_exibicao = "{nome} ({municipio_pai})" para distritos
```

## Nota de Migração

Este módulo usa padrão de resposta inglês (`success/crimes/error`) enquanto os demais usam pt-br (`sucesso/dados/mensagem`). Uniformizar na migração Tauri.
