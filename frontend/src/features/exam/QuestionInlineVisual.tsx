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

// ── Detección de tipo ─────────────────────────────────────────────────────────
type Kind =
  | 'commercial' | 'pythagoras' | 'circle' | 'statistics'
  | 'energy' | 'kinematics' | 'ohm' | 'force'
  | 'rectangle' | 'triangle_area' | 'percentage' | 'volume'
  | 'chem' | 'periodic' | 'biology'
  | 'reading' | 'english' | 'social' | 'none';

function kind(area: string, stem: string): Kind {
  const t = (area + ' ' + stem).toLowerCase();

  // ── Energía: ANTES de cinemática para evitar falsos positivos con g=10/h ───
  // Detecta Ep=mgh, Ec=½mv², trabajo, potencial gravitacional
  if (/energ[ií]a|joule|kilojoule|\bEp\b|\bEc\b|potencial.*grav|cin[eé]tica.*masa|trabajo.*realiz|trabajo.*joule/.test(t)) return 'energy';

  // ── Nuevos tipos (específicos) ────────────────────────────────────────────
  if (/[áa]rea.*tri[áa]ngulo|tri[áa]ngulo.*[áa]rea|base.*altura/.test(t)
      && !/pit[áa]gor|cateto|hipotenusa/.test(t)) return 'triangle_area';

  if ((/per[ií]metro|rect[áa]ngul[oa]|lote.*mide|mide.*largo|largo.*ancho|ancho.*largo|cuadrado.*lado/).test(t)
      && !/tri[áa]ngulo|cateto|hipotenusa|pit[áa]gor/.test(t)) return 'rectangle';

  if (/qu[eé].*porcentaje|representan.*del.*total|tanto.*por.*ciento/.test(t)) return 'percentage';

  if (/volumen.*(?:caja|piscina|depósito|prisma|cubo|cilindro)|(?:caja|prisma).*volumen/.test(t)) return 'volume';

  // ── Tipos existentes ──────────────────────────────────────────────────────
  if (/descuento|cu[aá]nto paga|precio.*total|rebaja|iva.*precio|unidades.*precio/.test(t)) return 'commercial';
  if (/pit[áa]gor|cateto|hipotenusa|tri[áa]ngulo.*rect/.test(t)) return 'pythagoras';
  if (/c[ií]rculo|circunferencia|radio\s*=|[aá]rea.*c[ií]rc/.test(t)) return 'circle';
  if (/\bmedia\b|\bmediana\b|\bmoda\b|los datos son|puntajes.*son|promedio de los/.test(t)) return 'statistics';

  // Cinemática: solo palabras que indican movimiento parabólico/libre (sin g=10 solo)
  if (/velocidad.*inicial|lanza.*(?:arriba|verticalmente|horizontalmente)|tiro.*parab|proyectil|ca[ií]da.*libre|altura.*m[aá]xima.*vel|vel.*inicial.*m\/s/.test(t)) return 'kinematics';

  if (/resistencia|ley.*ohm|voltaje|corriente.*amp|amperio|ohmio/.test(t)) return 'ohm';
  if (/fuerza.*newton|segunda.*ley|aceleraci[oó]n.*m\/s|masa.*aceler/.test(t)) return 'force';
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

// ── Extracción inteligente de valores físicos ─────────────────────────────────
function parseOhm(stem: string) {
  const rM = stem.match(/(\d+(?:[.,]\d+)?)\s*(?:ohm(?:io)?s?|Ω)/i);
  const vM = stem.match(/(\d+(?:[.,]\d+)?)\s*(?:voltio|volt(?:s|ios)?|V(?=\s|[.,)]|$))/i);
  const iM = stem.match(/(\d+(?:[.,]\d+)?)\s*(?:amp(?:erio)?s?|A(?=\s|[.,)]|$))/i);
  const s = stem.toLowerCase();
  const asking = /corriente/.test(s) ? 'I' : /voltaje|tensi[oó]n/.test(s) ? 'V' : 'R';
  return {
    R: rM ? parseFloat(rM[1].replace(',', '.')) : null,
    V: vM ? parseFloat(vM[1].replace(',', '.')) : null,
    I: iM ? parseFloat(iM[1].replace(',', '.')) : null,
    asking,
  };
}

function parseEnergy(stem: string) {
  const mM  = stem.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  // height: number followed by "m" but NOT "m/s"
  const hM  = stem.match(/(\d+(?:[.,]\d+)?)\s*m(?!\s*\/)/i);
  const gM  = stem.match(/g\s*=\s*(\d+(?:[.,]\d+)?)/i);
  const vM  = stem.match(/v\s*=\s*(\d+(?:[.,]\d+)?)/i);
  const t   = stem.toLowerCase();
  const isKinetic = /cin[eé]tica|velocidad/.test(t);
  return {
    m:        mM  ? parseFloat(mM[1].replace(',', '.'))  : null,
    h:        hM  ? parseFloat(hM[1].replace(',', '.'))  : null,
    g:        gM  ? parseFloat(gM[1].replace(',', '.'))  : 10,
    v:        vM  ? parseFloat(vM[1].replace(',', '.'))  : null,
    isKinetic,
  };
}

// ── Canvas: triángulo rectángulo ──────────────────────────────────────────────
function drawTriangle(cv: HTMLCanvasElement, a: number, b: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  const sc = Math.min((W - 70) / b, (H - 50) / a) * 0.85;
  const ox = 35, oy = H - 28;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#21262d'; ctx.lineWidth = 0.4;
  for (let i = 0; i <= Math.ceil(b) + 1; i++) { ctx.beginPath(); ctx.moveTo(ox + i * sc, 18); ctx.lineTo(ox + i * sc, oy); ctx.stroke(); }
  for (let i = 0; i <= Math.ceil(a) + 1; i++) { ctx.beginPath(); ctx.moveTo(ox, oy - i * sc); ctx.lineTo(ox + (b + 1) * sc, oy - i * sc); ctx.stroke(); }
  ctx.fillStyle = color + '14';
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + b * sc, oy); ctx.lineTo(ox + b * sc, oy - a * sc); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + b * sc, oy); ctx.lineTo(ox + b * sc, oy - a * sc); ctx.closePath(); ctx.stroke();
  const rs = 10; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ox + b * sc - rs, oy); ctx.lineTo(ox + b * sc - rs, oy - rs); ctx.lineTo(ox + b * sc, oy - rs); ctx.stroke();
  ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 12px Segoe UI';
  ctx.fillText('A', ox - 16, oy + 4); ctx.fillText('B', ox + b * sc + 5, oy + 4); ctx.fillText('C', ox + b * sc + 5, oy - a * sc - 4);
  ctx.fillStyle = color; ctx.font = 'bold 11px Courier New,monospace';
  ctx.fillText(`b=${b}`, ox + b * sc / 2 - 16, oy + 16);
  ctx.fillText(`a=${a}`, ox + b * sc + 6, oy - a * sc / 2 + 4);
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 11px Courier New,monospace';
  ctx.fillText('c=?', ox + b * sc / 2 - 36, oy - a * sc / 2 - 6);
}

// ── Canvas: rectángulo ────────────────────────────────────────────────────────
function drawRectangle(cv: HTMLCanvasElement, largo: number, ancho: number, color: string, askArea: boolean) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  const mx = 58, my = 22, rw = W - mx * 2, rh = H - my * 2 - 18;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#21262d'; ctx.lineWidth = 0.4;
  for (let x = mx; x <= mx + rw; x += 22) { ctx.beginPath(); ctx.moveTo(x, my); ctx.lineTo(x, my + rh); ctx.stroke(); }
  for (let y = my; y <= my + rh; y += 22) { ctx.beginPath(); ctx.moveTo(mx, y); ctx.lineTo(mx + rw, y); ctx.stroke(); }
  ctx.fillStyle = color + '10'; ctx.fillRect(mx, my, rw, rh);
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.strokeRect(mx, my, rw, rh);
  const rs = 10; ctx.lineWidth = 1.5; ctx.strokeStyle = color + '99';
  ctx.beginPath(); ctx.moveTo(mx + rs, my + rh); ctx.lineTo(mx + rs, my + rh - rs); ctx.lineTo(mx, my + rh - rs); ctx.stroke();
  ctx.fillStyle = color; ctx.font = 'bold 11px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText(`l = ${largo}`, mx + rw / 2, my - 7);
  ctx.fillText(`l = ${largo}`, mx + rw / 2, my + rh + 16);
  ctx.save(); ctx.translate(mx - 26, my + rh / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(`a = ${ancho}`, 0, 0); ctx.restore();
  ctx.save(); ctx.translate(mx + rw + 26, my + rh / 2); ctx.rotate(Math.PI / 2);
  ctx.fillText(`a = ${ancho}`, 0, 0); ctx.restore();
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 14px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText(askArea ? 'A = ?' : 'P = ?', mx + rw / 2, my + rh / 2 + 5);
}

// ── Canvas: triángulo (área base×altura) ──────────────────────────────────────
function drawTriangleArea(cv: HTMLCanvasElement, base: number, altura: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  const sc = Math.min((W - 80) / base, (H - 60) / altura) * 0.82;
  const ox = 40, oy = H - 28;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#21262d'; ctx.lineWidth = 0.4;
  for (let i = 0; i <= Math.ceil(base) + 1; i++) { ctx.beginPath(); ctx.moveTo(ox + i * sc, 18); ctx.lineTo(ox + i * sc, oy); ctx.stroke(); }
  for (let i = 0; i <= Math.ceil(altura) + 1; i++) { ctx.beginPath(); ctx.moveTo(ox, oy - i * sc); ctx.lineTo(ox + (base + 1) * sc, oy - i * sc); ctx.stroke(); }
  ctx.fillStyle = color + '14';
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + base * sc, oy); ctx.lineTo(ox + base * sc / 2, oy - altura * sc); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + base * sc, oy); ctx.lineTo(ox + base * sc / 2, oy - altura * sc); ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
  ctx.beginPath(); ctx.moveTo(ox + base * sc / 2, oy); ctx.lineTo(ox + base * sc / 2, oy - altura * sc); ctx.stroke(); ctx.setLineDash([]);
  const rs = 8; ctx.lineWidth = 1.2; ctx.strokeStyle = '#3fb95099';
  ctx.beginPath(); ctx.moveTo(ox + base * sc / 2 - rs, oy); ctx.lineTo(ox + base * sc / 2 - rs, oy - rs); ctx.lineTo(ox + base * sc / 2, oy - rs); ctx.stroke();
  ctx.fillStyle = color; ctx.font = 'bold 11px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText(`base = ${base}`, ox + base * sc / 2, oy + 16);
  ctx.fillStyle = '#3fb950'; ctx.textAlign = 'left';
  ctx.fillText(`h = ${altura}`, ox + base * sc / 2 + 4, oy - altura * sc / 2);
  ctx.fillStyle = '#f85149'; ctx.textAlign = 'center';
  ctx.fillText('A = ?', ox + base * sc / 2, oy - altura * sc / 2 - 14);
}

// ── Canvas: energía potencial / cinética ──────────────────────────────────────
function drawEnergy(
  cv: HTMLCanvasElement,
  m: number, h: number, g: number,
  isKinetic: boolean,
  color: string,
) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  const ground = H - 22;          // y de la línea del suelo
  const objR   = 20;              // radio del objeto
  const objX   = W * 0.52;       // x del objeto (ligeramente a la derecha del centro)

  // Línea del suelo
  ctx.strokeStyle = '#444c56'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(24, ground); ctx.lineTo(W - 24, ground); ctx.stroke();
  // Rayas del suelo
  ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1;
  for (let x = 34; x < W - 24; x += 18) {
    ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x - 9, ground + 9); ctx.stroke();
  }

  if (!isKinetic) {
    // ── ENERGÍA POTENCIAL: objeto elevado a altura h ──────────────────────────
    // Disponible sobre el suelo: desde top (14px) hasta ground - objR*2 - 10
    const topMargin = 14;
    const hPx = ground - topMargin - objR * 2 - 10;   // píxeles disponibles para la flecha h
    const objCY = topMargin + objR + 8;               // centro Y del objeto (parte superior)

    // Dibujar objeto (círculo con masa)
    ctx.fillStyle = color + '20';
    ctx.beginPath(); ctx.arc(objX, objCY, objR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(objX, objCY, objR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color; ctx.font = 'bold 11px Courier New,monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${m} kg`, objX, objCY + 4);

    // Flecha de altura (izquierda del objeto, vertical doble flecha)
    const ax = objX - 55;
    ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(ax, objCY); ctx.lineTo(ax, ground); ctx.stroke();
    ctx.setLineDash([]);
    // Flecha hacia arriba (en objCY)
    ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ax - 5, objCY + 8); ctx.lineTo(ax, objCY); ctx.lineTo(ax + 5, objCY + 8); ctx.stroke();
    // Flecha hacia abajo (en ground)
    ctx.beginPath(); ctx.moveTo(ax - 5, ground - 8); ctx.lineTo(ax, ground); ctx.lineTo(ax + 5, ground - 8); ctx.stroke();
    // Etiqueta h
    ctx.fillStyle = '#3fb950'; ctx.font = 'bold 11px Courier New,monospace'; ctx.textAlign = 'right';
    ctx.fillText(`h = ${h} m`, ax - 6, (objCY + ground) / 2 + 4);

    // Flecha de gravedad g (baja desde el objeto)
    const gx = objX + objR + 14;
    ctx.strokeStyle = '#f85149'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gx, objCY - 8); ctx.lineTo(gx, objCY + 28); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx - 5, objCY + 19); ctx.lineTo(gx, objCY + 28); ctx.lineTo(gx + 5, objCY + 19); ctx.stroke();
    ctx.fillStyle = '#f85149'; ctx.font = 'bold 10px Courier New,monospace'; ctx.textAlign = 'left';
    ctx.fillText(`g = ${g} m/s²`, gx + 6, objCY + 8);

    // Ep = ? (esquina derecha-superior)
    ctx.fillStyle = '#f85149'; ctx.font = 'bold 13px Courier New,monospace'; ctx.textAlign = 'right';
    ctx.fillText('Ep = ?', W - 16, objCY - 6);

    // Línea punteada vertical desde objeto al suelo (referencia visual)
    ctx.strokeStyle = color + '30'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(objX, objCY + objR); ctx.lineTo(objX, ground); ctx.stroke();
    ctx.setLineDash([]);

    // Etiqueta nivel de referencia
    ctx.fillStyle = '#4a5568'; ctx.font = '9px Courier New'; ctx.textAlign = 'center';
    ctx.fillText('nivel de referencia  (Ep = 0)', W / 2 + 20, ground + 14);

  } else {
    // ── ENERGÍA CINÉTICA: objeto en movimiento horizontal ────────────────────
    const objCY = ground - 55;
    // Flecha de velocidad
    ctx.strokeStyle = '#58a6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W * 0.28, objCY); ctx.lineTo(W * 0.76, objCY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.76 - 10, objCY - 6); ctx.lineTo(W * 0.76, objCY); ctx.lineTo(W * 0.76 - 10, objCY + 6); ctx.stroke();
    ctx.fillStyle = '#58a6ff'; ctx.font = 'bold 10px Courier New,monospace'; ctx.textAlign = 'center';
    ctx.fillText('v  →', W / 2, objCY - 10);
    // Objeto
    ctx.fillStyle = color + '20';
    ctx.beginPath(); ctx.arc(W * 0.22, objCY, objR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(W * 0.22, objCY, objR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = color; ctx.font = 'bold 11px Courier New,monospace'; ctx.textAlign = 'center';
    ctx.fillText(`${m} kg`, W * 0.22, objCY + 4);
    // Ec = ?
    ctx.fillStyle = '#f85149'; ctx.font = 'bold 13px Courier New,monospace'; ctx.textAlign = 'right';
    ctx.fillText('Ec = ?', W - 16, objCY + 4);
  }
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
  ctx.fillStyle = '#f85149'; ctx.beginPath(); ctx.arc(px + gw / 2, py, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f85149'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(px + gw / 2, py); ctx.lineTo(px + gw / 2, py + gh); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = color; ctx.font = 'bold 10px Segoe UI'; ctx.fillText(`h(t) = ${v0}t − ${g / 2}t²`, px + 4, py + 14);
  ctx.fillStyle = '#f85149'; ctx.font = '9px Courier New,monospace'; ctx.fillText('h_max', px + gw / 2 + 4, py + 10);
  ctx.fillStyle = '#6e7681'; ctx.font = '9px Courier New'; ctx.fillText('0', px - 10, py + gh + 14); ctx.fillText(ttot + 's', px + gw - 14, py + gh + 14);
  ctx.fillText(hmax + 'm', 2, py + 4);
}

// ── Canvas: fuerza (F = m·a) ──────────────────────────────────────────────────
function drawForce(cv: HTMLCanvasElement, m: number, a: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const ground = H - 20;
  ctx.strokeStyle = '#444c56'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(20, ground); ctx.lineTo(W - 20, ground); ctx.stroke();
  ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1;
  for (let x = 30; x < W - 20; x += 16) { ctx.beginPath(); ctx.moveTo(x, ground); ctx.lineTo(x - 8, ground + 8); ctx.stroke(); }
  const bw = 70, bh = 50, bx = W / 2 - bw / 2, by = ground - bh;
  ctx.fillStyle = color + '20'; ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = color; ctx.font = 'bold 12px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText(`${m} kg`, bx + bw / 2, by + bh / 2 + 4);
  const ay = ground - bh / 2, arrowLen = 72;
  ctx.strokeStyle = '#f85149'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(bx + bw, ay); ctx.lineTo(bx + bw + arrowLen, ay); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + bw + arrowLen - 9, ay - 6); ctx.lineTo(bx + bw + arrowLen, ay); ctx.lineTo(bx + bw + arrowLen - 9, ay + 6); ctx.stroke();
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 11px Courier New,monospace'; ctx.textAlign = 'left';
  ctx.fillText('F = ?', bx + bw + arrowLen + 6, ay + 4);
  ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(bx + 6, by - 14); ctx.lineTo(bx + bw - 6, by - 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + bw - 14, by - 20); ctx.lineTo(bx + bw - 6, by - 14); ctx.lineTo(bx + bw - 14, by - 8); ctx.stroke();
  ctx.fillStyle = '#3fb950'; ctx.font = 'bold 10px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText(`a = ${a} m/s²`, bx + bw / 2, by - 18);
}

// ── Canvas: volumen (caja 3D) ─────────────────────────────────────────────────
function drawVolume(cv: HTMLCanvasElement, l: number, w: number, h: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const ox = W * 0.28, oy = H * 0.65, sc = Math.min((W * 0.45) / Math.max(l, 1), (H * 0.45) / Math.max(h, 1)) * 0.85;
  const rw = l * sc, rh = h * sc, sk = w * sc * 0.45;  // skew for depth
  // Front face
  ctx.fillStyle = color + '18'; ctx.beginPath();
  ctx.moveTo(ox, oy); ctx.lineTo(ox + rw, oy); ctx.lineTo(ox + rw, oy - rh); ctx.lineTo(ox, oy - rh); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
  // Top face
  ctx.fillStyle = color + '28'; ctx.beginPath();
  ctx.moveTo(ox, oy - rh); ctx.lineTo(ox + sk, oy - rh - sk * 0.55); ctx.lineTo(ox + rw + sk, oy - rh - sk * 0.55); ctx.lineTo(ox + rw, oy - rh); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  // Right face
  ctx.fillStyle = color + '10'; ctx.beginPath();
  ctx.moveTo(ox + rw, oy); ctx.lineTo(ox + rw + sk, oy - sk * 0.55); ctx.lineTo(ox + rw + sk, oy - rh - sk * 0.55); ctx.lineTo(ox + rw, oy - rh); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  // Labels
  ctx.fillStyle = color; ctx.font = 'bold 10px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText(`l = ${l}`, ox + rw / 2, oy + 14);
  ctx.save(); ctx.translate(ox + rw + sk / 2 + 14, oy - rh / 2 - sk * 0.28); ctx.rotate(0.4);
  ctx.fillText(`a = ${w}`, 0, 0); ctx.restore();
  ctx.save(); ctx.translate(ox - 18, oy - rh / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(`h = ${h}`, 0, 0); ctx.restore();
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 13px Courier New,monospace'; ctx.textAlign = 'right';
  ctx.fillText('V = ?', W - 10, 20);
}

// ── Canvas: porcentaje (pastel) ───────────────────────────────────────────────
function drawPercentage(cv: HTMLCanvasElement, pct: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height, cx = W * 0.38, cy = H / 2, cr = Math.min(cx, cy) - 20;
  ctx.clearRect(0, 0, W, H);
  const angle = (Math.min(pct, 100) / 100) * Math.PI * 2;
  // Full circle
  ctx.fillStyle = '#21262d'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1.5; ctx.stroke();
  // Portion
  ctx.fillStyle = color + '70'; ctx.beginPath();
  ctx.moveTo(cx, cy); ctx.arc(cx, cy, cr, -Math.PI / 2, -Math.PI / 2 + angle); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
  // Center hole
  ctx.fillStyle = '#0d1117'; ctx.beginPath(); ctx.arc(cx, cy, cr * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.font = 'bold 14px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText(`${pct > 0 ? pct + '%' : '?'}`, cx, cy + 5);
  // Legend
  ctx.font = 'bold 10px Courier New,monospace'; ctx.textAlign = 'left';
  ctx.fillStyle = color; ctx.fillRect(cx + cr + 16, cy - 22, 12, 12);
  ctx.fillStyle = '#e6edf3'; ctx.fillText('parte', cx + cr + 32, cy - 12);
  ctx.fillStyle = '#21262d'; ctx.fillRect(cx + cr + 16, cy - 2, 12, 12);
  ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1; ctx.strokeRect(cx + cr + 16, cy - 2, 12, 12);
  ctx.fillStyle = '#8b949e'; ctx.fillText('resto', cx + cr + 32, cy + 8);
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 11px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText('% = parte/total × 100', W / 2 + 14, H - 10);
}

// ── Canvas: descuento comercial ───────────────────────────────────────────────
function drawCommercial(cv: HTMLCanvasElement, price: number, pct: number, color: string) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const bx = 36, bw = W - 72, barH = 26, by = H / 2 - barH / 2 - 12;
  // Price bar (full)
  ctx.fillStyle = '#21262d'; ctx.fillRect(bx, by, bw, barH); ctx.strokeStyle = '#30363d'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, barH);
  // Discount portion
  const dw = Math.min((pct / 100) * bw, bw);
  ctx.fillStyle = '#f85149' + '40'; ctx.fillRect(bx, by, dw, barH);
  ctx.strokeStyle = '#f85149'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, dw, barH);
  // Remaining (to pay)
  ctx.fillStyle = color + '30'; ctx.fillRect(bx + dw, by, bw - dw, barH);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.strokeRect(bx + dw, by, bw - dw, barH);
  ctx.fillStyle = '#e6edf3'; ctx.font = 'bold 11px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText(`$${price.toLocaleString('es-CO')}`, bx + bw / 2, by - 8);
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 10px Courier New,monospace';
  if (dw > 24) ctx.fillText(`−${pct}%`, bx + dw / 2, by + barH / 2 + 4);
  ctx.fillStyle = color;
  if (bw - dw > 30) ctx.fillText('pagar', bx + dw + (bw - dw) / 2, by + barH / 2 + 4);
  // Arrow down to result
  const rx = bx + dw + (bw - dw) / 2;
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(rx, by + barH + 4); ctx.lineTo(rx, by + barH + 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(rx - 5, by + barH + 14); ctx.lineTo(rx, by + barH + 20); ctx.lineTo(rx + 5, by + barH + 14); ctx.stroke();
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 13px Courier New,monospace'; ctx.textAlign = 'center';
  ctx.fillText('P_final = ?', rx, by + barH + 36);
}

// ── Canvas: circuito Ohm ──────────────────────────────────────────────────────
function drawCircuit(
  cv: HTMLCanvasElement,
  ohmR: number | null, ohmV: number | null, ohmI: number | null,
  asking: string, color: string,
) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const l = 44, t = 24, w = W - 90, h = 72;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.strokeRect(l, t, w, h);
  ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(l, t + 18); ctx.lineTo(l, t + h - 18); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(l - 7, t + 22); ctx.lineTo(l + 7, t + 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(l - 4, t + 30); ctx.lineTo(l + 4, t + 30); ctx.stroke();
  const rx = l + w / 2 - 28;
  ctx.strokeStyle = '#d29922'; ctx.lineWidth = 1.5; ctx.strokeRect(rx, t - 10, 56, 20);
  ctx.fillStyle = '#161b22'; ctx.fillRect(rx + 1, t - 9, 54, 18);
  ctx.strokeStyle = '#d29922'; ctx.lineWidth = 1.2; ctx.beginPath();
  const zig = [rx + 3, t + 1, rx + 10, t - 7, rx + 18, t + 1, rx + 25, t - 7, rx + 33, t + 1, rx + 40, t - 7, rx + 52, t + 1];
  ctx.moveTo(zig[0], zig[1]);
  for (let i = 1; i < 7; i++) ctx.lineTo(zig[i * 2], zig[i * 2 + 1]);
  ctx.stroke();
  const ax = l + w, ay = t + h / 2;
  ctx.strokeStyle = '#f85149'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ax, ay, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#1a0707'; ctx.beginPath(); ctx.arc(ax, ay, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 12px Courier New'; ctx.textAlign = 'center'; ctx.fillText('A', ax, ay + 4); ctx.textAlign = 'left';
  const vLabel = ohmV !== null ? `V=${ohmV}V` : (asking === 'V' ? 'V=?' : 'V');
  const iLabel = ohmI !== null ? `I=${ohmI}A` : (asking === 'I' ? 'I=?' : 'I');
  const rLabel = ohmR !== null ? `R=${ohmR}Ω` : (asking === 'R' ? 'R=?' : 'R');
  ctx.fillStyle = '#3fb950'; ctx.font = 'bold 10px Courier New'; ctx.fillText(vLabel, l - 40, t + h / 2 - 4);
  ctx.fillStyle = '#f85149'; ctx.font = 'bold 10px Courier New'; ctx.fillText(iLabel, ax + 16, ay + 4);
  ctx.fillStyle = '#d29922'; ctx.font = 'bold 10px Courier New'; ctx.fillText(rLabel, rx + 4, t - 12);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  FÓRMULA PURA (sin datos) — exportada para el botón "¿Ver fórmula?"
// ═══════════════════════════════════════════════════════════════════════════════
export interface PureFormula {
  tex: string;
  isLatex: boolean;
  label: string;
  vars?: string;     // descripción de variables (sin datos específicos)
}

export function getPureFormula(area: string, stem: string): PureFormula | null {
  const k = kind(area, stem);
  const t = (area + ' ' + stem).toLowerCase();

  switch (k) {
    case 'energy':
      if (/cin[eé]tica|velocidad/.test(t))
        return {
          tex: 'E_c = \\dfrac{1}{2}\\,m\\,v^2',
          isLatex: true,
          label: 'Energía cinética',
          vars: 'm = masa del objeto (kg)  ·  v = velocidad (m/s)  →  resultado en Joules (J)',
        };
      return {
        tex: 'E_p = m \\cdot g \\cdot h',
        isLatex: true,
        label: 'Energía potencial gravitacional',
        vars: 'm = masa (kg)  ·  g = aceleración gravitacional (m/s²)  ·  h = altura sobre el nivel de referencia (m)  →  resultado en Joules (J)',
      };

    case 'pythagoras':
      return {
        tex: 'c = \\sqrt{a^2 + b^2}',
        isLatex: true,
        label: 'Teorema de Pitágoras',
        vars: 'a, b = catetos (lados que forman el ángulo recto)  ·  c = hipotenusa (lado opuesto al ángulo recto)',
      };

    case 'triangle_area':
      return {
        tex: 'A = \\dfrac{b \\times h}{2}',
        isLatex: true,
        label: 'Área del triángulo',
        vars: 'b = base  ·  h = altura perpendicular a la base',
      };

    case 'rectangle':
      if (/[áa]rea/.test(t))
        return {
          tex: 'A = l \\times a',
          isLatex: true,
          label: 'Área del rectángulo',
          vars: 'l = largo  ·  a = ancho  →  resultado en unidades²',
        };
      return {
        tex: 'P = 2\\,(l + a)',
        isLatex: true,
        label: 'Perímetro del rectángulo',
        vars: 'l = largo  ·  a = ancho  →  suma de todos los lados',
      };

    case 'percentage':
      return {
        tex: '\\% = \\dfrac{\\text{parte}}{\\text{total}} \\times 100',
        isLatex: true,
        label: 'Porcentaje',
        vars: 'parte = cantidad específica  ·  total = cantidad de referencia',
      };

    case 'volume':
      return {
        tex: 'V = A_{\\!base} \\times h',
        isLatex: true,
        label: 'Volumen del prisma',
        vars: 'A_base = área de la base  ·  h = altura del sólido  →  resultado en unidades³',
      };

    case 'circle':
      return {
        tex: 'A = \\pi r^2 \\qquad C = 2\\pi r',
        isLatex: true,
        label: 'Círculo',
        vars: 'r = radio  ·  A = área  ·  C = circunferencia (perímetro)',
      };

    case 'statistics':
      return {
        tex: '\\bar{x} = \\dfrac{\\displaystyle\\sum x_i}{n}',
        isLatex: true,
        label: 'Media aritmética',
        vars: 'Σxᵢ = suma de todos los datos  ·  n = cantidad de datos',
      };

    case 'kinematics':
      return {
        tex: 'h(t) = v_0\\,t - \\dfrac{1}{2}\\,g\\,t^2',
        isLatex: true,
        label: 'Cinemática — lanzamiento vertical',
        vars: 'v₀ = velocidad inicial (m/s)  ·  g = 10 m/s²  ·  t = tiempo (s)  ·  h_max = v₀²/2g',
      };

    case 'ohm':
      return {
        tex: 'V = I \\cdot R \\quad I = \\dfrac{V}{R} \\quad R = \\dfrac{V}{I}',
        isLatex: true,
        label: 'Ley de Ohm',
        vars: 'V = voltaje (V)  ·  I = corriente (A)  ·  R = resistencia (Ω)',
      };

    case 'force':
      return {
        tex: 'F = m \\cdot a',
        isLatex: true,
        label: 'Segunda Ley de Newton',
        vars: 'F = fuerza (N)  ·  m = masa (kg)  ·  a = aceleración (m/s²)',
      };

    case 'commercial':
      return {
        tex: 'P_{\\!final} = P_{\\!base}\\,(1 - d)',
        isLatex: true,
        label: 'Descuento comercial',
        vars: 'd = descuento en decimal (ej: 20% → d = 0.20)  ·  P_final = precio a pagar',
      };

    case 'chem':
      return {
        tex: '\\text{Reactivos} \\xrightarrow{} \\text{Productos}',
        isLatex: true,
        label: 'Reacción química',
        vars: 'Reactivos = sustancias que reaccionan  ·  Productos = sustancias que se forman  ·  Balancea: átomos iguales a ambos lados',
      };

    case 'periodic':
      return {
        tex: 'Z = p^+ = e^- \\qquad N^0 = A - Z',
        isLatex: true,
        label: 'Tabla periódica',
        vars: 'Z = número atómico  ·  A = masa atómica  ·  N⁰ = número de neutrones',
      };

    case 'biology':
      return {
        tex: '6CO_2 + 6H_2O + \\text{luz} \\rightarrow C_6H_{12}O_6 + 6O_2',
        isLatex: true,
        label: 'Fotosíntesis',
        vars: 'CO₂ = dióxido de carbono  ·  H₂O = agua  ·  luz = energía solar  →  C₆H₁₂O₆ = glucosa  ·  O₂ = oxígeno liberado',
      };

    case 'reading':
      return { tex: 'Idea principal → Argumento de apoyo → Conclusión del autor', isLatex: false, label: 'Estrategia · Lectura crítica' };

    case 'english':
      return { tex: 'Read full context · Eliminate impossible options · Check grammar', isLatex: false, label: 'Strategy · English' };

    case 'social':
      return { tex: 'Ubica: Época · Lugar · Actores · Causa → Consecuencia', isLatex: false, label: 'Estrategia · Sociales' };

    default: {
      const a = area.toLowerCase();
      if (a.includes('matemát'))
        return { tex: 'Identifica los datos → Elige la fórmula → Sustituye → Verifica unidades', isLatex: false, label: 'Estrategia matemática' };
      if (a.includes('ciencia') || a.includes('natural'))
        return { tex: '\\text{Observar}\\!\\rightarrow\\!\\text{Hipótesis}\\!\\rightarrow\\!\\text{Experimento}\\!\\rightarrow\\!\\text{Conclusión}', isLatex: true, label: 'Método científico' };
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function QuestionInlineVisual({ question, color }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const k = kind(question.area, question.stem);
  const n = getNums(question.stem);
  const t = (question.area + ' ' + question.stem).toLowerCase();

  // Params generales
  const pct      = (() => { const m = question.stem.match(/(\d+)\s*%/); return m ? +m[1] : 0; })();
  const prices   = n.filter(x => x >= 100);
  const qtys     = n.filter(x => x < 100 && x >= 1 && x !== pct);
  const a        = (n.filter(x => x < 10000)[0]) || 6;
  const b        = (n.filter(x => x < 10000)[1]) || 8;
  const r        = n[0] || 7;
  const v0       = n.find(x => x >= 5 && x <= 100) || 20;
  const g        = n.find(x => x === 10) || 10;
  const ohm      = parseOhm(question.stem);
  const energy   = parseEnergy(question.stem);
  const statsData = [...n.filter(x => x < 10000 && x > 0)].sort((a, b) => a - b);

  // Rectángulo
  const largoM = question.stem.match(/(\d+(?:[.,]\d+)?)\s*m?\s*de\s*largo/i);
  const anchoM = question.stem.match(/(\d+(?:[.,]\d+)?)\s*m?\s*de\s*ancho/i);
  const ladoM  = question.stem.match(/(\d+(?:[.,]\d+)?)\s*m?\s*de\s*lado/i);
  const rectLargo = largoM ? parseFloat(largoM[1]) : (n[0] || 10);
  const rectAncho = anchoM ? parseFloat(anchoM[1]) : (ladoM ? parseFloat(ladoM[1]) : (n[1] || 5));
  const rectAskArea = /[áa]rea/.test(t);

  // Triángulo base-altura
  const baseM = question.stem.match(/base.*?(\d+(?:[.,]\d+)?)/i);
  const altM  = question.stem.match(/altura.*?(\d+(?:[.,]\d+)?)/i);
  const trBase = baseM ? parseFloat(baseM[1]) : (n[0] || 8);
  const trAlt  = altM  ? parseFloat(altM[1])  : (n[1] || 6);

  // Force params
  const forceM = n.find(x => x < 1000) ?? 5;
  const forceA = n.filter(x => x < 100)[1] ?? 2;

  // Volume params
  const volNums = n.filter(x => x < 1000 && x > 0);
  const volL = volNums[0] ?? 5, volW = volNums[1] ?? 3, volH = volNums[2] ?? volNums[1] ?? 4;

  // Commercial params
  const commPrice = n.filter(x => x >= 100)[0] ?? 50000;
  const commPct   = pct > 0 ? pct : (n.find(x => x > 0 && x <= 100) ?? 20);

  const hasCanvas = ['pythagoras', 'circle', 'statistics', 'kinematics', 'ohm',
                     'rectangle', 'triangle_area', 'energy',
                     'force', 'volume', 'percentage', 'commercial'].includes(k);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !hasCanvas) return;
    if (k === 'pythagoras')    drawTriangle(cv, a, b, color);
    if (k === 'circle')        drawCircle(cv, r, color);
    if (k === 'statistics')    drawHistogram(cv, statsData.slice(0, 10), color);
    if (k === 'kinematics')    drawKinematics(cv, v0, g, color);
    if (k === 'ohm')           drawCircuit(cv, ohm.R, ohm.V, ohm.I, ohm.asking, color);
    if (k === 'rectangle')     drawRectangle(cv, rectLargo, rectAncho, color, rectAskArea);
    if (k === 'triangle_area') drawTriangleArea(cv, trBase, trAlt, color);
    if (k === 'energy')        drawEnergy(cv, energy.m ?? 2, energy.h ?? 30, energy.g, energy.isKinetic, color);
    if (k === 'force')         drawForce(cv, forceM, forceA, color);
    if (k === 'volume')        drawVolume(cv, volL, volW, volH, color);
    if (k === 'percentage')    drawPercentage(cv, pct, color);
    if (k === 'commercial')    drawCommercial(cv, commPrice, commPct, color);
  }, [k, question.id, color]);

  if (k === 'none') return null;

  const chips: { label: string; val: string }[] = (() => {
    if (k === 'energy') {
      const em = energy.m ?? 2, eh = energy.h ?? 30, eg = energy.g;
      if (energy.isKinetic) return [
        { label: 'Masa m',       val: `${em} kg` },
        { label: 'Velocidad v',  val: `${energy.v ?? v0} m/s` },
        { label: 'Ec',           val: '?' },
      ];
      return [
        { label: 'Masa m',   val: `${em} kg` },
        { label: 'Altura h', val: `${eh} m` },
        { label: 'g',        val: `${eg} m/s²` },
        { label: 'Ep',       val: '?' },
      ];
    }
    if (k === 'commercial') return [
      { label: 'Cantidad', val: `${qtys[0] || 1}` },
      { label: 'Precio unit.', val: prices[0] ? `$${prices[0].toLocaleString('es-CO')}` : '?' },
      { label: 'Descuento', val: `${pct}%` },
      { label: 'Total final', val: '?' },
    ];
    if (k === 'pythagoras') return [
      { label: 'Cateto a', val: `${a}` },
      { label: 'Cateto b', val: `${b}` },
      { label: 'Hipotenusa c', val: '?' },
    ];
    if (k === 'rectangle') return [
      { label: 'Largo l',  val: `${rectLargo}` },
      { label: 'Ancho a',  val: `${rectAncho}` },
      { label: rectAskArea ? 'Área A' : 'Perímetro P', val: '?' },
    ];
    if (k === 'triangle_area') return [
      { label: 'Base b',   val: `${trBase}` },
      { label: 'Altura h', val: `${trAlt}` },
      { label: 'Área A',   val: '?' },
    ];
    if (k === 'circle') return [
      { label: 'Radio r',   val: `${r}` },
      { label: 'Diámetro',  val: `${2 * r}` },
      { label: 'Área A',    val: '?' },
      { label: 'Perímetro C', val: '?' },
    ];
    if (k === 'kinematics') return [
      { label: 'v₀',     val: `${v0} m/s` },
      { label: 'g',      val: `${g} m/s²` },
      { label: 'h_max',  val: '?' },
      { label: 't total', val: '?' },
    ];
    if (k === 'ohm') {
      const { R, V, I, asking } = ohm;
      return [
        { label: 'R', val: R !== null ? `${R} Ω` : '?' },
        { label: 'V', val: V !== null ? `${V} V` : '?' },
        { label: 'I', val: I !== null ? `${I} A` : '?' },
      ].map(item => ({ ...item, val: item.label === asking ? '?' : item.val }));
    }
    if (k === 'statistics' && statsData.length > 0) {
      const s = statsData.reduce((a, b) => a + b, 0);
      return [
        { label: 'n datos', val: `${statsData.length}` },
        { label: 'Suma Σ',  val: `${s}` },
        { label: 'Media x̄', val: '?' },
        { label: 'Mediana', val: '?' },
      ];
    }
    if (k === 'percentage') return [
      { label: 'Parte',      val: `${n[0] || '?'}` },
      { label: 'Total',      val: `${prices[0] || n[1] || '?'}` },
      { label: 'Porcentaje', val: pct > 0 ? `${pct}%` : '?' },
    ];
    if (k === 'volume') return [
      { label: 'Largo l',  val: `${volL}` },
      { label: 'Ancho a',  val: `${volW}` },
      { label: 'Altura h', val: `${volH}` },
      { label: 'Volumen',  val: '?' },
    ];
    if (k === 'force') return [
      { label: 'Masa m',       val: `${forceM} kg` },
      { label: 'Aceleración a', val: `${forceA} m/s²` },
      { label: 'Fuerza F',     val: '?' },
    ];
    if (k === 'biology') return [
      { label: 'Nivel',      val: 'Célula → Tejido' },
      { label: 'Proceso',    val: 'Fotosíntesis' },
      { label: 'Energía',    val: 'Luz solar' },
    ];
    if (k === 'chem') return [
      { label: 'Reactivos',  val: '→' },
      { label: 'Productos',  val: 'CO₂ + H₂O' },
      { label: 'Bal. átomos', val: '?' },
    ];
    if (k === 'periodic') {
      const zM = question.stem.match(/[Zz]\s*=\s*(\d+)|número\s*atómico\s*(?:es|de|:)?\s*(\d+)/i);
      const aM = question.stem.match(/[Aa]\s*=\s*(\d+)|masa\s*atómica\s*(?:es|de|:)?\s*(\d+)/i);
      const Z = zM ? +(zM[1] || zM[2]) : null;
      const A = aM ? +(aM[1] || aM[2]) : null;
      return [
        { label: 'Z (protones)', val: Z !== null ? `${Z}` : '?' },
        { label: 'A (masa)',     val: A !== null ? `${A}` : '?' },
        { label: 'N⁰ neutrones', val: Z !== null && A !== null ? `${A - Z}` : '?' },
      ];
    }
    return [];
  })();

  const canvasH = k === 'ohm' ? 130 : k === 'commercial' ? 110 : 165;

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

      {/* Canvas */}
      {hasCanvas && (
        <div style={S.row}>
          <span style={{ ...S.micro, color }}>
            {k === 'energy'        && (energy.isKinetic ? '⚡ DIAGRAMA — ENERGÍA CINÉTICA' : '🌍 DIAGRAMA — ENERGÍA POTENCIAL GRAVITACIONAL')}
            {k === 'pythagoras'    && '📐 DIAGRAMA — TRIÁNGULO RECTÁNGULO'}
            {k === 'triangle_area' && '📐 DIAGRAMA — TRIÁNGULO (BASE × ALTURA)'}
            {k === 'rectangle'     && '▭ DIAGRAMA — ' + (rectAskArea ? 'ÁREA' : 'PERÍMETRO') + ' DEL RECTÁNGULO'}
            {k === 'circle'        && '⭕ FIGURA: CÍRCULO'}
            {k === 'statistics'    && '📊 DISTRIBUCIÓN DE DATOS'}
            {k === 'kinematics'    && '📈 GRÁFICA h(t) — LANZAMIENTO VERTICAL'}
            {k === 'ohm'           && '⚡ CIRCUITO ELÉCTRICO'}
            {k === 'force'         && '🔴 DIAGRAMA DE FUERZAS — SEGUNDA LEY DE NEWTON'}
            {k === 'volume'        && '📦 DIAGRAMA — VOLUMEN DEL SÓLIDO'}
            {k === 'percentage'    && '🥧 DIAGRAMA — PORCENTAJE'}
            {k === 'commercial'    && '💰 DIAGRAMA — DESCUENTO COMERCIAL'}
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

      {/* Info para lectura/inglés/sociales/biología/química */}
      {['reading', 'english', 'social', 'biology', 'chem', 'periodic'].includes(k) && (
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
