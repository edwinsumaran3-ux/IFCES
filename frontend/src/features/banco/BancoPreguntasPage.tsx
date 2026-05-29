// =============================================================================
//  frontend/src/features/banco/BancoPreguntasPage.tsx
//  Banco de Preguntas — Panel por Materia / Tema / Preguntas + Tutor IA
// =============================================================================
import React, { useState, useEffect } from 'react';
import AcrylicWhiteboard from '../ai-help/AcrylicWhiteboard';
import NeuralAudioPlayer from '../ai-help/NeuralAudioPlayer';
import MirrorQuestion from '../ai-help/MirrorQuestion';

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

interface AIData {
  whiteboard: any;
  audio_script: any;
  audio_mp3_base64: string;
  mirror_question: any;
  session_id: string;
}

type View = 'materias' | 'preguntas';
type AiTab = 'pizarra' | 'audio' | 'espejo';

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
  const [view,            setView]            = useState<View>('materias');
  const [materias,        setMaterias]        = useState<Materia[]>([]);
  const [materia,         setMateria]         = useState<Materia | null>(null);
  const [temaFiltro,      setTemaFiltro]      = useState('Todas');
  const [difFiltro,       setDifFiltro]       = useState('Todas');
  const [preguntas,       setPreguntas]       = useState<Pregunta[]>([]);
  const [total,           setTotal]           = useState(0);
  const [skipOffset,      setSkipOffset]      = useState(0);
  const [loading,         setLoading]         = useState(false);
  const [aiLoading,       setAiLoading]       = useState(false);
  const [aiData,          setAiData]          = useState<AIData | null>(null);
  const [activePregunta,  setActivePregunta]  = useState<Pregunta | null>(null);
  const [aiTab,           setAiTab]           = useState<AiTab>('pizarra');
  const [revealed,        setRevealed]        = useState<Set<string>>(new Set());
  const [viewed,          setViewed]          = useState<Set<string>>(new Set());

  // Cargar materias al montar
  useEffect(() => { fetchMaterias(); }, []);

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
    setAiData(null);
    setActivePregunta(null);
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

  async function handleExplicar(p: Pregunta) {
    setActivePregunta(p);
    setAiLoading(true);
    setAiData(null);
    setAiTab('pizarra');
    // Marcar como vista
    setViewed(prev => { const s = new Set(prev); s.add(p.id); return s; });
    try {
      await fetch(`${API}/banco/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, question_id: p.id }),
      });
      const res = await fetch(`${API}/banco/preguntas/${p.id}/explicar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, student_gender: 'neutral' }),
      });
      if (res.ok) setAiData(await res.json());
    } catch {}
    setAiLoading(false);
  }

  function toggleReveal(id: string) {
    setRevealed(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
    setViewed(prev => { const s = new Set(prev); s.add(id); return s; });
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

      {/* Layout principal */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: activePregunta ? '1fr 380px' : '1fr',
        gap: 20,
        alignItems: 'start',
      }}>

        {/* ── Listado de preguntas ── */}
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
              active={activePregunta?.id === p.id}
              viewed={viewed.has(p.id)}
              onReveal={toggleReveal}
              onExplicar={handleExplicar}
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

        {/* ── Panel Tutor IA ── */}
        {activePregunta && (
          <div style={{ position: 'sticky', top: 64 }}>
            <AITutorPanel
              pregunta={activePregunta}
              materia={m}
              loading={aiLoading}
              data={aiData}
              tab={aiTab}
              onTab={setAiTab}
              onClose={() => { setActivePregunta(null); setAiData(null); }}
            />
          </div>
        )}
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
function QuestionCard({
  p, idx, materia, revealed, active, viewed: isViewed,
  onReveal, onExplicar,
}: {
  p: Pregunta; idx: number; materia: Materia;
  revealed: boolean; active: boolean; viewed: boolean;
  onReveal: (id: string) => void;
  onExplicar: (p: Pregunta) => void;
}) {
  const dc = diffStyle(p.dificultad);

  return (
    <div style={{
      background: active ? 'rgba(15,10,40,0.97)' : 'rgba(12,18,38,0.8)',
      border: `1px solid ${active ? materia.color + '70' : 'rgba(255,255,255,0.07)'}`,
      borderLeft: `3px solid ${active ? materia.color : (isViewed ? materia.color + '50' : 'transparent')}`,
      borderRadius: 12, padding: '18px 20px', marginBottom: 12,
      transition: 'border-color 0.2s',
    }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: materia.color }}>
            Pregunta #{idx + 1}
          </span>
          {p.codigo && (
            <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{p.codigo}</span>
          )}
          <span style={{ fontSize: 10, color: '#475569' }}>{p.tema}</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, color: dc.color,
          background: dc.bg, border: `1px solid ${dc.color}30`,
          padding: '2px 8px', borderRadius: 10,
        }}>
          DIFICULTAD: {p.dificultad}
        </span>
      </div>

      {/* Enunciado */}
      <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, marginBottom: 14 }}>
        {p.enunciado}
      </p>

      {/* Opciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
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
          borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12,
          color: '#d29922', lineHeight: 1.6,
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
          {revealed ? 'Ocultar respuesta' : 'Ver respuesta'}
        </button>
        <button
          onClick={() => onExplicar(p)}
          style={{
            padding: '6px 14px',
            background: active ? 'rgba(124,58,237,0.12)' : 'transparent',
            border: `1px solid ${active ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.25)'}`,
            borderRadius: 8, color: '#a78bfa', fontSize: 11, cursor: 'pointer',
          }}
        >
          🧠 Explicar con IA →
        </button>
      </div>
    </div>
  );
}

// ── Panel del Tutor IA ────────────────────────────────────────────────────────
function AITutorPanel({
  pregunta, materia, loading, data, tab, onTab, onClose,
}: {
  pregunta: Pregunta; materia: Materia;
  loading: boolean; data: AIData | null;
  tab: AiTab; onTab: (t: AiTab) => void;
  onClose: () => void;
}) {
  const LOAD_MSGS = [
    'Clasificando pregunta ICFES...',
    'Diseñando estrategia socrática...',
    'Generando pizarra acrílica...',
    'Sintetizando audio pedagógico...',
    'Creando pregunta espejo...',
  ];
  const [loadIdx, setLoadIdx] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setLoadIdx(0);
    const id = setInterval(() => setLoadIdx(i => (i + 1) % LOAD_MSGS.length), 900);
    return () => clearInterval(id);
  }, [loading]);

  return (
    <div style={{
      background: 'rgba(18,8,48,0.97)',
      border: '1px solid rgba(124,58,237,0.35)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'rgba(124,58,237,0.15)', padding: '12px 16px',
        borderBottom: '1px solid rgba(124,58,237,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa' }}>
            🧠 Tutor IA — Explicación socrática
          </div>
          <div style={{ fontSize: 10, color: '#6d28d9', marginTop: 2 }}>
            {pregunta.area}&nbsp;·&nbsp;{pregunta.tema}&nbsp;·&nbsp;{pregunta.dificultad}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none',
            color: '#475569', cursor: 'pointer', fontSize: 14, lineHeight: 1,
          }}
        >✕</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['pizarra', 'audio', 'espejo'] as AiTab[]).map(t => (
          <button
            key={t}
            onClick={() => onTab(t)}
            style={{
              flex: 1, padding: '9px 0',
              background: tab === t ? 'rgba(124,58,237,0.15)' : 'transparent',
              border: 'none',
              borderBottom: tab === t ? '2px solid #7c3aed' : '2px solid transparent',
              color: tab === t ? '#a78bfa' : '#475569',
              fontSize: 11, fontWeight: tab === t ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {t === 'pizarra' ? '📋 Pizarra' : t === 'audio' ? '🔊 Audio' : '🪞 Espejo'}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div style={{ padding: 16, maxHeight: 520, overflowY: 'auto' }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🧠</div>
            <div style={{ fontSize: 12, color: '#7c3aed', marginBottom: 6 }}>
              {LOAD_MSGS[loadIdx]}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
              {[0,1,2].map(i => (
                <div
                  key={i}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#7c3aed',
                    opacity: (loadIdx % 3) === i ? 1 : 0.25,
                    transition: 'opacity 0.3s',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Sin datos */}
        {!loading && !data && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: '#334155', fontSize: 12 }}>
            Haz clic en "Explicar con IA" para activar el tutor socrático.
          </div>
        )}

        {/* Pizarra */}
        {!loading && data && tab === 'pizarra' && data.whiteboard && (
          <AcrylicWhiteboard whiteboard={data.whiteboard} visible />
        )}

        {/* Audio */}
        {!loading && data && tab === 'audio' && (
          <NeuralAudioPlayer
            audioBase64={data.audio_mp3_base64 || ''}
            script={data.audio_script?.tts_script || ''}
            gender="neutral"
            durationSec={data.audio_script?.estimated_duration_seconds || 60}
          />
        )}

        {/* Espejo */}
        {!loading && data && tab === 'espejo' && data.mirror_question && (
          <MirrorQuestion
            mirror={data.mirror_question}
            sessionId={data.session_id || 'banco'}
            originalPoints={1}
            onAnswered={() => {}}
          />
        )}
      </div>

      {/* Nota latencia */}
      {!loading && data && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.04)',
          padding: '6px 14px', fontSize: 9, color: '#334155', textAlign: 'right',
        }}>
          Generado en {data.session_id ? '~' : ''}...ms · Motor Claude Haiku
        </div>
      )}
    </div>
  );
}
