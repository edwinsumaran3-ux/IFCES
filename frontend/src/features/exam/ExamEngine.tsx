// =============================================================================
//  src/features/exam/ExamEngine.tsx
//  Motor de simulacro — integra pregunta + contador + botón de ayuda IA
// =============================================================================
import React, { useState, useEffect } from 'react';
import AIHelpModal from '../ai-help/AIHelpModal';

interface Option   { label: string; text: string }
interface Question { id: string; stem: string; options: Option[]; area: string; points: number }

interface Props {
  attemptId:     string;
  studentId:     string;
  studentGender: 'male' | 'female' | 'neutral';
  questions:     Question[];
  durationSecs:  number;
}

export default function ExamEngine({
  attemptId, studentId, studentGender, questions, durationSecs,
}: Props) {
  const [currentIdx,     setCurrentIdx]     = useState(0);
  const [answers,        setAnswers]        = useState<Record<string, string>>({});
  const [lockedQuestions,setLocked]         = useState<Set<string>>(new Set());
  const [remainingHelps, setRemainingHelps] = useState(5);
  const [showHelp,       setShowHelp]       = useState(false);
  const [timeLeft,       setTimeLeft]       = useState(durationSecs);
  const [scores,         setScores]         = useState<Record<string, number>>({});

  // Temporizador
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const q = questions[currentIdx];
  if (!q) return null;

  const isLocked   = lockedQuestions.has(q.id);
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const selectAnswer = (label: string) => {
    if (isLocked) return;
    setAnswers(prev => ({ ...prev, [q.id]: label }));
  };

  const handleHelpUsed = (remaining: number) => {
    setRemainingHelps(remaining);
    setLocked(prev => new Set([...prev, q.id]));
  };

  const handleAnswered = (result: { isCorrect: boolean; awardedScore: number }) => {
    setScores(prev => ({ ...prev, [q.id]: result.awardedScore }));
    setShowHelp(false);
  };

  return (
    <div style={s.shell}>
      {/* TOPBAR */}
      <div style={s.topbar}>
        <div style={s.brand}>
          <span style={{ fontSize: 18, color: '#00d4ff' }}>🧠</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#e2e8f0' }}>ERP ICFES Neuro-IA</span>
          <span style={s.brandTag}>Saber 11 · Simulacro oficial</span>
        </div>
        <div style={s.topMeta}>
          <span style={s.pill('#10b981', 'rgba(16,185,129,0.12)')}>
            🏆 {totalScore.toFixed(1)} pts
          </span>
          <span style={s.pill('#fbbf24', 'rgba(245,158,11,0.12)')}>
            🤖 {remainingHelps}/5 ayudas
          </span>
          <span style={s.pill(timeLeft < 300 ? '#f87171' : '#94a3b8', 'rgba(255,255,255,0.06)')}>
            ⏱ {fmt(timeLeft)}
          </span>
        </div>
      </div>

      {/* BODY */}
      <div style={s.body}>
        {/* Pregunta */}
        <div style={s.qCard}>
          <div style={s.qMeta}>
            <span style={s.tag('#00d4ff')}>{q.area}</span>
            <span style={s.tag('#a78bfa')}>Pregunta {currentIdx + 1} / {questions.length}</span>
            {isLocked && (
              <span style={s.tag('#f87171')}>🔒 Bloqueada — responde la pregunta espejo</span>
            )}
          </div>

          <p style={s.qText}>{q.stem}</p>

          <div style={s.optGrid}>
            {q.options.map(opt => {
              const sel = answers[q.id] === opt.label;
              return (
                <button
                  key={opt.label}
                  style={{
                    ...s.optBtn,
                    opacity:     isLocked ? 0.35 : 1,
                    borderColor: sel ? '#00d4ff' : 'rgba(255,255,255,0.06)',
                    background:  sel ? 'rgba(0,212,255,0.06)' : 'rgba(255,255,255,0.02)',
                    cursor:      isLocked ? 'not-allowed' : 'pointer',
                  }}
                  onClick={() => selectAnswer(opt.label)}
                  disabled={isLocked}
                >
                  <span style={{
                    ...s.optLabel,
                    borderColor: sel ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                    color:       sel ? '#00d4ff' : '#64748b',
                  }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Botón ayuda IA */}
          {!isLocked && (
            <button
              style={{
                ...s.aiBtn,
                opacity: remainingHelps > 0 ? 1 : 0.4,
                cursor:  remainingHelps > 0 ? 'pointer' : 'not-allowed',
              }}
              onClick={() => remainingHelps > 0 && setShowHelp(true)}
            >
              🧠 Activar ayuda socrática IA
              <span style={s.aiBtnSub}>consume 1 token · bloquea pregunta original</span>
            </button>
          )}
        </div>

        {/* Navegación */}
        <div style={s.navRow}>
          <button
            style={s.navBtn('#334155')}
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
          >
            ← Anterior
          </button>
          <div style={s.qDots}>
            {questions.map((_, i) => (
              <button
                key={i}
                style={{
                  ...s.qDot,
                  background: i === currentIdx
                    ? '#00d4ff'
                    : answers[questions[i].id]
                    ? '#10b981'
                    : lockedQuestions.has(questions[i].id)
                    ? '#f59e0b'
                    : '#1e293b',
                }}
                onClick={() => setCurrentIdx(i)}
              />
            ))}
          </div>
          <button
            style={s.navBtn('#00d4ff')}
            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
            disabled={currentIdx === questions.length - 1}
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* Modal de ayuda IA */}
      {showHelp && (
        <AIHelpModal
          attemptId={attemptId}
          questionId={q.id}
          studentId={studentId}
          studentGender={studentGender}
          originalPoints={q.points}
          remainingHelps={remainingHelps}
          onClose={() => setShowHelp(false)}
          onHelpUsed={handleHelpUsed}
          onAnswered={handleAnswered}
        />
      )}
    </div>
  );
}

const s: Record<string, any> = {
  shell: { background: '#050914', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  topbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 20px',
    background: 'rgba(8,12,28,0.95)',
    borderBottom: '0.5px solid rgba(0,212,255,0.15)',
  },
  brand:    { display: 'flex', alignItems: 'center', gap: 8 },
  brandTag: { fontSize: 10, color: '#475569', background: 'rgba(0,212,255,0.08)', padding: '2px 8px', borderRadius: 20 },
  topMeta:  { display: 'flex', alignItems: 'center', gap: 8 },
  pill: (color: string, bg: string): React.CSSProperties => ({
    fontSize: 11, color, background: bg,
    padding: '4px 10px', borderRadius: 20,
    border: `0.5px solid ${color}44`,
  }),
  body: { flex: 1, padding: '20px', maxWidth: 760, margin: '0 auto', width: '100%' },
  qCard: {
    background: 'rgba(15,22,41,0.8)',
    border: '0.5px solid rgba(0,212,255,0.15)',
    borderRadius: 12, padding: 16, marginBottom: 14,
    position: 'relative', overflow: 'hidden',
  },
  qMeta: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  tag: (color: string): React.CSSProperties => ({
    fontSize: 10, color, background: `${color}18`,
    border: `0.5px solid ${color}33`,
    padding: '2px 8px', borderRadius: 20,
  }),
  qText: { fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 14 },
  optGrid: { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 },
  optBtn: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '9px 12px', borderRadius: 8,
    border: '0.5px solid', transition: 'all 0.15s', width: '100%',
  },
  optLabel: {
    width: 22, height: 22, borderRadius: 6,
    border: '0.5px solid', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 600, flexShrink: 0,
  },
  aiBtn: {
    width: '100%', padding: '10px 14px',
    background: 'rgba(124,58,237,0.1)',
    border: '0.5px solid rgba(124,58,237,0.3)',
    borderRadius: 8, color: '#a78bfa',
    fontSize: 12, fontWeight: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    transition: 'all 0.2s',
  },
  aiBtnSub: { fontSize: 10, color: '#475569', fontWeight: 400 },
  navRow: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 12,
  },
  navBtn: (color: string): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8,
    border: `0.5px solid ${color}55`,
    background: `${color}11`, color,
    fontSize: 12, cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  qDots: { display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', flex: 1 },
  qDot: {
    width: 10, height: 10, borderRadius: '50%',
    border: 'none', cursor: 'pointer', transition: 'background 0.2s',
  },
};
