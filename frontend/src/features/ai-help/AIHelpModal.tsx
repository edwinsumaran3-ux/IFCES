// =============================================================================
//  src/features/ai-help/AIHelpModal.tsx
//  Panel completo de ayuda IA — orquesta pizarra + audio + espejo
// =============================================================================
import React, { useEffect, useState } from 'react';
import AcrylicWhiteboard  from './AcrylicWhiteboard';
import NeuralAudioPlayer  from './NeuralAudioPlayer';
import MirrorQuestion     from './MirrorQuestion';

interface Props {
  attemptId:      string;
  questionId:     string;
  studentId:      string;
  studentGender:  'male' | 'female' | 'neutral';
  originalPoints: number;
  remainingHelps: number;
  onClose:        () => void;
  onHelpUsed:     (remaining: number) => void;
  onAnswered:     (result: { isCorrect: boolean; awardedScore: number }) => void;
}

type Step = 'idle' | 'loading' | 'whiteboard' | 'done';

export default function AIHelpModal({
  attemptId, questionId, studentId, studentGender,
  originalPoints, remainingHelps, onClose, onHelpUsed, onAnswered,
}: Props) {
  const [step,     setStep]     = useState<Step>('idle');
  const [data,     setData]     = useState<any>(null);
  const [error,    setError]    = useState('');
  const [loadMsg,  setLoadMsg]  = useState('');
  const [voiceGender, setVoiceGender] = useState<'female' | 'male'>(
    studentGender === 'male' ? 'male' : 'female'
  );

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const LOAD_MESSAGES = [
    'Clasificando pregunta ICFES...',
    'Diseñando estrategia socrática...',
    'Generando pizarra acrílica...',
    'Creando guion de audio...',
    'Generando pregunta espejo...',
    'Evaluando integridad académica...',
    'Sintetizando audio pedagógico...',
  ];

  const requestHelp = async () => {
    if (remainingHelps <= 0) return;
    setStep('loading');
    setError('');

    // Simular mensajes de carga secuenciales
    for (let i = 0; i < LOAD_MESSAGES.length; i++) {
      await new Promise(r => setTimeout(r, 900));
      setLoadMsg(LOAD_MESSAGES[i]);
    }

    try {
      const res = await fetch(
        `/api/v1/exam-attempts/${attemptId}/questions/${questionId}/ai-help`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            student_id:    studentId,
            student_gender: voiceGender,
            locale:        'es-CO',
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text()
        let detail = 'Error al solicitar ayuda IA'
        try { detail = JSON.parse(text).detail ?? detail } catch {}
        throw new Error(detail)
      }

      const helpData = await res.json();
      setData(helpData);
      setStep('whiteboard');
      onHelpUsed(remainingHelps - 1);
    } catch (e: any) {
      setError(e.message);
      setStep('idle');
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.brainIcon}>🧠</div>
            <div>
              <div style={s.modalTitle}>Modo Ayuda Socrático</div>
              <div style={s.modalSub}>
                Motor Neuro-IA · {remainingHelps} ayudas disponibles
              </div>
            </div>
          </div>
          <div style={s.headerRight}>
            <div style={s.helpsCounter}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                  ...s.helpDot,
                  background: i < (5 - remainingHelps)
                    ? 'rgba(239,68,68,0.3)' : 'rgba(0,212,255,0.1)',
                  borderColor: i < (5 - remainingHelps)
                    ? 'rgba(239,68,68,0.5)' : 'rgba(0,212,255,0.2)',
                }} />
              ))}
            </div>
            <button style={s.closeBtn} onClick={onClose} aria-label="Cerrar panel de ayuda">✕</button>
          </div>
        </div>

        {/* Cuerpo */}
        <div style={s.body}>

          
          <div style={s.voicePanel}>
            <span style={s.voiceLabel}>Voz de la IA:</span>
            <button
              style={{
                ...s.voiceBtn,
                ...(voiceGender === 'female' ? s.voiceBtnActive : {}),
              }}
              onClick={() => setVoiceGender('female')}
              type="button"
            >
              Mujer colombiana
            </button>
            <button
              style={{
                ...s.voiceBtn,
                ...(voiceGender === 'male' ? s.voiceBtnActive : {}),
              }}
              onClick={() => setVoiceGender('male')}
              type="button"
            >
              Hombre colombiano
            </button>
          </div>
{/* IDLE */}
          {step === 'idle' && (
            <div style={s.idlePane}>
              <div style={s.idleIcon}>🎯</div>
              <div style={s.idleTitle}>¿Necesitas orientación socrática?</div>
              <div style={s.idleDesc}>
                El tutor IA analizará la pregunta y generará una pizarra acrílica con
                razonamiento paso a paso, audio pedagógico y una pregunta espejo equivalente.
                <br /><br />
                <strong style={{ color: '#fbbf24' }}>
                  Atención: Usar esta ayuda consume 1 token ({remainingHelps} restantes).
                  La pregunta original se bloqueará y deberás responder la pregunta espejo
                  con puntaje máximo del 50%.
                </strong>
              </div>
              {error && <div style={s.errorBox}>{error}</div>}
              <button style={s.helpBtn} onClick={requestHelp} disabled={remainingHelps <= 0}>
                {remainingHelps > 0 ? 'Activar ayuda socrática' : 'Sin ayudas disponibles'}
              </button>
            </div>
          )}

          {/* LOADING */}
          {step === 'loading' && (
            <div style={s.loadPane}>
              <div style={s.spinner} aria-label="Cargando explicación de IA" />
              <div style={s.loadTitle}>Generando explicación socrática...</div>
              <div style={s.loadMsg}>{loadMsg}</div>
              <div style={s.promptChain}>
                {LOAD_MESSAGES.map((msg, i) => (
                  <div key={i} style={{
                    ...s.chainStep,
                    color: loadMsg === msg ? '#00d4ff' : '#334155',
                    background: loadMsg === msg ? 'rgba(0,212,255,0.06)' : 'transparent',
                  }}>
                    <div style={{
                      ...s.chainDot,
                      background: LOAD_MESSAGES.indexOf(loadMsg) > i
                        ? '#34d399' : loadMsg === msg ? '#00d4ff' : '#1e293b',
                    }} />
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WHITEBOARD + AUDIO + MIRROR */}
          {step === 'whiteboard' && data && (
            <div style={s.contentPane}>
              <AcrylicWhiteboard
                whiteboard={data.whiteboard}
                visible={true}
              />
              <NeuralAudioPlayer
                audioBase64={data.audio_mp3_base64 || ''}
                script={data.audio_script?.tts_script || ''}
                gender={voiceGender}
                durationSec={data.audio_script?.estimated_duration_seconds || 58}
              />
              <MirrorQuestion
                mirror={data.mirror_question}
                sessionId={data.session_id}
                originalPoints={originalPoints}
                onAnswered={(result) => { onAnswered(result); setStep('done'); }}
              />
              <button style={s.reexpBtn} onClick={requestHelp}>
                ↺ Volver a explicar con analogía diferente
              </button>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && (
            <div style={s.idlePane}>
              <div style={s.idleIcon}>✅</div>
              <div style={s.idleTitle}>Sesión de ayuda completada</div>
              <div style={s.idleDesc}>
                Tu respuesta fue registrada. La pregunta original permanece bloqueada.
                Continúa con la siguiente pregunta.
              </div>
              <button style={s.helpBtn} onClick={onClose}>Continuar simulacro</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(5,9,20,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
  },
  modal: {
    background: '#070c1b',
    border: '0.5px solid rgba(0,212,255,0.2)',
    borderRadius: 14,
    width: '100%', maxWidth: 1320,
    maxHeight: '90vh',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px',
    background: 'rgba(8,12,28,0.9)',
    borderBottom: '0.5px solid rgba(0,212,255,0.1)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  brainIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'rgba(124,58,237,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
  },
  modalTitle: { fontSize: 13, fontWeight: 500, color: '#e2e8f0' },
  modalSub:   { fontSize: 10, color: '#475569' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  helpsCounter: { display: 'flex', gap: 4 },
  helpDot: {
    width: 10, height: 10, borderRadius: '50%',
    border: '0.5px solid',
  },
  closeBtn: {
    background: 'transparent', border: 'none',
    color: '#475569', fontSize: 16, cursor: 'pointer',
    padding: '4px 8px',
  },
  body: { flex: 1, overflowY: 'auto', overflowX: 'auto', padding: 14 },
  voicePanel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'rgba(15,23,42,0.7)',
    border: '0.5px solid rgba(0,212,255,0.12)',
    flexWrap: 'wrap',
  },
  voiceLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginRight: 4,
  },
  voiceBtn: {
    padding: '6px 10px',
    borderRadius: 7,
    border: '0.5px solid rgba(148,163,184,0.25)',
    background: 'rgba(15,23,42,0.9)',
    color: '#94a3b8',
    fontSize: 11,
    cursor: 'pointer',
  },
  voiceBtnActive: {
    background: 'rgba(0,212,255,0.12)',
    border: '0.5px solid rgba(0,212,255,0.45)',
    color: '#67e8f9',
  },
  idlePane: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center',
    padding: '32px 24px', gap: 14,
  },
  idleIcon:  { fontSize: 40 },
  idleTitle: { fontSize: 16, fontWeight: 500, color: '#e2e8f0' },
  idleDesc:  { fontSize: 12, color: '#64748b', lineHeight: 1.7, maxWidth: 480 },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '0.5px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '8px 12px',
    fontSize: 12, color: '#f87171', width: '100%',
  },
  helpBtn: {
    padding: '10px 28px',
    background: 'rgba(124,58,237,0.15)',
    border: '0.5px solid rgba(124,58,237,0.4)',
    borderRadius: 8, color: '#a78bfa',
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
  },
  loadPane: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '32px 24px', gap: 12,
  },
  spinner: {
    width: 40, height: 40, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.06)',
    borderTop: '3px solid #00d4ff',
    animation: 'spin 0.8s linear infinite',
  },
  loadTitle: { fontSize: 14, fontWeight: 500, color: '#e2e8f0' },
  loadMsg:   { fontSize: 12, color: '#7c3aed', fontWeight: 500 },
  promptChain: {
    display: 'flex', flexDirection: 'column', gap: 4,
    width: '100%', maxWidth: 360,
  },
  chainStep: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 11, padding: '4px 8px', borderRadius: 5, transition: 'all 0.3s',
  },
  chainDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0, transition: 'background 0.3s' },
  contentPane: { display: 'flex', flexDirection: 'column', gap: 0 },
  reexpBtn: {
    width: '100%', padding: '9px 0', marginBottom: 8,
    background: 'rgba(16,185,129,0.08)',
    border: '0.5px solid rgba(16,185,129,0.2)',
    borderRadius: 8, color: '#34d399',
    fontSize: 11, cursor: 'pointer',
  },
};


