(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))s(o);new MutationObserver(o=>{for(const t of o)if(t.type==="childList")for(const i of t.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&s(i)}).observe(document,{childList:!0,subtree:!0});function n(o){const t={};return o.integrity&&(t.integrity=o.integrity),o.referrerPolicy&&(t.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?t.credentials="include":o.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function s(o){if(o.ep)return;o.ep=!0;const t=n(o);fetch(o.href,t)}})();async function ue(e,a={},n){return window.__TAURI_INTERNALS__.invoke(e,a,n)}const J=[{path:"/dashboard",label:"Dashboard",group:"Geral",command:"dashboard_summary",printable:!0},{path:"/procedimentos/lista",label:"Procedimentos",group:"Procedimentos",command:"proceedings_list",csvExport:{tipoRelatorio:"processos"},printable:!0,searchable:!0,detailCommand:"proceedings_get",itemsKey:"items"},{path:"/prazos",label:"Prazos",group:"Procedimentos",printable:!0},{path:"/catalogos/transgressoes",label:"Transgressões",group:"Catálogos",command:"legal_catalogs_list_transgressions",writeCommands:["legal_catalogs_save_transgression","legal_catalogs_delete_transgression"]},{path:"/catalogos/crimes",label:"Crimes e Contravenções",group:"Catálogos",command:"legal_catalogs_list_crimes",writeCommands:["legal_catalogs_save_crime","legal_catalogs_delete_crime"]},{path:"/catalogos/art29",label:"Estatuto Art. 29",group:"Catálogos",command:"legal_catalogs_list_art29",writeCommands:["legal_catalogs_save_art29","legal_catalogs_delete_art29"]},{path:"/usuarios/lista",label:"Usuários",group:"Usuários",command:"users_list",writeCommands:["users_save","users_delete","users_reactivate"],printable:!0,detailCommand:"users_get"},{path:"/usuarios/novo",label:"Novo usuário",group:"Usuários",command:"users_form_schema",adminOnly:!0},{path:"/auditoria",label:"Auditoria",group:"Auditoria",command:"audit_list",printable:!0,detailCommand:"audit_get"},{path:"/estatisticas/encarregados",label:"Estatísticas de Encarregados",group:"Relatórios",command:"reports_by_responsible",csvExport:{tipoRelatorio:"encarregados"},printable:!0},{path:"/estatisticas/processos",label:"Estatísticas de Processos",group:"Relatórios",command:"reports_by_type",printable:!0},{path:"/estatisticas/prazos",label:"Prazos Vencidos",group:"Relatórios",command:"reports_overdue_deadlines",csvExport:{tipoRelatorio:"prazos"},printable:!0},{path:"/mapas/mensal",label:"Mapa Mensal",group:"Mapas",printable:!0},{path:"/mapas/anteriores",label:"Mapas Salvos",group:"Mapas",command:"reports_saved_maps",printable:!0,detailCommand:"reports_get_saved_map"},{path:"/estatisticas/anuais",label:"Estatísticas Anuais",group:"Relatórios",printable:!0},{path:"/stats/procedimentos",label:"Estatísticas de Procedimentos",group:"Relatórios",printable:!0}],me=["Despacho","Distribuição","Juntada","Remessa","Retorno","Decisão","Notificação","Citação","Prorrogação","Conclusão","Outros"];function ve(e){return e?e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`:""}let D=null,ae="/dashboard",I=[],L="",f=null,A=new Date().getFullYear(),B=null,z={tabela:"",operacao:"",usuario_id:""};const re=document.querySelector("#app"),X={"/usuarios/lista":{saveCommand:"users_save",deleteCommand:"users_delete",idKind:"string",fields:[{name:"tipo_usuario",label:"Tipo de usuário",kind:"select",required:!0,options:["Oficial","Praça"]},{name:"posto_graduacao",label:"Posto/graduação",kind:"text",required:!0},{name:"nome",label:"Nome",kind:"text",required:!0},{name:"matricula",label:"Matrícula",kind:"text",required:!0},{name:"is_encarregado",label:"Encarregado",kind:"checkbox"},{name:"is_operador",label:"Operador",kind:"checkbox"},{name:"email",label:"Email",kind:"email"},{name:"perfil",label:"Perfil",kind:"select",options:["admin","comum"]},{name:"senha",label:"Senha",kind:"password"}]},"/catalogos/crimes":{saveCommand:"legal_catalogs_save_crime",deleteCommand:"legal_catalogs_delete_crime",idKind:"string",fields:[{name:"tipo",label:"Tipo",kind:"select",options:["Crime","Contravenção"]},{name:"dispositivo_legal",label:"Dispositivo legal",kind:"text"},{name:"artigo",label:"Artigo",kind:"text",required:!0},{name:"descricao_artigo",label:"Descrição",kind:"textarea"},{name:"paragrafo",label:"Parágrafo",kind:"text"},{name:"inciso",label:"Inciso",kind:"text"},{name:"alinea",label:"Alínea",kind:"text"}]},"/catalogos/transgressoes":{saveCommand:"legal_catalogs_save_transgression",deleteCommand:"legal_catalogs_delete_transgression",idKind:"number",fields:[{name:"artigo",label:"Artigo",kind:"number"},{name:"gravidade",label:"Gravidade",kind:"select",options:["Leve","Média","Grave"]},{name:"inciso",label:"Inciso",kind:"text"},{name:"texto",label:"Texto",kind:"textarea",required:!0}]},"/catalogos/art29":{saveCommand:"legal_catalogs_save_art29",deleteCommand:"legal_catalogs_delete_art29",idKind:"string",fields:[{name:"inciso",label:"Inciso",kind:"text",required:!0},{name:"texto",label:"Texto",kind:"textarea",required:!0}]},"/procedimentos/lista":{saveCommand:"proceedings_create",updateCommand:"proceedings_update",deleteCommand:"proceedings_delete",idKind:"string",fields:[{name:"numero",label:"Número",kind:"text",required:!0},{name:"tipo_geral",label:"Tipo Geral",kind:"select",required:!0,options:["Processo","Procedimento"]},{name:"tipo_detalhe",label:"Tipo",kind:"select",required:!0,options:["PAD","PADE","CD","CJ","SR","SV","IPM","FP","CP","PADS"]},{name:"documento_iniciador",label:"Doc. Iniciador",kind:"select",required:!0,options:["Portaria","Memorando Disciplinar","Feito Preliminar"]},{name:"local_fatos",label:"Local dos Fatos",kind:"text",required:!0},{name:"local_origem",label:"Local de Origem",kind:"text"},{name:"data_instauracao",label:"Data de Instauração",kind:"date"},{name:"data_recebimento",label:"Data de Recebimento",kind:"date"},{name:"numero_portaria",label:"N° da Portaria",kind:"text"},{name:"numero_memorando",label:"N° do Memorando",kind:"text"},{name:"numero_feito",label:"N° do Feito",kind:"text"},{name:"numero_rgf",label:"N° RGF",kind:"text"},{name:"numero_controle",label:"N° de Controle",kind:"text"},{name:"processo_sei",label:"Processo SEI",kind:"text"},{name:"nome_vitima",label:"Nome da Vítima",kind:"text"},{name:"natureza_processo",label:"Natureza",kind:"text"},{name:"resumo_fatos",label:"Resumo dos Fatos",kind:"textarea"},{name:"concluido",label:"Concluído",kind:"checkbox"},{name:"data_conclusao",label:"Data de Conclusão",kind:"date"},{name:"solucao_tipo",label:"Tipo de Solução",kind:"select",options:["Punido","Absolvido","Arquivado","Homologado","Avocado"]},{name:"solucao_final",label:"Solução Final",kind:"textarea"},{name:"penalidade_tipo",label:"Penalidade",kind:"select",options:["Prisao","Detencao","Advertencia","Reprimenda"]},{name:"penalidade_dias",label:"Dias de Penalidade",kind:"number"}]}};function R(){return(D==null?void 0:D.is_admin)===!0}async function l(e,a={}){try{return await ue(e,a)}catch(n){return{ok:!1,data:null,error:String(n)}}}async function ge(){const e=await l("auth_current_user");D=e.ok?e.data:null}function be(){return J.reduce((e,a)=>(e[a.group]=e[a.group]??[],e[a.group].push(a),e),{})}function S(e){var n;const a=Object.entries(be()).map(([s,o])=>`
      <section class="nav-group">
        <h2>${s}</h2>
        ${o.map(t=>`
          <button class="nav-item ${t.path===ae?"active":""}" data-route="${t.path}">
            <span>${t.label}</span>
            ${t.adminOnly?"<small>admin</small>":""}
          </button>
        `).join("")}
      </section>
    `).join("");re.innerHTML=`
    <aside class="sidebar">
      <div class="brand">
        <strong>ADM P6</strong>
        <span>Rust/Tauri</span>
      </div>
      ${a}
    </aside>
    <main class="main">
      <header class="topbar">
        <div>
          <strong>${(D==null?void 0:D.nome)??"Sessão não autenticada"}</strong>
          <span>${(D==null?void 0:D.perfil)??"offline"}</span>
        </div>
        <button class="secondary" id="logout">Sair</button>
      </header>
      ${e}
    </main>
  `,document.querySelectorAll("[data-route]").forEach(s=>{s.addEventListener("click",()=>{ae=s.dataset.route??"/dashboard",N()})}),(n=document.querySelector("#logout"))==null||n.addEventListener("click",async()=>{await l("auth_logout"),D=null,te()})}function te(e=""){re.innerHTML=`
    <main class="login-screen">
      <form id="login-form" class="login-panel">
        <h1>ADM P6</h1>
        <label>Email<input name="email" type="email" autocomplete="username" required /></label>
        <label>Senha<input name="senha" type="password" autocomplete="current-password" required /></label>
        ${e?`<p class="error">${e}</p>`:""}
        <button type="submit">Entrar</button>
      </form>
    </main>
  `,document.querySelector("#login-form").addEventListener("submit",async a=>{a.preventDefault();const n=new FormData(a.currentTarget),s=await l("auth_login",{email:n.get("email"),senha:n.get("senha")});if(!s.ok||!s.data){te(s.error??"Falha ao autenticar.");return}D=s.data,ae="/dashboard",await N()})}function w(e,a){if(!Array.isArray(e))return`<pre>${r(JSON.stringify(e,null,2))}</pre>`;if(e.length===0)return'<p class="empty">Nenhum registro encontrado.</p>';const n=Object.keys(e[0]),s=!!X[a.path]&&R();return`
    <div class="table-wrap">
      <table>
        <thead><tr>${n.map(o=>`<th>${o}</th>`).join("")}${s?"<th>Ações</th>":""}</tr></thead>
        <tbody>
          ${e.map((o,t)=>`
            <tr data-row-index="${t}">
              ${n.map(i=>`<td>${r(ye(o[i]))}</td>`).join("")}
              ${s?`
                <td class="row-actions">
                  <button class="secondary small" data-edit-index="${t}">Editar</button>
                  <button class="danger small" data-delete-index="${t}">Excluir</button>
                </td>
              `:""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function he(e){var n;const a=X[e.path];return R()?a?'<div class="actions"><button id="new-record">Novo</button></div>':(n=e.writeCommands)!=null&&n.length?`<div class="actions">${e.writeCommands.map(s=>`<code>${s}</code>`).join("")}</div>`:"":'<p class="readonly">Perfil somente leitura: ações de criação, edição e remoção estão desabilitadas.</p>'}function _e(e,a){const n=e==null?void 0:e[a.name];return typeof n=="boolean"?n:n==null?"":String(n)}function fe(e,a){const n=_e(a,e),s=e.required?"required":"";if(e.kind==="checkbox")return`
      <label class="checkbox">
        <input name="${e.name}" type="checkbox" ${n===!0?"checked":""} />
        ${e.label}
      </label>
    `;if(e.kind==="select")return`
      <label>${e.label}
        <select name="${e.name}" ${s}>
          <option value=""></option>
          ${(e.options??[]).map(o=>`
            <option value="${r(o)}" ${n===o?"selected":""}>${r(o)}</option>
          `).join("")}
        </select>
      </label>
    `;if(e.kind==="textarea")return`<label>${e.label}<textarea name="${e.name}" ${s}>${r(String(n))}</textarea></label>`;if(e.kind==="date"){const o=String(n).substring(0,10);return`<label>${e.label}<input name="${e.name}" type="date" value="${r(o)}" ${s} /></label>`}return`<label>${e.label}<input name="${e.name}" type="${e.kind}" value="${r(String(n))}" ${s} /></label>`}function V(e,a=null,n=""){var t,i;const s=X[e.path];if(!s)return;const o=(a==null?void 0:a.id)??"";S(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${a?"Editar":"Novo"} - ${e.label}</h1>
          <p>${s.saveCommand}</p>
        </div>
        <button class="secondary" id="cancel-form">Cancelar</button>
      </div>
      <form id="crud-form" class="crud-form">
        <input type="hidden" name="id" value="${r(String(o))}" />
        ${s.fields.map(c=>fe(c,a)).join("")}
        ${n?`<p class="error">${n}</p>`:""}
        <div class="form-actions">
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `),(t=document.querySelector("#cancel-form"))==null||t.addEventListener("click",()=>{N()}),(i=document.querySelector("#crud-form"))==null||i.addEventListener("submit",async c=>{c.preventDefault();const g=new FormData(c.currentTarget),b=$e(s,g),v=!!b.id&&s.updateCommand?s.updateCommand:s.saveCommand,u=await l(v,{request:b});if(!u.ok){V(e,a,u.error??"Falha ao salvar.");return}await N()})}function $e(e,a){const n={},s=String(a.get("id")??"");n.id=s?ne(e,s):null;for(const o of e.fields){if(o.kind==="checkbox"){n[o.name]=a.get(o.name)==="on";continue}const t=String(a.get(o.name)??"").trim();if(o.kind==="number"){n[o.name]=t?Number(t):null;continue}n[o.name]=t||null}return n}function ne(e,a){return e.idKind==="number"?Number(a):a}function ie(e){var n;const a=X[e.path];e.detailCommand&&document.querySelectorAll("tbody tr[data-row-index]").forEach(s=>{s.style.cursor="pointer",s.addEventListener("click",o=>{var c;if(o.target.closest("button"))return;const t=Number(s.dataset.rowIndex),i=String(((c=I[t])==null?void 0:c.id)??"");i&&(f=i,T(e))})}),!(!a||!R())&&((n=document.querySelector("#new-record"))==null||n.addEventListener("click",()=>{V(e)}),document.querySelectorAll("[data-edit-index]").forEach(s=>{s.addEventListener("click",()=>{const o=Number(s.dataset.editIndex);V(e,I[o]??null)})}),document.querySelectorAll("[data-delete-index]").forEach(s=>{s.addEventListener("click",async()=>{const o=Number(s.dataset.deleteIndex),t=I[o],i=t==null?void 0:t.id;if(!a.deleteCommand||i===void 0||i===null||!confirm("Confirmar exclusão?"))return;const c=await l(a.deleteCommand,{id:ne(a,String(i))});if(!c.ok){alert(c.error??"Falha ao excluir.");return}await N()})}))}async function N(){if(!D){te();return}const e=J.find(v=>v.path===ae)??J[0];if(e.path==="/estatisticas/anuais")return de();if(e.path==="/prazos")return ke();if(e.path==="/mapas/mensal")return xe();if(e.path==="/auditoria")return oe();if(e.path==="/usuarios/lista")return Q();if(e.path==="/stats/procedimentos")return ce();e.searchable||(L="");const a=e.adminOnly&&!R();let n="";if(a?n=`<section class="panel"><h1>${e.label}</h1><p class="error">Seu perfil é somente leitura.</p></section>`:e.command&&(n=`<section class="panel"><h1>${e.label}</h1><p>Carregando...</p></section>`),S(n),!e.command||a)return;const s=e.searchable?{filter:{search:L||null}}:{},o=await l(e.command,s),t=o.data,i=e.itemsKey?t==null?void 0:t[e.itemsKey]:t;I=Array.isArray(i)?i:[];const c=he(e),g=F(e),b=e.path==="/dashboard"&&!Array.isArray(t),$=o.ok?b?Se(t):w(i,e):`<p class="error">${o.error}</p>`;S(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${e.label}</h1>
          <p>${e.path}</p>
        </div>
        <div class="page-head-right">
          ${c}
          ${g}
        </div>
      </div>
      ${Pe(e)}
      ${$}
    </section>
  `),ie(e),M(e)}function r(e){return e.replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[a]??a)}function ye(e){return typeof e=="boolean"?e?"sim":"não":String(e??"")}function Se(e){const a=(n,s,o=!1)=>`
    <div class="stat-card ${o?"stat-card--alert":""}">
      <span class="stat-value">${r(String(s??0))}</span>
      <span class="stat-label">${n}</span>
    </div>
  `;return`
    <div class="stat-grid">
      ${a("Total de Processos",e.total_processos)}
      ${a("Em Andamento",e.em_andamento)}
      ${a("Concluídos",e.concluidos)}
      ${a("Prazos Vencidos",e.prazos_vencidos,Number(e.prazos_vencidos)>0)}
    </div>
  `}async function T(e){var W,G,Z,ee,se,H,K,Y;if(!f||!e.detailCommand)return;if(B&&e.path==="/procedimentos/lista")return Ee(e);S('<section class="panel"><p>Carregando detalhes...</p></section>');const a=e.path==="/procedimentos/lista",[n,s,o]=await Promise.all([l(e.detailCommand,{id:f}),a?l("evidence_list_for_proceeding",{procedimento_id:f}):Promise.resolve({ok:!0,data:[],error:null}),a?l("deadlines_list",{processo_id:f}):Promise.resolve({ok:!0,data:[],error:null})]);if(!n.ok){S(`<section class="panel"><p class="error">${r(n.error??"Erro")}</p></section>`);return}const t=n.data??{},i=X[e.path],c=!!(i&&R()),g=Array.isArray(t.andamentos)?t.andamentos:[],b=!!t.pdf_nome,v=a?[["numero","Número"],["tipo_geral","Tipo Geral"],["tipo_detalhe","Tipo"],["documento_iniciador","Doc. Iniciador"],["processo_sei","SEI"],["data_instauracao","Instauração"],["data_recebimento","Recebimento"],["responsavel_nome","Encarregado"],["escrivao_nome","Escrivão"],["local_origem","Local Origem"],["local_fatos","Local dos Fatos"],["natureza_processo","Natureza"],["resumo_fatos","Resumo"],["concluido","Concluído"],["data_conclusao","Data Conclusão"],["solucao_tipo","Solução"],["solucao_final","Decisão Final"],["penalidade_tipo","Penalidade"],["penalidade_dias","Dias"]].filter(([d])=>{const m=t[d];return m!=null&&String(m).trim()!==""}).map(([d,m])=>{const y=t[d],x=typeof y=="boolean"?y?"Sim":"Não":String(y);return`<tr><th>${m}</th><td>${r(x)}</td></tr>`}).join(""):Object.entries(t).filter(([,d])=>d!=null&&String(d).trim()!==""&&typeof d!="object").map(([d,m])=>{const y=typeof m=="boolean"?m?"Sim":"Não":String(m);return`<tr><th>${r(d)}</th><td>${r(y)}</td></tr>`}).join(""),u=a?`
    <div class="detail-section">
      <h2>Andamentos <span class="badge">${g.length}</span></h2>
      ${g.length>0?`
        <ul class="andamentos-list">
          ${g.map(d=>`
            <li class="andamento-item">
              <div class="andamento-meta">
                ${d.tipo?`<strong class="andamento-tipo">${r(d.tipo)}</strong>`:""}
                <span>${r(d.data)}</span>
                <span>${r(d.usuario)}</span>
                ${R()?`<button class="danger small" data-remove-andamento="${r(d.id)}">Remover</button>`:""}
              </div>
              <p class="andamento-texto">${r(d.texto)}</p>
            </li>
          `).join("")}
        </ul>
      `:'<p class="empty">Nenhum andamento registrado.</p>'}
      ${R()?`
        <form id="add-movement-form" class="add-movement-form">
          <select name="tipo">
            <option value="">Tipo (opcional)</option>
            ${me.map(d=>`<option>${r(d)}</option>`).join("")}
          </select>
          <textarea name="texto" placeholder="Descreva o andamento..." required></textarea>
          <button type="submit">Adicionar Andamento</button>
        </form>
      `:""}
    </div>
  `:"",h=a?`
    <div class="detail-section">
      <h2>PDF Anexo</h2>
      ${b?`
        <div class="pdf-info">
          <span class="pdf-name">${r(String(t.pdf_nome))}</span>
          <span class="pdf-size">${ve(Number(t.pdf_tamanho??0))}</span>
          <button id="btn-view-pdf">Abrir PDF</button>
          ${R()?'<button class="danger small" id="btn-remove-pdf">Remover</button>':""}
        </div>
      `:`
        <p class="empty">Nenhum PDF anexado.</p>
        ${R()?`
          <label class="upload-label">
            Fazer Upload de PDF
            <input type="file" id="pdf-upload-input" accept=".pdf" />
          </label>
        `:""}
      `}
    </div>
  `:"",E=Array.isArray(s.data)?s.data:[],C=a?`
    <div class="detail-section">
      <h2>Indícios por PM <span class="badge">${E.length}</span></h2>
      ${E.length===0?'<p class="empty">Nenhum PM envolvido com indícios registrados.</p>':`
        <ul class="andamentos-list">
          ${E.map(d=>{const m=d.indicios??{categorias:[],crimes:[],rdpm:[],art29:[]},y=m.categorias.length>0?m.categorias.join(", "):"sem categorias",x=m.crimes.length+m.rdpm.length+m.art29.length;return`
              <li class="andamento-item">
                <div class="andamento-meta">
                  <strong>${r(d.posto_graduacao??"")} ${r(d.nome??d.pm_envolvido_id)}</strong>
                  <span class="badge">${x} item(s)</span>
                  <span>${r(y)}</span>
                  <button class="secondary small" data-evidence-pm="${r(d.pm_envolvido_id)}">Gerenciar Indícios</button>
                </div>
              </li>`}).join("")}
        </ul>
      `}
    </div>
  `:"",q=Array.isArray(o.data)?o.data:[],k=q.find(d=>d.ativo!==!1&&d.tipo_prazo==="inicial")??q.find(d=>d.ativo!==!1),_=a?`
    <div class="detail-section">
      <h2>Prazos <span class="badge">${q.length}</span></h2>
      ${q.length>0?`
        <div class="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Início</th><th>Vencimento</th><th>Dias+</th><th>Motivo</th><th>Status</th></tr></thead>
            <tbody>
              ${q.map(d=>`
                <tr>
                  <td>${r(String(d.tipo_prazo??""))}</td>
                  <td>${r(String(d.data_inicio??""))}</td>
                  <td>${r(String(d.data_vencimento??""))}</td>
                  <td>${r(String(d.dias_adicionados??""))}</td>
                  <td>${r(String(d.motivo??""))}</td>
                  <td>${d.ativo!==!1?'<span class="badge badge--warn">Ativo</span>':'<span class="badge">Encerrado</span>'}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `:'<p class="empty">Nenhum prazo cadastrado.</p>'}
      ${R()?`
        ${k?'<button class="secondary small" id="btn-close-deadline">Encerrar Prazo Ativo</button>':""}
        <details class="extension-details">
          <summary>Adicionar Prorrogação</summary>
          <form id="extension-form" class="add-movement-form" style="margin-top:12px">
            <label>Dias de prorrogação<input name="dias" type="number" min="1" required /></label>
            <label>Motivo<input name="motivo" type="text" required /></label>
            <label>Autorizado por<input name="autorizado_por" type="text" required /></label>
            <label>Tipo autorização<select name="autorizado_tipo">
              <option value="Portaria">Portaria</option>
              <option value="Memorando">Memorando</option>
              <option value="Despacho">Despacho</option>
            </select></label>
            <label>N° Portaria (opcional)<input name="numero_portaria" type="text" /></label>
            <label>Data Portaria (opcional)<input name="data_portaria" type="date" /></label>
            <button type="submit">Salvar Prorrogação</button>
          </form>
        </details>
      `:""}
    </div>
  `:"",p=r(String(t.numero??"Detalhe")),P=t.tipo_detalhe?`<small>${r(String(t.tipo_detalhe))}</small>`:"",U=t.concluido?'<span class="badge badge--ok">Concluído</span>':'<span class="badge badge--warn">Em Andamento</span>';S(`
    <section class="panel">
      <div class="page-head">
        <div><h1>${p} ${P} ${a?U:""}</h1><p>${f}</p></div>
        <div class="page-head-right">
          ${c?'<button id="edit-detail">Editar</button>':""}
          <button class="secondary" id="back-to-list">← Voltar</button>
          ${F({...e,csvExport:void 0})}
        </div>
      </div>
      <div class="table-wrap"><table class="detail-table"><tbody>${v}</tbody></table></div>
      ${h}
      ${_}
      ${C}
      ${u}
    </section>
  `),(W=document.querySelector("#back-to-list"))==null||W.addEventListener("click",()=>{f=null,N()}),c&&i&&((G=document.querySelector("#edit-detail"))==null||G.addEventListener("click",()=>{V(e,t)})),(Z=document.querySelector("#add-movement-form"))==null||Z.addEventListener("submit",async d=>{d.preventDefault();const m=new FormData(d.currentTarget),y=m.get("tipo").trim()||null,x=m.get("texto").trim(),O=await l("movements_add",{request:{processo_id:f,tipo:y,texto:x}});if(!O.ok){alert(O.error??"Falha ao adicionar andamento.");return}T(e)}),document.querySelectorAll("[data-remove-andamento]").forEach(d=>{d.addEventListener("click",async()=>{if(!confirm("Remover este andamento?"))return;const m=d.dataset.removeAndamento,y=await l("movements_remove",{processo_id:f,andamento_id:m});if(!y.ok){alert(y.error??"Falha ao remover.");return}T(e)})}),(ee=document.querySelector("#btn-view-pdf"))==null||ee.addEventListener("click",async()=>{var x;const d=await l("proceedings_get_pdf",{processo_id:f,include_content:!0});if(!d.ok||!((x=d.data)!=null&&x.conteudo)){alert("Falha ao carregar PDF.");return}const m=Uint8Array.from(atob(d.data.conteudo),O=>O.charCodeAt(0)),y=new Blob([m],{type:d.data.content_type??"application/pdf"});window.open(URL.createObjectURL(y),"_blank")}),(se=document.querySelector("#btn-remove-pdf"))==null||se.addEventListener("click",async()=>{if(!confirm("Remover o PDF anexado?"))return;const d=await l("proceedings_remove_pdf",{processo_id:f});if(!d.ok){alert(d.error??"Falha ao remover PDF.");return}T(e)}),(H=document.querySelector("#pdf-upload-input"))==null||H.addEventListener("change",async d=>{var x;const m=(x=d.currentTarget.files)==null?void 0:x[0];if(!m)return;const y=new FileReader;y.onload=async()=>{const O=y.result.split(",")[1],j=await l("proceedings_upload_pdf",{request:{processo_id:f,nome_arquivo:m.name,conteudo_base64:O,content_type:m.type||"application/pdf"}});if(!j.ok){alert(j.error??"Falha no upload.");return}T(e)},y.readAsDataURL(m)}),document.querySelectorAll("[data-evidence-pm]").forEach(d=>{d.addEventListener("click",()=>{B=d.dataset.evidencePm,T(e)})}),(K=document.querySelector("#btn-close-deadline"))==null||K.addEventListener("click",async()=>{if(!confirm("Encerrar o prazo ativo deste processo?"))return;const d=await l("deadlines_close",{processo_id:f});if(!d.ok){alert(d.error??"Falha ao encerrar prazo.");return}T(e)}),(Y=document.querySelector("#extension-form"))==null||Y.addEventListener("submit",async d=>{d.preventDefault();const m=new FormData(d.currentTarget),y=m.get("data_portaria").trim(),x=await l("deadlines_add_extension",{request:{processo_id:f,dias_prorrogacao:Number(m.get("dias")),motivo:m.get("motivo").trim(),autorizado_por:m.get("autorizado_por").trim(),autorizado_tipo:m.get("autorizado_tipo").trim(),numero_portaria:m.get("numero_portaria").trim()||null,data_portaria:y||null}});if(!x.ok){alert(x.error??"Falha ao prorrogar.");return}T(e)}),M({...e,csvExport:void 0})}async function Ee(e){var E,C,q,k,_;if(!f||!B)return;S('<section class="panel"><p>Carregando indícios...</p></section>');const[a,n]=await Promise.all([l("evidence_load_for_pm",{pm_envolvido_id:B}),l("evidence_categories")]),s=a.data??{categorias:[],crimes:[],rdpm:[],art29:[]},o=n.data??["crimes_cpm","transgressoes_rdpm","transgressoes_art29","sem_indicios"],t=Array.isArray(s.crimes)?s.crimes:[],i=Array.isArray(s.rdpm)?s.rdpm:[],c=Array.isArray(s.art29)?s.art29:[],g=(p,P)=>`
    <div class="evidence-item">
      <span>${r(String(p.artigo??p.inciso??p.id??""))}</span>
      <small>${r(String(p.descricao_artigo??p.texto??""))}</small>
      <button class="danger small" ${P}="true" data-item-id="${r(String(p.id??""))}">×</button>
    </div>`;S(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Indícios — PM ${r(B)}</h1></div>
        <div class="page-head-right">
          <button id="save-evidence">Salvar Indícios</button>
          <button class="secondary" id="back-to-detail">← Voltar ao Processo</button>
        </div>
      </div>

      <div class="detail-section">
        <h2>Categorias</h2>
        <div class="evidence-cats">
          ${o.map(p=>`
            <label class="checkbox">
              <input type="checkbox" name="cat" value="${r(p)}" ${s.categorias.includes(p)?"checked":""} />
              ${r(p)}
            </label>`).join("")}
        </div>
      </div>

      <div class="detail-section">
        <h2>Crimes / Contravenções (${t.length})</h2>
        <div id="crimes-list">${t.map(p=>g(p,"data-remove-crime")).join("")||'<p class="empty">Nenhum</p>'}</div>
        <div class="evidence-search">
          <input id="search-crimes-input" type="search" placeholder="Buscar crime..." />
          <button id="btn-search-crimes">Buscar</button>
        </div>
        <div id="crimes-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Transgressões RDPM (${i.length})</h2>
        <div id="rdpm-list">${i.map(p=>g(p,"data-remove-rdpm")).join("")||'<p class="empty">Nenhuma</p>'}</div>
        <div class="evidence-search">
          <input id="search-rdpm-input" type="search" placeholder="Buscar transgressão..." />
          <button id="btn-search-rdpm">Buscar</button>
        </div>
        <div id="rdpm-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Art. 29 — Estatuto (${c.length})</h2>
        <div id="art29-list">${c.map(p=>g(p,"data-remove-art29")).join("")||'<p class="empty">Nenhum</p>'}</div>
        <div class="evidence-search">
          <input id="search-art29-input" type="search" placeholder="Buscar art. 29..." />
          <button id="btn-search-art29">Buscar</button>
        </div>
        <div id="art29-results" class="evidence-results"></div>
      </div>
    </section>
  `),(E=document.querySelector("#back-to-detail"))==null||E.addEventListener("click",()=>{B=null,T(e)});const b=new Set(t.map(p=>String(p.id))),$=new Set(i.map(p=>String(p.id))),v=new Set(c.map(p=>String(p.id)));document.querySelectorAll("[data-remove-crime]").forEach(p=>{p.addEventListener("click",()=>{var P;b.delete(p.dataset.itemId),(P=p.closest(".evidence-item"))==null||P.remove()})}),document.querySelectorAll("[data-remove-rdpm]").forEach(p=>{p.addEventListener("click",()=>{var P;$.delete(p.dataset.itemId),(P=p.closest(".evidence-item"))==null||P.remove()})}),document.querySelectorAll("[data-remove-art29]").forEach(p=>{p.addEventListener("click",()=>{var P;v.delete(p.dataset.itemId),(P=p.closest(".evidence-item"))==null||P.remove()})});function u(p,P,U,W){return`<button class="outline small" data-add-to="${U}" data-add-id="${r(P)}">${p}</button>`}async function h(p,P,U,W,G,Z={}){var Y;const ee=(((Y=document.querySelector(`#${P}`))==null?void 0:Y.value)??"").trim(),H=(await l(p,{termo:ee,...Z})).data??[],K=document.querySelector(`#${U}`);if(!H.length){K.innerHTML='<p class="empty">Sem resultados.</p>';return}K.innerHTML=H.map(d=>`
      <div class="evidence-result-item">
        <div><strong>${r(String(d.artigo??d.inciso??""))}</strong> — <small>${r(String(d.descricao_artigo??d.texto??"").substring(0,80))}</small></div>
        ${G.has(String(d.id))?'<span class="badge badge--ok">✓ Adicionado</span>':u("Adicionar",String(d.id),W)}
      </div>`).join(""),K.querySelectorAll("[data-add-to]").forEach(d=>{d.addEventListener("click",()=>{const m=d.dataset.addId,y=d.dataset.addTo,x=H.find(pe=>String(pe.id)===m);if(!x)return;G.add(m);const O=document.querySelector(`#${y}-list`),j=document.createElement("div");j.className="evidence-item",j.innerHTML=`<span>${r(String(x.artigo??x.inciso??""))}</span><small>${r(String(x.descricao_artigo??x.texto??""))}</small><button class="danger small">×</button>`,j.querySelector("button").addEventListener("click",()=>{G.delete(m),j.remove()}),O.appendChild(j),d.replaceWith('<span class="badge badge--ok">✓ Adicionado</span>')})})}(C=document.querySelector("#btn-search-crimes"))==null||C.addEventListener("click",()=>h("evidence_search_crimes","search-crimes-input","crimes-results","crimes",b)),(q=document.querySelector("#btn-search-rdpm"))==null||q.addEventListener("click",()=>h("evidence_search_rdpm","search-rdpm-input","rdpm-results","rdpm",$)),(k=document.querySelector("#btn-search-art29"))==null||k.addEventListener("click",()=>h("evidence_search_art29","search-art29-input","art29-results","art29",v)),(_=document.querySelector("#save-evidence"))==null||_.addEventListener("click",async()=>{const p=[...document.querySelectorAll("input[name='cat']:checked")].map(U=>U.value),P=await l("evidence_save_for_pm",{request:{pm_envolvido_id:B,categorias:p,crimes:[...b],rdpm:[...$].map(Number),art29:[...v]}});if(!P.ok){alert(P.error??"Falha ao salvar.");return}B=null,T(e)})}async function ke(){S('<section class="panel"><p>Carregando...</p></section>');const[e,a,n]=await Promise.all([l("deadlines_upcoming",{days_ahead:14}),l("deadlines_overdue"),l("deadlines_dashboard")]),s=e.data??[],o=a.data??[],t=n.data??{},i={path:"/prazos",printable:!0};S(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Prazos</h1></div>
        <div class="page-head-right">${F(i)}</div>
      </div>
      <div class="stat-grid" style="margin-bottom:24px">
        <div class="stat-card"><span class="stat-value">${r(String(t.total??0))}</span><span class="stat-label">Total</span></div>
        <div class="stat-card stat-card--alert"><span class="stat-value">${r(String(t.vencidos??0))}</span><span class="stat-label">Vencidos</span></div>
        <div class="stat-card"><span class="stat-value">${r(String(t.proximos_7_dias??0))}</span><span class="stat-label">Próximos 7 dias</span></div>
      </div>
      ${o.length>0?`
        <h2 style="color:#dc2626;margin:0 0 12px">Vencidos (${o.length})</h2>
        ${w(o,i)}
      `:""}
      <h2 style="margin:24px 0 12px">Próximos 14 dias (${s.length})</h2>
      ${s.length>0?w(s,i):'<p class="empty">Nenhum prazo próximo.</p>'}
    </section>
  `),M(i)}async function xe(){var t;S('<section class="panel"><p>Carregando...</p></section>');const[e,a]=await Promise.all([l("reports_process_types"),l("reports_available_years")]),n=e.data??[],s=a.data??[A],o={printable:!0};S(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Mapa Mensal</h1></div>
        <div class="page-head-right">${F(o)}</div>
      </div>
      <form id="map-form" class="add-movement-form" style="max-width:500px">
        <label>Mês
          <select name="mes">
            ${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((i,c)=>`<option value="${c+1}" ${c+1===new Date().getMonth()+1?"selected":""}>${i}</option>`).join("")}
          </select>
        </label>
        <label>Ano
          <select name="ano">
            ${s.map(i=>`<option value="${i}" ${i===A?"selected":""}>${i}</option>`).join("")}
          </select>
        </label>
        <label>Tipo de Processo
          <select name="tipo_processo">
            ${n.map(i=>`<option value="${r(i.codigo)}">${r(i.codigo)} (${i.total})</option>`).join("")}
            <option value="TODOS">Todos</option>
          </select>
        </label>
        <div style="display:flex;gap:8px">
          <button type="submit" name="mode" value="mensal">Gerar Mapa Mensal</button>
          <button type="submit" class="secondary" name="mode" value="completo">Gerar Completo</button>
        </div>
      </form>
      <div id="map-result"></div>
    </section>
  `),(t=document.querySelector("#map-form"))==null||t.addEventListener("submit",async i=>{var C,q;i.preventDefault();const c=new FormData(i.currentTarget),g=Number(c.get("mes")),b=Number(c.get("ano")),$=String(c.get("tipo_processo")??"TODOS"),v=((C=i.submitter)==null?void 0:C.value)??"mensal",u=document.querySelector("#map-result");u.innerHTML="<p>Gerando mapa...</p>";const h=v==="completo"?await l("reports_generate_complete_map",{request:{mes:g,ano:b}}):await l("reports_generate_monthly_map",{request:{mes:g,ano:b,tipo_processo:$}});if(!h.ok){u.innerHTML=`<p class="error">${r(h.error??"Erro")}</p>`;return}const E=h.data;u.innerHTML=`
      <h2 style="margin-top:24px">Resultado</h2>
      <pre>${r(JSON.stringify(E.meta??E,null,2))}</pre>
      <button id="btn-save-map">Salvar este Mapa</button>
    `,(q=document.querySelector("#btn-save-map"))==null||q.addEventListener("click",async()=>{const k=await l("reports_save_map",{request:{dados_mapa:E}});if(!k.ok){alert(k.error??"Falha ao salvar.");return}alert("Mapa salvo com sucesso!")})}),M(o)}async function oe(){var s,o;const e=J.find(t=>t.path==="/auditoria");S('<section class="panel"><p>Carregando...</p></section>');const a=await l("audit_list",{limit:200,offset:0,tabela:z.tabela||null,operacao:z.operacao||null,usuario_id:z.usuario_id||null}),n=a.data??[];I=n,S(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Auditoria</h1></div>
        <div class="page-head-right">${F({...e,csvExport:void 0})}</div>
      </div>
      <form id="audit-filter-form" class="search-bar" style="flex-wrap:wrap">
        <input name="tabela" type="text" placeholder="Tabela" value="${r(z.tabela)}" style="max-width:160px" />
        <select name="operacao">
          <option value="">Operação</option>
          ${["CREATE","UPDATE","DELETE"].map(t=>`<option ${z.operacao===t?"selected":""}>${t}</option>`).join("")}
        </select>
        <input name="usuario_id" type="text" placeholder="ID do usuário" value="${r(z.usuario_id)}" style="max-width:220px" />
        <button type="submit">Filtrar</button>
        <button type="button" class="secondary small" id="clear-audit-filter">Limpar</button>
      </form>
      ${a.ok?w(n,e):`<p class="error">${a.error}</p>`}
    </section>
  `),(s=document.querySelector("#audit-filter-form"))==null||s.addEventListener("submit",t=>{t.preventDefault();const i=new FormData(t.currentTarget);z={tabela:i.get("tabela").trim(),operacao:i.get("operacao").trim(),usuario_id:i.get("usuario_id").trim()},oe()}),(o=document.querySelector("#clear-audit-filter"))==null||o.addEventListener("click",()=>{z={tabela:"",operacao:"",usuario_id:""},oe()}),ie(e),M({...e,csvExport:void 0})}async function de(){var c;S('<section class="panel"><p>Carregando...</p></section>');const a=(await l("reports_available_years")).data??[A],n=await l("reports_annual_statistics",{ano:A}),s=n.data,o=a.map(g=>`<option value="${g}" ${g===A?"selected":""}>${g}</option>`).join(""),t=s?`
    <div class="stat-grid">
      ${[["Total Geral",s.total_geral],["Processos",s.total_processos],["Procedimentos",s.total_procedimentos],["Punidos (PAD/PADS)",s.pad_pads_punidos],["Absolvidos/Arq.",s.pad_pads_absolvidos_arquivados],["Indícios Crime",s.ipm_sindicancia_indicios_crime],["Indícios Transgressão",s.ipm_sindicancia_indicios_transgressao]].map(([g,b])=>`
        <div class="stat-card">
          <span class="stat-value">${r(String(b??0))}</span>
          <span class="stat-label">${g}</span>
        </div>
      `).join("")}
    </div>
  `:`<p class="error">${n.error??"Erro ao carregar"}</p>`,i=g=>!Array.isArray(g)||g.length===0?'<p class="empty">Sem dados.</p>':`
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Total</th><th>Concluídos</th><th>Em Andamento</th></tr></thead>
          <tbody>
            ${g.map(b=>{const $=b;return`<tr>
                <td>${r(String($.tipo_detalhe??$.categoria??"—"))}</td>
                <td>${r(String($.total??0))}</td>
                <td>${r(String($.concluidos??0))}</td>
                <td>${r(String($.em_andamento??0))}</td>
              </tr>`}).join("")}
          </tbody>
        </table>
      </div>`;S(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Estatísticas Anuais</h1></div>
        <div class="page-head-right">
          <form id="year-form" class="search-bar">
            <select name="ano">${o}</select>
            <button type="submit">Ver</button>
          </form>
          ${F({printable:!0})}
        </div>
      </div>
      ${t}
      ${s?`
        <h2 style="margin-top:24px">Processos por Tipo</h2>
        ${i(s.processos_por_tipo)}
        <h2 style="margin-top:24px">Procedimentos por Tipo</h2>
        ${i(s.procedimentos_por_tipo)}
      `:""}
    </section>
  `),(c=document.querySelector("#year-form"))==null||c.addEventListener("submit",g=>{g.preventDefault();const b=new FormData(g.currentTarget);A=Number(b.get("ano"))||A,de()}),M({})}async function Q(){var i,c,g,b,$;S('<section class="panel"><p>Carregando...</p></section>');const e=await l("users_list",{search:L||null,per_page:100}),a=((i=e.data)==null?void 0:i.items)??[],n=((c=e.data)==null?void 0:c.total)??0;I=a;const s={posto_graduacao:"POSTO/GRADUACAO",tipo_usuario:"TIPO",is_encarregado:"ENCARREGADO",is_operador:"OPERADOR"},o=a.map(v=>{const u=v,h={};for(const[E,C]of Object.entries(u))E!=="id"&&(h[s[E]??E]=C);return h}),t=J.find(v=>v.path==="/usuarios/lista");S(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Usuários <span class="badge">${n}</span></h1></div>
        <div class="page-head-right">
          ${R()?'<button id="new-record">Novo</button>':""}
          ${F({...t,csvExport:void 0})}
        </div>
      </div>
      <form id="search-form" class="search-bar">
        <input name="q" type="search" placeholder="Buscar por nome ou matrícula..." value="${r(L)}" />
        <button type="submit">Buscar</button>
        ${L?'<button type="button" class="secondary small" id="clear-search">Limpar</button>':""}
      </form>
      ${e.ok?w(o,t):`<p class="error">${e.error}</p>`}
    </section>
  `),(g=document.querySelector("#search-form"))==null||g.addEventListener("submit",v=>{v.preventDefault(),L=(new FormData(v.currentTarget).get("q")??"").trim(),Q()}),(b=document.querySelector("#clear-search"))==null||b.addEventListener("click",()=>{L="",Q()}),($=document.querySelector("#new-record"))==null||$.addEventListener("click",()=>V(t)),t.detailCommand&&document.querySelectorAll("tbody tr[data-row-index]").forEach(v=>{v.style.cursor="pointer",v.addEventListener("click",u=>{var C;if(u.target.closest("button"))return;const h=Number(v.dataset.rowIndex),E=String(((C=I[h])==null?void 0:C.id)??"");E&&(f=E,le(t))})}),document.querySelectorAll("[data-edit-index]").forEach(v=>{v.addEventListener("click",()=>V(t,I[Number(v.dataset.editIndex)]??null))}),document.querySelectorAll("[data-delete-index]").forEach(v=>{v.addEventListener("click",async()=>{const u=I[Number(v.dataset.deleteIndex)];if(!confirm("Confirmar exclusão?"))return;const h=await l("users_delete",{id:u==null?void 0:u.id});if(!h.ok){alert(h.error??"Erro");return}Q()})}),M({...t,csvExport:void 0})}async function le(e){var E,C,q;if(!f)return;S('<section class="panel"><p>Carregando perfil...</p></section>');const[a,n,s,o,t]=await Promise.all([l("users_get",{id:f}),l("users_statistics",{id:f}),l("users_proceedings_responsible",{id:f}),l("users_proceedings_escrivao",{id:f}),l("users_proceedings_involved",{id:f})]),i=a.data??{},c=n.data??{},g=s.data??[],b=o.data??[],$=t.data??[],v=i.ativo===!1,u=(k,_)=>`
    <div class="stat-card">
      <span class="stat-value">${r(String(_??0))}</span>
      <span class="stat-label">${k}</span>
    </div>`,h=k=>k.length===0?'<p class="empty">Nenhum.</p>':`<div class="table-wrap"><table>
        <thead><tr><th>Número</th><th>Tipo</th><th>Status</th><th>Instauração</th></tr></thead>
        <tbody>${k.map(_=>`
          <tr>
            <td>${r(String(_.numero??""))}</td>
            <td>${r(String(_.tipo_detalhe??_.tipo_geral??""))}</td>
            <td>${_.concluido?'<span class="badge badge--ok">Concluído</span>':'<span class="badge badge--warn">Andamento</span>'}</td>
            <td>${r(String(_.data_instauracao??""))}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;S(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${r(String(i.posto_graduacao??""))} ${r(String(i.nome??"Usuário"))}
            ${v?'<span class="badge">Inativo</span>':'<span class="badge badge--ok">Ativo</span>'}
          </h1>
          <p>${r(String(i.matricula??""))} · ${r(String(i.tipo_usuario??""))} · ${r(String(i.perfil??""))}</p>
        </div>
        <div class="page-head-right">
          ${R()?`
            <button id="edit-user">Editar</button>
            ${v?'<button id="reactivate-user">Reativar</button>':""}
          `:""}
          <button class="secondary" id="back-to-list">← Voltar</button>
          ${F({...e,csvExport:void 0})}
        </div>
      </div>

      <div class="stat-grid" style="margin-bottom:24px">
        ${u("Sindicâncias (enc.)",c.encarregado_sindicancia)}
        ${u("PADS (enc.)",c.encarregado_pads)}
        ${u("IPM (enc.)",c.encarregado_ipm)}
        ${u("PAD (enc.)",c.encarregado_pad)}
        ${u("PADE (enc.)",c.encarregado_pade)}
        ${u("Feito Prel. (enc.)",c.encarregado_feito_preliminar)}
        ${u("CP (enc.)",c.encarregado_cp)}
        ${u("CD (enc.)",c.encarregado_cd)}
        ${u("CJ (enc.)",c.encarregado_cj)}
        ${u("Escrivão",c.escrivao)}
        ${u("Sindicado",c.envolvido_sindicado)}
        ${u("Acusado",c.envolvido_acusado)}
        ${u("Indiciado",c.envolvido_indiciado)}
        ${u("Investigado",c.envolvido_investigado)}
      </div>

      <div class="detail-section">
        <h2>Como Encarregado (${g.length})</h2>
        ${h(g)}
      </div>
      <div class="detail-section">
        <h2>Como Escrivão (${b.length})</h2>
        ${h(b)}
      </div>
      <div class="detail-section">
        <h2>Como Envolvido (${$.length})</h2>
        ${h($)}
      </div>
    </section>
  `),(E=document.querySelector("#back-to-list"))==null||E.addEventListener("click",()=>{f=null,Q()}),(C=document.querySelector("#edit-user"))==null||C.addEventListener("click",()=>{const k=J.find(_=>_.path==="/usuarios/lista");V(k,i)}),(q=document.querySelector("#reactivate-user"))==null||q.addEventListener("click",async()=>{if(!confirm("Reativar este usuário?"))return;const k=await l("users_reactivate",{id:f});if(!k.ok){alert(k.error??"Erro");return}le(e)}),M({...e,csvExport:void 0})}async function ce(){var k;S('<section class="panel"><p>Carregando estatísticas...</p></section>');const e={path:"/stats/procedimentos",printable:!0},a={ano:A},[n,s,o,t,i,c,g,b,$]=await Promise.all([l("proceedings_in_progress_stats"),l("proceedings_pads_solutions",a),l("proceedings_ipm_evidence",a),l("proceedings_sr_evidence",a),l("proceedings_top10_transgressions",a),l("proceedings_driver_ranking",a),l("proceedings_nature_stats",a),l("proceedings_common_crimes",a),l("proceedings_military_crimes",a)]),v=n.data??{},u=o.data??{},h=t.data??{},q=((await l("reports_available_years")).data??[A]).map(_=>`<option value="${_}" ${_===A?"selected":""}>${_}</option>`).join("");S(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Estatísticas de Procedimentos</h1></div>
        <div class="page-head-right">
          <form id="year-form" class="search-bar">
            <select name="ano">${q}</select>
            <button type="submit">Ver</button>
          </form>
          ${F(e)}
        </div>
      </div>

      <div class="detail-section">
        <h2>Em Andamento</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${r(String(v.total??0))}</span><span class="stat-label">Total</span></div>
          <div class="stat-card badge--ok"><span class="stat-value">${r(String(v.concluidos??0))}</span><span class="stat-label">Concluídos</span></div>
          ${Array.isArray(v.por_tipo)?v.por_tipo.map(_=>`<div class="stat-card"><span class="stat-value">${r(String(_.quantidade??0))}</span><span class="stat-label">${r(String(_.tipo??""))}</span></div>`).join(""):""}
        </div>
      </div>

      <div class="detail-section">
        <h2>Indícios IPM/Sindicância — ${A}</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${r(String(u.com_indicios??0))}</span><span class="stat-label">Com Indícios</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(u.sem_indicios??0))}</span><span class="stat-label">Sem Indícios</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(u.com_indicios_crime??0))}</span><span class="stat-label">Crimes</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(u.com_indicios_transgressao??0))}</span><span class="stat-label">Transgressões</span></div>
        </div>
      </div>

      <div class="detail-section">
        <h2>Indícios SR — ${A}</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${r(String(h.crimes_comuns??0))}</span><span class="stat-label">Crimes Comuns</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(h.transgressoes??0))}</span><span class="stat-label">Transgressões</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(h.sem_indicios??0))}</span><span class="stat-label">Sem Indícios</span></div>
        </div>
      </div>

      <div class="detail-section">
        <h2>Top 10 Transgressões — ${A}</h2>
        ${w(i.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Soluções PADS/PAD — ${A}</h2>
        ${w(s.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Crimes Comuns — ${A}</h2>
        ${w(b.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Crimes Militares (IPM) — ${A}</h2>
        ${w($.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Naturezas Apuradas — ${A}</h2>
        ${w(g.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Ranking de Motoristas (Sinistros) — ${A}</h2>
        ${w(c.data??[],e)}
      </div>
    </section>
  `),(k=document.querySelector("#year-form"))==null||k.addEventListener("submit",_=>{_.preventDefault(),A=Number(new FormData(_.currentTarget).get("ano"))||A,ce()}),M(e)}function Ae(e,a){const n=Uint8Array.from(atob(a),i=>i.charCodeAt(0)),s=new Blob([n],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(s),t=document.createElement("a");t.href=o,t.download=e,t.click(),URL.revokeObjectURL(o)}function F(e){const a=[];return e.printable&&a.push('<button class="outline small" id="btn-print">Imprimir / PDF</button>'),e.csvExport&&a.push('<button class="outline small" id="btn-csv">Exportar CSV</button>'),a.length?`<div class="export-bar">${a.join("")}</div>`:""}function Pe(e){if(!e.searchable)return"";const a=L?'<button type="button" class="secondary small" id="clear-search">Limpar</button>':"";return`
    <form id="search-form" class="search-bar">
      <input name="q" type="search" placeholder="Buscar por número ou fatos..."
             value="${r(L)}" />
      <button type="submit">Buscar</button>
      ${a}
    </form>
  `}function M(e){var a,n,s,o;(a=document.querySelector("#btn-print"))==null||a.addEventListener("click",()=>{window.print()}),(n=document.querySelector("#btn-csv"))==null||n.addEventListener("click",async()=>{if(!e.csvExport)return;const t=document.querySelector("#btn-csv");t.disabled=!0,t.textContent="Gerando…";const i=await l("reports_export_csv",{request:{tipo_relatorio:e.csvExport.tipoRelatorio,ano:null}});if(t.disabled=!1,t.textContent="Exportar CSV",!i.ok||!i.data){alert(i.error??"Falha ao exportar.");return}Ae(i.data.filename,i.data.csv_base64)}),(s=document.querySelector("#search-form"))==null||s.addEventListener("submit",t=>{t.preventDefault(),L=(new FormData(t.currentTarget).get("q")??"").trim(),N()}),(o=document.querySelector("#clear-search"))==null||o.addEventListener("click",()=>{L="",N()})}ge().then(()=>{D?N():te()});
