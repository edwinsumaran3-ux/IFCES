import React, { useState } from 'react'
import TeacherDashboard from './features/teacher/TeacherDashboard'
import ExamEngine from './features/exam/ExamEngine'

const DEMO_QUESTIONS = [
  {
    id: 'q1',
    stem: 'En una encuesta a 200 estudiantes sobre su medio de transporte habitual, se obtuvo que 80 usan bus, 60 bicicleta, 40 caminan y 20 usan otro medio. Si se selecciona un estudiante al azar, ¿cuál es la probabilidad de que use bus o bicicleta?',
    options: [
      { label: 'A', text: '0.35' },
      { label: 'B', text: '0.40' },
      { label: 'C', text: '0.70' },
      { label: 'D', text: '0.75' },
    ],
    area: 'Matemáticas',
    points: 1.0,
  },
  {
    id: 'q2',
    stem: 'Un texto argumentativo se caracteriza principalmente por presentar una tesis y defenderla mediante razones. ¿Cuál de las siguientes opciones describe mejor la función de los conectores lógicos en este tipo de texto?',
    options: [
      { label: 'A', text: 'Adornar el texto con palabras sofisticadas' },
      { label: 'B', text: 'Organizar y relacionar las ideas del texto' },
      { label: 'C', text: 'Aumentar la extensión del texto' },
      { label: 'D', text: 'Repetir la tesis varias veces' },
    ],
    area: 'Lectura Crítica',
    points: 1.0,
  },
  {
    id: 'q3',
    stem: 'Si f(x) = 2x² - 3x + 1, ¿cuál es el valor de f(3)?',
    options: [
      { label: 'A', text: '8' },
      { label: 'B', text: '10' },
      { label: 'C', text: '12' },
      { label: 'D', text: '15' },
    ],
    area: 'Matemáticas',
    points: 1.0,
  },
]

type View = 'home' | 'exam' | 'teacher'

export default function App() {
  const [view, setView] = useState<View>('home')

  return (
    <div style={{ background: '#050914', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* NAV */}
      <nav style={{
        background: 'rgba(8,12,28,0.95)',
        borderBottom: '0.5px solid rgba(0,212,255,0.15)',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, color: '#00d4ff' }}>🧠</span>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#e2e8f0' }}>ERP ICFES Neuro-IA</span>
          <span style={{
            fontSize: 10, color: '#00d4ff',
            background: 'rgba(0,212,255,0.1)',
            padding: '2px 8px', borderRadius: 20,
            border: '0.5px solid rgba(0,212,255,0.3)',
          }}>v4.0 · Sistema activo</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['home', 'exam', 'teacher'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '5px 14px', borderRadius: 20,
              border: `0.5px solid ${view === v ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
              background: view === v ? 'rgba(0,212,255,0.1)' : 'transparent',
              color: view === v ? '#00d4ff' : '#64748b',
              fontSize: 11, cursor: 'pointer',
            }}>
              {v === 'home' ? '🏠 Inicio' : v === 'exam' ? '📝 Simulacro' : '👨‍🏫 Docente'}
            </button>
          ))}
        </div>
      </nav>

      {/* VIEWS */}
      {view === 'home' && (
        <div style={{ maxWidth: 800, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
          <h1 style={{ fontSize: 32, fontWeight: 500, color: '#e2e8f0', marginBottom: 12 }}>
            ERP ICFES Neuro-IA
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 32 }}>
            Ecosistema adaptativo con tutoría socrática bimodal, pizarra acrílica digital,
            audio pedagógico neural y auditoría neurocientífica de aprendizaje.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 32 }}>
            {[
              { icon: '📝', title: 'Simulacro activo', desc: 'Motor de evaluación con 45 preguntas ICFES', view: 'exam' as View },
              { icon: '👨‍🏫', title: 'Panel docente', desc: 'Monitoreo en tiempo real del grupo', view: 'teacher' as View },
              { icon: '🤖', title: 'IA socrática', desc: 'Pizarra + audio + pregunta espejo', view: 'exam' as View },
            ].map(card => (
              <div key={card.title} onClick={() => setView(card.view)} style={{
                background: 'rgba(15,22,41,0.8)',
                border: '0.5px solid rgba(0,212,255,0.15)',
                borderRadius: 12, padding: 20, cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0', marginBottom: 4 }}>{card.title}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{card.desc}</div>
              </div>
            ))}
          </div>
          <div style={{
            background: 'rgba(15,22,41,0.8)',
            border: '0.5px solid rgba(0,212,255,0.1)',
            borderRadius: 12, padding: 16,
            display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12,
          }}>
            {[
              { label: 'Motor socrático', val: 'Claude Sonnet 4', color: '#a78bfa' },
              { label: 'Voz pedagógica', val: 'Google TTS Neural', color: '#00d4ff' },
              { label: 'Base de datos', val: 'PostgreSQL 18', color: '#34d399' },
              { label: 'Prompts activos', val: '7 en cadena', color: '#fbbf24' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 9, color: '#334155', marginBottom: 3 }}>{s.label}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'exam' && (
        <ExamEngine
          attemptId="demo-attempt-001"
          studentId="demo-student-001"
          studentGender="female"
          questions={DEMO_QUESTIONS}
          durationSecs={3600}
        />
      )}

      {view === 'teacher' && <TeacherDashboard />}
    </div>
  )
}
