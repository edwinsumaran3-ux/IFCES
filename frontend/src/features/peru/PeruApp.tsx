// =============================================================================
//  PeruApp.tsx — Aplicación TES-LA PRO (Perú) — Examen de Admisión
// =============================================================================
import React, { useState, useEffect } from 'react'
import PeruExamEngine from './PeruExamEngine'
import PeruPaymentPage from './PeruPaymentPage'

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
        <NavBar user={user} onLogout={onLogout} onBack={() => setView('home')} />
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
    { sec: 'A', label: 'Letras', color: '#2563eb', materias: 7 },
    { sec: 'B', label: 'Ciencias', color: '#16a34a', materias: 4 },
    { sec: 'C', label: 'General', color: '#ca8a04', materias: 6 },
    { sec: 'D', label: 'Específica', color: '#dc2626', materias: 5 },
  ]

  return (
    <div style={r.root}>
      <NavBar user={user} onLogout={onLogout} />

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '44px 20px' }}>

        {/* Bienvenida */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 20, padding: '4px 14px', fontSize: 11, color: '#fca5a5', marginBottom: 16 }}>
            🇵🇪 Examen de Admisión · Perú · TES-LA PRO
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#f1f5f9', marginBottom: 10, letterSpacing: -0.5 }}>
            ¡Hola, {user.full_name?.split(' ')[0]}! 👋
          </h1>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, maxWidth: 500, margin: '0 auto 28px' }}>
            Prepárate para el examen de admisión con IA y neurociencia.<br />
            Selecciona tu sección y empieza a practicar.
          </p>
          <button onClick={() => setView('selector')} disabled={loading} style={r.bigBtn}>
            🚀 Elegir Sección y Empezar Examen
          </button>
          {error && <div style={{ ...r.errorBox, display: 'inline-block', marginTop: 12 }}>⚠ {error}</div>}
        </div>

        {/* Distribución por secciones */}
        <div style={r.statsCard}>
          <div style={r.statsTitle}>BANCO DE PREGUNTAS POR SECCIÓN</div>
          {seccionesStats.map(s => (
            <div key={s.sec} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ ...r.secBadge, background: s.color, width: 28, height: 28, borderRadius: 8, fontSize: 11 }}>{s.sec}</div>
              <div style={{ fontSize: 11, color: '#64748b', width: 110 }}>Sección {s.sec} · {s.label}</div>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(s.materias / 8) * 100}%`, height: '100%', background: s.color, borderRadius: 3, opacity: 0.8 }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: s.color, width: 60, textAlign: 'right' }}>{s.materias} materias</div>
            </div>
          ))}
        </div>

        {/* Features */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12, background: 'rgba(12,18,38,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 16 }}>
          {[
            { label: 'Motor IA', val: 'Claude Sonnet', color: '#a78bfa' },
            { label: 'Voz', val: 'Peruana · Masculina', color: '#34d399' },
            { label: 'Secciones', val: 'A · B · C · D', color: '#fca5a5' },
            { label: 'Pagos', val: 'Yape · Plin', color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: '#334155', marginBottom: 4, letterSpacing: 0.5 }}>{s.label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {showPayment && <PeruPaymentPage user={user} onPaid={() => setShowPayment(false)} onClose={() => setShowPayment(false)} />}
    </div>
  )
}

// ── NavBar ────────────────────────────────────────────────────────────────────
function NavBar({ user, onLogout, onBack }: { user: PeruUser; onLogout: () => void; onBack?: () => void }) {
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
        {onBack && (
          <button onClick={onBack} style={r.navBtn}>← Inicio</button>
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
