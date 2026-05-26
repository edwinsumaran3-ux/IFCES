// frontend/src/features/payment/PaymentPage.tsx
import React, { useState } from 'react'

interface Props {
  user: { id: string; email: string; full_name: string; role: string; plan_code?: string }
  onPaid: () => void
  onClose: () => void
  upgradeMode?: boolean
}

const PLANS = [
  {
    code: 'basic', name: 'Básico', price_student: 8000, price_inst: 6000,
    color: '#60a5fa', helps: 1, diff: 'Normal',
    features: ['245 preguntas', '1 ayuda IA', 'Reporte básico', 'Calificación automática']
  },
  {
    code: 'plus', name: 'Plus', price_student: 12000, price_inst: 8000,
    color: '#a78bfa', helps: 3, diff: 'Normal + Difícil',
    features: ['Todo Básico', '3 ayudas IA', 'Pizarra acrílica', 'Reporte docente', 'Correo automático']
  },
  {
    code: 'premium', name: 'Premium', price_student: 15000, price_inst: 12000,
    color: '#34d399', helps: 5, diff: 'Normal + Difícil + Muy difícil',
    features: ['Todo Plus', '5 ayudas IA', 'WhatsApp automático', 'Reporte institucional', 'Ranking alumnos']
  },
]

const NEQUI_NUMBER = '300 000 0000' // Cambiar por número real

export default function PaymentPage({ user, onPaid, onClose, upgradeMode }: Props) {
  const [step,     setStep]     = useState<'select' | 'pay' | 'confirm' | 'done'>('select')
  const [selected, setSelected] = useState<typeof PLANS[0] | null>(null)
  const [ref,      setRef]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const currentPlan = user.plan_code || 'basic'
  const availablePlans = upgradeMode
    ? PLANS.filter(p => {
        const order = ['basic','plus','premium']
        return order.indexOf(p.code) > order.indexOf(currentPlan)
      })
    : PLANS

  const submitPayment = async () => {
    if (!ref.trim()) { setError('Ingresa la referencia del pago'); return }
    if (ref.trim().length < 6) { setError('La referencia debe tener al menos 6 caracteres'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('https://ifces-production.up.railway.app/api/v1/admin/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({
          user_id: user.id,
          plan_code: selected!.code,
          amount: selected!.price_student,
          nequi_ref: ref.trim()
        })
      })
      if (res.ok) {
        setStep('done')
        onPaid()
      } else {
        throw new Error('Error al registrar el pago')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.8)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:1000, padding:16, fontFamily:'Inter,system-ui,sans-serif'
    }}>
      <div style={{
        background:'#0a0f1e', border:'1px solid rgba(255,255,255,0.1)',
        borderRadius:16, width:'100%', maxWidth:560,
        maxHeight:'90vh', overflowY:'auto',
        boxShadow:'0 20px 60px rgba(0,0,0,0.5)'
      }}>

        {/* HEADER */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#e2e8f0' }}>
              {upgradeMode ? '⬆ Mejorar Plan' : '💳 Comprar Plan'}
            </div>
            <div style={{ fontSize:11, color:'#475569' }}>{user.full_name} · {user.email}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#475569', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ padding:20 }}>

          {/* PASO 1 — SELECCIONAR PLAN */}
          {step === 'select' && (
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:'#64748b', letterSpacing:1, marginBottom:14 }}>
                {upgradeMode ? 'SELECCIONA TU NUEVO PLAN' : 'SELECCIONA UN PLAN'}
              </div>
              {availablePlans.length === 0 && (
                <div style={{ textAlign:'center', padding:24, color:'#475569', fontSize:13 }}>
                  Ya tienes el plan Premium — el más completo del sistema.
                </div>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                {availablePlans.map(plan => (
                  <div
                    key={plan.code}
                    onClick={() => setSelected(plan)}
                    style={{
                      background: selected?.code === plan.code ? `${plan.color}12` : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selected?.code === plan.code ? plan.color+'60' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius:12, padding:14, cursor:'pointer',
                      transition:'all 0.15s',
                      position:'relative'
                    }}
                  >
                    {plan.code === 'plus' && (
                      <div style={{ position:'absolute', top:-8, right:12, background:'#2563eb', fontSize:9, fontWeight:700, color:'#fff', padding:'2px 10px', borderRadius:10 }}>
                        MÁS POPULAR
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${plan.color}`, background: selected?.code===plan.code ? plan.color : 'transparent', transition:'all 0.15s' }} />
                        <span style={{ fontSize:14, fontWeight:700, color: selected?.code===plan.code ? plan.color : '#e2e8f0' }}>{plan.name}</span>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:18, fontWeight:700, color:plan.color }}>${plan.price_student.toLocaleString()}</div>
                        <div style={{ fontSize:10, color:'#475569' }}>COP / simulacro</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:10, color:plan.color, background:`${plan.color}15`, padding:'2px 8px', borderRadius:20, border:`1px solid ${plan.color}30` }}>
                        {plan.helps} ayudas IA
                      </span>
                      <span style={{ fontSize:10, color:'#64748b', background:'rgba(255,255,255,0.04)', padding:'2px 8px', borderRadius:20, border:'1px solid rgba(255,255,255,0.08)' }}>
                        {plan.diff}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {selected && (
                <button
                  onClick={() => setStep('pay')}
                  style={{ width:'100%', background:'#2563eb', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:600, padding:12, cursor:'pointer' }}
                >
                  Continuar con Plan {selected.name} →
                </button>
              )}
            </div>
          )}

          {/* PASO 2 — PAGAR POR NEQUI */}
          {step === 'pay' && selected && (
            <div>
              <button onClick={()=>setStep('select')} style={{ background:'none', border:'none', color:'#60a5fa', fontSize:12, cursor:'pointer', marginBottom:14 }}>
                ← Cambiar plan
              </button>

              <div style={{ background:'rgba(37,99,235,0.06)', border:'1px solid rgba(37,99,235,0.2)', borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#60a5fa', marginBottom:10, letterSpacing:0.5 }}>RESUMEN DE PAGO</div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12, color:'#64748b' }}>Plan seleccionado</span>
                  <span style={{ fontSize:12, fontWeight:600, color:'#e2e8f0' }}>{selected.name}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ fontSize:12, color:'#64748b' }}>Ayudas IA</span>
                  <span style={{ fontSize:12, color:'#a78bfa' }}>{selected.helps} por examen</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>Total a pagar</span>
                  <span style={{ fontSize:18, fontWeight:700, color:'#34d399' }}>${selected.price_student.toLocaleString()} COP</span>
                </div>
              </div>

              {/* INSTRUCCIONES NEQUI */}
              <div style={{ background:'rgba(124,58,237,0.06)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:12, padding:16, marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'#a78bfa', marginBottom:10, letterSpacing:0.5 }}>📱 INSTRUCCIONES DE PAGO — NEQUI</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { n:'1', text:`Abre Nequi en tu celular` },
                    { n:'2', text:`Envía $${selected.price_student.toLocaleString()} COP al número:` },
                    { n:'3', text:'Copia el número de referencia del comprobante' },
                    { n:'4', text:'Pégalo abajo y haz clic en "Confirmar pago"' },
                  ].map(s => (
                    <div key={s.n} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                      <div style={{ width:20, height:20, borderRadius:'50%', background:'rgba(124,58,237,0.2)', border:'1px solid rgba(124,58,237,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#a78bfa', flexShrink:0 }}>{s.n}</div>
                      <span style={{ fontSize:12, color:'#94a3b8', lineHeight:1.5 }}>{s.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop:12, background:'rgba(124,58,237,0.1)', borderRadius:8, padding:'10px 14px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'#475569', marginBottom:4 }}>NÚMERO NEQUI</div>
                  <div style={{ fontSize:22, fontWeight:700, color:'#a78bfa', letterSpacing:2 }}>{NEQUI_NUMBER}</div>
                </div>
              </div>

              {error && <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#f87171', marginBottom:12 }}>⚠ {error}</div>}

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#64748b', marginBottom:6, fontWeight:500 }}>REFERENCIA / NÚMERO DE COMPROBANTE NEQUI</div>
                <input
                  style={{ width:'100%', padding:'10px 14px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, color:'#e2e8f0', fontSize:14, outline:'none', fontFamily:'monospace', letterSpacing:1 }}
                  placeholder="Ej: 2024051234567"
                  value={ref}
                  onChange={e => { setRef(e.target.value); setError('') }}
                />
              </div>

              <button
                onClick={submitPayment}
                disabled={loading || !ref.trim()}
                style={{ width:'100%', background: ref.trim() ? '#2563eb' : 'rgba(37,99,235,0.3)', border:'none', borderRadius:10, color:'#fff', fontSize:13, fontWeight:600, padding:12, cursor: ref.trim() ? 'pointer' : 'not-allowed', transition:'all 0.2s' }}
              >
                {loading ? '⏳ Registrando pago...' : '✓ Confirmar pago'}
              </button>
              <div style={{ fontSize:11, color:'#334155', textAlign:'center', marginTop:10 }}>
                El administrador verificará tu pago y activará el plan en máximo 24 horas.
              </div>
            </div>
          )}

          {/* PASO 3 — LISTO */}
          {step === 'done' && (
            <div style={{ textAlign:'center', padding:'24px 16px' }}>
              <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
              <div style={{ fontSize:18, fontWeight:700, color:'#34d399', marginBottom:8 }}>¡Pago registrado!</div>
              <div style={{ fontSize:13, color:'#64748b', lineHeight:1.7, marginBottom:20 }}>
                Tu solicitud fue enviada al administrador.<br/>
                Recibirás confirmación cuando tu plan sea activado.
              </div>
              <div style={{ background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:10, padding:14, marginBottom:20, textAlign:'left' }}>
                <div style={{ fontSize:11, color:'#34d399', fontWeight:600, marginBottom:8 }}>RESUMEN</div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Plan: <strong style={{ color:'#e2e8f0' }}>{selected?.name}</strong></div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Referencia Nequi: <strong style={{ color:'#a78bfa', fontFamily:'monospace' }}>{ref}</strong></div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>Valor: <strong style={{ color:'#34d399' }}>${selected?.price_student.toLocaleString()} COP</strong></div>
              </div>
              <button onClick={onClose} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:9, color:'#94a3b8', fontSize:13, padding:'10px 28px', cursor:'pointer' }}>
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
