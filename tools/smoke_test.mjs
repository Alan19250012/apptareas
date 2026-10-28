// Prueba de humo: ejecuta app.js en un contexto simulado y recorre todas las vistas
// para detectar errores de referencia (funciones/variables inexistentes).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function makeEl() {
  return {
    _html: '',
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    textContent: '', value: '', title: '', dataset: {},
    style: new Proxy({}, { set: () => true, get: () => '' }),
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return ''; },
    appendChild() {}, remove() {}, click() {}, files: [],
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; }
  };
}

const document = {
  documentElement: { setAttribute() {} },
  getElementById() { return makeEl(); },
  querySelector() { return makeEl(); },
  querySelectorAll() { return []; },
  createElement() { return makeEl(); },
  body: makeEl(),
  addEventListener() {}
};

const context = {
  document,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: {},
  location: { protocol: 'https:' },
  crypto: { randomUUID: () => 'id-' + Math.random().toString(36).slice(2) },
  confirm: () => true,
  alert: () => {},
  console,
  Date, Math, JSON, Object, Array, String, Number, parseInt, parseFloat, isNaN,
  Blob: class { constructor() {} },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  FileReader: class { readAsText() {} },
  setTimeout, clearTimeout
};
context.globalThis = context;

const code = readFileSync(new URL('../app/js/app.js', import.meta.url), 'utf8');
vm.createContext(context);

const steps = [
  ['init (app.js)', ''],
  ['dashboard', 'switchView("dashboard")'],
  ['calendar', 'switchView("calendar")'],
  ['agenda', 'switchView("agenda")'],
  ['habits', 'switchView("habits")'],
  ['stats', 'switchView("stats")'],
  ['settings', 'switchView("settings")'],
  ['open day modal', 'openDayModal(todayKey())'],
  ['habit modal', 'openHabitModal(null)'],
  ['event modal', 'openEventModal(null)'],
  ['seed demo', 'seedDemo()'],
  ['calendar after seed', 'switchView("calendar")'],
  ['stats after seed', 'switchView("stats")'],
  ['toggle habit today', 'toggleHabit(state.habits[0].id, todayKey())']
];

let failed = 0;
try {
  vm.runInContext(code, context, { filename: 'app.js' });
  console.log('✔ app.js cargado e init() ejecutado');
} catch (e) {
  failed++;
  console.error('✘ ERROR en init():', e.message);
}

for (const [label, expr] of steps.slice(1)) {
  try {
    vm.runInContext(expr + ';', context, { filename: label });
    console.log('✔', label);
  } catch (e) {
    failed++;
    console.error('✘', label, '→', e.message);
  }
}

console.log(failed === 0 ? '\nTODO OK ✓' : `\n${failed} fallo(s)`);
process.exit(failed === 0 ? 0 : 1);
