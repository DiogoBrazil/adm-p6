-- Regras operacionais acrescentadas depois da migração do legado.
--
-- `usa_documento_designacao` pertence à relação apuratório × papel: o mesmo
-- papel pode citar documento numa espécie e não citar em outra. O frontend não
-- precisa conhecer as palavras "IPM" ou "Escrivão" para decidir a exibição.
ALTER TABLE apuratorio_papeis
    ADD COLUMN usa_documento_designacao BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN apuratorio_papeis.usa_documento_designacao IS
    'False quando as designações deste papel não citam tipo/número de documento.';

-- O nome e a sigla são usados apenas para retroalimentar a configuração que já
-- existe. Depois desta migration, o comportamento lê exclusivamente o booleano.
UPDATE apuratorio_papeis ap
   SET usa_documento_designacao = false,
       updated_at = now()
  FROM apuratorios a, papeis_processo pap
 WHERE a.id = ap.apuratorio_id
   AND pap.id = ap.papel_id
   AND lower(trim(a.sigla)) = 'ipm'
   AND lower(trim(pap.nome)) = 'escrivão';
