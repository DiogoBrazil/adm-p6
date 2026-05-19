(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&o(i)}).observe(document,{childList:!0,subtree:!0});function r(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function o(n){if(n.ep)return;n.ep=!0;const a=r(n);fetch(n.href,a)}})();async function ye(e,t={},r){return window.__TAURI_INTERNALS__.invoke(e,t,r)}const Y=[{path:"/dashboard",label:"Dashboard",group:"Geral",command:"dashboard_summary",printable:!0},{path:"/procedimentos/lista",label:"Procedimentos",group:"Procedimentos",command:"proceedings_list",csvExport:{tipoRelatorio:"processos"},printable:!0,searchable:!0,detailCommand:"proceedings_get",itemsKey:"items"},{path:"/prazos",label:"Prazos",group:"Procedimentos",printable:!0},{path:"/catalogos/transgressoes",label:"Transgressões",group:"Catálogos",command:"legal_catalogs_list_transgressions",writeCommands:["legal_catalogs_save_transgression","legal_catalogs_delete_transgression"]},{path:"/catalogos/artigos-rdpm",label:"Artigos RDPM",group:"Catálogos",command:"legal_catalogs_list_artigos_rdpm",writeCommands:["legal_catalogs_save_artigo_rdpm","legal_catalogs_delete_artigo_rdpm"]},{path:"/catalogos/crimes",label:"Crimes e Contravenções",group:"Catálogos",command:"legal_catalogs_list_crimes",writeCommands:["legal_catalogs_save_crime","legal_catalogs_delete_crime"]},{path:"/catalogos/dispositivos",label:"Dispositivos Legais",group:"Catálogos",command:"legal_catalogs_list_dispositivos_legais",writeCommands:["legal_catalogs_save_dispositivo_legal","legal_catalogs_delete_dispositivo_legal"]},{path:"/catalogos/art29",label:"Estatuto Art. 29",group:"Catálogos",command:"legal_catalogs_list_art29",writeCommands:["legal_catalogs_save_art29","legal_catalogs_delete_art29"]},{path:"/catalogos/art32",label:"Estatuto Art. 32",group:"Catálogos",command:"legal_catalogs_list_art32",writeCommands:["legal_catalogs_save_art32","legal_catalogs_delete_art32"]},{path:"/usuarios/lista",label:"Usuários",group:"Usuários",command:"users_list",writeCommands:["users_save","users_delete","users_reactivate"],printable:!0,detailCommand:"users_get"},{path:"/usuarios/novo",label:"Novo usuário",group:"Usuários",command:"users_form_schema",adminOnly:!0},{path:"/catalogos/tipos-usuario",label:"Tipos de Usuário",group:"Usuários",command:"legal_catalogs_list_tipos_usuario",writeCommands:["legal_catalogs_save_tipo_usuario","legal_catalogs_delete_tipo_usuario"]},{path:"/catalogos/postos-graduacoes",label:"Postos e Graduações",group:"Usuários",command:"legal_catalogs_list_postos_graduacoes",writeCommands:["legal_catalogs_save_posto_graduacao","legal_catalogs_delete_posto_graduacao"]},{path:"/catalogos/tipos-documentos",label:"Tipos de Documento",group:"Catálogos",command:"legal_catalogs_list_tipos_documentos",writeCommands:["legal_catalogs_save_tipo_documento","legal_catalogs_delete_tipo_documento"]},{path:"/catalogos/tipos-penalidade",label:"Tipos de Penalidade",group:"Catálogos",command:"legal_catalogs_list_tipos_penalidade",writeCommands:["legal_catalogs_save_tipo_penalidade","legal_catalogs_delete_tipo_penalidade"]},{path:"/catalogos/tipos-prazo",label:"Tipos de Prazo",group:"Catálogos",command:"legal_catalogs_list_tipos_prazo",writeCommands:["legal_catalogs_save_tipo_prazo","legal_catalogs_delete_tipo_prazo"]},{path:"/catalogos/status-envolvido",label:"Status Envolvido",group:"Catálogos",command:"legal_catalogs_list_status_envolvido",writeCommands:["legal_catalogs_save_status_envolvido","legal_catalogs_delete_status_envolvido"]},{path:"/catalogos/solucoes-tipo",label:"Soluções por Tipo",group:"Catálogos",command:"legal_catalogs_list_solucoes_tipo",writeCommands:["legal_catalogs_save_solucao_tipo","legal_catalogs_delete_solucao_tipo"]},{path:"/catalogos/natureza-transgressao",label:"Natureza da Transgressão",group:"Catálogos",command:"legal_catalogs_list_natureza_transgressao",writeCommands:["legal_catalogs_save_natureza_transgressao","legal_catalogs_delete_natureza_transgressao"]},{path:"/catalogos/tipo-apuratorios",label:"Tipos Apuratórios",group:"Catálogos",command:"legal_catalogs_list_tipo_apuratorios",writeCommands:["legal_catalogs_save_tipo_apuratorio","legal_catalogs_delete_tipo_apuratorio"]},{path:"/catalogos/apuratorios",label:"Apuratórios",group:"Catálogos",command:"legal_catalogs_list_apuratorios",writeCommands:["legal_catalogs_save_apuratorio","legal_catalogs_delete_apuratorio"]},{path:"/catalogos/locais-origem",label:"Locais de Origem",group:"Catálogos",command:"legal_catalogs_list_locais_origem",writeCommands:["legal_catalogs_save_local_origem","legal_catalogs_delete_local_origem"]},{path:"/catalogos/municipios-distritos",label:"Municípios e Distritos",group:"Catálogos",command:"legal_catalogs_list_municipios_distritos",writeCommands:["legal_catalogs_save_municipio_distrito","legal_catalogs_delete_municipio_distrito"]},{path:"/catalogos/subdivisao-textos-normativos",label:"Subdivisões Normativas",group:"Catálogos",command:"legal_catalogs_list_subdivisao_textos_normativos",writeCommands:["legal_catalogs_save_subdivisao_texto_normativo","legal_catalogs_delete_subdivisao_texto_normativo"]},{path:"/auditoria",label:"Auditoria",group:"Auditoria",command:"audit_list",printable:!0,detailCommand:"audit_get"},{path:"/estatisticas/encarregados",label:"Estatísticas de Encarregados",group:"Relatórios",command:"reports_by_responsible",csvExport:{tipoRelatorio:"encarregados"},printable:!0},{path:"/estatisticas/processos",label:"Estatísticas de Processos",group:"Relatórios",command:"reports_by_type",printable:!0},{path:"/estatisticas/prazos",label:"Prazos Vencidos",group:"Relatórios",command:"reports_overdue_deadlines",csvExport:{tipoRelatorio:"prazos"},printable:!0},{path:"/mapas/mensal",label:"Mapa Mensal",group:"Mapas",printable:!0},{path:"/mapas/anteriores",label:"Mapas Salvos",group:"Mapas",command:"reports_saved_maps",printable:!0,detailCommand:"reports_get_saved_map"},{path:"/estatisticas/anuais",label:"Estatísticas Anuais",group:"Relatórios",printable:!0},{path:"/stats/procedimentos",label:"Estatísticas de Procedimentos",group:"Relatórios",printable:!0}];function $e(e){return e?e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/1024/1024).toFixed(1)} MB`:""}let R=null,ne="/dashboard",K=[],z="",S=null,x=new Date().getFullYear(),G=null,H={tabela:"",operacao:"",usuario_id:""};const ue=document.querySelector("#app"),Q={"/usuarios/lista":{saveCommand:"users_save",deleteCommand:"users_delete",idKind:"string",fields:[{name:"posto_graduacao",label:"Posto/Graduação",kind:"select",required:!0,optionsCommand:"legal_catalogs_list_postos_graduacoes",optionsValueKey:"nome_posto_graduacao"},{name:"nome",label:"Nome",kind:"text",required:!0},{name:"matricula",label:"Matrícula",kind:"text",required:!0},{name:"is_encarregado",label:"Encarregado",kind:"checkbox"},{name:"is_operador",label:"Operador",kind:"checkbox"},{name:"email",label:"Email",kind:"email"},{name:"perfil",label:"Perfil",kind:"select",options:["admin","comum"]},{name:"senha",label:"Senha",kind:"password"}]},"/catalogos/crimes":{saveCommand:"legal_catalogs_save_crime",deleteCommand:"legal_catalogs_delete_crime",idKind:"string",hiddenColumns:["dispositivo_legal_id"],fields:[{name:"dispositivo_legal_id",label:"Dispositivo Legal",kind:"select",optionsCommand:"legal_catalogs_list_dispositivos_legais",optionsLabelKey:"nome_dispositivo_legal"},{name:"artigo",label:"Artigo",kind:"text",required:!0},{name:"descricao_artigo",label:"Descrição",kind:"textarea"},{name:"paragrafo",label:"Parágrafo",kind:"text"},{name:"inciso",label:"Inciso",kind:"text"},{name:"alinea",label:"Alínea",kind:"text"}]},"/catalogos/dispositivos":{saveCommand:"legal_catalogs_save_dispositivo_legal",deleteCommand:"legal_catalogs_delete_dispositivo_legal",idKind:"string",fields:[{name:"nome_dispositivo_legal",label:"Nome",kind:"text",required:!0}]},"/catalogos/transgressoes":{saveCommand:"legal_catalogs_save_transgression",deleteCommand:"legal_catalogs_delete_transgression",idKind:"string",hiddenColumns:["artigo_id"],fields:[{name:"artigo_id",label:"Artigo RDPM",kind:"select",optionsCommand:"legal_catalogs_list_artigos_rdpm",optionsLabelKey:"nome"},{name:"inciso",label:"Inciso",kind:"text"},{name:"texto",label:"Texto",kind:"textarea",required:!0}]},"/catalogos/artigos-rdpm":{saveCommand:"legal_catalogs_save_artigo_rdpm",deleteCommand:"legal_catalogs_delete_artigo_rdpm",idKind:"string",hiddenColumns:["nome","natureza_id"],fields:[{name:"artigo",label:"Artigo",kind:"text",required:!0},{name:"natureza_id",label:"Natureza",kind:"select",required:!0,optionsCommand:"legal_catalogs_list_natureza_transgressao",optionsLabelKey:"nome_natureza"}]},"/catalogos/art29":{saveCommand:"legal_catalogs_save_art29",deleteCommand:"legal_catalogs_delete_art29",idKind:"string",fields:[{name:"inciso",label:"Inciso",kind:"text",required:!0},{name:"texto",label:"Texto",kind:"textarea",required:!0}]},"/catalogos/art32":{saveCommand:"legal_catalogs_save_art32",deleteCommand:"legal_catalogs_delete_art32",idKind:"string",fields:[{name:"inciso",label:"Inciso",kind:"text",required:!0},{name:"texto",label:"Texto",kind:"textarea",required:!0}]},"/catalogos/tipos-usuario":{saveCommand:"legal_catalogs_save_tipo_usuario",deleteCommand:"legal_catalogs_delete_tipo_usuario",idKind:"string",fields:[{name:"nome_tipo_usuario",label:"Nome",kind:"text",required:!0}]},"/catalogos/postos-graduacoes":{saveCommand:"legal_catalogs_save_posto_graduacao",deleteCommand:"legal_catalogs_delete_posto_graduacao",idKind:"string",hiddenColumns:["tipo_usuario_id"],fields:[{name:"nome_posto_graduacao",label:"Nome",kind:"text",required:!0},{name:"tipo_usuario_id",label:"Tipo de Usuário",kind:"select",required:!0,optionsCommand:"legal_catalogs_list_tipos_usuario",optionsLabelKey:"nome_tipo_usuario"}]},"/catalogos/tipos-documentos":{saveCommand:"legal_catalogs_save_tipo_documento",deleteCommand:"legal_catalogs_delete_tipo_documento",idKind:"string",fields:[{name:"nome_tipo_documento",label:"Tipo",kind:"text",required:!0}]},"/catalogos/tipos-penalidade":{saveCommand:"legal_catalogs_save_tipo_penalidade",deleteCommand:"legal_catalogs_delete_tipo_penalidade",idKind:"string",fields:[{name:"nome_penalidade",label:"Penalidade",kind:"text",required:!0}]},"/catalogos/tipos-prazo":{saveCommand:"legal_catalogs_save_tipo_prazo",deleteCommand:"legal_catalogs_delete_tipo_prazo",idKind:"string",fields:[{name:"nome_prazo",label:"Nome do Prazo",kind:"text",required:!0}]},"/catalogos/status-envolvido":{saveCommand:"legal_catalogs_save_status_envolvido",deleteCommand:"legal_catalogs_delete_status_envolvido",idKind:"string",fields:[{name:"nome_status",label:"Status",kind:"text",required:!0}]},"/catalogos/solucoes-tipo":{saveCommand:"legal_catalogs_save_solucao_tipo",deleteCommand:"legal_catalogs_delete_solucao_tipo",idKind:"string",fields:[{name:"nome_solucao",label:"Solução",kind:"text",required:!0}]},"/catalogos/natureza-transgressao":{saveCommand:"legal_catalogs_save_natureza_transgressao",deleteCommand:"legal_catalogs_delete_natureza_transgressao",idKind:"string",fields:[{name:"nome_natureza",label:"Nome da Natureza",kind:"text",required:!0}]},"/catalogos/tipo-apuratorios":{saveCommand:"legal_catalogs_save_tipo_apuratorio",deleteCommand:"legal_catalogs_delete_tipo_apuratorio",idKind:"string",fields:[{name:"nome_tipo_apuratorio",label:"Tipo",kind:"text",required:!0}]},"/catalogos/apuratorios":{saveCommand:"legal_catalogs_save_apuratorio",deleteCommand:"legal_catalogs_delete_apuratorio",idKind:"string",hiddenColumns:["tipo_apuratorio_id","documento_iniciador_id"],fields:[{name:"nome_apuratorio",label:"Nome",kind:"text",required:!0},{name:"tipo_apuratorio_id",label:"Tipo",kind:"select",required:!0,optionsCommand:"legal_catalogs_list_tipo_apuratorios",optionsLabelKey:"nome_tipo_apuratorio"},{name:"prazo_base_dias",label:"Prazo Base (dias)",kind:"number",required:!0},{name:"documento_iniciador_id",label:"Documento Iniciador",kind:"select",required:!0,optionsCommand:"legal_catalogs_list_tipos_documentos",optionsLabelKey:"nome_tipo_documento"}]},"/catalogos/locais-origem":{saveCommand:"legal_catalogs_save_local_origem",deleteCommand:"legal_catalogs_delete_local_origem",idKind:"string",hiddenColumns:["cidade_id"],fields:[{name:"nome_unidade_pm",label:"Unidade PM",kind:"text",required:!0},{name:"cidade_id",label:"Cidade",kind:"select",required:!0,optionsCommand:"legal_catalogs_list_municipios_distritos",optionsLabelKey:"nome_municipio_distrito"}]},"/catalogos/municipios-distritos":{saveCommand:"legal_catalogs_save_municipio_distrito",deleteCommand:"legal_catalogs_delete_municipio_distrito",idKind:"string",hiddenColumns:["municipio_pai","tipo","municipio_pai_nome"],fields:[{name:"nome_municipio_distrito",label:"Nome",kind:"text",required:!0},{name:"is_distrito",label:"Distrito",kind:"checkbox"},{name:"municipio_pai",label:"Município Pai",kind:"select",optionsCommand:"legal_catalogs_list_municipios_distritos",optionsLabelKey:"nome_municipio_distrito",showIf:{field:"is_distrito",value:!0}}]},"/catalogos/subdivisao-textos-normativos":{saveCommand:"legal_catalogs_save_subdivisao_texto_normativo",deleteCommand:"legal_catalogs_delete_subdivisao_texto_normativo",idKind:"string",hiddenColumns:["dispositivo_legal_id"],fields:[{name:"nome_subdivisao",label:"Subdivisão",kind:"text",required:!0},{name:"dispositivo_legal_id",label:"Dispositivo Legal",kind:"select",required:!0,optionsCommand:"legal_catalogs_list_dispositivos_legais",optionsLabelKey:"nome_dispositivo_legal"}]},"/procedimentos/lista":{saveCommand:"proceedings_create",updateCommand:"proceedings_update",deleteCommand:"proceedings_delete",idKind:"string",fields:[{name:"numero",label:"Número",kind:"text",required:!0},{name:"tipo_geral",label:"Tipo Geral",kind:"select",required:!0,options:["Processo","Procedimento"]},{name:"tipo_detalhe",label:"Tipo",kind:"select",required:!0,options:["PAD","PADE","CD","CJ","SR","SV","IPM","FP","CP","PADS"]},{name:"documento_iniciador",label:"Doc. Iniciador",kind:"select",required:!0,optionsCommand:"legal_catalogs_list_tipos_documentos",optionsValueKey:"nome_tipo_documento"},{name:"local_fatos",label:"Local dos Fatos",kind:"text",required:!0},{name:"local_origem",label:"Local de Origem",kind:"text"},{name:"data_instauracao",label:"Data de Instauração",kind:"date"},{name:"data_recebimento",label:"Data de Recebimento",kind:"date"},{name:"numero_portaria",label:"N° da Portaria",kind:"text"},{name:"numero_memorando",label:"N° do Memorando",kind:"text"},{name:"numero_feito",label:"N° do Feito",kind:"text"},{name:"numero_rgf",label:"N° RGF",kind:"text"},{name:"numero_controle",label:"N° de Controle",kind:"text"},{name:"processo_sei",label:"Processo SEI",kind:"text"},{name:"nome_vitima",label:"Nome da Vítima",kind:"text"},{name:"natureza_processo",label:"Natureza",kind:"text"},{name:"resumo_fatos",label:"Resumo dos Fatos",kind:"textarea"},{name:"concluido",label:"Concluído",kind:"checkbox"},{name:"data_conclusao",label:"Data de Conclusão",kind:"date"},{name:"solucao_tipo",label:"Tipo de Solução",kind:"select",options:["Punido","Absolvido","Arquivado","Homologado","Avocado"]},{name:"solucao_final",label:"Solução Final",kind:"textarea"},{name:"penalidade_tipo",label:"Penalidade",kind:"select",options:["Prisao","Detencao","Advertencia","Reprimenda"]},{name:"penalidade_dias",label:"Dias de Penalidade",kind:"number"}]}};function I(){return(R==null?void 0:R.is_admin)===!0}async function m(e,t={}){try{return await ye(e,t)}catch(r){return{ok:!1,data:null,error:String(r)}}}async function Se(){const e=await m("auth_current_user");R=e.ok?e.data:null}function Ce(){return Y.reduce((e,t)=>(e[t.group]=e[t.group]??[],e[t.group].push(t),e),{})}function C(e){var r;const t=Object.entries(Ce()).map(([o,n])=>`
      <section class="nav-group">
        <h2>${o}</h2>
        ${n.map(a=>`
          <button class="nav-item ${a.path===ne?"active":""}" data-route="${a.path}">
            <span>${a.label}</span>
            ${a.adminOnly?"<small>admin</small>":""}
          </button>
        `).join("")}
      </section>
    `).join("");ue.innerHTML=`
    <aside class="sidebar">
      <div class="brand">
        <strong>ADM P6</strong>
        <span>Rust/Tauri</span>
      </div>
      ${t}
    </aside>
    <main class="main">
      <header class="topbar">
        <div>
          <strong>${(R==null?void 0:R.nome)??"Sessão não autenticada"}</strong>
          <span>${(R==null?void 0:R.perfil)??"offline"}</span>
        </div>
        <button class="secondary" id="logout">Sair</button>
      </header>
      ${e}
    </main>
  `,document.querySelectorAll("[data-route]").forEach(o=>{o.addEventListener("click",()=>{ne=o.dataset.route??"/dashboard",O()})}),(r=document.querySelector("#logout"))==null||r.addEventListener("click",async()=>{await m("auth_logout"),R=null,pe()})}function pe(e=""){ue.innerHTML=`
    <main class="login-screen">
      <form id="login-form" class="login-panel">
        <h1>ADM P6</h1>
        <label>Email<input name="email" type="email" autocomplete="username" required /></label>
        <label>Senha<input name="senha" type="password" autocomplete="current-password" required /></label>
        ${e?`<p class="error">${e}</p>`:""}
        <button type="submit">Entrar</button>
      </form>
    </main>
  `,document.querySelector("#login-form").addEventListener("submit",async t=>{t.preventDefault();const r=new FormData(t.currentTarget),o=await m("auth_login",{email:r.get("email"),senha:r.get("senha")});if(!o.ok||!o.data){pe(o.error??"Falha ao autenticar.");return}R=o.data,ne="/dashboard",await O()})}function M(e,t){if(!Array.isArray(e))return`<pre>${s(JSON.stringify(e,null,2))}</pre>`;if(e.length===0)return'<p class="empty">Nenhum registro encontrado.</p>';const r=Q[t.path],o=new Set(["id",...(r==null?void 0:r.hiddenColumns)??[]]),n=Object.keys(e[0]).filter(i=>!o.has(i)),a=!!Q[t.path]&&I();return`
    <div class="table-wrap">
      <table>
        <thead><tr>${n.map(i=>`<th>${i}</th>`).join("")}${a?"<th>Ações</th>":""}</tr></thead>
        <tbody>
          ${e.map((i,p)=>`
            <tr data-row-index="${p}">
              ${n.map(v=>`<td>${s(we(i[v]))}</td>`).join("")}
              ${a?`
                <td class="row-actions">
                  <button class="secondary small" data-edit-index="${p}">Editar</button>
                  <button class="danger small" data-delete-index="${p}">Excluir</button>
                </td>
              `:""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function ke(e){var r;const t=Q[e.path];return I()?t?'<div class="actions"><button id="new-record">Novo</button></div>':(r=e.writeCommands)!=null&&r.length?`<div class="actions">${e.writeCommands.map(o=>`<code>${o}</code>`).join("")}</div>`:"":'<p class="readonly">Perfil somente leitura: ações de criação, edição e remoção estão desabilitadas.</p>'}function xe(e,t){const r=e==null?void 0:e[t.name];return typeof r=="boolean"?r:r==null?"":String(r)}function Ee(e){e.querySelectorAll("[data-show-if-field]").forEach(t=>{const r=t.getAttribute("data-show-if-field"),o=t.getAttribute("data-show-if-value"),n=e.querySelector(`[name="${r}"]`);if(!n)return;const a=()=>{const i=n.type==="checkbox"?String(n.checked):n.value;t.style.display=i===o?"":"none"};n.addEventListener("change",a),a()})}function qe(e,t,r){const o=xe(t,e),n=e.required?"required":"";let a;if(e.kind==="checkbox")a=`
      <label class="checkbox">
        <input name="${e.name}" type="checkbox" ${o===!0?"checked":""} />
        ${e.label}
      </label>
    `;else if(e.kind==="select"){const i=r?r.map(p=>`<option value="${s(p.value)}" ${o===p.value?"selected":""}>${s(p.label)}</option>`).join(""):(e.options??[]).map(p=>`<option value="${s(p)}" ${o===p?"selected":""}>${s(p)}</option>`).join("");a=`
      <label>${e.label}
        <select name="${e.name}" ${n}>
          <option value=""></option>
          ${i}
        </select>
      </label>
    `}else if(e.kind==="textarea")a=`<label>${e.label}<textarea name="${e.name}" ${n}>${s(String(o))}</textarea></label>`;else if(e.kind==="date"){const i=String(o).substring(0,10);a=`<label>${e.label}<input name="${e.name}" type="date" value="${s(i)}" ${n} /></label>`}else a=`<label>${e.label}<input name="${e.name}" type="${e.kind}" value="${s(String(o))}" ${n} /></label>`;return e.showIf?`<div data-show-if-field="${s(e.showIf.field)}" data-show-if-value="${s(String(e.showIf.value))}">${a}</div>`:a}async function J(e,t=null,r=""){var p,v;const o=Q[e.path];if(!o)return;const n={};await Promise.all(o.fields.filter(_=>_.optionsCommand).map(async _=>{const f=await m(_.optionsCommand);n[_.name]=(f.data??[]).map(u=>{const g=_.optionsValueKey?u[_.optionsValueKey]??u.id:u.id,h=_.optionsLabelKey?u[_.optionsLabelKey]??u.id:g;return{value:g,label:h}})}));const a=(t==null?void 0:t.id)??"";C(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${t?"Editar":"Novo"} - ${e.label}</h1>
          <p>${o.saveCommand}</p>
        </div>
        <button class="secondary" id="cancel-form">Cancelar</button>
      </div>
      <form id="crud-form" class="crud-form">
        <input type="hidden" name="id" value="${s(String(a))}" />
        ${o.fields.map(_=>qe(_,t,n[_.name])).join("")}
        ${r?`<p class="error">${r}</p>`:""}
        <div class="form-actions">
          <button type="submit">Salvar</button>
        </div>
      </form>
    </section>
  `);const i=document.querySelector("#crud-form");i&&Ee(i),(p=document.querySelector("#cancel-form"))==null||p.addEventListener("click",()=>{O()}),(v=document.querySelector("#crud-form"))==null||v.addEventListener("submit",async _=>{_.preventDefault();const f=new FormData(_.currentTarget),u=Ae(o,f),h=!!u.id&&o.updateCommand?o.updateCommand:o.saveCommand,y=await m(h,{request:u});if(!y.ok){J(e,t,y.error??"Falha ao salvar.");return}await O()})}function Ae(e,t){const r={},o=String(t.get("id")??"");r.id=o?ge(e,o):null;for(const n of e.fields){if(n.kind==="checkbox"){r[n.name]=t.get(n.name)==="on";continue}const a=String(t.get(n.name)??"").trim();if(n.kind==="number"){r[n.name]=a?Number(a):null;continue}r[n.name]=a||null}return r}function ge(e,t){return e.idKind==="number"?Number(t):t}function _e(e){var r;const t=Q[e.path];e.detailCommand&&document.querySelectorAll("tbody tr[data-row-index]").forEach(o=>{o.style.cursor="pointer",o.addEventListener("click",n=>{var p;if(n.target.closest("button"))return;const a=Number(o.dataset.rowIndex),i=String(((p=K[a])==null?void 0:p.id)??"");i&&(S=i,F(e))})}),!(!t||!I())&&((r=document.querySelector("#new-record"))==null||r.addEventListener("click",()=>{J(e)}),document.querySelectorAll("[data-edit-index]").forEach(o=>{o.addEventListener("click",()=>{const n=Number(o.dataset.editIndex);J(e,K[n]??null)})}),document.querySelectorAll("[data-delete-index]").forEach(o=>{o.addEventListener("click",async()=>{const n=Number(o.dataset.deleteIndex),a=K[n],i=a==null?void 0:a.id;if(!t.deleteCommand||i===void 0||i===null||!confirm("Confirmar exclusão?"))return;const p=await m(t.deleteCommand,{id:ge(t,String(i))});if(!p.ok){alert(p.error??"Falha ao excluir.");return}await O()})}))}async function O(){if(!R){pe();return}const e=Y.find(u=>u.path===ne)??Y[0];if(e.path==="/estatisticas/anuais")return ve();if(e.path==="/prazos")return De();if(e.path==="/mapas/mensal")return Re();if(e.path==="/auditoria")return me();if(e.path==="/usuarios/lista")return ie();if(e.path==="/stats/procedimentos")return he();if(e.path==="/usuarios/novo"){if(ne="/usuarios/lista",!I()){C('<section class="panel"><h1>Novo Usuário</h1><p class="error">Seu perfil é somente leitura.</p></section>');return}const u=Y.find(g=>g.path==="/usuarios/lista");await J(u);return}e.searchable||(z="");const t=e.adminOnly&&!I();let r="";if(t?r=`<section class="panel"><h1>${e.label}</h1><p class="error">Seu perfil é somente leitura.</p></section>`:e.command&&(r=`<section class="panel"><h1>${e.label}</h1><p>Carregando...</p></section>`),C(r),!e.command||t)return;const o=e.searchable?{filter:{search:z||null}}:{},n=await m(e.command,o),a=n.data,i=e.itemsKey?a==null?void 0:a[e.itemsKey]:a;K=Array.isArray(i)?i:[];const p=ke(e),v=B(e),_=e.path==="/dashboard"&&!Array.isArray(a),f=n.ok?_?Pe(a):M(i,e):`<p class="error">${n.error}</p>`;C(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${e.label}</h1>
          <p>${e.path}</p>
        </div>
        <div class="page-head-right">
          ${p}
          ${v}
        </div>
      </div>
      ${Ie(e)}
      ${f}
    </section>
  `),_e(e),U(e)}function s(e){return e.replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[t]??t)}function we(e){return typeof e=="boolean"?e?"sim":"não":String(e??"")}function Pe(e){const t=(r,o,n=!1)=>`
    <div class="stat-card ${n?"stat-card--alert":""}">
      <span class="stat-value">${s(String(o??0))}</span>
      <span class="stat-label">${r}</span>
    </div>
  `;return`
    <div class="stat-grid">
      ${t("Total de Processos",e.total_processos)}
      ${t("Em Andamento",e.em_andamento)}
      ${t("Concluídos",e.concluidos)}
      ${t("Prazos Vencidos",e.prazos_vencidos,Number(e.prazos_vencidos)>0)}
    </div>
  `}async function F(e){var X,Z,ee,ae,te,d,L,A;if(!S||!e.detailCommand)return;if(G&&e.path==="/procedimentos/lista")return Le(e);C('<section class="panel"><p>Carregando detalhes...</p></section>');const t=e.path==="/procedimentos/lista",[r,o,n]=await Promise.all([m(e.detailCommand,{id:S}),t?m("evidence_list_for_proceeding",{procedimento_id:S}):Promise.resolve({ok:!0,data:[],error:null}),t?m("deadlines_list",{processo_id:S}):Promise.resolve({ok:!0,data:[],error:null})]);if(!r.ok){C(`<section class="panel"><p class="error">${s(r.error??"Erro")}</p></section>`);return}const a=r.data??{},i=Q[e.path],p=!!(i&&I()),v=Array.isArray(a.andamentos)?a.andamentos:[],_=!!a.pdf_nome,u=t?[["numero","Número"],["tipo_geral","Tipo Geral"],["tipo_detalhe","Tipo"],["documento_iniciador","Doc. Iniciador"],["processo_sei","SEI"],["data_instauracao","Instauração"],["data_recebimento","Recebimento"],["responsavel_nome","Encarregado"],["escrivao_nome","Escrivão"],["local_origem","Local Origem"],["local_fatos","Local dos Fatos"],["natureza_processo","Natureza"],["resumo_fatos","Resumo"],["concluido","Concluído"],["data_conclusao","Data Conclusão"],["solucao_tipo","Solução"],["solucao_final","Decisão Final"],["penalidade_tipo","Penalidade"],["penalidade_dias","Dias"]].filter(([l])=>{const c=a[l];return c!=null&&String(c).trim()!==""}).map(([l,c])=>{const b=a[l],E=typeof b=="boolean"?b?"Sim":"Não":String(b);return`<tr><th>${c}</th><td>${s(E)}</td></tr>`}).join(""):Object.entries(a).filter(([,l])=>l!=null&&String(l).trim()!==""&&typeof l!="object").map(([l,c])=>{const b=typeof c=="boolean"?c?"Sim":"Não":String(c);return`<tr><th>${s(l)}</th><td>${s(b)}</td></tr>`}).join(""),g=t?`
    <div class="detail-section">
      <h2>Andamentos <span class="badge">${v.length}</span></h2>
      ${v.length>0?`
        <ul class="andamentos-list">
          ${v.map(l=>`
            <li class="andamento-item">
              <div class="andamento-meta">
                <span>${s(l.data)}</span>
                ${I()?`<button class="danger small" data-remove-andamento="${s(l.id)}">Remover</button>`:""}
              </div>
              <p class="andamento-texto">${s(l.texto)}</p>
            </li>
          `).join("")}
        </ul>
      `:'<p class="empty">Nenhum andamento registrado.</p>'}
      ${I()?`
        <form id="add-movement-form" class="add-movement-form">
          <textarea name="texto" placeholder="Descreva o andamento..." required></textarea>
          <button type="submit">Adicionar Andamento</button>
        </form>
      `:""}
    </div>
  `:"",h=t?`
    <div class="detail-section">
      <h2>PDF Anexo</h2>
      ${_?`
        <div class="pdf-info">
          <span class="pdf-name">${s(String(a.pdf_nome))}</span>
          <span class="pdf-size">${$e(Number(a.pdf_tamanho??0))}</span>
          <button id="btn-view-pdf">Abrir PDF</button>
          ${I()?'<button class="danger small" id="btn-remove-pdf">Remover</button>':""}
        </div>
      `:`
        <p class="empty">Nenhum PDF anexado.</p>
        ${I()?`
          <label class="upload-label">
            Fazer Upload de PDF
            <input type="file" id="pdf-upload-input" accept=".pdf" />
          </label>
        `:""}
      `}
    </div>
  `:"",y=Array.isArray(o.data)?o.data:[],P=t?`
    <div class="detail-section">
      <h2>Indícios por PM <span class="badge">${y.length}</span></h2>
      ${y.length===0?'<p class="empty">Nenhum PM envolvido com indícios registrados.</p>':`
        <ul class="andamentos-list">
          ${y.map(l=>{const c=l.indicios??{categorias:[],crimes_militares:[],crimes_comuns:[],rdpm:[],art29:[],art32:[]},b=c.categorias.length>0?c.categorias.join(", "):"sem categorias",E=c.crimes_militares.length+c.crimes_comuns.length+c.rdpm.length+c.art29.length+c.art32.length;return`
              <li class="andamento-item">
                <div class="andamento-meta">
                  <strong>${s(l.posto_graduacao??"")} ${s(l.nome??l.pm_envolvido_id)}</strong>
                  <span class="badge">${E} item(s)</span>
                  <span>${s(b)}</span>
                  <button class="secondary small" data-evidence-pm="${s(l.pm_envolvido_id)}">Gerenciar Indícios</button>
                </div>
              </li>`}).join("")}
        </ul>
      `}
    </div>
  `:"",q=Array.isArray(n.data)?n.data:[],k=q.find(l=>l.ativo!==!1&&l.tipo_prazo==="inicial")??q.find(l=>l.ativo!==!1),$=t?`
    <div class="detail-section">
      <h2>Prazos <span class="badge">${q.length}</span></h2>
      ${q.length>0?`
        <div class="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Início</th><th>Vencimento</th><th>Dias+</th><th>Motivo</th><th>Status</th></tr></thead>
            <tbody>
              ${q.map(l=>`
                <tr>
                  <td>${s(String(l.tipo_prazo??""))}</td>
                  <td>${s(String(l.data_inicio??""))}</td>
                  <td>${s(String(l.data_vencimento??""))}</td>
                  <td>${s(String(l.dias_adicionados??""))}</td>
                  <td>${s(String(l.motivo??""))}</td>
                  <td>${l.ativo!==!1?'<span class="badge badge--warn">Ativo</span>':'<span class="badge">Encerrado</span>'}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `:'<p class="empty">Nenhum prazo cadastrado.</p>'}
      ${I()?`
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
  `:"",re=s(String(a.numero??"Detalhe")),le=a.tipo_detalhe?`<small>${s(String(a.tipo_detalhe))}</small>`:"",de=a.concluido?'<span class="badge badge--ok">Concluído</span>':'<span class="badge badge--warn">Em Andamento</span>';C(`
    <section class="panel">
      <div class="page-head">
        <div><h1>${re} ${le} ${t?de:""}</h1><p>${S}</p></div>
        <div class="page-head-right">
          ${p?'<button id="edit-detail">Editar</button>':""}
          <button class="secondary" id="back-to-list">← Voltar</button>
          ${B({...e,csvExport:void 0})}
        </div>
      </div>
      <div class="table-wrap"><table class="detail-table"><tbody>${u}</tbody></table></div>
      ${h}
      ${$}
      ${P}
      ${g}
    </section>
  `),(X=document.querySelector("#back-to-list"))==null||X.addEventListener("click",()=>{S=null,O()}),p&&i&&((Z=document.querySelector("#edit-detail"))==null||Z.addEventListener("click",()=>{J(e,a)})),(ee=document.querySelector("#add-movement-form"))==null||ee.addEventListener("submit",async l=>{l.preventDefault();const b=new FormData(l.currentTarget).get("texto").trim(),E=await m("movements_add",{request:{processo_id:S,texto:b}});if(!E.ok){alert(E.error??"Falha ao adicionar andamento.");return}F(e)}),document.querySelectorAll("[data-remove-andamento]").forEach(l=>{l.addEventListener("click",async()=>{if(!confirm("Remover este andamento?"))return;const c=l.dataset.removeAndamento,b=await m("movements_remove",{processo_id:S,andamento_id:c});if(!b.ok){alert(b.error??"Falha ao remover.");return}F(e)})}),(ae=document.querySelector("#btn-view-pdf"))==null||ae.addEventListener("click",async()=>{var E;const l=await m("proceedings_get_pdf",{processo_id:S,include_content:!0});if(!l.ok||!((E=l.data)!=null&&E.conteudo)){alert("Falha ao carregar PDF.");return}const c=Uint8Array.from(atob(l.data.conteudo),N=>N.charCodeAt(0)),b=new Blob([c],{type:l.data.content_type??"application/pdf"});window.open(URL.createObjectURL(b),"_blank")}),(te=document.querySelector("#btn-remove-pdf"))==null||te.addEventListener("click",async()=>{if(!confirm("Remover o PDF anexado?"))return;const l=await m("proceedings_remove_pdf",{processo_id:S});if(!l.ok){alert(l.error??"Falha ao remover PDF.");return}F(e)}),(d=document.querySelector("#pdf-upload-input"))==null||d.addEventListener("change",async l=>{var E;const c=(E=l.currentTarget.files)==null?void 0:E[0];if(!c)return;const b=new FileReader;b.onload=async()=>{const N=b.result.split(",")[1],T=await m("proceedings_upload_pdf",{request:{processo_id:S,nome_arquivo:c.name,conteudo_base64:N,content_type:c.type||"application/pdf"}});if(!T.ok){alert(T.error??"Falha no upload.");return}F(e)},b.readAsDataURL(c)}),document.querySelectorAll("[data-evidence-pm]").forEach(l=>{l.addEventListener("click",()=>{G=l.dataset.evidencePm,F(e)})}),(L=document.querySelector("#btn-close-deadline"))==null||L.addEventListener("click",async()=>{if(!confirm("Encerrar o prazo ativo deste processo?"))return;const l=await m("deadlines_close",{processo_id:S});if(!l.ok){alert(l.error??"Falha ao encerrar prazo.");return}F(e)}),(A=document.querySelector("#extension-form"))==null||A.addEventListener("submit",async l=>{l.preventDefault();const c=new FormData(l.currentTarget),b=c.get("data_portaria").trim(),E=await m("deadlines_add_extension",{request:{processo_id:S,dias_prorrogacao:Number(c.get("dias")),motivo:c.get("motivo").trim(),autorizado_por:c.get("autorizado_por").trim(),autorizado_tipo:c.get("autorizado_tipo").trim(),numero_portaria:c.get("numero_portaria").trim()||null,data_portaria:b||null}});if(!E.ok){alert(E.error??"Falha ao prorrogar.");return}F(e)}),U({...e,csvExport:void 0})}async function Le(e){var le,de,X,Z,ee,ae,te;if(!S||!G)return;C('<section class="panel"><p>Carregando indícios...</p></section>');const[t,r]=await Promise.all([m("evidence_load_for_pm",{pm_envolvido_id:G}),m("evidence_categories")]),o=t.data??{categorias:[],crimes_militares:[],crimes_comuns:[],rdpm:[],art29:[],art32:[]},n=r.data??["crimes_cpm","transgressoes_rdpm","transgressoes_art29","sem_indicios"],a=d=>Array.isArray(d)?d:[],i=d=>s(String(d.artigo??d.inciso??d.id??"")),p=d=>s(String(d.descricao_artigo??d.texto??"")),v=d=>d.analogia_inciso||d.analogia_artigo?`Art. ${d.analogia_artigo??"?"}, Inc. ${d.analogia_inciso??""}`:"",_=d=>`
    <div class="evidence-item">
      <span>${i(d)}</span>
      <small>${p(d)}</small>
      <button class="danger small" data-item-id="${s(String(d.id??""))}">×</button>
    </div>`,f=(d,L,A,l,c)=>`
    <div class="evidence-item art-item" data-infracao="${s(d)}">
      <div class="art-infr"><strong>${s(L)}</strong> <small>${s(A)}</small></div>
      <div class="art-analogia">
        <span>Analogia RDPM:</span>
        <span class="analogia-current">${l?s(c):"(selecione)"}</span>
        <input class="analogia-input" type="search" placeholder="buscar transgressão RDPM..." />
        <button class="outline small analogia-search-btn" type="button">Buscar</button>
        <div class="analogia-results evidence-results"></div>
      </div>
      <button class="danger small art-remove" type="button">×</button>
    </div>`;C(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Indícios — PM ${s(G)}</h1></div>
        <div class="page-head-right">
          <button id="save-evidence">Salvar Indícios</button>
          <button class="secondary" id="back-to-detail">← Voltar ao Processo</button>
        </div>
      </div>

      <div class="detail-section">
        <h2>Categorias</h2>
        <div class="evidence-cats">
          ${n.map(d=>`
            <label class="checkbox">
              <input type="checkbox" name="cat" value="${s(d)}" ${o.categorias.includes(d)?"checked":""} />
              ${s(d)}
            </label>`).join("")}
        </div>
      </div>

      <div class="detail-section">
        <h2>Crimes Militares (${a(o.crimes_militares).length})</h2>
        <div id="crimes-mil-list">${a(o.crimes_militares).map(_).join("")||'<p class="empty">Nenhum</p>'}</div>
        <div class="evidence-search">
          <input id="search-crimes-mil-input" type="search" placeholder="Buscar crime militar..." />
          <button id="btn-search-crimes-mil">Buscar</button>
        </div>
        <div id="crimes-mil-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Crimes Comuns (${a(o.crimes_comuns).length})</h2>
        <div id="crimes-com-list">${a(o.crimes_comuns).map(_).join("")||'<p class="empty">Nenhum</p>'}</div>
        <div class="evidence-search">
          <input id="search-crimes-com-input" type="search" placeholder="Buscar crime comum..." />
          <button id="btn-search-crimes-com">Buscar</button>
        </div>
        <div id="crimes-com-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Transgressões RDPM (${a(o.rdpm).length})</h2>
        <div id="rdpm-list">${a(o.rdpm).map(_).join("")||'<p class="empty">Nenhuma</p>'}</div>
        <div class="evidence-search">
          <input id="search-rdpm-input" type="search" placeholder="Buscar transgressão..." />
          <button id="btn-search-rdpm">Buscar</button>
        </div>
        <div id="rdpm-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Art. 29 — Estatuto (${a(o.art29).length})</h2>
        <p class="hint">Cada infração exige uma transgressão RDPM por analogia.</p>
        <div id="art29-list">${o.art29.map(d=>f(d.infracao_id,`Inc. ${d.infracao_inciso??""}`,d.infracao_texto??"",d.analogia_id,v(d))).join("")||'<p class="empty">Nenhum</p>'}</div>
        <div class="evidence-search">
          <input id="search-art29-input" type="search" placeholder="Buscar art. 29..." />
          <button id="btn-search-art29">Buscar</button>
        </div>
        <div id="art29-results" class="evidence-results"></div>
      </div>

      <div class="detail-section">
        <h2>Art. 32 — Estatuto (${a(o.art32).length})</h2>
        <p class="hint">Cada infração exige uma transgressão RDPM por analogia.</p>
        <div id="art32-list">${o.art32.map(d=>f(d.infracao_id,`Inc. ${d.infracao_inciso??""}`,d.infracao_texto??"",d.analogia_id,v(d))).join("")||'<p class="empty">Nenhum</p>'}</div>
        <div class="evidence-search">
          <input id="search-art32-input" type="search" placeholder="Buscar art. 32..." />
          <button id="btn-search-art32">Buscar</button>
        </div>
        <div id="art32-results" class="evidence-results"></div>
      </div>
    </section>
  `),(le=document.querySelector("#back-to-detail"))==null||le.addEventListener("click",()=>{G=null,F(e)});const u=new Set(a(o.crimes_militares).map(d=>String(d.id))),g=new Set(a(o.crimes_comuns).map(d=>String(d.id))),h=new Set(a(o.rdpm).map(d=>String(d.id)));function y(d,L){document.querySelectorAll(`#${d} [data-item-id]`).forEach(A=>{A.addEventListener("click",()=>{var l;L.delete(A.dataset.itemId),(l=A.closest(".evidence-item"))==null||l.remove()})})}y("crimes-mil-list",u),y("crimes-com-list",g),y("rdpm-list",h);async function P(d,L,A,l,c){var D;const b=(((D=document.querySelector(`#${L}`))==null?void 0:D.value)??"").trim(),N=(await m(d,{termo:b})).data??[],T=document.querySelector(`#${A}`);if(!N.length){T.innerHTML='<p class="empty">Sem resultados.</p>';return}T.innerHTML=N.map(w=>`
      <div class="evidence-result-item">
        <div><strong>${i(w)}</strong> — <small>${s(String(w.descricao_artigo??w.texto??"").substring(0,80))}</small></div>
        ${c.has(String(w.id))?'<span class="badge badge--ok">✓ Adicionado</span>':`<button class="outline small" data-add-id="${s(String(w.id))}">Adicionar</button>`}
      </div>`).join(""),T.querySelectorAll("[data-add-id]").forEach(w=>{w.addEventListener("click",()=>{var se;const j=w.dataset.addId,W=N.find(ce=>String(ce.id)===j);if(!W||c.has(j))return;c.add(j);const oe=document.querySelector(`#${l}`);(se=oe.querySelector(".empty"))==null||se.remove();const V=document.createElement("div");V.className="evidence-item",V.innerHTML=`<span>${i(W)}</span><small>${p(W)}</small><button class="danger small">×</button>`,V.querySelector("button").addEventListener("click",()=>{c.delete(j),V.remove()}),oe.appendChild(V),w.outerHTML='<span class="badge badge--ok">✓ Adicionado</span>'})})}(de=document.querySelector("#btn-search-crimes-mil"))==null||de.addEventListener("click",()=>P("evidence_search_crimes","search-crimes-mil-input","crimes-mil-results","crimes-mil-list",u)),(X=document.querySelector("#btn-search-crimes-com"))==null||X.addEventListener("click",()=>P("evidence_search_crimes","search-crimes-com-input","crimes-com-results","crimes-com-list",g)),(Z=document.querySelector("#btn-search-rdpm"))==null||Z.addEventListener("click",()=>P("evidence_search_rdpm","search-rdpm-input","rdpm-results","rdpm-list",h));const q=new Map,k=new Map;o.art29.forEach(d=>q.set(d.infracao_id,d.analogia_id)),o.art32.forEach(d=>k.set(d.infracao_id,d.analogia_id));function $(d,L){const A=d.dataset.infracao;d.querySelector(".art-remove").addEventListener("click",()=>{L.delete(A),d.remove()});const l=d.querySelector(".analogia-input"),c=d.querySelector(".analogia-results"),b=d.querySelector(".analogia-current");d.querySelector(".analogia-search-btn").addEventListener("click",async()=>{const E=l.value.trim(),T=(await m("evidence_search_rdpm",{termo:E})).data??[];if(!T.length){c.innerHTML='<p class="empty">Sem resultados.</p>';return}c.innerHTML=T.map(D=>`
        <div class="evidence-result-item">
          <div><strong>Art. ${s(String(D.artigo??"?"))}, Inc. ${s(String(D.inciso??""))}</strong> — <small>${s(String(D.texto??"").substring(0,70))}</small></div>
          <button class="outline small" data-pick="${s(String(D.id))}" data-label="Art. ${s(String(D.artigo??"?"))}, Inc. ${s(String(D.inciso??""))}">Usar</button>
        </div>`).join(""),c.querySelectorAll("[data-pick]").forEach(D=>{D.addEventListener("click",()=>{L.set(A,D.dataset.pick),b.textContent=D.dataset.label,c.innerHTML="",l.value=""})})})}document.querySelectorAll("#art29-list .art-item").forEach(d=>$(d,q)),document.querySelectorAll("#art32-list .art-item").forEach(d=>$(d,k));async function re(d,L,A,l,c){var D;const b=(((D=document.querySelector(`#${L}`))==null?void 0:D.value)??"").trim(),N=(await m(d,{termo:b})).data??[],T=document.querySelector(`#${A}`);if(!N.length){T.innerHTML='<p class="empty">Sem resultados.</p>';return}T.innerHTML=N.map(w=>`
      <div class="evidence-result-item">
        <div><strong>Inc. ${s(String(w.inciso??""))}</strong> — <small>${s(String(w.texto??"").substring(0,80))}</small></div>
        ${c.has(String(w.id))?'<span class="badge badge--ok">✓ Adicionado</span>':`<button class="outline small" data-add-id="${s(String(w.id))}">Adicionar</button>`}
      </div>`).join(""),T.querySelectorAll("[data-add-id]").forEach(w=>{w.addEventListener("click",()=>{var ce;const j=w.dataset.addId,W=N.find(fe=>String(fe.id)===j);if(!W||c.has(j))return;c.set(j,"");const oe=document.querySelector(`#${l}`);(ce=oe.querySelector(".empty"))==null||ce.remove();const V=document.createElement("div");V.innerHTML=f(j,`Inc. ${String(W.inciso??"")}`,String(W.texto??""),"","");const se=V.firstElementChild;oe.appendChild(se),$(se,c),w.outerHTML='<span class="badge badge--ok">✓ Adicionado</span>'})})}(ee=document.querySelector("#btn-search-art29"))==null||ee.addEventListener("click",()=>re("evidence_search_art29","search-art29-input","art29-results","art29-list",q)),(ae=document.querySelector("#btn-search-art32"))==null||ae.addEventListener("click",()=>re("evidence_search_art32","search-art32-input","art32-results","art32-list",k)),(te=document.querySelector("#save-evidence"))==null||te.addEventListener("click",async()=>{const d=[...document.querySelectorAll("input[name='cat']:checked")].map(c=>c.value),L=[...q.entries()],A=[...k.entries()];if(L.some(([,c])=>!c)||A.some(([,c])=>!c)){alert("Cada infração do Art. 29 / Art. 32 precisa de uma transgressão RDPM por analogia.");return}const l=await m("evidence_save_for_pm",{request:{pm_envolvido_id:G,categorias:d,crimes_militares:[...u],crimes_comuns:[...g],rdpm:[...h],art29:L.map(([c,b])=>({infracao_id:c,analogia_id:b})),art32:A.map(([c,b])=>({infracao_id:c,analogia_id:b}))}});if(!l.ok){alert(l.error??"Falha ao salvar.");return}G=null,F(e)})}async function De(){C('<section class="panel"><p>Carregando...</p></section>');const[e,t,r]=await Promise.all([m("deadlines_upcoming",{days_ahead:14}),m("deadlines_overdue"),m("deadlines_dashboard")]),o=e.data??[],n=t.data??[],a=r.data??{},i={path:"/prazos",printable:!0};C(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Prazos</h1></div>
        <div class="page-head-right">${B(i)}</div>
      </div>
      <div class="stat-grid" style="margin-bottom:24px">
        <div class="stat-card"><span class="stat-value">${s(String(a.total??0))}</span><span class="stat-label">Total</span></div>
        <div class="stat-card stat-card--alert"><span class="stat-value">${s(String(a.vencidos??0))}</span><span class="stat-label">Vencidos</span></div>
        <div class="stat-card"><span class="stat-value">${s(String(a.proximos_7_dias??0))}</span><span class="stat-label">Próximos 7 dias</span></div>
      </div>
      ${n.length>0?`
        <h2 style="color:#dc2626;margin:0 0 12px">Vencidos (${n.length})</h2>
        ${M(n,i)}
      `:""}
      <h2 style="margin:24px 0 12px">Próximos 14 dias (${o.length})</h2>
      ${o.length>0?M(o,i):'<p class="empty">Nenhum prazo próximo.</p>'}
    </section>
  `),U(i)}async function Re(){var a;C('<section class="panel"><p>Carregando...</p></section>');const[e,t]=await Promise.all([m("reports_process_types"),m("reports_available_years")]),r=e.data??[],o=t.data??[x],n={printable:!0};C(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Mapa Mensal</h1></div>
        <div class="page-head-right">${B(n)}</div>
      </div>
      <form id="map-form" class="add-movement-form" style="max-width:500px">
        <label>Mês
          <select name="mes">
            ${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"].map((i,p)=>`<option value="${p+1}" ${p+1===new Date().getMonth()+1?"selected":""}>${i}</option>`).join("")}
          </select>
        </label>
        <label>Ano
          <select name="ano">
            ${o.map(i=>`<option value="${i}" ${i===x?"selected":""}>${i}</option>`).join("")}
          </select>
        </label>
        <label>Tipo de Processo
          <select name="tipo_processo">
            ${r.map(i=>`<option value="${s(i.codigo)}">${s(i.codigo)} (${i.total})</option>`).join("")}
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
  `),(a=document.querySelector("#map-form"))==null||a.addEventListener("submit",async i=>{var P,q;i.preventDefault();const p=new FormData(i.currentTarget),v=Number(p.get("mes")),_=Number(p.get("ano")),f=String(p.get("tipo_processo")??"TODOS"),u=((P=i.submitter)==null?void 0:P.value)??"mensal",g=document.querySelector("#map-result");g.innerHTML="<p>Gerando mapa...</p>";const h=u==="completo"?await m("reports_generate_complete_map",{request:{mes:v,ano:_}}):await m("reports_generate_monthly_map",{request:{mes:v,ano:_,tipo_processo:f}});if(!h.ok){g.innerHTML=`<p class="error">${s(h.error??"Erro")}</p>`;return}const y=h.data;g.innerHTML=`
      <h2 style="margin-top:24px">Resultado</h2>
      <pre>${s(JSON.stringify(y.meta??y,null,2))}</pre>
      <button id="btn-save-map">Salvar este Mapa</button>
    `,(q=document.querySelector("#btn-save-map"))==null||q.addEventListener("click",async()=>{const k=await m("reports_save_map",{request:{dados_mapa:y}});if(!k.ok){alert(k.error??"Falha ao salvar.");return}alert("Mapa salvo com sucesso!")})}),U(n)}async function me(){var o,n;const e=Y.find(a=>a.path==="/auditoria");C('<section class="panel"><p>Carregando...</p></section>');const t=await m("audit_list",{limit:200,offset:0,tabela:H.tabela||null,operacao:H.operacao||null,usuario_id:H.usuario_id||null}),r=t.data??[];K=r,C(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Auditoria</h1></div>
        <div class="page-head-right">${B({...e,csvExport:void 0})}</div>
      </div>
      <form id="audit-filter-form" class="search-bar" style="flex-wrap:wrap">
        <input name="tabela" type="text" placeholder="Tabela" value="${s(H.tabela)}" style="max-width:160px" />
        <select name="operacao">
          <option value="">Operação</option>
          ${["CREATE","UPDATE","DELETE"].map(a=>`<option ${H.operacao===a?"selected":""}>${a}</option>`).join("")}
        </select>
        <input name="usuario_id" type="text" placeholder="ID do usuário" value="${s(H.usuario_id)}" style="max-width:220px" />
        <button type="submit">Filtrar</button>
        <button type="button" class="secondary small" id="clear-audit-filter">Limpar</button>
      </form>
      ${t.ok?M(r,e):`<p class="error">${t.error}</p>`}
    </section>
  `),(o=document.querySelector("#audit-filter-form"))==null||o.addEventListener("submit",a=>{a.preventDefault();const i=new FormData(a.currentTarget);H={tabela:i.get("tabela").trim(),operacao:i.get("operacao").trim(),usuario_id:i.get("usuario_id").trim()},me()}),(n=document.querySelector("#clear-audit-filter"))==null||n.addEventListener("click",()=>{H={tabela:"",operacao:"",usuario_id:""},me()}),_e(e),U({...e,csvExport:void 0})}async function ve(){var p;C('<section class="panel"><p>Carregando...</p></section>');const t=(await m("reports_available_years")).data??[x],r=await m("reports_annual_statistics",{ano:x}),o=r.data,n=t.map(v=>`<option value="${v}" ${v===x?"selected":""}>${v}</option>`).join(""),a=o?`
    <div class="stat-grid">
      ${[["Total Geral",o.total_geral],["Processos",o.total_processos],["Procedimentos",o.total_procedimentos],["Punidos (PAD/PADS)",o.pad_pads_punidos],["Absolvidos/Arq.",o.pad_pads_absolvidos_arquivados],["Indícios Crime",o.ipm_sindicancia_indicios_crime],["Indícios Transgressão",o.ipm_sindicancia_indicios_transgressao]].map(([v,_])=>`
        <div class="stat-card">
          <span class="stat-value">${s(String(_??0))}</span>
          <span class="stat-label">${v}</span>
        </div>
      `).join("")}
    </div>
  `:`<p class="error">${r.error??"Erro ao carregar"}</p>`,i=v=>!Array.isArray(v)||v.length===0?'<p class="empty">Sem dados.</p>':`
      <div class="table-wrap">
        <table>
          <thead><tr><th>Tipo</th><th>Total</th><th>Concluídos</th><th>Em Andamento</th></tr></thead>
          <tbody>
            ${v.map(_=>{const f=_;return`<tr>
                <td>${s(String(f.tipo_detalhe??f.categoria??"—"))}</td>
                <td>${s(String(f.total??0))}</td>
                <td>${s(String(f.concluidos??0))}</td>
                <td>${s(String(f.em_andamento??0))}</td>
              </tr>`}).join("")}
          </tbody>
        </table>
      </div>`;C(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Estatísticas Anuais</h1></div>
        <div class="page-head-right">
          <form id="year-form" class="search-bar">
            <select name="ano">${n}</select>
            <button type="submit">Ver</button>
          </form>
          ${B({printable:!0})}
        </div>
      </div>
      ${a}
      ${o?`
        <h2 style="margin-top:24px">Processos por Tipo</h2>
        ${i(o.processos_por_tipo)}
        <h2 style="margin-top:24px">Procedimentos por Tipo</h2>
        ${i(o.procedimentos_por_tipo)}
      `:""}
    </section>
  `),(p=document.querySelector("#year-form"))==null||p.addEventListener("submit",v=>{v.preventDefault();const _=new FormData(v.currentTarget);x=Number(_.get("ano"))||x,ve()}),U({})}async function ie(){var i,p,v,_,f;C('<section class="panel"><p>Carregando...</p></section>');const e=await m("users_list",{search:z||null,per_page:100}),t=((i=e.data)==null?void 0:i.items)??[],r=((p=e.data)==null?void 0:p.total)??0;K=t;const o={posto_graduacao:"POSTO/GRADUACAO",tipo_usuario:"TIPO",is_encarregado:"ENCARREGADO",is_operador:"OPERADOR"},n=t.map(u=>{const g=u,h={};for(const[y,P]of Object.entries(g))y!=="id"&&(h[o[y]??y]=P);return h}),a=Y.find(u=>u.path==="/usuarios/lista");C(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Usuários <span class="badge">${r}</span></h1></div>
        <div class="page-head-right">
          ${I()?'<button id="new-record">Novo</button>':""}
          ${B({...a,csvExport:void 0})}
        </div>
      </div>
      <form id="search-form" class="search-bar">
        <input name="q" type="search" placeholder="Buscar por nome ou matrícula..." value="${s(z)}" />
        <button type="submit">Buscar</button>
        ${z?'<button type="button" class="secondary small" id="clear-search">Limpar</button>':""}
      </form>
      ${e.ok?M(n,a):`<p class="error">${e.error}</p>`}
    </section>
  `),(v=document.querySelector("#search-form"))==null||v.addEventListener("submit",u=>{u.preventDefault(),z=(new FormData(u.currentTarget).get("q")??"").trim(),ie()}),(_=document.querySelector("#clear-search"))==null||_.addEventListener("click",()=>{z="",ie()}),(f=document.querySelector("#new-record"))==null||f.addEventListener("click",()=>{J(a)}),a.detailCommand&&document.querySelectorAll("tbody tr[data-row-index]").forEach(u=>{u.style.cursor="pointer",u.addEventListener("click",g=>{var P;if(g.target.closest("button"))return;const h=Number(u.dataset.rowIndex),y=String(((P=K[h])==null?void 0:P.id)??"");y&&(S=y,be(a))})}),document.querySelectorAll("[data-edit-index]").forEach(u=>{u.addEventListener("click",()=>{J(a,K[Number(u.dataset.editIndex)]??null)})}),document.querySelectorAll("[data-delete-index]").forEach(u=>{u.addEventListener("click",async()=>{const g=K[Number(u.dataset.deleteIndex)];if(!confirm("Confirmar exclusão?"))return;const h=await m("users_delete",{id:g==null?void 0:g.id});if(!h.ok){alert(h.error??"Erro");return}ie()})}),U({...a,csvExport:void 0})}async function be(e){var y,P,q;if(!S)return;C('<section class="panel"><p>Carregando perfil...</p></section>');const[t,r,o,n,a]=await Promise.all([m("users_get",{id:S}),m("users_statistics",{id:S}),m("users_proceedings_responsible",{id:S}),m("users_proceedings_escrivao",{id:S}),m("users_proceedings_involved",{id:S})]),i=t.data??{},p=r.data??{},v=o.data??[],_=n.data??[],f=a.data??[],u=i.ativo===!1,g=(k,$)=>`
    <div class="stat-card">
      <span class="stat-value">${s(String($??0))}</span>
      <span class="stat-label">${k}</span>
    </div>`,h=k=>k.length===0?'<p class="empty">Nenhum.</p>':`<div class="table-wrap"><table>
        <thead><tr><th>Número</th><th>Tipo</th><th>Status</th><th>Instauração</th></tr></thead>
        <tbody>${k.map($=>`
          <tr>
            <td>${s(String($.numero??""))}</td>
            <td>${s(String($.tipo_detalhe??$.tipo_geral??""))}</td>
            <td>${$.concluido?'<span class="badge badge--ok">Concluído</span>':'<span class="badge badge--warn">Andamento</span>'}</td>
            <td>${s(String($.data_instauracao??""))}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>`;C(`
    <section class="panel">
      <div class="page-head">
        <div>
          <h1>${s(String(i.posto_graduacao??""))} ${s(String(i.nome??"Usuário"))}
            ${u?'<span class="badge">Inativo</span>':'<span class="badge badge--ok">Ativo</span>'}
          </h1>
          <p>${s(String(i.matricula??""))} · ${s(String(i.tipo_usuario??""))} · ${s(String(i.perfil??""))}</p>
        </div>
        <div class="page-head-right">
          ${I()?`
            <button id="edit-user">Editar</button>
            ${u?'<button id="reactivate-user">Reativar</button>':""}
          `:""}
          <button class="secondary" id="back-to-list">← Voltar</button>
          ${B({...e,csvExport:void 0})}
        </div>
      </div>

      <div class="stat-grid" style="margin-bottom:24px">
        ${g("Sindicâncias (enc.)",p.encarregado_sindicancia)}
        ${g("PADS (enc.)",p.encarregado_pads)}
        ${g("IPM (enc.)",p.encarregado_ipm)}
        ${g("PAD (enc.)",p.encarregado_pad)}
        ${g("PADE (enc.)",p.encarregado_pade)}
        ${g("Feito Prel. (enc.)",p.encarregado_feito_preliminar)}
        ${g("CP (enc.)",p.encarregado_cp)}
        ${g("CD (enc.)",p.encarregado_cd)}
        ${g("CJ (enc.)",p.encarregado_cj)}
        ${g("Escrivão",p.escrivao)}
        ${g("Sindicado",p.envolvido_sindicado)}
        ${g("Acusado",p.envolvido_acusado)}
        ${g("Indiciado",p.envolvido_indiciado)}
        ${g("Investigado",p.envolvido_investigado)}
      </div>

      <div class="detail-section">
        <h2>Como Encarregado (${v.length})</h2>
        ${h(v)}
      </div>
      <div class="detail-section">
        <h2>Como Escrivão (${_.length})</h2>
        ${h(_)}
      </div>
      <div class="detail-section">
        <h2>Como Envolvido (${f.length})</h2>
        ${h(f)}
      </div>
    </section>
  `),(y=document.querySelector("#back-to-list"))==null||y.addEventListener("click",()=>{S=null,ie()}),(P=document.querySelector("#edit-user"))==null||P.addEventListener("click",()=>{const k=Y.find($=>$.path==="/usuarios/lista");J(k,i)}),(q=document.querySelector("#reactivate-user"))==null||q.addEventListener("click",async()=>{if(!confirm("Reativar este usuário?"))return;const k=await m("users_reactivate",{id:S});if(!k.ok){alert(k.error??"Erro");return}be(e)}),U({...e,csvExport:void 0})}async function he(){var k;C('<section class="panel"><p>Carregando estatísticas...</p></section>');const e={path:"/stats/procedimentos",printable:!0},t={ano:x},[r,o,n,a,i,p,v,_,f]=await Promise.all([m("proceedings_in_progress_stats"),m("proceedings_pads_solutions",t),m("proceedings_ipm_evidence",t),m("proceedings_sr_evidence",t),m("proceedings_top10_transgressions",t),m("proceedings_driver_ranking",t),m("proceedings_nature_stats",t),m("proceedings_common_crimes",t),m("proceedings_military_crimes",t)]),u=r.data??{},g=n.data??{},h=a.data??{},q=((await m("reports_available_years")).data??[x]).map($=>`<option value="${$}" ${$===x?"selected":""}>${$}</option>`).join("");C(`
    <section class="panel">
      <div class="page-head">
        <div><h1>Estatísticas de Procedimentos</h1></div>
        <div class="page-head-right">
          <form id="year-form" class="search-bar">
            <select name="ano">${q}</select>
            <button type="submit">Ver</button>
          </form>
          ${B(e)}
        </div>
      </div>

      <div class="detail-section">
        <h2>Em Andamento</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${s(String(u.total??0))}</span><span class="stat-label">Total</span></div>
          <div class="stat-card badge--ok"><span class="stat-value">${s(String(u.concluidos??0))}</span><span class="stat-label">Concluídos</span></div>
          ${Array.isArray(u.por_tipo)?u.por_tipo.map($=>`<div class="stat-card"><span class="stat-value">${s(String($.quantidade??0))}</span><span class="stat-label">${s(String($.tipo??""))}</span></div>`).join(""):""}
        </div>
      </div>

      <div class="detail-section">
        <h2>Indícios IPM/Sindicância — ${x}</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${s(String(g.com_indicios??0))}</span><span class="stat-label">Com Indícios</span></div>
          <div class="stat-card"><span class="stat-value">${s(String(g.sem_indicios??0))}</span><span class="stat-label">Sem Indícios</span></div>
          <div class="stat-card"><span class="stat-value">${s(String(g.com_indicios_crime??0))}</span><span class="stat-label">Crimes</span></div>
          <div class="stat-card"><span class="stat-value">${s(String(g.com_indicios_transgressao??0))}</span><span class="stat-label">Transgressões</span></div>
        </div>
      </div>

      <div class="detail-section">
        <h2>Indícios SR — ${x}</h2>
        <div class="stat-grid">
          <div class="stat-card"><span class="stat-value">${s(String(h.crimes_comuns??0))}</span><span class="stat-label">Crimes Comuns</span></div>
          <div class="stat-card"><span class="stat-value">${s(String(h.transgressoes??0))}</span><span class="stat-label">Transgressões</span></div>
          <div class="stat-card"><span class="stat-value">${s(String(h.sem_indicios??0))}</span><span class="stat-label">Sem Indícios</span></div>
        </div>
      </div>

      <div class="detail-section">
        <h2>Top 10 Transgressões — ${x}</h2>
        ${M(i.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Soluções PADS/PAD — ${x}</h2>
        ${M(o.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Crimes Comuns — ${x}</h2>
        ${M(_.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Crimes Militares (IPM) — ${x}</h2>
        ${M(f.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Naturezas Apuradas — ${x}</h2>
        ${M(v.data??[],e)}
      </div>

      <div class="detail-section">
        <h2>Ranking de Motoristas (Sinistros) — ${x}</h2>
        ${M(p.data??[],e)}
      </div>
    </section>
  `),(k=document.querySelector("#year-form"))==null||k.addEventListener("submit",$=>{$.preventDefault(),x=Number(new FormData($.currentTarget).get("ano"))||x,he()}),U(e)}function Te(e,t){const r=Uint8Array.from(atob(t),i=>i.charCodeAt(0)),o=new Blob([r],{type:"text/csv;charset=utf-8;"}),n=URL.createObjectURL(o),a=document.createElement("a");a.href=n,a.download=e,a.click(),URL.revokeObjectURL(n)}function B(e){const t=[];return e.printable&&t.push('<button class="outline small" id="btn-print">Imprimir / PDF</button>'),e.csvExport&&t.push('<button class="outline small" id="btn-csv">Exportar CSV</button>'),t.length?`<div class="export-bar">${t.join("")}</div>`:""}function Ie(e){if(!e.searchable)return"";const t=z?'<button type="button" class="secondary small" id="clear-search">Limpar</button>':"";return`
    <form id="search-form" class="search-bar">
      <input name="q" type="search" placeholder="Buscar por número ou fatos..."
             value="${s(z)}" />
      <button type="submit">Buscar</button>
      ${t}
    </form>
  `}function U(e){var t,r,o,n;(t=document.querySelector("#btn-print"))==null||t.addEventListener("click",()=>{window.print()}),(r=document.querySelector("#btn-csv"))==null||r.addEventListener("click",async()=>{if(!e.csvExport)return;const a=document.querySelector("#btn-csv");a.disabled=!0,a.textContent="Gerando…";const i=await m("reports_export_csv",{request:{tipo_relatorio:e.csvExport.tipoRelatorio,ano:null}});if(a.disabled=!1,a.textContent="Exportar CSV",!i.ok||!i.data){alert(i.error??"Falha ao exportar.");return}Te(i.data.filename,i.data.csv_base64)}),(o=document.querySelector("#search-form"))==null||o.addEventListener("submit",a=>{a.preventDefault(),z=(new FormData(a.currentTarget).get("q")??"").trim(),O()}),(n=document.querySelector("#clear-search"))==null||n.addEventListener("click",()=>{z="",O()})}Se().then(()=>{R?O():pe()});
