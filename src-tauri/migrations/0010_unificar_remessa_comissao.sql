-- =============================================================================
-- Nos ritos que tramitam por comissão, "Remessa do encarregado" e "Remessa à
-- comissão" representam o mesmo fato. O legado só tinha a primeira coluna e,
-- por isso, a importação inicial deixou `data_remessa_comissao` vazia até para
-- CD, CJ e PAD.
--
-- O atributo semântico decide, nunca a sigla. Se as duas colunas tiverem valor,
-- o campo específico da comissão vence: ele pode ter sido corrigido no app
-- depois da importação. A coluna genérica é então limpa para restabelecer uma
-- única fonte de verdade.
-- =============================================================================

UPDATE processos_procedimentos p
   SET data_remessa_comissao = COALESCE(p.data_remessa_comissao,
                                        p.data_remessa_encarregado),
       data_remessa_encarregado = NULL,
       updated_at = now()
  FROM apuratorios a
 WHERE a.id = p.apuratorio_id
   AND a.permite_remessa_comissao
   AND (p.data_remessa_encarregado IS NOT NULL
        OR p.data_remessa_comissao IS NOT NULL);
