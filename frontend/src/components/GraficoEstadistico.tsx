import { useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import type { InfoGrafico } from '../utils/detectarGrafico'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, Title, Tooltip, Legend, ArcElement
)

interface Props {
  info: InfoGrafico
}

const PALETA = [
  '#4ade80', '#60a5fa', '#f97316', '#a78bfa', '#fb7185',
  '#34d399', '#fbbf24', '#38bdf8', '#e879f9', '#f472b6',
]

export default function GraficoEstadistico({ info }: Props) {
  const [abierto, setAbierto] = useState(false)

  if (!info.datosBar || info.datosBar.length < 2) return null

  const labels  = info.datosBar.map(d => d.label)
  const valores = info.datosBar.map(d => d.valor)
  const total   = valores.reduce((s, v) => s + v, 0)

  const chartData = {
    labels,
    datasets: [{
      label: info.tipo === 'probabilidad' ? 'Probabilidad' : 'Frecuencia',
      data: info.tipo === 'probabilidad'
        ? valores.map(v => +(v / total).toFixed(3))
        : valores,
      backgroundColor: labels.map((_, i) => PALETA[i % PALETA.length] + 'bb'),
      borderColor:     labels.map((_, i) => PALETA[i % PALETA.length]),
      borderWidth: 1.5,
      borderRadius: 4,
    }],
  }

  const opciones = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: info.titulo,
        color: '#94a3b8',
        font: { size: 12 },
      },
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid:  { color: '#1e293b' },
      },
      y: {
        ticks: { color: '#64748b', font: { size: 11 } },
        grid:  { color: '#1e293b' },
        beginAtZero: true,
      },
    },
  }

  const esLineal = info.tipo === 'fisica' || labels.every(l => /^\d+$/.test(l))

  const icono = info.tipo === 'estadistica' ? '📊' :
                info.tipo === 'probabilidad' ? '🎲' : '📉'

  return (
    <div style={{
      margin: '12px 0',
      border: '1px solid #334155',
      borderRadius: 10,
      overflow: 'hidden',
      background: '#0f172a',
    }}>
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
        <span style={{ fontSize: 16 }}>{icono}</span>
        <span style={{ flex: 1 }}>{info.titulo}</span>
        <span style={{ fontSize: 11, color: '#60a5fa' }}>
          {abierto ? '▲ Ocultar gráfica' : '▼ Ver gráfica'}
        </span>
      </button>

      {abierto && (
        <div style={{ padding: '8px 12px 12px', height: 250 }}>
          {esLineal
            ? <Line data={chartData} options={opciones} />
            : <Bar  data={chartData} options={opciones} />
          }
        </div>
      )}
    </div>
  )
}
