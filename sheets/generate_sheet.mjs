/**
 * Genera la plantilla "RastreadorHabitos.xlsx" (compatible con Excel y Google Sheets).
 * Incluye: Registro diario, Estadísticas (con rachas), Panel de progreso,
 * Agenda con calendario mensual automático y una hoja auxiliar de rachas.
 * Uso: node sheets/generate_sheet.mjs
 */
import ExcelJS from 'exceljs';

const YEAR = new Date().getFullYear();
const daysInYear = ((YEAR % 4 === 0 && YEAR % 100 !== 0) || YEAR % 400 === 0) ? 366 : 365;
const N = daysInYear + 1; // última fila de datos (fila 1 = cabecera)

const ACCENT = 'FF7C6CF0';
const ACCENT2 = 'FFA06CF0';
const DARK = 'FF1A2029';
const SURFACE = 'FF212835';
const TEXT_MUTED = 'FF9AA6B8';

const HABITS = [
  { name: '💧 Beber agua', color: 'FF4DA3FF' },
  { name: '📚 Leer', color: 'FF7C6CF0' },
  { name: '💪 Ejercicio', color: 'FF2FD07A' },
  { name: '🧘 Meditar', color: 'FFA06CF0' },
  { name: '😴 Dormir 8h', color: 'FF22C1C3' },
  { name: '➕ Nuevo hábito', color: 'FF5B6676' }
];
const COLS = ['B', 'C', 'D', 'E', 'F', 'G'];

const wb = new ExcelJS.Workbook();
wb.creator = 'Hábitat';
wb.created = new Date();

/* ============ 1. Instrucciones ============ */
const instr = wb.addWorksheet('📖 Instrucciones', { views: [{ showGridLines: false }] });
instr.columns = [{ width: 110 }];
instr.getCell('A1').value = '🌱 Hábitat — Rastreador de Hábitos (Excel / Google Sheets)';
instr.getCell('A1').font = { bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
instr.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
instr.getCell('A2').value = 'Cómo usar esta plantilla';
instr.getCell('A2').font = { bold: true, size: 14, color: { argb: ACCENT } };
const instrLines = [
  '',
  '1) Hoja "✅ Registro": escribe una "x" (o cualquier texto) en la celda del hábito cada día que lo cumplas.',
  '   Los contadores de la derecha y los porcentajes se calculan solos.',
  '2) Cambia el nombre y el color de los hábitos en la fila 1 (cabecera). Borra la columna "➕ Nuevo hábito" si no la usas.',
  '3) Hoja "📊 Estadísticas": verás totales, % de cumplimiento, racha actual y mejor racha por hábito.',
  '4) Hoja "🎯 Panel": resumen visual con los indicadores clave.',
  '5) Hoja "📅 Agenda": calendario del mes actual (se pinta en verde los días con actividad) y una tabla de eventos.',
  '6) La hoja "⚙️ Aux" está oculta: contiene el cálculo de rachas. No la borres.',
  '',
  '💡 Consejo: abre esta plantilla en Google Sheets con Archivo → Importar o súbela a Drive y ábrela con Sheets.',
  '   En la app Hábitat (web/móvil) tienes además XP, niveles, heatmap y recordatorios, con exportación CSV/JSON.',
  '',
  '🔒 Todo se guarda en tu dispositivo. Comparte tu progreso con la exportación JSON.'
];
instrLines.forEach((t, i) => {
  const c = instr.getCell('A' + (3 + i));
  c.value = t;
  c.font = { size: 12, color: { argb: i === 0 ? 'FF0E1116' : 'FF212835' } };
});
instr.getCell('A3').font = { size: 12, color: { argb: 'FF0E1116' } };

/* ============ 2. Registro ============ */
const reg = wb.addWorksheet('✅ Registro', {
  views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }],
  properties: { tabColor: { argb: ACCENT } }
});
reg.columns = [
  { header: 'Fecha', key: 'fecha', width: 12 },
  ...HABITS.map(h => ({ header: h.name, key: 'h' + HABITS.indexOf(h), width: 13 })),
  { header: '✔ Hechos', key: 'hechos', width: 11 },
  { header: '% del día', key: 'pct', width: 11 }
];
reg.getRow(1).height = 34;
reg.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
reg.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
reg.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
reg.getCell('A1').font = { bold: true, color: { argb: 'FFFFFFFF' } };
COLS.forEach((c, i) => {
  reg.getCell(c + '1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HABITS[i].color } };
});
reg.getCell('H1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SURFACE } };
reg.getCell('I1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SURFACE } };

for (let d = 0; d < daysInYear; d++) {
  const date = new Date(YEAR, 0, 1 + d);
  const r = d + 2;
  const row = reg.addRow([date]);
  reg.getCell('A' + r).numFmt = 'dd/mm/yyyy';
  reg.getCell('H' + r).value = { formula: `COUNTA(B${r}:G${r})` };
  reg.getCell('I' + r).value = { formula: `IFERROR(H${r}/COUNTA($B$1:$G$1),0)` };
  reg.getCell('I' + r).numFmt = '0%';
  reg.getCell('H' + r).alignment = { horizontal: 'center' };
  reg.getCell('I' + r).alignment = { horizontal: 'center' };
}
// Formato condicional: celda de hábito no vacía → verde
reg.addConditionalFormatting({
  ref: `B2:G${N}`,
  rules: [{
    type: 'expression',
    formulae: ['B2<>""'],
    style: {
      fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF2FD07A' } },
      font: { color: { argb: 'FF0C1A11' }, bold: true }
    }
  }]
});
// Resaltar la fila de hoy
reg.addConditionalFormatting({
  ref: `A2:I${N}`,
  rules: [{
    type: 'expression',
    formulae: ['$A2=TODAY()'],
    style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF3A2F6B' } } }
  }]
});
reg.autoFilter = { from: 'A1', to: `I${N}` };

/* ============ 3. Aux (oculta) — rachas ============ */
const aux = wb.addWorksheet('⚙️ Aux', {
  properties: { tabColor: { argb: 'FF444444' } },
  state: 'hidden'
});
// fila 1 en blanco; datos desde fila 2
for (let d = 0; d < daysInYear; d++) {
  const date = new Date(YEAR, 0, 1 + d);
  const r = d + 2;
  aux.addRow([date]);
  aux.getCell('A' + r).numFmt = 'dd/mm/yyyy';
  COLS.forEach((c) => {
    const prev = r === 2 ? '0' : `${c}${r - 1}`;
    aux.getCell(c + r).value = { formula: `IF(Registro!${c}${r}<>"",${prev}+1,0)` };
  });
}

/* ============ 4. Estadísticas ============ */
const est = wb.addWorksheet('📊 Estadísticas', {
  views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }],
  properties: { tabColor: { argb: ACCENT2 } }
});
est.columns = [{ header: 'Métrica', key: 'm', width: 22 }, ...HABITS.map(h => ({ header: h.name, width: 14 }))];
est.getRow(1).height = 30;
est.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
est.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
COLS.forEach((c, i) => {
  est.getCell(c + '1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HABITS[i].color } };
});

const metrics = [
  {
    name: 'Total (año)',
    f: (c) => `COUNTA(Registro!${c}$2:${c}$${N})`
  },
  {
    name: 'Este mes',
    f: (c) => `COUNTIFS(Registro!$A$2:$A$${N},">="&DATE(YEAR(TODAY()),MONTH(TODAY()),1),Registro!${c}$2:${c}$${N},"<>")`
  },
  {
    name: 'Últimos 7 días',
    f: (c) => `COUNTIFS(Registro!$A$2:$A$${N},">="&(TODAY()-6),Registro!${c}$2:${c}$${N},"<>")`
  },
  {
    name: '% cumplimiento',
    f: (c) => `IFERROR(${c}2/(TODAY()-DATE(YEAR(TODAY()),1,1)+1),0)`,
    pct: true
  },
  {
    name: '🔥 Racha actual',
    f: (c) => {
      const m = `MATCH(TODAY(),Aux!$A$2:$A$${N},0)`;
      return `IFERROR(IF(INDEX(Aux!${c}:${c},${m})>0,INDEX(Aux!${c}:${c},${m}),INDEX(Aux!${c}:${c},${m}-1)),0)`;
    }
  },
  {
    name: '🏆 Mejor racha',
    f: (c) => `MAX(Aux!${c}$2:${c}$${N})`
  }
];

metrics.forEach((mt, i) => {
  const r = i + 2;
  est.getCell('A' + r).value = mt.name;
  est.getCell('A' + r).font = { bold: true };
  COLS.forEach((c) => {
    const cell = est.getCell(c + r);
    cell.value = { formula: '=' + mt.f(c) };
    if (mt.pct) cell.numFmt = '0%';
    cell.alignment = { horizontal: 'center' };
  });
  if (r % 2 === 0) {
    est.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF14181F' } };
  }
});
// Resaltar la fila de racha actual
est.getRow(6).font = { bold: true, color: { argb: 'FFFF9F43' } };

/* ============ 5. Panel ============ */
const panel = wb.addWorksheet('🎯 Panel', {
  views: [{ showGridLines: false }],
  properties: { tabColor: { argb: 'FF2FD07A' } }
});
panel.columns = [{ width: 34 }, { width: 22 }];
panel.mergeCells('A1:B1');
panel.getCell('A1').value = `🎯 Panel de Progreso — ${YEAR}`;
panel.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
panel.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } };
panel.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
panel.getRow(1).height = 40;

const panelCards = [
  ['✅ Hábitos completados hoy', `IFERROR(VLOOKUP(TODAY(),Registro!$A$2:$H$${N},8,0),0)`, null, ACCENT],
  ['📈 % del día', `IFERROR(VLOOKUP(TODAY(),Registro!$A$2:$I$${N},9,0),0)`, '0%', 'FF4DA3FF'],
  ['🔥 Racha actual (máxima)', 'MAX(Estadísticas!B6:G6)', null, 'FFFF9F43'],
  ['🏆 Mejor racha', 'MAX(Estadísticas!B7:G7)', null, 'FFA06CF0'],
  ['✔️ Total completados (año)', 'SUM(Estadísticas!B2:G2)', null, 'FF2FD07A'],
  ['📆 Días activos', `COUNTIF(Registro!$H$2:$H$${N},">0")`, null, 'FF22C1C3'],
  ['⭐ Nivel (aprox.)', 'INT(SQRT(B8/10))+1', null, 'FFFF5D9E']
];

panelCards.forEach(([label, formula, fmt, color], i) => {
  const r = 3 + i * 2;
  panel.getCell('A' + r).value = label;
  panel.getCell('A' + r).font = { bold: true, size: 12, color: { argb: 'FFEAF0F7' } };
  panel.getCell('A' + r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SURFACE } };
  panel.getCell('B' + r).value = { formula: '=' + formula };
  panel.getCell('B' + r).font = { bold: true, size: 18, color: { argb: color } };
  if (fmt) panel.getCell('B' + r).numFmt = fmt;
  panel.getCell('B' + r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SURFACE } };
  panel.getCell('B' + r).alignment = { horizontal: 'center', vertical: 'middle' };
  panel.getRow(r).height = 30;
});
panel.getCell('A17').value = '📊 Para ver el detalle por hábito consulta la hoja "Estadísticas". La racha se actualiza automáticamente según lo que marques en "Registro".';
panel.getCell('A17').font = { italic: true, color: { argb: TEXT_MUTED }, size: 11 };

/* ============ 6. Agenda ============ */
const agenda = wb.addWorksheet('📅 Agenda', {
  views: [{ showGridLines: true }],
  properties: { tabColor: { argb: 'FF4DA3FF' } }
});
agenda.columns = [1, 2, 3, 4, 5, 6, 7].map(() => ({ width: 14 }));

const now = new Date();
const ym = now.getFullYear(), mm = now.getMonth();
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WD = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

agenda.mergeCells('A1:G1');
agenda.getCell('A1').value = `📅 Calendario — ${MONTH_NAMES[mm]} ${ym}`;
agenda.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
agenda.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4DA3FF' } };
agenda.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
agenda.getRow(1).height = 32;

WD.forEach((wd, i) => {
  const c = agenda.getCell(String.fromCharCode(65 + i) + '2');
  c.value = wd;
  c.font = { bold: true, color: { argb: 'FF9AA6B8' } };
  c.alignment = { horizontal: 'center' };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF212835' } };
});

const firstDay = new Date(ym, mm, 1);
const offset = (firstDay.getDay() + 6) % 7; // lunes = 0
const dim = new Date(ym, mm + 1, 0).getDate();

for (let d = 1; d <= dim; d++) {
  const row = 3 + Math.floor((offset + d - 1) / 7);
  const col = (offset + d - 1) % 7;
  const cell = agenda.getCell(String.fromCharCode(65 + col) + row);
  cell.value = d;
  cell.alignment = { vertical: 'top', horizontal: 'left' };
}
// Formato condicional: pintar en verde los días con actividad (hechos > 0)
for (let d = 1; d <= dim; d++) {
  const row = 3 + Math.floor((offset + d - 1) / 7);
  const col = (offset + d - 1) % 7;
  const ref = String.fromCharCode(65 + col) + row;
  agenda.addConditionalFormatting({
    ref,
    rules: [{
      type: 'expression',
      formulae: [`VLOOKUP(DATE(${ym},${mm + 1},${d}),Registro!$A$2:$H$${N},8,0)>0`],
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FF2FD07A' } }, font: { color: { argb: 'FF0C1A11' }, bold: true } }
    }]
  });
}

// Tabla de eventos
const evStart = 3 + 6;
agenda.mergeCells(`A${evStart}:G${evStart}`);
agenda.getCell(`A${evStart}`).value = '📌 Eventos';
agenda.getCell(`A${evStart}`).font = { bold: true, size: 14, color: { argb: 'FF4DA3FF' } };
const evHead = ['Fecha', 'Hora', 'Título', 'Nota', '', '', ''];
evHead.forEach((h, i) => {
  const c = agenda.getCell(String.fromCharCode(65 + i) + (evStart + 1));
  c.value = h;
  c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4DA3FF' } };
});
for (let i = 0; i < 12; i++) {
  const r = evStart + 2 + i;
  const c = agenda.getCell('A' + r);
  c.numFmt = 'dd/mm/yyyy';
}
agenda.getCell('A' + (evStart + 2)).value = new Date(ym, mm, Math.min(15, dim));
agenda.getCell('B' + (evStart + 2)).value = '09:00';
agenda.getCell('C' + (evStart + 2)).value = 'Revisión semanal';
agenda.getCell('A' + (evStart + 3)).value = new Date(ym, mm, Math.min(20, dim));
agenda.getCell('B' + (evStart + 3)).value = '18:30';
agenda.getCell('C' + (evStart + 3)).value = 'Entrenamiento';

/* ============ Guardar ============ */
const out = new URL('./RastreadorHabitos.xlsx', import.meta.url);
await wb.xlsx.writeFile(out);
console.log('Plantilla generada:', out.pathname);
console.log('Año:', YEAR, '· Días:', daysInYear, '· Hábitos:', HABITS.length);
