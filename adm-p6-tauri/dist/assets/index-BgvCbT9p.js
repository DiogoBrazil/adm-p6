(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))t(o);new MutationObserver(o=>{for(const s of o)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&t(i)}).observe(document,{childList:!0,subtree:!0});function n(o){const s={};return o.integrity&&(s.integrity=o.integrity),o.referrerPolicy&&(s.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?s.credentials="include":o.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function t(o){if(o.ep)return;o.ep=!0;const s=n(o);fetch(o.href,s)}})();async function ue(e,a={},n){return window.__TAURI_INTERNALS__.invoke(e,a,n)}const J=[{path:"/dashboard",label:"Dashboard",group:"Geral",command:"dashboard_summary",printable:!0},{path:"/procedimentos/lista",label:"Procedimentos",group:"Procedimentos",command:"proceedings_list",csvExport:{tipoRelatorio:"processos"},printable:!0,searchable:!0,detailCommand:"proceedings_get"},{path:"/prazos",label:"Prazos",group:"Procedimentos",printable:!0},{path:"/catalogos/transgressoes",label:"Transgressões",group:"Catálogos",command:"legal_catalogs_list_transgressions",writeCommands:["legal_catalogs_save_transgression","legal_catalogs_delete_transgression"]},{path:"/catalogos/crimes",label:"Crimes e Contravenções",group:"Catálogos",command:"legal_catalogs_list_crimes",writeCommands:["legal_catalogs_save_crime","legal_catalogs_delete_crime"]},{path:"/catalogos/art29",label:"Estatuto Art. 29",group:"Catálogos",command:"legal_catalogs_list_art29",writeCommands:["legal_catalogs_save_art29","legal_catalogs_delete_art29"]},{path:"/usuarios/lista",label:"Usuários",group:"Usuários",command:"users_list",writeCommands:["users_save","users_delete","users_reactivate"],printable:!0,detailCommand:"users_get"},{path:"/usuarios/novo",label:"Novo usuário",group:"Usuários",command:"users_form_schema",adminOnly:!0},{path:"/auditoria",label:"Auditoria",group:"Auditoria",command:"audit_list",printable:!0,detailCommand:"audit_get"},{path:"/estatisticas/encarregados",label:"Estatísticas de Encarregados",group:"Relatórios",command:"reports_by_responsible",csvExport:{tipoRelatorio:"encarregados"},printable:!0},{path:"/estatisticas/processos",label:"Estatísticas de Processos",group:"Relatórios",command:"reports_by_type",printable:!0},{path:"/estatisticas/prazos",label:"Prazos Vencidos",group:"Relatórios",command:"reports_overdue_deadlines",csvExport:{tipoRelatorio:"prazos"},printable:!0},{path:"/mapas/mensal",label:"Mapa Mensal",group:"Mapas",printable:!0},{path:"/mapas/anteriores",label:"Mapas Salvos",group:"Mapas",command:"reports_saved_maps",printable:!0,detailCommand:"reports_get_saved_map"},{path:"/estatisticas/anuais",label:"Estatísticas Anuais",group:"Relatórios",printable:!0},{path:"/stats/procedimentos",label:"Estatísticas de Procedimentos",group:"Relatórios",printable:!0}],me=["Despacho","Distribuição","Juntada","Remessa","Retorno","Decisão","Notificação","Citação","Prorrogação","Conclusão","Outros"];function ve(e){return e?e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`:""}let C=null,ae="/dashboard",N=[],D="",_=null,x=new Date().getFullYear(),B=null,j={tabela:"",operacao:"",usuario_id:""};const re=document.querySelector("#app"),X={"/usuarios/lista":{saveCommand:"users_save",deleteCommand:"users_delete",idKind:"string",fields:[{name:"tipo_usuario",label:"Tipo de usuário",kind:"select",required:!0,options:["Oficial","Praça"]},{name:"posto_graduacao",label:"Posto/graduação",kind:"text",required:!0},{name:"nome",label:"Nome",kind:"text",required:!0},{name:"matricula",label:"Matrícula",kind:"text",required:!0},{name:"is_encarregado",label:"Encarregado",kind:"checkbox"},{name:"is_operador",label:"Operador",kind:"checkbox"},{name:"email",label:"Email",kind:"email"},{name:"perfil",label:"Perfil",kind:"select",options:["admin","comum"]},{name:"senha",label:"Senha",kind:"password"}]},"/catalogos/crimes":{saveCommand:"legal_catalogs_save_crime",deleteCommand:"legal_catalogs_delete_crime",idKind:"string",fields:[{name:"tipo",label:"Tipo",kind:"select",options:["Crime","Contravenção"]},{name:"dispositivo_legal",label:"Dispositivo legal",kind:"text"},{name:"artigo",label:"Artigo",kind:"text",required:!0},{name:"descricao_artigo",label:"Descrição",kind:"textarea"},{name:"paragrafo",label:"Parágrafo",kind:"text"},{name:"inciso",label:"Inciso",kind:"text"},{name:"alinea",label:"Alínea",kind:"text"}]},"/catalogos/transgressoes":{saveCommand:"legal_catalogs_save_transgression",deleteCommand:"legal_catalogs_delete_transgression",idKind:"number",fields:[{name:"artigo",label:"Artigo",kind:"number"},{name:"gravidade",label:"Gravidade",kind:"select",options:["Leve","Média","Grave"]},{name:"inciso",label:"Inciso",kind:"text"},{name:"texto",label:"Texto",kind:"textarea",required:!0}]},"/catalogos/art29":{saveCommand:"legal_catalogs_save_art29",deleteCommand:"legal_catalogs_delete_art29",idKind:"number",fields:[{name:"inciso",label:"Inciso",kind:"text",required:!0},{name:"texto",label:"Texto",kind:"textarea",required:!0}]},"/procedimentos/lista":{saveCommand:"proceedings_create",updateCommand:"proceedings_update",deleteCommand:"proceedings_delete",idKind:"string",fields:[{name:"numero",label:"Número",kind:"text",required:!0},{name:"tipo_geral",label:"Tipo Geral",kind:"select",required:!0,options:["Processo","Procedimento"]},{name:"tipo_detalhe",label:"Tipo",kind:"select",required:!0,options:["IPM","PADS","SV","PAD","Sindicância","Feito Preliminar","Outros"]},{name:"documento_iniciador",label:"Doc. Iniciador",kind:"select",required:!0,options:["Portaria","Memorando Disciplinar","Feito Preliminar"]},{name:"local_fatos",label:"Local dos Fatos",kind:"text",required:!0},{name:"local_origem",label:"Local de Origem",kind:"text"},{name:"data_instauracao",label:"Data de Instauração",kind:"date"},{name:"data_recebimento",label:"Data de Recebimento",kind:"date"},{name:"numero_portaria",label:"N° da Portaria",kind:"text"},{name:"numero_memorando",label:"N° do Memorando",kind:"text"},{name:"numero_feito",label:"N° do Feito",kind:"text"},{name:"numero_rgf",label:"N° RGF",kind:"text"},{name:"numero_controle",label:"N° de Controle",kind:"text"},{name:"processo_sei",label:"Processo SEI",kind:"text"},{name:"nome_vitima",label:"Nome da Vítima",kind:"text"},{name:"natureza_processo",label:"Natureza",kind:"text"},{name:"resumo_fatos",label:"Resumo dos Fatos",kind:"textarea"},{name:"concluido",label:"Concluído",kind:"checkbox"},{name:"data_conclusao",label:"Data de Conclusão",kind:"date"},{name:"solucao_tipo",label:"Tipo de Solução",kind:"select",options:["Arquivamento","Punição","Absolvição","Encaminhamento","Outros"]},{name:"solucao_final",label:"Solução Final",kind:"textarea"},{name:"penalidade_tipo",label:"Penalidade",kind:"select",options:["Prisão","Detenção","Advertência","Repreensão","Outros"]},{name:"penalidade_dias",label:"Dias de Penalidade",kind:"number"}]}};function w(){return(C==null?void 0:C.is_admin)===!0}async function l(e,a={}){try{return await ue(e,a)}catch(n){return{ok:!1,data:null,error:String(n)}}}async function ge(){const e=await l("auth_current_user");C=e.ok?e.data:null}function be(){return J.reduce((e,a)=>(e[a.group]=e[a.group]??[],e[a.group].push(a),e),{})}function $(e){var n;const a=Object.entries(be()).map(([t,o])=>`
      <section class="nav-group">
        <h2>${t}</h2>
        ${o.map(s=>`
          <button class="nav-item ${s.path===ae?"active":""}" data-route="${s.path}">
            <span>${s.label}</span>
            ${s.adminOnly?"<small>admin</small>":""}
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
          <strong>${(C==null?void 0:C.nome)??"Sessão não autenticada"}</strong>
          <span>${(C==null?void 0:C.perfil)??"offline"}</span>
        </div>
        <button class="secondary" id="logout">Sair</button>
      </header>
      ${e}
    </main>
  `,document.querySelectorAll("[data-route]").forEach(t=>{t.addEventListener("click",()=>{ae=t.dataset.route??"/dashboard",F()})}),(n=document.querySelector("#logout"))==null||n.addEventListener("click",async()=>{await l("auth_logout"),C=null,te()})}function te(e=""){re.innerHTML=`
    <main class="login-screen">
      <form id="login-form" class="login-panel">
        <h1>ADM P6</h1>
        <label>Email<input name="email" type="email" autocomplete="username" required /></label>
        <label>Senha<input name="senha" type="password" autocomplete="current-password" required /></label>
        ${e?`<p class="error">${e}</p>`:""}
        <button type="submit">Entrar</button>
      </form>
    </main>
  `,document.querySelector("#login-form").addEventListener("submit",async a=>{a.preventDefault();const n=new FormData(a.currentTarget),t=await l("auth_login",{email:n.get("email"),senha:n.get("senha")});if(!t.ok||!t.data){te(t.error??"Falha ao autenticar.");return}C=t.data,ae="/dashboard",await F()})}function R(e,a){if(!Array.isArray(e))return`<pre>${r(JSON.stringify(e,null,2))}</pre>`;if(e.length===0)return'<p class="empty">Nenhum registro encontrado.</p>';const n=Object.keys(e[0]),t=!!X[a.path]&&w();return`
    <div class="table-wrap">
      <table>
        <thead><tr>${n.map(o=>`<th>${o}</th>`).join("")}${t?"<th>Ações</th>":""}</tr></thead>
        <tbody>
          ${e.map((o,s)=>`
            <tr data-row-index="${s}">
              ${n.map(i=>`<td>${r(String(o[i]??""))}</td>`).join("")}
              ${t?`
                <td class="row-actions">
                  <button class="secondary small" data-edit-index="${s}">Editar</button>
                  <button class="danger small" data-delete-index="${s}">Excluir</button>
                </td>
              `:""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function he(e){var n;const a=X[e.path];return w()?a?'<div class="actions"><button id="new-record">Novo</button></div>':(n=e.writeCommands)!=null&&n.length?`<div class="actions">${e.writeCommands.map(t=>`<code>${t}</code>`).join("")}</div>`:"":'<p class="readonly">Perfil somente leitura: ações de criação, edição e remoção estão desabilitadas.</p>'}function _e(e,a){const n=e==null?void 0:e[a.name];return typeof n=="boolean"?n:n==null?"":String(n)}function fe(e,a){const n=_e(a,e),t=e.required?"required":"";if(e.kind==="checkbox")return`
      <label class="checkbox">
        <input name="${e.name}" type="checkbox" ${n===!0?"checked":""} />
        ${e.label}
      </label>
    `;if(e.kind==="select")return`
      <label>${e.label}
        <select name="${e.name}" ${t}>
          <option value=""></option>
          ${(e.options??[]).map(o=>`
            <option value="${r(o)}" ${n===o?"selected":""}>${r(o)}</option>
          `).join("")}
        </select>
      </label>
    `;if(e.kind==="textarea")return`<label>${e.label}<textarea name="${e.name}" ${t}>${r(String(n))}</textarea></label>`;if(e.kind==="date"){const o=String(n).substring(0,10);return`<label>${e.label}<input name="${e.name}" type="date" value="${r(o)}" ${t} /></label>`}return`<label>${e.label}<input name="${e.name}" type="${e.kind}" value="${r(String(n))}" ${t} /></label>`}function V(e,a=null,n=""){var s,i;const t=X[e.path];if(!t)return;const o=(a==null?void 0:a.id)??"";$(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${a?"Editar":"Novo"} - ${e.label}</h1>
          <p>${t.saveCommand}</p>
        </div>
        <button class="secondary" id="cancel-form">Cancelar</button>
      </div>
      <form id="crud-form" class="crud-form">
        <input type="hidden" name="id" value="${r(String(o))}" />
        ${t.fields.map(c=>fe(c,a)).join("")}
        ${n?`<p class="error">${n}</p>`:""}
        <div class="form-actions">
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `),(s=document.querySelector("#cancel-form"))==null||s.addEventListener("click",()=>{F()}),(i=document.querySelector("#crud-form"))==null||i.addEventListener("submit",async c=>{c.preventDefault();const m=new FormData(c.currentTarget),u=$e(t,m),f=!!u.id&&t.updateCommand?t.updateCommand:t.saveCommand,g=await l(f,{request:u});if(!g.ok){V(e,a,g.error??"Falha ao salvar.");return}await F()})}function $e(e,a){const n={},t=String(a.get("id")??"");n.id=t?ne(e,t):null;for(const o of e.fields){if(o.kind==="checkbox"){n[o.name]=a.get(o.name)==="on";continue}const s=String(a.get(o.name)??"").trim();if(o.kind==="number"){n[o.name]=s?Number(s):null;continue}n[o.name]=s||null}return n}function ne(e,a){return e.idKind==="number"?Number(a):a}function ie(e){var n;const a=X[e.path];e.detailCommand&&document.querySelectorAll("tbody tr[data-row-index]").forEach(t=>{t.style.cursor="pointer",t.addEventListener("click",o=>{var c;if(o.target.closest("button"))return;const s=Number(t.dataset.rowIndex),i=String(((c=N[s])==null?void 0:c.id)??"");i&&(_=i,T(e))})}),!(!a||!w())&&((n=document.querySelector("#new-record"))==null||n.addEventListener("click",()=>{V(e)}),document.querySelectorAll("[data-edit-index]").forEach(t=>{t.addEventListener("click",()=>{const o=Number(t.dataset.editIndex);V(e,N[o]??null)})}),document.querySelectorAll("[data-delete-index]").forEach(t=>{t.addEventListener("click",async()=>{const o=Number(t.dataset.deleteIndex),s=N[o],i=s==null?void 0:s.id;if(!a.deleteCommand||i===void 0||i===null||!confirm("Confirmar exclusão?"))return;const c=await l(a.deleteCommand,{id:ne(a,String(i))});if(!c.ok){alert(c.error??"Falha ao excluir.");return}await F()})}))}async function F(){if(!C){te();return}const e=J.find(u=>u.path===ae)??J[0];if(e.path==="/estatisticas/anuais")return de();if(e.path==="/prazos")return Ee();if(e.path==="/mapas/mensal")return ke();if(e.path==="/auditoria")return oe();if(e.path==="/usuarios/lista")return Q();if(e.path==="/stats/procedimentos")return ce();e.searchable||(D="");const a=e.adminOnly&&!w();let n="";if(a?n=`<section class="panel"><h1>${e.label}</h1><p class="error">Seu perfil é somente leitura.</p></section>`:e.command&&(n=`<section class="panel"><h1>${e.label}</h1><p>Carregando...</p></section>`),$(n),!e.command||a)return;const t=e.searchable?{filter:{search:D||null}}:{},o=await l(e.command,t);N=Array.isArray(o.data)?o.data:[];const s=he(e),i=I(e),c=e.path==="/dashboard"&&!Array.isArray(o.data),m=o.ok?c?ye(o.data):R(o.data,e):`<p class="error">${o.error}</p>`;$(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${e.label}</h1>
          <p>${e.path}</p>
        </div>
        <div class="page-head-right">
          ${s}
          ${i}
        </div>
      </div>
      ${Ae(e)}
      ${m}
    </section>
  `),ie(e),M(e)}function r(e){return e.replace(/[&<>"']/g,a=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[a]??a)}function ye(e){const a=(n,t,o=!1)=>`
    <div class="stat-card ${o?"stat-card--alert":""}">
      <span class="stat-value">${r(String(t??0))}</span>
      <span class="stat-label">${n}</span>
    </div>
  `;return`
    <div class="stat-grid">
      ${a("Total de Processos",e.total_processos)}
      ${a("Em Andamento",e.em_andamento)}
      ${a("Concluídos",e.concluidos)}
      ${a("Prazos Vencidos",e.prazos_vencidos,Number(e.prazos_vencidos)>0)}
    </div>
  `}async function T(e){var W,G,Z,ee,se,H,K,Y;if(!_||!e.detailCommand)return;if(B&&e.path==="/procedimentos/lista")return Se(e);$('<section class="panel"><p>Carregando detalhes...</p></section>');const a=e.path==="/procedimentos/lista",[n,t,o]=await Promise.all([l(e.detailCommand,{id:_}),a?l("evidence_list_for_proceeding",{procedimento_id:_}):Promise.resolve({ok:!0,data:[],error:null}),a?l("deadlines_list",{processo_id:_}):Promise.resolve({ok:!0,data:[],error:null})]);if(!n.ok){$(`<section class="panel"><p class="error">${r(n.error??"Erro")}</p></section>`);return}const s=n.data??{},i=X[e.path],c=!!(i&&w()),m=Array.isArray(s.andamentos)?s.andamentos:[],u=!!s.pdf_nome,f=[["numero","Número"],["tipo_geral","Tipo Geral"],["tipo_detalhe","Tipo"],["documento_iniciador","Doc. Iniciador"],["processo_sei","SEI"],["data_instauracao","Instauração"],["data_recebimento","Recebimento"],["responsavel_nome","Encarregado"],["escrivao_nome","Escrivão"],["local_origem","Local Origem"],["local_fatos","Local dos Fatos"],["natureza_processo","Natureza"],["resumo_fatos","Resumo"],["concluido","Concluído"],["data_conclusao","Data Conclusão"],["solucao_tipo","Solução"],["solucao_final","Decisão Final"],["penalidade_tipo","Penalidade"],["penalidade_dias","Dias"]].filter(([d])=>{const v=s[d];return v!=null&&String(v).trim()!==""}).map(([d,v])=>{const E=s[d],k=typeof E=="boolean"?E?"Sim":"Não":String(E);return`<tr><th>${v}</th><td>${r(k)}</td></tr>`}).join(""),g=a?`
    <div class="detail-section">
      <h2>Andamentos <span class="badge">${m.length}</span></h2>
      ${m.length>0?`
        <ul class="andamentos-list">
          ${m.map(d=>`
            <li class="andamento-item">
              <div class="andamento-meta">
                ${d.tipo?`<strong class="andamento-tipo">${r(d.tipo)}</strong>`:""}
                <span>${r(d.data)}</span>
                <span>${r(d.usuario)}</span>
                ${w()?`<button class="danger small" data-remove-andamento="${r(d.id)}">Remover</button>`:""}
              </div>
              <p class="andamento-texto">${r(d.texto)}</p>
            </li>
          `).join("")}
        </ul>
      `:'<p class="empty">Nenhum andamento registrado.</p>'}
      ${w()?`
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
  `:"",y=a?`
    <div class="detail-section">
      <h2>PDF Anexo</h2>
      ${u?`
        <div class="pdf-info">
          <span class="pdf-name">${r(String(s.pdf_nome))}</span>
          <span class="pdf-size">${ve(Number(s.pdf_tamanho??0))}</span>
          <button id="btn-view-pdf">Abrir PDF</button>
          ${w()?'<button class="danger small" id="btn-remove-pdf">Remover</button>':""}
        </div>
      `:`
        <p class="empty">Nenhum PDF anexado.</p>
        ${w()?`
          <label class="upload-label">
            Fazer Upload de PDF
            <input type="file" id="pdf-upload-input" accept=".pdf" />
          </label>
        `:""}
      `}
    </div>
  `:"",q=Array.isArray(t.data)?t.data:[],L=a?`
    <div class="detail-section">
      <h2>Indícios por PM <span class="badge">${q.length}</span></h2>
      ${q.length===0?'<p class="empty">Nenhum PM envolvido com indícios registrados.</p>':`
        <ul class="andamentos-list">
          ${q.map(d=>{const v=d.indicios??{categorias:[],crimes:[],rdpm:[],art29:[]},E=v.categorias.length>0?v.categorias.join(", "):"sem categorias",k=v.crimes.length+v.rdpm.length+v.art29.length;return`
              <li class="andamento-item">
                <div class="andamento-meta">
                  <strong>${r(d.posto_graduacao??"")} ${r(d.nome??d.pm_envolvido_id)}</strong>
                  <span class="badge">${k} item(s)</span>
                  <span>${r(E)}</span>
                  <button class="secondary small" data-evidence-pm="${r(d.pm_envolvido_id)}">Gerenciar Indícios</button>
                </div>
              </li>`}).join("")}
        </ul>
      `}
    </div>
  `:"",P=Array.isArray(o.data)?o.data:[],S=P.find(d=>d.ativo!==!1&&d.tipo_prazo==="inicial")??P.find(d=>d.ativo!==!1),h=a?`
    <div class="detail-section">
      <h2>Prazos <span class="badge">${P.length}</span></h2>
      ${P.length>0?`
        <div class="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Início</th><th>Vencimento</th><th>Dias+</th><th>Motivo</th><th>Status</th></tr></thead>
            <tbody>
              ${P.map(d=>`
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
      ${w()?`
        ${S?'<button class="secondary small" id="btn-close-deadline">Encerrar Prazo Ativo</button>':""}
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
  `:"",p=r(String(s.numero??"Detalhe")),A=s.tipo_detalhe?`<small>${r(String(s.tipo_detalhe))}</small>`:"",U=s.concluido?'<span class="badge badge--ok">Concluído</span>':'<span class="badge badge--warn">Em Andamento</span>';$(`
    <section class="panel">
      <div class="page-head">
        <div><h1>${p} ${A} ${a?U:""}</h1><p>${_}</p></div>
        <div class="page-head-right">
          ${c?'<button id="edit-detail">Editar</button>':""}
          <button class="secondary" id="back-to-list">← Voltar</button>
          ${I({...e,csvExport:void 0})}
        </div>
      </div>
      <div class="table-wrap"><table class="detail-table"><tbody>${f}</tbody></table></div>
      ${y}
      ${h}
      ${L}
      ${g}
    </section>
  `),(W=document.querySelector("#back-to-list"))==null||W.addEventListener("click",()=>{_=null,F()}),c&&i&&((G=document.querySelector("#edit-detail"))==null||G.addEventListener("click",()=>{V(e,s)})),(Z=document.querySelector("#add-movement-form"))==null||Z.addEventListener("submit",async d=>{d.preventDefault();const v=new FormData(d.currentTarget),E=v.get("tipo").trim()||null,k=v.get("texto").trim(),z=await l("movements_add",{request:{processo_id:_,tipo:E,texto:k}});if(!z.ok){alert(z.error??"Falha ao adicionar andamento.");return}T(e)}),document.querySelectorAll("[data-remove-andamento]").forEach(d=>{d.addEventListener("click",async()=>{if(!confirm("Remover este andamento?"))return;const v=d.dataset.removeAndamento,E=await l("movements_remove",{processo_id:_,andamento_id:v});if(!E.ok){alert(E.error??"Falha ao remover.");return}T(e)})}),(ee=document.querySelector("#btn-view-pdf"))==null||ee.addEventListener("click",async()=>{var k;const d=await l("proceedings_get_pdf",{id:_});if(!d.ok||!((k=d.data)!=null&&k.conteudo)){alert("Falha ao carregar PDF.");return}const v=Uint8Array.from(atob(d.data.conteudo),z=>z.charCodeAt(0)),E=new Blob([v],{type:d.data.content_type??"application/pdf"});window.open(URL.createObjectURL(E),"_blank")}),(se=document.querySelector("#btn-remove-pdf"))==null||se.addEventListener("click",async()=>{if(!confirm("Remover o PDF anexado?"))return;const d=await l("proceedings_remove_pdf",{id:_});if(!d.ok){alert(d.error??"Falha ao remover PDF.");return}T(e)}),(H=document.querySelector("#pdf-upload-input"))==null||H.addEventListener("change",async d=>{var k;const v=(k=d.currentTarget.files)==null?void 0:k[0];if(!v)return;const E=new FileReader;E.onload=async()=>{const z=E.result.split(",")[1],O=await l("proceedings_upload_pdf",{request:{processo_id:_,nome_arquivo:v.name,conteudo_base64:z,content_type:v.type||"application/pdf"}});if(!O.ok){alert(O.error??"Falha no upload.");return}T(e)},E.readAsDataURL(v)}),document.querySelectorAll("[data-evidence-pm]").forEach(d=>{d.addEventListener("click",()=>{B=d.dataset.evidencePm,T(e)})}),(K=document.querySelector("#btn-close-deadline"))==null||K.addEventListener("click",async()=>{if(!confirm("Encerrar o prazo ativo deste processo?"))return;const d=await l("deadlines_close",{processo_id:_});if(!d.ok){alert(d.error??"Falha ao encerrar prazo.");return}T(e)}),(Y=document.querySelector("#extension-form"))==null||Y.addEventListener("submit",async d=>{d.preventDefault();const v=new FormData(d.currentTarget),E=v.get("data_portaria").trim(),k=await l("deadlines_add_extension",{request:{processo_id:_,dias_prorrogacao:Number(v.get("dias")),motivo:v.get("motivo").trim(),autorizado_por:v.get("autorizado_por").trim(),autorizado_tipo:v.get("autorizado_tipo").trim(),numero_portaria:v.get("numero_portaria").trim()||null,data_portaria:E||null}});if(!k.ok){alert(k.error??"Falha ao prorrogar.");return}T(e)}),M({...e,csvExport:void 0})}async function Se(e){var q,L,P,S,h;if(!_||!B)return;$('<section class="panel"><p>Carregando indícios...</p></section>');const[a,n]=await Promise.all([l("evidence_load_for_pm",{pm_envolvido_id:B}),l("evidence_categories")]),t=a.data??{categorias:[],crimes:[],rdpm:[],art29:[]},o=n.data??["crimes_cpm","transgressoes_rdpm","transgressoes_art29","sem_indicios"],s=Array.isArray(t.crimes)?t.crimes:[],i=Array.isArray(t.rdpm)?t.rdpm:[],c=Array.isArray(t.art29)?t.art29:[],m=(p,A)=>`
    <div class="evidence-item">
      <span>${r(String(p.artigo??p.inciso??p.id??""))}</span>
      <small>${r(String(p.descricao_artigo??p.texto??""))}</small>
      <button class="danger small" ${A}="true" data-item-id="${r(String(p.id??""))}">×</button>
    </div>`;$(`
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
              <input type="checkbox" name="cat" value="${r(p)}" ${t.categorias.includes(p)?"checked":""} />
              ${r(p)}
            </label>`).join("")}
        </div>
      </div>

      <div class="detail-section">
        <h2>Crimes / Contravenções (${s.length})</h2>
        <div id="crimes-list">${s.map(p=>m(p,"data-remove-crime")).join("")||'<p class="empty">Nenhum</p>'}</div>
        <div class="evidence-search">
          <input id="search-crimes-input" type="search" placeholder="Buscar crime..." />
          <button id="btn-search-crimes">Buscar</button>
        </div>
        <div id="crimes-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Transgressões RDPM (${i.length})</h2>
        <div id="rdpm-list">${i.map(p=>m(p,"data-remove-rdpm")).join("")||'<p class="empty">Nenhuma</p>'}</div>
        <div class="evidence-search">
          <input id="search-rdpm-input" type="search" placeholder="Buscar transgressão..." />
          <button id="btn-search-rdpm">Buscar</button>
        </div>
        <div id="rdpm-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Art. 29 — Estatuto (${c.length})</h2>
        <div id="art29-list">${c.map(p=>m(p,"data-remove-art29")).join("")||'<p class="empty">Nenhum</p>'}</div>
        <div class="evidence-search">
          <input id="search-art29-input" type="search" placeholder="Buscar art. 29..." />
          <button id="btn-search-art29">Buscar</button>
        </div>
        <div id="art29-results" class="evidence-results"></div>
      </div>
    </section>
  `),(q=document.querySelector("#back-to-detail"))==null||q.addEventListener("click",()=>{B=null,T(e)});const u=new Set(s.map(p=>String(p.id))),b=new Set(i.map(p=>String(p.id))),f=new Set(c.map(p=>String(p.id)));document.querySelectorAll("[data-remove-crime]").forEach(p=>{p.addEventListener("click",()=>{var A;u.delete(p.dataset.itemId),(A=p.closest(".evidence-item"))==null||A.remove()})}),document.querySelectorAll("[data-remove-rdpm]").forEach(p=>{p.addEventListener("click",()=>{var A;b.delete(p.dataset.itemId),(A=p.closest(".evidence-item"))==null||A.remove()})}),document.querySelectorAll("[data-remove-art29]").forEach(p=>{p.addEventListener("click",()=>{var A;f.delete(p.dataset.itemId),(A=p.closest(".evidence-item"))==null||A.remove()})});function g(p,A,U,W){return`<button class="outline small" data-add-to="${U}" data-add-id="${r(A)}">${p}</button>`}async function y(p,A,U,W,G,Z={}){var Y;const ee=(((Y=document.querySelector(`#${A}`))==null?void 0:Y.value)??"").trim(),H=(await l(p,{termo:ee,...Z})).data??[],K=document.querySelector(`#${U}`);if(!H.length){K.innerHTML='<p class="empty">Sem resultados.</p>';return}K.innerHTML=H.map(d=>`
      <div class="evidence-result-item">
        <div><strong>${r(String(d.artigo??d.inciso??""))}</strong> — <small>${r(String(d.descricao_artigo??d.texto??"").substring(0,80))}</small></div>
        ${G.has(String(d.id))?'<span class="badge badge--ok">✓ Adicionado</span>':g("Adicionar",String(d.id),W)}
      </div>`).join(""),K.querySelectorAll("[data-add-to]").forEach(d=>{d.addEventListener("click",()=>{const v=d.dataset.addId,E=d.dataset.addTo,k=H.find(pe=>String(pe.id)===v);if(!k)return;G.add(v);const z=document.querySelector(`#${E}-list`),O=document.createElement("div");O.className="evidence-item",O.innerHTML=`<span>${r(String(k.artigo??k.inciso??""))}</span><small>${r(String(k.descricao_artigo??k.texto??""))}</small><button class="danger small">×</button>`,O.querySelector("button").addEventListener("click",()=>{G.delete(v),O.remove()}),z.appendChild(O),d.replaceWith('<span class="badge badge--ok">✓ Adicionado</span>')})})}(L=document.querySelector("#btn-search-crimes"))==null||L.addEventListener("click",()=>y("evidence_search_crimes","search-crimes-input","crimes-results","crimes",u)),(P=document.querySelector("#btn-search-rdpm"))==null||P.addEventListener("click",()=>y("evidence_search_rdpm","search-rdpm-input","rdpm-results","rdpm",b)),(S=document.querySelector("#btn-search-art29"))==null||S.addEventListener("click",()=>y("evidence_search_art29","search-art29-input","art29-results","art29",f)),(h=document.querySelector("#save-evidence"))==null||h.addEventListener("click",async()=>{const p=[...document.querySelectorAll("input[name='cat']:checked")].map(U=>U.value),A=await l("evidence_save_for_pm",{request:{pm_envolvido_id:B,categorias:p,crimes:[...u],rdpm:[...b].map(Number),art29:[...f]}});if(!A.ok){alert(A.error??"Falha ao salvar.");return}B=null,T(e)})}async function Ee(){$('<section class="panel"><p>Carregando...</p></section>');const[e,a,n]=await Promise.all([l("deadlines_upcoming",{days_ahead:14}),l("deadlines_overdue"),l("deadlines_dashboard")]),t=e.data??[],o=a.data??[],s=n.data??{},i={path:"/prazos",printable:!0};$(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Prazos</h1></div>
        <div class="page-head-right">${I(i)}</div>
      </div>
      <div class="stat-grid" style="margin-bottom:24px">
        <div class="stat-card"><span class="stat-value">${r(String(s.total??0))}</span><span class="stat-label">Total</span></div>
        <div class="stat-card stat-card--alert"><span class="stat-value">${r(String(s.vencidos??0))}</span><span class="stat-label">Vencidos</span></div>
        <div class="stat-card"><span class="stat-value">${r(String(s.proximos_7_dias??0))}</span><span class="stat-label">Próximos 7 dias</span></div>
      </div>
      ${o.length>0?`
        <h2 style="color:#dc2626;margin:0 0 12px">Vencidos (${o.length})</h2>
        ${R(o,i)}
      `:""}
      <h2 style="margin:24px 0 12px">Próximos 14 dias (${t.length})</h2>
      ${t.length>0?R(t,i):'<p class="empty">Nenhum prazo próximo.</p>'}
    </section>
  `),M(i)}async function ke(){var s;$('<section class="panel"><p>Carregando...</p></section>');const[e,a]=await Promise.all([l("reports_process_types"),l("reports_available_years")]),n=e.data??[],t=a.data??[x],o={printable:!0};$(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Mapa Mensal</h1></div>
        <div class="page-head-right">${I(o)}</div>
      </div>
      <form id="map-form" class="add-movement-form" style="max-width:500px">
        <label>Mês
          <select name="mes">
            ${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((i,c)=>`<option value="${c+1}" ${c+1===new Date().getMonth()+1?"selected":""}>${i}</option>`).join("")}
          </select>
        </label>
        <label>Ano
          <select name="ano">
            ${t.map(i=>`<option value="${i}" ${i===x?"selected":""}>${i}</option>`).join("")}
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
  `),(s=document.querySelector("#map-form"))==null||s.addEventListener("submit",async i=>{var L,P;i.preventDefault();const c=new FormData(i.currentTarget),m=Number(c.get("mes")),u=Number(c.get("ano")),b=String(c.get("tipo_processo")??"TODOS"),f=((L=i.submitter)==null?void 0:L.value)??"mensal",g=document.querySelector("#map-result");g.innerHTML="<p>Gerando mapa...</p>";const y=f==="completo"?await l("reports_generate_complete_map",{request:{mes:m,ano:u}}):await l("reports_generate_monthly_map",{request:{mes:m,ano:u,tipo_processo:b}});if(!y.ok){g.innerHTML=`<p class="error">${r(y.error??"Erro")}</p>`;return}const q=y.data;g.innerHTML=`
      <h2 style="margin-top:24px">Resultado</h2>
      <pre>${r(JSON.stringify(q.meta??q,null,2))}</pre>
      <button id="btn-save-map">Salvar este Mapa</button>
    `,(P=document.querySelector("#btn-save-map"))==null||P.addEventListener("click",async()=>{const S=await l("reports_save_map",{request:{dados_mapa:q}});if(!S.ok){alert(S.error??"Falha ao salvar.");return}alert("Mapa salvo com sucesso!")})}),M(o)}async function oe(){var t,o;const e=J.find(s=>s.path==="/auditoria");$('<section class="panel"><p>Carregando...</p></section>');const a=await l("audit_list",{limit:200,offset:0,tabela:j.tabela||null,operacao:j.operacao||null,usuario_id:j.usuario_id||null}),n=a.data??[];N=n,$(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Auditoria</h1></div>
        <div class="page-head-right">${I({...e,csvExport:void 0})}</div>
      </div>
      <form id="audit-filter-form" class="search-bar" style="flex-wrap:wrap">
        <input name="tabela" type="text" placeholder="Tabela" value="${r(j.tabela)}" style="max-width:160px" />
        <select name="operacao">
          <option value="">Operação</option>
          ${["CREATE","UPDATE","DELETE"].map(s=>`<option ${j.operacao===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <input name="usuario_id" type="text" placeholder="ID do usuário" value="${r(j.usuario_id)}" style="max-width:220px" />
        <button type="submit">Filtrar</button>
        <button type="button" class="secondary small" id="clear-audit-filter">Limpar</button>
      </form>
      ${a.ok?R(n,e):`<p class="error">${a.error}</p>`}
    </section>
  `),(t=document.querySelector("#audit-filter-form"))==null||t.addEventListener("submit",s=>{s.preventDefault();const i=new FormData(s.currentTarget);j={tabela:i.get("tabela").trim(),operacao:i.get("operacao").trim(),usuario_id:i.get("usuario_id").trim()},oe()}),(o=document.querySelector("#clear-audit-filter"))==null||o.addEventListener("click",()=>{j={tabela:"",operacao:"",usuario_id:""},oe()}),ie(e),M({...e,csvExport:void 0})}async function de(){var c;$('<section class="panel"><p>Carregando...</p></section>');const a=(await l("reports_available_years")).data??[x],n=await l("reports_annual_statistics",{ano:x}),t=n.data,o=a.map(m=>`<option value="${m}" ${m===x?"selected":""}>${m}</option>`).join(""),s=t?`
    <div class="stat-grid">
      ${[["Total Geral",t.total_geral],["Processos",t.total_processos],["Procedimentos",t.total_procedimentos],["Punidos (PAD/PADS)",t.pad_pads_punidos],["Absolvidos/Arq.",t.pad_pads_absolvidos_arquivados],["Indícios Crime",t.ipm_sindicancia_indicios_crime],["Indícios Transgressão",t.ipm_sindicancia_indicios_transgressao]].map(([m,u])=>`
        <div class="stat-card">
          <span class="stat-value">${r(String(u??0))}</span>
          <span class="stat-label">${m}</span>
        </div>
      `).join("")}
    </div>
  `:`<p class="error">${n.error??"Erro ao carregar"}</p>`,i=m=>!Array.isArray(m)||m.length===0?'<p class="empty">Sem dados.</p>':`
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Total</th><th>Concluídos</th><th>Em Andamento</th></tr></thead>
          <tbody>
            ${m.map(u=>{const b=u;return`<tr>
                <td>${r(String(b.tipo_detalhe??b.categoria??"—"))}</td>
                <td>${r(String(b.total??0))}</td>
                <td>${r(String(b.concluidos??0))}</td>
                <td>${r(String(b.em_andamento??0))}</td>
              </tr>`}).join("")}
          </tbody>
        </table>
      </div>`;$(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Estatísticas Anuais</h1></div>
        <div class="page-head-right">
          <form id="year-form" class="search-bar">
            <select name="ano">${o}</select>
            <button type="submit">Ver</button>
          </form>
          ${I({printable:!0})}
        </div>
      </div>
      ${s}
      ${t?`
        <h2 style="margin-top:24px">Processos por Tipo</h2>
        ${i(t.processos_por_tipo)}
        <h2 style="margin-top:24px">Procedimentos por Tipo</h2>
        ${i(t.procedimentos_por_tipo)}
      `:""}
    </section>
  `),(c=document.querySelector("#year-form"))==null||c.addEventListener("submit",m=>{m.preventDefault();const u=new FormData(m.currentTarget);x=Number(u.get("ano"))||x,de()}),M({})}async function Q(){var o,s,i,c,m;$('<section class="panel"><p>Carregando...</p></section>');const e=await l("users_list",{search:D||null,per_page:100}),a=((o=e.data)==null?void 0:o.items)??[],n=((s=e.data)==null?void 0:s.total)??0;N=a;const t=J.find(u=>u.path==="/usuarios/lista");$(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Usuários <span class="badge">${n}</span></h1></div>
        <div class="page-head-right">
          ${w()?'<button id="new-record">Novo</button>':""}
          ${I({...t,csvExport:void 0})}
        </div>
      </div>
      <form id="search-form" class="search-bar">
        <input name="q" type="search" placeholder="Buscar por nome ou matrícula..." value="${r(D)}" />
        <button type="submit">Buscar</button>
        ${D?'<button type="button" class="secondary small" id="clear-search">Limpar</button>':""}
      </form>
      ${e.ok?R(a,t):`<p class="error">${e.error}</p>`}
    </section>
  `),(i=document.querySelector("#search-form"))==null||i.addEventListener("submit",u=>{u.preventDefault(),D=(new FormData(u.currentTarget).get("q")??"").trim(),Q()}),(c=document.querySelector("#clear-search"))==null||c.addEventListener("click",()=>{D="",Q()}),(m=document.querySelector("#new-record"))==null||m.addEventListener("click",()=>V(t)),t.detailCommand&&document.querySelectorAll("tbody tr[data-row-index]").forEach(u=>{u.style.cursor="pointer",u.addEventListener("click",b=>{var y;if(b.target.closest("button"))return;const f=Number(u.dataset.rowIndex),g=String(((y=N[f])==null?void 0:y.id)??"");g&&(_=g,le(t))})}),document.querySelectorAll("[data-edit-index]").forEach(u=>{u.addEventListener("click",()=>V(t,N[Number(u.dataset.editIndex)]??null))}),document.querySelectorAll("[data-delete-index]").forEach(u=>{u.addEventListener("click",async()=>{const b=N[Number(u.dataset.deleteIndex)];if(!confirm("Confirmar exclusão?"))return;const f=await l("users_delete",{id:b==null?void 0:b.id});if(!f.ok){alert(f.error??"Erro");return}Q()})}),M({...t,csvExport:void 0})}async function le(e){var q,L,P;if(!_)return;$('<section class="panel"><p>Carregando perfil...</p></section>');const[a,n,t,o,s]=await Promise.all([l("users_get",{id:_}),l("users_statistics",{user_id:_}),l("users_proceedings_responsible",{user_id:_}),l("users_proceedings_escrivao",{user_id:_}),l("users_proceedings_involved",{user_id:_})]),i=a.data??{},c=n.data??{},m=t.data??[],u=o.data??[],b=s.data??[],f=i.ativo===!1,g=(S,h)=>`
    <div class="stat-card">
      <span class="stat-value">${r(String(h??0))}</span>
      <span class="stat-label">${S}</span>
    </div>`,y=S=>S.length===0?'<p class="empty">Nenhum.</p>':`<div class="table-wrap"><table>
        <thead><tr><th>Número</th><th>Tipo</th><th>Status</th><th>Instauração</th></tr></thead>
        <tbody>${S.map(h=>`
          <tr>
            <td>${r(String(h.numero??""))}</td>
            <td>${r(String(h.tipo_detalhe??h.tipo_geral??""))}</td>
            <td>${h.concluido?'<span class="badge badge--ok">Concluído</span>':'<span class="badge badge--warn">Andamento</span>'}</td>
            <td>${r(String(h.data_instauracao??""))}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;$(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${r(String(i.posto_graduacao??""))} ${r(String(i.nome??"Usuário"))}
            ${f?'<span class="badge">Inativo</span>':'<span class="badge badge--ok">Ativo</span>'}
          </h1>
          <p>${r(String(i.matricula??""))} · ${r(String(i.tipo_usuario??""))} · ${r(String(i.perfil??""))}</p>
        </div>
        <div class="page-head-right">
          ${w()?`
            <button id="edit-user">Editar</button>
            ${f?'<button id="reactivate-user">Reativar</button>':""}
          `:""}
          <button class="secondary" id="back-to-list">← Voltar</button>
          ${I({...e,csvExport:void 0})}
        </div>
      </div>

      <div class="stat-grid" style="margin-bottom:24px">
        ${g("Sindicâncias (enc.)",c.encarregado_sindicancia)}
        ${g("PADS (enc.)",c.encarregado_pads)}
        ${g("IPM (enc.)",c.encarregado_ipm)}
        ${g("PAD (enc.)",c.encarregado_pad)}
        ${g("Feito Prel. (enc.)",c.encarregado_feito_preliminar)}
        ${g("Escrivão",c.escrivao)}
        ${g("Envolvido (sindicado)",c.envolvido_sindicado)}
        ${g("Envolvido (acusado)",c.envolvido_acusado)}
      </div>

      <div class="detail-section">
        <h2>Como Encarregado (${m.length})</h2>
        ${y(m)}
      </div>
      <div class="detail-section">
        <h2>Como Escrivão (${u.length})</h2>
        ${y(u)}
      </div>
      <div class="detail-section">
        <h2>Como Envolvido (${b.length})</h2>
        ${y(b)}
      </div>
    </section>
  `),(q=document.querySelector("#back-to-list"))==null||q.addEventListener("click",()=>{_=null,Q()}),(L=document.querySelector("#edit-user"))==null||L.addEventListener("click",()=>{const S=J.find(h=>h.path==="/usuarios/lista");V(S,i)}),(P=document.querySelector("#reactivate-user"))==null||P.addEventListener("click",async()=>{if(!confirm("Reativar este usuário?"))return;const S=await l("users_reactivate",{id:_});if(!S.ok){alert(S.error??"Erro");return}le(e)}),M({...e,csvExport:void 0})}async function ce(){var S;$('<section class="panel"><p>Carregando estatísticas...</p></section>');const e={path:"/stats/procedimentos",printable:!0},a={ano:x},[n,t,o,s,i,c,m,u,b]=await Promise.all([l("proceedings_in_progress_stats"),l("proceedings_pads_solutions",a),l("proceedings_ipm_evidence",a),l("proceedings_sr_evidence",a),l("proceedings_top10_transgressions",a),l("proceedings_driver_ranking",a),l("proceedings_nature_stats",a),l("proceedings_common_crimes",a),l("proceedings_military_crimes",a)]),f=n.data??{},g=o.data??{},y=s.data??{},P=((await l("reports_available_years")).data??[x]).map(h=>`<option value="${h}" ${h===x?"selected":""}>${h}</option>`).join("");$(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Estatísticas de Procedimentos</h1></div>
        <div class="page-head-right">
          <form id="year-form" class="search-bar">
            <select name="ano">${P}</select>
            <button type="submit">Ver</button>
          </form>
          ${I(e)}
        </div>
      </div>

      <div class="detail-section">
        <h2>Em Andamento</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${r(String(f.total??0))}</span><span class="stat-label">Total</span></div>
          <div class="stat-card badge--ok"><span class="stat-value">${r(String(f.concluidos??0))}</span><span class="stat-label">Concluídos</span></div>
          ${Array.isArray(f.por_tipo)?f.por_tipo.map(h=>`<div class="stat-card"><span class="stat-value">${r(String(h.quantidade??0))}</span><span class="stat-label">${r(String(h.tipo??""))}</span></div>`).join(""):""}
        </div>
      </div>

      <div class="detail-section">
        <h2>Indícios IPM/Sindicância — ${x}</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${r(String(g.com_indicios??0))}</span><span class="stat-label">Com Indícios</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(g.sem_indicios??0))}</span><span class="stat-label">Sem Indícios</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(g.com_indicios_crime??0))}</span><span class="stat-label">Crimes</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(g.com_indicios_transgressao??0))}</span><span class="stat-label">Transgressões</span></div>
        </div>
      </div>

      <div class="detail-section">
        <h2>Indícios SR — ${x}</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${r(String(y.crimes_comuns??0))}</span><span class="stat-label">Crimes Comuns</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(y.transgressoes??0))}</span><span class="stat-label">Transgressões</span></div>
          <div class="stat-card"><span class="stat-value">${r(String(y.sem_indicios??0))}</span><span class="stat-label">Sem Indícios</span></div>
        </div>
      </div>

      <div class="detail-section">
        <h2>Top 10 Transgressões — ${x}</h2>
        ${R(i.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Soluções PADS/PAD — ${x}</h2>
        ${R(t.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Crimes Comuns — ${x}</h2>
        ${R(u.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Crimes Militares (IPM) — ${x}</h2>
        ${R(b.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Naturezas Apuradas — ${x}</h2>
        ${R(m.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Ranking de Motoristas (Sinistros) — ${x}</h2>
        ${R(c.data??[],e)}
      </div>
    </section>
  `),(S=document.querySelector("#year-form"))==null||S.addEventListener("submit",h=>{h.preventDefault(),x=Number(new FormData(h.currentTarget).get("ano"))||x,ce()}),M(e)}function xe(e,a){const n=Uint8Array.from(atob(a),i=>i.charCodeAt(0)),t=new Blob([n],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(t),s=document.createElement("a");s.href=o,s.download=e,s.click(),URL.revokeObjectURL(o)}function I(e){const a=[];return e.printable&&a.push('<button class="outline small" id="btn-print">Imprimir / PDF</button>'),e.csvExport&&a.push('<button class="outline small" id="btn-csv">Exportar CSV</button>'),a.length?`<div class="export-bar">${a.join("")}</div>`:""}function Ae(e){if(!e.searchable)return"";const a=D?'<button type="button" class="secondary small" id="clear-search">Limpar</button>':"";return`
    <form id="search-form" class="search-bar">
      <input name="q" type="search" placeholder="Buscar por número ou fatos..."
             value="${r(D)}" />
      <button type="submit">Buscar</button>
      ${a}
    </form>
  `}function M(e){var a,n,t,o;(a=document.querySelector("#btn-print"))==null||a.addEventListener("click",()=>{window.print()}),(n=document.querySelector("#btn-csv"))==null||n.addEventListener("click",async()=>{if(!e.csvExport)return;const s=document.querySelector("#btn-csv");s.disabled=!0,s.textContent="Gerando…";const i=await l("reports_export_csv",{request:{tipo_relatorio:e.csvExport.tipoRelatorio,ano:null}});if(s.disabled=!1,s.textContent="Exportar CSV",!i.ok||!i.data){alert(i.error??"Falha ao exportar.");return}xe(i.data.filename,i.data.csv_base64)}),(t=document.querySelector("#search-form"))==null||t.addEventListener("submit",s=>{s.preventDefault(),D=(new FormData(s.currentTarget).get("q")??"").trim(),F()}),(o=document.querySelector("#clear-search"))==null||o.addEventListener("click",()=>{D="",F()})}ge().then(()=>{C?F():te()});
