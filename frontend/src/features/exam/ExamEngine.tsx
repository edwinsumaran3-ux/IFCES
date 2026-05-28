// =============================================================================
//  src/features/exam/ExamEngine.tsx
//  Motor de simulacro — integra pregunta + contador + botón de ayuda IA
// =============================================================================
import React, { useState, useEffect } from 'react';
import AIHelpModal from '../ai-help/AIHelpModal';
import QuestionInlineVisual from './QuestionInlineVisual';

interface Option   { label: string; text: string }
interface Question { id: string; stem: string; options: Option[]; area: string; points: number; difficulty?: string }

interface Props {
  attemptId:     string;
  studentId:     string;
  studentGender: 'male' | 'female' | 'neutral';
  questions:     Question[];
  durationSecs:  number;
}

const AREA_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'Matemáticas':         { color: '#3fb950', bg: 'rgba(63,185,80,0.12)',  border: 'rgba(63,185,80,0.35)' },
  'Ciencias naturales':  { color: '#79c0ff', bg: 'rgba(121,192,255,0.1)', border: 'rgba(121,192,255,0.3)' },
  'Lectura critica':     { color: '#d29922', bg: 'rgba(210,153,34,0.12)', border: 'rgba(210,153,34,0.35)' },
  'Sociales y ciudadanas':{ color: '#f85149', bg: 'rgba(248,81,73,0.1)',  border: 'rgba(248,81,73,0.3)' },
  'Ingles':              { color: '#56d364', bg: 'rgba(86,211,100,0.1)',  border: 'rgba(86,211,100,0.3)' },
};

function getArea(area: string) {
  return AREA_COLORS[area] ?? { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' };
}

export default function ExamEngine({
  attemptId, studentId, studentGender, questions, durationSecs,
}: Props) {
  const [currentIdx,      setCurrentIdx]     = useState(0);
  const [answers,         setAnswers]        = useState<Record<string, string>>({});
  const [lockedQuestions, setLocked]         = useState<Set<string>>(new Set());
  const [remainingHelps,  setRemainingHelps] = useState(5);
  const [showHelp,        setShowHelp]       = useState(false);
  const [timeLeft,        setTimeLeft]       = useState(durationSecs);
  const [scores,          setScores]         = useState<Record<string, number>>({});

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const q = questions[currentIdx];
  if (!q) return null;

  const isLocked   = lockedQuestions.has(q.id);
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const areaTheme  = getArea(q.area);
  const urgent     = timeLeft < 300;

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

  const progress = ((currentIdx + 1) / questions.length) * 100;
  const answered  = Object.keys(answers).length;

  return (
    <div style={styles.shell}>
      {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
      <div style={styles.topbar}>
        <div style={styles.brand}>
          <span style={{ fontSize: 20 }}>🧠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', letterSpacing: '.02em' }}>
              ERP ICFES Neuro-IA
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>Saber 11 · Simulacro oficial</div>
          </div>
        </div>

        <div style={styles.topStats}>
          <Stat icon="✅" label="Respondidas" value={`${answered}/${questions.length}`} color="#3fb950" />
          <Stat icon="🏆" label="Puntaje" value={`${totalScore.toFixed(1)} pts`} color="#fbbf24" />
          <Stat icon="🤖" label="Ayudas IA" value={`${remainingHelps}/5`} color="#a78bfa" />
          <Stat
            icon="⏱"
            label="Tiempo"
            value={fmt(timeLeft)}
            color={urgent ? '#f87171' : '#94a3b8'}
            pulse={urgent}
          />
        </div>
      </div>

      {/* ── PROGRESS BAR ───────────────────────────────────────────────────── */}
      <div style={styles.progressWrap}>
        <div style={{ ...styles.progressFill, width: `${progress}%`, background: areaTheme.color }} />
      </div>

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div style={styles.body}>

        {/* ── QUESTION CARD ───────────────────────────────────────────────── */}
        <div style={{ ...styles.qCard, borderColor: areaTheme.border }}>

          {/* Área + número + dificultad */}
          <div style={styles.qHeader}>
            <span style={{ ...styles.areaTag, color: areaTheme.color, background: areaTheme.bg, border: `1px solid ${areaTheme.border}` }}>
              {q.area}
            </span>
            {q.difficulty === 'RETO' && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(248,81,73,0.15)', color: '#f85149', border: '1px solid rgba(248,81,73,0.4)',
                  letterSpacing: '.04em', textTransform: 'uppercase' as const }}>
                🔥 Extremadamente Alta
              </span>
            )}
            {q.difficulty === 'ALTA' && (
              <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)',
                  letterSpacing: '.04em', textTransform: 'uppercase' as const }}>
                ⚡ Dificultad Alta
              </span>
            )}
            <span style={{ ...styles.qNum, marginLeft: 'auto' }}>Pregunta {currentIdx + 1} / {questions.length}</span>
            {isLocked && (
              <span style={styles.lockedTag}>🔒 Bloqueada — responde la pregunta espejo</span>
            )}
          </div>

          {/* Enunciado */}
          <p style={styles.qText}>{q.stem}</p>

          {/* Visual inline de la pregunta */}
          <QuestionInlineVisual question={q} color={areaTheme.color} />

          {/* Opciones */}
          <div style={styles.optList}>
            {q.options.map(opt => {
              const sel = answers[q.id] === opt.label;
              return (
                <button
                  key={opt.label}
                  style={{
                    ...styles.optBtn,
                    borderColor:  sel ? areaTheme.color : 'rgba(255,255,255,0.08)',
                    background:   sel ? areaTheme.bg     : 'rgba(255,255,255,0.02)',
                    opacity:      isLocked ? 0.4 : 1,
                    cursor:       isLocked ? 'not-allowed' : 'pointer',
                    boxShadow:    sel ? `0 0 0 1px ${areaTheme.color}44` : 'none',
                  }}
                  onClick={() => selectAnswer(opt.label)}
                  disabled={isLocked}
                >
                  <span style={{
                    ...styles.optLetter,
                    color:       sel ? '#fff'          : '#64748b',
                    background:  sel ? areaTheme.color : 'rgba(255,255,255,0.05)',
                    borderColor: sel ? areaTheme.color : 'rgba(255,255,255,0.1)',
                  }}>
                    {opt.label}
                  </span>
                  <span style={styles.optText}>{opt.text}</span>
                </button>
              );
            })}
          </div>

          {/* Botón ayuda IA */}
          {!isLocked && (
            <button
              style={{
                ...styles.aiBtn,
                opacity: remainingHelps > 0 ? 1 : 0.35,
                cursor:  remainingHelps > 0 ? 'pointer' : 'not-allowed',
              }}
              onClick={() => remainingHelps > 0 && setShowHelp(true)}
            >
              <span style={styles.aiBtnLeft}>
                <span style={{ fontSize: 18 }}>🧠</span>
                <span>
                  <span style={styles.aiBtnTitle}>Activar ayuda socrática IA</span>
                  <span style={styles.aiBtnSub}>Pizarra · Audio · Pregunta espejo</span>
                </span>
              </span>
              <span style={styles.aiBtnRight}>
                {remainingHelps > 0 ? `${remainingHelps} restantes` : 'Sin ayudas'}
              </span>
            </button>
          )}
        </div>

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <div style={styles.nav}>
          <button
            style={styles.navBtnGhost}
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={currentIdx === 0}
          >
            ← Anterior
          </button>

          <div style={styles.dotsWrap}>
            {questions.map((qq, i) => {
              const isDone   = !!answers[qq.id];
              const isCurr   = i === currentIdx;
              const isLock   = lockedQuestions.has(qq.id);
              return (
                <button
                  key={i}
                  title={`Pregunta ${i + 1}`}
                  style={{
                    ...styles.dot,
                    background: isCurr
                      ? areaTheme.color
                      : isDone
                      ? '#3fb950'
                      : isLock
                      ? '#f59e0b'
                      : 'rgba(255,255,255,0.07)',
                    transform: isCurr ? 'scale(1.35)' : 'scale(1)',
                    boxShadow: isCurr ? `0 0 6px ${areaTheme.color}88` : 'none',
                  }}
                  onClick={() => setCurrentIdx(i)}
                />
              );
            })}
          </div>

          <button
            style={styles.navBtnPrimary}
            onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
            disabled={currentIdx === questions.length - 1}
          >
            Siguiente →
          </button>
        </div>
      </div>

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

// ── Stat chip ─────────────────────────────────────────────────────────────────
function Stat({ icon, label, value, color, pulse }: {
  icon: string; label: string; value: string; color: string; pulse?: boolean
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '6px 14px', minWidth: 72,
      animation: pulse ? 'urgentPulse 1s ease-in-out infinite' : 'none',
    }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2 }}>{value}</span>
      <span style={{ fontSize: 9, color: '#475569', marginTop: 1, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  shell: {
    background: '#0d1117',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    background: '#161b22',
    borderBottom: '1px solid #21262d',
    gap: 16,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  topStats: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  progressWrap: { height: 3, background: '#21262d' },
  progressFill: { height: 3, transition: 'width .5s ease, background .5s ease' },
  body: {
    flex: 1,
    maxWidth: 780,
    margin: '0 auto',
    width: '100%',
    padding: '24px 20px 100px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  qCard: {
    background: '#161b22',
    border: '1px solid',
    borderRadius: 14,
    padding: '22px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  qHeader: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  areaTag: {
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: 20,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
  },
  qNum: {
    fontSize: 12,
    color: '#8b949e',
    background: '#21262d',
    border: '1px solid #30363d',
    padding: '4px 12px',
    borderRadius: 20,
    fontVariantNumeric: 'tabular-nums',
  },
  lockedTag: {
    fontSize: 11,
    color: '#f85149',
    background: 'rgba(248,81,73,0.1)',
    border: '1px solid rgba(248,81,73,0.3)',
    padding: '4px 12px',
    borderRadius: 20,
  },
  qText: {
    fontSize: 16,
    color: '#e6edf3',
    lineHeight: 1.8,
    margin: 0,
  },
  optList: { display: 'flex', flexDirection: 'column', gap: 10 },
  optBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid',
    transition: 'all .15s',
    width: '100%',
    textAlign: 'left',
  },
  optLetter: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    transition: 'all .15s',
  },
  optText: {
    fontSize: 14,
    color: '#c9d1d9',
    lineHeight: 1.6,
  },
  visualBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px',
    background: 'rgba(31,111,235,0.08)',
    border: '1px solid rgba(31,111,235,0.25)',
    borderRadius: 10,
    transition: 'all .2s',
    gap: 12,
    cursor: 'pointer',
    width: '100%',
  },
  aiBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    background: 'rgba(124,58,237,0.12)',
    border: '1px solid rgba(124,58,237,0.35)',
    borderRadius: 10,
    transition: 'all .2s',
    gap: 12,
  },
  aiBtnLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  aiBtnTitle: {
    display: 'block',
    fontSize: 14,
    fontWeight: 600,
    color: '#c4b5fd',
  },
  aiBtnSub: {
    display: 'block',
    fontSize: 11,
    color: '#6e7681',
    marginTop: 2,
  },
  aiBtnRight: {
    fontSize: 12,
    color: '#a78bfa',
    background: 'rgba(124,58,237,0.2)',
    border: '1px solid rgba(124,58,237,0.4)',
    padding: '4px 12px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
    fontWeight: 600,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  navBtnGhost: {
    padding: '10px 18px',
    borderRadius: 8,
    border: '1px solid #30363d',
    background: 'transparent',
    color: '#8b949e',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all .15s',
    fontFamily: 'inherit',
  },
  navBtnPrimary: {
    padding: '10px 18px',
    borderRadius: 8,
    border: '1px solid rgba(31,111,235,0.5)',
    background: 'rgba(31,111,235,0.15)',
    color: '#58a6ff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all .15s',
    fontFamily: 'inherit',
  },
  dotsWrap: {
    display: 'flex',
    gap: 5,
    flexWrap: 'wrap',
    justifyContent: 'center',
    flex: 1,
    maxHeight: 60,
    overflow: 'hidden',
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    transition: 'all .15s',
    padding: 0,
  },
};
