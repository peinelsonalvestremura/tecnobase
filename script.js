(() => {
  const db = window.supabaseClient;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const state = { user: null, profile: null, role: "visualizacao", page: "dashboard", rows: {}, userDirectory: [], filters: { q: "", status: "" }, busy: false, realtimeChannel: null, realtimeRefreshTimer: null };
  const roleLabels = { administrador: "Administrador", usuario: "Usuário", visualizacao: "Visualização" };
  const pages = {
    dashboard: { title: "Dashboard", table: null }, equipamentos: { title: "Equipamentos", table: "equipamentos" }, salas: { title: "Salas", table: "salas" }, alunos: { title: "Alunos", table: "alunos" }, emprestimos: { title: "Empréstimos", table: "emprestimos" }, manutencoes: { title: "Manutenções", table: "manutencoes" }, relatorios: { title: "Relatórios", table: null }, usuarios: { title: "Usuários", table: "perfis" }, configuracoes: { title: "Configurações", table: null }
  };
  const configs = {
    equipamentos: { singular: "equipamento", icon: "▣", search: ["marca", "tipo", "modelo", "nome", "patrimonio", "numero_serie"], fields: [f("tipo", "Tipo", "select", true, ["Tablet", "Notebook", "Computador / PC"]), f("marca", "Marca", "equipment-brand", true), f("modelo", "Modelo", "equipment-model", true), f("numero_serie", "Número de série", "optional-code"), f("patrimonio", "Patrimônio", "optional-code"), f("sala_id", "Sala", "ref", true, "salas"), f("status", "Status", "select", true, ["Disponível", "Emprestado", "Em manutenção", "Danificado"]), f("descricao", "Observações", "textarea")] },
    salas: { singular: "sala", icon: "⌗", search: ["nome", "tipo", "responsavel"], fields: [f("nome", "Nome da sala", "text", true), f("tipo", "Tipo de sala", "select", true, ["Sala de aula", "Laboratório", "Biblioteca", "Secretaria", "Outro"]), f("responsavel", "Responsável", "text"), f("descricao", "Descrição", "textarea")] },
    alunos: { singular: "aluno", icon: "♙", search: ["nome", "turma", "matricula"], fields: [f("nome", "Nome completo", "text", true), f("turma", "Turma", "text", true), f("matricula", "Matrícula", "text", true)] },
    emprestimos: { singular: "empréstimo", icon: "⇄", search: ["responsavel", "status", "observacao"], fields: [f("equipamento_id", "Equipamento", "ref", true, "equipamentos"), f("aluno_id", "Aluno", "ref", true, "alunos"), f("sala_id", "Sala", "ref", true, "salas"), f("responsavel", "Responsável pela entrega", "text", true), f("data_emprestimo", "Data do empréstimo", "date", true), f("data_prevista", "Devolução prevista", "date", true), f("status", "Status", "select", true, ["Ativo", "Devolvido", "Atrasado"]), f("observacao", "Observações", "textarea")] },
    manutencoes: { singular: "manutenção", icon: "⌁", search: ["tipo", "problema", "descricao", "responsavel", "status"], fields: [f("equipamento_id", "Equipamento", "ref", true, "equipamentos"), f("tipo", "Tipo de manutenção", "select", true, ["Corretiva", "Preventiva"]), f("problema", "Problema identificado", "text", true), f("prioridade", "Prioridade", "select", true, ["Baixa", "Média", "Alta", "Urgente"]), f("status", "Status", "select", true, ["Aberta", "Em andamento", "Concluída"]), f("data", "Data", "date", true), f("responsavel", "Responsável", "text"), f("descricao", "Descrição", "textarea")] },
    perfis: { singular: "perfil", icon: "♧", search: ["nome", "email", "perfil"], fields: [f("id", "ID do usuário no Supabase Auth", "text", true), f("nome", "Nome completo", "text", true), f("email", "E-mail", "email", true), f("perfil", "Perfil de acesso", "select", true, ["administrador", "usuario", "visualizacao"]), f("ativo", "Acesso ativo", "select", true, ["true", "false"])] },
  };
  function f(name, label, type = "text", required = false, options = []) { return { name, label, type, required, options }; }
  const equipmentCatalog = {
    "Tablet": { "Positivo": ["T2040B", "T2072D"] },
    "Notebook": { "Positivo": ["Master N1110", "Master N1210"], "Multilaser": ["M11W Pro CL"], "Ultra": ["UL 150"] },
    "Computador / PC": { "ASRock": ["H310CM-HG4"], "Positivo": ["POS-PIQ77CL", "MASTER DE70A"] }
  };
  function equipmentImagePath(type) {
    if (type === "Tablet") return "assets/equipment-tablet.png";
    if (type === "Notebook") return "assets/equipment-notebook.png";
    return "assets/equipment-pc.png";
  }
  function refreshEquipmentPreview() {
    const type = $("#dialog-fields [name='tipo']")?.value || "Tablet";
    const brand = $("#dialog-fields [name='marca']")?.value || "";
    const model = $("#dialog-fields [name='modelo']")?.value || "";
    const photo = $("#equipment-preview-photo");
    if (photo) { photo.src = equipmentImagePath(type); photo.alt = `Imagem ilustrativa de ${type.toLowerCase()}`; }
    const title = [type, [brand, model].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
    const heading = $("#equipment-preview-title"); if (heading) heading.textContent = title;
    const chip = $("#equipment-preview-type"); if (chip) chip.textContent = type;
  }
  function refreshEquipmentOptions(resetModel = false, resetBrand = false) {
    const fields = $("#dialog-fields"), type = fields?.querySelector("[name='tipo']")?.value;
    const brand = fields?.querySelector("[name='marca']"), model = fields?.querySelector("[name='modelo']");
    if (!brand || !model) return;
    const brands = Object.keys(equipmentCatalog[type] || {}), previousBrand = brand.value;
    brand.innerHTML = `<option value="">Selecione</option>${brands.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("")}`;
    brand.value = !resetBrand && brands.includes(previousBrand) ? previousBrand : (brands[0] || "");
    const models = equipmentCatalog[type]?.[brand.value] || [], previousModel = model.value;
    model.innerHTML = `<option value="">Selecione</option>${models.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("")}`;
    model.value = !resetModel && models.includes(previousModel) ? previousModel : (resetModel ? "" : (models[0] || ""));
  }
  const fmt = (value, time = false) => { if (!value) return "—"; const d = new Date(value); return Number.isNaN(+d) ? value : new Intl.DateTimeFormat("pt-BR", time ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(d); };
  const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function toast(message, kind = "") { const el = document.createElement("div"); el.className = `toast ${kind}`; el.textContent = message; $("#toast-region").append(el); setTimeout(() => el.remove(), 4100); }
  function prettyError(error) { const msg = error?.message || "Não foi possível concluir esta ação."; if (/row-level security|permission denied|not authorized/i.test(msg)) return "Seu perfil não tem permissão para esta ação."; if (/relation .* does not exist|could not find the table/i.test(msg)) return "As tabelas ainda não foram criadas. Execute o arquivo schema.sql no Supabase."; if (/invalid api key|jwt/i.test(msg)) return "A configuração pública do Supabase precisa ser conferida."; return msg; }
  function canWrite() { return state.role === "administrador" || state.role === "usuario"; }
  function isAdmin() { return state.role === "administrador"; }
  function statusClass(status) { const s = String(status || "").toLowerCase(); if (/disponível|devolvido|concluída|concluido|ativo/.test(s) && !/inativo/.test(s)) return "green"; if (/manutenção|andamento/.test(s)) return "orange"; if (/defeito|danificado|atrasado|aberta|urgente/.test(s)) return "red"; if (/emprestado/.test(s)) return "blue"; if (/visualização/.test(s)) return "purple"; return ""; }
  function badge(value) { return `<span class="badge ${statusClass(value)}">${escapeHtml(value || "—")}</span>`; }
  function titleCase(str) { return str.replaceAll("_", " ").replace(/^./, c => c.toUpperCase()); }
  function mappedName(table, id) { const row = state.rows[table]?.find(item => item.id === id); return row?.nome || row?.patrimonio || "—"; }
  function mappedEquipmentLabel(id) {
    const row = state.rows.equipamentos?.find(item => item.id === id);
    if (!row) return "—";
    return [row.tipo, [row.marca, row.modelo].filter(Boolean).join(" ")].filter(Boolean).join(" · ") || row.nome || "—";
  }
  function mappedUser(id) { const row = state.userDirectory.find(item => item.id === id) || (state.rows.perfis || []).find(item => item.id === id); return row?.nome || row?.email || "Usuário"; }
  function latestUpdate() {
    const records = ["equipamentos", "salas", "alunos", "emprestimos", "manutencoes"].flatMap(table => (state.rows[table] || []).map(row => ({ date: row.updated_at || row.atualizado_em || row.created_at || row.criado_em, userId: row.updated_by || row.atualizado_por || row.created_by || row.criado_por, table })));
    return records.filter(item => item.date && item.userId).sort((a,b) => new Date(b.date) - new Date(a.date))[0] || null;
  }
  function updateStamp(table, record, isNew) {
    const columns = Object.keys(record || {}), payload = {}, now = new Date().toISOString();
    const existing = candidates => candidates.filter(key => columns.includes(key));
    const updatedDates = existing(["updated_at", "atualizado_em"]), updatedUsers = existing(["updated_by", "atualizado_por"]);
    for (const key of (updatedDates.length ? updatedDates : ["updated_at"])) payload[key] = now;
    for (const key of (updatedUsers.length ? updatedUsers : ["updated_by"])) payload[key] = state.user.id;
    if (isNew) {
      const createdDates = existing(["created_at", "criado_em"]), createdUsers = existing(["created_by", "criado_por"]);
      for (const key of (createdDates.length ? createdDates : ["created_at"])) payload[key] = now;
      for (const key of (createdUsers.length ? createdUsers : ["created_by"])) payload[key] = state.user.id;
    }
    return payload;
  }
  function renderUpdateIndicator() {
    const latest = latestUpdate(), el = $("#last-update"); if (!el) return;
    el.innerHTML = latest ? `Última atualização · <b>${escapeHtml(mappedUser(latest.userId))}</b><small>${fmt(latest.date, true)}</small>` : "Última atualização · —";
    el.title = latest ? `${mappedUser(latest.userId)} atualizou ${titleCase(latest.table)} em ${fmt(latest.date, true)}` : "Ainda não há registros atualizados.";
  }
  async function loadData({ silent = false } = {}) {
    if (!db || !state.user) return;
    const names = ["equipamentos", "salas", "alunos", "emprestimos", "manutencoes", "perfis"];
    const [results, directoryResult, roleResult] = await Promise.all([
      // Older tables created manually in Supabase may not have created_at yet.
      // Avoid ordering on that optional field at query time; sort locally when present.
      Promise.all(names.map(name => db.from(name).select("*").limit(300))),
      db.rpc("tecnobase_user_directory"),
      db.rpc("tecnobase_role")
    ]);
    state.userDirectory = directoryResult.error ? [] : (directoryResult.data || []);
    for (let i = 0; i < names.length; i++) {
      const { data, error } = results[i];
      if (error) { state.rows[names[i]] = []; if (!/does not exist|schema cache/i.test(error.message)) console.warn(`Falha ao consultar ${names[i]}`, error.message); }
      else state.rows[names[i]] = (data || []).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    }
    const profile = state.rows.perfis.find(p => p.id === state.user.id);
    state.profile = profile || null;
    // The profile row reflects this user's saved role. The RPC remains the
    // fallback for installations where profile reads are restricted.
    state.role = profile?.perfil || (typeof roleResult.data === "string" ? roleResult.data : null) || "visualizacao";
    const readErrors = results.map((result, index) => result.error ? `${names[index]}: ${result.error.message}` : null).filter(Boolean);
    if (readErrors.length) {
      console.warn("Falha ao carregar dados do TECNOBASE", readErrors);
      const firstError = readErrors[0];
      if (!silent) toast(`Não consegui carregar ${readErrors.map(item => item.split(":")[0]).join(", ")}. Supabase: ${firstError.slice(firstError.indexOf(":") + 1).trim()}`, "error");
    }
    if (roleResult.error && !profile) {
      console.warn("Falha ao consultar o perfil de acesso", roleResult.error.message);
      if (!silent) toast(`Não consegui confirmar seu perfil no Supabase: ${roleResult.error.message}`, "error");
    }
    if (!profile && !roleResult.error && !roleResult.data) {
      if (!silent) toast("O usuário conectado não tem um perfil ativo vinculado no Supabase. Confirme que o e-mail da conta corresponde ao perfil Thales Menezes.", "error");
    }
    const name = profile?.nome || state.user.email?.split("@")[0] || "Usuário";
    $("#user-name").textContent = name; $("#user-role").textContent = roleLabels[state.role] || "Visualização";
    $("#user-avatar").textContent = name.trim().charAt(0).toUpperCase(); $("#top-avatar").textContent = name.trim().charAt(0).toUpperCase();
    renderUpdateIndicator();
    renderPage();
  }
  function startRealtime() {
    if (!db || !state.user || state.realtimeChannel) return;
    const tables = ["equipamentos", "salas", "alunos", "emprestimos", "manutencoes"];
    let channel = db.channel(`tecnobase-live-${state.user.id}`);
    for (const table of tables) channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
      clearTimeout(state.realtimeRefreshTimer);
      state.realtimeRefreshTimer = setTimeout(() => { loadData({ silent: true }); }, 250);
    });
    state.realtimeChannel = channel.subscribe(status => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") toast("A atualização automática precisa ser ativada no Supabase. Execute o arquivo ativar-atualizacao-em-tempo-real.sql.", "error");
    });
  }
  function stopRealtime() {
    clearTimeout(state.realtimeRefreshTimer);
    state.realtimeRefreshTimer = null;
    if (state.realtimeChannel) db.removeChannel(state.realtimeChannel);
    state.realtimeChannel = null;
  }
  function pageHeading(title, subtitle, actions = "") { return `<div class="page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="heading-actions">${actions}</div></div>`; }
  function metric(label, value, icon, color, note = "") { const tones={"#3187e8":"#6384a0","#14b878":"#62917c","#12b6d8":"#6a9aa1","#efa817":"#b18b55","#e45656":"#aa7070","#635be4":"#7d79a0"}; color=tones[color]||color; return `<article class="metric-card" style="--tone:${color};--tint:${color}16"><div class="metric-top">${label}<span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></article>`; }
  function getStats() {
    const eq = state.rows.equipamentos || [], loans = state.rows.emprestimos || [], repairs = state.rows.manutencoes || [];
    return { eq: eq.length, avail: eq.filter(x => x.status === "Disponível").length, loaned: eq.filter(x => x.status === "Emprestado").length, maint: eq.filter(x => /manutenção/i.test(x.status)).length, damaged: eq.filter(x => /danificado/i.test(x.status)).length, students: (state.rows.alunos || []).length, rooms: (state.rows.salas || []).length, loansActive: loans.filter(x => ["Ativo", "Atrasado"].includes(x.status)).length, repairsOpen: repairs.filter(x => x.status !== "Concluída").length };
  }
  function renderDashboard() {
    const s = getStats(), eq = state.rows.equipamentos || [];
    const tones={green:"#62917c",blue:"#6384a0",orange:"#b18b55",red:"#aa7070"};
    const total = s.eq || 1;
    const pct = n => `${(n / total * 100).toFixed(1)}%`;
    const recentLoans = (state.rows.emprestimos || []).slice(0, 5), recentRepairs = (state.rows.manutencoes || []).slice(0, 5);
    const catCounts = Object.entries(eq.reduce((a, item) => { const k = item.tipo || item.categoria || "Outros"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);
    const maxCat = Math.max(1,...catCounts.map(x=>x[1]));
    const loanRows = recentLoans.length ? recentLoans.map(x => `<tr><td><div class="item-primary"><span class="item-thumb">⇄</span><b>${escapeHtml(mappedEquipmentLabel(x.equipamento_id))}</b></div></td><td>${escapeHtml(mappedName("alunos", x.aluno_id))}</td><td>${fmt(x.data_emprestimo)}</td><td>${badge(x.status)}</td></tr>`).join("") : emptyRow("Nenhum empréstimo cadastrado.", 4);
    const repairRows = recentRepairs.length ? recentRepairs.map(x => `<tr><td><b>${escapeHtml(mappedName("equipamentos", x.equipamento_id))}</b></td><td>${escapeHtml(x.problema)}</td><td>${fmt(x.data)}</td><td>${badge(x.status)}</td></tr>`).join("") : emptyRow("Nenhuma manutenção cadastrada.", 4);
    const quickActions = canWrite() ? `<button class="button secondary" data-action="new" data-table="equipamentos">＋ Equipamento</button><button class="button secondary" data-action="new" data-table="salas">＋ Sala</button><button class="button primary" data-action="new" data-table="emprestimos">＋ Empréstimo</button>` : `<button class="button secondary" data-action="export" data-table="equipamentos">↓ Exportar dados</button>`;
    return `${pageHeading("Visão geral", "Acompanhe os principais indicadores da tecnologia escolar.", quickActions)}<div class="metric-grid">${metric("Total de equipamentos",s.eq,"▣", "#3187e8","Itens cadastrados no sistema")}${metric("Disponíveis",s.avail,"✓","#14b878","Prontos para uso")}${metric("Emprestados",s.loaned,"⇄","#12b6d8","Em uso por alunos ou equipe")}${metric("Em manutenção",s.maint,"⌁","#efa817","Aguardando reparo")}${metric("Danificados",s.damaged,"!","#e45656","Precisam de atenção")}${metric("Total de alunos",s.students,"♙","#635be4","Alunos cadastrados")}${metric("Total de salas",s.rooms,"⌗","#3187e8","Espaços cadastrados")}${metric("Empréstimos ativos",s.loansActive,"↗","#12b6d8","Inclui itens atrasados")}${metric("Manutenções abertas",s.repairsOpen,"⚙","#efa817","Em andamento ou aguardando")}</div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Equipamentos por status</h2><div class="panel-subtitle">Distribuição atual do inventário</div></div><button class="link-button" data-page-link="equipamentos">Ver equipamentos →</button></div><div class="status-chart"><div class="donut" style="background:conic-gradient(${tones.green} 0 ${Number(pct(s.avail))}%,${tones.blue} ${Number(pct(s.avail))}% ${Number(pct(s.avail+s.loaned))}%,${tones.orange} ${Number(pct(s.avail+s.loaned))}% ${Number(pct(s.avail+s.loaned+s.maint))}%,${tones.red} ${Number(pct(s.avail+s.loaned+s.maint))}% 100%)"><div class="donut-center">${s.eq}<small>equipamentos</small></div></div><div class="legend">${[["Disponíveis",s.avail,tones.green],["Emprestados",s.loaned,tones.blue],["Manutenção",s.maint,tones.orange],["Danificados",s.damaged,tones.red]].map(([n,v,c])=>`<div class="legend-row"><span class="legend-name"><i class="legend-dot" style="--tone:${c}"></i>${n}</span><b>${v}</b></div>`).join("")}</div></div></section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Tipos de equipamentos</h2><div class="panel-subtitle">Quantidade por tipo de equipamento</div></div></div><div class="bars-chart">${catCounts.length ? catCounts.map(([n,v])=>`<div class="bar-group"><div class="bar-outer"><div class="bar-fill" style="--height:${Math.max(5,v/maxCat*100)}%"></div></div><small>${escapeHtml(n.slice(0,10))}</small></div>`).join("") : `<div class="empty-state">Cadastre equipamentos para ver o gráfico.</div>`}</div></section></div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Empréstimos recentes</h2><div class="panel-subtitle">Últimas movimentações de equipamentos</div></div><button class="link-button" data-page-link="emprestimos">Ver todos →</button></div><div class="table-wrap"><table><thead><tr><th>EQUIPAMENTO</th><th>ALUNO</th><th>DATA</th><th>STATUS</th></tr></thead><tbody>${loanRows}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Manutenções recentes</h2><div class="panel-subtitle">Acompanhamento de reparos</div></div><button class="link-button" data-page-link="manutencoes">Ver todas →</button></div><div class="table-wrap"><table><thead><tr><th>EQUIPAMENTO</th><th>PROBLEMA</th><th>DATA</th><th>STATUS</th></tr></thead><tbody>${repairRows}</tbody></table></div></section></div>`;
  }
  function emptyRow(message, cols) { return `<tr><td colspan="${cols}"><div class="empty-state">${escapeHtml(message)}</div></td></tr>`; }
  function columnsFor(table) {
    if (table === "equipamentos") return [["tipo","Tipo"],["marca","Marca"],["modelo","Modelo"],["patrimonio","Patrimônio"],["numero_serie","Nº de série"],["sala_id","Sala"],["status","Status"]];
    if (table === "salas") return [["nome","Sala"],["tipo","Tipo"],["responsavel","Responsável"],["descricao","Descrição"]];
    if (table === "alunos") return [["nome","Aluno"],["turma","Turma"],["matricula","Matrícula"]];
    if (table === "emprestimos") return [["equipamento_id","Equipamento"],["aluno_id","Aluno"],["responsavel","Responsável"],["data_emprestimo","Retirada"],["data_prevista","Devolução prevista"],["status","Status"]];
    if (table === "manutencoes") return [["equipamento_id","Equipamento"],["tipo","Tipo"],["problema","Problema"],["prioridade","Prioridade"],["data","Data"],["status","Status"]];
    if (table === "perfis") return [["nome","Usuário"],["email","E-mail"],["perfil","Perfil"],["ativo","Acesso"]];
    return [["acao","Ação"],["entidade","Área"],["descricao","Descrição"],["user_id","Usuário"],["created_at","Data e hora"]];
  }
  function cellValue(table, row, key) {
    let v = row[key];
    if (key === "sala_id") v = mappedName("salas", v);
    if (key === "equipamento_id") v = table === "emprestimos" ? mappedEquipmentLabel(v) : mappedName("equipamentos", v);
    if (key === "aluno_id") v = mappedName("alunos", v);
    if (["data_emprestimo","data_prevista","data_devolucao","data","created_at"].includes(key)) v = fmt(v, key === "created_at");
    if (key === "perfil") v = roleLabels[v] || v;
    if (key === "user_id") v = mappedUser(v);
    if (key === "ativo") v = v === true || v === "true" ? "Ativo" : "Inativo";
    if (key === "descricao" && v?.length > 55) v = `${v.slice(0,52)}…`;
    return v ?? "—";
  }
  function renderTable(table) {
    const config = configs[table], page = pages[state.page], rows = (state.rows[table] || []).filter(row => {
      const query = state.filters.q.toLowerCase();
      const matchQuery = !query || (config.search || []).some(k => String(row[k] || "").toLowerCase().includes(query));
      const matchStatus = !state.filters.status || String(row.status || row.perfil || "").toLowerCase() === state.filters.status.toLowerCase();
      return matchQuery && matchStatus;
    });
    const canCreate = canWrite() && (table !== "perfis" || isAdmin());
    const add = canCreate ? `<button class="button primary" data-action="new" data-table="${table}">＋ Novo ${config.singular}</button>` : "";
    const titleSub = { equipamentos:"Inventário e situação dos equipamentos escolares.", salas:"Gerencie os espaços e seus responsáveis.", alunos:"Cadastro de alunos para controle de empréstimos.", emprestimos:"Registre retiradas e acompanhe as devoluções.", manutencoes:"Acompanhe problemas, prioridades e reparos.", perfis:"Perfis e permissões atribuídos a usuários autenticados." }[table];
    const queryFilter = table === "equipamentos" ? `<select id="status-filter" class="filter-select"><option value="">Todos os status</option>${["Disponível","Emprestado","Em manutenção","Danificado"].map(x=>`<option ${state.filters.status===x?"selected":""}>${x}</option>`).join("")}</select>` : table === "emprestimos" ? `<select id="status-filter" class="filter-select"><option value="">Todos os status</option>${["Ativo","Atrasado","Devolvido"].map(x=>`<option ${state.filters.status===x?"selected":""}>${x}</option>`).join("")}</select>` : table === "manutencoes" ? `<select id="status-filter" class="filter-select"><option value="">Todos os status</option>${["Aberta","Em andamento","Concluída"].map(x=>`<option ${state.filters.status===x?"selected":""}>${x}</option>`).join("")}</select>` : "";
    const columns = columnsFor(table);
    let dataRows = rows.map(row => `<tr data-record-id="${escapeHtml(row.id)}">${columns.map(([key]) => `<td>${key === "status" || key === "perfil" ? badge(cellValue(table,row,key)) : table === "equipamentos" && key === "tipo" ? `<div class="equipment-type-cell"><img src="${equipmentImagePath(row.tipo)}" alt="" loading="lazy"><span>${escapeHtml(cellValue(table,row,key))}</span></div>` : `<span>${escapeHtml(cellValue(table,row,key))}</span>`}</td>`).join("")}<td><div class="row-actions"><button class="row-action" title="Ver detalhes" aria-label="Ver detalhes" data-action="detail" data-table="${table}" data-id="${escapeHtml(row.id)}">◉</button>${canWrite() ? `<button class="row-action row-action-edit" title="Editar registro" data-action="edit" data-table="${table}" data-id="${escapeHtml(row.id)}">Editar</button>` : ""}${isAdmin() && !["perfis"].includes(table) ? `<button class="row-action row-action-delete" title="Excluir registro" aria-label="Excluir registro" data-action="delete" data-table="${table}" data-id="${escapeHtml(row.id)}">🗑</button>` : ""}</div></td></tr>`).join("");
    if (!dataRows) dataRows = emptyRow(`Nenhum ${config.singular} encontrado.`, columns.length+1);
    const th = columns.map(([,label])=>`<th>${label.toUpperCase()}</th>`).join("");
    return `${pageHeading(page.title,titleSub,add)}<div class="toolbar"><label class="search-box"><span>⌕</span><input id="table-search" type="search" value="${escapeHtml(state.filters.q)}" placeholder="Buscar ${config.singular}..."></label>${queryFilter}<span class="muted" style="font-size:10px;margin-left:auto">${rows.length} registro${rows.length===1?"":"s"}</span></div><section class="panel data-panel"><div class="table-wrap"><table><thead><tr>${th}<th>AÇÕES</th></tr></thead><tbody>${dataRows}</tbody></table></div></section>${table === "perfis" ? `<section class="panel" style="margin-top:14px"><div class="panel-head"><div><h2 class="panel-title">Gerenciamento de usuários</h2><div class="panel-subtitle">Contas são criadas no Supabase Auth; depois, atribua o perfil nesta lista.</div></div></div><p class="muted" style="font-size:11px;line-height:1.7">Por segurança, um aplicativo no navegador não pode criar contas administrativas nem alterar senhas de outros usuários. Crie o usuário em Supabase → Authentication → Users e cadastre ou ajuste seu perfil na tabela <b>perfis</b>. O SQL do projeto inclui políticas para esse gerenciamento.</p></section>` : ""}`;
  }
  function renderReports() { return `${pageHeading("Relatórios", "Exporte os dados do sistema para análise e prestação de contas.")}<div class="report-grid">${[["Inventário de equipamentos","Lista completa com tipo, marca, modelo, sala e patrimônio.","equipamentos","▣"],["Empréstimos","Empréstimos ativos, concluídos e respectivas datas.","emprestimos","⇄"],["Manutenções","Histórico de reparos e prioridades registradas.","manutencoes","⌁"],["Cadastro de alunos","Alunos e turmas cadastradas.","alunos","♙"],["Salas","Espaços e responsáveis.","salas","⌗"]].map(([t,d,table,ico])=>`<section class="panel report-card"><div class="report-symbol">${ico}</div><div><h3>${t}</h3><p>${d}</p><button class="button secondary small" data-action="export" data-table="${table}">↓ Baixar CSV</button></div></section>`).join("")}</div>`; }
  function renderSettings() { return `${pageHeading("Configurações", "Preferências e informações do ambiente TECNOBASE.")}<div class="settings-grid"><section class="panel settings-card"><h3>Conta conectada</h3><p>${escapeHtml(state.user?.email || "")}</p><p>Perfil atual: <b>${escapeHtml(roleLabels[state.role] || state.role)}</b></p><button class="button secondary small" id="settings-signout">Sair da conta</button></section><section class="panel settings-card"><h3>Conexão e segurança</h3><p>Autenticação persistente gerenciada pelo Supabase. Todas as tabelas são protegidas por Row Level Security (RLS).</p><p>O acesso aos dados depende do perfil registrado no banco.</p><span class="badge green">Conexão autenticada</span></section><section class="panel settings-card"><h3>Preferências de exibição</h3><p>Idioma: Português (Brasil)<br>Fuso horário: horário local do dispositivo<br>Interface responsiva para computador, tablet e celular.</p></section><section class="panel settings-card"><h3>Sobre o TECNOBASE</h3><p>Gestão de Tecnologia Escolar<br>Controle de equipamentos, salas, alunos, empréstimos e manutenções.</p><span class="badge blue">Versão 1.0</span></section></div>`; }
  function renderPage() {
    const page = pages[state.page]; if (!page) return;
    $("#breadcrumb-current").textContent = page.title;
    $$(".nav-item").forEach(el => el.classList.toggle("active",el.dataset.page===state.page));
    let html = state.page === "dashboard" ? renderDashboard() : page.table ? renderTable(page.table) : state.page === "relatorios" ? renderReports() : renderSettings();
    $("#page-content").innerHTML = html;
    if (state.page === "usuarios" && !isAdmin()) { $("#page-content").insertAdjacentHTML("afterbegin",`<div class="panel" style="margin-bottom:14px;font-size:11px;color:#8a5b16;background:#fff9eb">Apenas o perfil administrador pode consultar e gerenciar usuários.</div>`); }
  }
  function goPage(page) { state.page = page; state.filters = { q:"", status:"" }; renderPage(); $("#sidebar").classList.remove("open"); $("#sidebar-scrim").classList.remove("show"); }
  function formField(def, current = {}, ownerTable = "") {
    let value = current[def.name] ?? "";
    if (def.type === "date" && value) value = String(value).slice(0,10);
    const required = def.required ? "required" : "";
    const full = def.type === "textarea" || def.name === "observacao" ? "full-row" : "";
    if (ownerTable === "equipamentos" && (def.type === "equipment-brand" || def.type === "equipment-model")) {
      const options = def.type === "equipment-brand" ? Object.keys(equipmentCatalog[current.tipo] || {}) : (equipmentCatalog[current.tipo]?.[current.marca] || []);
      return `<div class="form-field"><label>${def.label}${def.required?" *":""}</label><select name="${def.name}" ${required}><option value="">${def.type === "equipment-brand" ? "Selecione o tipo primeiro" : "Selecione a marca primeiro"}</option>${options.map(v=>`<option value="${escapeHtml(v)}" ${value===v?"selected":""}>${escapeHtml(v)}</option>`).join("")}</select></div>`;
    }
    if (ownerTable === "equipamentos" && def.type === "optional-code") {
      const choice = value ? "informar" : "sem";
      const label = def.name === "numero_serie" ? "Número de série" : "Patrimônio";
      return `<div class="form-field"><label>${label}</label><select name="${def.name}_choice"><option value="sem" ${choice==="sem"?"selected":""}>Sem ${label.toLowerCase()}</option><option value="informar" ${choice==="informar"?"selected":""}>Informar ${label.toLowerCase()}</option></select><input type="text" name="${def.name}" value="${escapeHtml(value)}" placeholder="Digite ${label.toLowerCase()}" ${choice==="sem"?"disabled hidden":"required"}></div>`;
    }
    if (def.type === "select") {
      const opts = def.name === "ativo" ? def.options.map(v=>[v,v==="true"?"Sim":"Não"]) : def.options.map(v=>[v,v]);
      return `<div class="form-field ${full}"><label>${def.label}${def.required?" *":""}</label><select name="${def.name}" ${required}>${def.required?"":"<option value=\"\">Selecione</option>"}${opts.map(([v,label])=>`<option value="${escapeHtml(v)}" ${String(value)===String(v)?"selected":""}>${escapeHtml(label)}</option>`).join("")}</select></div>`;
    }
    if (def.type === "ref") {
      let rows = state.rows[def.options] || [];
      if (def.options === "equipamentos" && ownerTable === "emprestimos") rows = rows.filter(r => r.status === "Disponível" || r.id === current.equipamento_id);
      const display = r => `${def.options === "equipamentos" ? mappedEquipmentLabel(r.id) : (r.nome || r.patrimonio || r.id)}${r.status ? ` · ${r.status}` : ""}`;
      return `<div class="form-field"><label>${def.label}${def.required?" *":""}</label><select name="${def.name}" ${required}><option value="">${def.required?"Selecione":"Nenhum"}</option>${rows.map(r=>`<option value="${escapeHtml(r.id)}" ${String(value)===String(r.id)?"selected":""}>${escapeHtml(display(r))}</option>`).join("")}</select></div>`;
    }
    if (def.type === "textarea") return `<div class="form-field ${full}"><label>${def.label}${def.required?" *":""}</label><textarea name="${def.name}" placeholder="${def.label}">${escapeHtml(value)}</textarea></div>`;
    return `<div class="form-field"><label>${def.label}${def.required?" *":""}</label><input type="${def.type}" name="${def.name}" value="${escapeHtml(value)}" ${required} placeholder="${def.label}"></div>`;
  }
  function openRecord(table, id = null) {
    if (!canWrite()) return toast("Seu perfil permite apenas visualizar os dados.","error");
    const cfg = configs[table], existing = id ? state.rows[table].find(r=>r.id===id) : null;
    if (table === "perfis" && !isAdmin()) return toast("Apenas administradores podem alterar perfis.","error");
    $("#dialog-eyebrow").textContent = id ? "EDIÇÃO" : "NOVO CADASTRO";
    $("#dialog-title").textContent = `${id?"Editar":"Novo"} ${cfg.singular}`;
    const today = new Date(), dateString = date => new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,10), due = new Date(today); due.setDate(due.getDate()+7);
    const defaults = table === "equipamentos" ? { status:"Disponível", tipo:"Tablet", marca:"Positivo", modelo:"T2040B" } : table === "emprestimos" ? { data_emprestimo:dateString(today), data_prevista:dateString(due), status:"Ativo", responsavel:state.profile?.nome||"" } : table === "manutencoes" ? { data:dateString(today), status:"Aberta", prioridade:"Média", responsavel:state.profile?.nome||"" } : {};
    const values = existing || defaults;
    const form = $("#record-form"); form.dataset.table=table; form.dataset.id=id||"";
    $("#equipment-preview").hidden = table !== "equipamentos";
    $("#dialog-fields").innerHTML = cfg.fields.map(def=>formField(def,values,table)).join("");
    if(table === "emprestimos" && !existing){const eq=$("#dialog-fields [name='equipamento_id']");eq?.dispatchEvent(new Event("change"));}
    if(table === "equipamentos") { refreshEquipmentOptions(false); refreshEquipmentPreview(); }
    $("#record-dialog").showModal();
  }
  function openDetail(table,id) {
    const row = state.rows[table]?.find(x=>x.id===id); if (!row) return;
    const cfg = configs[table];
    const fields = cfg.fields.map(def=>[def.label,cellValue(table,row,def.name)]);
    $("#detail-content").innerHTML=`<div class="detail-head"><div><span class="eyebrow">FICHA ${cfg.singular.toUpperCase()}</span><h2>${escapeHtml(row.nome||row.problema||row.acao||"Registro")}</h2></div><button class="icon-button" data-close-detail>×</button></div><div class="detail-grid">${fields.map(([k,v])=>`<div class="detail-cell"><small>${escapeHtml(k)}</small><b>${escapeHtml(v||"—")}</b></div>`).join("")}</div>${table === "equipamentos" ? `<div class="detail-history"><h3>Documentos e anexos</h3><p class="muted" style="font-size:10px">Área para QR Code, fotos e anexos.</p></div>` : ""}`;
    $("#detail-dialog").showModal();
  }
  async function saveRecord(event) {
    event.preventDefault(); const form=event.currentTarget, table=form.dataset.table, id=form.dataset.id||null;
    if (!canWrite()) return toast("Acesso negado.","error");
    if (table==="perfis" && !isAdmin()) return toast("Somente administradores podem alterar perfis.","error");
    const data=Object.fromEntries(new FormData(form).entries());
    if (table === "equipamentos") {
      data.categoria = "Informática"; // campo técnico legado, preenchido automaticamente
      data.nome = [data.tipo, data.marca, data.modelo].filter(Boolean).join(" ");
      for (const field of ["patrimonio", "numero_serie"]) {
        const choice = data[`${field}_choice`];
        delete data[`${field}_choice`];
        data[field] = choice === "informar" ? (data[field]?.trim() || null) : null;
      }
    }
    if (table==="perfis") data.ativo=data.ativo==="true";
    if (table==="emprestimos" && data.status==="Devolvido") data.data_devolucao=new Date().toISOString().slice(0,10);
    if (table==="emprestimos" && data.status!=="Devolvido") data.data_devolucao=null;
    if (table==="equipamentos" && !data.sala_id) data.sala_id=null;
    if (table==="emprestimos" && !data.sala_id) data.sala_id=null;
    const existing = id ? (state.rows[table] || []).find(row => row.id === id) : null;
    Object.assign(data, updateStamp(table, existing, !id));
    const result=id ? await db.from(table).update(data).eq("id",id).select().single() : await db.from(table).insert(data).select().single();
    if (result.error) return toast(prettyError(result.error),"error");
    const label=data.nome||data.problema||configs[table].singular;
    $("#record-dialog").close(); toast(`${titleCase(configs[table].singular)} ${id?"atualizado":"cadastrado"} com sucesso.`,"success"); await loadData();
  }
  function confirmDelete(table,record) {
    const dialog = $("#delete-confirm-dialog");
    const label = record.nome || record.problema || record.patrimonio || configs[table].singular;
    $("#delete-confirm-title").textContent = "Tem certeza que deseja excluir?";
    $("#delete-confirm-message").textContent = `O registro “${label}” será removido. Essa ação não pode ser desfeita.`;
    return new Promise(resolve => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "delete"), { once: true });
      dialog.showModal();
    });
  }
  async function deleteRecord(table,id) {
    if (!isAdmin()) return toast("Apenas administradores podem excluir registros.","error");
    const record=state.rows[table].find(x=>x.id===id); if (!record) return;
    if (!await confirmDelete(table,record)) return;
    try {
      const {data,error}=await db.from(table).delete().eq("id",id).select("id");
      if(error) {
        if (/foreign key|violates.*constraint|still referenced/i.test(error.message)) return toast("Não foi possível excluir: este registro está vinculado a outros dados. Remova ou encerre os vínculos antes.","error");
        return toast(prettyError(error),"error");
      }
      if(!data?.length) return toast("O Supabase bloqueou a exclusão pela regra de segurança. Aplique o arquivo corrigir-exclusao-administrador.sql no SQL Editor e tente novamente.","error");
    } catch(error) {
      return toast(prettyError(error),"error");
    }
    toast("Registro excluído.","success"); await loadData();
  }
  function exportCsv(table) {
    const rows=state.rows[table]||[]; if(!rows.length) return toast("Não há dados para exportar.","error");
    const headers=Object.keys(rows[0]), esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
    const csv="\ufeff"+[headers.map(esc).join(";"),...rows.map(r=>headers.map(h=>esc(r[h])).join(";"))].join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"})); const a=document.createElement("a"); a.href=url; a.download=`tecnobase-${table}-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url); toast("Arquivo CSV exportado.","success");
  }
  function loginError(error) { const e=prettyError(error); return /Invalid login credentials/i.test(e)?"E-mail ou senha incorretos.":e; }
  async function boot() {
    $("#year").textContent=new Date().getFullYear();
    $("#today-label").textContent=new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).format(new Date());
    const rememberedEmail=localStorage.getItem("tecnobase.rememberedEmail"); if(rememberedEmail)$("#login-email").value=rememberedEmail;
    if (!db) { $("#login-form").addEventListener("submit",e=>{e.preventDefault();toast("A biblioteca ou configuração do Supabase não foi carregada.","error")}); return; }
    const {data:{session}}=await db.auth.getSession(); if(session?.user) await showApp(session.user);
    db.auth.onAuthStateChange((event,session)=>{ if(event==="SIGNED_OUT"){stopRealtime();state.user=null;$("#app-shell").classList.add("hidden");$("#login-screen").classList.remove("hidden")} else if(session?.user){state.user=session.user;setTimeout(()=>showApp(session.user),0)} });
  }
  async function showApp(user) { state.user=user; startRealtime(); $("#login-screen").classList.add("hidden");$("#app-shell").classList.remove("hidden");$("#page-content").innerHTML=`${pageHeading("Carregando…","Buscando os dados da escola.")}<div class="metric-grid">${Array(6).fill('<div class="skeleton"></div>').join("")}</div>`; await loadData(); }
  $("#login-form").addEventListener("submit",async e=>{e.preventDefault();const email=$("#login-email").value.trim();if($("#remember-me").checked)localStorage.setItem("tecnobase.rememberedEmail",email);else localStorage.removeItem("tecnobase.rememberedEmail");const b=$("button[type=submit]",e.currentTarget);b.disabled=true;const old=b.innerHTML;b.textContent="Entrando…";const {error}=await db.auth.signInWithPassword({email,password:$("#login-password").value});b.disabled=false;b.innerHTML=old;if(error)toast(loginError(error),"error")});
  $("#forgot-password").addEventListener("click",async()=>{const email=$("#login-email").value.trim();if(!email)return toast("Informe seu e-mail antes de solicitar a recuperação.","error");const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.href.split("#")[0]});if(error)toast(prettyError(error),"error");else toast("Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.","success")});
  $("#logout-button").addEventListener("click",async()=>{const {error}=await db.auth.signOut();if(error)toast(prettyError(error),"error")});
  $("#refresh-button").addEventListener("click",async()=>{await loadData();toast("Dados atualizados.","success")});
  $("#record-form").addEventListener("submit",saveRecord);
  $("#record-dialog").addEventListener("change",e=>{if(e.target.name==="equipamento_id"&&$("#record-form").dataset.table==="emprestimos"){const equipment=state.rows.equipamentos.find(item=>item.id===e.target.value);const room=$("#dialog-fields [name='sala_id']");if(room&&equipment?.sala_id)room.value=equipment.sala_id;}});
  $("#record-dialog").addEventListener("change",e=>{if($("#record-form").dataset.table!=="equipamentos")return;if(e.target.name==="tipo")refreshEquipmentOptions(true,true);if(e.target.name==="marca")refreshEquipmentOptions(true,false);if(["tipo","marca","modelo"].includes(e.target.name))refreshEquipmentPreview();});
  $("#record-dialog").addEventListener("change",e=>{if($("#record-form").dataset.table!=="equipamentos"||!e.target.name.endsWith("_choice"))return;const input=e.target.parentElement.querySelector(`input[name='${e.target.name.replace("_choice", "")}']`);if(!input)return;const enabled=e.target.value==="informar";input.disabled=!enabled;input.hidden=!enabled;input.required=enabled;if(!enabled)input.value="";});
  document.addEventListener("click",async e=>{
    if(e.target.closest("#settings-signout")){const {error}=await db.auth.signOut();if(error)toast(prettyError(error),"error");return;}
    const nav=e.target.closest("[data-page]"); if(nav){goPage(nav.dataset.page);return;}
    const pageLink=e.target.closest("[data-page-link]"); if(pageLink){goPage(pageLink.dataset.pageLink);return;}
    const close=e.target.closest("[data-close-dialog]"); if(close){$("#record-dialog").close();return;}
    if(e.target.closest("[data-close-detail]")){ $("#detail-dialog").close();return; }
    const action=e.target.closest("[data-action]"); if(!action)return;
    const {action:act,table,id}=action.dataset;
    if(act==="new")openRecord(table); if(act==="edit")openRecord(table,id); if(act==="detail")openDetail(table,id); if(act==="delete")await deleteRecord(table,id); if(act==="export")exportCsv(table);
  });
  $("#page-content").addEventListener("input",e=>{if(e.target.id==="table-search"){state.filters.q=e.target.value;const pos=e.target.selectionStart;renderPage();const input=$("#table-search");input?.focus();input?.setSelectionRange(pos,pos)}});
  $("#page-content").addEventListener("change",e=>{if(e.target.id==="status-filter"){state.filters.status=e.target.value;renderPage()}});
  $$('[data-toggle-password]').forEach(btn=>btn.addEventListener("click",()=>{const input=$("#"+btn.dataset.togglePassword);input.type=input.type==="password"?"text":"password"}));
  $("#menu-toggle").addEventListener("click",()=>{$("#sidebar").classList.add("open");$("#sidebar-scrim").classList.add("show")});
  $("#close-sidebar").addEventListener("click",()=>{$("#sidebar").classList.remove("open");$("#sidebar-scrim").classList.remove("show")});
  $("#sidebar-scrim").addEventListener("click",()=>{$("#sidebar").classList.remove("open");$("#sidebar-scrim").classList.remove("show")});
  boot().catch(error=>toast(prettyError(error),"error"));
})();
