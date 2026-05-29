// =============================================================================
//  frontend/src/features/banco/BancoPreguntasPage.tsx
//  Banco de Preguntas — Panel por Materia / Tema / Preguntas + Visual + Audio
// =============================================================================
import React, { useState, useEffect, useRef } from 'react';
import QuestionInlineVisual, { getPureFormula } from '../exam/QuestionInlineVisual';
import QuestionVisualPanel  from '../exam/QuestionVisualPanel';

declare const MathJax: { typesetPromise: (nodes?: HTMLElement[]) => Promise<void> };

const API = 'https://ifces-production.up.railway.app/api/v1';
const LIMIT = 20;

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Materia {
  key: string;
  label: string;
  color: string;
  total: number;
  temas: string[];
  tema_counts: Record<string, number>;
}

interface Opcion { label: string; text: string }

interface Pregunta {
  id: string;
  codigo: string;
  area: string;
  tema: string;
  enunciado: string;
  opciones: Opcion[];
  respuesta: string;
  explicacion: string;
  dificultad: string;
}

// Formato que esperan QuestionInlineVisual y QuestionVisualPanel
interface QVP {
  id: string;
  stem: string;
  area: string;
  points: number;
  difficulty: string;
  options: Opcion[];
}

type View = 'materias' | 'preguntas';

// ── Paleta de dificultad ──────────────────────────────────────────────────────
const DIFF: Record<string, { color: string; bg: string }> = {
  MEDIA: { color: '#d29922', bg: 'rgba(210,153,34,0.12)' },
  ALTA:  { color: '#f85149', bg: 'rgba(248,81,73,0.10)' },
  RETO:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
};

function diffStyle(d: string) {
  return DIFF[d] ?? { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  user: { id: string; full_name: string };
}

// =============================================================================
export default function BancoPreguntasPage({ user }: Props) {
  const [view,           setView]           = useState<View>('materias');
  const [materias,       setMaterias]       = useState<Materia[]>([]);
  const [materia,        setMateria]        = useState<Materia | null>(null);
  const [temaFiltro,     setTemaFiltro]     = useState('Todas');
  const [difFiltro,      setDifFiltro]      = useState('Todas');
  const [preguntas,      setPreguntas]      = useState<Pregunta[]>([]);
  const [total,          setTotal]          = useState(0);
  const [skipOffset,     setSkipOffset]     = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [revealed,       setRevealed]       = useState<Set<string>>(new Set());
  const [viewed,         setViewed]         = useState<Set<string>>(new Set());
  // Panel visual flotante
  const [visualPanel,       setVisualPanel]       = useState<QVP | null>(null);
  // Audio Web Speech
  const [speaking,          setSpeaking]          = useState<string | null>(null);
  const [played,            setPlayed]            = useState<Set<string>>(new Set()); // ya reproducido
  const [explanationShown,  setExplanationShown]  = useState<Set<string>>(new Set()); // mostrar tras audio
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Cargar materias al montar + inicializar voces
  useEffect(() => {
    fetchMaterias();
    const loadVoices = () => { voicesRef.current = window.speechSynthesis?.getVoices() || []; };
    loadVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  async function fetchMaterias() {
    try {
      const res = await fetch(`${API}/banco/materias`);
      if (res.ok) setMaterias(await res.json());
    } catch {}
  }

  async function fetchPreguntas(m: Materia, tema: string, dif: string, offset: number) {
    setLoading(true);
    try {
      const p = new URLSearchParams({ skip: String(offset), limit: String(LIMIT) });
      if (tema && tema !== 'Todas') p.set('tema', tema);
      if (dif  && dif  !== 'Todas') p.set('dificultad', dif);
      const res = await fetch(`${API}/banco/materias/${encodeURIComponent(m.key)}/preguntas?${p}`);
      if (!res.ok) return;
      const data = await res.json();
      if (offset === 0) setPreguntas(data.preguntas ?? []);
      else              setPreguntas(prev => [...prev, ...(data.preguntas ?? [])]);
      setTotal(data.total ?? 0);
    } catch {}
    setLoading(false);
  }

  function openMateria(m: Materia) {
    setMateria(m);
    setTemaFiltro('Todas');
    setDifFiltro('Todas');
    setSkipOffset(0);
    setPreguntas([]);
    setVisualPanel(null);
    setView('preguntas');
    fetchPreguntas(m, 'Todas', 'Todas', 0);
  }

  function applyFilter(tema: string, dif: string) {
    setTemaFiltro(tema);
    setDifFiltro(dif);
    setSkipOffset(0);
    setPreguntas([]);
    if (materia) fetchPreguntas(materia, tema, dif, 0);
  }

  function loadMore() {
    const next = skipOffset + LIMIT;
    setSkipOffset(next);
    if (materia) fetchPreguntas(materia, temaFiltro, difFiltro, next);
  }

  // Convierte Pregunta → formato QVP para los componentes visuales
  function toQVP(p: Pregunta): QVP {
    return {
      id: p.id,
      stem: p.enunciado,
      area: p.area,
      points: 1,
      difficulty: p.dificultad,
      options: p.opciones,
    };
  }

  function openVisualPanel(p: Pregunta) {
    setVisualPanel(toQVP(p));
    setViewed(prev => { const s = new Set(prev); s.add(p.id); return s; });
    try {
      fetch(`${API}/banco/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, question_id: p.id }),
      });
    } catch {}
  }

  function toggleReveal(id: string) {
    setRevealed(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
    setViewed(prev => { const s = new Set(prev); s.add(id); return s; });
  }

  // ── Seleccionar mejor voz disponible ─────────────────────────────────────────
  function pickBestVoice(): SpeechSynthesisVoice | null {
    const all = voicesRef.current.length
      ? voicesRef.current
      : window.speechSynthesis?.getVoices() || [];
    // Orden de preferencia: Google > Microsoft > cualquier español
    return (
      all.find(v => /google.*espa/i.test(v.name)) ||
      all.find(v => /google/i.test(v.name) && /^es/i.test(v.lang)) ||
      all.find(v => /microsoft.*espa/i.test(v.name)) ||
      all.find(v => /microsoft/i.test(v.name) && /^es/i.test(v.lang)) ||
      all.find(v => /^es.*co/i.test(v.lang)) ||
      all.find(v => /^es/i.test(v.lang)) ||
      null
    );
  }

  // ── Construir guion pedagógico (≥ 1 minuto ≈ 150 palabras a ritmo 0.85) ─────
  function buildScript(p: Pregunta): string[] {
    const nombre = user.full_name?.split(' ')[0] || 'estudiante';
    const formula = getPureFormula(p.area, p.enunciado);
    const opCorrecta = p.opciones.find(o => o.label === p.respuesta);

    const saludo =
      `¡Hola ${nombre}! Vamos a resolver juntos esta pregunta. ` +
      `Quiero que sepas algo muy importante antes de empezar: ` +
      `las matemáticas y todas las ciencias no son difíciles, ` +
      `solo necesitan el método correcto y práctica constante. ` +
      `Yo te voy a explicar paso a paso cómo se resuelve. ¿Listo?`;

    const enunciado_intro =
      `La pregunta nos plantea lo siguiente: ${p.enunciado}. ` +
      `Tómate un momento para leerla con calma e identifica qué datos te dan y qué te están pidiendo.`;

    const concepto = formula
      ? `El concepto clave aquí es ${formula.label}. ` +
        `${formula.vars ? 'Recuerda que ' + formula.vars + '.' : ''} ` +
        `Esta fórmula es tu herramienta principal para este tipo de problema, así que guárdala bien en tu memoria.`
      : `Para este tipo de pregunta, lo más importante es leer con atención y descartar las opciones que no tienen sentido con los datos del enunciado.`;

    const explicacion_detallada = p.explicacion
      ? `Ahora bien, aquí está la explicación completa: ${p.explicacion}. ` +
        `Fíjate en cada paso porque es exactamente así como debes pensar cuando veas una pregunta similar en el examen.`
      : `El proceso es el siguiente: primero identifica todos los datos del enunciado. ` +
        `Segundo, elige la fórmula o el concepto que aplica al tipo de problema. ` +
        `Tercero, sustituye los valores con cuidado. ` +
        `Y cuarto, verifica que tu resultado tenga sentido antes de marcar.`;

    const respuesta_part =
      `La respuesta correcta es la opción ${p.respuesta}` +
      (opCorrecta ? `, que dice: ${opCorrecta.text}.` : '.') +
      ` Las otras opciones son distractores diseñados para que te confundas si no aplicas bien el método. ` +
      `Por eso es tan importante entender el proceso, no solo memorizar.`;

    const cierre =
      `¡Excelente! Ya resolviste esta pregunta. ` +
      `¿Ves que no era tan difícil? ` +
      `Tú puedes con esto y con mucho más. ` +
      `${formula ? `Sigue practicando la fórmula de ${formula.label} ` : `Sigue practicando este tipo de preguntas `}` +
      `y cada vez te saldrá más natural y rápido. ` +
      `¡Adelante, tú puedes! Cada pregunta que practicas hoy, es un paso más cerca de tu meta.`;

    return [saludo, enunciado_intro, concepto, explicacion_detallada, respuesta_part, cierre];
  }

  // ── Reproducir audio (una sola vez por pregunta) ──────────────────────────────
  function handleSpeak(p: Pregunta) {
    if (!('speechSynthesis' in window)) return;
    if (played.has(p.id)) return;          // ya reproducido → no repetir
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(null);
      return;
    }

    const partes = buildScript(p);
    const voz    = pickBestVoice();
    let parteIdx = 0;

    function hablarParte() {
      if (parteIdx >= partes.length) {
        // Fin del audio completo
        setSpeaking(null);
        setPlayed(prev  => new Set([...prev, p.id]));
        setExplanationShown(prev => new Set([...prev, p.id]));
        setViewed(prev => new Set([...prev, p.id]));
        return;
      }
      const utt = new SpeechSynthesisUtterance(partes[parteIdx]);
      utt.lang  = 'es-CO';
      utt.rate  = 0.85;
      utt.pitch = 1.1;
      utt.volume = 1;
      if (voz) utt.voice = voz;

      utt.onstart = () => { if (parteIdx === 0) setSpeaking(p.id); };
      utt.onend   = () => { parteIdx++; hablarParte(); };
      utt.onerror = () => { setSpeaking(null); };
      window.speechSynthesis.speak(utt);
    }

    hablarParte();
  }

  // ── Contadores de progreso ──────────────────────────────────────────────────
  const viewedCount  = viewed.size;
  const progressPct  = total > 0 ? Math.round((viewedCount / total) * 100) : 0;

  // ===========================================================================
  //  VISTA: MATERIAS
  // ===========================================================================
  if (view === 'materias') {
    const sumTotal  = materias.reduce((s, m) => s + m.total, 0);
    const sumTemas  = materias.reduce((s, m) => s + m.temas.length, 0);

    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>

        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            Banco de Preguntas&nbsp;|&nbsp;Selecciona una Materia
          </h2>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>
            Estudia cada tema con preguntas reales del ICFES y apoyo del tutor IA
          </p>
        </div>

        {/* Grid de materias */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {materias.map(m => (
            <MateriaCard key={m.key} m={m} onSelect={openMateria} />
          ))}
        </div>

        {/* Resumen */}
        <div style={{
          background: 'rgba(12,18,38,0.8)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: '18px 24px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', letterSpacing: 1, marginBottom: 14 }}>
            RESUMEN DEL BANCO
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, textAlign: 'center' }}>
            {[
              { val: sumTotal ? sumTotal.toLocaleString() : '—', label: 'Total preguntas', color: '#38bdf8' },
              { val: String(materias.length || 5),               label: 'Materias',         color: '#a78bfa' },
              { val: String(sumTemas || 17),                     label: 'Temas',             color: '#34d399' },
              { val: '100%',                                     label: 'Con tutor IA',      color: '#fbbf24' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Flujo de estudio */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Flujo de estudio:</span>
          {['1. Elige materia','2. Elige tema','3. Lee la pregunta','4. Activa tutor IA','5. Pizarra + audio'].map((s, i) => (
            <React.Fragment key={s}>
              <span style={{ fontSize: 11, color: i === 0 ? '#fbbf24' : '#475569' }}>{s}</span>
              {i < 4 && <span style={{ color: '#1e293b', fontSize: 14 }}>›</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // ===========================================================================
  //  VISTA: PREGUNTAS
  // ===========================================================================
  const m = materia!;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 12, color: '#475569' }}>
        <span style={{ cursor: 'pointer', color: '#60a5fa' }} onClick={() => setView('materias')}>
          Materias
        </span>
        <span>›</span>
        <span style={{ color: m.color, fontWeight: 600 }}>{m.label}</span>
        {temaFiltro !== 'Todas' && <><span>›</span><span style={{ color: '#94a3b8' }}>{temaFiltro}</span></>}
      </div>

      {/* Título */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          {m.label}&nbsp;|&nbsp;Preguntas de práctica
        </h2>
        <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
          {total} preguntas&nbsp;·&nbsp;Con explicación IA&nbsp;·&nbsp;Dificultad: Básica a Alta
        </p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Filtro tema */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {['Todas', ...m.temas].map(t => (
            <FilterBtn
              key={t}
              label={t}
              active={temaFiltro === t}
              color={m.color}
              onClick={() => applyFilter(t, difFiltro)}
            />
          ))}
        </div>
        {/* Filtro dificultad */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['Todas', 'MEDIA', 'ALTA', 'RETO'].map(d => {
            const dc = d === 'Todas' ? '#60a5fa' : (diffStyle(d).color);
            return (
              <FilterBtn
                key={d}
                label={d}
                active={difFiltro === d}
                color={dc}
                onClick={() => applyFilter(temaFiltro, d)}
                small
              />
            );
          })}
        </div>
      </div>

      {/* Panel visual flotante */}
      {visualPanel && (
        <QuestionVisualPanel
          question={visualPanel}
          onClose={() => setVisualPanel(null)}
        />
      )}

      {/* Listado de preguntas */}
      <div>
          {loading && preguntas.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 13 }}>
              Cargando preguntas...
            </div>
          )}

          {!loading && preguntas.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 13 }}>
              No hay preguntas para los filtros seleccionados.
            </div>
          )}

          {preguntas.map((p, idx) => (
            <QuestionCard
              key={p.id}
              p={p}
              idx={skipOffset + idx}
              materia={m}
              revealed={revealed.has(p.id)}
              viewed={viewed.has(p.id)}
              speaking={speaking === p.id}
              played={played.has(p.id)}
              showExplanation={explanationShown.has(p.id)}
              onReveal={toggleReveal}
              onVisual={openVisualPanel}
              onSpeak={handleSpeak}
            />
          ))}

          {/* Cargar más */}
          {preguntas.length < total && (
            <button
              onClick={loadMore}
              disabled={loading}
              style={{
                width: '100%', padding: 12,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 8, color: '#475569', fontSize: 12,
                cursor: loading ? 'wait' : 'pointer', marginBottom: 16,
              }}
            >
              {loading ? 'Cargando...' : `Cargar más (${total - preguntas.length} restantes)`}
            </button>
          )}

          {/* Barra de progreso */}
          <div style={{
            background: 'rgba(12,18,38,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '12px 16px', marginTop: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Tu progreso en {m.label}</span>
              <span style={{ fontSize: 11, color: m.color }}>{progressPct}% ({viewedCount}/{total})</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }}>
              <div style={{
                width: `${progressPct}%`, height: '100%',
                background: m.color, borderRadius: 3, transition: 'width 0.4s',
              }} />
            </div>
          </div>
        </div>
    </div>
  );
}

// =============================================================================
//  Sub-componentes
// =============================================================================

// ── Tarjeta de materia ────────────────────────────────────────────────────────
function MateriaCard({ m, onSelect }: { m: Materia; onSelect: (m: Materia) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={() => onSelect(m)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'rgba(12,18,38,0.8)',
        border: `1.5px solid ${hover ? m.color + 'a0' : m.color + '30'}`,
        borderRadius: 14, padding: '20px 22px',
        cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.label}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: m.color,
          background: `${m.color}15`, border: `1px solid ${m.color}30`,
          borderRadius: 20, padding: '2px 10px',
        }}>
          {m.total} preguntas
        </span>
      </div>
      <div style={{ marginBottom: 16 }}>
        {m.temas.map(t => (
          <div key={t} style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
            - {t}{m.tema_counts[t] ? ` (${m.tema_counts[t]})` : ''}
          </div>
        ))}
      </div>
      <button
        style={{
          padding: '6px 16px', background: 'transparent',
          border: `1px solid ${m.color}50`, borderRadius: 8,
          color: m.color, fontSize: 12, cursor: 'pointer',
          pointerEvents: 'none',
        }}
      >
        Ver preguntas →
      </button>
    </div>
  );
}

// ── Botón de filtro ───────────────────────────────────────────────────────────
function FilterBtn({
  label, active, color, onClick, small = false,
}: { label: string; active: boolean; color: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '4px 10px' : '5px 14px',
        borderRadius: small ? 6 : 20,
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.09)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : '#64748b',
        fontSize: 11, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ── Tarjeta de pregunta ───────────────────────────────────────────────────────
// ── Mini componente fórmula MathJax ───────────────────────────────────────────
function FormulaBox({ tex, isLatex, label, vars, color }: {
  tex: string; isLatex: boolean; label: string; vars?: string; color: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !isLatex) return;
    ref.current.innerHTML = `\\[${tex}\\]`;
    try { MathJax.typesetPromise([ref.current]).catch(() => {}); } catch {}
  }, [tex, isLatex]);

  return (
    <div style={{
      background: '#0d1117', border: `1px solid ${color}40`,
      borderRadius: 10, padding: '12px 16px', marginTop: 10,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.08em', marginBottom: 6 }}>
        🧮 FÓRMULA — {label.toUpperCase()}
      </div>
      {isLatex
        ? <div ref={ref} style={{ color, fontSize: 15, textAlign: 'center', minHeight: 36 }} />
        : <div style={{ fontSize: 13, color, fontFamily: 'monospace', textAlign: 'center', padding: '6px 0' }}>{tex}</div>
      }
      {vars && (
        <div style={{ fontSize: 11, color: '#6e7681', marginTop: 8, lineHeight: 1.6 }}>{vars}</div>
      )}
    </div>
  );
}

// ── Tarjeta de pregunta ───────────────────────────────────────────────────────
function QuestionCard({
  p, idx, materia, revealed, viewed: isViewed,
  speaking, played, showExplanation,
  onReveal, onVisual, onSpeak,
}: {
  p: Pregunta; idx: number; materia: Materia;
  revealed: boolean; viewed: boolean;
  speaking: boolean; played: boolean; showExplanation: boolean;
  onReveal: (id: string) => void;
  onVisual: (p: Pregunta) => void;
  onSpeak:  (p: Pregunta) => void;
}) {
  const [showFormula, setShowFormula] = useState(false);
  const dc  = diffStyle(p.dificultad);
  const pf  = getPureFormula(p.area, p.enunciado);

  // Mostrar fórmula automáticamente cuando termina el audio
  useEffect(() => { if (showExplanation && pf) setShowFormula(true); }, [showExplanation]);

  // Adaptar para QuestionInlineVisual
  const qvp = {
    id: p.id, stem: p.enunciado, area: p.area,
    points: 1, difficulty: p.dificultad, options: p.opciones,
  };

  return (
    <div style={{
      background: 'rgba(12,18,38,0.8)',
      border: `1px solid ${isViewed ? materia.color + '40' : 'rgba(255,255,255,0.07)'}`,
      borderLeft: `3px solid ${isViewed ? materia.color + '80' : 'transparent'}`,
      borderRadius: 12, padding: '18px 20px', marginBottom: 12,
      transition: 'border-color 0.2s',
    }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: materia.color }}>Pregunta #{idx + 1}</span>
          {p.codigo && <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{p.codigo}</span>}
          <span style={{ fontSize: 10, color: '#475569' }}>{p.tema}</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, color: dc.color,
          background: dc.bg, border: `1px solid ${dc.color}30`,
          padding: '2px 8px', borderRadius: 10,
        }}>
          {p.dificultad}
        </span>
      </div>

      {/* Enunciado */}
      <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, marginBottom: 10 }}>{p.enunciado}</p>

      {/* ── Visual inline: diagrama + fórmula ── */}
      <QuestionInlineVisual question={qvp} color={materia.color} />

      {/* Opciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, marginTop: 12 }}>
        {p.opciones.map(o => {
          const isCorrect = o.label === p.respuesta;
          return (
            <div
              key={o.label}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '7px 12px', borderRadius: 6,
                background: revealed && isCorrect ? 'rgba(63,185,80,0.10)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${revealed && isCorrect ? 'rgba(63,185,80,0.35)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <span style={{
                fontSize: 11, fontWeight: 700, width: 16, flexShrink: 0, marginTop: 1,
                color: revealed && isCorrect ? '#3fb950' : '#475569',
              }}>{o.label}</span>
              <span style={{ fontSize: 12, color: revealed && isCorrect ? '#3fb950' : '#94a3b8', flex: 1, lineHeight: 1.5 }}>
                {o.text}
              </span>
              {revealed && isCorrect && (
                <span style={{ fontSize: 10, color: '#3fb950', fontWeight: 600, flexShrink: 0 }}>[Correcta]</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Explicación rápida */}
      {revealed && p.explicacion && (
        <div style={{
          background: 'rgba(210,153,34,0.07)', border: '1px solid rgba(210,153,34,0.2)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12,
          fontSize: 12, color: '#d29922', lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 700 }}>Explicación: </span>{p.explicacion}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => onReveal(p.id)}
          style={{
            padding: '6px 14px', background: 'transparent',
            border: `1px solid ${materia.color}40`, borderRadius: 8,
            color: materia.color, fontSize: 11, cursor: 'pointer',
          }}
        >
          {revealed ? 'Ocultar respuesta' : '👁 Ver respuesta'}
        </button>
        <button
          onClick={() => onVisual(p)}
          style={{
            padding: '6px 14px', background: 'transparent',
            border: '1px solid rgba(96,165,250,0.35)', borderRadius: 8,
            color: '#60a5fa', fontSize: 11, cursor: 'pointer',
          }}
        >
          📐 Ver guía visual
        </button>
        {/* Botón audio: solo disponible si no se ha reproducido aún */}
        {!played ? (
          <button
            onClick={() => onSpeak(p)}
            disabled={speaking}
            style={{
              padding: '6px 14px',
              background: speaking ? 'rgba(52,211,153,0.12)' : 'transparent',
              border: `1px solid ${speaking ? 'rgba(52,211,153,0.5)' : 'rgba(52,211,153,0.25)'}`,
              borderRadius: 8, color: '#34d399', fontSize: 11,
              cursor: speaking ? 'wait' : 'pointer', opacity: speaking ? 0.8 : 1,
            }}
          >
            {speaking ? '🔊 Reproduciendo...' : '🔊 Escuchar explicación'}
          </button>
        ) : (
          <span style={{
            padding: '6px 14px', fontSize: 11, color: '#34d399',
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 8,
          }}>
            ✓ Audio reproducido
          </span>
        )}
        {pf && (
          <button
            onClick={() => setShowFormula(f => !f)}
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid rgba(210,153,34,0.3)',
              borderRadius: 8, color: '#d29922', fontSize: 11, cursor: 'pointer',
            }}
          >
            {showFormula ? 'Ocultar fórmula' : '🧮 Ver fórmula'}
          </button>
        )}
      </div>

      {/* ── Fórmula MathJax — aparece tras el audio ── */}
      {showFormula && pf && (
        <FormulaBox tex={pf.tex} isLatex={pf.isLatex} label={pf.label} vars={pf.vars} color={materia.color} />
      )}

      {/* ── Explicación completa — aparece al terminar el audio ── */}
      {showExplanation && (
        <div style={{
          marginTop: 14,
          background: 'rgba(12,18,38,0.95)',
          border: `1px solid ${materia.color}30`,
          borderLeft: `3px solid ${materia.color}`,
          borderRadius: 10, padding: '14px 16px',
          animation: 'fadeIn 0.5s ease',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: materia.color, letterSpacing: '.08em', marginBottom: 10 }}>
            📋 EXPLICACIÓN COMPLETA
          </div>

          {/* Respuesta correcta destacada */}
          <div style={{
            background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.25)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 10,
            fontSize: 12, color: '#3fb950', fontWeight: 600,
          }}>
            ✓ Respuesta correcta — Opción {p.respuesta}:{' '}
            <span style={{ fontWeight: 400 }}>
              {p.opciones.find(o => o.label === p.respuesta)?.text}
            </span>
          </div>

          {/* Explicación del banco */}
          {p.explicacion && (
            <p style={{ fontSize: 13, color: '#c9d1d9', lineHeight: 1.75, margin: '0 0 10px' }}>
              {p.explicacion}
            </p>
          )}

          {/* Pasos de razonamiento */}
          <div style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6, color: '#94a3b8', fontWeight: 600 }}>Método paso a paso:</div>
            {['Identifica los datos que te dan en el enunciado.',
              'Elige la fórmula o concepto que aplica al tipo de problema.',
              'Sustituye los valores con cuidado, sin saltarte pasos.',
              'Verifica que tu resultado tenga sentido con las unidades y el contexto.',
            ].map((paso, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: materia.color, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span>{paso}</span>
              </div>
            ))}
          </div>

          {/* Mensaje motivacional */}
          <div style={{
            marginTop: 12, padding: '8px 12px',
            background: `${materia.color}08`, border: `1px solid ${materia.color}20`,
            borderRadius: 8, fontSize: 12, color: materia.color, fontStyle: 'italic',
          }}>
            🌟 ¡Tú puedes! Sigue practicando esta fórmula y cada vez te saldrá más natural.
          </div>
        </div>
      )}
    </div>
  );
}

