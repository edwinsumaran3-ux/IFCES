// =============================================================================
//  src/features/ai-help/AcrylicWhiteboard.tsx
//  Pizarra acrílica digital — plumón azul y rojo animados
// =============================================================================
import React, { useEffect, useRef, useState } from 'react';

interface WhiteboardBlock {
  order: number;
  title: string;
  content: string;
  visual_hint?: string;
  visual_warning?: string;
}

interface WhiteboardOutput {
  blue_marker_blocks: WhiteboardBlock[];
  red_marker_blocks:  WhiteboardBlock[];
  final_student_instruction: string;
}

interface Props {
  whiteboard: WhiteboardOutput;
  visible: boolean;
}

export default function AcrylicWhiteboard({ whiteboard, visible }: Props) {
  const [revealedBlue, setRevealedBlue] = useState(0);
  const [revealedRed,  setRevealedRed]  = useState(0);

  // Revelar bloques uno a uno con animación tipo "escritura en pizarra"
  useEffect(() => {
    if (!visible) return;
    setRevealedBlue(0);
    setRevealedRed(0);

    const totalBlue = whiteboard.blue_marker_blocks.length;
    const totalRed  = whiteboard.red_marker_blocks.length;

    let b = 0;
    const blueTimer = setInterval(() => {
      b++;
      setRevealedBlue(b);
      if (b >= totalBlue) clearInterval(blueTimer);
    }, 600);

    let r = 0;
    const redDelay = setTimeout(() => {
      const redTimer = setInterval(() => {
        r++;
        setRevealedRed(r);
        if (r >= totalRed) clearInterval(redTimer);
      }, 500);
    }, totalBlue * 600 + 200);

    return () => { clearInterval(blueTimer); clearTimeout(redDelay); };
  }, [visible, whiteboard]);

  return (
    <div style={s.board}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.pencilBlue}>✏</span>
          <span style={s.headerTitle}>Pizarra acrílica digital</span>
          <span style={s.bundleTag}>icfes-socratic@3.4.2</span>
        </div>
        <span style={s.approvedTag}>✓ Evaluador: sin fuga de respuesta</span>
      </div>

      {/* Grid azul / rojo */}
      <div style={s.grid}>
        {/* Columna azul */}
        <div style={s.col}>
          <div style={s.colHeader('#3b82f6')}>
            <span style={{ fontSize: 13 }}>✏</span>
            Plumón azul — razonamiento
          </div>
          {whiteboard.blue_marker_blocks.map((block, i) => (
            <div
              key={i}
              style={{
                ...s.block('#3b82f6', 'rgba(37,99,235,0.06)'),
                opacity:   i < revealedBlue ? 1 : 0,
                transform: i < revealedBlue ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
              }}
            >
              <div style={s.blockTitle('#60a5fa')}>{block.title}</div>
              <div style={s.blockText}>{block.content}</div>
              {block.visual_hint && (
                <div style={s.hint}>{block.visual_hint}</div>
              )}
            </div>
          ))}
        </div>

        {/* Columna roja */}
        <div style={s.col}>
          <div style={s.colHeader('#ef4444')}>
            <span style={{ fontSize: 13 }}>✏</span>
            Plumón rojo — cazabobos
          </div>
          {whiteboard.red_marker_blocks.map((block, i) => (
            <div
              key={i}
              style={{
                ...s.block('#ef4444', 'rgba(239,68,68,0.05)'),
                opacity:   i < revealedRed ? 1 : 0,
                transform: i < revealedRed ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 0.4s ease, transform 0.4s ease',
              }}
            >
              <div style={s.blockTitle('#f87171')}>⚠ {block.title}</div>
              <div style={s.blockText}>{block.content}</div>
              {block.visual_warning && (
                <div style={{ ...s.hint, color: '#fbbf24' }}>{block.visual_warning}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Instrucción final */}
      {whiteboard.final_student_instruction && revealedBlue >= whiteboard.blue_marker_blocks.length && (
        <div style={s.finalInstruction}>
          <span style={{ color: '#34d399', marginRight: 6 }}>→</span>
          {whiteboard.final_student_instruction}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties | ((...a: any[]) => React.CSSProperties)> = {
  board: {
    background: 'rgba(8,12,28,0.95)',
    border: '0.5px solid rgba(124,58,237,0.25)',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 14px',
    background: 'rgba(124,58,237,0.08)',
    borderBottom: '0.5px solid rgba(124,58,237,0.15)',
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 8 },
  pencilBlue:  { fontSize: 16, color: '#a78bfa' },
  headerTitle: { fontSize: 12, fontWeight: 500, color: '#a78bfa' },
  bundleTag: {
    fontSize: 9, color: '#475569',
    background: 'rgba(124,58,237,0.1)',
    padding: '1px 6px', borderRadius: 20,
  },
  approvedTag: {
    fontSize: 10, color: '#34d399',
    background: 'rgba(16,185,129,0.1)',
    padding: '2px 8px', borderRadius: 20,
    border: '0.5px solid rgba(16,185,129,0.2)',
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 10, padding: 12,
  },
  col: { display: 'flex', flexDirection: 'column', gap: 6 },
  colHeader: (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 10, fontWeight: 500,
    color, padding: '5px 8px', borderRadius: 6,
    background: `${color}18`,
    border: `0.5px solid ${color}33`,
    marginBottom: 4,
  }),
  block: (borderColor: string, bg: string): React.CSSProperties => ({
    padding: '8px 10px', borderRadius: 7,
    background: bg,
    borderLeft: `2px solid ${borderColor}`,
  }),
  blockTitle: (color: string): React.CSSProperties => ({
    fontSize: 10, fontWeight: 500, color, marginBottom: 4,
  }),
  blockText: {
    fontSize: 10, color: '#64748b', lineHeight: 1.6,
    fontFamily: 'system-ui, sans-serif',
  },
  hint: {
    marginTop: 5, fontSize: 10,
    fontFamily: "'Courier New', monospace",
    color: '#93c5fd',
    background: 'rgba(37,99,235,0.1)',
    padding: '2px 7px', borderRadius: 4,
    display: 'inline-block',
  },
  finalInstruction: {
    margin: '0 12px 12px',
    padding: '8px 12px',
    background: 'rgba(16,185,129,0.06)',
    border: '0.5px solid rgba(16,185,129,0.2)',
    borderRadius: 8,
    fontSize: 11, color: '#94a3b8', lineHeight: 1.5,
  },
};
