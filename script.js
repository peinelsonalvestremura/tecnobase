(() => {
  const db = window.supabaseClient;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const state = { user: null, profile: null, role: "visualizacao", page: "dashboard", rows: {}, userDirectory: [], filters: { q: "", status: "" }, busy: false, realtimeChannel: null, realtimeRefreshTimer: null, realtimeRetryTimer: null, realtimeRetryCount: 0, realtimeChannelSequence: 0, supportMessages: [], supportRequesterId: null, supportChannel: null };
  const roleLabels = { administrador: "Administrador", usuario: "Usuário", visualizacao: "Visualização" };
  const pages = {
    dashboard: { title: "Dashboard", table: null }, equipamentos: { title: "Equipamentos", table: "equipamentos" }, salas: { title: "Salas", table: "salas" }, alunos: { title: "Alunos", table: "alunos" }, emprestimos: { title: "Empréstimos", table: "emprestimos" }, manutencoes: { title: "Manutenções", table: "manutencoes" }, relatorios: { title: "Relatórios", table: null }, usuarios: { title: "Usuários", table: "perfis" }, configuracoes: { title: "Configurações", table: null }
  };
  const configs = {
    equipamentos: { singular: "equipamento", icon: "▣", search: ["marca", "tipo", "modelo", "nome", "patrimonio", "numero_serie"], fields: [f("tipo", "Tipo", "select", true, ["Tablet", "Notebook", "Computador / PC"]), f("marca", "Marca", "equipment-brand", true), f("modelo", "Modelo", "equipment-model", true), f("numero_serie", "Número de série", "optional-code"), f("patrimonio", "Patrimônio", "optional-code"), f("sala_id", "Sala", "ref", true, "salas"), f("status", "Status", "select", true, ["Disponível", "Emprestado", "Em manutenção", "Danificado"]), f("descricao", "Observações", "textarea")] },
    salas: { singular: "sala", icon: "⌗", search: ["nome", "tipo", "responsavel"], fields: [f("nome", "Nome da sala", "text", true), f("tipo", "Tipo de sala", "select", true, ["Laboratório", "Sala de recursos", "Sala de mídia", "Biblioteca", "Secretaria", "Outro"]), f("responsavel", "Responsável", "text"), f("descricao", "Descrição", "textarea")] },
    alunos: { singular: "aluno", icon: "♙", search: ["nome", "turma", "matricula"], fields: [f("nome", "Nome completo", "text", true), f("turma", "Turma", "text", true), f("matricula", "RA (Registro do Aluno)", "text", true)] },
    emprestimos: { singular: "empréstimo", icon: "⇄", search: ["responsavel", "professor_solicitante", "turma", "horario", "status", "observacao"], fields: [f("equipamento_id", "Equipamento", "ref", true, "equipamentos"), f("aluno_id", "Aluno · nome completo", "ref", true, "alunos"), f("professor_solicitante", "Professor solicitante", "text", true), f("responsavel", "Responsável pelo empréstimo", "text", true), f("turma", "Turma", "text", true), f("horario", "Horário da aula", "time", true), f("sala_id", "Sala de destino", "ref", true, "salas"), f("data_emprestimo", "Data do empréstimo", "date", true), f("data_prevista", "Devolução prevista", "date", true), f("status", "Status", "select", true, ["Ativo", "Devolvido", "Atrasado"]), f("observacao", "Observações", "textarea")] },
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
  const fmt = (value, time = false, fullYear = false) => { if (!value) return "—"; const d = new Date(value); return Number.isNaN(+d) ? value : new Intl.DateTimeFormat("pt-BR", time ? { dateStyle: fullYear ? "medium" : "short", timeStyle: "short" } : { dateStyle: "short" }).format(d); };
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
    const auditRecords = (state.rows.historico_atualizacoes || []).map(row => ({ date: row.created_at, userId: row.user_id, userName: row.usuario_nome, table: row.entidade || "sistema" }));
    const records = [...auditRecords, ...["equipamentos", "salas", "alunos", "emprestimos", "manutencoes"].flatMap(table => (state.rows[table] || []).map(row => ({ date: row.updated_at || row.atualizado_em || row.created_at || row.criado_em, userId: row.updated_by || row.atualizado_por || row.created_by || row.criado_por, table })))];
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
    const storedName = latest?.userName?.trim();
    const person = latest ? (storedName && storedName.toLocaleLowerCase("pt-BR") !== "usuário" ? storedName : mappedUser(latest.userId)) : "";
    el.innerHTML = latest ? `Última atualização por <b>${escapeHtml(person)}</b><small>${fmt(latest.date, true, true)}</small>` : "Última atualização por —";
    el.title = latest ? `${person} atualizou ${titleCase(latest.table)} em ${fmt(latest.date, true, true)}` : "Ainda não há registros atualizados.";
  }
  function setRealtimeStatus(status) {
    const el = $("#realtime-status"); if (!el) return;
    const states = {
      connecting: ["connecting", "Conectando"],
      live: ["live", "Ao vivo"],
      offline: ["offline", "Sem conexão ao vivo"]
    };
    const [className, label] = states[status] || states.connecting;
    el.className = `realtime-indicator ${className}`;
    el.textContent = label;
  }
  async function loadData({ silent = false } = {}) {
    if (!db || !state.user) return;
    const names = ["equipamentos", "salas", "alunos", "emprestimos", "manutencoes", "perfis", "historico_atualizacoes"];
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
    const userAvatar = $("#user-avatar"), topAvatar = $("#top-avatar"), normalizedName = name.trim().toLocaleLowerCase("pt-BR");
    const normalizedEmail = (state.user.email || "").trim().toLocaleLowerCase("pt-BR");
    const isThales = normalizedName.includes("thales") || normalizedEmail === "thalesmenezes937@gmail.com";
    const isDaniela = normalizedName.includes("daniela") || normalizedEmail.includes("daniela");
    if (isThales || isDaniela) {
      const photo = isDaniela ? "assets/daniela-profile.jpeg?v=2" : "assets/thales-profile.jpeg?v=2";
      const alt = isDaniela ? "Foto de Daniela Moreira" : "Foto de Thales Menezes";
      userAvatar.classList.add("has-profile-photo");
      userAvatar.innerHTML = `<img class="profile-photo-image" src="${photo}" alt="${alt}" onerror="this.remove(); this.parentElement.classList.remove('has-profile-photo'); this.parentElement.textContent='${escapeHtml(name.trim().charAt(0).toUpperCase())}'">`;
      topAvatar.classList.add("has-profile-photo");
      topAvatar.innerHTML = `<img class="profile-photo-image" src="${photo}" alt="${alt}" onerror="this.remove(); this.parentElement.classList.remove('has-profile-photo'); this.parentElement.textContent='${escapeHtml(name.trim().charAt(0).toUpperCase())}'">`;
    } else {
      userAvatar.classList.remove("has-profile-photo");
      userAvatar.textContent = name.trim().charAt(0).toUpperCase();
      topAvatar.classList.remove("has-profile-photo");
      topAvatar.textContent = name.trim().charAt(0).toUpperCase();
    }
    renderUpdateIndicator();
    renderPage();
  }
  function startRealtime() {
    if (!db || !state.user || state.realtimeChannel || state.realtimeRetryTimer) return;
    setRealtimeStatus("connecting");
    const tables = ["equipamentos", "salas", "alunos", "emprestimos", "manutencoes", "historico_atualizacoes"];
    const channelId = ++state.realtimeChannelSequence;
    let channel = db.channel(`tecnobase-live-${state.user.id}-${channelId}`);
    for (const table of tables) channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
      clearTimeout(state.realtimeRefreshTimer);
      state.realtimeRefreshTimer = setTimeout(() => { loadData({ silent: true }); }, 250);
    });
    state.realtimeChannel = channel;
    channel.subscribe(status => {
      if (status === "SUBSCRIBED") {
        state.realtimeRetryCount = 0;
        setRealtimeStatus("live");
      }
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (state.realtimeChannel !== channel) return;
        state.realtimeChannel = null;
        db.removeChannel(channel);
        setRealtimeStatus("offline");
        state.realtimeRetryCount += 1;
        if (state.realtimeRetryCount === 3) toast("Sem conexão ao vivo. Vou continuar tentando reconectar; confira também a ativação do Realtime no Supabase.", "error");
        const delay = Math.min(30000, 1500 * (2 ** Math.min(state.realtimeRetryCount - 1, 5)));
        clearTimeout(state.realtimeRetryTimer);
        state.realtimeRetryTimer = setTimeout(() => {
          state.realtimeRetryTimer = null;
          startRealtime();
        }, delay);
      }
    });
  }
  function stopRealtime() {
    clearTimeout(state.realtimeRefreshTimer);
    clearTimeout(state.realtimeRetryTimer);
    state.realtimeRefreshTimer = null;
    state.realtimeRetryTimer = null;
    state.realtimeRetryCount = 0;
    const channel = state.realtimeChannel;
    state.realtimeChannel = null;
    if (channel) db.removeChannel(channel);
    setRealtimeStatus("offline");
  }
  function pageHeading(title, subtitle, actions = "") { return `<div class="page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="heading-actions">${actions}</div></div>`; }
  function metric(label, value, icon, color, note = "") { const tones={"#3187e8":"#6384a0","#14b878":"#62917c","#12b6d8":"#6a9aa1","#efa817":"#b18b55","#e45656":"#aa7070","#635be4":"#7d79a0"}; color=tones[color]||color; return `<article class="metric-card" style="--tone:${color};--tint:${color}16"><div class="metric-top">${label}<span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></article>`; }
  function getStats() {
    const eq = state.rows.equipamentos || [], loans = state.rows.emprestimos || [], repairs = state.rows.manutencoes || [];
    return { eq: eq.length, avail: eq.filter(x => x.status === "Disponível").length, loaned: eq.filter(x => x.status === "Emprestado").length, maint: eq.filter(x => /manutenção/i.test(x.status)).length, damaged: eq.filter(x => /danificado/i.test(x.status)).length, students: (state.rows.alunos || []).length, rooms: (state.rows.salas || []).length, loansActive: loans.filter(x => ["Ativo", "Atrasado"].includes(x.status)).length, repairsOpen: repairs.filter(x => x.status !== "Concluída").length };
  }
  function localDateKey(date = new Date()) { const year=date.getFullYear(), month=String(date.getMonth()+1).padStart(2,"0"), day=String(date.getDate()).padStart(2,"0"); return `${year}-${month}-${day}`; }
  function isLoanOverdue(loan) { return String(loan.status||"").toLocaleLowerCase("pt-BR") === "atrasado" || (String(loan.status||"").toLocaleLowerCase("pt-BR") === "ativo" && loan.data_prevista && String(loan.data_prevista).slice(0,10) < localDateKey()); }
  function renderDashboard() {
    const s = getStats(), eq = state.rows.equipamentos || [];
    const tones={green:"#14b878",blue:"#3187e8",orange:"#efa817",red:"#e45656"};
    const total = s.eq || 1;
    const pct = n => (n / total * 100).toFixed(1);
    const loans = state.rows.emprestimos || [], repairs = state.rows.manutencoes || [];
    const catCounts = Object.entries(eq.reduce((a, item) => { const k = item.tipo || item.categoria || "Outros"; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a,b) => b[1]-a[1]).slice(0,5);
    const maxCat = Math.max(1,...catCounts.map(x=>x[1]));
    const overdueLoans = loans.filter(isLoanOverdue).sort((a,b)=>String(a.data_prevista||"").localeCompare(String(b.data_prevista||"")));
    const activeLoans = loans.filter(x => ["Ativo", "Atrasado"].includes(x.status)).sort((a,b)=>String(a.data_prevista||"").localeCompare(String(b.data_prevista||""))).slice(0,4);
    const latestEquipment = [...eq].sort((a,b)=>new Date(b.updated_at||b.atualizado_em||b.created_at||b.criado_em||0)-new Date(a.updated_at||a.atualizado_em||a.created_at||a.criado_em||0))[0];
    const activity = [
      ...[...eq].map(row=>({row,table:"equipamentos",date:row.updated_at||row.atualizado_em||row.created_at||row.criado_em,user:row.updated_by||row.atualizado_por||row.created_by||row.criado_por,label:mappedEquipmentLabel(row.id),icon:"▣"})),
      ...[...loans].map(row=>({row,table:"emprestimos",date:row.updated_at||row.atualizado_em||row.created_at||row.criado_em,user:row.updated_by||row.atualizado_por||row.created_by||row.criado_por,label:`Empréstimo · ${mappedEquipmentLabel(row.equipamento_id)}`,icon:"⇄"})),
      ...[...repairs].map(row=>({row,table:"manutencoes",date:row.updated_at||row.atualizado_em||row.created_at||row.criado_em,user:row.updated_by||row.atualizado_por||row.created_by||row.criado_por,label:`Manutenção · ${mappedEquipmentLabel(row.equipamento_id)}`,icon:"⌁"})),
      ...[...(state.rows.salas||[])].map(row=>({row,table:"salas",date:row.updated_at||row.atualizado_em||row.created_at||row.criado_em,user:row.updated_by||row.atualizado_por||row.created_by||row.criado_por,label:`Sala · ${row.nome||""}`,icon:"⌗"})),
      ...[...(state.rows.alunos||[])].map(row=>({row,table:"alunos",date:row.updated_at||row.atualizado_em||row.created_at||row.criado_em,user:row.updated_by||row.atualizado_por||row.created_by||row.criado_por,label:`Aluno · ${row.nome||""}`,icon:"♙"}))
    ].filter(item=>item.date).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,4);
    const activityRows = activity.length ? activity.map(item=>`<div class="feed-item"><span class="feed-symbol">${item.icon}</span><div class="feed-copy"><strong>${escapeHtml(item.label)}</strong><span>Atualizado por ${escapeHtml(item.user?mappedUser(item.user):"equipe TECNOBASE")}</span></div><time class="feed-time">${fmt(item.date,true)}</time></div>`).join("") : `<div class="empty-state">As atualizações aparecerão aqui quando houver registros com data no banco.</div>`;
    const returnRows = activeLoans.length ? activeLoans.map(x=>{const overdue=isLoanOverdue(x);return `<div class="feed-item ${overdue?"overdue-feed-item":"on-time-feed-item"}"><span class="feed-symbol">${overdue?"!":"◷"}</span><div class="feed-copy"><strong>${escapeHtml(mappedEquipmentLabel(x.equipamento_id))}</strong><span>${escapeHtml(mappedName("alunos",x.aluno_id))} · <span class="loan-status-pill ${overdue?"late":"on-time"}">${overdue?"Atrasado":"Em dia"}</span></span></div><time class="feed-time ${overdue?"overdue-text":"on-time-text"}">${fmt(x.data_prevista)}</time></div>`}).join("") : `<div class="empty-state">Nenhuma devolução pendente.</div>`;
    const overdueAlert = overdueLoans.length ? `<section class="overdue-alert" role="status"><span class="overdue-alert-icon">!</span><div><strong>${overdueLoans.length} empréstimo${overdueLoans.length===1?"":"s"} com devolução atrasada</strong><small>${overdueLoans.slice(0,2).map(x=>escapeHtml(mappedEquipmentLabel(x.equipamento_id))).join(" · ")}${overdueLoans.length>2?` e mais ${overdueLoans.length-2}`:""}</small></div><button class="overdue-alert-action" data-page-link="emprestimos">Ver empréstimos →</button></section>` : "";
    const featured = latestEquipment ? `<div class="equipment"><img src="${equipmentImagePath(latestEquipment.tipo)}" alt="${escapeHtml(latestEquipment.tipo||"Equipamento")}"><div class="equipment-copy"><strong>${escapeHtml(mappedEquipmentLabel(latestEquipment.id))}</strong><small>${escapeHtml(mappedName("salas",latestEquipment.sala_id))} · ${escapeHtml(latestEquipment.patrimonio||"Sem patrimônio")}</small></div>${badge(latestEquipment.status)}</div>` : `<div class="empty-state">Cadastre um equipamento para ver o inventário em destaque.</div>`;
    const quickActions = canWrite() ? `<button class="button secondary" data-action="new" data-table="equipamentos">＋ Equipamento</button><button class="button secondary" data-action="new" data-table="salas">＋ Sala</button><button class="button primary" data-action="new" data-table="emprestimos">＋ Empréstimo</button>` : `<button class="button secondary" data-action="export" data-table="equipamentos">↓ Exportar dados</button>`;
    const damagedEnd = pct(s.avail+s.loaned+s.maint+s.damaged);
    const unclassified = Math.max(0, s.eq-s.avail-s.loaned-s.maint-s.damaged);
    const donut = s.eq ? `conic-gradient(${tones.green} 0 ${pct(s.avail)}%,${tones.blue} ${pct(s.avail)}% ${pct(s.avail+s.loaned)}%,${tones.orange} ${pct(s.avail+s.loaned)}% ${pct(s.avail+s.loaned+s.maint)}%,${tones.red} ${pct(s.avail+s.loaned+s.maint)}% ${damagedEnd}%,#66778a ${damagedEnd}% 100%)` : `conic-gradient(#354456 0 100%)`;
    return `${pageHeading("Visão geral", "Acompanhe os equipamentos e a tecnologia da escola.", quickActions)}${overdueAlert}<section class="dashboard-primary-stats">${metric("Total de equipamentos",s.eq,"▣","#12b6d8","Inventário cadastrado")}${metric("Disponíveis",s.avail,"✓","#14b878",`${s.eq?Math.round(s.avail/s.eq*100):0}% prontos para uso`)}${metric("Emprestados",s.loaned,"⇄","#3187e8",`${s.loansActive} empréstimos ativos`)}${metric("Em manutenção",s.maint,"⌁","#efa817","Aguardando reparo")}</section><section class="dashboard-secondary-stats">${metric("Danificados",s.damaged,"!","#e45656","Precisam de atenção")}${metric("Alunos",s.students,"♙","#635be4","Cadastrados")}${metric("Salas",s.rooms,"⌗","#3187e8","Espaços cadastrados")}${metric("Manutenções abertas",s.repairsOpen,"⚙","#efa817","Em andamento ou aguardando")}</section><div class="dashboard-grid dashboard-main-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Estado do inventário</h2><div class="panel-subtitle">Distribuição dos equipamentos por situação</div></div><button class="link-button" data-page-link="equipamentos">Ver inventário →</button></div><div class="status-chart"><div class="donut dashboard-donut" style="background:${donut}"><div class="donut-center"><b>${s.eq}</b><small>equipamentos</small></div></div><div class="legend">${[["Disponíveis",s.avail,tones.green],["Emprestados",s.loaned,tones.blue],["Manutenção",s.maint,tones.orange],["Com defeito",s.damaged,tones.red],...(unclassified?[["Outros status",unclassified,"#66778a"]]:[])].map(([n,v,c])=>`<div class="legend-row"><span class="legend-name"><i class="legend-dot" style="--tone:${c}"></i>${n}</span><b>${v}</b></div>`).join("")}</div></div><div class="dashboard-bars">${catCounts.length?catCounts.map(([n,v])=>`<div class="dashboard-bar-row"><span>${escapeHtml(n)}</span><i><b style="width:${Math.max(4,v/maxCat*100)}%"></b></i><strong>${v}</strong></div>`).join(""):`<div class="empty-state">Cadastre equipamentos para ver a quantidade por tipo.</div>`}</div></section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Atividade recente</h2><div class="panel-subtitle">Atualizações da equipe em tempo real</div></div><span class="realtime-caption">● Ao vivo</span></div><div class="dashboard-feed">${activityRows}</div></section></div><div class="dashboard-grid dashboard-bottom-grid"><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Equipamentos em destaque</h2><div class="panel-subtitle">Acesso rápido ao inventário</div></div><button class="link-button" data-page-link="equipamentos">Ver todos →</button></div>${featured}</section><section class="panel"><div class="panel-head"><div><h2 class="panel-title">Próximas devoluções</h2><div class="panel-subtitle">Itens atrasados aparecem em vermelho</div></div><button class="link-button" data-page-link="emprestimos">Abrir empréstimos →</button></div><div class="dashboard-feed">${returnRows}</div></section></div>`;
  }
  function emptyRow(message, cols) { return `<tr><td colspan="${cols}"><div class="empty-state">${escapeHtml(message)}</div></td></tr>`; }
  function columnsFor(table) {
    if (table === "equipamentos") return [["tipo","Tipo"],["marca","Marca"],["modelo","Modelo"],["patrimonio","Patrimônio"],["numero_serie","Nº de série"],["sala_id","Sala"],["status","Status"]];
    if (table === "salas") return [["nome","Sala"],["tipo","Tipo"],["responsavel","Responsável"],["descricao","Descrição"]];
    if (table === "alunos") return [["nome","Nome completo"],["turma","Turma"],["matricula","RA"]];
    if (table === "emprestimos") return [["equipamento_id","Equipamento"],["aluno_id","Aluno"],["professor_solicitante","Professor solicitante"],["responsavel","Responsável pelo empréstimo"],["turma","Turma"],["horario","Aula · 45 min"],["data_emprestimo","Retirada"],["data_prevista","Devolução prevista"],["status","Status"]];
    if (table === "manutencoes") return [["equipamento_id","Equipamento"],["tipo","Tipo"],["problema","Problema"],["prioridade","Prioridade"],["data","Data"],["status","Status"]];
    if (table === "perfis") return [["nome","Usuário"],["email","E-mail"],["perfil","Perfil"],["ativo","Acesso"]];
    return [["acao","Ação"],["entidade","Área"],["descricao","Descrição"],["user_id","Usuário"],["created_at","Data e hora"]];
  }
  function cellValue(table, row, key) {
    let v = row[key];
    if (key === "sala_id") v = mappedName("salas", v);
    if (key === "equipamento_id") v = table === "emprestimos" ? mappedEquipmentLabel(v) : mappedName("equipamentos", v);
    if (key === "aluno_id") v = mappedName("alunos", v);
    if (key === "horario" && v) {
      const [hour, minute] = String(v).split(":").map(Number);
      if (Number.isFinite(hour) && Number.isFinite(minute)) { const end = (hour * 60 + minute + 45) % (24 * 60); v = `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}–${String(Math.floor(end/60)).padStart(2,"0")}:${String(end%60).padStart(2,"0")} · 45 min`; }
    }
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
      const matchStatus = !state.filters.status || (table === "emprestimos" && state.filters.status === "Atrasado" ? isLoanOverdue(row) : table === "emprestimos" && state.filters.status === "Ativo" ? row.status === "Ativo" && !isLoanOverdue(row) : String(row.status || row.perfil || "").toLowerCase() === state.filters.status.toLowerCase());
      return matchQuery && matchStatus;
    });
    const canCreate = canWrite() && (table !== "perfis" || isAdmin());
    const add = canCreate ? `<button class="button primary" data-action="new" data-table="${table}">＋ Novo ${config.singular}</button>` : "";
    const titleSub = { equipamentos:"Inventário e situação dos equipamentos escolares.", salas:"Gerencie os espaços e seus responsáveis.", alunos:"Cadastro de alunos para controle de empréstimos.", emprestimos:"Registre retiradas e acompanhe as devoluções.", manutencoes:"Acompanhe problemas, prioridades e reparos.", perfis:"Perfis e permissões atribuídos a usuários autenticados." }[table];
    const queryFilter = table === "equipamentos" ? `<select id="status-filter" class="filter-select"><option value="">Todos os status</option>${["Disponível","Emprestado","Em manutenção","Danificado"].map(x=>`<option ${state.filters.status===x?"selected":""}>${x}</option>`).join("")}</select>` : table === "emprestimos" ? `<select id="status-filter" class="filter-select"><option value="">Todos os status</option>${["Ativo","Atrasado","Devolvido"].map(x=>`<option ${state.filters.status===x?"selected":""}>${x}</option>`).join("")}</select>` : table === "manutencoes" ? `<select id="status-filter" class="filter-select"><option value="">Todos os status</option>${["Aberta","Em andamento","Concluída"].map(x=>`<option ${state.filters.status===x?"selected":""}>${x}</option>`).join("")}</select>` : "";
    const columns = columnsFor(table);
    let dataRows = rows.map(row => `<tr data-record-id="${escapeHtml(row.id)}">${columns.map(([key]) => `<td>${key === "status" && table === "emprestimos" ? badge(isLoanOverdue(row)?"Atrasado":row.status === "Ativo"?"Em dia":cellValue(table,row,key)) : key === "status" || key === "perfil" ? badge(cellValue(table,row,key)) : table === "equipamentos" && key === "tipo" ? `<div class="equipment-type-cell"><img src="${equipmentImagePath(row.tipo)}" alt="" loading="lazy"><span>${escapeHtml(cellValue(table,row,key))}</span></div>` : `<span>${escapeHtml(cellValue(table,row,key))}</span>`}</td>`).join("")}<td><div class="row-actions"><button class="row-action" title="Ver detalhes" aria-label="Ver detalhes" data-action="detail" data-table="${table}" data-id="${escapeHtml(row.id)}">◉</button>${canWrite() ? `<button class="row-action row-action-edit" title="Editar registro" data-action="edit" data-table="${table}" data-id="${escapeHtml(row.id)}">Editar</button>` : ""}${isAdmin() && !["perfis"].includes(table) ? `<button class="row-action row-action-delete" title="Excluir registro" aria-label="Excluir registro" data-action="delete" data-table="${table}" data-id="${escapeHtml(row.id)}">🗑</button>` : ""}</div></td></tr>`).join("");
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
    if (ownerTable === "emprestimos" && def.name === "horario") return `<div class="form-field"><label>${def.label} *</label><input type="time" name="horario" value="${escapeHtml(value)}" required><small class="field-hint">Cada aula dura 45 minutos; o horário final é calculado automaticamente.</small></div>`;
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
      const placeholder = value ? "" : '<option value="" selected disabled>Selecione</option>';
      return `<div class="form-field ${full}"><label>${def.label}${def.required?" *":""}</label><select name="${def.name}" ${required}>${placeholder}${opts.map(([v,label])=>`<option value="${escapeHtml(v)}" ${String(value)===String(v)?"selected":""}>${escapeHtml(label)}</option>`).join("")}</select></div>`;
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
  async function exportCsv(table) {
    const columns=columnsFor(table);
    if (!columns?.length) return toast("Este relatório não está disponível.","error");
    const button=document.querySelector(`[data-action="export"][data-table="${table}"]`);
    if (button) { button.disabled=true; button.dataset.originalText=button.textContent; button.textContent="Preparando…"; }
    try {
      // Reports must include every row, not only the first 300 shown in the app.
      const rows=[]; const pageSize=1000; let offset=0;
      while (true) {
        const {data,error}=await db.from(table).select("*").order("id",{ascending:true}).range(offset,offset+pageSize-1);
        if (error) throw error;
        rows.push(...(data||[]));
        if (!data || data.length<pageSize) break;
        offset+=pageSize;
      }
      if (!rows.length) return toast("Não há dados cadastrados para exportar neste relatório.","error");
      const esc=value=>{
        let text=String(value??"");
        // Prevent spreadsheet formulas from running when a field starts with a formula marker.
        if (/^[=+@\-\t\r]/.test(text)) text=`'${text}`;
        return `"${text.replaceAll('"','""')}"`;
      };
      const csv="\ufeff"+[columns.map(([,label])=>esc(label)).join(";"),...rows.map(row=>columns.map(([key])=>esc(cellValue(table,row,key))).join(";"))].join("\r\n");
      const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
      const a=document.createElement("a"); a.href=url; a.download=`tecnobase-${table}-${new Date().toISOString().slice(0,10)}.csv`; a.style.display="none"; document.body.append(a); a.click(); a.remove();
      // Keep the object URL alive long enough for the browser to begin the download.
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      toast(`Relatório baixado com ${rows.length} registro${rows.length===1?"":"s"}.`,"success");
    } catch(error) {
      console.error(`Falha ao exportar relatório ${table}`,error);
      toast(`Não foi possível baixar o relatório. ${prettyError(error)}`,"error");
    } finally {
      if (button) { button.disabled=false; button.textContent=button.dataset.originalText||"↓ Baixar CSV"; delete button.dataset.originalText; }
    }
  }
  function supportUserName(id) {
    if (id === state.user?.id) return state.profile?.nome || state.user?.email || "Você";
    return mappedUser(id);
  }
  function supportErrorMessage(error) {
    if (/suporte_mensagens|schema cache|does not exist/i.test(error?.message || "")) return "O chat ainda precisa ser ativado no Supabase. Execute o arquivo suporte-chat.sql uma vez no SQL Editor.";
    return prettyError(error);
  }
  function renderSupportMessages() {
    const list = $("#support-messages"), conversations = $("#support-conversations");
    const participants = [...new Set(state.supportMessages.map(row => row.solicitante_id))];
    const isAdmin = state.role === "administrador";
    if (!isAdmin) state.supportRequesterId = state.user?.id || null;
    else if (!participants.includes(state.supportRequesterId)) state.supportRequesterId = participants[0] || null;
    conversations.hidden = !isAdmin;
    conversations.innerHTML = isAdmin ? (participants.length ? participants.map(id => `<button type="button" class="support-contact ${id===state.supportRequesterId?"active":""}" data-support-requester="${escapeHtml(id)}"><span class="support-contact-avatar">${escapeHtml(supportUserName(id).trim().charAt(0).toUpperCase())}</span><span><b>${escapeHtml(supportUserName(id))}</b><small>Conversa de suporte</small></span></button>`).join("") : `<div class="support-empty-contact">As conversas aparecerão aqui quando alguém pedir ajuda.</div>`) : "";
    const supportForm = $("#support-form"), hasSelectedConversation = !isAdmin || (state.supportRequesterId && participants.includes(state.supportRequesterId));
    supportForm.hidden = isAdmin && !hasSelectedConversation;
    $("#support-message").placeholder = isAdmin ? "Escreva sua resposta…" : "Escreva sua mensagem…";
    const rows = state.supportMessages.filter(row => row.solicitante_id === state.supportRequesterId);
    if (!rows.length) {
      list.innerHTML = isAdmin
        ? `<div class="support-welcome"><span>✦</span><b>Nenhuma solicitação selecionada</b><p>Quando alguém enviar uma mensagem de suporte, ela aparecerá nesta caixa para o administrador Thales Menezes responder.</p></div>`
        : `<div class="support-welcome"><span>✦</span><b>Como podemos ajudar?</b><p>Conte o que aconteceu. Sua mensagem será enviada ao administrador Thales Menezes.</p></div>`;
      return;
    }
    list.innerHTML = rows.map(row => `<article class="support-message ${row.remetente_id===state.user?.id?"outgoing":"incoming"}"><small>${escapeHtml(supportUserName(row.remetente_id))} · ${fmt(row.created_at,true,true)}</small><p>${escapeHtml(row.mensagem)}</p></article>`).join("");
    list.scrollTop = list.scrollHeight;
  }
  async function refreshSupportChat() {
    const list = $("#support-messages");
    if (!state.user || !db) return;
    let query = db.from("suporte_mensagens").select("id, solicitante_id, remetente_id, mensagem, created_at").order("created_at", {ascending:true}).limit(500);
    if (state.role !== "administrador") query = query.eq("solicitante_id", state.user.id);
    const {data,error} = await query;
    if (error) { list.innerHTML = `<div class="support-error">${escapeHtml(supportErrorMessage(error))}</div>`; return; }
    state.supportMessages = data || [];
    renderSupportMessages();
  }
  async function openSupportChat() {
    const isAdmin = state.role === "administrador";
    $("#support-title").textContent = isAdmin ? "Caixa de entrada do suporte" : "Conversa com o administrador";
    $("#support-subtitle").textContent = isAdmin ? "Responda às solicitações recebidas." : "Descreva o problema para receber ajuda.";
    $("#support-dialog").showModal();
    await refreshSupportChat();
    if (!state.supportChannel) {
      state.supportChannel = db.channel(`tecnobase-support-${state.user.id}`).on("postgres_changes", {event:"*",schema:"public",table:"suporte_mensagens"}, () => refreshSupportChat()).subscribe();
    }
    setTimeout(() => $("#support-message")?.focus(), 50);
  }
  async function sendSupportMessage(event) {
    event.preventDefault();
    const field = $("#support-message"), message = field.value.trim();
    if (!message || !state.user) return;
    const requesterId = state.role === "administrador" ? state.supportRequesterId : state.user.id;
    if (!requesterId) return toast("Selecione uma conversa para responder.","error");
    if (state.role === "administrador" && !state.supportMessages.some(row => row.solicitante_id === requesterId)) return toast("O administrador pode responder apenas a solicitações recebidas.","error");
    const submit = $("button[type='submit']", event.currentTarget); submit.disabled = true;
    const {error} = await db.from("suporte_mensagens").insert({solicitante_id:requesterId,remetente_id:state.user.id,mensagem:message});
    submit.disabled = false;
    if (error) return toast(supportErrorMessage(error),"error");
    field.value = "";
    await refreshSupportChat();
  }
  function loginError(error) { const e=prettyError(error); return /Invalid login credentials/i.test(e)?"E-mail ou senha incorretos.":e; }
  async function boot() {
    $("#year").textContent=new Date().getFullYear();
    $("#today-label").textContent=new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).format(new Date());
    const rememberedEmail=localStorage.getItem("tecnobase.rememberedEmail"); if(rememberedEmail)$("#login-email").value=rememberedEmail;
    if (!db) { $("#login-form").addEventListener("submit",e=>{e.preventDefault();toast("A biblioteca ou configuração do Supabase não foi carregada.","error")}); return; }
    const {data:{session}}=await db.auth.getSession(); if(session?.user) await showApp(session.user);
    db.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"){
        stopRealtime();
        if(state.supportChannel)db.removeChannel(state.supportChannel);
        state.supportChannel=null; state.user=null;
        $("#app-shell").classList.add("hidden"); $("#login-screen").classList.remove("hidden");
        return;
      }
      // TOKEN_REFRESHED and USER_UPDATED are normal session events. Do not
      // reopen/reinitialize the app for them; doing so interrupts the user.
      if(session?.user && ["INITIAL_SESSION","SIGNED_IN"].includes(event)){
        if(state.user?.id===session.user.id && !$("#app-shell").classList.contains("hidden")) return;
        setTimeout(()=>showApp(session.user),0);
      }
    });
  }
  async function showApp(user) {
    if(state.user?.id===user.id && !$("#app-shell").classList.contains("hidden")) return;
    state.user=user; startRealtime(); $("#login-screen").classList.add("hidden");$("#app-shell").classList.remove("hidden");$("#page-content").innerHTML=`${pageHeading("Carregando…","Buscando os dados da escola.")}<div class="metric-grid">${Array(6).fill('<div class="skeleton"></div>').join("")}</div>`; await loadData();
  }
  $("#login-form").addEventListener("submit",async e=>{e.preventDefault();const email=$("#login-email").value.trim();if($("#remember-me").checked)localStorage.setItem("tecnobase.rememberedEmail",email);else localStorage.removeItem("tecnobase.rememberedEmail");const b=$("button[type=submit]",e.currentTarget);b.disabled=true;const old=b.innerHTML;b.textContent="Entrando…";const {error}=await db.auth.signInWithPassword({email,password:$("#login-password").value});b.disabled=false;b.innerHTML=old;if(error)toast(loginError(error),"error")});
  $("#forgot-password").addEventListener("click",async()=>{const email=$("#login-email").value.trim();if(!email)return toast("Informe seu e-mail antes de solicitar a recuperação.","error");const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.href.split("#")[0]});if(error)toast(prettyError(error),"error");else toast("Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.","success")});
  $("#logout-button").addEventListener("click",async()=>{const {error}=await db.auth.signOut();if(error)toast(prettyError(error),"error")});
  $("#refresh-button").addEventListener("click",async()=>{await loadData();toast("Dados atualizados.","success")});
  $("#open-support-chat").addEventListener("click",openSupportChat);
  $("#support-form").addEventListener("submit",sendSupportMessage);
  $("#record-form").addEventListener("submit",saveRecord);
  $("#record-dialog").addEventListener("change",e=>{if(e.target.name==="equipamento_id"&&$("#record-form").dataset.table==="emprestimos"){const equipment=state.rows.equipamentos.find(item=>item.id===e.target.value);const room=$("#dialog-fields [name='sala_id']");if(room&&equipment?.sala_id)room.value=equipment.sala_id;}});
  $("#record-dialog").addEventListener("change",e=>{if($("#record-form").dataset.table!=="equipamentos")return;if(e.target.name==="tipo")refreshEquipmentOptions(true,true);if(e.target.name==="marca")refreshEquipmentOptions(true,false);if(["tipo","marca","modelo"].includes(e.target.name))refreshEquipmentPreview();});
  $("#record-dialog").addEventListener("change",e=>{if($("#record-form").dataset.table!=="equipamentos"||!e.target.name.endsWith("_choice"))return;const input=e.target.parentElement.querySelector(`input[name='${e.target.name.replace("_choice", "")}']`);if(!input)return;const enabled=e.target.value==="informar";input.disabled=!enabled;input.hidden=!enabled;input.required=enabled;if(!enabled)input.value="";});
  document.addEventListener("click",async e=>{
    if(e.target.closest("#settings-signout")){const {error}=await db.auth.signOut();if(error)toast(prettyError(error),"error");return;}
    if(e.target.closest("[data-close-support]")){ $("#support-dialog").close();return; }
    const contact=e.target.closest("[data-support-requester]"); if(contact){state.supportRequesterId=contact.dataset.supportRequester;renderSupportMessages();return;}
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
