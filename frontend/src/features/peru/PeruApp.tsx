// =============================================================================
//  PeruApp.tsx — Aplicación TES-LA PRO (Perú) — Examen de Admisión
// =============================================================================
import React, { useState, useEffect } from 'react'
import PeruExamEngine from './PeruExamEngine'
import PeruBancoPreguntasPage from './PeruBancoPreguntasPage'
import PeruPaymentPage from './PeruPaymentPage'
import AvatarTutorIA from '../avatar/AvatarTutorIA'
import { useScreenGuide, useAudioGuide } from '../audio/AudioGuide'

const BACKEND = 'https://ifces-production.up.railway.app'

interface PeruUser { id: string; email: string; full_name: string; role: string; plan_code?: string; country: 'PE' }

type Seccion = 'A' | 'B' | 'C' | 'D'
type SeccionCombo = 'A' | 'AB' | 'BC' | 'D' | 'ABCD'
type View = 'home' | 'selector' | 'exam' | 'banco'
interface ExamState { attemptId: string; questions: any[]; durationSecs: number; seccion: SeccionCombo }

interface Props {
  user: PeruUser
  onLogout: () => void
}

const SECCIONES_INFO: Record<SeccionCombo, { label: string; desc: string; materias: string[]; color: string }> = {
  A:    { label: 'Sección A',   color: '#2563eb', desc: 'Letras y Ciencias Sociales', materias: ['Lenguaje', 'Literatura', 'Historia del Perú', 'Historia Universal', 'Geografía', 'Filosofía', 'Psicología'] },
  B:    { label: 'Sección B',   color: '#16a34a', desc: 'Ciencias y Matemáticas',     materias: ['Matemática', 'Física', 'Química', 'Biología'] },
  AB:   { label: 'Sección A+B', color: '#7c3aed', desc: 'Letras + Ciencias',          materias: ['Lenguaje', 'Literatura', 'Historia', 'Matemática', 'Física', 'Química', 'Biología'] },
  BC:   { label: 'Sección B+C', color: '#ca8a04', desc: 'Ciencias + General',         materias: ['Matemática', 'Física', 'Química', 'Biología', 'Razonamiento Verbal', 'Razonamiento Matemático'] },
  ABCD: { label: 'Completo',    color: '#dc2626', desc: 'Todas las secciones',        materias: ['Lenguaje', 'Matemática', 'Historia', 'Física', 'Química', 'Biología', 'Geografía', 'Filosofía'] },
}

export default function PeruApp({ user, onLogout }: Props) {
  useScreenGuide('home_pe', 1200)
  const { speaking, enabled, toggleEnabled, stop } = useAudioGuide()
  const [view,        setView]        = useState<View>('home')
  const [examState,   setExamState]   = useState<ExamState | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [selSeccion,  setSelSeccion]  = useState<SeccionCombo | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('user_peru')
    const token = localStorage.getItem('access_token_peru')
    if (!saved || !token) onLogout()
  }, [])

  const startExam = async (seccion: SeccionCombo) => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BACKEND}/api/v1/peru/exams/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token_peru') || ''}`,
        },
        body: JSON.stringify({ student_id: user.id, seccion, student_gender: 'male', locale: 'es-PE' }),
      })
      if (res.status === 402) { setShowPayment(true); return }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail || 'Error al iniciar examen')
      }
      const data = await res.json()
      setExamState({ attemptId: data.attempt_id, questions: data.questions, durationSecs: data.duration_secs, seccion })
      setView('exam')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  // ── SELECTOR DE SECCIÓN ──────────────────────────────────────────────────
  if (view === 'selector') {
    return (
      <div style={r.root}>
        <NavBar user={user} onLogout={onLogout} onBack={() => setView('home')} speaking={speaking} enabled={enabled} onAudio={() => speaking ? stop() : toggleEnabled()} />
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>
              Selecciona tu Sección de Examen
            </h2>
            <p style={{ fontSize: 13, color: '#475569' }}>
              Elige la combinación de secciones según tu carrera objetivo
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {(Object.entries(SECCIONES_INFO) as [SeccionCombo, typeof SECCIONES_INFO['A']][]).map(([key, info]) => (
              <div
                key={key}
                onClick={() => setSelSeccion(key)}
                style={{
                  ...r.secCard,
                  border: selSeccion === key ? `2px solid ${info.color}` : '1px solid rgba(255,255,255,0.07)',
                  background: selSeccion === key ? `rgba(${hexToRgb(info.color)},0.1)` : 'rgba(12,18,38,0.9)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ ...r.secBadge, background: info.color }}>{key}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>{info.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{info.desc}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {info.materias.slice(0, 4).map(m => (
                    <span key={m} style={{ fontSize: 9, color: info.color, background: `rgba(${hexToRgb(info.color)},0.1)`, border: `1px solid rgba(${hexToRgb(info.color)},0.25)`, borderRadius: 20, padding: '2px 7px' }}>{m}</span>
                  ))}
                  {info.materias.length > 4 && <span style={{ fontSize: 9, color: '#475569' }}>+{info.materias.length - 4} más</span>}
                </div>
              </div>
            ))}
          </div>

          {error && <div style={r.errorBox}>⚠ {error}</div>}

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <button
              onClick={() => selSeccion && startExam(selSeccion)}
              disabled={!selSeccion || loading}
              style={{
                ...r.bigBtn,
                background: selSeccion ? SECCIONES_INFO[selSeccion].color : '#1e293b',
                opacity: !selSeccion ? 0.5 : 1,
                cursor: !selSeccion ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '⏳ Preparando examen...' : selSeccion ? `🚀 Iniciar Examen — ${SECCIONES_INFO[selSeccion].label}` : 'Selecciona una sección primero'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── BANCO DE PREGUNTAS ───────────────────────────────────────────────────
  if (view === 'banco') {
    return (
      <div style={r.root}>
        <NavBar user={user} onLogout={onLogout} onBack={() => setView('home')} speaking={speaking} enabled={enabled} onAudio={() => speaking ? stop() : toggleEnabled()} />
        <PeruBancoPreguntasPage user={user} onBack={() => setView('home')} />
      </div>
    )
  }

  // ── EXAM ENGINE ──────────────────────────────────────────────────────────
  if (view === 'exam' && examState) {
    return (
      <PeruExamEngine
        attemptId={examState.attemptId}
        studentId={user.id}
        questions={examState.questions}
        durationSecs={examState.durationSecs}
        seccion={examState.seccion}
        onExit={() => { setView('home'); setExamState(null) }}
      />
    )
  }

  // ── HOME ─────────────────────────────────────────────────────────────────
  const seccionesStats = [
    { sec: 'A', label: 'Letras / Sociales',  color: '#2563eb', preguntas: 503 },
    { sec: 'B', label: 'Ciencias / Matemát.', color: '#16a34a', preguntas: 273 },
    { sec: 'C', label: 'Ciencias de Salud',  color: '#ca8a04', preguntas: 0 },
    { sec: 'D', label: 'Agropecuaria',       color: '#dc2626', preguntas: 0 },
  ]

  return (
    <div style={r.root}>
      <NavBar user={user} onLogout={onLogout} speaking={speaking} enabled={enabled} onAudio={() => speaking ? stop() : toggleEnabled()} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 20px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* ── COLUMNA IZQUIERDA ────────────────────────────────────────── */}
        <div style={{ flex: 1 }}>
          {/* Bienvenida */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 20, padding: '4px 14px', fontSize: 11, color: '#fca5a5', marginBottom: 16 }}>
              🇵🇪 Examen de Admisión · Perú · TES-LA PRO
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#f1f5f9', marginBottom: 10, letterSpacing: -0.5 }}>
              ¡Hola, {user.full_name?.split(' ')[0]}! 👋
            </h1>
            <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, maxWidth: 500, marginBottom: 24 }}>
              Prepárate para el examen de admisión UNT con IA socrática, pizarra digital, audio tutor peruano y diagrama de fórmulas.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
              <button onClick={() => setView('banco')} style={{ ...r.bigBtn, background: '#16a34a', border: '1px solid rgba(22,163,74,0.4)', fontSize: 15 }}>
                📚 Banco de Preguntas Explicadas
              </button>
              <button onClick={() => setView('selector')} disabled={loading} style={{ ...r.bigBtn, background: 'transparent', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5', fontSize: 13 }}>
                🚀 Examen de Admisión
              </button>
            </div>
            {error && <div style={{ ...r.errorBox, marginTop: 12 }}>⚠ {error}</div>}
          </div>

          {/* Distribución por secciones */}
          <div style={r.statsCard}>
            <div style={r.statsTitle}>DISTRIBUCIÓN DEL EXAMEN — UNT</div>
            {seccionesStats.map(s => (
              <div key={s.sec} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ ...r.secBadge, background: s.color, width: 28, height: 28, borderRadius: 8, fontSize: 11 }}>{s.sec}</div>
                <div style={{ fontSize: 11, color: '#64748b', width: 140 }}>Sección {s.sec} · {s.label}</div>
                <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${(s.preguntas / 503) * 100}%`, height: '100%', background: s.color, borderRadius: 3, opacity: 0.8 }} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: s.color, width: 72, textAlign: 'right' as const }}>{s.preguntas > 0 ? `${s.preguntas} pregs.` : 'En carga'}</div>
              </div>
            ))}
          </div>

          {/* Features */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12, background: 'rgba(12,18,38,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
            {[
              { label: 'Motor IA', val: 'Claude Sonnet', color: '#a78bfa' },
              { label: 'Audio tutor', val: 'Acento peruano', color: '#34d399' },
              { label: 'Fórmulas', val: 'Diagramas + LaTeX', color: '#fbbf24' },
              { label: 'Pagos', val: 'Yape · Plin', color: '#fca5a5' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#334155', marginBottom: 4, letterSpacing: 0.5 }}>{s.label}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── COLUMNA DERECHA: AVATAR ──────────────────────────────────── */}
        <div style={{ flex: '0 0 320px', position: 'sticky' as const, top: 24 }}>
          <AvatarTutorIA
            text={`¡Bienvenido ${user.full_name?.split(' ')[0]}! Soy tu tutor virtual peruano. Cuando inicies el examen, estaré contigo en cada pregunta explicándote los conceptos paso a paso con inteligencia artificial. ¡Prepárate para ingresar a tu universidad!`}
            gender="male"
            autoPlay
            label="Tutor TES-LA PRO · IA Perú"
          />
          <div style={{ marginTop: 12, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>🎙 AUDIO GUÍA</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              El tutor te explica cada pregunta con voz peruana. Usa el botón <strong style={{ color: '#fca5a5' }}>🔊</strong> del menú para activar/desactivar.
            </div>
          </div>
        </div>
      </div>

      {showPayment && <PeruPaymentPage user={user} onPaid={() => setShowPayment(false)} onClose={() => setShowPayment(false)} />}
    </div>
  )
}

// ── NavBar ────────────────────────────────────────────────────────────────────
function NavBar({ user, onLogout, onBack, speaking, enabled, onAudio }: {
  user: PeruUser; onLogout: () => void; onBack?: () => void
  speaking?: boolean; enabled?: boolean; onAudio?: () => void
}) {
  return (
    <nav style={r.nav}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🇵🇪</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fca5a5', letterSpacing: -0.3 }}>TES-LA PRO</div>
          <div style={{ fontSize: 9, color: '#374151', letterSpacing: 0.5 }}>ACADEMIA VIRTUAL · IA · NEUROCIENCIA</div>
        </div>
        <span style={{ fontSize: 10, color: '#dc2626', background: 'rgba(220,38,38,0.08)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(220,38,38,0.15)' }}>v1.0</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {onBack && <button onClick={onBack} style={r.navBtn}>← Inicio</button>}

        {/* Botón audio */}
        {onAudio && (
          <button
            onClick={onAudio}
            title={speaking ? 'Detener audio' : enabled ? 'Audio activo — clic para desactivar' : 'Audio desactivado — clic para activar'}
            style={{ width: 34, height: 34, borderRadius: '50%', background: speaking ? 'rgba(239,68,68,0.2)' : enabled ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${speaking ? 'rgba(239,68,68,0.4)' : enabled ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {speaking ? '⏹' : enabled ? '🔊' : '🔇'}
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '4px 12px 4px 6px' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(220,38,38,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fca5a5', fontWeight: 600 }}>
            {user.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{user.full_name?.split(' ')[0]}</span>
        </div>
        <button onClick={onLogout} style={{ ...r.navBtn, color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}>Salir</button>
      </div>
    </nav>
  )
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

const r: Record<string, React.CSSProperties> = {
  root: { background: '#040813', minHeight: '100vh', fontFamily: 'Inter,system-ui,sans-serif', color: '#e2e8f0' },
  nav: { background: 'rgba(4,8,19,0.97)', borderBottom: '1px solid rgba(220,38,38,0.15)', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 },
  navBtn: { padding: '5px 14px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#475569', fontFamily: 'inherit' },
  statsCard: { background: 'rgba(12,18,38,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20 },
  statsTitle: { fontSize: 10, fontWeight: 600, color: '#475569', letterSpacing: 1, marginBottom: 14 },
  secCard: { borderRadius: 14, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.2s' },
  secBadge: { width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0 },
  bigBtn: { padding: '13px 36px', background: '#dc2626', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', letterSpacing: -0.2, fontFamily: 'inherit' },
  errorBox: { marginTop: 10, fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 14px' },
}
