// =============================================================================
//  CountrySelector.tsx — Pantalla inicial: elige Colombia o Perú
// =============================================================================
import React, { useState } from 'react'

interface Props {
  onSelect: (country: 'CO' | 'PE') => void
}

export default function CountrySelector({ onSelect }: Props) {
  const [hovered, setHovered] = useState<'CO' | 'PE' | null>(null)

  return (
    <div style={s.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .country-card { transition: all 0.25s cubic-bezier(.4,0,.2,1); }
        .country-card:hover { transform: translateY(-6px) scale(1.02); }
      `}</style>

      {/* Fondo animado */}
      <div style={s.bg} />
      <div style={s.bgGlow1} />
      <div style={s.bgGlow2} />

      {/* Logo */}
      <div style={s.logoRow}>
        <div style={s.logoIcon}>🧠</div>
        <div>
          <div style={s.logoName}>Neuro-IA ERP</div>
          <div style={s.logoSub}>Academia Virtual · IA + Neurociencia</div>
        </div>
      </div>

      {/* Título */}
      <div style={s.center}>
        <h1 style={s.title}>Selecciona tu País</h1>
        <p style={s.subtitle}>Cada país tiene su propio sistema de preparación académica con IA</p>

        {/* Cards */}
        <div style={s.cardsRow}>

          {/* ── COLOMBIA ── */}
          <div
            className="country-card"
            style={{ ...s.card, ...(hovered === 'CO' ? s.cardCO : {}) }}
            onMouseEnter={() => setHovered('CO')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect('CO')}
          >
            <div style={s.flag}>🇨🇴</div>
            <div style={s.cardTitle}>Colombia</div>
            <div style={s.platform}>ERP ICFES Neuro-IA</div>
            <div style={s.cardDesc}>
              Preparación para el<br />
              <strong>Saber 11 - ICFES</strong>
            </div>
            <div style={{ ...s.cardTag, background: 'rgba(37,99,235,0.15)', borderColor: 'rgba(37,99,235,0.4)', color: '#60a5fa' }}>
              📚 245 preguntas oficiales
            </div>
            <button style={{ ...s.btn, background: '#2563eb' }}>
              Entrar →
            </button>
          </div>

          {/* Separador */}
          <div style={s.separator}>
            <div style={s.separatorLine} />
            <span style={s.separatorText}>ó</span>
            <div style={s.separatorLine} />
          </div>

          {/* ── PERÚ ── */}
          <div
            className="country-card"
            style={{ ...s.card, ...(hovered === 'PE' ? s.cardPE : {}) }}
            onMouseEnter={() => setHovered('PE')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect('PE')}
          >
            <div style={s.flag}>🇵🇪</div>
            <div style={s.cardTitle}>Perú</div>
            <div style={{ ...s.platform, color: '#fca5a5' }}>TES-LA PRO</div>
            <div style={s.cardDesc}>
              Preparación para el<br />
              <strong>Examen de Admisión</strong>
            </div>
            <div style={{ ...s.cardTag, background: 'rgba(220,38,38,0.12)', borderColor: 'rgba(220,38,38,0.35)', color: '#fca5a5' }}>
              📖 Secciones A · B · C · D
            </div>
            <button style={{ ...s.btn, background: '#dc2626' }}>
              Entrar →
            </button>
          </div>

        </div>

        <p style={s.footer}>
          Tecnología: Claude Sonnet · Neurociencia cognitiva · Voz pedagógica IA
        </p>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: '#040813',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter, system-ui, sans-serif',
    color: '#e2e8f0',
    position: 'relative',
    overflow: 'hidden',
    padding: '20px',
  },
  bg: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 80% 60% at 50% -20%, rgba(37,99,235,0.08), transparent)',
    pointerEvents: 'none',
  },
  bgGlow1: {
    position: 'absolute', top: '20%', left: '5%',
    width: 400, height: 400,
    background: 'radial-gradient(circle, rgba(37,99,235,0.06), transparent 70%)',
    pointerEvents: 'none',
  },
  bgGlow2: {
    position: 'absolute', top: '30%', right: '5%',
    width: 400, height: 400,
    background: 'radial-gradient(circle, rgba(220,38,38,0.06), transparent 70%)',
    pointerEvents: 'none',
  },
  logoRow: {
    position: 'absolute', top: 20, left: 24,
    display: 'flex', alignItems: 'center', gap: 10,
  },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
  },
  logoName: { fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: -0.3 },
  logoSub: { fontSize: 10, color: '#475569' },
  center: { textAlign: 'center', position: 'relative', zIndex: 1, maxWidth: 760, width: '100%' },
  title: { fontSize: 38, fontWeight: 800, color: '#f1f5f9', marginBottom: 10, letterSpacing: -0.8 },
  subtitle: { fontSize: 14, color: '#475569', marginBottom: 48, lineHeight: 1.6 },
  cardsRow: {
    display: 'flex', alignItems: 'stretch',
    gap: 0, justifyContent: 'center',
  },
  card: {
    background: 'rgba(12,18,38,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: '36px 32px',
    width: 280,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 12, cursor: 'pointer',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  cardCO: {
    border: '1px solid rgba(37,99,235,0.4)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(37,99,235,0.2), 0 0 40px rgba(37,99,235,0.08)',
    background: 'rgba(14,22,48,0.95)',
  },
  cardPE: {
    border: '1px solid rgba(220,38,38,0.4)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(220,38,38,0.2), 0 0 40px rgba(220,38,38,0.08)',
    background: 'rgba(30,10,10,0.95)',
  },
  flag: { fontSize: 56, lineHeight: 1 },
  cardTitle: { fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.4 },
  platform: { fontSize: 12, fontWeight: 600, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: 1 },
  cardDesc: { fontSize: 13, color: '#64748b', lineHeight: 1.6, textAlign: 'center' },
  cardTag: {
    fontSize: 11, fontWeight: 600,
    padding: '5px 12px', borderRadius: 20,
    border: '1px solid',
  },
  btn: {
    marginTop: 4, width: '100%',
    padding: '11px 0', borderRadius: 10,
    border: 'none', color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
    letterSpacing: -0.2,
  },
  separator: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: '0 24px',
  },
  separatorLine: { width: 1, flex: 1, background: 'rgba(255,255,255,0.06)' },
  separatorText: { color: '#334155', fontSize: 13, fontWeight: 600 },
  footer: { marginTop: 40, fontSize: 11, color: '#1e293b' },
}
