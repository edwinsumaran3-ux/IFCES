// =============================================================================
//  src/features/ai-help/NeuralAudioPlayer.tsx
// =============================================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  audioBase64: string;
  script:      string;
  gender:      'male' | 'female' | 'neutral';
  durationSec: number;
}

// ── Voice names known to be female / male in Spanish ─────────────────────────
const FEMALE_HINTS = [
  'sabina','helena','laura','maria','isabel','luciana','mónica','paloma',
  'paulina','penélope','soledad','valeria','dalia','conchita','camila',
  'female','mujer','woman','girl','fernanda','natalia','daniela','sofía',
  'paola','andrea','claudia','rosa','alicia','beatriz',
];
const MALE_HINTS = [
  'pablo','juan','jorge','raúl','diego','enrique','carlos','andrés',
  'alvaro','arturo','male','hombre','man','boy','emilio','miguel','antonio',
  'rodrigo','felipe','alejandro','sergio','manuel','javier',
];

function pickVoice(gender: 'male' | 'female' | 'neutral'): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis.getVoices();
  const spanish = all.filter(v => /^es/i.test(v.lang));
  if (!spanish.length) return null;

  const nameLower = (v: SpeechSynthesisVoice) => v.name.toLowerCase();
  const isFemale  = (v: SpeechSynthesisVoice) => FEMALE_HINTS.some(h => nameLower(v).includes(h));
  const isMale    = (v: SpeechSynthesisVoice) => MALE_HINTS.some(h => nameLower(v).includes(h));

  const score = (v: SpeechSynthesisVoice): number => {
    let s = 0;
    // Online/neural voices are far less robotic → big bonus
    if (!v.localService) s += 20;
    // Language preference: CO > US > MX > ES > other
    if (v.lang === 'es-CO') s += 6;
    else if (v.lang === 'es-US') s += 4;
    else if (v.lang === 'es-MX') s += 3;
    else if (v.lang === 'es-ES') s += 2;
    // Gender match
    if (gender === 'female' && isFemale(v)) s += 8;
    if (gender === 'male'   && isMale(v))   s += 8;
    // Prefer voices whose names contain "natural" or "neural"
    if (nameLower(v).includes('natural') || nameLower(v).includes('neural')) s += 5;
    return s;
  };

  const sorted = [...spanish].sort((a, b) => score(b) - score(a));
  // Debug: log what voices are available and what was picked
  console.debug('[TTS] Spanish voices:', sorted.map(v => `${v.name} (${v.lang}, local=${v.localService})`));
  console.debug('[TTS] Selected:', sorted[0]?.name);
  return sorted[0] ?? null;
}

export default function NeuralAudioPlayer({ audioBase64, script, gender, durationSec }: Props) {
  const audioRef    = useRef<HTMLAudioElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef  = useRef(true);

  const [playing,     setPlaying]     = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [elapsed,     setElapsed]     = useState(0);
  const [voiceName,   setVoiceName]   = useState('');
  const [voicesReady, setVoicesReady] = useState(false);

  const hasGoogleAudio = !!audioBase64;
  const hasSpeech      = !hasGoogleAudio && !!script && typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canPlay        = hasGoogleAudio || hasSpeech;

  // Load voices (async on Chrome)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const load = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) {
        setVoicesReady(true);
        const picked = pickVoice(gender);
        setVoiceName(picked?.name ?? '');
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, [gender]);

  // Load mp3 blob
  useEffect(() => {
    if (!audioBase64 || !audioRef.current) return;
    const binary = atob(audioBase64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/mp3' });
    const url  = URL.createObjectURL(blob);
    audioRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [audioBase64]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearInterval(intervalRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
      window.speechSynthesis?.cancel();
    };
  }, []);

  const startTimer = (totalSec: number) => {
    let secs = 0;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      secs += 0.3;
      setElapsed(Math.floor(secs));
      setProgress(Math.min(99, (secs / totalSec) * 100));
    }, 300);
  };

  // ── Speech Synthesis ─────────────────────────────────────────────────────
  const playSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    const cleanText = script
      .replace(/\[pausa breve\]/gi, ',')   // comma gives a tiny natural pause
      .replace(/\s+/g, ' ')
      .trim();

    const utter  = new SpeechSynthesisUtterance(cleanText);
    const voice  = pickVoice(gender);

    if (voice) {
      utter.voice = voice;
      utter.lang  = voice.lang;
    } else {
      utter.lang = 'es-CO';
    }

    // Natural-sounding parameters — avoid extreme values
    utter.rate  = 0.88;
    utter.pitch = gender === 'male' ? 0.9 : 1.1;
    utter.volume = 1.0;

    utter.onstart = () => {
      if (mountedRef.current) {
        setPlaying(true);
        setProgress(0);
        setElapsed(0);
        const estimatedSec = durationSec || Math.max(30, Math.ceil(cleanText.length / 13));
        startTimer(estimatedSec);
      }
    };
    utter.onend = () => {
      clearInterval(intervalRef.current);
      if (mountedRef.current) { setPlaying(false); setProgress(100); }
    };
    utter.onerror = (e) => {
      if (e.error !== 'interrupted') console.error('[TTS] Error:', e.error);
      clearInterval(intervalRef.current);
      if (mountedRef.current) setPlaying(false);
    };

    window.speechSynthesis.speak(utter);
  }, [script, gender, durationSec]);

  const pauseSpeech = () => {
    window.speechSynthesis.cancel();
    clearInterval(intervalRef.current);
    if (mountedRef.current) setPlaying(false);
  };

  // ── HTML Audio ───────────────────────────────────────────────────────────
  const playAudio = async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      if (mountedRef.current) {
        setPlaying(true);
        startTimer(durationSec || audioRef.current.duration || 60);
      }
    } catch (_) {}
  };
  const pauseAudio = () => {
    audioRef.current?.pause();
    clearInterval(intervalRef.current);
    if (mountedRef.current) setPlaying(false);
  };
  const onAudioEnded = () => {
    clearInterval(intervalRef.current);
    if (mountedRef.current) { setPlaying(false); setProgress(100); }
  };

  const togglePlay = () => {
    if (!canPlay) return;
    if (hasSpeech)      { playing ? pauseSpeech() : playSpeech(); }
    else if (audioRef.current) { playing ? pauseAudio() : playAudio(); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const totalSec = durationSec || 100;

  // Voice label for UI
  const voiceDisplay = hasGoogleAudio
    ? (gender === 'female' ? 'Voz femenina · Google Neural2-A' : gender === 'male' ? 'Voz masculina · Google Neural2-B' : 'Voz neutra · Google Neural2-A')
    : voiceName || (gender === 'male' ? 'Voz masculina · Español' : 'Voz femenina · Español');

  const voiceMeta = hasGoogleAudio
    ? 'Google TTS Neural · Español colombiano'
    : voicesReady
      ? (hasSpeech ? `Web Speech · ${voiceName || 'Español'}` : 'Audio no disponible')
      : 'Cargando voces...';

  return (
    <div style={s.card}>
      <audio ref={audioRef} onEnded={onAudioEnded} style={{ display: 'none' }} />

      <div style={s.header}>
        <div style={s.avatar}>{gender === 'male' ? '🎙' : '🎙'}</div>
        <div style={{ flex: 1 }}>
          <div style={s.voiceName}>{voiceDisplay}</div>
          <div style={s.voiceMeta}>{voiceMeta} · {totalSec}s</div>
        </div>
        <span style={s.ttsTag}>TTS pedagógico</span>
      </div>

      {/* Waveform */}
      <div style={s.waveWrap} aria-hidden="true">
        {Array.from({ length: 32 }).map((_, i) => (
          <div key={i} style={{
            width: 3, borderRadius: 2, minHeight: 4,
            background: i % 3 === 0 ? '#7c3aed' : i % 3 === 1 ? '#00d4ff' : '#534AB7',
            height: playing ? `${8 + Math.sin(i * 0.7 + Date.now() * 0.002) * 12}px` : '4px',
            opacity: playing ? 0.9 : 0.3,
            transition: 'height 0.3s ease, opacity 0.3s',
          }} />
        ))}
      </div>

      {/* Controls */}
      <div style={s.controls}>
        <button
          style={{ ...s.playBtn, opacity: canPlay ? 1 : 0.3, cursor: canPlay ? 'pointer' : 'not-allowed' }}
          onClick={togglePlay}
          disabled={!canPlay}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <div style={s.progressWrap}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>
        <span style={s.timeText}>{fmt(elapsed)} / {fmt(totalSec)}</span>
      </div>

      {/* Transcription */}
      {script && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 10, color: '#475569', cursor: 'pointer' }}>
            Ver transcripción
          </summary>
          <p style={{ fontSize: 10, color: '#64748b', lineHeight: 1.7, marginTop: 6 }}>
            {script.replace(/\[pausa breve\]/gi, '')}
          </p>
        </details>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    background: 'rgba(8,12,28,0.95)',
    border: '0.5px solid rgba(124,58,237,0.2)',
    borderRadius: 12, padding: 12, marginBottom: 12,
  },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 36, height: 36, borderRadius: '50%',
    background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, flexShrink: 0,
  },
  voiceName: { fontSize: 12, fontWeight: 500, color: '#a78bfa' },
  voiceMeta: { fontSize: 10, color: '#334155' },
  ttsTag: {
    fontSize: 9, color: '#7c3aed',
    background: 'rgba(124,58,237,0.1)',
    padding: '2px 8px', borderRadius: 20,
    border: '0.5px solid rgba(124,58,237,0.2)',
  },
  waveWrap: { display: 'flex', alignItems: 'center', gap: 2, height: 36, marginBottom: 8 },
  controls: { display: 'flex', alignItems: 'center', gap: 8 },
  playBtn: {
    width: 32, height: 32, borderRadius: '50%',
    border: '1.5px solid #7c3aed',
    background: 'rgba(124,58,237,0.15)',
    color: '#a78bfa', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  progressWrap: {
    flex: 1, height: 3, background: 'rgba(255,255,255,0.06)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg,#7c3aed,#00d4ff)',
    borderRadius: 2, transition: 'width 0.3s',
  },
  timeText: { fontSize: 10, color: '#334155', minWidth: 60 },
};
