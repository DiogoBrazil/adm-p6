// Busca binária pelo MENOR px em que nada transborda: é de onde sai o PISO_PX
// de cada tela. Cole no console com `paginas/listagens.html` aberta.
(() => {
  const r = {};
  document.querySelectorAll("[data-tabela]").forEach((b) => {
    const t = b.querySelector("table");
    const ths = [...b.querySelectorAll("thead th")];
    const trs = [...b.querySelectorAll("tbody tr")];
    const original = t.style.minWidth;
    t.style.minWidth = "0px";
    const transborda = () => ths.some((th, i) => {
      if (th.scrollWidth - th.clientWidth > 1) return true;
      return trs.some((tr) => {
        const td = tr.children[i], cs = getComputedStyle(td);
        if (cs.overflow === "hidden" && cs.textOverflow === "ellipsis") return false;
        return td.scrollWidth - td.clientWidth > 1;
      });
    });
    let baixo = 400, alto = 1800;
    while (alto - baixo > 2) {
      const meio = (baixo + alto) >> 1;
      t.style.width = meio + "px";
      t.getBoundingClientRect();
      if (transborda()) baixo = meio; else alto = meio;
    }
    t.style.width = ""; t.style.minWidth = original;
    r[b.dataset.tabela] = { medido: alto, declarado: +b.dataset.pisoDeclarado,
      folga: +b.dataset.pisoDeclarado - alto };
  });
  console.table(r);
  return r;
})();
