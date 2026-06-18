import { useEffect, useRef, useState } from 'react'
import type { InfoGrafico } from '../utils/detectarGrafico'

interface Props {
  info: InfoGrafico
  altura?: number
}

declare global {
  interface Window {
    // function-plot no tiene tipos oficiales; lo importamos dinámicamente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    functionPlot?: (...args: any[]) => any
  }
}

// Colores por curva para distinguir múltiples funciones
const COLORES = ['#4ade80', '#60a5fa', '#f97316', '#a78bfa', '#fb7185']

export default function GraficoFuncion({ info, altura = 280 }: Props) {
  const ref        = useRef<HTMLDivElement>(null)
  const [error, setError]     = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!abierto || !ref.current || info.tipo === null) return

    // function-plot usa el DOM directamente; limpiamos antes de redibujar
    ref.current.innerHTML = ''

    async function renderizar() {
      try {
        // Import dinámico — evita incluir function-plot en el bundle principal
        const fp = await import('function-plot')
        const functionPlot = fp.default ?? fp

        const dataSeries = info.expresiones.map((fn, i) => ({
          fn,
          color: COLORES[i % COLORES.length],
          graphType: 'polyline' as const,
        }))

        functionPlot({
          target: ref.current!,
          width:  ref.current!.clientWidth || 400,
          height: altura,
          xAxis:  { domain: info.dominio, label: 'x' },
          yAxis:  { label: 'y' },
          grid:   true,
          tip:    { xLine: true, yLine: true },
          data:   dataSeries,
        })

        setError(null)
      } catch (e) {
        console.error('function-plot error:', e)
        setError('No se pudo graficar esta expresión.')
      }
    }

    renderizar()
  }, [abierto, info, altura])

  if (info.tipo === null || info.expresiones.length === 0) return null

  return (
    <div style={{
      margin: '12px 0',
      border: '1px solid #334155',
      borderRadius: 10,
      overflow: 'hidden',
      background: '#0f172a',
    }}>
      {/* Cabecera colapsable */}
      <button
        onClick={() => setAbierto(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: '#1e293b',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 16 }}>📈</span>
        <span style={{ flex: 1 }}>{info.titulo}</span>
        <span style={{ fontSize: 11, color: '#4ade80' }}>
          {abierto ? '▲ Ocultar gráfica' : '▼ Ver gráfica'}
        </span>
      </button>

      {/* Canvas del gráfico */}
      {abierto && (
        <div style={{ padding: '4px 8px 8px' }}>
          {error ? (
            <p style={{ color: '#f87171', fontSize: 13, padding: 8 }}>{error}</p>
          ) : (
            <div ref={ref} style={{ width: '100%', height: altura }} />
          )}
          {/* Leyenda de funciones */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '6px 4px 0' }}>
            {info.expresiones.map((fn, i) => (
              <span key={i} style={{
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 20,
                background: COLORES[i % COLORES.length] + '22',
                color: COLORES[i % COLORES.length],
                border: `1px solid ${COLORES[i % COLORES.length]}55`,
              }}>
                y = {fn}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
