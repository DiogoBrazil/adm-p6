-- Separa capacidades que antes eram inferidas pela tela a partir do nome do
-- apuratorio. Acusacao, indicio e solucao sugerida sao fatos diferentes e um
-- processo como o PADE nao pertence automaticamente a nenhum dos dois fluxos.
ALTER TABLE apuratorios
    ADD COLUMN permite_acusacao           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN permite_acusacao_penal     BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN permite_indicios           BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN permite_solucao_sugerida   BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN apuratorios.permite_acusacao IS
    'O cadastro do processo recebe enquadramentos juridicos do acusado.';
COMMENT ON COLUMN apuratorios.permite_acusacao_penal IS
    'A acusacao pode conter crime ou contravencao, alem de infracao disciplinar.';
COMMENT ON COLUMN apuratorios.permite_indicios IS
    'O procedimento investigativo permite registrar indicios ao final da apuracao.';
COMMENT ON COLUMN apuratorios.permite_solucao_sugerida IS
    'O resultado do envolvido admite solucao sugerida pelo encarregado.';

-- A lista e uma configuracao inicial de migracao, nao uma regra de runtime.
-- Depois de gravados, somente os atributos acima dirigem o comportamento.
UPDATE apuratorios
   SET permite_acusacao = true
 WHERE upper(sigla) IN ('PADS', 'CD', 'CJ', 'PAD');

UPDATE apuratorios
   SET permite_acusacao_penal = true
 WHERE upper(sigla) IN ('CD', 'CJ', 'PAD');

UPDATE apuratorios a
   SET permite_indicios = true,
       permite_solucao_sugerida = true
  FROM tipos_apuratorio ta
 WHERE ta.id = a.tipo_apuratorio_id
   AND lower(ta.nome) = 'procedimento';

ALTER TABLE apuratorios
    ADD CONSTRAINT ck_apuratorio_acusacao_penal
    CHECK (NOT permite_acusacao_penal OR permite_acusacao);
