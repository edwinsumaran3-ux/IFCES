// frontend/src/App.tsx — con autenticacion
import React, { useState, useEffect } from 'react'
import LoginPage from './features/auth/LoginPage'
import ExamEngine from './features/exam/ExamEngine'
import TeacherDashboard from './features/teacher/TeacherDashboard'
import AdminDashboard from './features/admin/AdminDashboard'
import PaymentPage from './features/payment/PaymentPage'

interface User { id: string; email: string; full_name: string; role: string }
interface Question { id: string; stem: string; area: string; points: number; options: { label: string; text: string }[] }
interface ExamState { attemptId: string; questions: Question[]; durationSecs: number }

type View = 'home' | 'exam' | 'teacher' | 'pricing'

export default function App() {
  const [user,      setUser]      = useState<User | null>(null)
  const [view,      setView]      = useState<View>('home')
  const [showPayment, setShowPayment] = useState(false)
  const [examState, setExamState] = useState<ExamState | null>(null)
  const [loading,   setLoading]   = useState(false)

  const [error,     setError]     = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('user')
    const token = localStorage.getItem('access_token')
    if (saved && token) {
      try { setUser(JSON.parse(saved)) } catch {}
    }
  }, [])

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setUser(null)
    setView('home')
    setExamState(null)
  }

  const startExam = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/v1/exams/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({ student_id: user?.id || 'demo', student_gender: 'neutral', locale: 'es-CO' }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Error') }
      const data = await res.json()
      setExamState({ attemptId: data.attempt_id, questions: data.questions, durationSecs: data.duration_secs })
      setView('exam')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (!user) return <LoginPage onLogin={(u, t) => setUser(u)} />

  const distribucion = [
    { area:'Lectura Crítica', n:60, color:'#38bdf8' },
    { area:'Ciencias Naturales', n:55, color:'#34d399' },
    { area:'Matemáticas', n:50, color:'#a78bfa' },
    { area:'Sociales y Ciudadanas', n:50, color:'#fbbf24' },
    { area:'Inglés', n:30, color:'#f472b6' },
  ]

  return (
    <div style={{ background:'#040813',minHeight:'100vh',fontFamily:'Inter,system-ui,sans-serif',color:'#e2e8f0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .nav-btn { padding:5px 14px;border-radius:20px;font-size:11px;cursor:pointer;transition:all 0.15s;font-family:inherit; }
      `}</style>

      <nav style={{ background:'rgba(4,8,19,0.97)',borderBottom:'1px solid rgba(255,255,255,0.06)',padding:'0 20px',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:28,height:28,borderRadius:8,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>🧠</div>
          <span style={{ fontSize:13,fontWeight:700,color:'#e2e8f0',letterSpacing:-0.3 }}>ERP ICFES Neuro-IA</span>
          <span style={{ fontSize:10,color:'#0ea5e9',background:'rgba(14,165,233,0.08)',padding:'2px 8px',borderRadius:20,border:'1px solid rgba(14,165,233,0.15)' }}>v4.0</span>
        </div>
        <div style={{ display:'flex',gap:6,alignItems:'center' }}>
          {(['home','exam','teacher'] as View[]).map(v => (
            <button key={v} className="nav-btn" onClick={() => v==='exam' ? startExam() : setView(v)} style={{
              border:`1px solid ${view===v?'rgba(37,99,235,0.4)':'rgba(255,255,255,0.07)'}`,
              background: view===v?'rgba(37,99,235,0.12)':'transparent',
              color: view===v?'#60a5fa':'#475569',
            }}>
              {v==='home'?'🏠 Inicio':v==='exam'?'📝 Simulacro':'👨‍🏫 Docente'}
            </button>
          ))}
          <div style={{ width:1,height:20,background:'rgba(255,255,255,0.08)',margin:'0 4px' }} />
          <div style={{ display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:20,padding:'4px 12px 4px 6px' }}>
            <div style={{ width:22,height:22,borderRadius:'50%',background:'rgba(37,99,235,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#60a5fa',fontWeight:600 }}>
              {user.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <span style={{ fontSize:11,color:'#94a3b8' }}>{user.full_name?.split(' ')[0]}</span>
          </div>
          <button className="nav-btn" onClick={()=>setShowPayment(true)} style={{ border:"1px solid rgba(37,99,235,0.2)",background:"transparent",color:"#60a5fa" }}>💳 Planes</button>
          <button className="nav-btn" onClick={logout} style={{ border:'1px solid rgba(239,68,68,0.2)',background:'transparent',color:'#f87171' }}>Salir</button>
        </div>
      </nav>

      {view==='home' && (
        <div style={{ maxWidth:860,margin:'0 auto',padding:'50px 20px' }}>
          <div style={{ textAlign:'center',marginBottom:40 }}>
            <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:'rgba(37,99,235,0.08)',border:'1px solid rgba(37,99,235,0.2)',borderRadius:20,padding:'4px 14px',fontSize:11,color:'#60a5fa',marginBottom:16 }}>
              🇨🇴 Simulacro oficial Saber 11 · Colombia
            </div>
            <h1 style={{ fontSize:34,fontWeight:700,color:'#f1f5f9',marginBottom:10,letterSpacing:-0.5 }}>
              Bienvenido, {user.full_name?.split(' ')[0]} 👋
            </h1>
            <p style={{ fontSize:14,color:'#475569',lineHeight:1.75,maxWidth:500,margin:'0 auto 28px' }}>
              Simulacro oficial Saber 11 con tutoría socrática bimodal y pizarra acrílica digital.
            </p>
            <button onClick={startExam} disabled={loading} style={{
              padding:'12px 32px',background:loading?'rgba(37,99,235,0.08)':'#2563eb',
              border:'1px solid rgba(37,99,235,0.4)',borderRadius:10,
              color:'#fff',fontSize:14,fontWeight:600,cursor:loading?'wait':'pointer',
              transition:'all 0.2s',letterSpacing:-0.2,
            }}>
              {loading?'⏳ Preparando 245 preguntas...':'🚀 Iniciar Simulacro Oficial (245 preguntas)'}
            </button>
            {error && <div style={{ marginTop:10,fontSize:12,color:'#f87171',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'8px 14px',display:'inline-block' }}>⚠ {error}</div>}
          </div>

          <div style={{ background:'rgba(12,18,38,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:20,marginBottom:14 }}>
            <div style={{ fontSize:10,fontWeight:600,color:'#475569',letterSpacing:1,marginBottom:14 }}>DISTRIBUCIÓN OFICIAL SABER 11 — 245 PREGUNTAS</div>
            {distribucion.map(d => (
              <div key={d.area} style={{ display:'flex',alignItems:'center',gap:12,marginBottom:10 }}>
                <div style={{ fontSize:11,color:'#64748b',width:170,flexShrink:0 }}>{d.area}</div>
                <div style={{ flex:1,height:6,background:'rgba(255,255,255,0.04)',borderRadius:3,overflow:'hidden' }}>
                  <div style={{ width:`${(d.n/245)*100}%`,height:'100%',background:d.color,borderRadius:3,opacity:0.8 }} />
                </div>
                <div style={{ fontSize:12,fontWeight:600,color:d.color,width:28,textAlign:'right' }}>{d.n}</div>
              </div>
            ))}
          </div>

          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,background:'rgba(12,18,38,0.8)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:14,padding:16 }}>
            {[
              { label:'Banco de preguntas', val:'20,000+', color:'#38bdf8' },
              { label:'Motor socrático',    val:'Claude Sonnet', color:'#a78bfa' },
              { label:'Voz pedagógica',     val:'Google TTS', color:'#34d399' },
              { label:'Ayudas IA/examen',   val:'5 máx.', color:'#fbbf24' },
            ].map(s => (
              <div key={s.label} style={{ textAlign:'center' }}>
                <div style={{ fontSize:9,color:'#334155',marginBottom:4,letterSpacing:0.5 }}>{s.label}</div>
                <div style={{ fontSize:13,fontWeight:600,color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view==='exam' && examState && (
        <ExamEngine
          attemptId={examState.attemptId}
          studentId={user.id}
          studentGender="neutral"
          questions={examState.questions}
          durationSecs={examState.durationSecs}
        />
      )}

      {view==='exam' && !examState && !loading && (
        <div style={{ textAlign:'center',marginTop:80,color:'#475569' }}>
          <div style={{ fontSize:36,marginBottom:12 }}>📝</div>
          <p style={{ fontSize:14 }}>Haz clic en "Simulacro" para iniciar.</p>
        </div>
      )}

      {view==='teacher' && <TeacherDashboard />}
      {showPayment && user && <PaymentPage user={user} onPaid={()=>setShowPayment(false)} onClose={()=>setShowPayment(false)} />}
      {user?.role === 'admin' && view==='home' && <AdminDashboard />}
    </div>
  )
}

