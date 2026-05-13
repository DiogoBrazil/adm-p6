# Indícios — Lacunas e Questões Abertas

## Q-01 🟢 — Lista de categorias válidas não encontrada em constante de código

**Lacuna:** A função `obter_categorias_indicios()` existe no router, mas a lista de categorias válidas não foi localizada como constante no código. É inferida a partir do campo `obter_estatistica_ipm_indicios` em `processos_service.py` que menciona `crimes_cpm`, `transgressoes_rdpm`, `transgressoes_art29` e `sem_indicios`.

**Pergunta:** Quais são exatamente as categorias válidas de indícios? A lista é extensível ou fixa?

**Resposta do usuário:** A lista é extensível pelo admin, cadastrada nas tabelas `transgressoes`, `infracoes_estatuto_art29` e `crimes_contravencoes`.

---

## Q-02 🟡 — Campo `categoria` (TEXT legado) coexiste com `categorias_indicios` (JSONB)

**Observação:** A tabela `pm_envolvido_indicios` tem dois campos para categorias: `categoria` (TEXT, herança do design original) e `categorias_indicios` (JSONB array). O código atualiza ambos, mas `categoria` recebe apenas `categorias[0]` (primeira categoria).

**Pergunta:** O campo `categoria` ainda é lido por alguma funcionalidade ativa? Pode ser deprecado na migração Rust?

---

## Q-03 🟡 — `salvar_indicios_pm_envolvido` aceita `conn/cursor` externos

**Observação:** A assinatura da função aceita `conn` e `cursor` opcionais, sugerindo que pode ser chamada dentro de uma transação maior. O router Eel passa `conn=None` (sem transação), mas o design sugere uso transacional interno.

**Pergunta:** A operação de salvar indícios deve ser atômica com outra operação? Se sim, qual?

---

## Q-04 🔴 — Debug prints extensivos no salvar indícios

**Observação:** A função `salvar_indicios_pm_envolvido` contém dezenas de `print()` de debug, incluindo o dump completo dos dados recebidos. Isso deve ser removido antes da migração para produção.

**Ação requerida:** Remover todos os prints de debug na migração para Rust.
