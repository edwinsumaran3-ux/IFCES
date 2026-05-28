// =============================================================================
//  QuestionVisualPanel.tsx — Guía visual por tipo de problema (MathJax + Canvas)
//  Principio: GUIAR el proceso, NO revelar la respuesta final
// =============================================================================
import React, { useEffect, useRef } from 'react';

declare const MathJax: { typesetPromise: (nodes?: HTMLElement[]) => Promise<void> };

interface Option   { label: string; text: string }
interface Question { id: string; stem: string; options: Option[]; area: string; points: number; difficulty?: string }
interface Props    { question: Question; onClose: () => void }

// ── Componente para fórmulas LaTeX via MathJax ────────────────────────────────
function Formula({ tex, block = false, style }: { tex: string; block?: boolean; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = block ? `\\[${tex}\\]` : `\\(${tex}\\)`;
    try { MathJax.typesetPromise([ref.current]).catch(() => {}); } catch {}
  }, [tex, block]);
  return <div ref={ref} style={style} />;
}

// ════════════════════════════════════════════════════════════════════════════
//  DETECCIÓN DE TIPO DE PROBLEMA
// ════════════════════════════════════════════════════════════════════════════
type PType =
  | 'commercial' | 'pythagoras' | 'circle' | 'polygon' | 'system_eq'
  | 'statistics'  | 'kinematics' | 'ohm'   | 'force'
  | 'chem_reaction' | 'chem_periodic' | 'biology' | 'reading' | 'english'
  | 'social' | 'generic';

function detectType(area: string, stem: string): PType {
  const t = (area + ' ' + stem).toLowerCase();
  if (/descuento|cu[aá]nto paga|cu[aá]nto se paga|precio.*total|rebaja|ganancia|iva.*precio|unidades.*precio/.test(t)) return 'commercial';
  if (/pit[aá]gor|cateto|hipotenusa|tri[aá]ngulo.*rect/.test(t)) return 'pythagoras';
  if (/c[ií]rculo|circunferencia|radio\s*=|[aá]rea.*c[ií]rc/.test(t)) return 'circle';
  if (/rect[aá]ngulo|cuadrado|trapecio|rombo|pol[ií]gono|per[ií]metro.*figura/.test(t)) return 'polygon';
  if (/sistema.*ecuac|punto.*intersecc|ecuaciones.*x.*y/.test(t)) return 'system_eq';
  if (/\bmedia\b|\bmediana\b|\bmoda\b|los datos son|puntajes.*son|promedio de los|media aritmé/.test(t)) return 'statistics';
  if (/velocidad.*inicial|lanza.*arriba|altura.*m[aá]xima|ca[ií]da.*libre|g\s*=\s*10\s*m/.test(t)) return 'kinematics';
  if (/resistencia|ley.*ohm|voltaje|corriente.*amp|amperio|ohmio|potencia.*w/.test(t)) return 'ohm';
  if (/fuerza|newton|aceleraci[oó]n|masa.*kg|segunda.*ley/.test(t)) return 'force';
  if (/\bmol\b|combusti[oó]n|balancear|ecuaci[oó]n.*qu[ií]m|reactivo|ch4|co2|h2o/.test(t)) return 'chem_reaction';
  if (/tabla.*peri[oó]dica|n[uú]mero.*at[oó]m|electr[oó]n.*capa|grupo.*per[ií]odo|metal alcalino/.test(t)) return 'chem_periodic';
  if (/biolog|c[eé]lula|adn|gen[eé]t|organismo|ecosistema|evoluci[oó]n|fotosíntesis|mitosis/.test(t)) return 'biology';
  if (area.toLowerCase().includes('lectura') || /fragmento|p[aá]rrafo|inferir.*texto|el autor.*afirma/.test(t)) return 'reading';
  if (area.toLowerCase().includes('ingl') || /\benglish\b|grammar|the passage|according to/.test(t)) return 'english';
  if (area.toLowerCase().includes('social') || /constituci[oó]n|historia.*siglo|revoluci[oó]n|ciudadan/.test(t)) return 'social';
  return 'generic';
}

function getNums(text: string): number[] {
  return [...text.matchAll(/\d+(?:[.,]\d+)?/g)]
    .map(m => parseFloat(m[0].replace(',','.')))
    .filter(n => !isNaN(n) && n > 0);
}

// ════════════════════════════════════════════════════════════════════════════
//  GUÍAS POR TIPO (sin revelar respuesta final)
// ════════════════════════════════════════════════════════════════════════════
interface Guide {
  color: string; icon: string; label: string;
  formulaTex: string;          // LaTeX para MathJax
  steps: string[];             // guía paso a paso (sin la respuesta)
  table: { label: string; value: string; note: string }[];
  trap: string;
  canvas: { type: 'none'|'triangle'|'circle'|'histogram'|'kinematics'|'circuit'; data: Record<string,number> };
}

function buildGuide(type: PType, stem: string, area: string): Guide {
  const n = getNums(stem);

  // ── COMERCIAL ─────────────────────────────────────────────────────────────
  if (type === 'commercial') {
    const pct  = (() => { const m = stem.match(/(\d+)\s*%/); return m ? +m[1] : 0; })();
    const unit = n.filter(x => x >= 100)[0] || 0;
    const qty  = n.filter(x => x < 100 && x >= 1 && x !== pct)[0] || 1;
    const base = qty * unit;
    const fmt  = (v: number) => `$${v.toLocaleString('es-CO')}`;
    return {
      color: '#58a6ff', icon: '🛒', label: 'Matemáticas — Descuento y precio',
      formulaTex: `P_f = P_b \\times \\left(1 - \\frac{${pct}}{100}\\right)`,
      steps: [
        `Identifica los datos: ${qty} unidades × ${fmt(unit)} c/u y descuento del ${pct}%`,
        `Paso 1 — Precio base total: ${qty} × ${fmt(unit)} = ${fmt(base)}`,
        `Paso 2 — Calcula el valor del descuento: ${fmt(base)} × \\(\\frac{${pct}}{100}\\) = ?`,
        `Paso 3 — Precio final = Precio base − Descuento = ?`,
        `Compara tu resultado con cada opción y descarta las trampa`,
      ],
      table: [
        { label: 'Cantidad', value: `${qty} unidades`, note: 'Dato' },
        { label: 'Precio unitario', value: fmt(unit), note: 'Dato' },
        { label: 'Descuento', value: `${pct}%`, note: 'Dato' },
        { label: 'Precio base total', value: fmt(base), note: `${qty}×${fmt(unit)}` },
        { label: 'Monto descuento', value: '?  (tú calculas)', note: `base×${pct}/100` },
        { label: 'Precio final', value: '?  (respuesta)', note: 'base − desc.' },
      ],
      trap: `El precio BASE (${fmt(base)}) suele aparecer como opción trampa. Recuerda que todavía debes aplicar el ${pct}% de descuento antes de dar la respuesta.`,
      canvas: { type: 'none', data: {} },
    };
  }

  // ── PITÁGORAS ──────────────────────────────────────────────────────────────
  if (type === 'pythagoras') {
    const legs = n.slice(0,4).filter(x=>x<10000);
    const a = legs[0] || 6, b = legs[1] || 8;
    return {
      color: '#3fb950', icon: '📐', label: 'Geometría — Teorema de Pitágoras',
      formulaTex: `c = \\sqrt{a^2 + b^2}`,
      steps: [
        `Identifica los catetos: a = ${a} cm (horizontal), b = ${b} cm (vertical)`,
        `Aplica el teorema: c² = a² + b² = ${a}² + ${b}² = ${a*a} + ${b*b} = ${a*a+b*b}`,
        `Despeja c: c = \\(\\sqrt{${a*a+b*b}}\\) = ?  (calcula la raíz cuadrada)`,
        `Área del triángulo = \\(\\frac{base \\times altura}{2}\\) = \\(\\frac{${a} \\times ${b}}{2}\\) = ?`,
        `Verifica: la hipotenusa SIEMPRE es el lado más largo`,
      ],
      table: [
        { label: 'Cateto a', value: `${a} cm`, note: 'Dato' },
        { label: 'Cateto b', value: `${b} cm`, note: 'Dato' },
        { label: 'a²', value: `${a*a}`, note: `${a}×${a}` },
        { label: 'b²', value: `${b*b}`, note: `${b}×${b}` },
        { label: 'a² + b²', value: `${a*a+b*b}`, note: 'Suma' },
        { label: 'Hipotenusa c', value: `√${a*a+b*b} = ?`, note: 'Tú calculas' },
      ],
      trap: `Error clásico: dar c² = ${a*a+b*b} como respuesta en vez de calcular la raíz cuadrada. Siempre extrae √ al final.`,
      canvas: { type: 'triangle', data: { a, b } },
    };
  }

  // ── CÍRCULO ────────────────────────────────────────────────────────────────
  if (type === 'circle') {
    const r = n[0] || 7;
    return {
      color: '#58a6ff', icon: '⭕', label: 'Geometría — Círculo',
      formulaTex: `A = \\pi r^2 \\qquad C = 2\\pi r`,
      steps: [
        `Dato: radio r = ${r} cm`,
        `Área = π × r² = π × ${r}² = π × ${r*r}`,
        `Área = 3.1416 × ${r*r} = ?  (multiplica)`,
        `Circunferencia = 2 × π × r = 2 × 3.1416 × ${r} = ?`,
        `Recuerda: área usa r², circunferencia usa solo r`,
      ],
      table: [
        { label: 'Radio r', value: `${r} cm`, note: 'Dato' },
        { label: 'Diámetro', value: `${2*r} cm`, note: '2r' },
        { label: 'π × r²', value: `π × ${r*r}`, note: 'Paso previo' },
        { label: 'Área', value: '?  (tú calculas)', note: 'πr²' },
        { label: 'Circunferencia', value: '?  (tú calculas)', note: '2πr' },
      ],
      trap: `Trampa: confundir área (πr²) con circunferencia (2πr), o usar el diámetro (${2*r}) donde va el radio (${r}).`,
      canvas: { type: 'circle', data: { r } },
    };
  }

  // ── ESTADÍSTICA ────────────────────────────────────────────────────────────
  if (type === 'statistics') {
    const data = [...n.filter(x=>x<10000&&x>0)].sort((a,b)=>a-b);
    const sum  = data.reduce((a,b)=>a+b,0);
    const mid  = data.length/2;
    return {
      color: '#d29922', icon: '📊', label: 'Estadística — Tendencia central',
      formulaTex: `\\bar{x} = \\frac{\\sum x_i}{n} \\qquad M_e = \\text{valor central ordenado}`,
      steps: [
        `Datos del enunciado: ${data.join(', ')} (n = ${data.length})`,
        `Ordénalos de menor a mayor: ${data.join(', ')}`,
        `Suma total: ${data.join(' + ')} = ${sum}`,
        `Media = ${sum} ÷ ${data.length} = ?  (divide)`,
        data.length % 2 === 0
          ? `Mediana (n par): promedio de posición ${mid} y ${mid+1}: (${data[mid-1]} + ${data[mid]}) ÷ 2 = ?`
          : `Mediana (n impar): posición central ${Math.floor(mid)+1} = ${data[Math.floor(mid)]}`,
      ],
      table: data.slice(0,8).map((v,i) => ({
        label: `Posición ${i+1}`,
        value: String(v),
        note: (data.length%2===0 && (i===mid-1||i===mid)) ? '← para mediana' : '',
      })),
      trap: `La mediana requiere ordenar los datos PRIMERO. Con n par, es el PROMEDIO de los dos centrales, no uno solo.`,
      canvas: { type: 'histogram', data: Object.fromEntries(data.slice(0,10).map((v,i)=>[i,v])) },
    };
  }

  // ── CINEMÁTICA ─────────────────────────────────────────────────────────────
  if (type === 'kinematics') {
    const v0 = n.find(x=>x>=5&&x<=100)||20;
    const g  = n.find(x=>x===10)||10;
    const hmax = v0*v0/(2*g);
    const ttot = 2*v0/g;
    return {
      color: '#79c0ff', icon: '🚀', label: 'Física — Movimiento vertical',
      formulaTex: `h(t) = v_0 t - \\frac{1}{2}g t^2 \\qquad h_{max} = \\frac{v_0^2}{2g}`,
      steps: [
        `Datos: v₀ = ${v0} m/s (hacia arriba), g = ${g} m/s²`,
        `En la cima: velocidad = 0 m/s (siempre, en cualquier lanzamiento)`,
        `Tiempo de subida: t_sub = v₀ / g = ${v0} / ${g} = ?`,
        `Altura máxima: h_max = v₀² / (2g) = ${v0*v0} / ${2*g} = ?`,
        `Tiempo TOTAL = 2 × t_subida (el descenso es simétrico al ascenso)`,
      ],
      table: [
        { label: 'v₀ inicial', value: `${v0} m/s`, note: 'Dato' },
        { label: 'g gravedad', value: `${g} m/s²`, note: 'Dato' },
        { label: 't de subida', value: `${v0}/${g} = ?`, note: 'v₀/g' },
        { label: 'h máxima', value: `${v0*v0}/${2*g} = ?`, note: 'v₀²/2g' },
        { label: 'v en la cima', value: '0 m/s', note: 'Siempre 0' },
        { label: 't total', value: '2 × t_sub = ?', note: 'Simetría' },
      ],
      trap: `Dar el tiempo de SUBIDA como respuesta cuando preguntan el tiempo TOTAL. El total es el doble porque el objeto sube Y baja.`,
      canvas: { type: 'kinematics', data: { v0, g, hmax, ttot } },
    };
  }

  // ── OHM ────────────────────────────────────────────────────────────────────
  if (type === 'ohm') {
    const R = n[0]||10, I = n[1]||3;
    return {
      color: '#f85149', icon: '⚡', label: 'Física — Ley de Ohm',
      formulaTex: `V = I \\times R \\qquad P = V \\times I = I^2 R`,
      steps: [
        `Datos: R = ${R} Ω (resistencia), I = ${I} A (corriente)`,
        `Voltaje: V = I × R = ${I} × ${R} = ?`,
        `Potencia: P = V × I = ? × ${I} = ?`,
        `También: P = I²R = ${I}² × ${R} = ?`,
        `Verifica las unidades: V en Voltios, P en Watts`,
      ],
      table: [
        { label: 'Resistencia R', value: `${R} Ω`, note: 'Dato' },
        { label: 'Corriente I', value: `${I} A`, note: 'Dato' },
        { label: 'Voltaje V', value: `${I}×${R} = ?`, note: 'I×R' },
        { label: 'Potencia P', value: `V×${I} = ?`, note: 'V×I' },
      ],
      trap: `V (voltios) ≠ P (watts). Identifica qué magnitud pide el enunciado. La Ley tiene 3 formas: V=IR, I=V/R, R=V/I.`,
      canvas: { type: 'circuit', data: { R, I, V: R*I, P: R*I*I } },
    };
  }

  // ── FUERZA ─────────────────────────────────────────────────────────────────
  if (type === 'force') {
    const F=n[0]||0, m=n[1]||0, a=n[2]||0;
    return {
      color: '#79c0ff', icon: '⚙️', label: 'Física — Segunda Ley de Newton',
      formulaTex: `F = m \\times a \\Rightarrow \\begin{cases} a = F/m \\\\ m = F/a \\end{cases}`,
      steps: [
        `2ª Ley de Newton: F = m × a`,
        `Identifica qué dos magnitudes tienes: F=${F>0?F:'?'}N, m=${m>0?m:'?'}kg, a=${a>0?a:'?'}m/s²`,
        `Despeja la incógnita y sustituye los valores conocidos`,
        `Calcula el resultado y verifica la unidad (N = kg·m/s²)`,
        `Compara con las opciones y descarta por unidades incorrectas`,
      ],
      table: [
        { label: 'Fuerza F', value: F>0?`${F} N`:'Incógnita', note: 'N=kg·m/s²' },
        { label: 'Masa m', value: m>0?`${m} kg`:'Incógnita', note: 'kg' },
        { label: 'Aceleración a', value: a>0?`${a} m/s²`:'Incógnita', note: 'm/s²' },
      ],
      trap: `Confundir masa (kg) con peso (N). El peso = m×g. La gravedad es ≈10 m/s².`,
      canvas: { type: 'none', data: {} },
    };
  }

  // ── QUÍMICA: REACCIÓN ──────────────────────────────────────────────────────
  if (type === 'chem_reaction') {
    return {
      color: '#bc8cff', icon: '⚗️', label: 'Química — Estequiometría',
      formulaTex: `\\text{Reactivos} \\xrightarrow{} \\text{Productos} \\quad n_{prod} = n_{react} \\times \\frac{\\text{coef. prod}}{\\text{coef. react}}`,
      steps: [
        'Antes de → : REACTIVOS (lo que se consume)',
        'Después de → : PRODUCTOS (lo que se forma)',
        'Los coeficientes (números grandes) indican moles de cada sustancia',
        'Aplica la proporción molar: moles producto = moles reactivo × (coef.prod / coef.react)',
        'Ley de conservación: masa reactivos = masa productos',
      ],
      table: [
        { label: 'Antes de →', value: 'REACTIVOS', note: 'Se consumen' },
        { label: 'Después de →', value: 'PRODUCTOS', note: 'Se forman' },
        { label: 'Coeficiente', value: 'Número GRANDE', note: 'Moles' },
        { label: 'Subíndice', value: 'Número PEQUEÑO', note: 'Átomos/mol' },
      ],
      trap: `Los subíndices (₂, ₃) NO se modifican al balancear. Solo se ajustan los coeficientes. Cambiar H₂O a H₃O es incorrecto.`,
      canvas: { type: 'none', data: {} },
    };
  }

  // ── QUÍMICA: TABLA PERIÓDICA ───────────────────────────────────────────────
  if (type === 'chem_periodic') {
    return {
      color: '#bc8cff', icon: '🧪', label: 'Química — Tabla Periódica',
      formulaTex: `e^- = Z \\quad \\text{Período} = n^\\circ \\text{ capas} \\quad \\text{Grupo} = e^- \\text{ en última capa}`,
      steps: [
        'Nº atómico (Z) = protones = electrones del átomo neutro',
        'El PERÍODO indica cuántas capas electrónicas tiene el átomo',
        'El GRUPO indica los electrones de la capa más externa (valencia)',
        'Distribución por capas: K=2, L=8, M=18, N=32 (se llenan desde adentro)',
        'Aplica: cuenta capas usadas → eso es el período; últimos e⁻ → eso es el grupo',
      ],
      table: [
        { label: 'Capa K', value: 'Máx. 2 e⁻', note: 'n=1' },
        { label: 'Capa L', value: 'Máx. 8 e⁻', note: 'n=2' },
        { label: 'Capa M', value: 'Máx. 18 e⁻', note: 'n=3' },
        { label: 'Capa N', value: 'Máx. 32 e⁻', note: 'n=4' },
      ],
      trap: `Nº atómico ≠ Nº de masa. El período no indica electrones totales, indica cuántas CAPAS usa el átomo.`,
      canvas: { type: 'none', data: {} },
    };
  }

  // ── BIOLOGÍA ───────────────────────────────────────────────────────────────
  if (type === 'biology') {
    return {
      color: '#56d364', icon: '🌿', label: 'Biología',
      formulaTex: `6CO_2 + 6H_2O + luz \\xrightarrow{cloroplasto} C_6H_{12}O_6 + 6O_2`,
      steps: [
        'Identifica el nivel: célula → tejido → órgano → sistema → organismo',
        'Determina si pregunta ESTRUCTURA (qué es) o FUNCIÓN (para qué sirve)',
        'Conecta organelo/órgano con su función específica',
        'Si hay proceso (fotosíntesis, mitosis): ¿dónde ocurre? ¿qué produce?',
        'Descarta opciones que mezclan niveles distintos o invierten causa↔efecto',
      ],
      table: [
        { label: 'Célula', value: 'Unidad básica de vida', note: 'Nivel 1' },
        { label: 'Tejido', value: 'Células similares', note: 'Nivel 2' },
        { label: 'Órgano', value: 'Tejidos coordinados', note: 'Nivel 3' },
        { label: 'Sistema', value: 'Órganos con función', note: 'Nivel 4' },
      ],
      trap: `Elegir la opción que nombra correctamente el proceso pero describe mal dónde ocurre o qué produce.`,
      canvas: { type: 'none', data: {} },
    };
  }

  // ── LECTURA ────────────────────────────────────────────────────────────────
  if (type === 'reading') {
    return {
      color: '#d29922', icon: '📖', label: 'Lectura Crítica',
      formulaTex: `\\text{Inferencia válida} = \\text{lo del texto} + \\text{lógica directa}`,
      steps: [
        'Lee el texto COMPLETO antes de ver las opciones',
        '¿Qué afirma el autor? ¿Con qué argumento? ¿Con qué propósito?',
        'Para inferencias: la respuesta se DEDUCE, no se inventa',
        'Verifica cada opción: ¿está en el texto explícita o implícitamente?',
        'Descarta opciones que "van demasiado lejos" o contradicen lo escrito',
      ],
      table: [
        { label: 'Explícito', value: 'Dicho directamente', note: 'Nivel 1' },
        { label: 'Implícito', value: 'Se deduce del texto', note: 'Nivel 2' },
        { label: 'Inválido', value: 'No está en el texto', note: 'Descartar' },
        { label: 'Tesis', value: 'Postura central del autor', note: 'Identificar' },
      ],
      trap: `Elegir opciones con palabras del texto que cambian el sentido. La respuesta debe apoyarse SOLO en lo que el texto afirma.`,
      canvas: { type: 'none', data: {} },
    };
  }

  // ── INGLÉS ─────────────────────────────────────────────────────────────────
  if (type === 'english') {
    return {
      color: '#34d399', icon: '🌐', label: 'Inglés',
      formulaTex: `\\text{Correct} = \\text{Grammar OK} + \\text{Context OK}`,
      steps: [
        'Read the full sentence/text first, before choosing',
        'Identify what structure is needed: tense, modal, connector, preposition',
        'Try each option in the blank — which one fits grammar AND meaning?',
        'Avoid literal Spanish-to-English translations',
        'The correct answer must be both grammatically correct AND make sense in context',
      ],
      table: [
        { label: 'Present Simple', value: 'do/does + verb', note: 'Habits' },
        { label: 'Past Simple', value: 'verb-ed / irregular', note: 'Finished' },
        { label: 'Present Perfect', value: 'have/has + pp', note: 'Past→now' },
        { label: 'Modal verbs', value: 'can/must/should', note: 'Ability/duty' },
      ],
      trap: `Choosing the option that "sounds right" in Spanish. In English, word order and verb form are critical.`,
      canvas: { type: 'none', data: {} },
    };
  }

  // ── SOCIALES ───────────────────────────────────────────────────────────────
  if (type === 'social') {
    return {
      color: '#f97316', icon: '🗺️', label: 'Ciencias Sociales',
      formulaTex: `\\text{Causa} \\rightarrow \\text{Proceso} \\rightarrow \\text{Consecuencia} \\rightarrow \\text{Impacto}`,
      steps: [
        'Ubica: ¿qué época, lugar y actores están involucrados?',
        'Tipo de pregunta: ¿causa, consecuencia, proceso o concepto?',
        'Usa la fuente (mapa, gráfico, texto) como evidencia directa',
        'Diferencia escala: local / nacional / global',
        'Conecta el hecho con el concepto teórico: democracia, soberanía, etc.',
      ],
      table: [
        { label: 'Causa', value: '¿Por qué ocurrió?', note: 'Origen' },
        { label: 'Proceso', value: '¿Cómo se desarrolló?', note: 'Desarrollo' },
        { label: 'Consecuencia', value: '¿Qué resultó?', note: 'Efecto' },
        { label: 'Concepto', value: 'Término teórico', note: 'Teoría' },
      ],
      trap: `Confundir causa con consecuencia o mezclar épocas distintas. "¿Por qué?" → causa; "¿Qué generó?" → consecuencia.`,
      canvas: { type: 'none', data: {} },
    };
  }

  // ── GENÉRICO ───────────────────────────────────────────────────────────────
  return {
    color: '#8b949e', icon: '🔍', label: area || 'Análisis de la pregunta',
    formulaTex: `\\text{Dato} \\xrightarrow{\\text{fórmula}} \\text{Resultado}`,
    steps: [
      'Lee: ¿qué datos te dan? ¿qué te piden calcular o responder?',
      'Descarta información irrelevante; enfócate en los datos clave',
      'Identifica el concepto, ley o fórmula que aplica',
      'Opera paso a paso, sin saltar pasos',
      'Verifica tu resultado contra todas las opciones antes de marcar',
    ],
    table: [],
    trap: `Elegir la primera opción "razonable" sin verificarla. Siempre confirma con todos los datos del enunciado.`,
    canvas: { type: 'none', data: {} },
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  CANVAS DRAWINGS
// ════════════════════════════════════════════════════════════════════════════
function drawTriangle(cv: HTMLCanvasElement, a: number, b: number) {
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const W=cv.width, H=cv.height, sc=Math.min((W-80)/b,(H-70)/a)*0.9, ox=40, oy=H-35;
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#21262d'; ctx.lineWidth=0.5;
  for(let i=0;i<=Math.ceil(b)+2;i++){ctx.beginPath();ctx.moveTo(ox+i*sc,20);ctx.lineTo(ox+i*sc,oy);ctx.stroke();}
  for(let i=0;i<=Math.ceil(a)+2;i++){ctx.beginPath();ctx.moveTo(ox,oy-i*sc);ctx.lineTo(ox+(b+2)*sc,oy-i*sc);ctx.stroke();}
  ctx.fillStyle='rgba(63,185,80,0.08)';
  ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox+b*sc,oy);ctx.lineTo(ox+b*sc,oy-a*sc);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#3fb950'; ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox+b*sc,oy);ctx.lineTo(ox+b*sc,oy-a*sc);ctx.closePath();ctx.stroke();
  const rs=11; ctx.strokeStyle='#3fb950'; ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(ox+b*sc-rs,oy);ctx.lineTo(ox+b*sc-rs,oy-rs);ctx.lineTo(ox+b*sc,oy-rs);ctx.stroke();
  ctx.fillStyle='#e6edf3'; ctx.font='bold 13px Segoe UI,sans-serif';
  ctx.fillText('A',ox-18,oy+5); ctx.fillText('B',ox+b*sc+5,oy+5); ctx.fillText('C',ox+b*sc+5,oy-a*sc-5);
  ctx.fillStyle='#3fb950'; ctx.font='bold 12px Courier New,monospace';
  ctx.fillText(`a=${a}`,ox+b*sc+7,oy-a*sc/2+4);
  ctx.fillText(`b=${b}`,ox+b*sc/2-20,oy+18);
  ctx.fillStyle='#f85149'; ctx.font='bold 12px Courier New,monospace';
  ctx.fillText('c = ?',ox+b*sc/2-40,oy-a*sc/2-8);
}

function drawCircle(cv: HTMLCanvasElement, r: number) {
  const ctx=cv.getContext('2d'); if(!ctx) return;
  const W=cv.width,H=cv.height,cx=W/2,cy=H/2,cr=Math.min(cx,cy)-20;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(88,166,255,0.08)'; ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#58a6ff'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(cx,cy,cr,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#58a6ff'; ctx.beginPath(); ctx.arc(cx,cy,4,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#3fb950'; ctx.lineWidth=2; ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+cr,cy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#3fb950'; ctx.font='bold 12px Courier New,monospace'; ctx.fillText(`r = ${r}`,cx+8,cy-10);
  ctx.fillStyle='#e6edf3'; ctx.font='bold 12px Segoe UI,sans-serif'; ctx.fillText('O',cx+6,cy+16);
  ctx.fillStyle='#d29922'; ctx.font='11px Courier New,monospace';
  ctx.fillText('C = 2πr  (= ?)',cx-cr+4,cy-cr+16);
  ctx.fillStyle='#bc8cff'; ctx.fillText('A = πr²  (= ?)',cx-28,cy+cr-8);
}

function drawHistogram(cv: HTMLCanvasElement, dataObj: Record<string,number>) {
  const ctx=cv.getContext('2d'); if(!ctx) return;
  const data=Object.values(dataObj).filter(v=>v>0); if(!data.length) return;
  const W=cv.width,H=cv.height,pad=40,top=15,gh=H-top-28;
  const maxV=Math.max(...data)*1.1, bw=Math.max(8,Math.floor((W-pad-20)/data.length)-5);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#21262d'; ctx.lineWidth=0.5;
  for(let i=0;i<=4;i++){const y=top+i*gh/4; ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-10,y);ctx.stroke();}
  const mean=data.reduce((a,b)=>a+b,0)/data.length;
  data.forEach((v,i)=>{
    const x=pad+i*(bw+5), bh=(v/maxV)*gh, y=top+gh-bh;
    ctx.fillStyle='rgba(248,81,73,0.15)'; ctx.fillRect(x,y,bw,bh);
    ctx.fillStyle='#f85149'; ctx.fillRect(x,y,bw,3);
    ctx.strokeStyle='#f85149'; ctx.lineWidth=1; ctx.strokeRect(x,y,bw,bh);
    ctx.fillStyle='#e6edf3'; ctx.font='9px Courier New,monospace'; ctx.textAlign='center';
    ctx.fillText(String(v),x+bw/2,y-3);
    ctx.fillStyle='#6e7681'; ctx.fillText(String(v),x+bw/2,H-8);
    ctx.textAlign='left';
  });
  const meanY=top+gh-(mean/maxV)*gh;
  ctx.strokeStyle='#d29922'; ctx.lineWidth=2; ctx.setLineDash([6,4]);
  ctx.beginPath(); ctx.moveTo(pad,meanY); ctx.lineTo(W-10,meanY); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle='#d29922'; ctx.font='bold 11px Courier New,monospace';
  ctx.fillText('x̄ = ?',W-55,meanY-4);
}

function drawKinematics(cv: HTMLCanvasElement, d: Record<string,number>) {
  const ctx=cv.getContext('2d'); if(!ctx) return;
  const {v0,g,hmax,ttot}=d;
  const W=cv.width,H=cv.height,px=50,py=15,gw=W-px-20,gh=H-py-28;
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='#21262d'; ctx.lineWidth=0.5;
  for(let i=0;i<=4;i++){
    const x=px+i*gw/4; ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x,py+gh);ctx.stroke();
    const y=py+i*gh/4; ctx.beginPath();ctx.moveTo(px,y);ctx.lineTo(px+gw,y);ctx.stroke();
  }
  ctx.strokeStyle='#444c56'; ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px,py+gh);ctx.stroke();
  ctx.beginPath();ctx.moveTo(px,py+gh);ctx.lineTo(px+gw,py+gh);ctx.stroke();
  ctx.strokeStyle='#d29922'; ctx.lineWidth=3; ctx.beginPath();
  for(let i=0;i<=80;i++){const t=(i/80)*ttot,h=v0*t-0.5*g*t*t; i===0?ctx.moveTo(px+(t/ttot)*gw,py+gh-(h/hmax)*gh):ctx.lineTo(px+(t/ttot)*gw,py+gh-(h/hmax)*gh);}
  ctx.stroke();
  ctx.fillStyle='rgba(210,153,34,0.07)'; ctx.beginPath();
  for(let i=0;i<=80;i++){const t=(i/80)*ttot,h=v0*t-0.5*g*t*t; ctx.lineTo(px+(t/ttot)*gw,py+gh-(h/hmax)*gh);}
  ctx.lineTo(px+gw,py+gh);ctx.lineTo(px,py+gh);ctx.closePath();ctx.fill();
  ctx.fillStyle='#f85149'; ctx.beginPath(); ctx.arc(px+gw/2,py,6,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#f85149'; ctx.lineWidth=1; ctx.setLineDash([4,3]);
  ctx.beginPath();ctx.moveTo(px+gw/2,py);ctx.lineTo(px+gw/2,py+gh);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#d29922'; ctx.font='bold 11px Segoe UI,sans-serif';
  ctx.fillText(`h(t) = ${v0}t − ${g/2}t²`,px+8,py+18);
  ctx.fillStyle='#f85149'; ctx.font='bold 10px Courier New,monospace';
  ctx.fillText('h_max = ?',px+gw/2+6,py+14);
  ctx.fillStyle='#6e7681'; ctx.font='10px Courier New,monospace';
  ['0s',(ttot/2).toFixed(1)+'s',ttot.toFixed(1)+'s'].forEach((l,i)=>ctx.fillText(l,px+i*gw/2-8,py+gh+15));
}

function drawCircuit(cv: HTMLCanvasElement, d: Record<string,number>) {
  const ctx=cv.getContext('2d'); if(!ctx) return;
  const {R,I}=d;
  const W=cv.width,H=cv.height;
  ctx.clearRect(0,0,W,H);
  const l=50,t=30,w=W-100,h=80;
  ctx.strokeStyle='#58a6ff'; ctx.lineWidth=3; ctx.strokeRect(l,t,w,h);
  ctx.strokeStyle='#3fb950'; ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(l,t+20);ctx.lineTo(l,t+h-20);ctx.stroke();
  ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(l-8,t+25);ctx.lineTo(l+8,t+25);ctx.stroke();
  ctx.beginPath();ctx.moveTo(l-5,t+35);ctx.lineTo(l+5,t+35);ctx.stroke();
  const rx=l+w/2-32;
  ctx.strokeStyle='#d29922'; ctx.lineWidth=2; ctx.strokeRect(rx,t-12,64,24);
  ctx.fillStyle='#161b22'; ctx.fillRect(rx+1,t-11,62,22);
  ctx.strokeStyle='#d29922'; ctx.lineWidth=1.5; ctx.beginPath();
  const zig=[rx+4,t+2,rx+12,t-8,rx+21,t+2,rx+30,t-8,rx+39,t+2,rx+48,t-8,rx+60,t+2];
  ctx.moveTo(zig[0],zig[1]);
  for(let i=1;i<7;i++) ctx.lineTo(zig[i*2],zig[i*2+1]);
  ctx.stroke();
  const ax=l+w,ay=t+h/2;
  ctx.strokeStyle='#f85149'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ax,ay,16,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#1a0707'; ctx.beginPath(); ctx.arc(ax,ay,15,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#f85149'; ctx.font='bold 13px Courier New,monospace'; ctx.textAlign='center';
  ctx.fillText('A',ax,ay+5); ctx.textAlign='left';
  ctx.fillStyle='#3fb950'; ctx.font='bold 11px Courier New,monospace'; ctx.fillText(`I=${I}A`,l-42,t+h/2+4);
  ctx.fillStyle='#d29922'; ctx.font='bold 11px Courier New,monospace'; ctx.fillText(`R=${R}Ω`,rx+6,t-14);
  ctx.fillStyle='#f85149'; ctx.font='11px Courier New,monospace'; ctx.fillText('V = ?',ax+20,ay+4);
  ctx.fillStyle='#79c0ff'; ctx.font='14px sans-serif'; ctx.fillText('→',l+w/4,t-5); ctx.fillText('←',l+w/4,t+h+16);
}

// ════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
export default function QuestionVisualPanel({ question, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const type  = detectType(question.area, question.stem);
  const guide = buildGuide(type, question.stem, question.area);
  const c     = guide.color;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || guide.canvas.type === 'none') return;
    const { type: ct, data } = guide.canvas;
    if (ct === 'triangle')   drawTriangle(cv, data.a, data.b);
    if (ct === 'circle')     drawCircle(cv, data.r);
    if (ct === 'histogram')  drawHistogram(cv, data);
    if (ct === 'kinematics') drawKinematics(cv, data);
    if (ct === 'circuit')    drawCircuit(cv, data);
  }, [guide.canvas]);

  const hasCanvas = guide.canvas.type !== 'none';

  return (
    <div ref={overlayRef} onClick={e => e.target===overlayRef.current && onClose()} style={S.overlay}>
      <div style={S.panel}>

        {/* ── Header ── */}
        <div style={{ ...S.header, borderBottom: `2px solid ${c}40` }}>
          <div style={S.headerL}>
            <span style={{ fontSize: 22 }}>{guide.icon}</span>
            <div>
              <div style={{ ...S.title, color: c }}>{guide.label}</div>
              <div style={S.sub}>{question.area} · Guía de razonamiento</div>
            </div>
          </div>
          <button onClick={onClose} style={S.close}>✕</button>
        </div>

        {/* ── Body ── */}
        <div style={S.body}>

          {/* Enunciado */}
          <div style={{ ...S.stemBox, borderLeft: `3px solid ${c}` }}>
            <div style={{ ...S.lbl, color: c }}>📋 ENUNCIADO</div>
            <p style={S.stemText}>{question.stem}</p>
          </div>

          {/* Fórmula clave (MathJax) */}
          <div style={S.section}>
            <div style={S.lbl}>🧮 FÓRMULA CLAVE</div>
            <div style={{ ...S.formulaBox, borderColor: `${c}50` }}>
              <Formula tex={guide.formulaTex} block style={{ color: c, fontSize: 15 }} />
            </div>
          </div>

          {/* Canvas (solo cuando aplica) */}
          {hasCanvas && (
            <div style={S.section}>
              <div style={S.lbl}>
                {guide.canvas.type === 'triangle'   && '📐 DIAGRAMA GEOMÉTRICO'}
                {guide.canvas.type === 'circle'     && '⭕ FIGURA: CÍRCULO'}
                {guide.canvas.type === 'histogram'  && '📊 HISTOGRAMA — eje X = datos, línea = x̄'}
                {guide.canvas.type === 'kinematics' && '📈 GRÁFICA h(t) — curva de altura'}
                {guide.canvas.type === 'circuit'    && '⚡ ESQUEMA DEL CIRCUITO'}
              </div>
              <div style={S.canvasBox}>
                <canvas ref={canvasRef}
                  width={700} height={guide.canvas.type === 'circuit' ? 140 : 190}
                  style={{ maxWidth: '100%', height: 'auto', display: 'block' }} />
              </div>
            </div>
          )}

          {/* Pasos de razonamiento */}
          <div style={S.section}>
            <div style={S.lbl}>🧠 RUTA DE RAZONAMIENTO (sin revelar la respuesta)</div>
            <div style={S.stepsBox}>
              {guide.steps.map((step, i) => (
                <div key={i} style={S.stepRow}>
                  <div style={{ ...S.stepNum, background: c }}>{i+1}</div>
                  <div style={S.stepText}>{step}</div>
                </div>
              ))}
              <div style={{ ...S.stepRow, opacity: 0.5 }}>
                <div style={{ ...S.stepNum, background: '#6e7681' }}>→</div>
                <div style={{ ...S.stepText, fontStyle: 'italic' }}>
                  Ahora calcula el paso final y compara con las opciones A–D
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de valores conocidos */}
          {guide.table.length > 0 && (
            <div style={S.section}>
              <div style={S.lbl}>📋 TABLA DE VALORES DEL PROBLEMA</div>
              <div style={S.table}>
                <div style={S.tableHead}>
                  <span style={{ flex: 1 }}>Variable / Concepto</span>
                  <span style={{ width: 150 }}>Valor</span>
                  <span style={{ width: 90 }}>Origen</span>
                </div>
                {guide.table.map((row, i) => (
                  <div key={i} style={{ ...S.tableRow,
                      borderColor: '#21262d',
                      background: row.value.includes('?') ? `${c}08` : 'transparent' }}>
                    <span style={{ flex: 1, fontSize: 13, color: '#c9d1d9' }}>{row.label}</span>
                    <span style={{ width: 150, fontSize: 13, fontFamily: "'Courier New',monospace",
                        color: row.value.includes('?') ? '#f85149' : c, fontWeight: 600 }}>
                      {row.value}
                    </span>
                    <span style={{ width: 90, fontSize: 11, color: '#6e7681' }}>{row.note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Análisis de opciones */}
          <div style={S.section}>
            <div style={S.lbl}>🔍 PISTAS POR OPCIÓN</div>
            <div style={S.table}>
              <div style={S.tableHead}>
                <span style={{ width: 36 }}>Op.</span>
                <span style={{ flex: 1 }}>Texto</span>
                <span style={{ width: 130 }}>Qué analizar</span>
              </div>
              {question.options.map((opt, i) => {
                const pistas = [
                  '¿Cumple exactamente lo pedido?',
                  '¿Es el valor antes de aplicar un paso?',
                  '¿Confunde dos conceptos del tema?',
                  '¿Unidad o signo incorrecto?',
                ];
                return (
                  <div key={opt.label} style={{ ...S.tableRow, borderColor: '#21262d' }}>
                    <span style={{ width: 28, height: 28, borderRadius: 6,
                        border: `1px solid ${c}50`, color: c, fontWeight: 700,
                        fontSize: 12, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', background: 'rgba(255,255,255,0.03)', flexShrink: 0 }}>
                      {opt.label}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: '#c9d1d9', lineHeight: 1.5 }}>{opt.text}</span>
                    <span style={{ width: 130, fontSize: 11, color: '#6e7681' }}>{pistas[i % pistas.length]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trampa */}
          <div style={S.trap}>
            <div style={S.trapTitle}>⚠️ ERROR MÁS FRECUENTE EN ESTE TIPO</div>
            <div style={S.trapText}>{guide.trap}</div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ESTILOS
// ════════════════════════════════════════════════════════════════════════════
const S: Record<string, React.CSSProperties> = {
  overlay:   { position:'fixed',inset:0,background:'rgba(0,0,0,0.78)',backdropFilter:'blur(4px)',zIndex:200,display:'flex',alignItems:'flex-end',justifyContent:'center' },
  panel:     { width:'100%',maxWidth:820,maxHeight:'90vh',background:'#161b22',border:'1px solid #30363d',borderRadius:'16px 16px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 -8px 40px rgba(0,0,0,0.6)' },
  header:    { display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px',flexShrink:0 },
  headerL:   { display:'flex',alignItems:'center',gap:12 },
  title:     { fontSize:15,fontWeight:700 },
  sub:       { fontSize:11,color:'#6e7681',marginTop:2 },
  close:     { width:32,height:32,borderRadius:8,background:'rgba(255,255,255,0.05)',border:'1px solid #30363d',color:'#8b949e',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' } as React.CSSProperties,
  body:      { flex:1,overflowY:'auto',padding:'14px 20px 30px',display:'flex',flexDirection:'column',gap:16 },
  stemBox:   { background:'#0d1117',borderRadius:'0 10px 10px 0',padding:'12px 16px' },
  stemText:  { fontSize:15,color:'#e6edf3',lineHeight:1.85,margin:0,marginTop:8 },
  lbl:       { fontSize:10,fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' as const,color:'#6e7681',marginBottom:6 },
  section:   { display:'flex',flexDirection:'column',gap:6 },
  formulaBox: { background:'#0d1117',border:'1px solid',borderRadius:10,padding:'14px 18px',minHeight:52,display:'flex',alignItems:'center',justifyContent:'center' },
  canvasBox: { background:'#0d1117',border:'1px solid #21262d',borderRadius:10,padding:'14px 10px',display:'flex',justifyContent:'center' },
  stepsBox:  { background:'#0d1117',border:'1px solid #21262d',borderRadius:10,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10 },
  stepRow:   { display:'flex',gap:12,alignItems:'flex-start' },
  stepNum:   { width:24,height:24,borderRadius:6,color:'#0d1117',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 } as React.CSSProperties,
  stepText:  { fontSize:13,color:'#c9d1d9',lineHeight:1.7 },
  table:     { background:'#0d1117',border:'1px solid #21262d',borderRadius:10,overflow:'hidden' },
  tableHead: { display:'flex',gap:12,padding:'7px 14px',fontSize:10,fontWeight:700,color:'#6e7681',textTransform:'uppercase' as const,letterSpacing:'.06em',background:'#161b22',borderBottom:'1px solid #21262d' },
  tableRow:  { display:'flex',alignItems:'center',gap:12,padding:'9px 14px',borderTop:'1px solid' },
  trap:      { background:'rgba(248,81,73,0.07)',border:'1px solid rgba(248,81,73,0.25)',borderRadius:10,padding:'14px 16px' },
  trapTitle: { fontSize:10,fontWeight:700,color:'#f85149',letterSpacing:'.08em',textTransform:'uppercase' as const,marginBottom:8 },
  trapText:  { fontSize:13,color:'#fca5a5',lineHeight:1.75 },
};
