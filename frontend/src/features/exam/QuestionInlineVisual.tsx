// =============================================================================
//  QuestionInlineVisual.tsx
//  Visual embebido dentro de la tarjeta de pregunta — NO es un panel flotante.
//  Muestra diagrama + fórmula + datos clave según el tipo de pregunta.
// =============================================================================
import React, { useEffect, useRef } from 'react';

declare const MathJax: { typesetPromise: (nodes?: HTMLElement[]) => Promise<void> };

interface Option { label: string; text: string }
interface Question {
  id: string; stem: string; options: Option[];
  area: string; points: number; difficulty?: string;
}
interface Props { question: Question; color: string }

// ── Renderizador MathJax inline ───────────────────────────────────────────────
function MathBox({ tex, style }: { tex: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = `\\[${tex}\\]`;
    try { MathJax.typesetPromise([ref.current]).catch(() => {}); } catch {}
  }, [tex]);
  return <div ref={ref} style={{ textAlign: 'center', fontSize: 15, ...style }} />;
}

// ── Detección de tipo ─────────────────────────────────────────────────────────
type Kind =
  | 'commercial' | 'pythagoras' | 'circle' | 'statistics'
  | 'kinematics' | 'ohm' | 'force'
  | 'chem' | 'periodic' | 'biology'
  | 'reading' | 'english' | 'social' | 'none';

function kind(area: string, stem: string): Kind {
  const t = (area + ' ' + stem).toLowerCase();
  if (/descuento|cu[aá]nto paga|precio.*total|rebaja|iva.*precio|unidades.*precio/.test(t)) return 'commercial';
  if (/pit[aá]gor|cateto|hipotenusa|tri[aá]ngulo.*rect/.test(t)) return 'pythagoras';
  if (/c[ií]rculo|circunferencia|radio\s*=|[aá]rea.*c[ií]rc/.test(t)) return 'circle';
  if (/\bmedia\b|\bmediana\b|\bmoda\b|los datos son|puntajes.*son|promedio de los/.test(t)) return 'statistics';
  if (/velocidad.*inicial|lanza.*arriba|altura.*m[aá]xima|ca[ií]da.*libre|g\s*=\s*10/.test(t)) return 'kinematics';
  if (/resistencia|ley.*ohm|voltaje|corriente.*amp|amperio|ohmio/.test(t)) return 'ohm';
  if (/fuerza|newton|aceleraci[oó]n|masa.*kg|segunda.*ley/.test(t)) return 'force';
  if (/\bmol\b|combusti[oó]n|balancear|ecuaci[oó]n.*qu[ií]m|reactivo|ch4|co2/.test(t)) return 'chem';
  if (/tabla.*peri[oó]dica|n[uú]mero.*at[oó]m|electr[oó]n.*capa|grupo.*per[ií]odo/.test(t)) return 'periodic';
  if (/biolog|c[eé]lula|adn|gen[eé]t|ecosistema|fotosíntesis/.test(t)) return 'biology';
  if (area.toLowerCase().includes('lectura') || /fragmento|p[aá]rrafo/.test(t)) return 'reading';
  if (area.toLowerCase().includes('ingl') || /\benglish\b|grammar/.test(t)) return 'english';
  if (area.toLowerCase().includes('social') || /constituci[oó]n|historia.*siglo/.test(t)) return 'social';
  return 'none';
}

function getNums(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)]
    .map(m => parseFloat(m[0].replace(',', '.')))
    .filter(n => !isNaN(n) && n > 0);
}

// ── Canvas: triángulo rectángulo ──────────────────────────────────────────────
function drawTriangle(cv: HTMLCanvasElement, a: number, b: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  const sc = Math.min((W - 70) / b, (H - 50) / a) * 0.85;
  const ox = 35, oy = H - 28;
  ctx.clearRect(0, 0, W, H);
  // Grid light
  ctx.strokeStyle = '#21262d'; ctx.lineWidth = 0.4;
  for (let i = 0; i <= Math.ceil(b) + 1; i++) { ctx.beginPath(); ctx.moveTo(ox + i * sc, 18); ctx.lineTo(ox + i * sc, oy); ctx.stroke(); }
  for (let i = 0; i <= Math.ceil(a) + 1; i++) { ctx.beginPath(); ctx.moveTo(ox, oy - i * sc); ctx.lineTo(ox + (b + 1) * sc, oy - i * sc); ctx.stroke(); }
  // Fill
  ctx.fillStyle = color + '14';
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + b * sc, oy); ctx.lineTo(ox + b * sc, oy - a * sc); ctx.closePath(); ctx.fill();
  // Triangle
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + b * sc, oy); ctx.lineTo(ox + b * sc, oy - a * sc); ctx.closePath(); ctx.stroke();
  // Right angle
  const rs = 10; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ox + b * sc - rs, oy); ctx.lineTo(ox + b * sc - rs, oy - rs); ctx.lineTo(ox + b * sc, oy - rs); ctx.stroke();
  // Labels
  ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 12px Segoe UI';
  ctx.fillText('A', ox - 16, oy + 4); ctx.fillText('B', ox + b * sc + 5, oy + 4); ctx.fillText('C', ox + b * sc + 5, oy - a * sc - 4);
  ctx.fillStyle = color; ctx.font = 'bold 11px Courier New,monospace';
  ctx.fillText(`b=${b}`, ox + b * sc / 2 - 16, oy + 16);
  ctx.fillText(`a=${a}`, ox + b * sc + 6, oy - a * sc / 2 + 4);
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 11px Courier New,monospace';
  ctx.fillText('c=?', ox + b * sc / 2 - 36, oy - a * sc / 2 - 6);
}

// ── Canvas: círculo ───────────────────────────────────────────────────────────
function drawCircle(cv: HTMLCanvasElement, r: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, cr = Math.min(cx, cy) - 18;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = color + '12'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + cr, cy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#3fb950'; ctx.font = 'bold 11px Courier New,monospace'; ctx.fillText(`r = ${r}`, cx + 6, cy - 8);
  ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 11px Segoe UI'; ctx.fillText('O', cx + 5, cy + 14);
  ctx.fillStyle = '#d29922'; ctx.font = '10px Courier New,monospace';
  ctx.fillText('A = πr²', cx - cr + 6, cy - cr + 14);
  ctx.fillStyle = '#bc8cff'; ctx.fillText('C = 2πr', cx - cr + 6, cy + cr - 6);
}

// ── Canvas: histograma ────────────────────────────────────────────────────────
function drawHistogram(cv: HTMLCanvasElement, data: number[], color: string) {
  const ctx = cv.getContext('2d'); if (!ctx || !data.length) return;
  const W = cv.width, H = cv.height, pad = 36, top = 12, gh = H - top - 24;
  const maxV = Math.max(...data) * 1.15;
  const bw = Math.max(10, Math.floor((W - pad - 16) / data.length) - 4);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#21262d'; ctx.lineWidth = 0.4;
  for (let i = 0; i <= 4; i++) { const y = top + i * gh / 4; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - 8, y); ctx.stroke(); }
  data.forEach((v, i) => {
    const x = pad + i * (bw + 4), bh = (v / maxV) * gh, y = top + gh - bh;
    ctx.fillStyle = color + '20'; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = color; ctx.fillRect(x, y, bw, 3);
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x, y, bw, bh);
    ctx.fillStyle = '#e6edf3'; ctx.font = '9px Courier New,monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(v), x + bw / 2, y - 2);
    ctx.fillStyle = '#6e7681'; ctx.fillText(String(v), x + bw / 2, H - 6);
    ctx.textAlign = 'left';
  });
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const my = top + gh - (mean / maxV) * gh;
  ctx.strokeStyle = '#d29922'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
  ctx.beginPath(); ctx.moveTo(pad, my); ctx.lineTo(W - 8, my); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#d29922'; ctx.font = 'bold 10px Courier New,monospace';
  ctx.fillText('x̄', W - 28, my - 3);
}

// ── Canvas: gráfica h(t) ──────────────────────────────────────────────────────
function drawKinematics(cv: HTMLCanvasElement, v0: number, g: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const hmax = v0 * v0 / (2 * g), ttot = 2 * v0 / g;
  const W = cv.width, H = cv.height, px = 42, py = 12, gw = W - px - 16, gh = H - py - 24;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#21262d'; ctx.lineWidth = 0.4;
  for (let i = 0; i <= 4; i++) {
    const x = px + i * gw / 4; ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x, py + gh); ctx.stroke();
    const y = py + i * gh / 4; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + gw, y); ctx.stroke();
  }
  ctx.strokeStyle = '#444c56'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + gh); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px, py + gh); ctx.lineTo(px + gw, py + gh); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = (i / 60) * ttot, h = v0 * t - 0.5 * g * t * t;
    const x = px + (t / ttot) * gw, y = py + gh - (h / hmax) * gh;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = color + '12'; ctx.beginPath();
  for (let i = 0; i <= 60; i++) { const t = (i / 60) * ttot, h = v0 * t - 0.5 * g * t * t; ctx.lineTo(px + (t / ttot) * gw, py + gh - (h / hmax) * gh); }
  ctx.lineTo(px + gw, py + gh); ctx.lineTo(px, py + gh); ctx.closePath(); ctx.fill();
  // Peak point
  ctx.fillStyle = '#f85149'; ctx.beginPath(); ctx.arc(px + gw / 2, py, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f85149'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(px + gw / 2, py); ctx.lineTo(px + gw / 2, py + gh); ctx.stroke(); ctx.setLineDash([]);
  // Labels
  ctx.fillStyle = color; ctx.font = 'bold 10px Segoe UI'; ctx.fillText(`h(t) = ${v0}t − ${g / 2}t²`, px + 4, py + 14);
  ctx.fillStyle = '#f85149'; ctx.font = '9px Courier New,monospace'; ctx.fillText('h_max', px + gw / 2 + 4, py + 10);
  ctx.fillStyle = '#6e7681'; ctx.font = '9px Courier New'; ctx.fillText('0', px - 10, py + gh + 14); ctx.fillText(ttot + 's', px + gw - 14, py + gh + 14);
  ctx.fillText(hmax + 'm', 2, py + 4);
}

// ── Canvas: circuito Ohm ──────────────────────────────────────────────────────
function drawCircuit(cv: HTMLCanvasElement, R: number, I: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const l = 44, t = 24, w = W - 90, h = 72;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.strokeRect(l, t, w, h);
  // Battery
  ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(l, t + 18); ctx.lineTo(l, t + h - 18); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(l - 7, t + 22); ctx.lineTo(l + 7, t + 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(l - 4, t + 30); ctx.lineTo(l + 4, t + 30); ctx.stroke();
  // Resistor box
  const rx = l + w / 2 - 28;
  ctx.strokeStyle = '#d29922'; ctx.lineWidth = 1.5; ctx.strokeRect(rx, t - 10, 56, 20);
  ctx.fillStyle = '#161b22'; ctx.fillRect(rx + 1, t - 9, 54, 18);
  ctx.strokeStyle = '#d29922'; ctx.lineWidth = 1.2; ctx.beginPath();
  const zig = [rx + 3, t + 1, rx + 10, t - 7, rx + 18, t + 1, rx + 25, t - 7, rx + 33, t + 1, rx + 40, t - 7, rx + 52, t + 1];
  ctx.moveTo(zig[0], zig[1]);
  for (let i = 1; i < 7; i++) ctx.lineTo(zig[i * 2], zig[i * 2 + 1]);
  ctx.stroke();
  // Ammeter
  const ax = l + w, ay = t + h / 2;
  ctx.strokeStyle = '#f85149'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ax, ay, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#1a0707'; ctx.beginPath(); ctx.arc(ax, ay, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 12px Courier New'; ctx.textAlign = 'center'; ctx.fillText('A', ax, ay + 4); ctx.textAlign = 'left';
  // Labels
  ctx.fillStyle = '#3fb950'; ctx.font = 'bold 10px Courier New'; ctx.fillText(`I=${I}A`, l - 40, t + h / 2 + 4);
  ctx.fillStyle = '#d29922'; ctx.font = 'bold 10px Courier New'; ctx.fillText(`R=${R}Ω`, rx + 4, t - 12);
  ctx.fillStyle = '#f85149'; ctx.font = '10px Courier New'; ctx.fillText('V = ?', ax + 16, ay + 4);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function QuestionInlineVisual({ question, color }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const k = kind(question.area, question.stem);
  const n = getNums(question.stem);

  // Canvas params
  const pct     = (() => { const m = question.stem.match(/(\d+)\s*%/); return m ? +m[1] : 0; })();
  const prices  = n.filter(x => x >= 100);
  const qtys    = n.filter(x => x < 100 && x >= 1 && x !== pct);
  const a       = (n.filter(x => x < 10000)[0]) || 6;
  const b       = (n.filter(x => x < 10000)[1]) || 8;
  const r       = n[0] || 7;
  const v0      = n.find(x => x >= 5 && x <= 100) || 20;
  const g       = n.find(x => x === 10) || 10;
  const R       = n[0] || 10, I = n[1] || 3;
  const statsData = [...n.filter(x => x < 10000 && x > 0)].sort((a, b) => a - b);

  const hasCanvas = ['pythagoras','circle','statistics','kinematics','ohm'].includes(k);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !hasCanvas) return;
    if (k === 'pythagoras') drawTriangle(cv, a, b, color);
    if (k === 'circle')     drawCircle(cv, r, color);
    if (k === 'statistics') drawHistogram(cv, statsData.slice(0, 10), color);
    if (k === 'kinematics') drawKinematics(cv, v0, g, color);
    if (k === 'ohm')        drawCircuit(cv, R, I, color);
  }, [k, question.id, color]);

  if (k === 'none') return null;

  // ── Fórmula y tabla de datos por tipo ──────────────────────────────────────
  const formulaTex: string | null = (() => {
    const fmt = (v: number) => v.toLocaleString('es-CO');
    if (k === 'commercial') {
      const base = (qtys[0] || 1) * (prices[0] || 0);
      return `P_{base} = ${qtys[0] || 1} \\times \\$${fmt(prices[0] || 0)} = \\$${fmt(base)} \\quad D=${pct}\\%`;
    }
    if (k === 'pythagoras') return `c = \\sqrt{a^2 + b^2} = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${a*a+b*b}}`;
    if (k === 'circle')     return `A = \\pi r^2 = \\pi \\times ${r}^2 \\qquad C = 2\\pi r = 2\\pi \\times ${r}`;
    if (k === 'statistics') { const s = statsData.reduce((a,b)=>a+b,0); return `\\bar{x} = \\frac{${s}}{${statsData.length}} = ?`; }
    if (k === 'kinematics') return `h_{max} = \\frac{v_0^2}{2g} = \\frac{${v0}^2}{2 \\times ${g}} \\qquad t_{total} = \\frac{2v_0}{g}`;
    if (k === 'ohm')        return `V = I \\times R = ${I} \\times ${R} \\qquad P = I^2 R`;
    if (k === 'force')      return `F = m \\times a`;
    if (k === 'chem')       return `\\text{Reactivos} \\xrightarrow{} \\text{Productos}`;
    if (k === 'periodic')   return `Z = p^+ = e^- \\quad \\text{Período} = \\text{capas}`;
    if (k === 'biology')    return `6CO_2 + 6H_2O + \\text{luz} \\rightarrow C_6H_{12}O_6 + 6O_2`;
    return null;
  })();

  const chips: { label: string; val: string }[] = (() => {
    const fmt = (v: number) => v.toLocaleString('es-CO');
    if (k === 'commercial') return [
      { label: 'Cantidad', val: `${qtys[0] || 1}` },
      { label: 'Precio unit.', val: `$${fmt(prices[0] || 0)}` },
      { label: 'Descuento', val: `${pct}%` },
      { label: 'Base total', val: `$${fmt((qtys[0]||1)*(prices[0]||0))}` },
    ];
    if (k === 'pythagoras') return [
      { label: 'Cateto a', val: `${a} cm` },
      { label: 'Cateto b', val: `${b} cm` },
      { label: 'a² + b²', val: `${a*a+b*b}` },
      { label: 'c = √?', val: '?' },
    ];
    if (k === 'circle') return [
      { label: 'Radio r', val: `${r} cm` },
      { label: 'Diámetro', val: `${2*r} cm` },
      { label: 'A = πr²', val: '?' },
      { label: 'C = 2πr', val: '?' },
    ];
    if (k === 'kinematics') return [
      { label: 'v₀', val: `${v0} m/s` },
      { label: 'g', val: `${g} m/s²` },
      { label: 'h_max', val: '?' },
      { label: 't total', val: '?' },
    ];
    if (k === 'ohm') return [
      { label: 'R', val: `${R} Ω` },
      { label: 'I', val: `${I} A` },
      { label: 'V = IR', val: '?' },
      { label: 'P = I²R', val: '?' },
    ];
    if (k === 'statistics' && statsData.length > 0) {
      const s = statsData.reduce((a,b)=>a+b,0);
      return [
        { label: 'n datos', val: `${statsData.length}` },
        { label: 'Suma', val: `${s}` },
        { label: 'Media', val: '?' },
        { label: 'Mediana', val: '?' },
      ];
    }
    return [];
  })();

  const canvasH = k === 'ohm' ? 130 : 180;

  return (
    <div style={S.wrap}>
      {/* Chips de datos clave */}
      {chips.length > 0 && (
        <div style={S.row}>
          <span style={{ ...S.micro, color }}>📌 DATOS CLAVE</span>
          <div style={S.chips}>
            {chips.map((c, i) => (
              <div key={i} style={{ ...S.chip, borderColor: c.val === '?' ? '#f85149' : color + '60' }}>
                <span style={{ ...S.chipLbl }}>{c.label}</span>
                <span style={{ ...S.chipVal, color: c.val === '?' ? '#f85149' : color }}>{c.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fórmula MathJax */}
      {formulaTex && (
        <div style={S.row}>
          <span style={{ ...S.micro, color }}>🧮 FÓRMULA</span>
          <div style={{ ...S.formulaBox, borderColor: color + '50' }}>
            <MathBox tex={formulaTex} style={{ color }} />
          </div>
        </div>
      )}

      {/* Canvas */}
      {hasCanvas && (
        <div style={S.row}>
          <span style={{ ...S.micro, color }}>
            {k === 'pythagoras' && '📐 DIAGRAMA GEOMÉTRICO'}
            {k === 'circle'     && '⭕ FIGURA: CÍRCULO'}
            {k === 'statistics' && '📊 DISTRIBUCIÓN DE DATOS'}
            {k === 'kinematics' && '📈 GRÁFICA h(t)'}
            {k === 'ohm'        && '⚡ CIRCUITO ELÉCTRICO'}
          </span>
          <div style={S.canvasWrap}>
            <canvas
              ref={canvasRef}
              width={680}
              height={canvasH}
              style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* Info especial para lectura/inglés/sociales/biología/química */}
      {['reading','english','social','biology','chem','periodic'].includes(k) && (
        <div style={{ ...S.infoBox, borderColor: color + '40', background: color + '08' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '.06em', textTransform: 'uppercase' as const }}>
            {k === 'reading'  && '📖 Lectura crítica — Lee el texto completo antes de elegir'}
            {k === 'english'  && '🌐 English — Try each option in the sentence before choosing'}
            {k === 'social'   && '🗺️ Sociales — Ubica: época · lugar · actores · consecuencia'}
            {k === 'biology'  && '🌿 Biología — Identifica nivel: célula → tejido → órgano → sistema'}
            {k === 'chem'     && '⚗️ Química — Antes de → : Reactivos  |  Después de → : Productos'}
            {k === 'periodic' && '🧪 Tabla periódica — Z = protones = e⁻  |  Período = nº de capas'}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  wrap:       { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 },
  row:        { display: 'flex', flexDirection: 'column', gap: 6 },
  micro:      { fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' as const },
  chips:      { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip:       { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 14px', borderRadius: 10, border: '1px solid', background: 'rgba(255,255,255,0.03)', minWidth: 70 },
  chipLbl:    { fontSize: 9, color: '#6e7681', textTransform: 'uppercase' as const, letterSpacing: '.06em', fontWeight: 600 },
  chipVal:    { fontSize: 15, fontWeight: 800, fontFamily: "'Courier New', monospace", marginTop: 2 },
  formulaBox: { background: '#0d1117', border: '1px solid', borderRadius: 10, padding: '14px 20px', minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  canvasWrap: { background: '#0d1117', border: '1px solid #21262d', borderRadius: 10, padding: '12px 8px', display: 'flex', justifyContent: 'center' },
  infoBox:    { border: '1px solid', borderRadius: 10, padding: '12px 16px' },
};
