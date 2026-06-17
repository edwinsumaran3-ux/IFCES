// =============================================================================
//  PeruExamEngine.tsx — Motor de examen TES-LA PRO (Perú)
//  Mismo formato que Colombia: Ver Fórmula + IA socrática + Avatar + Audio
// =============================================================================
import React, { useState, useEffect, useRef, useCallback } from 'react'
import AIHelpModal from '../ai-help/AIHelpModal'
import AvatarTutorIA from '../avatar/AvatarTutorIA'
import { useScreenGuide, useAudioGuide } from '../audio/AudioGuide'
import QuestionInlineVisual, { getPureFormula } from '../exam/QuestionInlineVisual'

declare const MathJax: { typesetPromise: (nodes?: HTMLElement[]) => Promise<void> }

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

// ── MathJax box ──────────────────────────────────────────────────────────────
function PureFormulaBox({ tex, color }: { tex: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = `\\[${tex}\\]`
    try { MathJax.typesetPromise([ref.current]).catch(() => {}) } catch {}
  }, [tex])
  return <div ref={ref} style={{ textAlign: 'center', fontSize: 16, color, padding: '8px 0' }} />
}

export default function PeruExamEngine({ attemptId, studentId, questions, durationSecs, seccion, onExit }: Props) {
  useScreenGuide('exam', 1400)
  const { speaking, enabled, toggleEnabled, stop } = useAudioGuide()

  const [idx,            setIdx]            = useState(0)
  const [answers,        setAnswers]        = useState<Record<string, string>>({})
  const [locked,         setLocked]         = useState<Set<string>>(new Set())
  const [scores,         setScores]         = useState<Record<string, number>>({})
  const [formulaPens,    setFormulaPens]    = useState<Record<string, number>>({})
  const [formulaShown,   setFormulaShown]   = useState<Set<string>>(new Set())
  const [showFConfirm,   setShowFConfirm]   = useState(false)
  const [timeLeft,       setTimeLeft]       = useState(durationSecs)
  const [finished,       setFinished]       = useState(false)
  const [showHelp,       setShowHelp]       = useState(false)
  const [remainingHelps, setRemainingHelps] = useState(3)
  const [avatarText,     setAvatarText]     = useState('¡Bienvenido al examen de admisión! Soy tu tutor peruano. Lee cada pregunta con calma y usa la Ayuda IA si necesitas orientación.')
  const [avatarState,    setAvatarState]    = useState<'idle'|'thinking'|'talking'>('talking')
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const sColor = SECCION_COLOR[seccion] || '#dc2626'
  const sRgb   = SECCION_RGB[seccion]   || '220,38,38'

  // Reset fórmula al cambiar pregunta
  useEffect(() => { setShowFConfirm(false) }, [idx])

  // Timer
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
    setAvatarText('¡Muy bien! Completaste el examen. Revisa tu puntaje y sigue practicando para alcanzar tu universidad.')
    setAvatarState('talking')
    try { await fetch(`${BACKEND}/api/v1/peru/exams/submit/${attemptId}`, { method: 'POST' }) } catch {}
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

  const confirmRevealFormula = () => {
    setFormulaShown(prev => new Set([...prev, q.id]))
    setFormulaPens(prev => ({ ...prev, [q.id]: 0.20 }))
    setShowFConfirm(false)
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  const answered   = Object.keys(answers).length
  const progress   = questions.length ? (answered / questions.length) * 100 : 0
  const totalScore = Math.max(0, Object.values(scores).reduce((a,b) => a+b, 0) - Object.values(formulaPens).reduce((a,b) => a+b, 0))
  const urgent     = timeLeft < 300
  const q          = questions[idx]

  // ── Fin de examen ──────────────────────────────────────────────────────────
  if (finished) {
    const correct = questions.filter(x => answers[x.id] && x.options[0] && answers[x.id] === x.options.find(o => o.label === answers[x.id])?.label).length
    const pct = questions.length ? Math.round((Object.values(scores).reduce((a,b)=>a+b,0) / questions.length) * 100) : 0
    return (
      <div style={{ background:'#040813', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Inter,system-ui,sans-serif', color:'#e2e8f0' }}>
        <div style={{ textAlign:'center', maxWidth:500, padding:32 }}>
          <div style={{ fontSize:64, marginBottom:16 }}>{pct >= 70 ? '🏆' : pct >= 50 ? '📊' : '📝'}</div>
          <h2 style={{ fontSize:28, fontWeight:800, color:'#f1f5f9', marginBottom:8 }}>Examen TES-LA PRO Finalizado</h2>
          <div style={{ fontSize:52, fontWeight:900, color: pct >= 70 ? '#4ade80' : '#fbbf24', margin:'16px 0' }}>{totalScore.toFixed(1)} pts</div>
          <p style={{ color:'#475569', fontSize:14, marginBottom:8 }}>Respondiste {answered} de {questions.length} preguntas · Sección {seccion}</p>
          <div style={{ margin:'0 auto 28px', maxWidth:320 }}>
            <AvatarTutorIA text={avatarText} gender="male" autoPlay label="Tutor TES-LA PRO" />
          </div>
          <button onClick={onExit} style={{ padding:'11px 28px', background:sColor, border:'none', borderRadius:10, color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:14 }}>
            Volver al inicio
          </button>
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

  const isLocked      = locked.has(q.id)
  const isFormShown   = formulaShown.has(q.id)
  const pureFormula   = getPureFormula(q.area, q.stem)

  return (
    <div style={{ background:'#0d1117', minHeight:'100vh', fontFamily:"'Segoe UI',system-ui,sans-serif", color:'#e2e8f0', display:'flex', flexDirection:'column' }}>
      <style>{`
        @media (max-width:980px) {
          .pe-body { flex-direction: column !important; }
          .pe-avatar-col { position: static !important; width: 100% !important; height: 380px !important; }
        }
        @keyframes urgentPulse { 0%,100%{opacity:1}50%{opacity:.6} }
      `}</style>

      {/* ── HEADER ────────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 24px', background:'#161b22', borderBottom:'1px solid #21262d', gap:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>🇵🇪</span>
          <div>
            <div style={{ fontSize:13, fontWeight:800, color:'#fca5a5', letterSpacing:-0.3 }}>TES-LA PRO</div>
            <div style={{ fontSize:10, color:'#374151' }}>Sección {seccion} · Examen Admisión UNT</div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          {[
            { icon:'✅', val:`${answered}/${questions.length}`, label:'Resp.', color:'#3fb950' },
            { icon:'🏆', val:`${totalScore.toFixed(1)} pts`, label:'Puntaje', color:'#fbbf24' },
            { icon:'🤖', val:`${remainingHelps}/3`, label:'Ayuda IA', color:'#a78bfa' },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', flexDirection:'column', alignItems:'center', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:10, padding:'6px 12px', minWidth:64 }}>
              <span style={{ fontSize:14, lineHeight:1 }}>{s.icon}</span>
              <span style={{ fontSize:12, fontWeight:700, color:s.color, marginTop:2 }}>{s.val}</span>
              <span style={{ fontSize:9, color:'#475569', marginTop:1, textTransform:'uppercase' as const, letterSpacing:'.05em' }}>{s.label}</span>
            </div>
          ))}

          {/* Timer */}
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', background: urgent ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', border:`1px solid ${urgent ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.07)'}`, borderRadius:10, padding:'6px 14px', animation: urgent ? 'urgentPulse 1s infinite' : 'none' }}>
            <span style={{ fontSize:14, lineHeight:1 }}>⏱</span>
            <span style={{ fontSize:13, fontWeight:700, color: urgent ? '#f87171' : '#94a3b8', marginTop:2, fontVariantNumeric:'tabular-nums' }}>{fmt(timeLeft)}</span>
            <span style={{ fontSize:9, color:'#475569', marginTop:1, textTransform:'uppercase' as const, letterSpacing:'.05em' }}>Tiempo</span>
          </div>

          {/* Audio toggle */}
          <button
            onClick={() => { if (speaking) stop(); else toggleEnabled() }}
            title={speaking ? 'Detener audio' : enabled ? 'Audio activo' : 'Audio desactivado'}
            style={{ width:40, height:40, borderRadius:'50%', background: speaking ? 'rgba(239,68,68,0.2)' : enabled ? `rgba(${sRgb},0.15)` : 'rgba(255,255,255,0.04)', border:`1px solid ${speaking ? 'rgba(239,68,68,0.4)' : enabled ? `rgba(${sRgb},0.4)` : 'rgba(255,255,255,0.08)'}`, cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}
          >
            {speaking ? '⏹' : enabled ? '🔊' : '🔇'}
          </button>

          <button onClick={() => { if (window.confirm('¿Finalizar el examen ahora?')) submitExam() }}
            style={{ padding:'7px 16px', background:'rgba(22,163,74,0.1)', border:'1px solid rgba(22,163,74,0.3)', borderRadius:20, color:'#4ade80', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
            ✓ Finalizar
          </button>
          <button onClick={() => { if (window.confirm('¿Salir del examen?')) { clearInterval(intervalRef.current); onExit() } }}
            style={{ padding:'7px 16px', background:'transparent', border:'1px solid rgba(239,68,68,0.2)', borderRadius:20, color:'#f87171', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
            Salir
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:3, background:'#21262d' }}>
        <div style={{ width:`${progress}%`, height:'100%', background:sColor, transition:'width 0.4s' }} />
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, maxWidth:1240, margin:'0 auto', width:'100%', padding:'24px 20px 80px', display:'flex', gap:20, alignItems:'flex-start' }} className="pe-body">

        {/* ── COLUMNA PRINCIPAL ──────────────────────────────────────────────── */}
        <div style={{ flex:'1 1 0%', minWidth:0, maxWidth:780, display:'flex', flexDirection:'column', gap:16 }}>

          {/* Tarjeta de pregunta */}
          <div style={{ background:'#161b22', border:`1px solid rgba(${sRgb},0.35)`, borderRadius:14, padding:'22px 24px', display:'flex', flexDirection:'column', gap:18 }}>

            {/* Cabecera */}
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, fontWeight:700, padding:'4px 12px', borderRadius:20, textTransform:'uppercase' as const, letterSpacing:'.06em', color:sColor, background:`rgba(${sRgb},0.1)`, border:`1px solid rgba(${sRgb},0.3)` }}>
                {q.area}
              </span>
              <span style={{ fontSize:12, color:'#8b949e', background:'#21262d', border:'1px solid #30363d', padding:'4px 12px', borderRadius:20, marginLeft:'auto', fontVariantNumeric:'tabular-nums' }}>
                Pregunta {idx+1} / {questions.length}
              </span>
              {isLocked && <span style={{ fontSize:11, color:'#f85149', background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.3)', padding:'4px 12px', borderRadius:20 }}>🔒 Bloqueada</span>}
            </div>

            {/* Enunciado */}
            <p style={{ fontSize:16, color:'#e6edf3', lineHeight:1.8, margin:0 }}>{q.stem}</p>

            {/* Visual inline (diagrama/chips) */}
            <QuestionInlineVisual
              question={{ id:q.id, stem:q.stem, area:q.area, options:q.options, points:q.points }}
              color={sColor}
            />

            {/* Opciones */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {q.options.map(opt => {
                const sel = answers[q.id] === opt.label
                return (
                  <button key={opt.label} onClick={() => selectAnswer(q.id, opt.label)} disabled={isLocked} style={{
                    display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                    borderRadius:10, border:`1px solid ${sel ? sColor : 'rgba(255,255,255,0.08)'}`,
                    background: sel ? `rgba(${sRgb},0.1)` : 'rgba(255,255,255,0.02)',
                    opacity: isLocked ? 0.45 : 1, cursor: isLocked ? 'not-allowed' : 'pointer',
                    width:'100%', textAlign:'left' as const, transition:'all .15s',
                    boxShadow: sel ? `0 0 0 1px rgba(${sRgb},0.35)` : 'none',
                  }}>
                    <span style={{ width:32, height:32, borderRadius:8, border:`1px solid ${sel ? sColor : 'rgba(255,255,255,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color: sel ? '#fff' : '#64748b', background: sel ? sColor : 'rgba(255,255,255,0.05)', flexShrink:0, transition:'all .15s' }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize:14, color: sel ? '#f1f5f9' : '#c9d1d9', lineHeight:1.6 }}>{opt.text}</span>
                  </button>
                )
              })}
            </div>

            {/* ── VER FÓRMULA ──────────────────────────────────────────────────── */}
            {pureFormula && !isFormShown && !showFConfirm && (
              <button onClick={() => setShowFConfirm(true)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 18px', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.28)', borderRadius:10, cursor:'pointer', width:'100%', fontFamily:'inherit', gap:12 }}>
                <span style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:17 }}>📐</span>
                  <span>
                    <span style={{ display:'block', fontSize:13, fontWeight:600, color:'#fbbf24' }}>¿Deseas ver la fórmula?</span>
                    <span style={{ display:'block', fontSize:10, color:'#6e7681', marginTop:2 }}>Fórmula sin datos · Solo estructura matemática</span>
                  </span>
                </span>
                <span style={{ fontSize:11, fontWeight:700, color:'#f87171', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', padding:'3px 10px', borderRadius:20, whiteSpace:'nowrap' as const }}>−0.20 pts</span>
              </button>
            )}

            {/* Confirmación */}
            {showFConfirm && (
              <div style={{ background:'rgba(210,153,34,0.07)', border:'1px solid rgba(210,153,34,0.3)', borderRadius:10, padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>
                <p style={{ fontSize:13, color:'#fcd34d', margin:0, lineHeight:1.6, fontFamily:'inherit' }}>
                  ⚠ Ver la fórmula descontará <strong style={{ color:'#f87171' }}>−0.20 puntos</strong>. ¿Confirmas?
                </p>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => setShowFConfirm(false)} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid #30363d', background:'transparent', color:'#8b949e', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>No, cancelar</button>
                  <button onClick={confirmRevealFormula} style={{ padding:'8px 20px', borderRadius:8, border:'1px solid rgba(251,191,36,0.4)', background:'rgba(251,191,36,0.12)', color:'#fbbf24', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>Sí, ver fórmula</button>
                </div>
              </div>
            )}

            {/* Fórmula revelada */}
            {isFormShown && pureFormula && (
              <div style={{ background:'rgba(251,191,36,0.05)', border:'1px solid rgba(251,191,36,0.28)', borderRadius:10, padding:'14px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:'#fbbf24', letterSpacing:'.1em', textTransform:'uppercase' as const }}>📐 {pureFormula.label}</span>
                  <span style={{ fontSize:10, fontWeight:600, color:'#f87171', background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.3)', padding:'2px 8px', borderRadius:20 }}>−0.20 pts</span>
                </div>
                {pureFormula.isLatex
                  ? <PureFormulaBox tex={pureFormula.tex} color="#fbbf24" />
                  : <p style={{ fontSize:13, color:'#fcd34d', margin:0, lineHeight:1.7, fontStyle:'italic' }}>{pureFormula.tex}</p>
                }
                {pureFormula.vars && (
                  <p style={{ fontSize:11, color:'#8b949e', margin:'8px 0 0', lineHeight:1.8, borderTop:'1px solid rgba(251,191,36,0.15)', paddingTop:8, fontFamily:'inherit' }}>{pureFormula.vars}</p>
                )}
              </div>
            )}

            {/* ── BOTÓN IA SOCRÁTICA ────────────────────────────────────────────── */}
            {!isLocked && (
              <button
                onClick={() => {
                  if (remainingHelps > 0) {
                    setShowHelp(true)
                    setAvatarText('Analizando la pregunta con IA socrática...')
                    setAvatarState('thinking')
                  }
                }}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 18px', background:'rgba(124,58,237,0.12)', border:'1px solid rgba(124,58,237,0.35)',
                  borderRadius:10, cursor: remainingHelps > 0 ? 'pointer' : 'not-allowed',
                  opacity: remainingHelps > 0 ? 1 : 0.35, width:'100%', fontFamily:'inherit', gap:12,
                }}
              >
                <span style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:18 }}>🧠</span>
                  <span>
                    <span style={{ display:'block', fontSize:14, fontWeight:600, color:'#c4b5fd' }}>Activar ayuda socrática IA</span>
                    <span style={{ display:'block', fontSize:11, color:'#6e7681', marginTop:2 }}>Pizarra · Audio acento peruano · Tutoría paso a paso</span>
                  </span>
                </span>
                <span style={{ fontSize:12, color:'#a78bfa', background:'rgba(124,58,237,0.2)', border:'1px solid rgba(124,58,237,0.4)', padding:'4px 12px', borderRadius:20, whiteSpace:'nowrap' as const, fontWeight:600 }}>
                  {remainingHelps > 0 ? `${remainingHelps} restantes` : 'Sin ayudas'}
                </span>
              </button>
            )}
          </div>

          {/* ── NAVEGACIÓN ───────────────────────────────────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
            <button onClick={() => setIdx(i => Math.max(0, i-1))} disabled={idx===0}
              style={{ padding:'10px 18px', borderRadius:8, border:'1px solid #30363d', background:'transparent', color:'#8b949e', fontSize:13, cursor: idx===0 ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
              ← Anterior
            </button>

            <div style={{ display:'flex', gap:5, flexWrap:'wrap', justifyContent:'center', flex:1, maxHeight:60, overflow:'hidden' }}>
              {questions.map((qq, i) => (
                <button key={i} onClick={() => setIdx(i)} title={`Pregunta ${i+1}`} style={{
                  width:11, height:11, borderRadius:'50%', border:'none', cursor:'pointer', padding:0, transition:'all .15s',
                  background: i===idx ? sColor : answers[qq.id] ? '#3fb950' : locked.has(qq.id) ? '#f59e0b' : 'rgba(255,255,255,0.07)',
                  transform: i===idx ? 'scale(1.35)' : 'scale(1)',
                  boxShadow: i===idx ? `0 0 6px rgba(${sRgb},0.8)` : 'none',
                }} />
              ))}
            </div>

            <button onClick={() => idx < questions.length-1 ? setIdx(i => i+1) : submitExam()}
              style={{ padding:'10px 18px', borderRadius:8, border:`1px solid rgba(${sRgb},0.5)`, background:`rgba(${sRgb},0.15)`, color:sColor, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              {idx < questions.length-1 ? 'Siguiente →' : '✓ Finalizar'}
            </button>
          </div>
        </div>

        {/* ── COLUMNA AVATAR ─────────────────────────────────────────────────── */}
        <div style={{ flex:'0 0 340px', position:'sticky' as const, top:24, height:'calc(100vh - 140px)', minHeight:460 }} className="pe-avatar-col">
          <AvatarTutorIA
            text={avatarText}
            gender="male"
            autoPlay
            label="Tutor TES-LA PRO · Perú"
            externalState={avatarState}
          />
        </div>
      </div>

      {/* ── MODAL IA ──────────────────────────────────────────────────────────── */}
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
