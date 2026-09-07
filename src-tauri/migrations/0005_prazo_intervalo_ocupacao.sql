-- =============================================================================
-- O intervalo de OCUPAÇÃO de um prazo passa a excluir o dia do vencimento.
--
-- Motivo, medido contra os 8 anos de histórico da Seção: em 97 de 97
-- prorrogações o novo prazo começa EXATAMENTE no dia em que o anterior vence.
-- Não é defeito de dado — é a convenção que a Seção sempre praticou: o dia do
-- vencimento é o dia em que a prorrogação é concedida, e por isso pertence aos
-- dois períodos do ponto de vista do calendário, mas a UM só do ponto de vista
-- da ocupação.
--
-- O EXCLUDE original usava daterange(..., '[]') — fechado nas duas pontas — e
-- recusaria as 97. Com '[)' o dia do vencimento deixa de ser disputado e as
-- 97 entram sem que nenhuma data registrada seja reescrita (princípio 5).
--
-- O QUE NÃO MUDA: `data_vencimento` continua sendo o ÚLTIMO DIA VÁLIDO do
-- prazo. A coluna gerada (`data_inicio + dias`) fica intacta, e nenhuma
-- consulta que compare `data_vencimento` precisa de ajuste. O que muda é só o
-- intervalo que o índice GiST usa para detectar sobreposição.
--
-- Consequência no código, aplicada junto: deadlines::add_extension passa a
-- iniciar a prorrogação NO dia do vencimento anterior, e não no dia seguinte.
-- O sistema novo passa a praticar a mesma convenção do histórico que importa.
-- =============================================================================

ALTER TABLE processo_prazos DROP CONSTRAINT ex_prazo_sobreposicao;

ALTER TABLE processo_prazos ADD CONSTRAINT ex_prazo_sobreposicao
    EXCLUDE USING gist (
        processo_id WITH =,
        daterange(data_inicio, data_inicio + dias, '[)') WITH &&
    );
