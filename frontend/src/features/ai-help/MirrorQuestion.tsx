// =============================================================================
//  src/features/ai-help/MirrorQuestion.tsx
//  Pregunta espejo con calificación penalizada 50%/0%
// =============================================================================
import React, { useState } from 'react';

interface Option  { label: string; text: string }
interface Mirror  { stem: string; options: Option[] }

interface Props {
  mirror:        Mirror;
  sessionId:     string;
  originalPoints: number;
  onAnswered:    (result: { isCorrect: boolean; awardedScore: number }) => void;
}

export default function MirrorQuestion({ mirror, sessionId, originalPoints, onAnswered }: Props) {
  const [selected,  setSelected]  = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [result,    setResult]    = useState<{ isCorrect: boolean; awardedScore: number } | null>(null);
  const [loading,   setLoading]   = useState(false);

  const submit = async () => {
    if (!selected || submitted) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/exam-attempts/mirror-questions/${sessionId}/answer`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ selected_option: selected }),
        }
      );
      const data = await res.json();
      setResult({ isCorrect: data.is_correct, awardedScore: data.awarded_score });
      setSubmitted(true);
      onAnswered({ isCorrect: data.is_correct, awardedScore: data.awarded_score });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 14, color: '#34d399' }}>⧉</span>
          <span style={s.title}>Pregunta espejo — equivalencia psicométrica certificada</span>
        </div>
        <div style={s.psyBadge}>misma competencia · contexto diferente</div>
      </div>

      {/* Regla de puntuación */}
      <div style={s.ruleRow}>
        <div style={s.ruleItem('rgba(16,185,129,0.08)', 'rgba(16,185,129,0.2)')}>
          <span style={{ fontSize: 18, fontWeight: 500, color: '#34d399' }}>50%</span>
          <span style={s.ruleLabel}>Si aciertas</span>
        </div>
        <div style={s.ruleItem('rgba(239,68,68,0.06)', 'rgba(239,68,68,0.2)')}>
          <span style={{ fontSize: 18, fontWeight: 500, color: '#f87171' }}>0%</span>
          <span style={s.ruleLabel}>Si fallas</span>
        </div>
        <div style={{ ...s.ruleItem('rgba(0,212,255,0.06)', 'rgba(0,212,255,0.15)'), flex: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#00d4ff' }}>
            Puntaje posible: {(originalPoints * 0.5).toFixed(1)} pts
          </span>
          <span style={s.ruleLabel}>de {originalPoints} pts originales</span>
        </div>
      </div>

      {/* Enunciado */}
      <div style={s.stem}>{mirror.stem}</div>

      {/* Opciones */}
      <div style={s.optGrid}>
        {mirror.options.map(opt => {
          const isSelected = selected === opt.label;
          const showCorrect = submitted && result?.isCorrect && isSelected;
          const showWrong   = submitted && !result?.isCorrect && isSelected;

          return (
            <button
              key={opt.label}
              style={{
                ...s.optBtn,
                borderColor: showCorrect
                  ? '#10b981'
                  : showWrong
                  ? '#ef4444'
                  : isSelected
                  ? '#00d4ff'
                  : 'rgba(255,255,255,0.06)',
                background: showCorrect
                  ? 'rgba(16,185,129,0.1)'
                  : showWrong
                  ? 'rgba(239,68,68,0.08)'
                  : isSelected
                  ? 'rgba(0,212,255,0.06)'
                  : 'rgba(255,255,255,0.02)',
                cursor: submitted ? 'default' : 'pointer',
              }}
              onClick={() => !submitted && setSelected(opt.label)}
              disabled={submitted}
            >
              <div style={{
                ...s.optLabel,
                borderColor: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                color: isSelected ? '#00d4ff' : '#64748b',
              }}>
                {opt.label}
              </div>
              <span style={{ fontSize: 12, color: '#94a3b8', textAlign: 'left' }}>
                {opt.text}
              </span>
              {showCorrect && <span style={{ marginLeft: 'auto', color: '#34d399', fontSize: 14 }}>✓</span>}
              {showWrong   && <span style={{ marginLeft: 'auto', color: '#f87171', fontSize: 14 }}>✗</span>}
            </button>
          );
        })}
      </div>

      {/* Botón confirmar */}
      {!submitted && (
        <button
          style={{
            ...s.confirmBtn,
            opacity: selected && !loading ? 1 : 0.4,
            cursor:  selected && !loading ? 'pointer' : 'not-allowed',
          }}
          onClick={submit}
          disabled={!selected || loading}
        >
          {loading ? 'Evaluando...' : 'Confirmar respuesta'}
        </button>
      )}

      {/* Resultado */}
      {result && (
        <div style={{
          ...s.resultBox,
          background: result.isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.06)',
          borderColor: result.isCorrect ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
        }}>
          <span style={{ fontSize: 20 }}>{result.isCorrect ? '🎯' : '📚'}</span>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 500,
              color: result.isCorrect ? '#34d399' : '#f87171',
            }}>
              {result.isCorrect
                ? `¡Correcto! Obtuviste ${result.awardedScore.toFixed(1)} puntos (50% del original)`
                : 'No alcanzaste el criterio lógico esperado. Puntaje: 0'}
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
              {result.isCorrect
                ? 'Tu razonamiento fue sólido. La pregunta original queda bloqueada.'
                : 'Revisa los conceptos de la pizarra. La pregunta original queda bloqueada.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, any> = {
  card: {
    background: 'rgba(8,12,28,0.95)',
    border: '0.5px solid rgba(16,185,129,0.2)',
    borderRadius: 12, overflow: 'hidden', marginBottom: 12,
  },
  header: {
    background: 'rgba(16,185,129,0.06)',
    borderBottom: '0.5px solid rgba(16,185,129,0.15)',
    padding: '10px 14px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  title: { fontSize: 12, fontWeight: 500, color: '#34d399' },
  psyBadge: { fontSize: 10, color: '#334155' },
  ruleRow: {
    display: 'flex', gap: 8, padding: '10px 14px',
    borderBottom: '0.5px solid rgba(255,255,255,0.05)',
  },
  ruleItem: (bg: string, border: string): React.CSSProperties => ({
    flex: 1, padding: '8px 10px', borderRadius: 8,
    background: bg, border: `0.5px solid ${border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  }),
  ruleLabel: { fontSize: 9, color: '#334155' },
  stem: {
    fontSize: 12, color: '#94a3b8', lineHeight: 1.7,
    margin: '12px 14px',
    padding: 10,
    background: 'rgba(16,185,129,0.04)',
    border: '0.5px solid rgba(16,185,129,0.1)',
    borderRadius: 8,
  },
  optGrid: {
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '0 14px 12px',
  },
  optBtn: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '9px 12px', borderRadius: 8,
    border: '0.5px solid',
    transition: 'all 0.15s',
    width: '100%', textAlign: 'left',
  },
  optLabel: {
    width: 22, height: 22, borderRadius: 6,
    border: '0.5px solid', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 10, fontWeight: 600, flexShrink: 0,
  },
  confirmBtn: {
    display: 'block', width: 'calc(100% - 28px)',
    margin: '0 14px 14px',
    padding: '10px 0',
    background: 'rgba(16,185,129,0.15)',
    border: '0.5px solid rgba(16,185,129,0.3)',
    borderRadius: 8, color: '#34d399',
    fontSize: 12, fontWeight: 500,
    transition: 'all 0.2s',
  },
  resultBox: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    margin: '0 14px 14px',
    padding: '10px 12px', borderRadius: 8,
    border: '0.5px solid',
  },
};
