// =============================================================================
//  QuestionVisualPanel.tsx — Panel flotante visual de la pregunta actual
// =============================================================================
import React, { useEffect, useRef } from 'react';

interface Option   { label: string; text: string }
interface Question { id: string; stem: string; options: Option[]; area: string; points: number }

interface Props {
  question: Question;
  onClose: () => void;
}

// ── Detecta el tipo de materia ──────────────────────────────────────────────
function detectSubject(area: string, stem: string): string {
  const t = `${area} ${stem}`.toLowerCase();
  if (/tri[aá]ngulo|círculo|circulo|rect[aá]ngulo|pol[ií]gono|per[ií]metro|[áa]rea|volumen|radio|hipotenusa|ángulo|angulo/.test(t)) return 'geometria';
  if (/qu[ií]mica|reactivo|producto|mol[eé]cula|ecuaci[oó]n|combusti[oó]n|[a-z][0-9]/.test(t)) return 'quimica';
  if (/f[ií]sica|fuerza|velocidad|aceleraci[oó]n|energ[ií]a|circuito|voltaje|masa|newton|ohm/.test(t)) return 'fisica';
  if (/biolog|c[eé]lula|ecosistema|gen|fotosíntesis|fotosintesis|[oó]rgano|prote[ií]na|evoluci[oó]n/.test(t)) return 'biologia';
  if (/lectura|texto|autor|infer|argumento|tesis|p[aá]rrafo|fragmento|obra/.test(t)) return 'lectura';
  if (/ingl[eé]s|english|verb|sentence|word|grammar|modal|must|can|should/.test(t)) return 'ingles';
  if (/sociales|ciudadan|historia|geograf|constituci[oó]n|estado|mapa|territorio|tutela/.test(t)) return 'sociales';
  if (/matem[aá]t|[aá]lgebra|ecuaci[oó]n|porcentaje|proporci[oó]n|estadística|promedio|mediana|moda/.test(t)) return 'matematicas';
  return 'matematicas';
}

// ── Configuración visual por materia ─────────────────────────────────────────
const SUBJECT_CONFIG: Record<string, { color: string; icon: string; label: string; steps: string[] }> = {
  geometria:   { color: '#3fb950', icon: '📐', label: 'Geometría',       steps: ['Dibuja la figura y marca las medidas dadas','Identifica qué pide: longitud, área o volumen','Elige la fórmula correcta para esa figura','Sustituye los datos y opera con orden','Verifica que el resultado tenga la unidad correcta'] },
  matematicas: { color: '#58a6ff', icon: '🔢', label: 'Matemáticas',     steps: ['Identifica el dato dado y la incógnita','Reconoce la operación o regla que aplica','Sustituye el valor y opera respetando jerarquía','Compara el resultado con las opciones','Descarta las trampas numéricas (error de signo, etc.)'] },
  quimica:     { color: '#bc8cff', icon: '⚗️', label: 'Química',         steps: ['Lee la ecuación: identifica reactivos (←) y productos (→)','Revisa los coeficientes: cambian cantidad, no tipo de sustancia','Clasifica la reacción (síntesis, combustión, descomposición)','Aplica la ley de conservación de la masa','Conecta la teoría con lo que pide la pregunta'] },
  fisica:      { color: '#79c0ff', icon: '⚡', label: 'Física',          steps: ['Lista las magnitudes: dato, unidad y lo que busca','Dibuja el sistema (fuerzas, movimiento, circuito)','Elige la ley o fórmula correcta','Sustituye con unidades consistentes','Verifica que el resultado tenga sentido físico'] },
  biologia:    { color: '#56d364', icon: '🌿', label: 'Biología',        steps: ['Reconoce el organismo, nivel o proceso biológico','Identifica la relación causa → efecto','Conecta estructura con función','Usa el contexto para descartar opciones genéricas','La respuesta debe explicar el fenómeno, no solo nombrarlo'] },
  lectura:     { color: '#d29922', icon: '📖', label: 'Lectura Crítica', steps: ['Lee el texto completo antes de ver las opciones','Identifica el tema central y la postura del autor','Busca conectores: "sin embargo", "por tanto", "aunque"','Cada inferencia debe apoyarse en una pista del texto','Descarta opciones que exageran o inventan información'] },
  ingles:      { color: '#34d399', icon: '🌐', label: 'Inglés',          steps: ['Identifica la función comunicativa de la oración','Revisa el tiempo verbal y el conector del contexto','Prueba cada opción en la oración completa','Descarta traducciones literales del español','Elige la opción coherente en gramática Y significado'] },
  sociales:    { color: '#f85149', icon: '🗺️', label: 'Sociales',        steps: ['Ubica el contexto: época, lugar, actores y conflicto','Distingue causa, proceso y consecuencia del hecho','Si hay mapa, gráfico o fuente: úsalo como evidencia','Diferencia escala local, nacional o global','Conecta el hecho con el concepto teórico evaluado'] },
};

// ── Extrae números del enunciado ─────────────────────────────────────────────
function extractData(stem: string): string[] {
  const matches = stem.match(/-?\d+(?:[.,]\d+)?(?:\s*(?:cm|m|km|kg|g|s|°|%|m²|m³|km²|L|mol|N|W|V|A|Ω|COP|\$))?/g);
  return [...new Set(matches || [])].slice(0, 8);
}

// ── Detecta si hay ecuación química ─────────────────────────────────────────
function extractChemEq(stem: string): { left: string[]; right: string[] } | null {
  const m = stem.match(/([A-Z][A-Za-z0-9₂₃₄₆О\s\+]*)\s*(?:->|→)\s*([A-Z][A-Za-z0-9₂₃₄₆О\s\+]*)/);
  if (!m) return null;
  return {
    left:  m[1].split(/\+/).map(s => s.trim()).filter(Boolean),
    right: m[2].split(/\+/).map(s => s.trim()).filter(Boolean),
  };
}

export default function QuestionVisualPanel({ question, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const subj    = detectSubject(question.area, question.stem);
  const config  = SUBJECT_CONFIG[subj] || SUBJECT_CONFIG.matematicas;
  const datos   = extractData(question.stem);
  const chemEq  = extractChemEq(question.stem);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
      style={S.overlay}
    >
      <div style={S.panel}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ ...S.panelHeader, borderBottom: `1px solid ${config.color}33` }}>
          <div style={S.headerLeft}>
            <span style={{ fontSize: 22 }}>{config.icon}</span>
            <div>
              <div style={{ ...S.headerTitle, color: config.color }}>{config.label}</div>
              <div style={S.headerSub}>{question.area} · Vista Visual</div>
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* ── Body con scroll ─────────────────────────────────────────────── */}
        <div style={S.panelBody}>

          {/* Enunciado destacado */}
          <div style={{ ...S.stemBox, borderLeft: `3px solid ${config.color}` }}>
            <div style={{ ...S.sectionLabel, color: config.color }}>📋 ENUNCIADO</div>
            <p style={S.stemText}>{question.stem}</p>
          </div>

          {/* Datos numéricos detectados */}
          {datos.length > 0 && (
            <div style={S.section}>
              <div style={S.sectionLabel}>📊 DATOS CLAVE DEL ENUNCIADO</div>
              <div style={S.dataChips}>
                {datos.map((d, i) => (
                  <span key={i} style={{ ...S.chip, borderColor: config.color, color: config.color }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ecuación química (si aplica) */}
          {chemEq && (
            <div style={S.section}>
              <div style={S.sectionLabel}>⚗️ ECUACIÓN QUÍMICA</div>
              <div style={S.chemRow}>
                <div style={S.chemSide}>
                  {chemEq.left.map((r, i) => (
                    <div key={i} style={{ ...S.chemMol, borderColor: '#bc8cff', color: '#bc8cff' }}>{r}</div>
                  ))}
                  <div style={S.chemLabel}>REACTIVOS</div>
                </div>
                <div style={{ fontSize: 28, color: '#6e7681' }}>→</div>
                <div style={S.chemSide}>
                  {chemEq.right.map((p, i) => (
                    <div key={i} style={{ ...S.chemMol, borderColor: '#3fb950', color: '#3fb950' }}>{p}</div>
                  ))}
                  <div style={S.chemLabel}>PRODUCTOS</div>
                </div>
              </div>
            </div>
          )}

          {/* Ruta de razonamiento por pasos */}
          <div style={S.section}>
            <div style={S.sectionLabel}>🧠 RUTA DE RAZONAMIENTO</div>
            <div style={S.stepsBox}>
              {config.steps.map((step, i) => (
                <div key={i} style={S.stepRow}>
                  <div style={{ ...S.stepNum, background: config.color }}>{i + 1}</div>
                  <div style={S.stepText}>{step}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla de opciones */}
          <div style={S.section}>
            <div style={S.sectionLabel}>🔍 ANÁLISIS DE OPCIONES</div>
            <div style={S.optTable}>
              <div style={S.optTableHead}>
                <span style={{ width: 36 }}>Op.</span>
                <span style={{ flex: 1 }}>Texto</span>
                <span style={{ width: 130 }}>Qué verificar</span>
              </div>
              {question.options.map((opt, i) => {
                const tips = [
                  '¿Cumple el criterio principal?',
                  '¿Es una trampa numérica?',
                  '¿Confunde dos conceptos?',
                  '¿Tiene el signo o unidad incorrecta?',
                ];
                return (
                  <div key={opt.label} style={{ ...S.optTableRow, borderColor: i === 0 ? `${config.color}30` : '#21262d' }}>
                    <span style={{ ...S.optLetter, color: config.color, borderColor: `${config.color}50` }}>{opt.label}</span>
                    <span style={S.optRowText}>{opt.text}</span>
                    <span style={S.optTip}>{tips[i % tips.length]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trampa más común */}
          <div style={S.trapBox}>
            <div style={S.trapTitle}>⚠️ TRAMPA MÁS COMÚN</div>
            <div style={S.trapText}>
              {subj === 'geometria'   && 'Confundir perímetro (suma de lados) con área (superficie interior). Lee bien qué pide el enunciado.'}
              {subj === 'matematicas' && 'Saltarse la jerarquía de operaciones: primero ×÷, luego ±. Un paréntesis cambia todo el resultado.'}
              {subj === 'quimica'     && 'Leer la flecha al revés: antes de → son reactivos, después son productos. No los confundas.'}
              {subj === 'fisica'      && 'Usar la fórmula equivocada por no revisar las unidades. Siempre verifica m/s vs km/h, kg vs g.'}
              {subj === 'biologia'    && 'Elegir la opción que nombra el fenómeno sin explicarlo. La respuesta correcta explica el porqué.'}
              {subj === 'lectura'     && 'Elegir una opción que usa palabras del texto pero no responde lo que pregunta. Verifica que responda la pregunta exacta.'}
              {subj === 'ingles'      && 'Traducir literalmente al español en vez de analizar el contexto gramatical de la oración.'}
              {subj === 'sociales'    && 'Atribuir causas o consecuencias a épocas equivocadas. Contextualiza primero el hecho histórico.'}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    zIndex: 200,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    padding: '0 0 0 0',
  },
  panel: {
    width: '100%',
    maxWidth: 800,
    maxHeight: '88vh',
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '16px 16px 0 0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
    animation: 'slideUp .25s ease',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    flexShrink: 0,
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 15, fontWeight: 700 },
  headerSub:   { fontSize: 11, color: '#6e7681', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #30363d',
    color: '#8b949e', fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panelBody: {
    flex: 1, overflowY: 'auto', padding: '16px 20px 24px',
    display: 'flex', flexDirection: 'column', gap: 16,
  },
  stemBox: {
    background: '#0d1117',
    borderRadius: '0 10px 10px 0',
    padding: '14px 18px',
  },
  stemText: { fontSize: 16, color: '#e6edf3', lineHeight: 1.8, margin: 0, marginTop: 8 },
  section:  { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
    textTransform: 'uppercase', color: '#6e7681',
  },
  dataChips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '5px 14px', borderRadius: 20,
    border: '1px solid', fontSize: 13,
    fontWeight: 600, background: 'rgba(255,255,255,0.04)',
    fontFamily: "'Courier New', monospace",
  },
  chemRow:  { display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  chemSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  chemMol: {
    padding: '8px 16px', borderRadius: 8,
    border: '1px solid', fontSize: 15, fontWeight: 600,
    background: 'rgba(255,255,255,0.03)',
  },
  chemLabel: { fontSize: 10, color: '#6e7681', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' },
  stepsBox: {
    background: '#0d1117', border: '1px solid #21262d',
    borderRadius: 10, padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  stepRow: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  stepNum: {
    width: 24, height: 24, borderRadius: 6,
    color: '#0d1117', fontSize: 11, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 1,
  },
  stepText: { fontSize: 13, color: '#c9d1d9', lineHeight: 1.65 },
  optTable: {
    background: '#0d1117', border: '1px solid #21262d',
    borderRadius: 10, overflow: 'hidden',
  },
  optTableHead: {
    display: 'flex', gap: 12, padding: '8px 14px',
    fontSize: 10, fontWeight: 700, color: '#6e7681',
    textTransform: 'uppercase', letterSpacing: '.06em',
    background: '#161b22', borderBottom: '1px solid #21262d',
  },
  optTableRow: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '10px 14px', borderTop: '1px solid',
  },
  optLetter: {
    width: 28, height: 28, borderRadius: 6,
    border: '1px solid', fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, background: 'rgba(255,255,255,0.03)',
  },
  optRowText: { flex: 1, fontSize: 13, color: '#c9d1d9', lineHeight: 1.55, paddingTop: 4 },
  optTip: { width: 130, fontSize: 11, color: '#6e7681', lineHeight: 1.5, paddingTop: 4, flexShrink: 0 },
  trapBox: {
    background: 'rgba(248,81,73,0.06)',
    border: '1px solid rgba(248,81,73,0.25)',
    borderRadius: 10, padding: '14px 16px',
  },
  trapTitle: { fontSize: 11, fontWeight: 700, color: '#f85149', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 },
  trapText:  { fontSize: 13, color: '#fca5a5', lineHeight: 1.7 },
};
