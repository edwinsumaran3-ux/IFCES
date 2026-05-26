// frontend/src/features/auth/LoginPage.tsx
import React, { useState } from 'react'

interface Props {
  onLogin: (user: { id: string; email: string; full_name: string; role: string }, token: string) => void
}

const ROLES = [
  { value: 'admin',       label: 'Administrador', icon: '⚙️', desc: 'Control total del sistema' },
  { value: 'institution', label: 'Institución',   icon: '🏫', desc: 'Compra planes y carga alumnos' },
  { value: 'teacher',     label: 'Docente',        icon: '👨‍🏫', desc: 'Grupos, resultados y estadísticas' },
  { value: 'student',     label: 'Estudiante',     icon: '🎓', desc: 'Simulacros y retroalimentación' },
]

export default function LoginPage({ onLogin }: Props) {
  const [tab,      setTab]      = useState<'login' | 'register'>('login')
  const [role,     setRole]     = useState('student')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)

  const submit = async () => {
    setError('')
    if (!email || !password) { setError('Completa todos los campos'); return }
    setLoading(true)
    try {
      const API  = window.location.hostname === 'localhost' ? '' : 'https://ifces-production.up.railway.app'
      const url  = tab === 'login' ? `${API}/api/v1/auth/login` : `${API}/api/v1/auth/register-student`
      const body = tab === 'login'
        ? { email, password, role }
        : { email, password, full_name: name }

      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      let data: any = {}
      try { data = JSON.parse(text) } catch { /* server returned non-JSON */ }
      if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      onLogin(data.user, data.access_token)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = ROLES.find(r => r.value === role)!

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .login-shell {
          min-height: 100vh;
          background: #040813;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', system-ui, sans-serif;
          overflow: hidden;
          position: relative;
        }
        .bg-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
        }
        .login-content {
          position: relative;
          z-index: 1;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .login-topbar {
          padding: 16px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .login-body {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 440px;
          gap: 0;
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
          padding: 40px 24px;
          align-items: center;
        }
        .login-left { padding-right: 60px; }
        .login-card {
          background: rgba(12,18,38,0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 28px;
          backdrop-filter: blur(20px);
          transform: perspective(1000px) rotateY(-2deg) rotateX(1deg);
          box-shadow:
            0 0 0 1px rgba(37,99,235,0.15),
            0 20px 60px rgba(0,0,0,0.5),
            0 0 80px rgba(37,99,235,0.08);
          transition: transform 0.3s ease;
        }
        .login-card:hover {
          transform: perspective(1000px) rotateY(0deg) rotateX(0deg);
        }
        .tab-btn {
          flex: 1; padding: 8px; border-radius: 8px;
          font-size: 13px; font-weight: 500; cursor: pointer;
          border: none; transition: all 0.2s;
        }
        .field-wrap { margin-bottom: 14px; }
        .field-label { font-size: 11px; color: #64748b; margin-bottom: 5px; font-weight: 500; letter-spacing: 0.3px; }
        .field-input {
          width: 100%; padding: 10px 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 9px; color: #e2e8f0;
          font-size: 13px; outline: none;
          transition: border-color 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .field-input:focus { border-color: rgba(37,99,235,0.5); background: rgba(37,99,235,0.05); }
        .field-input::placeholder { color: #334155; }
        .role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; margin-bottom: 14px; }
        .role-btn {
          padding: 8px 10px; border-radius: 9px; cursor: pointer;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.02);
          transition: all 0.15s; text-align: left;
        }
        .role-btn.active {
          border-color: rgba(37,99,235,0.5);
          background: rgba(37,99,235,0.08);
        }
        .submit-btn {
          width: 100%; padding: 11px;
          background: #2563eb; border: none;
          border-radius: 10px; color: #fff;
          font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.2px;
        }
        .submit-btn:hover { background: #1d4ed8; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .error-box {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px; padding: 8px 12px;
          font-size: 12px; color: #f87171; margin-bottom: 12px;
        }
        @media (max-width: 768px) {
          .login-body { grid-template-columns: 1fr; padding: 20px 16px; }
          .login-left { display: none; }
          .login-card { transform: none; }
          .login-card:hover { transform: none; }
        }
      `}</style>

      <div className="login-shell">
        <div className="bg-orb" style={{ width:500,height:500,background:'rgba(37,99,235,0.12)',top:-100,left:-100 }} />
        <div className="bg-orb" style={{ width:400,height:400,background:'rgba(124,58,237,0.08)',bottom:-50,right:-50 }} />

        <div className="login-content">
          {/* TOPBAR */}
          <div className="login-topbar">
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:32,height:32,borderRadius:9,background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,boxShadow:'0 4px 12px rgba(37,99,235,0.4)' }}>🧠</div>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:'#e2e8f0',letterSpacing:-0.3 }}>ERP ICFES Neuro-IA</div>
                <div style={{ fontSize:10,color:'#475569' }}>Plataforma oficial Saber 11</div>
              </div>
            </div>
            <div style={{ display:'flex',gap:8,alignItems:'center' }}>
              <span style={{ fontSize:10,color:'#34d399',background:'rgba(52,211,153,0.08)',padding:'3px 10px',borderRadius:20,border:'1px solid rgba(52,211,153,0.2)' }}>v4.0 · Sistema activo</span>
            </div>
          </div>

          {/* BODY */}
          <div className="login-body">

            {/* IZQUIERDA */}
            <div className="login-left">
              <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:'rgba(37,99,235,0.1)',border:'1px solid rgba(37,99,235,0.2)',borderRadius:20,padding:'4px 12px',fontSize:11,color:'#60a5fa',marginBottom:20 }}>
                🇨🇴 Simulacro oficial Saber 11 · Colombia
              </div>
              <h1 style={{ fontSize:36,fontWeight:700,color:'#f1f5f9',lineHeight:1.2,letterSpacing:-0.5,marginBottom:14 }}>
                Sistema ERP<br/><span style={{ color:'#2563eb' }}>ICFES Neuro-IA</span>
              </h1>
              <p style={{ fontSize:14,color:'#475569',lineHeight:1.75,marginBottom:28,maxWidth:400 }}>
                Ecosistema adaptativo con tutoría socrática bimodal, pizarra acrílica digital y auditoría neurocientífica de aprendizaje.
              </p>
              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,maxWidth:380 }}>
                {[
                  { val:'20,000+', label:'Preguntas banco',    color:'#2563eb' },
                  { val:'245',     label:'Preguntas/simulacro', color:'#7c3aed' },
                  { val:'3',       label:'Planes disponibles', color:'#0d9488' },
                  { val:'IA',      label:'Tutoría socrática',  color:'#d97706' },
                ].map(s => (
                  <div key={s.label} style={{ background:'rgba(15,23,42,0.8)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:10,padding:14 }}>
                    <div style={{ fontSize:22,fontWeight:700,color:s.color,marginBottom:3 }}>{s.val}</div>
                    <div style={{ fontSize:11,color:'#475569' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD LOGIN */}
            <div className="login-card">

              {/* TABS */}
              <div style={{ display:'flex',gap:4,background:'rgba(255,255,255,0.03)',borderRadius:10,padding:4,marginBottom:20 }}>
                {(['login','register'] as const).map(t => (
                  <button key={t} className="tab-btn" onClick={() => { setTab(t); setError('') }} style={{
                    background: tab===t ? 'rgba(37,99,235,0.2)' : 'transparent',
                    color: tab===t ? '#60a5fa' : '#475569',
                    border: tab===t ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                  }}>
                    {t==='login' ? '🔑 Iniciar sesión' : '✨ Registrarse'}
                  </button>
                ))}
              </div>

              {error && <div className="error-box">⚠ {error}</div>}

              {tab==='register' && (
                <div className="field-wrap">
                  <div className="field-label">NOMBRE COMPLETO</div>
                  <input className="field-input" placeholder="Juan Pérez García" value={name} onChange={e=>setName(e.target.value)} />
                </div>
              )}

              <div className="field-wrap">
                <div className="field-label">CORREO ELECTRÓNICO</div>
                <input className="field-input" type="email" placeholder="usuario@colegio.edu.co" value={email} onChange={e=>setEmail(e.target.value)} />
              </div>

              <div className="field-wrap">
                <div className="field-label">CONTRASEÑA</div>
                <div style={{ position:'relative' }}>
                  <input className="field-input" type={showPass?'text':'password'} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} style={{ paddingRight:40 }} />
                  <button onClick={()=>setShowPass(p=>!p)} style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:14 }}>
                    {showPass?'🙈':'👁'}
                  </button>
                </div>
              </div>

              {tab==='login' && (
                <>
                  <div className="field-label" style={{ marginBottom:8 }}>ROL</div>
                  <div className="role-grid">
                    {ROLES.map(r => (
                      <button key={r.value} className={`role-btn ${role===r.value?'active':''}`} onClick={()=>setRole(r.value)}>
                        <div style={{ fontSize:16,marginBottom:3 }}>{r.icon}</div>
                        <div style={{ fontSize:11,fontWeight:600,color:role===r.value?'#60a5fa':'#94a3b8' }}>{r.label}</div>
                        <div style={{ fontSize:10,color:'#334155',lineHeight:1.3 }}>{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {tab==='register' && (
                <div style={{ background:'rgba(124,58,237,0.06)',border:'1px solid rgba(124,58,237,0.15)',borderRadius:9,padding:10,marginBottom:14,fontSize:11,color:'#94a3b8',lineHeight:1.6 }}>
                  🎓 El registro es para <strong style={{color:'#a78bfa'}}>estudiantes individuales</strong>. Instituciones y docentes son creados por el administrador.
                </div>
              )}

              <button className="submit-btn" onClick={submit} disabled={loading}>
                {loading ? '⏳ Verificando...' : tab==='login' ? `Ingresar como ${selectedRole.label}` : 'Crear cuenta estudiante'}
              </button>

              <div style={{ textAlign:'center',marginTop:14,fontSize:11,color:'#334155' }}>
                {tab==='login' ? (
                  <>¿No tienes cuenta? <button onClick={()=>setTab('register')} style={{ background:'none',border:'none',color:'#60a5fa',cursor:'pointer',fontSize:11 }}>Regístrate aquí</button></>
                ) : (
                  <>¿Ya tienes cuenta? <button onClick={()=>setTab('login')} style={{ background:'none',border:'none',color:'#60a5fa',cursor:'pointer',fontSize:11 }}>Inicia sesión</button></>
                )}
              </div>

              <div style={{ marginTop:16,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.05)',display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6 }}>
                {[
                  { plan:'Básico',  price:'$6.000', color:'#60a5fa' },
                  { plan:'Plus',    price:'$8.000', color:'#a78bfa' },
                  { plan:'Premium', price:'$12.000',color:'#34d399' },
                ].map(p => (
                  <div key={p.plan} style={{ textAlign:'center',padding:'6px 4px',background:'rgba(255,255,255,0.02)',borderRadius:7,border:'1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize:10,color:p.color,fontWeight:600 }}>{p.plan}</div>
                    <div style={{ fontSize:11,color:'#e2e8f0',fontWeight:700 }}>{p.price}</div>
                    <div style={{ fontSize:9,color:'#334155' }}>COP/est.</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
