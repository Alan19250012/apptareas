/* ============================================================
   Hábitat · Rastreador de Hábitos — Lógica de la aplicación
   Vanilla JS + localStorage. Funciona offline (PWA).
   ============================================================ */
'use strict';

/* ---------- Constantes ---------- */
const LS_KEY = 'habitat.state.v1';
const XP_PER_DONE = 10;
const HABIT_COLORS = ['#7c6cf0', '#4da3ff', '#2fd07a', '#f6b93b', '#ff7a59',
  '#ff5d9e', '#22c1c3', '#a06cf0', '#8bc34a', '#ff5d6c'];
const HABIT_EMOJIS = ['✅', '💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '✍️', '🎯',
  '🎸', '🧠', '🚭', '💊', '🌅', '📵', '💻', '🧹'];
const EVENT_COLORS = ['#7c6cf0', '#4da3ff', '#2fd07a', '#f6b93b', '#ff7a59', '#ff5d9e', '#22c1c3'];

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_SHORT_SUN = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/* ---------- Estado ---------- */
let state = null;
let calYear, calMonth;

function defaultState() {
  return {
    version: 1,
    settings: { theme: 'dark', userName: '', weekStartsMonday: true, xpEnabled: true },
    habits: [],
    completions: {},   // { 'YYYY-MM-DD': [habitId, ...] }
    events: [],        // { id, date, time, title, note, color }
    xp: { total: 0, log: {} } // log: { 'YYYY-MM-DD': xp }
  };
}

function uid() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Utilidades de fecha (hora local) ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function toKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function fromKey(key) { const p = key.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function todayKey() { return toKey(new Date()); }
function isSameDay(a, b) { return toKey(a) === toKey(b); }

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- Persistencia ---------- */
let storageOk = true;
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = Object.assign(defaultState(), parsed);
      state.settings = Object.assign(defaultState().settings, parsed.settings || {});
      return;
    }
  } catch (e) {
    storageOk = false;
    console.warn('localStorage no disponible', e);
  }
  state = defaultState();
}

function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) {
    if (storageOk) { storageOk = false; toast('⚠️ No se pudo guardar (almacenamiento no disponible)'); }
  }
}

/* ---------- Acceso a hábitos / completions ---------- */
function activeHabits() { return state.habits.filter(h => !h.archived); }
function habitById(id) { return state.habits.find(h => h.id === id); }
function getDone(dateKey) { return state.completions[dateKey] || []; }
function isDone(dateKey, habitId) { return getDone(dateKey).includes(habitId); }
function habitKeys(habitId) {
  const set = new Set();
  for (const date in state.completions) if (state.completions[date].includes(habitId)) set.add(date);
  return set;
}

/* ---------- Rachas ---------- */
function currentStreak(keys) {
  let streak = 0;
  let d = new Date();
  if (!keys.has(toKey(d))) d = addDays(d, -1); // gracia: hoy aún sin registrar no rompe la racha
  while (keys.has(toKey(d))) { streak++; d = addDays(d, -1); }
  return streak;
}
function bestStreak(keys) {
  if (!keys.size) return 0;
  const sorted = [...keys].sort();
  let best = 1, run = 1, prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const diff = Math.round((fromKey(cur) - fromKey(prev)) / 86400000);
    run = (diff === 1) ? run + 1 : 1;
    if (run > best) best = run;
    prev = cur;
  }
  return best;
}

/* ---------- XP / nivel ---------- */
function levelInfo(total) {
  let level = 1, need = 100, rem = total;
  while (rem >= need) { rem -= need; level++; need += 100; }
  return { level, xpInLevel: rem, xpNeeded: need, progress: Math.min(1, rem / need) };
}
function rankName(level) {
  if (level >= 20) return 'Leyenda';
  if (level >= 15) return 'Maestro';
  if (level >= 10) return 'Experto';
  if (level >= 6) return 'Habitual';
  if (level >= 3) return 'Constante';
  return 'Principiante';
}

/* ---------- Toast ---------- */
function toast(msg) {
  const root = document.getElementById('toast-root');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 300ms'; }, 2400);
  setTimeout(() => t.remove(), 2800);
}

/* ---------- Navegación ---------- */
let currentView = 'dashboard';
let openDayKey = null;
function switchView(name) {
  currentView = name;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('is-active', v.id === 'view-' + name));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === name));
  render();
}

/* ---------- Render principal ---------- */
function render() {
  renderHeader();
  const views = {
    dashboard: viewDashboard,
    calendar: viewCalendar,
    agenda: viewAgenda,
    habits: viewHabits,
    stats: viewStats,
    settings: viewSettings
  };
  (views[currentView] || viewDashboard)();
}

function renderHeader() {
  const li = levelInfo(state.xp.total);
  document.getElementById('level-label').textContent = 'Nv. ' + li.level;
  document.getElementById('xp-fill').style.width = (li.progress * 100) + '%';
  document.getElementById('btn-level').title = `${li.xpInLevel} / ${li.xpNeeded} XP · Rango: ${rankName(li.level)}`;
}

/* ============================================================
   VISTA: PROGRESO (Dashboard)
   ============================================================ */
function viewDashboard() {
  const el = document.getElementById('view-dashboard');
  const habits = activeHabits();
  const today = todayKey();
  const doneToday = getDone(today);
  const pct = habits.length ? Math.round(doneToday.length / habits.length * 100) : 0;

  const currents = habits.map(h => currentStreak(habitKeys(h.id)));
  const bests = habits.map(h => bestStreak(habitKeys(h.id)));
  const rachaActual = currents.length ? Math.max(...currents) : 0;
  const rachaRecord = bests.length ? Math.max(...bests) : 0;
  const li = levelInfo(state.xp.total);

  const name = state.settings.userName ? esc(state.settings.userName) : '';
  const greeting = name ? `¡Hola, ${name}!` : '¡Hola!';
  const dateLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const habitChecklist = habits.map(h => {
    const done = isDone(today, h.id);
    return `
      <div class="habit-row">
        <span class="habit-emoji" style="background:${h.color}22;color:${h.color}">${esc(h.emoji)}</span>
        <div class="habit-info">
          <div class="habit-name">${esc(h.name)}</div>
          <div class="habit-meta">${habitMeta(h)}</div>
        </div>
        <button class="check-toggle ${done ? 'done' : ''}" data-action="toggle-habit" data-id="${h.id}" data-date="${today}"
          aria-label="${done ? 'Desmarcar' : 'Marcar'} ${esc(h.name)}" title="${done ? 'Hecho' : 'Pendiente'}">✓</button>
      </div>`;
  }).join('');

  const rachaRows = [...habits].sort((a, b) => currentStreak(habitKeys(b.id)) - currentStreak(habitKeys(a.id)))
    .slice(0, 6).map(h => {
      const s = currentStreak(habitKeys(h.id));
      const max = rachaActual || 1;
      return `
        <div class="progress-row">
          <div class="pr-top">
            <span class="pr-label">${esc(h.emoji)} ${esc(h.name)}</span>
            <span class="pr-val">${s} día${s === 1 ? '' : 's'}</span>
          </div>
          <div class="bar"><span style="width:${Math.round(s / max * 100)}%;background:${h.color}"></span></div>
        </div>`;
    }).join('');

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">${greeting}</h1>
        <p class="view-subtitle" style="text-transform:capitalize">${dateLabel} · Panel de progreso</p>
      </div>
    </div>

    <div class="grid grid-4 mt-8">
      <div class="card stat accent">
        <span class="stat-ico">✅</span>
        <span class="stat-value">${doneToday.length}<span class="faint" style="font-size:16px">/${habits.length}</span></span>
        <span class="stat-label">Hábitos de hoy</span>
      </div>
      <div class="card stat green">
        <span class="stat-ico">🔥</span>
        <span class="stat-value">${rachaActual}</span>
        <span class="stat-label">Racha actual</span>
        <span class="stat-extra">mejor hábito</span>
      </div>
      <div class="card stat amber">
        <span class="stat-ico">🏆</span>
        <span class="stat-value">${rachaRecord}</span>
        <span class="stat-label">Racha récord</span>
        <span class="stat-extra">mejor histórica</span>
      </div>
      <div class="card stat red">
        <span class="stat-ico">⭐</span>
        <span class="stat-value">${state.xp.total} <span class="faint" style="font-size:14px">XP</span></span>
        <span class="stat-label">Nv. ${li.level} · ${rankName(li.level)}</span>
      </div>
    </div>

    <div class="grid grid-2 mt-16">
      <div class="card">
        <div class="card-title">🎯 Hoy · ${pct}% completado</div>
        ${habits.length ? habitChecklist : emptyState('🌱', 'No tienes hábitos aún. Crea tu primer hábito para empezar a construir rachas.', 'add-habit', '➕ Nuevo hábito')}
      </div>
      <div class="card">
        <div class="card-title">🔥 Rachas activas <span class="hint">días seguidos</span></div>
        ${rachaRows || '<p class="muted">Sin rachas todavía.</p>'}
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-title">📊 Últimos 7 días <span class="hint">% de hábitos completados por día</span></div>
      ${weekBars()}
    </div>
  `;
}

function emptyState(ico, text, action, actionLabel) {
  return `
    <div class="empty">
      <div class="empty-ico">${ico || '🌱'}</div>
      <p>${text}</p>
      ${action ? `<button class="btn btn-primary mt-8" data-action="${action}">${actionLabel}</button>` : ''}
    </div>`;
}

function habitMeta(h) {
  const parts = [];
  parts.push(h.targetDays === 7 ? 'Cada día' : (h.targetDays === 5 ? 'Entre semana' : h.targetDays + ' días/sem'));
  const s = currentStreak(habitKeys(h.id));
  if (s) parts.push('🔥 ' + s);
  return parts.join(' · ');
}

function weekBars() {
  const habits = activeHabits();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(new Date(), -i);
    const k = toKey(d);
    const done = getDone(k).length;
    const pct = habits.length ? Math.round(done / habits.length * 100) : 0;
    days.push({ k, d, done, pct });
  }
  const max = 100;
  const today = todayKey();
  return `
    <div style="display:flex;gap:10px;align-items:flex-end;height:150px;padding-top:6px">
      ${days.map(x => {
        const isToday = x.k === today;
        const label = new Date(x.d).toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
        return `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%">
            <span style="font-size:11px;font-weight:700;color:${isToday ? 'var(--accent)' : 'var(--text-muted)'}">${x.pct}%</span>
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div style="width:100%;border-radius:8px;background:${x.pct ? 'linear-gradient(180deg,var(--accent),#a06cf0)' : 'var(--surface-3)'};height:${Math.max(4, x.pct)}%"
                   title="${x.k}: ${x.done}/${habits.length} hábitos"></div>
            </div>
            <span style="font-size:11px;font-weight:${isToday ? 800 : 500};color:${isToday ? 'var(--accent)' : 'var(--text-muted)'}">${label}</span>
          </div>`;
      }).join('')}
    </div>`;
}

/* ============================================================
   VISTA: CALENDARIO
   ============================================================ */
function viewCalendar() {
  const el = document.getElementById('view-calendar');
  if (!calYear) { const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); }

  const startMonday = state.settings.weekStartsMonday;
  const weekLabels = startMonday ? WEEKDAYS_SHORT : WEEKDAYS_SHORT_SUN;
  const first = new Date(calYear, calMonth, 1);
  const offset = startMonday ? (first.getDay() + 6) % 7 : first.getDay();
  const start = addDays(first, -offset);
  const today = todayKey();

  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const k = toKey(d);
    const inMonth = d.getMonth() === calMonth;
    const done = getDone(k);
    const dayEvents = state.events.filter(e => e.date === k);
    const dots = done.map(id => {
      const h = habitById(id);
      return h ? `<span class="day-dot on" style="background:${h.color}" title="${esc(h.name)}"></span>` : '';
    }).join('');
    const cls = ['day-cell', inMonth ? '' : 'other-month', k === today ? 'today' : ''].join(' ').trim();
    cells += `
      <div class="${cls}" data-action="open-day" data-date="${k}" role="button" tabindex="0">
        ${dayEvents.length ? `<span class="day-event-badge" title="${dayEvents.length} evento(s)">📌</span>` : ''}
        <span class="day-num">${d.getDate()}</span>
        <div class="day-dots">${dots}</div>
        ${done.length ? `<span class="day-count">${done.length}</span>` : ''}
      </div>`;
  }

  // Leyenda de colores
  const legend = activeHabits().slice(0, 12).map(h =>
    `<span class="row" style="gap:5px;font-size:12px;color:var(--text-muted)"><span style="width:9px;height:9px;border-radius:50%;background:${h.color};display:inline-block"></span>${esc(h.name)}</span>`
  ).join('');

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">📅 Calendario</h1>
        <p class="view-subtitle">Toca un día para ver y marcar tus hábitos.</p>
      </div>
    </div>
    <div class="cal-toolbar">
      <button class="cal-nav" data-action="cal-prev" aria-label="Mes anterior">‹</button>
      <div class="month-label">${MONTHS[calMonth]} ${calYear}</div>
      <button class="cal-nav" data-action="cal-next" aria-label="Mes siguiente">›</button>
      <button class="btn btn-sm" data-action="cal-today">Hoy</button>
    </div>
    <div class="calendar weekdays">${weekLabels.map(w => `<div>${w}</div>`).join('')}</div>
    <div class="calendar days">${cells}</div>
    ${legend ? `<div class="card mt-16"><div class="card-title">Leyenda</div><div class="row" style="gap:14px">${legend}</div></div>` : ''}
  `;
}

/* ---------- Modal: detalle de día ---------- */
function openDayModal(dateKey) {
  openDayKey = dateKey;
  const d = fromKey(dateKey);
  const habits = activeHabits();
  const done = getDone(dateKey);
  const dayEvents = state.events.filter(e => e.date === dateKey).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const list = habits.map(h => {
    const on = isDone(dateKey, h.id);
    return `
      <div class="habit-row">
        <span class="habit-emoji" style="background:${h.color}22;color:${h.color}">${esc(h.emoji)}</span>
        <div class="habit-info"><div class="habit-name">${esc(h.name)}</div></div>
        <button class="check-toggle ${on ? 'done' : ''}" data-action="toggle-habit" data-id="${h.id}" data-date="${dateKey}">✓</button>
      </div>`;
  }).join('');

  const evList = dayEvents.map(e => `
    <div class="event-row" style="border-left-color:${e.color}">
      <div class="event-time"><span class="e-hr">${esc(e.time || '--:--')}</span></div>
      <div class="event-body">
        <div class="event-title">${esc(e.title)}</div>
        ${e.note ? `<div class="event-note">${esc(e.note)}</div>` : ''}
      </div>
      <div class="habit-actions">
        <button class="btn btn-sm" data-action="edit-event" data-id="${e.id}">✏️</button>
        <button class="btn btn-sm btn-danger" data-action="delete-event" data-id="${e.id}">🗑</button>
      </div>
    </div>`).join('');

  const title = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  openModal(`
    <div class="modal-head">
      <h3 class="modal-title" style="text-transform:capitalize">${title}</h3>
      <button class="modal-close" data-action="close-modal">✕</button>
    </div>
    ${habits.length ? list : '<p class="muted">No hay hábitos activos.</p>'}
    <div class="mt-16 card-title">📌 Eventos del día</div>
    ${evList || '<p class="muted">Sin eventos.</p>'}
    <div class="modal-actions">
      <button class="btn btn-primary" data-action="add-event" data-date="${dateKey}">➕ Agregar evento</button>
    </div>
  `);
}

/* ============================================================
   VISTA: AGENDA
   ============================================================ */
function viewAgenda() {
  const el = document.getElementById('view-agenda');
  const events = [...state.events].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const today = todayKey();

  let grouped = '';
  let lastDate = null;
  events.forEach(e => {
    const d = fromKey(e.date);
    const dayLabel = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const isToday = e.date === today;
    if (e.date !== lastDate) {
      grouped += `<div class="card-title mt-16" style="text-transform:capitalize">${dayLabel} ${isToday ? '· Hoy' : ''}</div>`;
      lastDate = e.date;
    }
    grouped += `
      <div class="event-row" style="border-left-color:${e.color}">
        <div class="event-time">
          <span class="e-day">${d.getDate()}</span>
          <span class="e-mon">${MONTHS[d.getMonth()].slice(0, 3)}</span>
          <span class="e-hr">${esc(e.time || '--:--')}</span>
        </div>
        <div class="event-body">
          <div class="event-title">${esc(e.title)}</div>
          ${e.note ? `<div class="event-note">${esc(e.note)}</div>` : ''}
        </div>
        <div class="habit-actions">
          <button class="btn btn-sm" data-action="edit-event" data-id="${e.id}">✏️</button>
          <button class="btn btn-sm btn-danger" data-action="delete-event" data-id="${e.id}">🗑</button>
        </div>
      </div>`;
  });

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">🗓️ Agenda</h1>
        <p class="view-subtitle">Tus eventos y citas, junto al calendario de hábitos.</p>
      </div>
      <button class="btn btn-primary" data-action="add-event">➕ Nuevo evento</button>
    </div>
    <div class="event-list">${grouped || emptyState('📅', 'No hay eventos programados.', 'add-event', '➕ Agregar evento')}</div>
  `;
}

/* ============================================================
   VISTA: HÁBITOS
   ============================================================ */
function viewHabits() {
  const el = document.getElementById('view-habits');
  const active = activeHabits();
  const archived = state.habits.filter(h => h.archived);

  const row = h => {
    const s = currentStreak(habitKeys(h.id));
    return `
      <div class="habit-row">
        <span class="habit-emoji" style="background:${h.color}22;color:${h.color}">${esc(h.emoji)}</span>
        <div class="habit-info">
          <div class="habit-name">${esc(h.name)}</div>
          <div class="habit-meta">${habitMeta(h)}</div>
        </div>
        <div class="habit-actions">
          <button class="btn btn-sm" data-action="edit-habit" data-id="${h.id}">✏️</button>
          <button class="btn btn-sm" data-action="archive-habit" data-id="${h.id}">${h.archived ? '↩️' : '📦'}</button>
          <button class="btn btn-sm btn-danger" data-action="delete-habit" data-id="${h.id}">🗑</button>
        </div>
      </div>`;
  };

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">✅ Hábitos</h1>
        <p class="view-subtitle">Gestiona tus hábitos, objetivos semanales y rachas.</p>
      </div>
      <button class="btn btn-primary" data-action="add-habit">➕ Nuevo hábito</button>
    </div>
    <div class="habit-list">${active.map(row).join('') || emptyState('🌱', 'Aún no tienes hábitos. ¡Empieza por uno pequeño!', 'add-habit', '➕ Nuevo hábito')}</div>
    ${archived.length ? `<div class="card-title mt-24">Archivados</div><div class="habit-list">${archived.map(row).join('')}</div>` : ''}
  `;
}

/* ============================================================
   VISTA: ESTADÍSTICAS
   ============================================================ */
function viewStats() {
  const el = document.getElementById('view-stats');
  const habits = activeHabits();
  const today = todayKey();

  // Porcentaje últimos 30 días por hábito
  const thirty = habits.map(h => {
    const keys = habitKeys(h.id);
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const k = toKey(addDays(new Date(), -i));
      if (keys.has(k)) count++;
    }
    return { h, count, pct: Math.round(count / 30 * 100) };
  }).sort((a, b) => b.pct - a.pct);

  const bars = thirty.map(t => `
    <div class="progress-row">
      <div class="pr-top">
        <span class="pr-label">${esc(t.h.emoji)} ${esc(t.h.name)}</span>
        <span class="pr-val">${t.pct}% (${t.count}/30)</span>
      </div>
      <div class="bar"><span style="width:${t.pct}%;background:${t.h.color}"></span></div>
    </div>`).join('');

  // Totales
  const totalCompletions = Object.values(state.completions).reduce((a, l) => a + l.length, 0);
  const activeDays = Object.keys(state.completions).length;
  const firstKey = activeDays ? Object.keys(state.completions).sort()[0] : today;
  const spanDays = Math.max(1, Math.round((fromKey(today) - fromKey(firstKey)) / 86400000) + 1);
  const avgPerDay = (totalCompletions / spanDays).toFixed(1);

  // Récords
  const bests = habits.map(h => ({ h, best: bestStreak(habitKeys(h.id)), cur: currentStreak(habitKeys(h.id)) }))
    .sort((a, b) => b.best - a.best).slice(0, 8);
  const bestTable = bests.map(b => `
    <div class="habit-row">
      <span class="habit-emoji" style="background:${b.h.color}22;color:${b.h.color}">${esc(b.h.emoji)}</span>
      <div class="habit-info"><div class="habit-name">${esc(b.h.name)}</div></div>
      <span class="chip">🔥 ${b.cur}</span>
      <span class="chip">🏆 ${b.best}</span>
    </div>`).join('');

  // Heatmap últimos ~ 17 semanas (119 días)
  const heat = heatmap(119);

  el.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">📈 Estadísticas</h1>
        <p class="view-subtitle">Tendencias y consistencia de tus hábitos.</p>
      </div>
    </div>

    <div class="grid grid-4">
      <div class="card stat accent"><span class="stat-ico">✔️</span><span class="stat-value">${totalCompletions}</span><span class="stat-label">Completados totales</span></div>
      <div class="card stat green"><span class="stat-ico">📆</span><span class="stat-value">${activeDays}</span><span class="stat-label">Días activos</span></div>
      <div class="card stat amber"><span class="stat-ico">⚡</span><span class="stat-value">${avgPerDay}</span><span class="stat-label">Promedio / día</span></div>
      <div class="card stat red"><span class="stat-ico">🎯</span><span class="stat-value">${habits.length}</span><span class="stat-label">Hábitos activos</span></div>
    </div>

    <div class="grid grid-2 mt-16">
      <div class="card">
        <div class="card-title">📊 Consistencia <span class="hint">últimos 30 días</span></div>
        ${bars || '<p class="muted">Sin datos.</p>'}
      </div>
      <div class="card">
        <div class="card-title">🏆 Mejores rachas</div>
        ${bestTable || '<p class="muted">Sin rachas todavía.</p>'}
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-title">🗓️ Mapa de actividad <span class="hint">% diario de hábitos completados</span></div>
      ${heat}
      <div class="heat-legend">
        Menos
        <span class="sw" style="background:var(--surface-3)"></span>
        <span class="sw" style="background:color-mix(in srgb, var(--accent) 35%, var(--surface-3))"></span>
        <span class="sw" style="background:color-mix(in srgb, var(--accent) 65%, var(--surface-3))"></span>
        <span class="sw" style="background:var(--accent)"></span>
        Más
      </div>
    </div>
  `;
}

function heatmap(days) {
  const habits = activeHabits();
  let cells = '';
  for (let i = days - 1; i >= 0; i--) {
    const k = toKey(addDays(new Date(), -i));
    const done = getDone(k).length;
    const pct = habits.length ? done / habits.length : 0;
    const bg = pct === 0 ? 'var(--surface-3)'
      : `color-mix(in srgb, var(--accent) ${Math.round(35 + pct * 65)}%, var(--surface-3))`;
    const label = `${k} · ${done}/${habits.length} hábitos`;
    cells += `<span class="heat-cell" style="background:${bg}" title="${label}"></span>`;
  }
  return `<div class="heatmap">${cells}</div>`;
}

/* ============================================================
   VISTA: AJUSTES
   ============================================================ */
function viewSettings() {
  const el = document.getElementById('view-settings');
  const s = state.settings;
  el.innerHTML = `
    <div class="view-head">
      <div>
        <h1 class="view-title">⚙️ Ajustes</h1>
        <p class="view-subtitle">Personalización, datos y copias de seguridad.</p>
      </div>
    </div>

    <div class="card">
      <div class="card-title">🎨 Apariencia</div>
      <div class="row">
        <button class="btn ${s.theme === 'dark' ? 'btn-primary' : ''}" data-action="set-theme" data-theme="dark">🌙 Oscuro</button>
        <button class="btn ${s.theme === 'light' ? 'btn-primary' : ''}" data-action="set-theme" data-theme="light">☀️ Claro</button>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-title">👤 Perfil</div>
      <div class="field">
        <label for="set-name">Tu nombre</label>
        <input id="set-name" type="text" value="${esc(s.userName)}" placeholder="Ej. Ana" />
      </div>
      <div class="field">
        <label for="set-week">La semana empieza en</label>
        <select id="set-week">
          <option value="1" ${s.weekStartsMonday ? 'selected' : ''}>Lunes</option>
          <option value="0" ${!s.weekStartsMonday ? 'selected' : ''}>Domingo</option>
        </select>
      </div>
      <label class="row" style="gap:8px;font-size:14px;cursor:pointer">
        <input id="set-xp" type="checkbox" ${s.xpEnabled ? 'checked' : ''} /> Activar gamificación (XP y niveles)
      </label>
    </div>

    <div class="card mt-16">
      <div class="card-title">💾 Datos</div>
      <div class="row">
        <button class="btn" data-action="export-json">⬇️ Respaldar (JSON)</button>
        <button class="btn" data-action="import-json">⬆️ Importar (JSON)</button>
        <button class="btn" data-action="export-csv">📊 Exportar CSV</button>
        <input type="file" id="import-file" accept="application/json" class="hidden" />
      </div>
      <p class="faint mt-8" style="font-size:12px">El JSON respalda todo (hábitos, historial, eventos y XP). El CSV exporta tus registros para abrirlos en Excel o Google Sheets.</p>
    </div>

    <div class="card mt-16">
      <div class="card-title">🧪 Empezar de nuevo</div>
      <div class="row between">
        <p class="muted" style="font-size:13px">Cargar datos de ejemplo o borrar todo.</p>
        <div class="row">
          <button class="btn" data-action="seed-demo">🌱 Ejemplo</button>
          <button class="btn btn-danger" data-action="reset-all">🗑 Borrar todo</button>
        </div>
      </div>
    </div>

    <div class="card mt-16">
      <div class="card-title">📱 Instalar como app</div>
      <p class="muted" style="font-size:13.5px">En tu móvil abre esta página en Chrome/Safari → menú → <strong>«Añadir a pantalla de inicio»</strong>. Funciona sin conexión y guarda todo en tu dispositivo.</p>
    </div>
  `;
}

/* ============================================================
   MODALES genéricos
   ============================================================ */
function openModal(innerHTML) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal">${innerHTML}</div></div>`;
  root.querySelector('.modal-backdrop').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
}
function closeModal() { openDayKey = null; document.getElementById('modal-root').innerHTML = ''; }

function confirmDialog(message, onConfirm) {
  openModal(`
    <div class="modal-head">
      <h3 class="modal-title">⚠️ Confirmar</h3>
      <button class="modal-close" data-action="close-modal">✕</button>
    </div>
    <p style="margin:0">${esc(message)}</p>
    <div class="modal-actions">
      <button class="btn" data-action="close-modal">Cancelar</button>
      <button class="btn btn-danger" id="confirm-yes">Sí, continuar</button>
    </div>
  `);
  document.getElementById('confirm-yes').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

/* ---------- Modal: hábito ---------- */
function openHabitModal(habitId) {
  const h = habitId ? habitById(habitId) : null;
  const editing = !!h;
  const name = h ? h.name : '';
  const emoji = h ? h.emoji : HABIT_EMOJIS[0];
  const color = h ? h.color : HABIT_COLORS[0];
  const target = h ? h.targetDays : 7;

  const emojiOpts = HABIT_EMOJIS.map(e => `<button type="button" class="emoji-opt ${e === emoji ? 'selected' : ''}" data-emoji="${e}">${e}</button>`).join('');
  const swatches = HABIT_COLORS.map(c => `<button type="button" class="swatch ${c === color ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');

  openModal(`
    <div class="modal-head">
      <h3 class="modal-title">${editing ? '✏️ Editar hábito' : '➕ Nuevo hábito'}</h3>
      <button class="modal-close" data-action="close-modal">✕</button>
    </div>
    <form id="habit-form">
      <div class="field">
        <label for="h-name">Nombre</label>
        <input id="h-name" type="text" required maxlength="40" placeholder="Ej. Beber agua" value="${esc(name)}" />
      </div>
      <div class="field">
        <label>Icono</label>
        <div class="emoji-picker" id="emoji-picker">${emojiOpts}</div>
      </div>
      <div class="field">
        <label>Color</label>
        <div class="color-swatches" id="color-swatches">${swatches}</div>
      </div>
      <div class="field">
        <label for="h-target">Frecuencia objetivo</label>
        <select id="h-target">
          <option value="7" ${target === 7 ? 'selected' : ''}>Cada día</option>
          <option value="5" ${target === 5 ? 'selected' : ''}>Entre semana (5 días)</option>
          <option value="6" ${target === 6 ? 'selected' : ''}>6 días / semana</option>
          <option value="4" ${target === 4 ? 'selected' : ''}>4 días / semana</option>
          <option value="3" ${target === 3 ? 'selected' : ''}>3 días / semana</option>
          <option value="2" ${target === 2 ? 'selected' : ''}>2 días / semana</option>
          <option value="1" ${target === 1 ? 'selected' : ''}>1 día / semana</option>
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn btn-primary">${editing ? 'Guardar' : 'Crear hábito'}</button>
      </div>
    </form>
  `);

  let selEmoji = emoji, selColor = color;
  const ep = document.getElementById('emoji-picker');
  const cs = document.getElementById('color-swatches');
  ep.addEventListener('click', e => {
    const b = e.target.closest('[data-emoji]'); if (!b) return;
    selEmoji = b.dataset.emoji;
    ep.querySelectorAll('.emoji-opt').forEach(x => x.classList.toggle('selected', x === b));
  });
  cs.addEventListener('click', e => {
    const b = e.target.closest('[data-color]'); if (!b) return;
    selColor = b.dataset.color;
    cs.querySelectorAll('.swatch').forEach(x => x.classList.toggle('selected', x === b));
  });

  document.getElementById('habit-form').addEventListener('submit', e => {
    e.preventDefault();
    const nameVal = document.getElementById('h-name').value.trim();
    const targetVal = parseInt(document.getElementById('h-target').value, 10);
    if (!nameVal) return;
    if (editing) {
      h.name = nameVal; h.emoji = selEmoji; h.color = selColor; h.targetDays = targetVal;
    } else {
      state.habits.push({ id: uid(), name: nameVal, emoji: selEmoji, color: selColor, targetDays: targetVal, createdAt: todayKey(), archived: false });
    }
    save(); closeModal(); render(); toast(editing ? 'Hábito actualizado' : '¡Hábito creado! 🎉');
  });
}

/* ---------- Modal: evento ---------- */
function openEventModal(eventId, presetDate) {
  const e = eventId ? state.events.find(x => x.id === eventId) : null;
  const editing = !!e;
  const date = e ? e.date : (presetDate || todayKey());
  const time = e ? e.time : '09:00';
  const color = e ? e.color : EVENT_COLORS[0];
  const swatches = EVENT_COLORS.map(c => `<button type="button" class="swatch ${c === color ? 'selected' : ''}" data-color="${c}" style="background:${c}"></button>`).join('');

  openModal(`
    <div class="modal-head">
      <h3 class="modal-title">${editing ? '✏️ Editar evento' : '➕ Nuevo evento'}</h3>
      <button class="modal-close" data-action="close-modal">✕</button>
    </div>
    <form id="event-form">
      <div class="field">
        <label for="e-title">Título</label>
        <input id="e-title" type="text" required maxlength="60" placeholder="Ej. Reunión / cita / recordatorio" value="${esc(e ? e.title : '')}" />
      </div>
      <div class="field-row">
        <div class="field">
          <label for="e-date">Fecha</label>
          <input id="e-date" type="date" required value="${date}" />
        </div>
        <div class="field">
          <label for="e-time">Hora</label>
          <input id="e-time" type="time" value="${time}" />
        </div>
      </div>
      <div class="field">
        <label for="e-note">Nota (opcional)</label>
        <textarea id="e-note" placeholder="Detalles...">${esc(e ? e.note : '')}</textarea>
      </div>
      <div class="field">
        <label>Color</label>
        <div class="color-swatches" id="event-colors">${swatches}</div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" data-action="close-modal">Cancelar</button>
        <button type="submit" class="btn btn-primary">${editing ? 'Guardar' : 'Crear evento'}</button>
      </div>
    </form>
  `);

  let selColor = color;
  document.getElementById('event-colors').addEventListener('click', ev => {
    const b = ev.target.closest('[data-color]'); if (!b) return;
    selColor = b.dataset.color;
    document.querySelectorAll('#event-colors .swatch').forEach(x => x.classList.toggle('selected', x === b));
  });

  document.getElementById('event-form').addEventListener('submit', ev => {
    ev.preventDefault();
    const title = document.getElementById('e-title').value.trim();
    const d = document.getElementById('e-date').value;
    const t = document.getElementById('e-time').value;
    const note = document.getElementById('e-note').value.trim();
    if (!title || !d) return;
    if (editing) {
      Object.assign(e, { title, date: d, time: t, note, color: selColor });
    } else {
      state.events.push({ id: uid(), title, date: d, time: t, note, color: selColor });
    }
    save(); render();
    const dayKey = openDayKey;
    closeModal();
    if (dayKey) openDayModal(dayKey);
    toast(editing ? 'Evento actualizado' : 'Evento creado');
  });
}

/* ============================================================
   ACCIONES (event delegation)
   ============================================================ */
function toggleHabit(id, dateKey) {
  const h = habitById(id);
  const list = state.completions[dateKey] || [];
  const idx = list.indexOf(id);
  if (idx >= 0) {
    list.splice(idx, 1);
    addXp(-XP_PER_DONE, dateKey);
    toast('Hábito desmarcado');
  } else {
    list.push(id);
    addXp(XP_PER_DONE, dateKey);
    if (h && dateKey === todayKey()) toast(`¡${h.name} hecho! +${XP_PER_DONE} XP ⭐`);
  }
  if (list.length) state.completions[dateKey] = list; else delete state.completions[dateKey];
  save(); render();
  if (openDayKey) openDayModal(openDayKey);
}

function addXp(delta, dateKey) {
  if (!state.settings.xpEnabled) return;
  state.xp.total = Math.max(0, state.xp.total + delta);
  state.xp.log[dateKey] = Math.max(0, (state.xp.log[dateKey] || 0) + delta);
  if (!state.xp.log[dateKey]) delete state.xp.log[dateKey];
}

function deleteHabit(id) {
  const h = habitById(id);
  if (!h) return;
  confirmDialog(`¿Eliminar "${h.name}" y todo su historial?`, () => {
    state.habits = state.habits.filter(x => x.id !== id);
    for (const d in state.completions) {
      state.completions[d] = state.completions[d].filter(x => x !== id);
      if (!state.completions[d].length) delete state.completions[d];
    }
    save(); render(); toast('Hábito eliminado');
  });
}

function deleteEvent(id) {
  confirmDialog('¿Eliminar este evento?', () => {
    state.events = state.events.filter(x => x.id !== id);
    save(); render(); toast('Evento eliminado');
  });
}

/* ---------- Export / import ---------- */
function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function exportJSON() {
  download('habitat-respaldo.json', JSON.stringify(state, null, 2), 'application/json');
  toast('Respaldo JSON descargado');
}

function exportCSV() {
  const habits = state.habits;
  const dates = Object.keys(state.completions).sort();
  if (!dates.length) { toast('No hay datos que exportar'); return; }
  const lines = ['Fecha,Hábito,Completado,XP'];
  dates.forEach(d => {
    habits.forEach(h => {
      const done = isDone(d, h.id);
      if (done) {
        const xp = Math.round(XP_PER_DONE);
        lines.push(`${d},"${h.name.replace(/"/g, '""')}",Sí,${xp}`);
      }
    });
  });
  download('habitat-registros.csv', '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV exportado');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = Object.assign(defaultState(), parsed);
      state.settings = Object.assign(defaultState().settings, parsed.settings || {});
      save(); applyTheme(); render();
      toast('Datos importados correctamente ✅');
    } catch (e) { toast('Archivo no válido'); }
  };
  reader.readAsText(file);
}

/* ---------- Datos de ejemplo ---------- */
function seedDemo() {
  const today = new Date();
  const defs = [
    { name: 'Beber agua', emoji: '💧', color: HABIT_COLORS[1], targetDays: 7 },
    { name: 'Leer 20 min', emoji: '📚', color: HABIT_COLORS[0], targetDays: 5 },
    { name: 'Ejercicio', emoji: '💪', color: HABIT_COLORS[2], targetDays: 3 },
    { name: 'Meditar', emoji: '🧘', color: HABIT_COLORS[7], targetDays: 7 }
  ];
  state.habits = defs.map(d => ({ id: uid(), ...d, createdAt: toKey(addDays(today, -40)), archived: false }));
  state.completions = {};
  // Generar historial con rachas aleatorias pero verosímiles
  const rnd = (p) => Math.random() < p;
  for (let i = 60; i >= 0; i--) {
    const k = toKey(addDays(today, -i));
    const list = [];
    state.habits.forEach((h, idx) => {
      const probs = [0.85, 0.7, 0.5, 0.8];
      if (rnd(probs[idx])) list.push(h.id);
    });
    if (list.length) state.completions[k] = list;
  }
  state.events = [
    { id: uid(), title: 'Revisión semanal', date: toKey(addDays(today, 1)), time: '18:00', note: 'Repasar objetivos', color: EVENT_COLORS[0] },
    { id: uid(), title: 'Entrenamiento', date: toKey(today), time: '07:30', note: '30 min', color: EVENT_COLORS[2] }
  ];
  state.xp = { total: 0, log: {} };
  for (const d in state.completions) {
    const xp = state.completions[d].length * XP_PER_DONE;
    state.xp.total += xp; state.xp.log[d] = xp;
  }
  save(); render(); toast('Datos de ejemplo cargados 🌱');
}

function resetAll() {
  confirmDialog('¿Borrar TODOS los datos? Esta acción no se puede deshacer.', () => {
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    state = defaultState();
    applyTheme(); render(); toast('Datos borrados');
  });
}

/* ---------- Tema ---------- */
function applyTheme() {
  const theme = state.settings.theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('btn-theme').textContent = theme === 'dark' ? '🌙' : '☀️';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e1116' : '#f3f5f9');
}

/* ============================================================
   EVENTOS GLOBALES
   ============================================================ */
document.addEventListener('click', e => {
  const navBtn = e.target.closest('.nav-item');
  if (navBtn) { switchView(navBtn.dataset.view); return; }

  const act = e.target.closest('[data-action]');
  if (!act) return;
  const action = act.dataset.action;

  switch (action) {
    case 'toggle-habit': toggleHabit(act.dataset.id, act.dataset.date); break;
    case 'add-habit': openHabitModal(null); break;
    case 'edit-habit': openHabitModal(act.dataset.id); break;
    case 'archive-habit': {
      const h = habitById(act.dataset.id);
      if (h) { h.archived = !h.archived; save(); render(); toast(h.archived ? 'Hábito archivado' : 'Hábito restaurado'); }
      break;
    }
    case 'delete-habit': deleteHabit(act.dataset.id); break;
    case 'add-event': openEventModal(null, act.dataset.date || null); break;
    case 'edit-event': openEventModal(act.dataset.id); break;
    case 'delete-event': deleteEvent(act.dataset.id); break;
    case 'open-day': openDayModal(act.dataset.date); break;
    case 'close-modal': closeModal(); break;
    case 'cal-prev': calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } render(); break;
    case 'cal-next': calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } render(); break;
    case 'cal-today': { const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth(); render(); break; }
    case 'set-theme': state.settings.theme = act.dataset.theme; save(); applyTheme(); render(); break;
    case 'export-json': exportJSON(); break;
    case 'export-csv': exportCSV(); break;
    case 'import-json': document.getElementById('import-file').click(); break;
    case 'seed-demo': seedDemo(); break;
    case 'reset-all': resetAll(); break;
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'import-file' && e.target.files.length) {
    importJSON(e.target.files[0]);
    e.target.value = '';
  }
  if (e.target.id === 'set-name') {
    state.settings.userName = e.target.value.trim();
    save();
  }
  if (e.target.id === 'set-week') {
    state.settings.weekStartsMonday = e.target.value === '1';
    save(); render();
  }
  if (e.target.id === 'set-xp') {
    state.settings.xpEnabled = e.target.checked;
    save(); render();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ---------- Registro del service worker ---------- */
function registerSW() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator &&
      typeof location !== 'undefined' && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/* ---------- Inicio ---------- */
function init() {
  load();
  applyTheme();
  document.getElementById('btn-theme').addEventListener('click', () => {
    state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
    save(); applyTheme(); render();
  });
  document.getElementById('btn-level').addEventListener('click', () => switchView('stats'));
  const n = new Date(); calYear = n.getFullYear(); calMonth = n.getMonth();
  render();
  registerSW();
}
init();
