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

/* ── BANCO LOCAL (localStorage) ────────── */

const DB_KEY = 'rocket_gestao_db_v1';

function seedDB() {
  return { clients: [], tasks: {}, meetings: {}, convos: {} };
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const db = JSON.parse(raw);
      if (db && Array.isArray(db.clients)) return db;
    }
  } catch (e) { /* armazenamento indisponível */ }
  return seedDB();
}

let DB = loadDB();
function save() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch (e) {}
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
          <span class="badge violet">${esc(c.plan)}</span>
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
    const box = el('div', 'empty', `<span class="e-ico">💬</span>
      <b>Nenhuma conversa espelhada ainda</b>
      Conecte o número do WhatsApp Business deste cliente para espelhar aqui, em tempo real,
      todas as conversas dos vendedores com os leads — com origem do anúncio e funil.<br><br>
      <button class="btn primary small" id="connWa">Conectar WhatsApp Business</button>`);
    root.appendChild(box);
    box.querySelector('#connWa').onclick = () =>
      toast('Solicitação registrada — a conexão usa a API oficial da Meta (Cloud API).');
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

/* ── ADS / INTELIGÊNCIA (aguardando conexão) ── */

function renderConnect(root, opts) {
  const box = el('div', 'empty', `<span class="e-ico">${opts.ico}</span>
    <b>${opts.title}</b>
    ${opts.text}<br><br>
    <button class="btn primary small" id="connBtn">${opts.cta}</button>`);
  box.style.marginTop = '30px';
  root.appendChild(box);
  box.querySelector('#connBtn').onclick = () =>
    toast('Solicitação registrada — a conexão usa a API oficial e é feita pela equipe de implantação.');
}

function renderMeta(root) {
  renderConnect(root, {
    ico: 'Ⓜ', cta: 'Conectar Meta Ads',
    title: 'Conta Meta Ads não conectada',
    text: 'Conecte a conta de anúncios deste cliente para espelhar aqui as campanhas, o investimento, os leads, CPL, CTR e CPM — direto da Meta Marketing API, sem depender de prints.',
  });
}

function renderGoogle(root) {
  renderConnect(root, {
    ico: 'G', cta: 'Conectar Google Ads',
    title: 'Conta Google Ads não conectada',
    text: 'Conecte a conta do Google Ads deste cliente para espelhar campanhas, conversões, CPC e CPA com métricas precisas da Google Ads API.',
  });
}

function renderIntel(root) {
  const hero = el('div', 'intel-hero');
  hero.innerHTML = `
    <h2>✦ Inteligência de Performance</h2>
    <p>A IA cruza os dados do Meta Ads, Google Ads e WhatsApp para separar os melhores anúncios e os
    criativos vencedores — e transforma isso em recomendações práticas para o próximo ciclo.</p>`;
  root.appendChild(hero);
  renderConnect(root, {
    ico: '✦', cta: 'Conectar contas de anúncio',
    title: 'Aguardando dados das contas',
    text: 'Assim que as contas de anúncio e o WhatsApp estiverem conectados, a IA monta o ranking de criativos vencedores, gera insights e sugere os próximos testes.',
  });
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
      ? atrasados.map(c => `<div class="alert-item"><span class="a-ico">💰</span><span><b>${esc(c.name)}</b>: pagamento pendente desde ${fmtVenc(c.venc)} (${brl(PLAN_PRICE[c.plan] || 2000)}). Confirme em Finanças ao receber.</span></div>`).join('')
      : '<div class="alert-item"><span class="a-ico">✅</span><span>Nenhum alerta no momento. Pagamentos em dia aparecem aqui quando vencerem.</span></div>'}`;
  root.appendChild(alerts);

  const tbl = el('div', 'card mt');
  tbl.innerHTML = `
    <h3>Clientes</h3>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Cliente</th><th>Segmento</th><th>Plano</th><th>Status</th><th class="num">Tarefas abertas</th><th class="num">Reuniões</th></tr></thead>
      <tbody>
        ${DB.clients.map(c => `<tr class="row-client" data-id="${c.id}" style="cursor:pointer">
          <td class="name"><span class="status-dot on"></span>${esc(c.name)}</td>
          <td>${esc(c.seg)}</td>
          <td>${esc(c.plan)}</td>
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

const PLAN_PRICE = { 'Plano Start': 1550, 'Plano Growth': 2400, 'Plano Turbo': 4500 };

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
      Cadastre clientes com seus planos e vencimentos — o MRR, os pagamentos pendentes e a lista de contratos aparecem aqui automaticamente.`));
    return;
  }

  const mrr = DB.clients.reduce((s, c) => s + (PLAN_PRICE[c.plan] || 2000), 0);
  const pend = DB.clients.filter(c => payInfo(c).overdue);
  const valorPend = pend.reduce((s, c) => s + (PLAN_PRICE[c.plan] || 2000), 0);

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
      <thead><tr><th>Cliente</th><th>Plano</th><th class="num">Mensalidade</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr></thead>
      <tbody>
        ${DB.clients.map(c => {
          const p = payInfo(c);
          return `<tr>
          <td class="name">${esc(c.name)}</td>
          <td>${esc(c.plan)}</td>
          <td class="num">${brl(PLAN_PRICE[c.plan] || 2000)}</td>
          <td class="${p.overdue ? 'neg' : ''}">${fmtVenc(c.venc)}</td>
          <td><span class="badge ${p.cls}">${p.label}</span></td>
          <td><button class="btn ghost small pay-btn" data-id="${c.id}">✓ Confirmar pagamento</button></td>
        </tr>`; }).join('')}
      </tbody>
    </table></div>`;
  root.appendChild(tbl);
  tbl.querySelectorAll('.pay-btn').forEach(b => b.onclick = () => confirmarPagamento(b.dataset.id));
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

/* ── ROTEADOR DE CONTEÚDO ──────────────── */

function renderContent() {
  const root = $('#content');
  root.innerHTML = '';
  if (state.view === 'overview')  return renderOverview(root);
  if (state.view === 'financas')  return renderFinancas(root);
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
  $('#cSeg').value = client ? client.seg : 'Imobiliário';
  $('#cPlan').value = client ? client.plan : 'Plano Growth';
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
    seg: $('#cSeg').value,
    plan: $('#cPlan').value,
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

const ADMIN_EMAIL = 'rocketadsmkt77@gmail.com'; // recebe as solicitações de liberação
const MASTER_CODE = 'RG-MASTER-7712';           // código mestre — só a equipe Rocket conhece
const USERS_KEY = 'rocket_gestao_users_v1';
const SESSION_KEY = 'rocket_gestao_session_v1';

function loadUsers() { try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch (e) { return []; } }
function saveUsers(u) { try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); } catch (e) {} }
function hashPass(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return (h >>> 0).toString(36); }
function genCode() { return 'RG-' + String(Math.floor(100000 + Math.random() * 900000)); }

let pendingUser = null;

function showPane(p) {
  ['login', 'signup', 'pending'].forEach(x => { $('#pane-' + x).hidden = x !== p; });
  document.querySelectorAll('#authTabs button').forEach(b => b.classList.toggle('active', b.dataset.pane === p));
  $('#authTabs').style.display = p === 'pending' ? 'none' : 'flex';
}
document.querySelectorAll('#authTabs button').forEach(b => b.onclick = () => showPane(b.dataset.pane));

function enterApp(user) {
  try { localStorage.setItem(SESSION_KEY, user.email); } catch (e) {}
  $('#authScreen').hidden = true;
  $('#userName').textContent = user.nome;
  $('#userRole').textContent = user.empresa || 'Administrador';
  $('#userAvatar').textContent = initials(user.nome);
  renderAll();
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
  const users = loadUsers();
  if (users.some(u => u.email === email)) { msg.textContent = 'Já existe uma conta com esse e-mail — use a aba "Entrar".'; return; }

  const user = { nome, empresa, email, pass: hashPass(pass), code: genCode(), active: false, criada: new Date().toISOString() };
  users.push(user);
  saveUsers(users);
  showPending(user);
  try {
    await enviarSolicitacao(user);
    $('#pendingText').innerHTML = 'Sua solicitação foi enviada à equipe <b>Rocket Ads</b>. Assim que for aprovada, você receberá o <b>código de liberação</b> — digite-o abaixo para entrar.';
  } catch (e) {
    $('#pendingText').innerHTML = 'Não foi possível enviar a solicitação automaticamente. Clique em <b>Falar com o suporte</b> abaixo para pedir seu código de liberação.';
  }
};

$('#loginBtn').onclick = () => {
  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPass').value;
  const msg = $('#loginMsg');
  const user = loadUsers().find(u => u.email === email);
  if (!user || user.pass !== hashPass(pass)) { msg.textContent = 'E-mail ou senha incorretos.'; return; }
  if (!user.active) { showPending(user); return; }
  enterApp(user);
};

$('#unlockBtn').onclick = () => {
  const code = $('#unlockCode').value.trim().toUpperCase();
  if (!pendingUser) { showPane('login'); return; }
  if (code && (code === pendingUser.code.toUpperCase() || code === MASTER_CODE.toUpperCase())) {
    const users = loadUsers();
    const u = users.find(x => x.email === pendingUser.email);
    if (u) {
      u.active = true;
      saveUsers(users);
      enterApp(u);
      toast('Acesso liberado — bem-vindo ao Rocket Gestão! 🚀');
    }
  } else {
    $('#unlockMsg').textContent = 'Código inválido. Confira o código enviado pela equipe Rocket Ads.';
  }
};

[['#loginPass', '#loginBtn'], ['#suPass', '#signupBtn'], ['#unlockCode', '#unlockBtn']].forEach(([i, b]) => {
  $(i).addEventListener('keydown', e => { if (e.key === 'Enter') $(b).click(); });
});

$('#logoutBtn').onclick = () => {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  location.reload();
};

/* ── INIT ──────────────────────────────── */

(function initAuth() {
  let sessionEmail = null;
  try { sessionEmail = localStorage.getItem(SESSION_KEY); } catch (e) {}
  const user = sessionEmail ? loadUsers().find(u => u.email === sessionEmail && u.active) : null;
  if (user) enterApp(user);
  else $('#authScreen').hidden = false;
})();
