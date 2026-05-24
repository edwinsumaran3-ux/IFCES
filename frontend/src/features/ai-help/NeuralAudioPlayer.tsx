// =============================================================================
//  src/features/ai-help/NeuralAudioPlayer.tsx
//  Reproductor de audio pedagógico con onda neural animada
// =============================================================================
import React, { useEffect, useRef, useState } from 'react';

interface Props {
  audioBase64: string;
  script:      string;
  gender:      'male' | 'female' | 'neutral';
  durationSec: number;
}

export default function NeuralAudioPlayer({ audioBase64, script, gender, durationSec }: Props) {
  const audioRef            = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  // Cargar audio base64
  useEffect(() => {
    if (!audioBase64 || !audioRef.current) return;
    const blob = base64ToBlob(audioBase64, 'audio/mp3');
    const url  = URL.createObjectURL(blob);
    audioRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [audioBase64]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      clearInterval(intervalRef.current);
    } else {
      audioRef.current.play();
      intervalRef.current = setInterval(() => {
        if (!audioRef.current) return;
        const pct = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(isNaN(pct) ? 0 : pct);
        setElapsed(Math.floor(audioRef.current.currentTime));
      }, 200);
    }
    setPlaying(p => !p);
  };

  const onEnded = () => {
    setPlaying(false);
    setProgress(100);
    clearInterval(intervalRef.current);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const voiceLabel = gender === 'female'
    ? 'Voz femenina colombiana · Neural2-A'
    : gender === 'male'
    ? 'Voz masculina colombiana · Neural2-B'
    : 'Voz neutra colombiana';

  return (
    <div style={s.card}>
      <audio ref={audioRef} onEnded={onEnded} style={{ display: 'none' }} />

      {/* Header */}
      <div style={s.header}>
        <div style={s.avatar}>🎙</div>
        <div style={{ flex: 1 }}>
          <div style={s.voiceName}>{voiceLabel}</div>
          <div style={s.voiceMeta}>
            Google TTS Neural · Español colombiano neutro · {durationSec}s estimados
          </div>
        </div>
        <div style={s.ttsTag}>TTS pedagógico</div>
      </div>

      {/* Onda neural */}
      <div style={s.waveWrap} aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            style={{
              ...s.waveBar,
              animationDelay: `${(i * 0.07) % 1.2}s`,
              height: playing ? `${8 + Math.sin(i * 0.7) * 14}px` : '4px',
              opacity: playing ? 0.9 : 0.3,
              background: i % 3 === 0 ? '#7c3aed' : i % 3 === 1 ? '#00d4ff' : '#534AB7',
              transition: 'height 0.3s ease, opacity 0.3s',
            }}
          />
        ))}
      </div>

      {/* Controles */}
      <div style={s.controls}>
        <button style={s.playBtn} onClick={togglePlay} aria-label={playing ? 'Pausar' : 'Reproducir'}>
          {playing ? '⏸' : '▶'}
        </button>
        <div style={s.progressWrap}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>
        <span style={s.timeText}>{fmt(elapsed)} / {fmt(durationSec)}</span>
      </div>

      {/* Tags de accesibilidad */}
      <div style={s.tagRow}>
        {['Pausas cognitivas', 'Anti-ansiedad', 'Carga reducida', 'TDAH-friendly', 'Prosodia pedagógica'].map(t => (
          <span key={t} style={s.tag}>{t}</span>
        ))}
      </div>

      {/* Transcripción */}
      {script && (
        <details style={s.transcript}>
          <summary style={s.transcriptLabel}>Ver transcripción</summary>
          <p style={s.transcriptText}>{script}</p>
        </details>
      )}
    </div>
  );
}

function base64ToBlob(b64: string, type: string): Blob {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
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
  waveWrap: {
    display: 'flex', alignItems: 'center', gap: 2,
    height: 36, marginBottom: 8,
  },
  waveBar: {
    width: 3, borderRadius: 2, minHeight: 4,
    animation: 'waveAnim 1.2s ease-in-out infinite',
  },
  controls: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  playBtn: {
    width: 32, height: 32, borderRadius: '50%',
    border: '1.5px solid #7c3aed',
    background: 'rgba(124,58,237,0.15)',
    color: '#a78bfa', fontSize: 13,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  progressWrap: {
    flex: 1, height: 3, background: 'rgba(255,255,255,0.06)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg,#7c3aed,#00d4ff)',
    borderRadius: 2, transition: 'width 0.2s',
  },
  timeText: { fontSize: 10, color: '#334155', minWidth: 60 },
  tagRow: { display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 },
  tag: {
    fontSize: 9, color: '#7c3aed',
    background: 'rgba(124,58,237,0.08)',
    padding: '2px 6px', borderRadius: 20,
    border: '0.5px solid rgba(124,58,237,0.2)',
  },
  transcript: { marginTop: 4 },
  transcriptLabel: { fontSize: 10, color: '#475569', cursor: 'pointer' },
  transcriptText: { fontSize: 10, color: '#475569', lineHeight: 1.6, marginTop: 6 },
};
