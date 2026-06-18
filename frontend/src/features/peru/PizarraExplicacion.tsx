// =============================================================================
//  PizarraExplicacion.tsx — Resolución paso a paso con MathJax + LaTeX
// =============================================================================
import React, { useEffect, useRef } from 'react'

declare const MathJax: {
  typesetPromise: (nodes?: HTMLElement[]) => Promise<void>
  startup: { promise: Promise<void> }
}

interface Props {
  explicacion_ia: string
  explicacion:    string
  respuesta:      string
  opcion_resp:    string
  color:          string
}

// Escapa HTML pero deja intactos $...$ y $$...$$ para que MathJax los procese
function mathHtml(text: string): string {
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+?\$)/g)
  return parts.map(p =>
    /^\$/.test(p)
      ? p
      : p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  ).join('')
}

// ¿La línea es exclusivamente un bloque $$...$$?
function isPureLatex(s: string) { return /^\s*\$\$[\s\S]*?\$\$\s*$/.test(s) }

// Definido a nivel módulo para que React no desmonte/remonte en cada render
function MathSpan({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: mathHtml(text) }} />
}

export default function PizarraExplicacion({ explicacion_ia, explicacion, respuesta, opcion_resp, color }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  const raw = (explicacion_ia || explicacion || '').replace(/\r/g, '').trim()

  useEffect(() => {
    if (!containerRef.current || !raw) return
    const node = containerRef.current

    // Llama typesetPromise solo cuando MathJax esté completamente inicializado
    const typeset = () => {
      if (typeof MathJax !== 'undefined' && typeof (MathJax as any).typesetPromise === 'function') {
        ;(MathJax as any).typesetPromise([node]).catch(() => {})
        return true
      }
      return false
    }

    // Caso 1: MathJax ya está listo
    if (typeset()) return

    // Caso 2: startup.promise existe (script defer en progreso)
    if (typeof MathJax !== 'undefined') {
      const p = (MathJax as any).startup?.promise as Promise<void> | undefined
      if (p && typeof p.then === 'function') { p.then(typeset).catch(() => {}); return }
    }

    // Caso 3: script defer aún no cargó — polling cada 200ms hasta 8 seg
    let attempts = 0
    const id = setInterval(() => {
      if (typeset() || ++attempts >= 40) clearInterval(id)
    }, 200)
    return () => clearInterval(id)
  }, [raw])

  if (!raw || raw.length < 5) return null

  const lineas = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lineas.length === 0) return null

  type TipoBloque = 'logica' | 'paso' | 'trampa' | 'respuesta' | 'practica' | 'latexblock' | 'formula' | 'texto'
  interface Bloque { tipo: TipoBloque; num?: number; titulo?: string; cuerpo: string }
  const bloques: Bloque[] = []

  // FIX: solo detectar como fórmula inline si la línea EMPIEZA con expresión matemática
  // (evita false-positive en líneas explicativas como "Donde P_n es...")
  const esFormula = (l: string) =>
    l.length < 100 &&
    !(/^[A-ZÁÉÍÓÚa-záéíóúüñ]{2,}\s/u.test(l)) && // no empieza con palabra española
    (/^\s*[A-Za-zΑ-Ω]\s*=/.test(l) ||              // X = algo
     /^\d[\d\s]*[=+\-×÷]/.test(l) ||               // número luego operador
     /^[=×÷√∑∫±]/.test(l))                          // empieza con símbolo

  // FIX: (.+) → (.*) — permite encabezado PASO solo en su línea, contenido en siguiente
  const esPaso = (l: string): { num: number; titulo: string; cuerpo: string } | null => {
    const m = l.match(/^PASO\s+(\d+)\s*[—–\-]+\s*([^:\n]+)?[:\s]*(.*)/i)
    if (m) return {
      num:    parseInt(m[1]),
      titulo: (m[2] || '').trim(),
      cuerpo: (m[3] || '').trim().replace(/^:\s*/, ''),  // quitar ":" residual
    }
    const m2 = l.match(/^(?:Paso|paso)\s*(\d+)[:\.\s]+(.+)/i)
    if (m2) return { num: parseInt(m2[1]), titulo: '', cuerpo: m2[2].trim() }
    return null
  }

  const esSeccion = (l: string, palabras: string[]): string | null => {
    for (const p of palabras) {
      if (l.toUpperCase().startsWith(p + ':') || l.toUpperCase().startsWith(p + ' —') || l.toUpperCase().startsWith(p + ' -')) {
        return l.replace(new RegExp('^' + p + '\\s*[:\\u2014\\u2013\\-]+\\s*', 'i'), '').trim()
      }
    }
    return null
  }

  for (const linea of lineas) {
    if (isPureLatex(linea)) {
      bloques.push({ tipo: 'latexblock', cuerpo: linea.trim() })
      continue
    }

    const logicaTexto    = esSeccion(linea, ['LÓGICA', 'LOGICA'])
    const trampaTexto    = esSeccion(linea, ['TRAMPA', 'ERROR COMÚN', 'ERROR COMUN'])
    const respuestaTexto = esSeccion(linea, ['RESPUESTA', 'RPTA', 'RESULTADO', '∴'])
    const practicaTexto  = esSeccion(linea, ['PRÁCTICA', 'PRACTICA'])
    const paso           = esPaso(linea)

    if      (logicaTexto    !== null) bloques.push({ tipo: 'logica',    cuerpo: logicaTexto })
    else if (trampaTexto    !== null) bloques.push({ tipo: 'trampa',    cuerpo: trampaTexto })
    else if (respuestaTexto !== null) bloques.push({ tipo: 'respuesta', cuerpo: respuestaTexto })
    else if (practicaTexto  !== null) bloques.push({ tipo: 'practica',  cuerpo: practicaTexto })
    else if (paso)                    bloques.push({ tipo: 'paso', num: paso.num, titulo: paso.titulo, cuerpo: paso.cuerpo })
    else if (esFormula(linea))        bloques.push({ tipo: 'formula',   cuerpo: linea })
    else if (bloques.length > 0) {
      const last = bloques[bloques.length - 1]
      // Acumular en el bloque anterior si no es formula/respuesta/latexblock
      if (!['formula', 'respuesta', 'latexblock'].includes(last.tipo)) {
        last.cuerpo += (last.cuerpo ? ' ' : '') + linea
      } else {
        bloques.push({ tipo: 'texto', cuerpo: linea })
      }
    } else {
      bloques.push({ tipo: 'texto', cuerpo: linea })
    }
  }

  const tieneRespuesta = bloques.some(b => b.tipo === 'respuesta')

  return (
    <div style={{ marginTop: 12, background: 'linear-gradient(135deg,#0a0f1e,#0d1428)', border: `1px solid ${color}35`, borderLeft: `3px solid ${color}`, borderRadius: 10, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '8px 14px', background: color + '12', borderBottom: `1px solid ${color}20`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13 }}>🖊️</span>
        <span style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.1em' }}>RESOLUCIÓN COMPLETA — PASO A PASO</span>
      </div>

      {/* Contenido */}
      <div ref={containerRef} style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {bloques.map((b, i) => {

          /* ── LÓGICA ──────────────────────────────────────────── */
          if (b.tipo === 'logica') return (
            <div key={i} style={{ padding: '8px 14px', background: color + '0e', border: `1px solid ${color}30`, borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>🧠</span>
              <p style={{ margin: 0, fontSize: 12, color: '#c9d1d9', lineHeight: 1.75, fontStyle: 'italic' }}>
                <MathSpan text={b.cuerpo} />
              </p>
            </div>
          )

          /* ── BLOQUE LaTeX puro (display math) ────────────────── */
          if (b.tipo === 'latexblock') return (
            <div key={i} style={{
              padding: '12px 20px',
              background: `linear-gradient(135deg, ${color}18, ${color}08)`,
              border: `1.5px solid ${color}55`,
              borderRadius: 10,
              textAlign: 'center' as const,
              fontSize: 17,
              color,
              fontWeight: 700,
              boxShadow: `0 0 12px ${color}20`,
            }}>
              <MathSpan text={b.cuerpo} />
            </div>
          )

          /* ── FÓRMULA inline (texto con símbolos matemáticos) ─── */
          if (b.tipo === 'formula') return (
            <div key={i} style={{
              padding: '8px 16px',
              background: color + '1a',
              border: `1px solid ${color}50`,
              borderRadius: 7,
              fontFamily: 'Courier New, monospace',
              fontSize: 14, fontWeight: 700,
              color, textAlign: 'center' as const,
            }}>
              <MathSpan text={b.cuerpo} />
            </div>
          )

          /* ── PASO numerado ───────────────────────────────────── */
          if (b.tipo === 'paso') return (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg,${color},${color}aa)`, color: '#0d1117', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 8px ${color}40` }}>
                {b.num}
              </div>
              <div style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}25`, borderRadius: 8, fontSize: 12, color: '#c9d1d9', lineHeight: 1.8 }}>
                {b.titulo && (
                  <div style={{ fontWeight: 800, color, marginBottom: 4, fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.07em' }}>
                    {b.titulo}
                  </div>
                )}
                {b.cuerpo && <MathSpan text={b.cuerpo} />}
              </div>
            </div>
          )

          /* ── TRAMPA ──────────────────────────────────────────── */
          if (b.tipo === 'trampa') return (
            <div key={i} style={{ padding: '10px 14px', background: 'rgba(248,81,73,0.08)', border: '1.5px solid rgba(248,81,73,0.40)', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#f85149', marginBottom: 3, letterSpacing: '.08em' }}>ERROR FRECUENTE</div>
                <p style={{ margin: 0, fontSize: 12, color: '#fca5a5', lineHeight: 1.7 }}><MathSpan text={b.cuerpo} /></p>
              </div>
            </div>
          )

          /* ── PRÁCTICA ────────────────────────────────────────── */
          if (b.tipo === 'practica') return (
            <div key={i} style={{ padding: '10px 14px', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.28)', borderRadius: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>✏️</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#38bdf8', marginBottom: 3, letterSpacing: '.08em' }}>PRACTICA ESTE TIPO</div>
                <p style={{ margin: 0, fontSize: 12, color: '#93c5fd', lineHeight: 1.7 }}><MathSpan text={b.cuerpo} /></p>
              </div>
            </div>
          )

          /* ── RESPUESTA ───────────────────────────────────────── */
          if (b.tipo === 'respuesta') return (
            <div key={i} style={{ padding: '12px 16px', background: 'rgba(63,185,80,0.10)', border: '2px solid rgba(63,185,80,0.50)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 12, boxShadow: '0 0 16px rgba(63,185,80,0.12)' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>✅</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#3fb950', marginBottom: 5, letterSpacing: '.06em' }}>RESPUESTA CORRECTA — Opción {respuesta}</div>
                <p style={{ margin: 0, fontSize: 13, color: '#4ade80', fontWeight: 600, lineHeight: 1.65 }}>
                  <MathSpan text={b.cuerpo || opcion_resp} />
                </p>
                {opcion_resp && b.cuerpo !== opcion_resp && (
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#86efac' }}>{opcion_resp}</p>
                )}
              </div>
            </div>
          )

          /* ── TEXTO genérico ──────────────────────────────────── */
          return (
            <p key={i} style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.75 }}>
              <MathSpan text={b.cuerpo} />
            </p>
          )
        })}

        {!tieneRespuesta && (
          <div style={{ padding: '10px 14px', background: 'rgba(63,185,80,0.10)', border: '2px solid rgba(63,185,80,0.45)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>✅</span>
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#3fb950', marginBottom: 2 }}>RESPUESTA CORRECTA — Opción {respuesta}</div>
              {opcion_resp && <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>{opcion_resp}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
