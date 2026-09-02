/**
 * O brasão da PMRO, numa fonte só.
 *
 * Vivia em `src-tauri/icons/icon.png`, e essa é a vaga que `tauri icon`
 * sobrescreve ao gerar o ícone do app: o brasão que encabeça os documentos e o
 * ícone do executável são coisas diferentes, e dividir arquivo fazia com que
 * trocar um trocasse o outro — inclusive dentro do Mapa Mensal.
 *
 * A constante estava declarada três vezes, idêntica, em `main.ts`, `anual.ts` e
 * `mapa-pdf.ts`. Agora é uma: quem precisa do brasão importa daqui.
 */
export const brasaoUrl = new URL("./assets/brasao-pmro.png", import.meta.url).href;
