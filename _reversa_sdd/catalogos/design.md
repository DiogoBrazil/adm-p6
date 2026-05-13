# Catálogos — Design Técnico

## Interface

| Símbolo | Guard | Entrada | Saída |
|---------|-------|---------|-------|
| `listar_crimes_contravencoes` | login | — | `{success: true, crimes: [...]}` |
| `obter_crime_por_id` | login | `id: str` | `{success: true, crime: {...}}` ou `{success: false}` |
| `cadastrar_crime` | admin | campos do crime | `{sucesso: true}` ou `{sucesso: false, mensagem}` |
| `atualizar_crime` | admin | `id` + campos | `{sucesso: true}` ou `{sucesso: false, mensagem}` |
| `excluir_crime_contravencao` | admin | `id: str` | `{sucesso: true}` ou `{sucesso: false}` |
| `buscar_municipios_distritos` | login | `termo: str` | `{success: true, municipios: [...]}` |

**Atenção:** este módulo usa o padrão `success/crimes` (inglês), diferente da maioria que usa `sucesso/dados`.

**Estrutura de um crime:**
```json
{
  "id": "UUID",
  "tipo": "Crime | Contravenção",
  "dispositivo_legal": "Código Penal Militar | ...",
  "artigo": "157",
  "descricao_artigo": "Roubo",
  "paragrafo": "1º",
  "inciso": "I",
  "alinea": "a",
  "ativo": true
}
```

## Fluxo Principal — Cadastrar Crime

```
1. guard_admin() — rejeita se não admin
2. Receber campos: tipo, dispositivo_legal, artigo, descricao, paragrafo, inciso, alinea
3. validar_campos_crime(artigo, paragrafo, inciso, alinea) via app/utils.py
   - artigo: regex ^[0-9]+$
   - paragrafo: ordinal ("1º", "único") ou converte número puro
   - inciso: romanos maiúsculos (IVXLCDM); .upper()
   - alinea: letra minúscula a-z; .lower()
4. Se inválido → retornar erro com descrição do campo
5. INSERT INTO crimes_contravencoes (id=UUID, ...)
6. registrar_auditoria('crimes_contravencoes', id, 'CREATE', usuario_id)
7. Retornar {sucesso: true}
```

## Fluxo Principal — Listar Crimes

```
1. guard_login()
2. SELECT * FROM crimes_contravencoes WHERE ativo=TRUE
   ORDER BY tipo, dispositivo_legal, artigo
3. Retornar {success: true, crimes: [...]}
```

## Fluxo Principal — Buscar Municípios

```
1. guard_login()
2. SELECT * FROM municipios_distritos
   WHERE nome ILIKE '%{termo}%' AND ativo=TRUE
   ORDER BY tipo, nome
3. Para registros com municipio_pai:
   nome_exibicao = f"{nome} ({municipio_pai})"
4. Retornar {success: true, municipios: [...]}
```

## Dependências

- `app/utils.py:validar_campos_crime` — validação de formato
- `db_manager.registrar_auditoria()` — trilha de auditoria
- Tabelas: `crimes_contravencoes`, `municipios_distritos`

## Decisões de Design Identificadas

| Decisão | Evidência no código | Confiança |
|---------|---------------------|-----------|
| Padrão de resposta inglês (success/crimes) — inconsistente com outros módulos | `app/routers/catalogos.py` | 🟢 |
| Soft delete para crimes (ativo=FALSE) | `app/catalogos.py` | 🟢 |
| Validação no router antes de chamar o módulo | `app/routers/catalogos.py:34-65` | 🟢 |
| Auditoria em CREATE e UPDATE (não em soft-delete) | `app/routers/catalogos.py` | 🟢 |

## Observabilidade

- 🟢 Auditoria na tabela `auditoria` para CREATE e UPDATE
- 🟡 Nenhum log de busca ou leitura

## Riscos e Lacunas

- 🟡 Padrão de resposta diferente dos demais módulos — o frontend trata ambos mas pode causar bugs na migração se padronizado para um único formato
- 🟡 `municipio_pai` é uma FK lógica por nome (texto), não por ID — sem integridade referencial
