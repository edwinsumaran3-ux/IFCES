// =============================================================================
//  PeruPaymentPage.tsx — Pagos TES-LA PRO: Yape, Plin, Efectivo
// =============================================================================
import React, { useState } from 'react'

const BACKEND = 'https://ifces-production.up.railway.app'

interface PeruUser { id: string; email: string; full_name: string; plan_code?: string }
interface Props { user: PeruUser; onPaid: () => void; onClose: () => void }

const PLAN = {
  code: 'pro',
  name: 'TES-LA PRO',
  price: 'S/ 15',
  period: '/mes',
  color: '#dc2626',
  features: [
    'Acceso completo al banco de preguntas',
    'Todas las secciones del examen',
    'Explicaciones paso a paso con IA',
    'Voz pedagógica inteligente',
    'Simulacros ilimitados',
    'Estadísticas de rendimiento',
  ],
}

const METODOS = [
  { id: 'yape',    icon: '💚', name: 'Yape',     number: '999-123-456', banco: 'BCP' },
  { id: 'plin',    icon: '🔵', name: 'Plin',     number: '999-123-456', banco: 'Interbank' },
  { id: 'efectivo',icon: '💵', name: 'Efectivo', number: 'Agente BCP · Código: 12345', banco: 'Presencial' },
]

export default function PeruPaymentPage({ user, onPaid, onClose }: Props) {
  const [metodo,  setMetodo]  = useState('yape')
  const [voucher, setVoucher] = useState('')
  const [step,    setStep]    = useState<'pay' | 'done'>('pay')
  const [loading, setLoading] = useState(false)

  const [error, setError] = useState('')

  const confirm = async () => {
    if (!voucher.trim()) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BACKEND}/api/v1/peru/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token_peru') || ''}`,
        },
        body: JSON.stringify({
          user_id:   user.id,
          plan_code: PLAN.code,
          amount:    15,
          voucher:   voucher.trim(),
          metodo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error al registrar el pago')
      setStep('done')
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <button onClick={onClose} style={s.closeBtn}>✕</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🇵🇪</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>TES-LA PRO</h2>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>Acceso completo a toda la plataforma</p>
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

        {/* Paso único: Pago */}
        {step === 'pay' && (
          <>
            {/* Tarjeta del plan */}
            <div style={{
              borderRadius: 14, padding: '16px 18px', marginBottom: 20,
              background: 'rgba(220,38,38,0.07)',
              border: '1.5px solid rgba(220,38,38,0.35)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#dc2626' }}>{PLAN.name}</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>Acceso completo · Sin restricciones</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#dc2626' }}>{PLAN.price}</span>
                  <span style={{ fontSize: 11, color: '#475569' }}>{PLAN.period}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {PLAN.features.map(f => (
                  <span key={f} style={{ fontSize: 10, color: '#94a3b8', background: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: '3px 9px' }}>✓ {f}</span>
                ))}
              </div>
            </div>

            {/* Método */}
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

            {/* Instrucciones */}
            {(() => {
              const m = METODOS.find(x => x.id === metodo)!
              return (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                    {metodo === 'efectivo' ? 'INSTRUCCIONES' : `NÚMERO ${m.name.toUpperCase()}`}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', letterSpacing: 1 }}>{m.number}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                    {metodo === 'yape'
                      ? `Envía ${PLAN.price} y escribe tu correo en el concepto`
                      : metodo === 'plin'
                      ? `Transfiere ${PLAN.price} con tu nombre completo`
                      : `Deposita ${PLAN.price} con el código indicado`}
                  </div>
                </div>
              )
            })()}

            {error && (
              <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 10 }}>
                ⚠ {error}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>N° DE OPERACIÓN / VOUCHER</div>
            <input
              type="text" value={voucher} placeholder="Ingresa el código de operación..."
              onChange={e => setVoucher(e.target.value)}
              style={{ ...s.input, marginBottom: 14 }}
            />

            <button onClick={confirm} disabled={!voucher.trim() || loading} style={{ ...s.btn, background: '#dc2626', opacity: !voucher.trim() ? 0.5 : 1 }}>
              {loading ? '⏳ Enviando...' : `✓ Confirmar pago · ${PLAN.price}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 },
  modal:      { background: 'rgba(8,12,28,0.98)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 400, position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', fontFamily: 'Inter,system-ui,sans-serif', color: '#e2e8f0', maxHeight: '90vh', overflowY: 'auto' },
  closeBtn:   { position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: '#334155', fontSize: 16, cursor: 'pointer' },
  metodoCard: { borderRadius: 10, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' },
  btn:        { width: '100%', padding: '12px 0', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  input:      { width: '100%', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
}
