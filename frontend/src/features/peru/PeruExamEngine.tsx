// =============================================================================
//  PeruExamEngine.tsx — Motor de examen TES-LA PRO (Perú)
//  Reutiliza la lógica de ExamEngine adaptada a secciones peruanas
// =============================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react'

const BACKEND = 'https://ifces-production.up.railway.app'

interface Option  { label: string; text: string }
interface Question { id: string; stem: string; area: string; seccion: string; points: number; options: Option[] }
interface Props {
  attemptId: string; studentId: string
  questions: Question[]; durationSecs: number
  seccion: string; onExit: () => void
}

export default function PeruExamEngine({ attemptId, studentId, questions, durationSecs, seccion, onExit }: Props) {
  const [idx,       setIdx]      = useState(0)
  const [answers,   setAnswers]  = useState<Record<string, string>>({})
  const [timeLeft,  setTimeLeft] = useState(durationSecs)
  const [finished,  setFinished] = useState(false)
  const [score,     setScore]    = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(intervalRef.current); submitExam(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const submitExam = useCallback(async () => {
    clearInterval(intervalRef.current)
    setFinished(true)
    const correct = questions.filter(q => answers[q.id] === q.options[0]?.label).length
    setScore(Math.round((correct / questions.length) * 100))
  }, [answers, questions])

  const answer = (qId: string, opt: string) => {
    if (finished) return
    setAnswers(prev => ({ ...prev, [qId]: opt }))
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  const q = questions[idx]
  const answered = Object.keys(answers).length
  const pct = questions.length ? Math.round((answered / questions.length) * 100) : 0

  if (finished) {
    return (
      <div style={{ background: '#040813', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter,system-ui,sans-serif', color: '#e2e8f0' }}>
        <div style={{ textAlign: 'center', maxWidth: 440, padding: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{score && score >= 70 ? '🏆' : score && score >= 50 ? '📊' : '📝'}</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9', marginBottom: 8 }}>Examen finalizado</h2>
          <div style={{ fontSize: 48, fontWeight: 900, color: score && score >= 70 ? '#4ade80' : '#fbbf24', marginBottom: 16 }}>{score}%</div>
          <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}>
            Respondiste {answered} de {questions.length} preguntas · Sección {seccion}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={onExit} style={{ padding: '11px 24px', background: '#dc2626', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!q) return <div style={{ color: '#fff', textAlign: 'center', padding: 80 }}>Sin preguntas disponibles para esta sección.</div>

  const SECTION_COLORS: Record<string, string> = { A: '#2563eb', B: '#16a34a', C: '#ca8a04', D: '#dc2626' }
  const sColor = SECTION_COLORS[q.seccion] || '#dc2626'
  const urgent = timeLeft < 300

  return (
    <div style={{ background: '#040813', minHeight: '100vh', fontFamily: 'Inter,system-ui,sans-serif', color: '#e2e8f0' }}>

      {/* Header */}
      <header style={{ background: 'rgba(4,8,19,0.97)', borderBottom: '1px solid rgba(220,38,38,0.15)', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>🇵🇪</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fca5a5' }}>TES-LA PRO · Sección {seccion}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>{answered}/{questions.length} respondidas</span>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${urgent ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, padding: '4px 12px', fontWeight: 700, fontSize: 14, color: urgent ? '#f87171' : '#e2e8f0', fontVariantNumeric: 'tabular-nums' }}>
            ⏱ {fmt(timeLeft)}
          </div>
          <button onClick={() => { if (window.confirm('¿Salir del examen?')) { clearInterval(intervalRef.current); onExit() } }} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 20, color: '#f87171', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            Salir
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.04)' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: sColor, transition: 'width 0.4s' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0, minHeight: 'calc(100vh - 55px)' }}>

        {/* Navegación lateral */}
        <aside style={{ background: 'rgba(8,12,24,0.95)', borderRight: '1px solid rgba(255,255,255,0.05)', padding: '16px 12px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: '#334155', letterSpacing: 1, marginBottom: 10 }}>PREGUNTAS — SECCIÓN {seccion}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4 }}>
            {questions.map((question, i) => {
              const done = !!answers[question.id]
              const current = i === idx
              return (
                <button
                  key={question.id}
                  onClick={() => setIdx(i)}
                  style={{
                    height: 28, borderRadius: 6, border: `1px solid ${current ? sColor : done ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    background: current ? `rgba(${seccionToRgb(q.seccion)},0.2)` : done ? 'rgba(34,197,94,0.08)' : 'transparent',
                    color: current ? '#f1f5f9' : done ? '#4ade80' : '#334155',
                    fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 16, fontSize: 9, color: '#1e293b', lineHeight: 1.8 }}>
            <div>■ <span style={{ color: '#4ade80' }}>Respondida</span></div>
            <div>■ <span style={{ color: sColor }}>Actual</span></div>
          </div>

          {/* Materia actual */}
          <div style={{ marginTop: 20, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 9, color: '#334155', marginBottom: 4 }}>MATERIA</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>{q.area}</div>
            <div style={{ fontSize: 9, color: sColor, marginTop: 2 }}>Sección {q.seccion}</div>
          </div>
        </aside>

        {/* Pregunta */}
        <main style={{ padding: '28px 32px', maxWidth: 720 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: '#475569' }}>Pregunta {idx + 1} de {questions.length}</span>
            <span style={{ fontSize: 10, color: sColor, background: `rgba(${seccionToRgb(q.seccion)},0.12)`, border: `1px solid rgba(${seccionToRgb(q.seccion)},0.3)`, borderRadius: 20, padding: '2px 8px' }}>
              {q.area}
            </span>
          </div>

          <div style={{ fontSize: 15, lineHeight: 1.75, color: '#e2e8f0', marginBottom: 28, fontWeight: 400 }}>
            {q.stem}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.options.map(opt => {
              const selected = answers[q.id] === opt.label
              return (
                <button
                  key={opt.label}
                  onClick={() => answer(q.id, opt.label)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', textAlign: 'left',
                    background: selected ? `rgba(${seccionToRgb(q.seccion)},0.12)` : 'rgba(12,18,38,0.8)',
                    border: `1px solid ${selected ? sColor : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}
                >
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: selected ? sColor : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: selected ? '#fff' : '#475569', flexShrink: 0 }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 13, color: selected ? '#f1f5f9' : '#94a3b8', lineHeight: 1.55 }}>{opt.text}</span>
                </button>
              )
            })}
          </div>

          {/* Navegación */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
              style={{ padding: '8px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#475569', cursor: idx === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              ← Anterior
            </button>
            {idx < questions.length - 1 ? (
              <button onClick={() => setIdx(i => i + 1)}
                style={{ padding: '8px 20px', background: sColor, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                Siguiente →
              </button>
            ) : (
              <button onClick={submitExam}
                style={{ padding: '8px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✓ Finalizar examen
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

function seccionToRgb(sec: string): string {
  const m: Record<string, string> = { A: '37,99,235', B: '22,163,74', C: '202,138,4', D: '220,38,38' }
  return m[sec] || '220,38,38'
}
