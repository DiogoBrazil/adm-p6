-- Quem registra Ofendido/Vítima, semeado outra vez — agora que as espécies
-- existem.
--
-- A 0012 já fez esta mesma carga, e ela é a regra: todo PROCEDIMENTO apura um
-- fato, e fato tem ofendido; os PROCESSOS disciplinares são instaurados CONTRA
-- um militar e ficam de fora. O que ela não podia prever é QUANDO rodaria num
-- banco novo.
--
-- É a repetição literal do que a 0022 consertou na `ordem`, pela mesma causa.
-- Quem INSERE as linhas de `apuratorios` não é migration nenhuma: é
-- `importacao/01_catalogos.sql`. E `sqlx::migrate!` corre no start do app
-- (lib.rs), portanto ANTES da importação. Num destino novo — foi o caso do Neon
-- de produção — o UPDATE da 0012 rodou contra a tabela vazia: não acertou linha
-- nenhuma, sem erro e sem aviso, e as onze espécies nasceram depois no
-- `DEFAULT false`.
--
-- O estrago aqui é maior que o do mapa, porque desligado o atributo TIRA a
-- seção do formulário: `telas/processo.ts` desenha "Ofendidos/Vítimas
-- (opcional)" só quando `permite_cadastro_vitima` é verdadeiro, e no lugar dela
-- desenhou o aviso de espécie que não registra ofendido — inclusive nas 133
-- vítimas que `importacao/05_envolvidos.sql` tinha acabado de importar, que
-- ficaram legíveis e não editáveis. Nenhuma tela reclamou: com o atributo
-- desligado o backend só recusaria uma vítima ENVIADA, e a tela nunca enviava.
--
-- No banco de desenvolvimento a 0012 chegou DEPOIS da importação e pegou as
-- linhas prontas. É por isso que funcionava aqui e não lá.
--
-- Por que uma migration nova e não editar a 0012: `sqlx` guarda checksum por
-- versão, e mexer numa já aplicada quebra o startup seguinte com
-- `VersionMismatch`.
--
-- Isto não reescreve fato registrado (princípio 5) — ao contrário, é o que
-- devolve ao formulário fatos que já estavam gravados. E não atropela escolha de
-- administrador nenhuma: diferente de `ordem`, `permite_cadastro_vitima` está
-- deliberadamente fora de `legal_catalogs::CATALOGOS` (0012), é capacidade da
-- espécie e não há tela que a edite. Por isso o UPDATE só LIGA, no molde exato
-- da 0012: nada aqui desliga o que estiver ligado.
--
-- Idempotente: rodar num banco já correto não muda nada, e num destino novo
-- `apuratorios` está vazia e ele alcança 0 linhas — o dado nasce certo pelo
-- outro lado do conserto, o `permite_cadastro_vitima` que entrou no INSERT de
-- `importacao/01_catalogos.sql`. Esta migration é só quem alcança o que já foi
-- importado.
UPDATE apuratorios a
   SET permite_cadastro_vitima = true
  FROM tipos_apuratorio ta
 WHERE ta.id = a.tipo_apuratorio_id
   AND lower(ta.nome) = 'procedimento'
   AND NOT a.permite_cadastro_vitima;
