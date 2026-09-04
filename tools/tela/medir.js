// Cole no console do navegador com `paginas/listagens.html` aberta.
// Devolve, por tabela e por largura de janela, o que ainda transborda.
(async () => {
  const main = document.querySelector(".main");
  const sidebar = document.querySelector(".sidebar");
  const relatorio = [];
  for (const janela of [1024, 1280, 1600]) {
    main.style.width = janela - sidebar.getBoundingClientRect().width + "px";
    await new Promise((r) => requestAnimationFrame(r));
    const linha = { janela, tabelas: {} };
    document.querySelectorAll("[data-tabela]").forEach((b) => {
      const wrap = b.querySelector(".table-wrap");
      const ths = [...b.querySelectorAll("thead th")];
      const trs = [...b.querySelectorAll("tbody tr")];
      const ruins = [];
      ths.forEach((th, i) => {
        let pior = 0;
        for (const tr of trs) {
          const td = tr.children[i], cs = getComputedStyle(td);
          // Coluna `truncar` corta com reticências: transbordar ali é o certo.
          if (cs.overflow === "hidden" && cs.textOverflow === "ellipsis") continue;
          pior = Math.max(pior, td.scrollWidth - td.clientWidth);
        }
        pior = Math.max(pior, th.scrollWidth - th.clientWidth);
        if (pior > 1) ruins.push(th.textContent.trim() + "+" + pior);
      });
      linha.tabelas[b.dataset.tabela] = {
        pisoDeclarado: +b.dataset.pisoDeclarado,
        larguraUtil: Math.round(wrap.clientWidth),
        rolaH: wrap.scrollWidth > wrap.clientWidth + 1,
        transbordos: ruins,
      };
    });
    relatorio.push(linha);
  }
  main.style.width = "";
  console.table(relatorio.flatMap((l) =>
    Object.entries(l.tabelas).map(([nome, t]) => ({ janela: l.janela, tabela: nome, ...t,
      transbordos: t.transbordos.join(", ") || "—" }))));
  return relatorio;
})();
