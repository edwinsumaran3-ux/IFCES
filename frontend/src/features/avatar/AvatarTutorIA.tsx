// =============================================================================
//  src/features/avatar/AvatarTutorIA.tsx
//  Avatar IA realista (video en loop) — panel derecho del simulacro y banco.
//  - Video MP4 en loop por género como base visual.
//  - Lee en voz alta el texto recibido (Web Speech API).
//  - Acepta externalState para sincronizar visualmente con audio externo.
// =============================================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';

type AvatarState = 'idle' | 'thinking' | 'talking' | 'listening';

interface Props {
  text:           string;
  gender:         'male' | 'female' | 'neutral';
  autoPlay?:      boolean;
  label?:         string;
  externalState?: AvatarState; // sobreescribe el estado interno (sin TTS propio)
}

const VIDEO_SRC: Record<'male' | 'female' | 'neutral', string> = {
  female:  '/avatars/avatar_male.mp4',
  male:    '/avatars/avatar_male.mp4',
  neutral: '/avatars/avatar_male.mp4',
};

const FEMALE_HINTS = [
  'sabina','helena','laura','maria','isabel','luciana','mónica','paloma',
  'paulina','penélope','soledad','valeria','dalia','conchita','camila',
  'female','mujer','woman','girl','fernanda','natalia','daniela','sofía',
  'paola','andrea','claudia','rosa','alicia','beatriz','salome',
];
const MALE_HINTS = [
  'pablo','juan','jorge','raúl','diego','enrique','carlos','andrés',
  'alvaro','arturo','male','hombre','man','boy','emilio','miguel','antonio',
  'rodrigo','felipe','alejandro','sergio','manuel','javier','gonzalo',
];

function pickVoice(gender: 'male' | 'female' | 'neutral'): SpeechSynthesisVoice | null {
  const all     = window.speechSynthesis?.getVoices?.() ?? [];
  const spanish = all.filter(v => /^es/i.test(v.lang));
  if (!spanish.length) return null;

  const nameLower = (v: SpeechSynthesisVoice) => v.name.toLowerCase();
  const isFemale  = (v: SpeechSynthesisVoice) => FEMALE_HINTS.some(h => nameLower(v).includes(h));
  const isMale    = (v: SpeechSynthesisVoice) => MALE_HINTS.some(h => nameLower(v).includes(h));

  const score = (v: SpeechSynthesisVoice): number => {
    let sc = 0;
    if (!v.localService) sc += 20;
    if (v.lang === 'es-CO') sc += 6;
    else if (v.lang === 'es-US') sc += 4;
    else if (v.lang === 'es-MX') sc += 3;
    else if (v.lang === 'es-ES') sc += 2;
    if (gender === 'female' && isFemale(v)) sc += 8;
    if (gender === 'male'   && isMale(v))   sc += 8;
    if (nameLower(v).includes('natural') || nameLower(v).includes('neural')) sc += 5;
    return sc;
  };

  return [...spanish].sort((a, b) => score(b) - score(a))[0] ?? null;
}

const STATE_COLOR: Record<AvatarState, string> = {
  idle:      '#475569',
  thinking:  '#fbbf24',
  talking:   '#3fb950',
  listening: '#00d4ff',
};

export default function AvatarTutorIA({
  text,
  gender,
  autoPlay = false,
  label = 'Tutor IA · ICFES',
  externalState,
}: Props) {
  const isFemale = gender !== 'male';

  const [internalState, setInternalState] = useState<AvatarState>('idle');
  const [muted,         setMuted]         = useState(false);
  const [videoOk,       setVideoOk]       = useState(true);

  // El estado visible es el externo (si existe) o el interno
  const state   = externalState ?? internalState;
  const accent  = isFemale ? '#a78bfa' : '#00d4ff';
  const videoSrc = VIDEO_SRC[gender] ?? VIDEO_SRC.female;

  const mountedRef = useRef(true);
  const videoRef   = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── TTS (solo cuando no se usa externalState) ────────────────────────────
  const speak = useCallback((value: string) => {
    if (externalState !== undefined) return; // audio externo — no duplicar
    if (!('speechSynthesis' in window) || !value) return;
    window.speechSynthesis.cancel();

    const cleanText = value
      .replace(/\[pausa breve\]/gi, ',')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) return;

    const utter = new SpeechSynthesisUtterance(cleanText);
    const voice = pickVoice(gender);
    if (voice) { utter.voice = voice; utter.lang = voice.lang; }
    else { utter.lang = 'es-CO'; }

    utter.rate   = 0.95;
    utter.pitch  = gender === 'male' ? 0.9 : 1.1;
    utter.volume = 1.0;

    utter.onstart = () => { if (mountedRef.current) setInternalState('talking'); };
    utter.onend   = () => { if (mountedRef.current) setInternalState('idle'); };
    utter.onerror = () => { if (mountedRef.current) setInternalState('idle'); };

    window.speechSynthesis.speak(utter);
  }, [gender, externalState]);

  // Auto-leer cuando cambia el texto (solo si no hay control externo)
  useEffect(() => {
    if (!autoPlay || muted || externalState !== undefined) return;
    setInternalState('thinking');
    const t = setTimeout(() => speak(text), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoPlay]);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const togglePlay = () => {
    if (externalState !== undefined) return;
    if (internalState === 'talking') {
      window.speechSynthesis.cancel();
      setInternalState('idle');
    } else {
      speak(text);
    }
  };

  const toggleMute = () => {
    if (externalState !== undefined) return;
    setMuted(m => {
      const next = !m;
      if (next) { window.speechSynthesis.cancel(); setInternalState('idle'); }
      return next;
    });
  };

  return (
    <div style={s.wrap}>
      <style>{`
        @keyframes avatarTalkPulse {
          0%, 100% { transform: scaleY(0.4); opacity: .55; }
          50%      { transform: scaleY(1);   opacity: 1; }
        }
        @keyframes avatarThinkDot {
          0%, 80%, 100% { opacity: .25; transform: translateY(0); }
          40%           { opacity: 1;   transform: translateY(-3px); }
        }
        @keyframes avatarFrame {
          0%, 100% { box-shadow: 0 0 0 2px ${accent}33, 0 0 24px ${accent}22; }
          50%      { box-shadow: 0 0 0 2px ${accent}66, 0 0 38px ${accent}44; }
        }
        .avatar-video-frame { animation: avatarFrame 3s ease-in-out infinite; }
      `}</style>

      <div style={s.headerRow}>
        <span style={{ ...s.statusDot, background: STATE_COLOR[state] }} />
        <span style={s.label}>{label}</span>
        <span style={{ ...s.genderTag, color: accent, borderColor: `${accent}55`, background: `${accent}14` }}>
          {isFemale ? 'Avatar femenino' : 'Avatar masculino'}
        </span>
      </div>

      <div style={s.stage}>
        <div className="avatar-video-frame" style={{ ...s.videoFrame, borderColor: `${accent}55` }}>
          {videoOk ? (
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setVideoOk(false)}
              style={s.video}
            />
          ) : (
            <div style={s.videoFallback}>
              <span style={{ fontSize: 46 }}>{isFemale ? '👩‍💻' : '🧑‍💻'}</span>
              <p style={s.videoFallbackText}>
                Coloca el video en<br /><code>{videoSrc}</code>
              </p>
            </div>
          )}

          {/* Marca ICFES */}
          <div style={{ ...s.brandOverlay, color: accent, borderColor: `${accent}55` }}>
            ICFES · IA
          </div>

          {/* Barras de boca al hablar */}
          {state === 'talking' && (
            <div style={s.talkOverlay}>
              {[0, 1, 2, 3, 4].map(i => (
                <span
                  key={i}
                  style={{
                    ...s.talkBar,
                    background: accent,
                    animation: `avatarTalkPulse ${0.45 + i * 0.07}s ease-in-out infinite`,
                    animationDelay: `${i * 0.06}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Puntos de "pensando" */}
          {state === 'thinking' && (
            <div style={s.thinkOverlay}>
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  style={{
                    ...s.thinkDot,
                    background: accent,
                    animation: `avatarThinkDot 1.2s ease-in-out infinite`,
                    animationDelay: `${i * 0.18}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* HUD badge */}
          <div style={{ ...s.hudBadge, borderColor: `${accent}66`, color: accent }}>
            {state === 'talking' ? 'EN VIVO' : state === 'thinking' ? 'PROCESANDO' : 'IA · ICFES'}
          </div>
        </div>
      </div>

      <div style={s.statusLine}>
        {state === 'talking'   && <span style={{ color: accent }}>🗣 Leyendo el enunciado…</span>}
        {state === 'thinking'  && <span style={{ color: '#94a3b8' }}>💭 Preparando explicación…</span>}
        {state === 'listening' && <span style={{ color: '#94a3b8' }}>👂 Escuchando…</span>}
        {state === 'idle'      && <span style={{ color: '#475569' }}>En espera</span>}
      </div>

      {/* Controles solo cuando el audio es interno */}
      {externalState === undefined && (
        <div style={s.controls}>
          <button
            style={{ ...s.ctrlBtn, borderColor: accent, color: accent, background: `${accent}14` }}
            onClick={togglePlay}
            disabled={muted}
          >
            {internalState === 'talking' ? '⏸ Pausar lectura' : '▶ Leer pregunta'}
          </button>
          <button
            style={{ ...s.ctrlBtnGhost, opacity: muted ? 1 : 0.7 }}
            onClick={toggleMute}
            title={muted ? 'Activar voz' : 'Silenciar'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      )}

      {externalState === undefined && (
        <p style={s.hint}>
          El avatar lee automáticamente cada nueva pregunta. Puedes pausar o silenciar.
        </p>
      )}

      {externalState !== undefined && (
        <p style={s.hint}>
          Presiona 🔊 en la pregunta para activar la explicación del tutor.
        </p>
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0d1117',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: '16px 18px',
    boxSizing: 'border-box',
  },
  headerRow:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusDot:  { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  label:      { fontSize: 12, fontWeight: 700, color: '#e2e8f0', letterSpacing: '.02em', flex: 1 },
  genderTag:  {
    fontSize: 9, padding: '2px 8px', borderRadius: 20, border: '1px solid',
    textTransform: 'uppercase' as const, letterSpacing: '.04em', fontWeight: 700,
  },
  stage: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  videoFrame: {
    position: 'relative',
    width: '100%',
    aspectRatio: '3 / 4',
    borderRadius: 12,
    overflow: 'hidden',
    border: '1px solid',
    background: '#000',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' },
  videoFallback: {
    width: '100%', height: '100%', minHeight: 260,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 10, color: '#475569', textAlign: 'center', padding: 16,
  },
  videoFallbackText: { fontSize: 11, lineHeight: 1.6, margin: 0 },
  talkOverlay: {
    position: 'absolute', left: '50%', bottom: '14%',
    transform: 'translateX(-50%)', display: 'flex', alignItems: 'flex-end',
    gap: 4, height: 22, padding: '4px 10px',
    background: 'rgba(13,17,23,0.55)', borderRadius: 8, backdropFilter: 'blur(2px)',
  },
  talkBar:     { width: 4, height: 16, borderRadius: 2, transformOrigin: 'bottom' },
  thinkOverlay: {
    position: 'absolute', left: '50%', bottom: '14%',
    transform: 'translateX(-50%)', display: 'flex', alignItems: 'center',
    gap: 5, padding: '6px 12px',
    background: 'rgba(13,17,23,0.55)', borderRadius: 8, backdropFilter: 'blur(2px)',
  },
  thinkDot:   { width: 6, height: 6, borderRadius: '50%' },
  hudBadge: {
    position: 'absolute', top: 10, right: 10,
    fontSize: 9, fontWeight: 800, letterSpacing: '.08em',
    padding: '3px 8px', borderRadius: 20, border: '1px solid',
    background: 'rgba(13,17,23,0.6)', backdropFilter: 'blur(2px)',
  },
  brandOverlay: {
    position: 'absolute', top: 10, left: 10,
    fontSize: 11, fontWeight: 800, letterSpacing: '.06em',
    padding: '4px 10px', borderRadius: 8, border: '1px solid',
    background: 'rgba(13,17,23,0.7)', backdropFilter: 'blur(2px)',
  },
  statusLine: { textAlign: 'center', fontSize: 12, fontWeight: 600, minHeight: 18, marginTop: 6 },
  controls:   { display: 'flex', gap: 8, marginTop: 10 },
  ctrlBtn: {
    flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  ctrlBtnGhost: {
    width: 40, padding: '9px 0', borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
    fontSize: 14, cursor: 'pointer',
  },
  hint: { fontSize: 10, color: '#475569', lineHeight: 1.5, marginTop: 10, marginBottom: 0 },
};
