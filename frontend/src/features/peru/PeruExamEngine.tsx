// =============================================================================
//  PeruExamEngine.tsx — Motor de examen TES-LA PRO (Perú)
//  Avatar tutor + Ayuda IA + Voz acento peruano
// =============================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react'
import AIHelpModal from '../ai-help/AIHelpModal'
import AvatarTutorIA from '../avatar/AvatarTutorIA'
import { useScreenGuide } from '../audio/AudioGuide'
import QuestionInlineVisual from '../exam/QuestionInlineVisual'

const BACKEND = 'https://ifces-production.up.railway.app'

interface Option   { label: string; text: string }
interface Question { id: string; stem: string; area: string; seccion: string; points: number; options: Option[] }
interface Props {
  attemptId: string; studentId: string
  questions: Question[]; durationSecs: number
  seccion: string; onExit: () => void
}

const SECCION_COLOR: Record<string, string> = {
  A: '#2563eb', B: '#16a34a', C: '#ca8a04', D: '#dc2626',
  AB: '#7c3aed', BC: '#0d9488', ABCD: '#dc2626',
}
const SECCION_RGB: Record<string, string> = {
  A: '37,99,235', B: '22,163,74', C: '202,138,4', D: '220,38,38',
  AB: '124,58,237', BC: '13,148,136', ABCD: '220,38,38',
}

export default function PeruExamEngine({ attemptId, studentId, questions, durationSecs, seccion, onExit }: Props) {
  useScreenGuide('exam', 1400)

  const [idx,            setIdx]            = useState(0)
  const [answers,        setAnswers]        = useState<Record<string, string>>({})
  const [locked,         setLocked]         = useState<Set<string>>(new Set())
  const [scores,         setScores]         = useState<Record<string, number>>({})
  const [timeLeft,       setTimeLeft]       = useState(durationSecs)
  const [finished,       setFinished]       = useState(false)
  const [showHelp,       setShowHelp]       = useState(false)
  const [remainingHelps, setRemainingHelps] = useState(3)
  const [avatarText,     setAvatarText]     = useState('¡Bienvenido al examen de admisión! Soy tu tutor virtual peruano. Lee cada pregunta con calma y usa la Ayuda IA si necesitas orientación.')
  const [avatarState,    setAvatarState]    = useState<'idle'|'thinking'|'talking'>('talking')
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const sColor = SECCION_COLOR[seccion] || '#dc2626'
  const sRgb   = SECCION_RGB[seccion]   || '220,38,38'

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(intervalRef.current); submitExam(); return 0 }
        return t - 1
      })
    }, 1000)
    return () => { clearInterval(intervalRef.current); window.speechSynthesis?.cancel() }
  }, [])

  const submitExam = useCallback(async () => {
    clearInterval(intervalRef.current)
    setFinished(true)
    setAvatarText('¡Muy bien! Completaste el examen. Revisa tu puntaje y sigue practicando.')
    setAvatarState('talking')
    try {
      await fetch(`${BACKEND}/api/v1/peru/exams/submit/${attemptId}`, { method: 'POST' })
    } catch {}
  }, [attemptId])

  const selectAnswer = (qId: string, opt: string) => {
    if (finished || locked.has(qId)) return
    setAnswers(prev => ({ ...prev, [qId]: opt }))
  }

  const handleHelpUsed = (remaining: number) => {
    setRemainingHelps(remaining)
    setLocked(prev => new Set([...prev, q.id]))
    setAvatarState('thinking')
    setAvatarText('Analizando la pregunta con inteligencia artificial...')
  }

  const handleAnswered = (result: { isCorrect: boolean; awardedScore: number }) => {
    setScores(prev => ({ ...prev, [q.id]: result.awardedScore }))
    setShowHelp(false)
    setAvatarText(result.isCorrect
      ? '¡Excelente! Respondiste correctamente. Sigue así, estás demostrando dominio del tema.'
      : 'No te desanimes. Lo importante es entender el concepto. Avanza a la siguiente pregunta.')
    setAvatarState('talking')
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  const answered  = Object.keys(answers).length
  const progress  = questions.length ? (answered / questions.length) * 100 : 0
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
  const urgent    = timeLeft < 300
  const q         = questions[idx]

  // ── Finished screen ────────────────────────────────────────────────────────
  if (finished) {
    const correct = questions.filter(x => answers[x.id] === x.options[0]?.label).length
    const pct     = questions.length ? Math.round((correct / questions.length) * 100) : 0
    return (
      <div style={{ background:'#040813', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', color:'#e2e8f0' }}>
        <div style={{ textAlign:'center', maxWidth:500, padding:32 }}>
          <div style={{ fontSize:64, marginBottom:16 }}>{pct >= 70 ? '🏆' : pct >= 50 ? '📊' : '📝'}</div>
          <h2 style={{ fontSize:28, fontWeight:800, color:'#f1f5f9', marginBottom:8 }}>Examen TES-LA PRO Finalizado</h2>
          <div style={{ fontSize:52, fontWeight:900, color: pct >= 70 ? '#4ade80' : '#fbbf24', margin:'16px 0' }}>{pct}%</div>
          <p style={{ color:'#475569', fontSize:14, marginBottom:8 }}>Respondiste {answered} de {questions.length} preguntas · Sección {seccion}</p>
          <p style={{ color:'#64748b', fontSize:12, marginBottom:28 }}>Puntaje ponderado: {totalScore.toFixed(1)} pts</p>

          <div style={{ margin:'0 auto 28px', maxWidth:320 }}>
            <AvatarTutorIA text={avatarText} gender="male" autoPlay label="Tutor TES-LA PRO" />
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
            <button onClick={onExit} style={{ padding:'11px 28px', background:sColor, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!q) return (
    <div style={{ color:'#fff', textAlign:'center', padding:80, fontFamily:'Inter,system-ui,sans-serif' }}>
      <div style={{ fontSize:48, marginBottom:16 }}>📭</div>
      <p style={{ fontSize:16, color:'#64748b' }}>Sin preguntas disponibles para esta sección aún.</p>
      <button onClick={onExit} style={{ marginTop:20, padding:'10px 24px', background:'#dc2626', border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Volver</button>
    </div>
  )

  const isLocked = locked.has(q.id)

  return (
    <div style={{ background:'#040813', minHeight:'100vh', fontFamily:'Inter,system-ui,sans-serif', color:'#e2e8f0' }}>
      <style>{`
        @media (max-width:900px) {
          .pe-body { flex-direction: column !important; }
          .pe-avatar-col { width:100% !important; position:static !important; height:280px !important; }
        }
      `}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{ background:'rgba(4,8,19,0.97)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'0 16px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>🇵🇪</span>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#f1f5f9' }}>TES-LA PRO · Sección {seccion}</div>
            <div style={{ fontSize:10, color:'#475569' }}>Examen de Admisión Universitario</div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {/* Stats */}
          {[
            { icon:'✅', val:`${answered}/${questions.length}`, label:'Respondidas', color:'#4ade80' },
            { icon:'🤖', val:`${remainingHelps}/3`,             label:'Ayudas IA',   color:'#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{ textAlign:'center', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'4px 10px' }}>
              <div style={{ fontSize:11, fontWeight:700, color:s.color }}>{s.icon} {s.val}</div>
              <div style={{ fontSize:9, color:'#334155' }}>{s.label}</div>
            </div>
          ))}

          {/* Timer */}
          <div style={{ background:`rgba(${urgent?'239,68,68':'255,255,255'},0.04)`, border:`1px solid rgba(${urgent?'239,68,68':'255,255,255'},${urgent?'0.3':'0.08'})`, borderRadius:8, padding:'4px 12px', fontWeight:700, fontSize:15, color: urgent ? '#f87171' : '#e2e8f0', fontVariantNumeric:'tabular-nums' }}>
            ⏱ {fmt(timeLeft)}
          </div>

          <button
            onClick={() => { if (window.confirm('¿Finalizar el examen ahora?')) { clearInterval(intervalRef.current); submitExam() } }}
            style={{ padding:'5px 14px', background:'rgba(22,163,74,0.1)', border:'1px solid rgba(22,163,74,0.3)', borderRadius:20, color:'#4ade80', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}
          >
            ✓ Finalizar
          </button>
          <button
            onClick={() => { if (window.confirm('¿Salir del examen?')) { clearInterval(intervalRef.current); onExit() } }}
            style={{ padding:'5px 14px', background:'transparent', border:'1px solid rgba(239,68,68,0.2)', borderRadius:20, color:'#f87171', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}
          >
            Salir
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div style={{ height:3, background:'rgba(255,255,255,0.04)' }}>
        <div style={{ width:`${progress}%`, height:'100%', background:sColor, transition:'width 0.4s' }} />
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:0, minHeight:'calc(100vh - 55px)' }} className="pe-body">

        {/* Sidebar */}
        <aside style={{ width:200, flexShrink:0, background:'rgba(8,12,24,0.95)', borderRight:'1px solid rgba(255,255,255,0.05)', padding:'14px 10px', overflowY:'auto' }}>
          <div style={{ fontSize:9, fontWeight:600, color:'#334155', letterSpacing:1, marginBottom:10 }}>PREGUNTAS — SEC. {seccion}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:3 }}>
            {questions.map((question, i) => {
              const done    = !!answers[question.id]
              const current = i === idx
              const lkd     = locked.has(question.id)
              return (
                <button key={question.id} onClick={() => setIdx(i)} style={{
                  height:26, borderRadius:6, fontSize:9, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  border:`1px solid ${current ? sColor : done ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  background: current ? `rgba(${sRgb},0.2)` : done ? 'rgba(34,197,94,0.08)' : 'transparent',
                  color: current ? '#f1f5f9' : done ? '#4ade80' : '#334155',
                }}>
                  {lkd ? '🔒' : i + 1}
                </button>
              )
            })}
          </div>

          <div style={{ marginTop:16, padding:'10px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize:9, color:'#334155', marginBottom:4 }}>MATERIA</div>
            <div style={{ fontSize:11, fontWeight:600, color:'#94a3b8' }}>{q.area}</div>
            <div style={{ fontSize:9, color:sColor, marginTop:2 }}>Sección {q.seccion}</div>
          </div>

          <div style={{ marginTop:10, padding:'8px 10px', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ fontSize:9, color:'#334155', marginBottom:4 }}>PROGRESO</div>
            <div style={{ height:4, background:'rgba(255,255,255,0.06)', borderRadius:2 }}>
              <div style={{ width:`${progress}%`, height:'100%', background:sColor, borderRadius:2 }} />
            </div>
            <div style={{ fontSize:9, color:'#475569', marginTop:4 }}>{answered} de {questions.length}</div>
          </div>
        </aside>

        {/* Main question area */}
        <main style={{ flex:1, padding:'24px 28px', maxWidth:720, overflowY:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
            <span style={{ fontSize:11, color:'#475569' }}>Pregunta {idx+1} de {questions.length}</span>
            <span style={{ fontSize:10, color:sColor, background:`rgba(${sRgb},0.1)`, border:`1px solid rgba(${sRgb},0.25)`, borderRadius:20, padding:'2px 8px' }}>
              {q.area}
            </span>
            {isLocked && <span style={{ fontSize:10, color:'#fbbf24', background:'rgba(251,191,36,0.1)', border:'1px solid rgba(251,191,36,0.25)', borderRadius:20, padding:'2px 8px' }}>🔒 Respondida con IA</span>}
          </div>

          <div style={{ fontSize:15, lineHeight:1.8, color:'#e2e8f0', marginBottom:16, fontWeight:400 }}>
            {q.stem}
          </div>

          <QuestionInlineVisual
            question={{ id: q.id, stem: q.stem, area: q.area, options: q.options, points: q.points }}
            color={sColor}
          />

          <div style={{ display:'flex', flexDirection:'column', gap:9, marginTop:16 }}>
            {q.options.map(opt => {
              const selected = answers[q.id] === opt.label
              return (
                <button key={opt.label} onClick={() => selectAnswer(q.id, opt.label)} style={{
                  display:'flex', alignItems:'flex-start', gap:12,
                  padding:'13px 15px', textAlign:'left',
                  background: selected ? `rgba(${sRgb},0.1)` : 'rgba(12,18,38,0.8)',
                  border:`1px solid ${selected ? sColor : 'rgba(255,255,255,0.07)'}`,
                  borderRadius:10, cursor: isLocked ? 'not-allowed' : 'pointer',
                  fontFamily:'inherit', transition:'all 0.15s', opacity: isLocked ? 0.7 : 1,
                }}>
                  <span style={{ width:24, height:24, borderRadius:'50%', background: selected ? sColor : 'rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: selected ? '#fff' : '#475569', flexShrink:0 }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize:13, color: selected ? '#f1f5f9' : '#94a3b8', lineHeight:1.6 }}>{opt.text}</span>
                </button>
              )
            })}
          </div>

          {/* Ayuda IA */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:22 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setIdx(i => Math.max(0, i-1))} disabled={idx===0}
                style={{ padding:'8px 18px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, color:'#475569', cursor: idx===0 ? 'not-allowed' : 'pointer', fontFamily:'inherit', fontSize:12 }}>
                ← Anterior
              </button>
              {idx < questions.length - 1 ? (
                <button onClick={() => setIdx(i => i+1)}
                  style={{ padding:'8px 18px', background:sColor, border:'none', borderRadius:8, color:'#fff', fontWeight:600, cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>
                  Siguiente →
                </button>
              ) : (
                <button onClick={submitExam}
                  style={{ padding:'8px 18px', background:'#16a34a', border:'none', borderRadius:8, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:12 }}>
                  ✓ Finalizar examen
                </button>
              )}
            </div>

            <button
              onClick={() => { if (remainingHelps > 0 && !isLocked) { setShowHelp(true); setAvatarText('Analizando la pregunta...'); setAvatarState('thinking') } }}
              disabled={remainingHelps === 0 || isLocked}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background: remainingHelps>0&&!isLocked ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)', border:`1px solid ${remainingHelps>0&&!isLocked ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius:8, color: remainingHelps>0&&!isLocked ? '#a78bfa' : '#334155', cursor: remainingHelps>0&&!isLocked ? 'pointer' : 'not-allowed', fontFamily:'inherit', fontSize:12, fontWeight:600 }}
            >
              🤖 Ayuda IA · {remainingHelps}/3
            </button>
          </div>
        </main>

        {/* Avatar column */}
        <aside style={{ width:260, flexShrink:0, background:'rgba(4,8,19,0.95)', borderLeft:'1px solid rgba(255,255,255,0.05)', padding:14, display:'flex', flexDirection:'column', gap:12, position:'sticky', top:52, height:'calc(100vh - 52px)', overflowY:'auto' }} className="pe-avatar-col">
          <AvatarTutorIA
            text={avatarText}
            gender="male"
            autoPlay
            label="Tutor TES-LA PRO"
            externalState={avatarState}
          />
          <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', borderRadius:10, padding:10 }}>
            <div style={{ fontSize:9, color:'#334155', marginBottom:6, fontWeight:600, letterSpacing:1 }}>TUTOR IA PERUANO</div>
            <div style={{ fontSize:11, color:'#64748b', lineHeight:1.6 }}>
              Presiona <strong style={{color:'#a78bfa'}}>Ayuda IA</strong> para que tu tutor te explique el tema paso a paso sin darte la respuesta.
            </div>
          </div>
          <div style={{ background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.15)', borderRadius:10, padding:10 }}>
            <div style={{ fontSize:9, color:'#dc2626', marginBottom:4, fontWeight:600 }}>🇵🇪 TES-LA PRO</div>
            <div style={{ fontSize:10, color:'#475569' }}>Examen de Admisión · Sección {seccion}</div>
            <div style={{ fontSize:10, color:'#334155', marginTop:4 }}>{answered} respondidas · {questions.length - answered} pendientes</div>
          </div>
        </aside>
      </div>

      {/* AI Help Modal */}
      {showHelp && (
        <AIHelpModal
          attemptId={attemptId}
          questionId={q.id}
          studentId={studentId}
          studentGender="male"
          originalPoints={q.points}
          remainingHelps={remainingHelps}
          onClose={() => setShowHelp(false)}
          onHelpUsed={handleHelpUsed}
          onAnswered={handleAnswered}
        />
      )}
    </div>
  )
}
