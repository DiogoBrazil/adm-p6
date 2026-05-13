# User Stories — Fluxo de Gestão de Processos

## Contexto

O sistema SJD Gestor gerencia o ciclo de vida de processos e procedimentos disciplinares da PMRO. O fluxo principal envolve o registro, acompanhamento (prazos + andamentos), atualização com solução e arquivamento.

## US-01 — Registrar novo procedimento SR

**Como** operador logado  
**Quero** registrar uma Sindicância Reservada (SR)  
**Para** iniciar o controle formal do procedimento no sistema

**Critérios de aceite:**
- Posso informar: número, documento iniciador, local de origem, data de instauração, encarregado responsável
- O sistema calcula automaticamente o ano de instauração
- O sistema determina a natureza com base nas transgressões selecionadas
- Um prazo base de 30 dias é criado automaticamente
- Não é possível registrar número duplicado (mesma chave de unicidade no mesmo ano/local/tipo)
- Posso adicionar múltiplos PMs envolvidos com seus status individuais

---

## US-02 — Registrar PAD (sem encarregado)

**Como** operador logado  
**Quero** registrar um Processo Administrativo Disciplinar (PAD)  
**Para** documentar o processo formal com presidente e escrivão

**Critérios de aceite:**
- Para PAD/CD/CJ, o campo "encarregado" não é aplicável — o sistema deixa `responsavel_id=NULL`
- Devo informar: presidente, escrivão do processo, interrogante
- O sistema aceita os mesmos dados de PMs envolvidos

---

## US-03 — Acompanhar prazos do processo

**Como** encarregado responsável  
**Quero** visualizar os prazos ativos dos processos sob minha responsabilidade  
**Para** garantir que os processos sejam concluídos dentro do prazo legal

**Critérios de aceite:**
- Vejo uma lista de processos com prazos vencendo nos próximos 7 dias
- Vejo processos com prazos já vencidos (em atraso)
- Para cada processo, posso ver a data de vencimento e os dias restantes/atrasados
- Posso solicitar prorrogação informando: número de dias, número e data da portaria, motivo

---

## US-04 — Registrar andamento de processo

**Como** operador logado  
**Quero** registrar movimentações no processo  
**Para** manter histórico de acompanhamento do procedimento

**Critérios de aceite:**
- Posso adicionar texto de andamento em qualquer processo ativo
- O andamento registra automaticamente data e hora
- O meu nome de usuário é registrado como autor
- Os andamentos mais recentes aparecem primeiro
- Posso remover um andamento específico

---

## US-05 — Concluir processo com solução

**Como** operador logado  
**Quero** registrar a conclusão de um processo com sua solução  
**Para** encerrar o ciclo de vida do procedimento

**Critérios de aceite:**
- Para processos (PAD/CD/CJ): soluções disponíveis são `Punido`, `Absolvido`, `Arquivado`
- Para procedimentos (SR/IPM/etc.): soluções são `Homologado`, `Avocado`, `Arquivado`
- Se solução = `Punido`: posso informar penalidade (`Prisao`, `Detencao`, `Repreensao`, etc.)
- Se penalidade = `Prisao` ou `Detencao`: posso informar número de dias
- Se solução ≠ `Punido`: penalidade é automaticamente limpa pelo sistema
- Data de conclusão é obrigatória para concluir

---

## US-06 — Salvar PDF do processo

**Como** operador logado  
**Quero** anexar o PDF do processo ao registro no sistema  
**Para** ter o documento legal armazenado junto ao processo digital

**Critérios de aceite:**
- Posso selecionar um arquivo PDF de até 100 MB
- O sistema converte e armazena o PDF como BYTEA no banco
- Posso visualizar o PDF a partir do sistema
- Posso substituir o PDF existente (upload sobrescreve)
- Posso remover o PDF do processo

---

## US-07 — Consultar histórico de encarregados

**Como** gestor (admin)  
**Quero** ver o histórico de substituições de encarregado de um processo  
**Para** auditar a cadeia de responsabilidade do processo

**Critérios de aceite:**
- O histórico mostra: encarregado anterior, data da substituição, justificativa
- Após substituição, o novo encarregado passa a ser o responsável ativo
- O histórico é imutável (append-only no campo JSONB)

---

## US-08 — Gerar mapa mensal

**Como** gestor  
**Quero** gerar o mapa mensal de processos  
**Para** ter uma visão consolidada dos processos do mês para relatório formal

**Critérios de aceite:**
- Seleciono mês, ano e tipo de processo
- O sistema retorna: processos em andamento instaurados até o mês + concluídos no mês
- Para cada processo, vejo: número, encarregado, data instauração, status, solução
- Posso salvar o mapa gerado para consulta histórica
- Posso gerar mapa completo (todos os tipos de uma vez)
