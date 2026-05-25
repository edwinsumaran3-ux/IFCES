// =============================================================================
//  src/App.tsx  — ERP ICFES Neuro-IA  v4.0
//  Carga las 245 preguntas reales desde PostgreSQL via FastAPI
// =============================================================================
import React, { useState } from 'react'
import TeacherDashboard from './features/teacher/TeacherDashboard'
import ExamEngine from './features/exam/ExamEngine'

type View = 'home' | 'exam' | 'teacher'

interface Question {
  id: string
  stem: string
  area: string
  points: number
  options: { label: string; text: string }[]
}

interface ExamState {
  attemptId:    string
  questions:    Question[]
  durationSecs: number
}

export default function App() {
  const [view,      setView]      = useState<View>('home')
  const [examState, setExamState] = useState<ExamState | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  // ── Iniciar simulacro real ────────────────────────────────────────────────
  const startExam = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/v1/exams/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id:     'demo-student-001',
          student_gender: 'female',
          locale:         'es-CO',
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Error al iniciar el simulacro')
      }

      const data = await res.json()
      setExamState({
        attemptId:    data.attempt_id,
        questions:    data.questions,
        durationSecs: data.duration_secs,
      })
      setView('exam')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Distribución oficial ICFES ────────────────────────────────────────────
  const distribucion = [
    { area: 'Lectura Crítica',       preguntas: 60, color: '#00d4ff' },
    { area: 'Ciencias Naturales',    preguntas: 55, color: '#34d399' },
    { area: 'Matemáticas',           preguntas: 50, color: '#a78bfa' },
    { area: 'Sociales y Ciudadanas', preguntas: 50, color: '#fbbf24' },
    { area: 'Inglés',                preguntas: 30, color: '#f87171' },
  ]

  return (
    <div style={{ background: '#050914', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* NAV */}
      <nav style={s.nav}>
        <div style={s.navLeft}>
          <span style={{ fontSize: 20, color: '#00d4ff' }}>🧠</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>ERP ICFES Neuro-IA</span>
          <span style={s.navTag}>v4.0 · Sistema activo</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['home', 'exam', 'teacher'] as View[]).map(v => (
            <button key={v} onClick={() => v === 'exam' ? startExam() : setView(v)} style={{
              padding: '5px 14px', borderRadius: 20,
              border: `0.5px solid ${view === v ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
              background: view === v ? 'rgba(0,212,255,0.1)' : 'transparent',
              color: view === v ? '#00d4ff' : '#64748b',
              fontSize: 11, cursor: 'pointer',
            }}>
              {v === 'home' ? '🏠 Inicio' : v === 'exam' ? '📝 Simulacro' : '👨‍🏫 Docente'}
            </button>
          ))}
        </div>
      </nav>

      {/* ── VISTA HOME ───────────────────────────────────────────────────── */}
      {view === 'home' && (
        <div style={{ maxWidth: 860, margin: '50px auto', padding: '0 20px' }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🧠</div>
            <h1 style={{ fontSize: 32, fontWeight: 500, color: '#e2e8f0', marginBottom: 10 }}>
              ERP ICFES Neuro-IA
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 28px' }}>
              Simulacro oficial Saber 11 con tutoría socrática bimodal,
              pizarra acrílica digital y auditoría neurocientífica de aprendizaje.
            </p>

            {/* Botón iniciar */}
            <button
              onClick={startExam}
              disabled={loading}
              style={{
                padding: '12px 32px',
                background: loading ? 'rgba(0,212,255,0.05)' : 'rgba(0,212,255,0.1)',
                border: '0.5px solid rgba(0,212,255,0.4)',
                borderRadius: 10, color: '#00d4ff',
                fontSize: 14, fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {loading ? '⏳ Preparando 245 preguntas...' : '🚀 Iniciar Simulacro Oficial (245 preguntas)'}
            </button>

            {error && (
              <div style={{
                marginTop: 12, padding: '10px 16px',
                background: 'rgba(239,68,68,0.1)',
                border: '0.5px solid rgba(239,68,68,0.3)',
                borderRadius: 8, color: '#f87171', fontSize: 12,
              }}>
                ⚠ {error}
              </div>
            )}
          </div>

          {/* Distribución oficial */}
          <div style={{
            background: 'rgba(15,22,41,0.8)',
            border: '0.5px solid rgba(0,212,255,0.1)',
            borderRadius: 12, padding: 20, marginBottom: 20,
          }}>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 14, fontWeight: 500 }}>
              DISTRIBUCIÓN OFICIAL SABER 11 — 245 PREGUNTAS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {distribucion.map(d => (
                <div key={d.area} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ fontSize: 11, color: '#64748b', width: 180, flexShrink: 0 }}>{d.area}</div>
                  <div style={{
                    flex: 1, height: 6, background: 'rgba(255,255,255,0.04)',
                    borderRadius: 3, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(d.preguntas / 245) * 100}%`,
                      height: '100%', background: d.color,
                      borderRadius: 3, opacity: 0.7,
                    }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: d.color, width: 32, textAlign: 'right' }}>
                    {d.preguntas}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats del sistema */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10,
            background: 'rgba(15,22,41,0.8)',
            border: '0.5px solid rgba(0,212,255,0.1)',
            borderRadius: 12, padding: 16,
          }}>
            {[
              { label: 'Banco de preguntas', val: '20,000+',       color: '#00d4ff' },
              { label: 'Motor socrático',    val: 'Claude Sonnet', color: '#a78bfa' },
              { label: 'Voz pedagógica',     val: 'Google TTS',    color: '#34d399' },
              { label: 'Ayudas IA por examen', val: '5 máx.',      color: '#fbbf24' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#334155', marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VISTA EXAM ────────────────────────────────────────────────────── */}
      {view === 'exam' && examState && (
        <ExamEngine
          attemptId={examState.attemptId}
          studentId="demo-student-001"
          studentGender="female"
          questions={examState.questions}
          durationSecs={examState.durationSecs}
        />
      )}

      {/* Si se navega a exam sin haberlo iniciado */}
      {view === 'exam' && !examState && !loading && (
        <div style={{ textAlign: 'center', marginTop: 80, color: '#475569' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
          <p style={{ fontSize: 14 }}>Haz clic en "Simulacro" para iniciar.</p>
        </div>
      )}

      {/* ── VISTA TEACHER ─────────────────────────────────────────────────── */}
      {view === 'teacher' && <TeacherDashboard />}

    </div>
  )
}

const s = {
  nav: {
    background: 'rgba(8,12,28,0.95)',
    borderBottom: '0.5px solid rgba(0,212,255,0.15)',
    padding: '10px 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  } as React.CSSProperties,
  navLeft: { display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties,
  navTag: {
    fontSize: 10, color: '#00d4ff',
    background: 'rgba(0,212,255,0.1)',
    padding: '2px 8px', borderRadius: 20,
    border: '0.5px solid rgba(0,212,255,0.3)',
  } as React.CSSProperties,
}
