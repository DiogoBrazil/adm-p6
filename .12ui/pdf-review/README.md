# Revisão 12ui dos relatórios PDF

Revisão executada em 2026-09-02 com o `12ui` 0.2.48. Os PDFs em
`Pagina relatorios pdf/` são as emissões anteriores à correção; as imagens em
`fontes/` vêm das fixturas corrigidas impressas pelo WebKitGTK.

## Resultado

- As seis páginas corrigidas foram decompostas em LayerDoc e renderizadas de
  volta para PNG sem revelar sobreposição, corte de texto ou conteúdo fora da
  área útil.
- Designações corrigido: `EM ANDAMENTO / NO PRAZO` e
  `EM ANDAMENTO / VENCIDO` são grupos de duas linhas independentes e não se
  intersectam.
- Prazos corrigido: `1ª / prorrogação` foi reconhecido integralmente.
- Relatório Anual corrigido: `7. Seção curta` e a primeira linha `L0241`
  permanecem juntos.
- Painel e Estatísticas corrigidos mantêm cartões inteiros e fluxo vertical.

## Comparação geométrica

Os valores abaixo são as menores distâncias das caixas de texto às bordas do
canvas, em pixels, na ordem esquerda/topo/direita/base.

| Página | Original | Corrigida |
|---|---:|---:|
| Designações | 1,4 / 4,1 / 45,2 / 53,4 | 57,6 / 74,0 / 89,1 / 765,9 |
| Prazos | 1,4 / 5,5 / 2,7 / 134,3 | 57,6 / 75,4 / 82,3 / 767,3 |
| Painel | 1,4 / 4,1 / 112,4 / 238,4 | 57,6 / 74,0 / 244,1 / 294,6 |
| Estatísticas | 1,4 / 4,1 / 83,6 / 82,2 | 72,7 / 111,0 / 244,1 / 400,1 |
| Anual/seção | 1,4 / 11,0 / 42,5 / 72,6 | 57,6 / 72,6 / 233,1 / 683,7 |

No original de Designações, o 12ui encontrou estas interseções:

- `EM ANDAMENTO NO PRAZO` × `EM ANDAMENTO VENCIDOS`: 56,2 × 9,6 px;
- `EM ANDAMENTO VENCIDOS` × `TOTAL`: 48,0 × 9,6 px.

Nas seis páginas corrigidas, a mesma verificação não encontrou nenhuma
interseção entre caixas de texto.

## Artefatos

- `originais/`: páginas rasterizadas dos cinco PDFs fornecidos;
- `fontes/`: páginas representativas depois das correções;
- `runs/original-*`: LayerDocs das emissões antigas;
- `runs/*/rendered`: reconstruções PNG das páginas corrigidas.

Foram consumidas 11 conversões `fast` e 6 exportações derivadas. Os IDs e as
chaves idempotentes estão preservados em cada `journal.jsonl`, permitindo
replay sem nova conversão enquanto os artefatos permanecerem válidos.

Esta revisão confirma a geometria das saídas sintéticas corrigidas. A emissão
manual dos cinco relatórios com dados reais ainda é necessária para validar o
diálogo de impressão e o volume exato do banco local.
