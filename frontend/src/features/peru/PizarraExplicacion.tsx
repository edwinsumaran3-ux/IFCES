// =============================================================================
//  PizarraExplicacion.tsx
//  Muestra la resolución IA paso a paso en estilo PIZARRA (HTML, no canvas).
//  El canvas ya lo maneja QuestionInlineVisual para los diagramas.
// =============================================================================
import React from 'react'

interface Props {
  explicacion_ia: string
  explicacion:    string
  respuesta:      string
  opcion_resp:    string
  color:          string
}

interface Bloque {
  tipo: 'datos' | 'paso' | 'resultado' | 'texto'
  num?: number
  titulo: string
  cuerpo: string
}

function parsearIA(raw: string): Bloque[] {
  if (!raw || raw.trim().length < 10) return []
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
  const bloques: Bloque[] = []

  for (const line of lines) {
    const datosM = line.match(/^DATOS?:\s*(.+)/i)
    const pasoM  = line.match(/^PASO\s*(\d+)\s*:\s*(.+)/i)
    const resM   = line.match(/^[∴∴]\s*(.+)|^(?:La respuesta|Respuesta)\s*[:\-]\s*(.+)/i)

    if (datosM) {
      bloques.push({ tipo: 'datos', titulo: 'DATOS DEL PROBLEMA', cuerpo: datosM[1] })
    } else if (pasoM) {
      bloques.push({ tipo: 'paso', num: parseInt(pasoM[1]), titulo: `PASO ${pasoM[1]}`, cuerpo: pasoM[2] })
    } else if (resM) {
      const texto = resM[1] || resM[2] || line.replace(/^[∴∴]\s*/, '')
      bloques.push({ tipo: 'resultado', titulo: 'RESULTADO', cuerpo: texto })
    } else if (bloques.length > 0) {
      bloques[bloques.length - 1].cuerpo += ' ' + line
    } else {
      bloques.push({ tipo: 'texto', titulo: '', cuerpo: line })
    }
  }
  return bloques
}

// Detecta si un trozo de texto es una fórmula/ecuación
function isFormula(text: string): boolean {
  return /[=×÷^√∫∑]/.test(text) && /[\d\w]/.test(text) && text.length < 120
}

// Divide el cuerpo de un paso en líneas normales vs fórmulas
function renderCuerpo(cuerpo: string, color: string) {
  const partes = cuerpo.split(/([^\s]*[=×÷^√∑][^\s]*\s*[=\d][^\s]*|(?:\d+\/\d+\s*[×÷\-+]\s*\d+\/\d+\s*=\s*\d+\/\d+))/g)
  return partes.map((p, i) => {
    if (!p.trim()) return null
    if (isFormula(p)) {
      return (
        <span key={i} style={{
          display: 'inline-block',
          background: color + '22',
          border: `1px solid ${color}50`,
          borderRadius: 5,
          padding: '1px 8px',
          margin: '2px 3px',
          fontFamily: 'Courier New, monospace',
          fontSize: 13,
          fontWeight: 700,
          color: color,
          letterSpacing: '.04em',
        }}>{p.trim()}</span>
      )
    }
    return <span key={i} style={{ color: '#c9d1d9', fontSize: 12 }}>{p}</span>
  })
}

export default function PizarraExplicacion({ explicacion_ia, explicacion, respuesta, opcion_resp, color }: Props) {
  const bloques = parsearIA(explicacion_ia)

  // Si no hay explicación IA todavía — mostrar texto raw
  if (bloques.length === 0) {
    const lines = explicacion
      .replace(/[■□▪▫☐☑☒]/g, '')
      .replace(/[^\x09\x0a\x0d\x20-\xffÀ-ɏ∀-⋿°²³½¼]/g, ' ')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 3 && !/^\d{1,3}$/.test(l)
        && l.split(/\s+/).some(w => /[a-záéíóúüñ]{3,}/i.test(w)))
    if (lines.length === 0) return null
    return (
      <div style={{ marginTop: 10, padding: '12px 14px', background: '#0d1117', border: `1px solid ${color}25`, borderRadius: 8 }}>
        <div style={{ fontSize: 10, color: color, fontWeight: 700, marginBottom: 8, letterSpacing: '.06em' }}>📋 RESOLUCIÓN (PDF)</div>
        {lines.slice(0, 14).map((l, i) => (
          <p key={i} style={{ fontSize: 12, color: '#8b949e', margin: '3px 0', lineHeight: 1.6, fontFamily: /[=×÷]/.test(l) ? 'Courier New, monospace' : 'inherit' }}>{l}</p>
        ))}
      </div>
    )
  }

  return (
    <div style={{
      marginTop: 12,
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0d1428 100%)',
      border: `1px solid ${color}35`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Cabecera estilo pizarra */}
      <div style={{
        padding: '8px 14px',
        background: color + '12',
        borderBottom: `1px solid ${color}20`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 15 }}>🖊️</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.1em' }}>RESOLUCIÓN — PASO A PASO</span>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {bloques.map((b, i) => {
          if (b.tipo === 'datos') return (
            <div key={i} style={{ marginBottom: 12, padding: '8px 12px', background: color + '10', border: `1px solid ${color}30`, borderRadius: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 5, letterSpacing: '.06em' }}>📌 {b.titulo}</div>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.65 }}>{b.cuerpo}</p>
            </div>
          )

          if (b.tipo === 'paso') return (
            <div key={i} style={{ marginBottom: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {/* Círculo numerado */}
              <div style={{
                minWidth: 26, height: 26, borderRadius: '50%',
                background: color, color: '#0d1117',
                fontSize: 12, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 1,
              }}>{b.num}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4, letterSpacing: '.04em' }}>{b.titulo}</div>
                <div style={{ lineHeight: 1.75 }}>
                  {renderCuerpo(b.cuerpo, color)}
                </div>
              </div>
            </div>
          )

          if (b.tipo === 'resultado') return (
            <div key={i} style={{
              marginTop: 12, padding: '10px 14px',
              background: 'rgba(63,185,80,0.10)',
              border: '2px solid rgba(63,185,80,0.45)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#3fb950', marginBottom: 3 }}>RESPUESTA CORRECTA — Opción {respuesta}</div>
                <div style={{ fontSize: 13, color: '#4ade80', fontFamily: 'Courier New, monospace', fontWeight: 600 }}>
                  {b.cuerpo}
                </div>
                {opcion_resp && (
                  <div style={{ fontSize: 11, color: '#86efac', marginTop: 2 }}>{opcion_resp}</div>
                )}
              </div>
            </div>
          )

          return (
            <p key={i} style={{ fontSize: 12, color: '#64748b', margin: '2px 0', lineHeight: 1.6 }}>{b.cuerpo}</p>
          )
        })}
      </div>
    </div>
  )
}
