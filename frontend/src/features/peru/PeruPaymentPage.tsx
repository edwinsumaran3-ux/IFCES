// =============================================================================
//  PeruPaymentPage.tsx — Pagos TES-LA PRO: Yape, Plin, Efectivo
// =============================================================================
import React, { useState } from 'react'

interface PeruUser { id: string; email: string; full_name: string; plan_code?: string }
interface Props { user: PeruUser; onPaid: () => void; onClose: () => void }

const PLANS = [
  { code: 'basico',   name: 'Básico',   price: 'S/ 15',  period: '/mes',   color: '#2563eb', features: ['1 sección', 'Banco básico', '3 ayudas IA/examen'] },
  { code: 'plus',     name: 'Plus',     price: 'S/ 25',  period: '/mes',   color: '#dc2626', features: ['Todas las secciones', 'Banco completo', '5 ayudas IA/examen', 'Voz pedagógica'], recommended: true },
  { code: 'premium',  name: 'Premium',  price: 'S/ 40',  period: '/mes',   color: '#7c3aed', features: ['Todo Plus', 'Simulacros ilimitados', 'Reportes detallados', 'Soporte prioritario'] },
]

const METODOS = [
  { id: 'yape',    icon: '💚', name: 'Yape',     number: '999-123-456', banco: 'BCP' },
  { id: 'plin',    icon: '🔵', name: 'Plin',     number: '999-123-456', banco: 'Interbank' },
  { id: 'efectivo',icon: '💵', name: 'Efectivo', number: 'Agente BCP · Código: 12345', banco: 'Presencial' },
]

export default function PeruPaymentPage({ user, onPaid, onClose }: Props) {
  const [plan,     setPlan]    = useState('plus')
  const [metodo,   setMetodo]  = useState('yape')
  const [voucher,  setVoucher] = useState('')
  const [step,     setStep]    = useState<'plan' | 'pay' | 'done'>('plan')
  const [loading,  setLoading] = useState(false)

  const selectedPlan = PLANS.find(p => p.code === plan)!

  const confirm = async () => {
    if (!voucher.trim()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500)) // demo delay
    setStep('done')
    setLoading(false)
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <button onClick={onClose} style={s.closeBtn}>✕</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🇵🇪</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>TES-LA PRO · Planes</h2>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Elige tu plan y accede a todo el contenido</p>
        </div>

        {/* Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 56 }}>✅</div>
            <h3 style={{ color: '#4ade80', fontSize: 18, margin: '12px 0 8px' }}>¡Pago enviado!</h3>
            <p style={{ color: '#64748b', fontSize: 13 }}>Tu voucher será verificado en las próximas horas. Te notificaremos por correo.</p>
            <button onClick={onPaid} style={{ marginTop: 20, padding: '10px 28px', background: '#dc2626', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Entendido
            </button>
          </div>
        )}

        {/* Step 1: Plan */}
        {step === 'plan' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {PLANS.map(p => (
                <div
                  key={p.code}
                  onClick={() => setPlan(p.code)}
                  style={{
                    ...s.planCard,
                    border: `1px solid ${plan === p.code ? p.color : 'rgba(255,255,255,0.07)'}`,
                    background: plan === p.code ? `rgba(${hexToRgb(p.color)},0.08)` : 'rgba(12,18,38,0.8)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: plan === p.code ? p.color : '#94a3b8' }}>{p.name}</span>
                      {p.recommended && <span style={{ marginLeft: 8, fontSize: 9, background: p.color, color: '#fff', borderRadius: 20, padding: '2px 7px', fontWeight: 700 }}>RECOMENDADO</span>}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: p.color }}>{p.price}<span style={{ fontSize: 10, fontWeight: 400, color: '#475569' }}>{p.period}</span></span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {p.features.map(f => <span key={f} style={{ fontSize: 10, color: '#64748b', background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: '2px 8px' }}>✓ {f}</span>)}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setStep('pay')} style={{ ...s.btn, background: selectedPlan.color }}>
              Continuar con {selectedPlan.name} · {selectedPlan.price}
            </button>
          </>
        )}

        {/* Step 2: Pago */}
        {step === 'pay' && (
          <>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 16, textAlign: 'center' }}>
              Plan seleccionado: <strong style={{ color: selectedPlan.color }}>{selectedPlan.name} — {selectedPlan.price}/mes</strong>
            </div>

            <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>MÉTODO DE PAGO</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              {METODOS.map(m => (
                <div
                  key={m.id}
                  onClick={() => setMetodo(m.id)}
                  style={{ ...s.metodoCard, border: `1px solid ${metodo === m.id ? '#dc2626' : 'rgba(255,255,255,0.07)'}`, background: metodo === m.id ? 'rgba(220,38,38,0.08)' : 'rgba(12,18,38,0.8)', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 22 }}>{m.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: metodo === m.id ? '#fca5a5' : '#64748b' }}>{m.name}</span>
                  <span style={{ fontSize: 9, color: '#334155' }}>{m.banco}</span>
                </div>
              ))}
            </div>

            {/* Instrucciones de pago */}
            {(() => {
              const m = METODOS.find(x => x.id === metodo)!
              return (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    {metodo === 'efectivo' ? 'INSTRUCCIONES' : `NÚMERO ${m.name.toUpperCase()}`}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', letterSpacing: 1 }}>{m.number}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    {metodo === 'yape' ? `Envía ${selectedPlan.price} y escribe tu correo en el concepto` : metodo === 'plin' ? `Transfiere ${selectedPlan.price} con tu nombre completo` : `Deposita ${selectedPlan.price} con el código indicado`}
                  </div>
                </div>
              )
            })()}

            <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>N° DE OPERACIÓN / VOUCHER</div>
            <input
              type="text" value={voucher} placeholder="Ingresa el código de operación..."
              onChange={e => setVoucher(e.target.value)}
              style={{ ...s.input, marginBottom: 14 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep('plan')} style={{ ...s.btn, background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#475569', flex: '0 0 auto', padding: '11px 16px' }}>← Volver</button>
              <button onClick={confirm} disabled={!voucher.trim() || loading} style={{ ...s.btn, background: '#dc2626', flex: 1, opacity: !voucher.trim() ? 0.5 : 1 }}>
                {loading ? '⏳ Enviando...' : '✓ Confirmar pago'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function hexToRgb(hex: string) {
  return `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 },
  modal: { background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 420, position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', fontFamily: 'Inter,system-ui,sans-serif', color: '#e2e8f0', maxHeight: '90vh', overflowY: 'auto' },
  closeBtn: { position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: '#334155', fontSize: 16, cursor: 'pointer' },
  planCard: { borderRadius: 12, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' },
  metodoCard: { borderRadius: 10, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' },
  btn: { width: '100%', padding: '11px 0', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  input: { width: '100%', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none' },
}
