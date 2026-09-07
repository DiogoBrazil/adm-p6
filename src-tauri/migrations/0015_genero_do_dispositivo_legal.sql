-- Concordância do artigo com o dispositivo legal citado.
--
-- O rótulo de um enquadramento passa a ser escrito na ordem em que se cita uma
-- norma: "Art. 312 do Código Penal Militar", "Art. 33 da Lei de Drogas". O
-- conector muda com o gênero do nome, e o nome é cadastro administrável — então
-- ele não pode ser deduzido do texto. Vira atributo semântico da linha, como
-- `e_estatuto_militar` já é nesta mesma tabela.

ALTER TABLE dispositivos_legais
    ADD COLUMN nome_feminino BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN dispositivos_legais.nome_feminino IS
    'Escolhe o conector do rótulo do enquadramento: "da" quando marcado, "do" quando não.';

-- Retroalimentação única, pelos nomes que existem hoje. É o mesmo caminho da
-- decisão 45: casar por nome acontece uma vez, aqui; daqui em diante quem lê é
-- o booleano, e um dispositivo novo resolve a concordância pela tela.
UPDATE dispositivos_legais
   SET nome_feminino = true
 WHERE lower(nome) LIKE 'lei %';
