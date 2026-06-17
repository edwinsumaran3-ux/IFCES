// =============================================================================
//  PeruLoginPage.tsx — Login TES-LA PRO (Perú)
// =============================================================================
import React, { useState, useEffect } from 'react'
import { useScreenGuide } from '../audio/AudioGuide'

const BACKEND = 'https://ifces-production.up.railway.app'

interface PeruUser {
  id: string; email: string; full_name: string; role: string; plan_code?: string; country: 'PE'
}
interface Props {
  onLogin: (user: PeruUser, token: string) => void
  onBack: () => void
}

export default function PeruLoginPage({ onLogin, onBack }: Props) {
  useScreenGuide('login_pe', 1500)

  // Handle Google OAuth redirect back
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search)
    const token   = params.get('token')
    const userRaw = params.get('user')
    if (token && userRaw) {
      try {
        const u = JSON.parse(decodeURIComponent(userRaw))
        const peruUser = { ...u, country: 'PE' as const }
        localStorage.setItem('access_token_peru', token)
        localStorage.setItem('user_peru', JSON.stringify(peruUser))
        window.history.replaceState({}, '', window.location.pathname)
        onLogin(peruUser, token)
      } catch {}
    }
  }, [])

  const [tab,      setTab]      = useState<'login' | 'register'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPass, setShowPass] = useState(false)

  const submit = async () => {
    setError('')
    if (!email || !password) { setError('Completa todos los campos'); return }
    if (tab === 'register' && !name) { setError('Ingresa tu nombre completo'); return }
    setLoading(true)
    try {
      const url  = tab === 'login'
        ? `${BACKEND}/api/v1/peru/auth/login`
        : `${BACKEND}/api/v1/peru/auth/register`
      const body = tab === 'login'
        ? { email, password }
        : { email, password, full_name: name }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Error al iniciar sesión'); return }

      localStorage.setItem('access_token_peru', data.access_token)
      localStorage.setItem('user_peru', JSON.stringify({ ...data.user, country: 'PE' }))
      onLogin({ ...data.user, country: 'PE' }, data.access_token)
    } catch { setError('Sin conexión con el servidor') }
    finally { setLoading(false) }
  }

  const inp = (val: string, set: (v: string) => void, type = 'text', placeholder = '') => (
    <input
      type={type} value={val} placeholder={placeholder}
      onChange={e => set(e.target.value)}
      onKeyDown={e => e.key === 'Enter' && submit()}
      style={s.input}
    />
  )

  return (
    <div style={s.root}>
      <style>{`* { box-sizing:border-box; } input { outline:none; } input::placeholder { color:#374151; }`}</style>

      {/* Glow fondo Perú */}
      <div style={{ position:'absolute',top:'-10%',left:'50%',transform:'translateX(-50%)',
        width:700,height:400,background:'radial-gradient(ellipse,rgba(220,38,38,0.12),transparent 70%)',pointerEvents:'none' }} />

      {/* Botón volver */}
      <button onClick={onBack} style={s.backBtn}>← Cambiar país</button>

      <div style={s.card}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.flagBig}>🇵🇪</div>
          <div style={s.brandName}>TES-LA PRO</div>
          <div style={s.brandSub}>Academia Virtual · IA y Neurociencia</div>
          <div style={s.brandTag}>Examen de Admisión · Perú</div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}>
              {t === 'login' ? '🔑 Iniciar sesión' : '✨ Registrarse'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
          {tab === 'register' && inp(name, setName, 'text', 'Nombre completo')}
          {inp(email, setEmail, 'email', 'Correo electrónico')}
          <div style={{ position:'relative' }}>
            <input
              type={showPass ? 'text' : 'password'} value={password}
              placeholder="Contraseña"
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              style={{ ...s.input, paddingRight: 40 }}
            />
            <button onClick={() => setShowPass(!showPass)}
              style={{ position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                background:'none',border:'none',color:'#374151',cursor:'pointer',fontSize:14 }}>
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {error && <div style={s.errorBox}>⚠ {error}</div>}

        <button onClick={submit} disabled={loading} style={s.submitBtn}>
          {loading ? '⏳ Verificando...' : tab === 'login' ? '🚀 Entrar a TES-LA PRO' : '✨ Crear cuenta'}
        </button>

        {/* Google */}
        <div style={{ display:'flex',alignItems:'center',gap:8,margin:'10px 0',color:'#334155',fontSize:10 }}>
          <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.06)' }} />
          o continúa con
          <div style={{ flex:1,height:1,background:'rgba(255,255,255,0.06)' }} />
        </div>
        <button
          onClick={() => { window.location.href = `${BACKEND}/api/v1/auth/google` }}
          style={{ width:'100%',padding:'10px 0',background:'rgba(234,67,53,0.07)',border:'1px solid rgba(234,67,53,0.25)',borderRadius:10,color:'#fca5a5',fontSize:12,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontFamily:'inherit',marginBottom:8 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115z"/><path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987z"/><path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21z"/><path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067z"/></svg>
          Entrar con Google
        </button>

        {/* Métodos de pago */}
        <div style={s.payRow}>
          <span style={s.payLabel}>Pagos:</span>
          <span style={s.payChip}>💚 Yape</span>
          <span style={s.payChip}>🔵 Plin</span>
          <span style={s.payChip}>💵 Efectivo</span>
        </div>
      </div>

      <p style={{ marginTop:20,fontSize:10,color:'#1e293b',position:'relative',zIndex:1 }}>
        © 2026 TES-LA PRO · Academia Virtual con IA · Perú
      </p>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight:'100vh', background:'#040813',
    display:'flex', flexDirection:'column',
    alignItems:'center', justifyContent:'center',
    fontFamily:'Inter,system-ui,sans-serif', color:'#e2e8f0',
    position:'relative', overflow:'hidden', padding:'20px',
  },
  backBtn: {
    position:'absolute', top:16, left:16,
    background:'none', border:'1px solid rgba(255,255,255,0.08)',
    borderRadius:20, padding:'6px 14px',
    color:'#475569', fontSize:12, cursor:'pointer',
    fontFamily:'inherit',
  },
  card: {
    background:'rgba(12,18,38,0.96)', border:'1px solid rgba(220,38,38,0.25)',
    borderRadius:20, padding:'32px 28px', width:'100%', maxWidth:380,
    display:'flex', flexDirection:'column', gap:16,
    boxShadow:'0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,38,38,0.1)',
    position:'relative', zIndex:1,
  },
  header: { textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:6 },
  flagBig: { fontSize:48, lineHeight:1 },
  brandName: { fontSize:26, fontWeight:800, color:'#f1f5f9', letterSpacing:-0.5 },
  brandSub: { fontSize:11, color:'#dc2626', textTransform:'uppercase', letterSpacing:1, fontWeight:600 },
  brandTag: { fontSize:11, color:'#475569', background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.2)', borderRadius:20, padding:'3px 10px' },
  tabs: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 },
  tab: { padding:'8px 0', background:'transparent', border:'1px solid rgba(255,255,255,0.07)', borderRadius:8, color:'#475569', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 },
  tabActive: { background:'rgba(220,38,38,0.12)', border:'1px solid rgba(220,38,38,0.4)', color:'#fca5a5' },
  input: {
    width:'100%', padding:'11px 14px',
    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
    borderRadius:10, color:'#e2e8f0', fontSize:13, fontFamily:'inherit',
  },
  errorBox: {
    background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
    borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f87171',
  },
  submitBtn: {
    width:'100%', padding:'12px 0',
    background:'#dc2626', border:'none', borderRadius:10,
    color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
  },
  payRow: { display:'flex', alignItems:'center', gap:8, justifyContent:'center', flexWrap:'wrap' },
  payLabel: { fontSize:10, color:'#334155' },
  payChip: { fontSize:10, color:'#64748b', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, padding:'3px 8px' },
}
