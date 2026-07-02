/* ══════════════════════════════════════════
   ROCKET GESTÃO — Painel de Clientes
   VERSÃO DE ENTREGA — começa totalmente vazia.
   Todo o app roda em JavaScript no navegador.
   Dados salvos por cliente no localStorage —
   estrutura pronta para plugar APIs oficiais
   (WhatsApp Cloud API, Meta Marketing API,
   Google Ads API).
   ══════════════════════════════════════════ */

'use strict';

const PALETTE = ['#c026d3', '#34d399', '#60a5fa', '#f0a500', '#f87171', '#8b7cf6', '#f472b6', '#2dd4bf'];

const STARTER_TASKS = () => ([
  { id: uid(), title: 'Reunião de kickoff com o cliente', type: 'Reunião',  pri: 'alta',   date: hoje(), col: 'todo' },
  { id: uid(), title: 'Definir entregáveis fixos do mês', type: 'Outra',    pri: 'normal', date: hoje(), col: 'todo' },
  { id: uid(), title: 'Configurar contas de anúncio',     type: 'Meta ADS', pri: 'normal', date: hoje(), col: 'todo' },
]);

/* ── BANCO DO PAINEL ─────────────────────
   Cada conta tem seu painel salvo na nuvem
   (Firestore, doc paineis/{uid}) — quem loga
   vê só os próprios clientes, de qualquer
   máquina. O localStorage vira só um cache
   offline por conta. ── */

const DB_KEY = 'rocket_gestao_db_v1';

function seedDB() {
  return { clients: [], tasks: {}, meetings: {}, convos: {} };
}

function lerLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && Array.isArray(d.clients)) return d;
    }
  } catch (e) { /* armazenamento indisponível */ }
  return null;
}

let DB = seedDB();
let saveTimer = null;

function save() {
  if (!currentUser || !currentUser.uid) return;
  try { localStorage.setItem(DB_KEY + '_' + currentUser.uid, JSON.stringify(DB)); } catch (e) {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    db.collection('paineis').doc(currentUser.uid).set(DB)
      .catch(() => toast('⚠️ Sem conexão — as últimas alterações serão salvas quando a internet voltar.'));
  }, 600);
}

async function carregarPainel(uid) {
  let carregado = null;
  try {
    const snap = await db.collection('paineis').doc(uid).get();
    if (snap.exists) {
      carregado = snap.data();
    } else {
      // primeira entrada desta conta: aproveita dados antigos deste navegador, se existirem
      carregado = lerLocal(DB_KEY + '_' + uid) || lerLocal(DB_KEY) || seedDB();
      try { localStorage.removeItem(DB_KEY); } catch (e) {}
      await db.collection('paineis').doc(uid).set(carregado);
    }
  } catch (e) {
    // offline: usa o cache local desta conta
    carregado = lerLocal(DB_KEY + '_' + uid) || seedDB();
  }
  DB = carregado;
  DB.clients = DB.clients || [];
  DB.tasks = DB.tasks || {};
  DB.meetings = DB.meetings || {};
  DB.convos = DB.convos || {};
  state.clientId = DB.clients.length ? DB.clients[0].id : null;
  state.view = ['financas', 'contas'].includes(state.view) ? state.view : 'client';
}

/* ── ESTADO DA TELA ────────────────────── */

const state = {
  clientId: DB.clients.length ? DB.clients[0].id : null,
  tab: 'operacao',
  view: 'client',
  convoId: null,
  waFilter: 'todas',
  month: new Date(),
  editingClient: null,
};

const cli    = () => DB.clients.find(c => c.id === state.clientId) || null;
const tasks  = () => (DB.tasks[state.clientId]    = DB.tasks[state.clientId]    || []);
const meets  = () => (DB.meetings[state.clientId] = DB.meetings[state.clientId] || []);
const convos = () => (DB.convos[state.clientId]   = DB.convos[state.clientId]   || []);

/* ── HELPERS ───────────────────────────── */

const $ = sel => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function hoje() { return new Date().toISOString().slice(0, 10); }
function agora() { return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function dataExtensa() {
  const d = new Date();
  return `${d.getDate()} de ${MESES[d.getMonth()].slice(0,3).toLowerCase()}. de ${d.getFullYear()}`;
}
function fmtCardDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} · ${DIAS[d.getDay()]}`;
}
function uid() { return 'x' + Math.random().toString(36).slice(2, 9); }
function initials(name) {
  return name.replace(/[^\p{L}\s]/gu, '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function chipClass(type) {
  const map = { 'Reels':'reels', 'Post Feed':'postfeed', 'Stories':'stories', 'Captação':'captacao',
    'Meta ADS':'metaads', 'Google ADS':'googleads', 'Relatório':'relatorio', 'Reunião':'reuniao' };
  return map[type] || 'outra';
}

function toast(msg) {
  const t = el('div', 'toast', `<span>🚀</span><span>${msg}</span>`);
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 3200);
  setTimeout(() => t.remove(), 3700);
}

/* ── SIDEBAR ───────────────────────────── */

function renderSidebar() {
  const list = $('#clientList');
  list.innerHTML = '';
  $('#clientCount').textContent = DB.clients.length;
  DB.clients.forEach(c => {
    const b = el('button', 'sb-client' + (state.view === 'client' && c.id === state.clientId ? ' active' : ''));
    b.innerHTML = `<span class="dot" style="background:${c.color}">${esc(c.short)}</span>
      <span>${esc(c.name)}<small>${esc(c.seg)}</small></span>`;
    b.onclick = () => { state.clientId = c.id; state.view = 'client'; state.convoId = null; renderAll(); };
    list.appendChild(b);
  });
  document.querySelectorAll('.sb-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
    btn.onclick = () => { state.view = btn.dataset.view; renderAll(); };
  });
}

/* ── HEADER + TABS ─────────────────────── */

const TABS = [
  { id: 'operacao',     label: 'Operação',     ico: '▦' },
  { id: 'reunioes',     label: 'Reuniões',     ico: '🎙' },
  { id: 'whatsapp',     label: 'WhatsApp',     ico: '💬' },
  { id: 'meta',         label: 'Meta Ads',     ico: 'Ⓜ' },
  { id: 'google',       label: 'Google Ads',   ico: 'G' },
  { id: 'inteligencia', label: 'Inteligência', ico: '✦' },
];

function renderHeader() {
  const h = $('#clientHeader');
  const tb = $('#tabBar');
  const c = cli();
  if (state.view !== 'client' || !c) { h.innerHTML = ''; tb.innerHTML = ''; tb.style.display = 'none'; return; }
  tb.style.display = 'flex';
  h.innerHTML = `
    <div class="ch-top">
      <div class="ch-avatar" style="background:linear-gradient(135deg, ${c.color}, ${c.color}99)">${esc(c.short)}</div>
      <div>
        <div class="ch-name">${esc(c.name)}
          <span class="badge ${c.status}">${esc(c.statusLabel)}</span>
          ${payInfo(c).overdue ? '<span class="badge red">💰 Pagamento pendente</span>' : ''}
        </div>
        <div class="ch-meta">
          <span>${esc(c.seg)}</span><span>${esc(c.email)}</span><span>Resp.: ${esc(c.resp)}</span>
        </div>
      </div>
      <div class="ch-actions">
        <button class="btn ghost small" id="hdrEdit">✏️ Editar</button>
        <button class="btn ghost small" onclick="window.print()">🖨 Entregáveis (PDF)</button>
        <button class="btn primary small" id="hdrNewTask">+ Nova tarefa</button>
      </div>
    </div>`;
  $('#hdrNewTask').onclick = () => openTaskModal();
  $('#hdrEdit').onclick = () => openClientModal(c);

  tb.innerHTML = '';
  TABS.forEach(t => {
    const b = el('button', 'tab' + (t.id === state.tab ? ' active' : ''),
      `<span class="t-ico">${t.ico}</span>${t.label}`);
    b.onclick = () => { state.tab = t.id; renderAll(); };
    tb.appendChild(b);
  });
}

/* ── BOAS-VINDAS (sem clientes) ────────── */

function renderWelcome(root) {
  const box = el('div', 'empty');
  box.style.marginTop = '60px';
  box.innerHTML = `
    <span class="e-ico">🚀</span>
    <b>Bem-vindo ao Rocket Gestão!</b>
    Cadastre o primeiro cliente para começar: Kanban de tarefas, reuniões com IA,
    espelho do WhatsApp e das contas de anúncio — tudo em um só lugar.<br><br>
    <button class="btn primary" id="welcomeAdd">+ Cadastrar primeiro cliente</button>`;
  root.appendChild(box);
  box.querySelector('#welcomeAdd').onclick = () => openClientModal(null);
}

/* ── KANBAN ────────────────────────────── */

const COLS = [
  { id: 'fixos', label: 'Entregáveis fixos' },
  { id: 'todo',  label: 'A fazer' },
  { id: 'doing', label: 'Em execução' },
  { id: 'done',  label: 'Concluído' },
];

function renderKanban(root) {
  const list = tasks();
  const done = list.filter(t => t.col === 'done').length;
  const total = list.length;
  const pctDone = total ? Math.round(done / total * 100) : 0;

  const bar = el('div', 'kb-toolbar');
  bar.innerHTML = `
    <div class="kb-month">
      <button id="mPrev">‹</button>
      <strong>${MESES[state.month.getMonth()]} ${state.month.getFullYear()}</strong>
      <button id="mNext">›</button>
    </div>
    <div class="kb-progress">
      <div class="kb-bar"><i style="width:${pctDone}%"></i></div>
      <span>${done}/${total} concluídas · ${pctDone}%</span>
    </div>
    <button class="btn primary small" id="kbNew">+ Nova tarefa</button>`;
  root.appendChild(bar);
  bar.querySelector('#kbNew').onclick = () => openTaskModal();
  bar.querySelector('#mPrev').onclick = () => { state.month.setMonth(state.month.getMonth() - 1); renderContent(); };
  bar.querySelector('#mNext').onclick = () => { state.month.setMonth(state.month.getMonth() + 1); renderContent(); };

  const board = el('div', 'kanban');
  COLS.forEach(col => {
    const colTasks = list.filter(t => t.col === col.id);
    const colEl = el('div', 'kb-col');
    colEl.dataset.col = col.id;
    colEl.innerHTML = `<div class="kb-col-head"><h4>${col.label}</h4><span class="n">${colTasks.length}</span></div>`;
    const wrap = el('div', 'kb-cards');

    colTasks.forEach(t => {
      const card = el('div', 'kb-card');
      card.draggable = true;
      card.dataset.id = t.id;
      card.style.borderLeftColor = t.pri === 'urgente' ? 'var(--red)' : t.pri === 'alta' ? 'var(--gold)' : 'var(--border2)';
      card.innerHTML = `
        <h5>${esc(t.title)}</h5>
        <div class="tags">
          <span class="chip ${chipClass(t.type)}">${esc(t.type)}</span>
          <span class="chip p-${t.pri}">${t.pri === 'normal' ? '● Normal' : t.pri === 'alta' ? '▲ Alta' : '⚑ Urgente'}</span>
        </div>
        <div class="foot"><span>🗓 ${fmtCardDate(t.date)}</span><button class="del" title="Excluir">✕</button></div>`;
      card.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', t.id);
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
      card.querySelector('.del').onclick = () => {
        DB.tasks[state.clientId] = list.filter(x => x.id !== t.id);
        save(); renderContent(); toast('Tarefa excluída');
      };
      wrap.appendChild(card);
    });

    colEl.addEventListener('dragover', e => { e.preventDefault(); colEl.classList.add('dragover'); });
    colEl.addEventListener('dragleave', () => colEl.classList.remove('dragover'));
    colEl.addEventListener('drop', e => {
      e.preventDefault();
      colEl.classList.remove('dragover');
      const id = e.dataTransfer.getData('text/plain');
      const task = list.find(x => x.id === id);
      if (task && task.col !== col.id) {
        task.col = col.id;
        save(); renderContent();
        if (col.id === 'done') toast('Tarefa concluída! 🎉');
      }
    });

    colEl.appendChild(wrap);
    board.appendChild(colEl);
  });
  root.appendChild(board);
}

/* ── REUNIÕES ──────────────────────────── */

function renderReunioes(root) {
  const prep = el('div', 'prep-card');
  prep.innerHTML = `
    <span class="ico">🧠</span>
    <div>
      <h4>Prep de reunião (IA)</h4>
      <p>O roteiro do mês pronto — narrativa, o que dizer e o gargalo enquadrado, ancorado no dado real.</p>
    </div>
    <button class="btn primary small" id="prepBtn">✦ Gerar prep</button>`;
  root.appendChild(prep);
  prep.querySelector('#prepBtn').onclick = () =>
    toast('O prep é gerado após a primeira reunião registrada e as contas conectadas.');

  const list = meets();
  const head = el('div', 'kb-toolbar');
  head.innerHTML = `
    <div><strong style="font-size:16px">Reuniões</strong>
    <div style="color:var(--muted);font-size:12.5px">${list.length} ${list.length === 1 ? 'reunião registrada' : 'reuniões registradas'}</div></div>
    <div style="flex:1"></div>
    <button class="btn primary small" id="newMeet">+ Nova reunião</button>`;
  root.appendChild(head);
  head.querySelector('#newMeet').onclick = () => openModal('#transModal');

  if (!list.length) {
    root.appendChild(el('div', 'empty', `<span class="e-ico">🎙</span>
      <b>Nenhuma reunião registrada</b>
      Clique em <b style="display:inline">+ Nova reunião</b> para registrar a primeira — cole a transcrição e a IA gera resumo, decisões e tarefas.`));
    return;
  }

  list.forEach(m => {
    const box = el('div', 'meeting');
    box.innerHTML = `
      <div class="meeting-head">
        <div class="m-ico">🎙</div>
        <div>
          <h4>${esc(m.title)}</h4>
          <small>🗓 ${esc(m.date)} · ${esc(m.who)}</small>
        </div>
        <div class="m-actions">
          <button class="btn ghost small m-del" title="Excluir reunião">🗑</button>
          <button class="btn ghost small toggle">${m.open ? '▾' : '▸'}</button>
        </div>
      </div>
      <div class="meeting-body" ${m.open ? '' : 'hidden'}>
        <div class="block">
          <button class="btn ghost small agenda">📅 Adicionar ao Google Agenda</button>
        </div>
        <div class="block">
          <div class="block-title">📋 Resumo executivo</div>
          <div class="resumo">${esc(m.resumo)}</div>
        </div>
        <div class="block">
          <div class="block-title">✅ Decisões tomadas</div>
          <ul class="check-list">${m.decisoes.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
        </div>
        <div class="block">
          <div class="block-title">➜ Próximos passos</div>
          <ul class="next-list">${m.proximos.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>
        <div class="block">
          <button class="btn primary small gen-tasks">✦ Criar tarefas dos próximos passos</button>
        </div>
      </div>`;
    const body = box.querySelector('.meeting-body');
    const tog = box.querySelector('.toggle');
    box.querySelector('.meeting-head').onclick = e => {
      if (e.target.closest('.btn') && !e.target.closest('.toggle')) return;
      body.hidden = !body.hidden;
      m.open = !body.hidden;
      save();
      tog.textContent = body.hidden ? '▸' : '▾';
    };
    box.querySelector('.m-del').onclick = e => {
      e.stopPropagation();
      if (!confirm(`Excluir a reunião "${m.title}"?`)) return;
      DB.meetings[state.clientId] = list.filter(x => x.id !== m.id);
      save(); renderContent(); toast('Reunião excluída');
    };
    box.querySelector('.agenda').onclick = () => toast('Evento enviado ao Google Agenda (integração em produção)');
    box.querySelector('.gen-tasks').onclick = () => {
      m.proximos.forEach(p => tasks().push({ id: uid(), title: p, type: 'Outra', pri: 'normal', date: hoje(), col: 'todo' }));
      save();
      toast(`${m.proximos.length} tarefas criadas no Kanban a partir da reunião`);
    };
    root.appendChild(box);
  });
}

/* ── WHATSAPP ──────────────────────────── */

function renderWhatsapp(root) {
  const all = convos();
  const c0 = cli();

  const head = el('div', 'kb-toolbar');
  head.innerHTML = `
    <div>
      <strong style="font-size:16px">💬 ${esc(c0.name)} — WhatsApp Business</strong>
      <div style="color:var(--muted);font-size:12.5px">${all.length} ${all.length === 1 ? 'conversa' : 'conversas'} · espelhamento via API oficial (Cloud API)</div>
    </div>
    <div style="flex:1"></div>
    <button class="btn ghost small" onclick="window.print()">📄 Diagnóstico (PDF)</button>`;
  root.appendChild(head);

  if (!all.length) {
    renderConnect(root, 'wa',
      'Conecte o número do WhatsApp Business deste cliente para espelhar aqui, em tempo real, todas as conversas dos vendedores com os leads — com origem do anúncio e funil.');
    return;
  }

  const filtered = all.filter(c => state.waFilter === 'todas' || c.src === 'Meta');
  if (!state.convoId || !all.some(c => c.id === state.convoId)) state.convoId = (filtered[0] || all[0]).id;
  const c = all.find(x => x.id === state.convoId);

  const lay = el('div', 'wa-layout');

  const list = el('div', 'wa-list');
  list.innerHTML = `
    <div class="wa-list-head">
      <input type="text" placeholder="Pesquisar conversa…" id="waSearch">
      <div class="wa-filters">
        <button class="wa-filter ${state.waFilter === 'todas' ? 'active' : ''}" data-f="todas">Todas ${all.length}</button>
        <button class="wa-filter ${state.waFilter === 'meta' ? 'active' : ''}" data-f="meta">Meta Ads ${all.filter(x => x.src === 'Meta').length}</button>
      </div>
    </div>`;
  const convosEl = el('div', 'wa-convos');
  filtered.forEach(cv => {
    const last = cv.chat[cv.chat.length - 1];
    const b = el('button', 'wa-convo' + (cv.id === state.convoId ? ' active' : ''));
    b.innerHTML = `
      <span class="wa-ava" style="background:${cv.color}">${esc(initials(cv.name))}</span>
      <span class="c-mid">
        <span class="c-name">${esc(cv.name)} ${cv.novo ? '<span class="badge green" style="font-size:9px;padding:1px 6px">Novo</span>' : ''}</span>
        <span class="c-prev">${last.dir === 'out' ? '✓✓ ' : ''}${esc(last.text)}</span>
      </span>
      <span class="c-right">
        <span class="c-time">${esc(cv.time)}</span>
        ${cv.src ? `<span class="badge blue c-src">⚡ ${esc(cv.src)}</span>` : ''}
      </span>`;
    b.onclick = () => { state.convoId = cv.id; renderContent(); };
    convosEl.appendChild(b);
  });
  list.appendChild(convosEl);
  lay.appendChild(list);

  const chat = el('div', 'wa-chat');
  chat.innerHTML = `
    <div class="wa-chat-head">
      <span class="wa-ava" style="background:${c.color}">${esc(initials(c.name))}</span>
      <div>
        <h4>${esc(c.name)}</h4>
        <small>${esc(c.phone)} · ${c.tags.map(esc).join(' · ') || 'sem tags'}</small>
      </div>
      <span class="badge gold funil-tag">${esc(c.funil)}</span>
    </div>
    <div class="wa-msgs" id="waMsgs">
      <span class="wa-day">${esc((c.entrada || '').split(',')[0])}</span>
      ${c.chat.map(m => `
        <div class="msg ${m.dir}">
          <div class="who">${esc(m.who)}</div>
          ${esc(m.text)}
          <small>${esc(m.time)}${m.dir === 'out' ? ' ✓✓' : ''}</small>
        </div>`).join('')}
    </div>
    <div class="wa-input">
      <input type="text" id="waNewMsg" placeholder="Responder como a loja… (Enter para enviar)">
      <button id="waSend" title="Enviar">➤</button>
    </div>
    <div class="wa-mirror-note">🔒 Espelhamento em tempo real — atendimento continua pelo WhatsApp Business no celular</div>`;
  lay.appendChild(chat);

  const side = el('div', 'wa-side');
  side.innerHTML = `
    <div class="big-ava" style="background:${c.color}">${esc(initials(c.name))}</div>
    <h4>${esc(c.name)}</h4>
    <div class="ph">${esc(c.phone)}</div>
    <div class="side-block">
      <div class="block-title">⌁ Funil</div>
      <select id="funilSel">
        ${['Novo lead','Em negociação','Visita agendada','Proposta','Fechado','Perdido']
          .map(f => `<option ${f === c.funil ? 'selected' : ''}>${f}</option>`).join('')}
      </select>
    </div>
    <div class="side-block">
      <div class="block-title">🏷 Tags</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${c.tags.map((t, i) => `<span class="badge violet tag-x" data-i="${i}" title="Clique para remover" style="cursor:pointer">${esc(t)} ✕</span>`).join('')}
        <span class="badge blue" id="addTag" style="cursor:pointer">+ Tag</span>
      </div>
    </div>
    <div class="side-block">
      <div class="block-title">⚡ Origem</div>
      <div class="kv"><span>Anúncio</span><b>${esc(c.anuncio || '—')}</b></div>
      <div class="kv"><span>Campanha</span><b>${esc(c.campanha || '—')}</b></div>
      <div class="kv"><span>Entrada</span><b>${esc(c.entrada || '—')}</b></div>
    </div>
    <div class="side-block">
      <div class="block-title">🎧 Atendimento</div>
      <div class="kv"><span>Mensagens do lead</span><b>${c.chat.filter(m => m.dir === 'in').length}</b></div>
    </div>`;
  lay.appendChild(side);
  root.appendChild(lay);

  list.querySelectorAll('.wa-filter').forEach(f => {
    f.onclick = () => { state.waFilter = f.dataset.f; renderContent(); };
  });
  list.querySelector('#waSearch').oninput = e => {
    const q = e.target.value.toLowerCase();
    convosEl.querySelectorAll('.wa-convo').forEach((b, i) => {
      b.style.display = filtered[i].name.toLowerCase().includes(q) ? '' : 'none';
    });
  };
  side.querySelector('#funilSel').onchange = e => {
    c.funil = e.target.value;
    save(); renderContent();
    toast(`${c.name} movido para "${c.funil}"`);
  };
  side.querySelector('#addTag').onclick = () => {
    const t = prompt('Nova tag:');
    if (t && t.trim()) { c.tags.push(t.trim()); save(); renderContent(); }
  };
  side.querySelectorAll('.tag-x').forEach(tag => {
    tag.onclick = () => { c.tags.splice(+tag.dataset.i, 1); save(); renderContent(); };
  });

  const msgs = chat.querySelector('#waMsgs');
  msgs.scrollTop = msgs.scrollHeight;
  const input = chat.querySelector('#waNewMsg');
  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    c.chat.push({ dir: 'out', who: 'Loja', text, time: agora() });
    save(); renderContent();
  };
  chat.querySelector('#waSend').onclick = send;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}

/* ── CONEXÕES DE CONTA (WhatsApp / Meta / Google) ──
   A conexão real usa as APIs oficiais e é feita pela
   equipe Rocket Ads. Aqui o cliente solicita: os dados
   vão por e-mail e a aba fica "em implantação". ── */

const CONN_INFO = {
  wa: {
    label: 'WhatsApp Business', ico: '💬',
    contaLabel: 'Número do WhatsApp Business',
    placeholder: 'Ex.: (11) 99999-0000',
    hint: 'Informe o número usado no atendimento. O espelhamento usa a API oficial da Meta (Cloud API) — as conversas continuam no celular normalmente.',
  },
  meta: {
    label: 'Meta Ads', ico: 'Ⓜ',
    contaLabel: 'Conta de anúncios (nome ou ID)',
    placeholder: 'Ex.: act_123456789 ou nome da conta',
    hint: 'Informe a conta de anúncios do Facebook/Instagram. O espelho usa a Meta Marketing API.',
  },
  google: {
    label: 'Google Ads', ico: 'G',
    contaLabel: 'ID da conta Google Ads',
    placeholder: 'Ex.: 123-456-7890',
    hint: 'Informe o ID que aparece no topo do Google Ads. O espelho usa a Google Ads API.',
  },
};

let connService = null;

function openConnModal(service) {
  connService = service;
  const info = CONN_INFO[service];
  $('#connTitle').textContent = `Conectar ${info.label}`;
  $('#connHint').textContent = info.hint;
  $('#connContaLabel').firstChild.textContent = info.contaLabel;
  $('#connConta').placeholder = info.placeholder;
  $('#connConta').value = '';
  $('#connResp').value = '';
  openModal('#connModal');
  $('#connConta').focus();
}

async function enviarConexao(service, conta, resp) {
  const c = cli();
  const info = CONN_INFO[service];
  const r = await fetch('https://formsubmit.co/ajax/' + ADMIN_EMAIL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      _subject: 'Rocket Gestao - Conectar ' + info.label + ' - ' + c.name,
      _template: 'table',
      servico: info.label,
      cliente: c.name,
      conta_informada: conta,
      responsavel: resp,
      solicitado_por: $('#userName').textContent + ' (' + ($('#userRole').textContent || '') + ')',
      message: 'SOLICITACAO DE CONEXAO - ' + info.label.toUpperCase() + '\n\n'
        + 'Cliente: ' + c.name + '\n'
        + 'Conta: ' + conta + '\n'
        + 'Responsavel: ' + resp + '\n\n'
        + 'Configure a integracao oficial e avise o cliente quando estiver no ar.',
    }),
  });
  if (!r.ok) throw new Error('falha no envio');
}

$('#connSend').onclick = async () => {
  const conta = $('#connConta').value.trim();
  const resp = $('#connResp').value.trim();
  if (!conta) { $('#connConta').focus(); return; }
  const c = cli();
  if (!c || !connService) return;
  c.conn = c.conn || {};
  c.conn[connService] = { status: 'pendente', conta, resp, data: hoje() };
  save();
  closeModal('#connModal');
  renderContent();
  toast('Solicitação enviada — a equipe Rocket Ads vai configurar a conexão 🚀');
  try { await enviarConexao(connService, conta, resp || '—'); }
  catch (e) { toast('Não foi possível enviar por e-mail — reenvie quando estiver com internet.'); }
};

function renderConnect(root, service, text) {
  const info = CONN_INFO[service];
  const req = (cli().conn || {})[service];
  let box;
  if (req) {
    box = el('div', 'empty', `<span class="e-ico">⏳</span>
      <b>Conexão em implantação</b>
      Solicitação enviada em ${fmtVenc(req.data)} para a conta <b>${esc(req.conta)}</b>.<br>
      A equipe Rocket Ads está configurando a integração oficial do ${info.label} — os dados aparecem aqui assim que a conexão estiver no ar.<br><br>
      <button class="btn ghost small" id="connBtn">↺ Reenviar solicitação</button>`);
  } else {
    box = el('div', 'empty', `<span class="e-ico">${info.ico}</span>
      <b>${info.label} não conectado</b>
      ${text}<br><br>
      <button class="btn primary small" id="connBtn">Conectar ${info.label}</button>`);
  }
  box.style.marginTop = '30px';
  root.appendChild(box);
  box.querySelector('#connBtn').onclick = () => openConnModal(service);
}

function renderMeta(root) {
  renderConnect(root, 'meta',
    'Conecte a conta de anúncios deste cliente para espelhar aqui as campanhas, o investimento, os leads, CPL, CTR e CPM — direto da Meta Marketing API, sem depender de prints.');
}

function renderGoogle(root) {
  renderConnect(root, 'google',
    'Conecte a conta do Google Ads deste cliente para espelhar campanhas, conversões, CPC e CPA com métricas precisas da Google Ads API.');
}

function renderIntel(root) {
  const hero = el('div', 'intel-hero');
  hero.innerHTML = `
    <h2>✦ Inteligência de Performance</h2>
    <p>A IA cruza os dados do Meta Ads, Google Ads e WhatsApp para separar os melhores anúncios e os
    criativos vencedores — e transforma isso em recomendações práticas para o próximo ciclo.</p>`;
  root.appendChild(hero);

  const conns = cli().conn || {};
  const pend = ['wa', 'meta', 'google'].filter(s => conns[s]);
  const box = el('div', 'empty');
  box.style.marginTop = '30px';
  box.innerHTML = `<span class="e-ico">✦</span>
    <b>Aguardando dados das contas</b>
    A inteligência é gerada a partir das contas conectadas (WhatsApp, Meta Ads e Google Ads).
    ${pend.length ? `<br>Conexões em implantação: <b>${pend.map(s => CONN_INFO[s].label).join(', ')}</b>.` : '<br>Conecte-as nas abas ao lado para ativar o ranking de criativos e os insights.'}`;
  root.appendChild(box);
}

/* ── KPI helper ────────────────────────── */

function kpi(label, value, delta, dir) {
  return `<div class="card kpi">
    <div class="k-label">${label}</div>
    <div class="k-value">${value}</div>
    <div class="k-delta ${dir}">${dir === 'up' ? '▲' : '▼'} ${delta}</div>
  </div>`;
}

/* ── VISÃO GERAL ───────────────────────── */

function renderOverview(root) {
  root.innerHTML = `
    <div class="page-title">Visão geral</div>
    <div class="page-sub">Resumo de todos os clientes — ${MESES[new Date().getMonth()]} ${new Date().getFullYear()}</div>`;

  if (!DB.clients.length) { renderWelcome(root); return; }

  const allTasks = DB.clients.flatMap(c => DB.tasks[c.id] || []);
  const pend = allTasks.filter(t => t.col !== 'done').length;
  const reunioes = DB.clients.reduce((s, c) => s + (DB.meetings[c.id] || []).length, 0);
  const conversas = DB.clients.reduce((s, c) => s + (DB.convos[c.id] || []).length, 0);

  const kpis = el('div', 'grid g4');
  kpis.innerHTML = `
    ${kpi('Clientes ativos', DB.clients.length, 'gestão centralizada', 'up')}
    ${kpi('Tarefas pendentes', pend, `${allTasks.length} no total`, 'up')}
    ${kpi('Reuniões registradas', reunioes, 'com resumo por IA', 'up')}
    ${kpi('Conversas espelhadas', conversas, 'via WhatsApp Business', 'up')}`;
  root.appendChild(kpis);

  const atrasados = DB.clients.filter(c => payInfo(c).overdue);
  const alerts = el('div', 'card mt');
  alerts.innerHTML = `
    <h3>🔔 Alertas</h3>
    ${atrasados.length
      ? atrasados.map(c => `<div class="alert-item"><span class="a-ico">💰</span><span><b>${esc(c.name)}</b>: pagamento pendente desde ${fmtVenc(c.venc)} (${brl(feeOf(c))}). Confirme em Finanças ao receber.</span></div>`).join('')
      : '<div class="alert-item"><span class="a-ico">✅</span><span>Nenhum alerta no momento. Pagamentos em dia aparecem aqui quando vencerem.</span></div>'}`;
  root.appendChild(alerts);

  const tbl = el('div', 'card mt');
  tbl.innerHTML = `
    <h3>Clientes</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Cliente</th><th>Segmento</th><th class="num">Mensalidade</th><th>Status</th><th class="num">Tarefas abertas</th><th class="num">Reuniões</th></tr></thead>
      <tbody>
        ${DB.clients.map(c => `<tr class="row-client" data-id="${c.id}" style="cursor:pointer">
          <td class="name"><span class="status-dot on"></span>${esc(c.name)}</td>
          <td>${esc(c.seg)}</td>
          <td class="num">${brl(feeOf(c))}</td>
          <td><span class="badge ${c.status}">${esc(c.statusLabel)}</span></td>
          <td class="num">${(DB.tasks[c.id] || []).filter(t => t.col !== 'done').length}</td>
          <td class="num">${(DB.meetings[c.id] || []).length}</td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  root.appendChild(tbl);
  tbl.querySelectorAll('.row-client').forEach(r => {
    r.onclick = () => { state.clientId = r.dataset.id; state.view = 'client'; renderAll(); };
  });
}

/* ── FINANÇAS / PAGAMENTOS ─────────────── */

// preços antigos, mantidos só para clientes criados antes da mensalidade livre
const PLAN_PRICE = { 'Plano Start': 1550, 'Plano Growth': 2400, 'Plano Turbo': 4500 };
function feeOf(c) {
  return typeof c.fee === 'number' && !isNaN(c.fee) ? c.fee : (PLAN_PRICE[c.plan] || 0);
}

function payInfo(c) {
  if (!c.venc) return { overdue: false, label: '—', cls: 'blue' };
  const overdue = c.venc < hoje();
  return overdue
    ? { overdue: true, label: 'Pendente', cls: 'red' }
    : { overdue: false, label: 'Pago', cls: 'green' };
}

function fmtVenc(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

function confirmarPagamento(id) {
  const c = DB.clients.find(x => x.id === id);
  if (!c) return;
  // avança o ciclo mantendo o dia do vencimento, até cair numa data futura
  const d = new Date((c.venc || hoje()) + 'T12:00:00');
  do { d.setMonth(d.getMonth() + 1); } while (d < new Date());
  c.venc = d.toISOString().slice(0, 10);
  save(); renderContent();
  toast(`Pagamento de ${c.name} confirmado — próximo vencimento ${fmtVenc(c.venc)}`);
}

function renderFinancas(root) {
  root.innerHTML = `
    <div class="page-title">Finanças</div>
    <div class="page-sub">Receita recorrente, vencimentos e contratos ativos</div>`;

  if (!DB.clients.length) {
    root.appendChild(el('div', 'empty', `<span class="e-ico">◈</span>
      <b>Nenhum contrato ainda</b>
      Cadastre clientes com mensalidade e vencimento — o MRR, os pagamentos pendentes e a lista de contratos aparecem aqui automaticamente.`));
    return;
  }

  const mrr = DB.clients.reduce((s, c) => s + feeOf(c), 0);
  const pend = DB.clients.filter(c => payInfo(c).overdue);
  const valorPend = pend.reduce((s, c) => s + feeOf(c), 0);

  const kpis = el('div', 'grid g4');
  kpis.innerHTML = `
    ${kpi('MRR', brl(mrr), 'receita recorrente mensal', 'up')}
    ${kpi('Contratos ativos', DB.clients.length, `${DB.clients.length - pend.length} em dia`, 'up')}
    ${kpi('Pagamentos pendentes', pend.length, pend.length ? 'confirme ao receber' : 'tudo em dia 🎉', pend.length ? 'down' : 'up')}
    ${kpi('Valor pendente', brl(valorPend), pend.length ? 'aguardando recebimento' : 'nenhuma pendência', pend.length ? 'down' : 'up')}`;
  root.appendChild(kpis);

  const tbl = el('div', 'card mt');
  tbl.innerHTML = `
    <h3>Contratos e pagamentos</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Cliente</th><th>Segmento</th><th class="num">Mensalidade</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr></thead>
      <tbody>
        ${DB.clients.map(c => {
          const p = payInfo(c);
          return `<tr>
          <td class="name">${esc(c.name)}</td>
          <td>${esc(c.seg)}</td>
          <td class="num">${brl(feeOf(c))}</td>
          <td><input type="date" class="venc-input ${p.overdue ? 'late' : ''}" data-id="${c.id}" value="${c.venc || ''}" title="Escolher dia do vencimento"></td>
          <td><span class="badge ${p.cls}">${p.label}</span></td>
          <td><button class="btn ghost small pay-btn" data-id="${c.id}">✓ Confirmar pagamento</button></td>
        </tr>`; }).join('')}
      </tbody>
    </table></div>`;
  root.appendChild(tbl);
  tbl.querySelectorAll('.pay-btn').forEach(b => b.onclick = () => confirmarPagamento(b.dataset.id));
  tbl.querySelectorAll('.venc-input').forEach(inp => inp.onchange = () => {
    const c = DB.clients.find(x => x.id === inp.dataset.id);
    if (!c || !inp.value) return;
    c.venc = inp.value;
    save(); renderContent();
    toast(`Vencimento de ${c.name} alterado para ${fmtVenc(c.venc)}`);
  });
}

/* ── EQUIPE ────────────────────────────── */

function renderEquipe(root) {
  root.innerHTML = `
    <div class="page-title">Equipe</div>
    <div class="page-sub">Carga de trabalho e responsabilidades</div>`;

  if (!DB.clients.length) {
    root.appendChild(el('div', 'empty', `<span class="e-ico">☰</span>
      <b>Nenhum responsável ainda</b>
      Ao cadastrar clientes com um responsável interno, a carga de trabalho de cada pessoa aparece aqui.`));
    return;
  }

  const grid = el('div', 'grid g3');
  const resps = [...new Set(DB.clients.map(c => c.resp))];
  resps.forEach((r, i) => {
    const clientes = DB.clients.filter(c => c.resp === r);
    const abertas = clientes.reduce((s, c) => s + (DB.tasks[c.id] || []).filter(t => t.col !== 'done').length, 0);
    const color = PALETTE[i % PALETTE.length];
    const card = el('div', 'card');
    card.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">
        <div class="sb-avatar" style="background:linear-gradient(135deg, ${color}, ${color}88)">${esc(r[0])}</div>
        <div><strong>${esc(r)}</strong><div style="color:var(--muted);font-size:12px">Gestão de contas</div></div>
      </div>
      <div class="kv"><span>Clientes</span><b>${clientes.length}</b></div>
      <div class="kv"><span>Tarefas abertas</span><b>${abertas}</b></div>`;
    grid.appendChild(card);
  });
  root.appendChild(grid);
}

/* ── CONTAS DE ACESSO (somente admin) ──── */

async function renderContas(root) {
  root.innerHTML = `
    <div class="page-title">Contas de acesso</div>
    <div class="page-sub">Usuários deste painel — somente o administrador (${ADMIN_EMAIL}) vê esta área</div>
    <div class="empty" id="contasLoading"><span class="e-ico">⏳</span><b>Carregando contas…</b></div>`;

  let users = [];
  try {
    const snap = await db.collection('users').get();
    users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    root.innerHTML = '';
    root.appendChild(el('div', 'empty', `<span class="e-ico">⚠️</span>
      <b>Não foi possível carregar as contas</b>
      Verifique sua conexão com a internet e tente novamente.`));
    return;
  }

  // se o usuário já saiu dessa tela enquanto carregava, não faz nada
  if (state.view !== 'contas') return;
  root.innerHTML = `
    <div class="page-title">Contas de acesso</div>
    <div class="page-sub">Usuários deste painel — somente o administrador (${ADMIN_EMAIL}) vê esta área</div>`;

  if (!users.length) {
    root.appendChild(el('div', 'empty', `<span class="e-ico">👤</span>
      <b>Nenhuma conta criada ainda</b>
      Quando alguém criar uma conta pela tela de entrada, ela aparece aqui para você liberar ou bloquear.`));
    return;
  }

  const tbl = el('div', 'card');
  tbl.innerHTML = `
    <h3>Usuários</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Nome</th><th>Empresa</th><th>E-mail</th><th>Situação</th><th>Código</th><th>Ação</th></tr></thead>
      <tbody>
        ${users.map(u => `<tr>
          <td class="name">${esc(u.nome)}</td>
          <td>${esc(u.empresa || '—')}</td>
          <td>${esc(u.email)}</td>
          <td>${u.blocked
            ? '<span class="badge red">🔒 Bloqueada</span>'
            : u.active
              ? '<span class="badge green">Ativa</span>'
              : '<span class="badge gold">Aguardando liberação</span>'}</td>
          <td>${u.active ? '—' : '<span class="badge violet">✉ enviado por e-mail</span>'}</td>
          <td><button class="btn ${u.blocked ? 'ghost' : 'danger'} small user-block" data-uid="${esc(u.uid)}">${u.blocked ? '🔓 Liberar' : '🔒 Bloquear'}</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>
    <p class="hint" style="margin-top:12px">☁️ Contas centralizadas na nuvem — o bloqueio vale instantaneamente em qualquer navegador ou dispositivo do cliente, sem precisar de novo deploy.</p>`;
  root.appendChild(tbl);

  tbl.querySelectorAll('.user-block').forEach(b => b.onclick = async () => {
    const u = users.find(x => x.uid === b.dataset.uid);
    if (!u) return;
    const novoStatus = !u.blocked;
    b.disabled = true;
    b.textContent = 'Aguarde…';
    try {
      await db.collection('users').doc(u.uid).update({ blocked: novoStatus });
      u.blocked = novoStatus;
      renderContent();
      toast(novoStatus ? `🔒 Acesso de ${u.nome} bloqueado` : `🔓 Acesso de ${u.nome} liberado`);
    } catch (e) {
      toast('Não foi possível atualizar agora. Tente de novo.');
      b.disabled = false;
      b.textContent = u.blocked ? '🔓 Liberar' : '🔒 Bloquear';
    }
  });
}

/* ── ROTEADOR DE CONTEÚDO ──────────────── */

function renderContent() {
  const root = $('#content');
  root.innerHTML = '';
  if (state.view === 'financas' && !isAdmin()) state.view = 'client';
  if (state.view === 'contas' && !isAdmin())   state.view = 'client';
  if (state.view === 'overview')  return renderOverview(root);
  if (state.view === 'financas')  return renderFinancas(root);
  if (state.view === 'contas')    return renderContas(root);
  if (state.view === 'equipe')    return renderEquipe(root);

  if (!cli()) { renderWelcome(root); return; }

  switch (state.tab) {
    case 'operacao':     renderKanban(root); break;
    case 'reunioes':     renderReunioes(root); break;
    case 'whatsapp':     renderWhatsapp(root); break;
    case 'meta':         renderMeta(root); break;
    case 'google':       renderGoogle(root); break;
    case 'inteligencia': renderIntel(root); break;
  }
}

function renderAll() {
  renderSidebar();
  renderHeader();
  renderContent();
}

/* ── MODAIS ────────────────────────────── */

function openModal(sel) { $(sel).hidden = false; }
function closeModal(sel) { $(sel).hidden = true; }

document.querySelectorAll('[data-close]').forEach(b =>
  b.onclick = () => b.closest('.modal-backdrop').hidden = true);
document.querySelectorAll('.modal-backdrop').forEach(m =>
  m.addEventListener('click', e => { if (e.target === m) m.hidden = true; }));

/* nova tarefa */
function openTaskModal() {
  $('#tTitle').value = '';
  $('#tDate').value = hoje();
  openModal('#taskModal');
  $('#tTitle').focus();
}

$('#taskSave').onclick = () => {
  const title = $('#tTitle').value.trim();
  if (!title) { $('#tTitle').focus(); return; }
  if (!cli()) { closeModal('#taskModal'); toast('Cadastre um cliente primeiro'); return; }
  tasks().push({
    id: uid(), title,
    type: $('#tType').value,
    pri: $('#tPriority').value,
    date: $('#tDate').value,
    col: $('#tColumn').value,
  });
  save();
  closeModal('#taskModal');
  state.tab = 'operacao';
  renderAll();
  toast('Tarefa criada com sucesso');
};

/* cliente novo / editar */
function openClientModal(client) {
  state.editingClient = client ? client.id : null;
  $('#clientModalTitle').textContent = client ? 'Editar cliente' : 'Novo cliente';
  $('#cName').value = client ? client.name : '';
  $('#cSeg').value = client ? client.seg : '';
  $('#cFee').value = client && feeOf(client) ? feeOf(client) : '';
  $('#cEmail').value = client ? client.email : '';
  $('#cResp').value = client ? client.resp : '';
  $('#cVenc').value = client && client.venc ? client.venc
    : new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  $('#clientDelete').hidden = !client;
  openModal('#clientModal');
  $('#cName').focus();
}

$('#addClient').onclick = () => openClientModal(null);

$('#clientSave').onclick = () => {
  const name = $('#cName').value.trim();
  if (!name) { $('#cName').focus(); return; }
  const data = {
    name,
    seg: $('#cSeg').value.trim() || 'Outro',
    fee: parseFloat($('#cFee').value) || 0,
    email: $('#cEmail').value.trim() || '—',
    resp: $('#cResp').value.trim() || 'Equipe',
    venc: $('#cVenc').value || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
  };
  if (state.editingClient) {
    Object.assign(DB.clients.find(c => c.id === state.editingClient), data, { short: initials(name) });
    toast('Cliente atualizado');
  } else {
    const id = uid();
    DB.clients.push({
      id, ...data,
      short: initials(name),
      color: PALETTE[DB.clients.length % PALETTE.length],
      status: 'green', statusLabel: 'Saudável',
    });
    DB.tasks[id] = STARTER_TASKS();
    DB.meetings[id] = [];
    DB.convos[id] = [];
    state.clientId = id;
    state.view = 'client';
    state.tab = 'operacao';
    toast(`Cliente "${name}" criado — tarefas iniciais já no Kanban`);
  }
  save();
  closeModal('#clientModal');
  renderAll();
};

$('#clientDelete').onclick = () => {
  const c = DB.clients.find(x => x.id === state.editingClient);
  if (!c) return;
  if (!confirm(`Excluir o cliente "${c.name}" e todos os seus dados? Essa ação não pode ser desfeita.`)) return;
  DB.clients = DB.clients.filter(x => x.id !== c.id);
  delete DB.tasks[c.id]; delete DB.meetings[c.id]; delete DB.convos[c.id];
  state.clientId = DB.clients.length ? DB.clients[0].id : null;
  save();
  closeModal('#clientModal');
  renderAll();
  toast('Cliente excluído');
};

/* transcrição → reunião + tarefas */
$('#transRun').onclick = () => {
  if (!cli()) { closeModal('#transModal'); toast('Cadastre um cliente primeiro'); return; }
  const txt = $('#transText').value.trim();
  const title = $('#transTitle').value.trim() || 'Reunião — ' + dataExtensa();
  closeModal('#transModal');

  const resumo = txt
    ? (txt.length > 260 ? txt.slice(0, 260).trim() + '…' : txt)
    : 'Reunião registrada. Envie a transcrição ou o áudio para a IA gerar o resumo executivo completo.';
  const proximos = ['Enviar resumo da reunião ao cliente', 'Agendar próximos passos combinados'];

  meets().unshift({
    id: uid(), title, date: dataExtensa(), who: cli().resp + ', ' + cli().name, open: true,
    resumo,
    decisoes: ['Registrar decisões na próxima edição da reunião'],
    proximos,
  });
  proximos.forEach(p => tasks().push({ id: uid(), title: p, type: 'Outra', pri: 'alta', date: hoje(), col: 'todo' }));
  save();
  state.tab = 'reunioes';
  renderAll();
  toast('IA processou a reunião: resumo salvo e 2 tarefas criadas no Kanban ✦');
  $('#transText').value = '';
  $('#transTitle').value = '';
};

/* ── BUSCA GLOBAL ──────────────────────── */

$('#globalSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = e.target.value.toLowerCase().trim();
    if (!q) return;
    const c = DB.clients.find(x => x.name.toLowerCase().includes(q));
    if (c) { state.clientId = c.id; state.view = 'client'; renderAll(); toast(`Cliente: ${c.name}`); return; }
    for (const cl of DB.clients) {
      const t = (DB.tasks[cl.id] || []).find(x => x.title.toLowerCase().includes(q));
      if (t) { state.clientId = cl.id; state.view = 'client'; state.tab = 'operacao'; renderAll(); toast(`Tarefa em ${cl.name}: ${t.title}`); return; }
    }
    toast('Nada encontrado para "' + q + '"');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    $('#globalSearch').focus();
  }
});

/* ══ CONTAS E LIBERAÇÃO DE ACESSO ═══════════
   Fluxo: o dono da empresa cria a conta →
   a conta nasce BLOQUEADA e um e-mail chega
   para a equipe Rocket Ads com o código de
   liberação → a equipe envia o código ao
   cliente → ele digita e o acesso abre.
   ═══════════════════════════════════════════ */

const ADMIN_EMAIL = 'rocketadsmkt77@gmail.com'; // conta do administrador (cadastrada no Firebase Authentication)
// Impressão digital (SHA-256) do código mestre — o código em si NÃO aparece aqui
// e não tem como ser descoberto a partir desta linha.
const MASTER_HASH = '926cd8cf575178d3769fdef6c20e85c7aafdfcf43458f483fa59a7559b1ec84a';

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

let currentUser = null;
let currentUnsub = null; // listener em tempo real da própria conta (detecta bloqueio instantâneo)
const isAdmin = () => !!(currentUser && currentUser.email === ADMIN_EMAIL);
const adminUser = () => ({ nome: 'Rocket Ads', empresa: 'Administrador', email: ADMIN_EMAIL, active: true });

function genCode() { return 'RG-' + String(Math.floor(100000 + Math.random() * 900000)); }

let pendingUser = null;

function showPane(p) {
  ['login', 'signup', 'pending'].forEach(x => { $('#pane-' + x).hidden = x !== p; });
  document.querySelectorAll('#authTabs button').forEach(b => b.classList.toggle('active', b.dataset.pane === p));
  $('#authTabs').style.display = p === 'pending' ? 'none' : 'flex';
}
document.querySelectorAll('#authTabs button').forEach(b => b.onclick = () => showPane(b.dataset.pane));

async function enterApp(user) {
  currentUser = user;
  // carrega o painel desta conta na nuvem antes de abrir a tela
  await carregarPainel(user.uid);
  $('#authScreen').hidden = true;
  $('#userName').textContent = user.nome;
  $('#userRole').textContent = user.empresa || 'Administrador';
  $('#userAvatar').textContent = initials(user.nome);
  // Finanças e Contas: somente o administrador
  $('#navFinancas').hidden = !isAdmin();
  $('#navContas').hidden = !isAdmin();
  if (!isAdmin() && ['financas', 'contas'].includes(state.view)) state.view = 'client';
  renderAll();

  // Fica ouvindo a própria conta: se o admin bloquear agora, derruba na hora.
  if (currentUnsub) { currentUnsub(); currentUnsub = null; }
  if (!isAdmin() && user.uid) {
    currentUnsub = db.collection('users').doc(user.uid).onSnapshot(snap => {
      const d = snap.data();
      if (d && d.blocked) {
        toast('🔒 Seu acesso foi bloqueado pela equipe Rocket Ads.');
        if (currentUnsub) { currentUnsub(); currentUnsub = null; }
        auth.signOut().finally(() => location.reload());
      }
    });
  }
}

async function enviarSolicitacao(u) {
  // O código vai no assunto, num campo próprio e no corpo da mensagem,
  // para aparecer no e-mail independente do formato usado pelo FormSubmit.
  const r = await fetch('https://formsubmit.co/ajax/' + ADMIN_EMAIL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      _subject: 'Rocket Gestao - Liberar acesso - CODIGO: ' + u.code,
      _template: 'table',
      codigo_de_liberacao: u.code,
      nome: u.nome,
      empresa: u.empresa || '-',
      email_do_cliente: u.email,
      message: 'NOVA SOLICITACAO DE ACESSO AO ROCKET GESTAO\n\n'
        + 'Cliente: ' + u.nome + '\n'
        + 'Empresa: ' + (u.empresa || '-') + '\n'
        + 'E-mail: ' + u.email + '\n\n'
        + '>>> CODIGO DE LIBERACAO: ' + u.code + ' <<<\n\n'
        + 'Para aprovar, envie o codigo acima ao cliente (WhatsApp ou e-mail). '
        + 'Ele digita o codigo na tela de liberacao do painel e o acesso abre. '
        + 'Para negar, basta nao enviar o codigo.',
    }),
  });
  if (!r.ok) throw new Error('falha no envio');
}

function showPending(user) {
  pendingUser = user;
  showPane('pending');
  $('#unlockCode').value = '';
  $('#unlockMsg').textContent = '';
  $('#pendingMail').href = 'mailto:' + ADMIN_EMAIL
    + '?subject=' + encodeURIComponent('Rocket Gestão — Liberação de acesso')
    + '&body=' + encodeURIComponent(`Olá! Solicito a liberação do meu acesso ao Rocket Gestão.\n\nNome: ${user.nome}\nEmpresa: ${user.empresa || '—'}\nE-mail: ${user.email}`);
}

$('#signupBtn').onclick = async () => {
  const nome = $('#suNome').value.trim();
  const empresa = $('#suEmpresa').value.trim();
  const email = $('#suEmail').value.trim().toLowerCase();
  const pass = $('#suPass').value;
  const msg = $('#signupMsg');
  msg.classList.remove('ok');
  if (!nome || !email || !email.includes('@')) { msg.textContent = 'Preencha seu nome e um e-mail válido.'; return; }
  if (pass.length < 6) { msg.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }

  msg.textContent = 'Criando conta…';
  $('#signupBtn').disabled = true;
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;
    const code = genCode();
    // no banco fica só a impressão digital do código — o código legível vai apenas no e-mail do admin
    const dados = { nome, empresa, email, codeHash: await sha256(code), active: false, blocked: false, criada: new Date().toISOString() };
    await db.collection('users').doc(uid).set(dados);
    const user = { uid, ...dados };
    showPending(user);
    try {
      await enviarSolicitacao({ ...user, code });
      $('#pendingText').innerHTML = 'Sua solicitação foi enviada à equipe <b>Rocket Ads</b>. Assim que for aprovada, você receberá o <b>código de liberação</b> — digite-o abaixo para entrar.';
    } catch (e) {
      $('#pendingText').innerHTML = 'Não foi possível enviar a solicitação automaticamente. Clique em <b>Falar com o suporte</b> abaixo para pedir seu código de liberação.';
    }
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') msg.textContent = 'Já existe uma conta com esse e-mail — use a aba "Entrar".';
    else if (e.code === 'auth/invalid-email') msg.textContent = 'E-mail inválido.';
    else msg.textContent = 'Não foi possível criar a conta agora. Tente novamente.';
  } finally {
    $('#signupBtn').disabled = false;
  }
};

$('#loginBtn').onclick = async () => {
  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPass').value;
  const msg = $('#loginMsg');
  msg.textContent = 'Entrando…';
  $('#loginBtn').disabled = true;
  try {
    const cred = await auth.signInWithEmailAndPassword(email, pass);
    if (email === ADMIN_EMAIL) { await enterApp({ ...adminUser(), uid: cred.user.uid }); return; }
    const snap = await db.collection('users').doc(cred.user.uid).get();
    if (!snap.exists) { msg.textContent = 'Conta não encontrada. Fale com o suporte.'; await auth.signOut(); return; }
    const user = { uid: cred.user.uid, ...snap.data() };
    if (user.blocked) { msg.textContent = 'Acesso suspenso. Fale com a equipe Rocket Ads para regularizar.'; await auth.signOut(); return; }
    if (!user.active) { showPending(user); return; }
    msg.textContent = '';
    enterApp(user);
  } catch (e) {
    msg.textContent = 'E-mail ou senha incorretos.';
  } finally {
    $('#loginBtn').disabled = false;
  }
};

$('#unlockBtn').onclick = async () => {
  const code = $('#unlockCode').value.trim().toUpperCase();
  if (!pendingUser) { showPane('login'); return; }
  const digitada = code ? await sha256(code) : '';
  if (!(digitada && (digitada === pendingUser.codeHash || digitada === MASTER_HASH))) {
    $('#unlockMsg').textContent = 'Código inválido. Confira o código enviado pela equipe Rocket Ads.';
    return;
  }
  $('#unlockBtn').disabled = true;
  try {
    await db.collection('users').doc(pendingUser.uid).update({ active: true });
    const user = { ...pendingUser, active: true };
    enterApp(user);
    toast('Acesso liberado — bem-vindo ao Rocket Gestão! 🚀');
  } catch (e) {
    $('#unlockMsg').textContent = 'Não foi possível liberar agora. Tente novamente em instantes.';
  } finally {
    $('#unlockBtn').disabled = false;
  }
};

[['#loginPass', '#loginBtn'], ['#suPass', '#signupBtn'], ['#unlockCode', '#unlockBtn']].forEach(([i, b]) => {
  $(i).addEventListener('keydown', e => { if (e.key === 'Enter') $(b).click(); });
});

$('#logoutBtn').onclick = () => {
  if (currentUnsub) { currentUnsub(); currentUnsub = null; }
  auth.signOut().finally(() => location.reload());
};

/* ── INIT ──────────────────────────────── */

auth.onAuthStateChanged(async (fbUser) => {
  if (!fbUser) { $('#authScreen').hidden = false; return; }
  if (fbUser.email === ADMIN_EMAIL) { await enterApp({ ...adminUser(), uid: fbUser.uid }); return; }
  try {
    const snap = await db.collection('users').doc(fbUser.uid).get();
    if (!snap.exists) { $('#authScreen').hidden = false; return; }
    const data = snap.data();
    const user = { uid: fbUser.uid, ...data };
    if (data.blocked) {
      await auth.signOut();
      $('#authScreen').hidden = false;
      showPane('login');
      $('#loginMsg').textContent = 'Acesso suspenso. Fale com a equipe Rocket Ads para regularizar.';
      return;
    }
    if (!data.active) { showPending(user); return; }
    enterApp(user);
  } catch (e) {
    $('#authScreen').hidden = false;
  }
});

