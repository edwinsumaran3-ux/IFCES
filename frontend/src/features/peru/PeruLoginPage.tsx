// =============================================================================
//  PeruLoginPage.tsx — Login TES-LA PRO (Perú)
// =============================================================================
import React, { useState } from 'react'

const BACKEND = 'https://ifces-production.up.railway.app'

interface PeruUser {
  id: string; email: string; full_name: string; role: string; plan_code?: string; country: 'PE'
}
interface Props {
  onLogin: (user: PeruUser, token: string) => void
  onBack: () => void
}

export default function PeruLoginPage({ onLogin, onBack }: Props) {
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

        {error && (
          <div style={s.errorBox}>⚠ {error}</div>
        )}

        <button onClick={submit} disabled={loading} style={s.submitBtn}>
          {loading ? '⏳ Verificando...' : tab === 'login' ? '🚀 Entrar a TES-LA PRO' : '✨ Crear cuenta'}
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
