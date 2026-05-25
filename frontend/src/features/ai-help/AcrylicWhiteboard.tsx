// =============================================================================
//  AcrylicWhiteboard.tsx - Renderizador pedagogico dinamico basado en JSON
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react';

interface MarkerBlock {
  order?: number;
  title: string;
  content: string;
  visual_hint?: string;
  visual_warning?: string;
}

interface FormulaSpec {
  type?: string;
  equation?: string;
  reactants?: string[];
  products?: string[];
  variables?: Record<string, string>;
  steps?: string[];
}

interface VisualElement {
  type: string;
  title?: string;
  caption?: string;
  shape?: string;
  left_label?: string;
  right_label?: string;
  headers?: string[];
  rows?: Array<Array<string | number>>;
  labels?: string[];
  values?: Array<string | number>;
  items?: string[];
  points?: Array<Record<string, string | number>>;
}

interface OptionAnalysis {
  option: string;
  status: string;
  reason: string;
}

interface AudioSyncMarker {
  time_seconds?: number;
  label: string;
  section?: string;
}

interface WhiteboardOutput {
  board_style?: string;
  subject?: string;
  title?: string;
  formula?: FormulaSpec | null;
  blue_reasoning?: MarkerBlock[];
  red_traps?: MarkerBlock[];
  visual_elements?: VisualElement[];
  options_analysis?: OptionAnalysis[];
  final_close?: string;
  audio_sync_markers?: AudioSyncMarker[];
  blue_marker_blocks?: MarkerBlock[];
  red_marker_blocks?: MarkerBlock[];
  final_student_instruction?: string;
}

interface Props {
  whiteboard: WhiteboardOutput;
  visible: boolean;
}

export default function AcrylicWhiteboard({ whiteboard, visible }: Props) {
  const [phase, setPhase] = useState(0);

  const blueBlocks = useMemo(
    () => sortBlocks(whiteboard.blue_reasoning?.length ? whiteboard.blue_reasoning : whiteboard.blue_marker_blocks),
    [whiteboard]
  );
  const redBlocks = useMemo(
    () => sortBlocks(whiteboard.red_traps?.length ? whiteboard.red_traps : whiteboard.red_marker_blocks),
    [whiteboard]
  );

  const visualElements = whiteboard.visual_elements ?? [];
  const options = whiteboard.options_analysis ?? [];
  const finalClose = whiteboard.final_close || whiteboard.final_student_instruction || '';
  const subject = whiteboard.subject || 'ICFES';
  const title = whiteboard.title || 'Pizarra acrilica de razonamiento';

  useEffect(() => {
    if (!visible) return;
    setPhase(0);
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setPhase(current);
      if (current >= 6) clearInterval(timer);
    }, 420);
    return () => clearInterval(timer);
  }, [visible, whiteboard]);

  return (
    <div style={boardShell}>
      <div style={topGlow} />
      <div style={leftGlow} />
      <div style={{ ...screw, top: 10, left: 12 }} />
      <div style={{ ...screw, top: 10, right: 12 }} />
      <div style={{ ...screw, bottom: 10, left: 12 }} />
      <div style={{ ...screw, bottom: 10, right: 12 }} />
      <BoardHeader subject={subject} title={title} />

      <div style={boardSurface}>
        <BlueReasoningColumn blocks={blueBlocks} revealed={phase >= 1} />

        <main style={centerStage}>
          <ResolutionPanel formula={whiteboard.formula ?? undefined} blueBlocks={blueBlocks} />
          <FormulaCanvas formula={whiteboard.formula ?? undefined} subject={subject} elements={visualElements} />
          <DiagramRenderer elements={visualElements} />
          <ChartRenderer elements={visualElements} />
        </main>

        <RedTrapColumn blocks={redBlocks} revealed={phase >= 2} />
      </div>

      <OptionsAnalysisPanel options={options} revealed={phase >= 3} />

      <div style={bottomBand}>
        <MetaCognitiveClose text={finalClose} revealed={phase >= 4} />
        <AudioExplanationBar markers={whiteboard.audio_sync_markers ?? []} revealed={phase >= 5} />
      </div>

      <div style={markerTray}>
        <span style={{ ...pen, background: '#174de8' }} />
        <span style={{ ...pen, background: '#d71920' }} />
        <span style={{ ...pen, background: '#15803d' }} />
        <span style={{ ...eraser }} />
      </div>
    </div>
  );
}

function BoardHeader({ subject, title }: { subject: string; title: string }) {
  return (
    <header style={header}>
      <div style={brandCluster}>
        <BrainMark />
        <div>
          <div style={modeText}>Modo Ayuda Socratico</div>
          <div style={subText}>Motor Neuro-IA · Explicacion profesional</div>
        </div>
      </div>
      <div style={titleBlock}>
        <div style={subjectText}>{subject}</div>
        <h2 style={boardTitle}>{title}</h2>
      </div>
      <div style={levelBadge}>
        <span>Nivel: Profesional</span>
        <strong>Saber 11</strong>
      </div>
    </header>
  );
}

function BlueReasoningColumn({ blocks, revealed }: { blocks: MarkerBlock[]; revealed: boolean }) {
  return (
    <section style={{ ...sideColumn, ...blueColumn, ...fadeIn(revealed) }}>
      <ColumnHeader color="#174de8" title="Plumon azul - ruta de razonamiento" />
      {blocks.map((block, index) => (
        <ReasoningCard key={`${block.title}-${index}`} index={index + 1} block={block} color="#174de8" />
      ))}
    </section>
  );
}

function RedTrapColumn({ blocks, revealed }: { blocks: MarkerBlock[]; revealed: boolean }) {
  return (
    <section style={{ ...sideColumn, ...redColumn, ...fadeIn(revealed) }}>
      <ColumnHeader color="#c5141b" title="Plumon rojo - trampas y cazabobos" />
      {blocks.map((block, index) => (
        <TrapCard key={`${block.title}-${index}`} index={index + 1} block={block} />
      ))}
    </section>
  );
}

function ResolutionPanel({ formula, blueBlocks }: { formula?: FormulaSpec; blueBlocks: MarkerBlock[] }) {
  // Collect steps from formula.steps OR synthesize from blue blocks
  const steps: { label: string; text: string }[] = [];

  if (formula?.steps?.length) {
    formula.steps.forEach(s => {
      const raw = String(s).trim();
      if (!raw || raw.length < 5) return;
      const colonIdx = raw.indexOf(':');
      if (colonIdx > 0 && colonIdx < 20) {
        steps.push({ label: raw.slice(0, colonIdx).trim(), text: raw.slice(colonIdx + 1).trim() });
      } else {
        steps.push({ label: `Paso ${steps.length + 1}`, text: raw });
      }
    });
  }

  // Fill remaining from blue_reasoning blocks if needed
  if (steps.length < 3) {
    const keywords = [
      ['dato', 'enunciado'],
      ['fórmula', 'formula', 'criterio'],
      ['desarrollo', 'paso', 'sustitución', 'aplicación'],
      ['verific', 'cómo'],
    ];
    const labels = ['DATOS', 'FÓRMULA', 'DESARROLLO', 'VERIFICACIÓN'];
    keywords.forEach((kws, i) => {
      if (steps[i]) return; // already filled
      const block = blueBlocks.find(b =>
        kws.some(k => b.title?.toLowerCase().includes(k) || b.content?.toLowerCase().startsWith(k))
      );
      if (block?.content && block.content.length > 10) {
        steps[i] = { label: labels[i], text: block.content };
      }
    });
  }

  const validSteps = steps.filter(s => s && s.text && s.text.length > 4);
  if (!validSteps.length) return null;

  const STEP_COLORS = ['#174de8', '#15803d', '#174de8', '#15803d'];

  return (
    <section style={resolPanel}>
      <div style={resolHeader}>
        <span style={resolIcon}>📐</span>
        <span>Resolución paso a paso</span>
      </div>
      <div style={resolSteps}>
        {validSteps.map((step, i) => (
          <div key={i} style={resolRow}>
            <div style={{ ...resolBadge, background: STEP_COLORS[i % 4], borderColor: STEP_COLORS[i % 4] }}>
              {step.label}
            </div>
            <div style={resolText}>{step.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FormulaCanvas({ formula, subject, elements }: { formula?: FormulaSpec; subject: string; elements: VisualElement[] }) {
  const equation = formula?.equation?.trim();
  const hasFormula = !!equation;

  if (!hasFormula) {
    const primary = elements.find(element => !['comparison_table', 'bar_chart'].includes(element.type));
    return (
      <section style={formulaPanel}>
        <div style={formulaKicker}>{primary?.title || 'Mapa visual del problema'}</div>
        <SubjectCenterSketch subject={subject} element={primary} />
        <div style={greenCheckStrip}>Plumón verde: verifica evidencia, procedimiento y opción.</div>
      </section>
    );
  }

  const reactants = formula?.reactants?.length ? formula.reactants : equation.split(/->|→/)[0]?.split('+').map(s => s.trim()) ?? [];
  const products = formula?.products?.length ? formula.products : equation.split(/->|→/)[1]?.split('+').map(s => s.trim()) ?? [];
  const isChemical = formula?.type?.toLowerCase().includes('chemical') || equation.includes('->') || equation.includes('→');

  if (!isChemical) {
    return (
      <section style={formulaPanel}>
        <div style={formulaKicker}>{formula?.type || 'formula central'}</div>
        <div style={mathEquation}>{equation}</div>
        <FunctionSketch equation={undefined} />
        {!!formula?.steps?.length && (
          <div style={stepsBlock}>
            {formula.steps.slice(0, 5).map((step, index) => (
              <div key={index} style={stepRow}>
                <span style={stepBullet}>{index + 1}</span>
                <span style={stepText}>{step}</span>
              </div>
            ))}
          </div>
        )}
        <div style={greenCheckStrip}>Plumón verde: sustituye, opera por etapas y comprueba la unidad.</div>
      </section>
    );
  }

  return (
    <section style={formulaPanel}>
      <div style={formulaKicker}>{formula?.type || 'formula central'}</div>
      <div style={equationRow}>
        <FormulaGroup label="Antes" items={reactants} />
        <ArrowSvg color="#174de8" width={110} />
        <FormulaGroup label="Despues" items={products} />
      </div>
      {isChemical && (
        <ChemicalMoleculeStrip reactants={reactants} products={products} />
      )}
      {/(function|math|linear|expression)/i.test(formula?.type || '') && (
        <FunctionSketch />
      )}
      <div style={rawEquation}>{equation.replace(/->/g, '→')}</div>
      {!!formula?.steps?.length && (
        <div style={stepsBlock}>
          {formula.steps.slice(0, 5).map((step, index) => (
            <div key={index} style={stepRow}>
              <span style={stepBullet}>{index + 1}</span>
              <span style={stepText}>{step}</span>
            </div>
          ))}
        </div>
      )}
      <div style={greenCheckStrip}>Plumón verde: comprueba que la relación conserva el criterio.</div>
    </section>
  );
}

function DiagramRenderer({ elements }: { elements: VisualElement[] }) {
  const diagrams = elements.filter(e => !['comparison_table', 'bar_chart'].includes(e.type));
  if (!diagrams.length) return null;

  return (
    <section style={diagramGrid}>
      {diagrams.slice(0, 4).map((element, index) => {
        if (element.type === 'equation_flow') {
          return (
            <div key={index} style={diagramCard}>
              <div style={visualTitle}>{element.title || 'Flujo de interpretacion'}</div>
              <FlowArrow labelLeft={element.left_label || 'Inicio'} labelRight={element.right_label || 'Resultado'} />
              {element.caption && <p style={visualCaption}>{element.caption}</p>}
            </div>
          );
        }

        if (element.type === 'geometry_diagram') {
          return (
            <div key={index} style={diagramCard}>
              <div style={visualTitle}>{element.title || 'Figura geometrica'}</div>
              <GeometrySketch element={element} />
              {element.caption && <p style={visualCaption}>{element.caption}</p>}
            </div>
          );
        }

        if (element.type === 'coordinate_plane') {
          return (
            <div key={index} style={diagramCard}>
              <div style={visualTitle}>{element.title || 'Plano cartesiano'}</div>
              <CoordinatePlane points={element.points} />
              {element.caption && <p style={visualCaption}>{element.caption}</p>}
            </div>
          );
        }

        if (element.type === 'number_line') {
          return (
            <div key={index} style={diagramCard}>
              <div style={visualTitle}>{element.title || 'Recta numerica'}</div>
              <NumberLine labels={element.labels?.length ? element.labels : element.items} />
              {element.caption && <p style={visualCaption}>{element.caption}</p>}
            </div>
          );
        }

        if (element.type === 'concept_map') {
          return (
            <div key={index} style={diagramCard}>
              <div style={visualTitle}>{element.title || 'Mapa conceptual'}</div>
              <ConceptMap items={element.items} />
              {element.caption && <p style={visualCaption}>{element.caption}</p>}
            </div>
          );
        }

        if (element.type === 'timeline') {
          return (
            <div key={index} style={diagramCard}>
              <div style={visualTitle}>{element.title || 'Linea de tiempo'}</div>
              <TimelineSketch items={element.items} />
              {element.caption && <p style={visualCaption}>{element.caption}</p>}
            </div>
          );
        }

        if (element.type === 'system_diagram') {
          return (
            <div key={index} style={diagramCard}>
              <div style={visualTitle}>{element.title || 'Sistema visual'}</div>
              <SystemDiagram items={element.items} />
              {element.caption && <p style={visualCaption}>{element.caption}</p>}
            </div>
          );
        }

        return (
          <div key={index} style={diagramCard}>
            <div style={visualTitle}>{element.title || labelForVisual(element.type)}</div>
            <ProcessFlowVisual items={element.items?.length ? element.items : [element.left_label, element.right_label].filter(Boolean) as string[]} />
            {element.caption && <p style={visualCaption}>{element.caption}</p>}
          </div>
        );
      })}
    </section>
  );
}

function ChartRenderer({ elements }: { elements: VisualElement[] }) {
  const tables = elements.filter(e => e.type === 'comparison_table' && e.rows?.length);
  const charts = elements.filter(e => e.type === 'bar_chart' && e.labels?.length && e.values?.length);

  if (!tables.length && !charts.length) return null;

  return (
    <section style={chartGrid}>
      {tables.slice(0, 2).map((table, index) => (
        <div key={`table-${index}`} style={tablePanel}>
          <div style={visualTitle}>{table.title || 'Tabla comparativa'}</div>
          <table style={comparisonTable}>
            {!!table.headers?.length && (
              <thead>
                <tr>
                  {table.headers.map(header => <th key={header} style={thCell}>{header}</th>)}
                </tr>
              </thead>
            )}
            <tbody>
              {table.rows?.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} style={tdCell}>{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {charts.slice(0, 1).map((chart, index) => (
        <div key={`chart-${index}`} style={tablePanel}>
          <div style={visualTitle}>{chart.title || 'Grafico dinamico'}</div>
          <div style={barChart}>
            {chart.labels?.map((label, i) => {
              const value = Number(chart.values?.[i] ?? 0);
              const width = Math.max(8, Math.min(100, value));
              return (
                <div key={label} style={barRow}>
                  <span style={barLabel}>{label}</span>
                  <div style={barTrack}>
                    <div style={{ ...barFill, width: `${width}%` }} />
                  </div>
                  <span style={barValue}>{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function OptionsAnalysisPanel({ options, revealed }: { options: OptionAnalysis[]; revealed: boolean }) {
  if (!options.length) return null;

  return (
    <section style={{ ...optionsPanel, ...fadeIn(revealed) }}>
      <div style={sectionDivider}>
        <span />
        <strong>Analisis de opciones</strong>
        <span />
      </div>
      <div style={optionsGrid}>
        {options.map(option => {
          const tone = toneForStatus(option.status);
          return (
            <article key={option.option} style={{ ...optionCard, borderColor: tone.border, background: tone.background }}>
              <div style={{ ...optionBadge, color: tone.color, borderColor: tone.border }}>{option.option}</div>
              <div style={{ color: tone.color, fontWeight: 700, fontSize: 12 }}>{statusLabel(option.status)}</div>
              <p style={optionReason}>{option.reason}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MetaCognitiveClose({ text, revealed }: { text: string; revealed: boolean }) {
  if (!text) return null;

  return (
    <section style={{ ...closeBox, ...fadeIn(revealed) }}>
      <div style={closeIcon}>?</div>
      <div>
        <div style={closeTitle}>Cierre metacognitivo</div>
        <p style={closeText}>{text}</p>
      </div>
    </section>
  );
}

function AudioExplanationBar({ markers, revealed }: { markers: AudioSyncMarker[]; revealed: boolean }) {
  const normalized = markers.length ? markers.slice(0, 5) : [
    { time_seconds: 0, label: 'Idea clave', section: 'inicio' },
    { time_seconds: 35, label: 'Proceso', section: 'desarrollo' },
    { time_seconds: 80, label: 'Cierre', section: 'metacognicion' },
  ];

  return (
    <section style={{ ...audioBar, ...fadeIn(revealed) }}>
      <div style={audioHeader}>
        <span style={audioDot} />
        <strong>Audio explicativo sincronizado</strong>
      </div>
      <div style={timeline}>
        {normalized.map((marker, index) => (
          <div key={`${marker.label}-${index}`} style={timelineMarker}>
            <span style={timelinePoint} />
            <span style={timelineTime}>{formatTime(marker.time_seconds ?? index * 25)}</span>
            <span style={timelineLabel}>{marker.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ColumnHeader({ color, title }: { color: string; title: string }) {
  return (
    <div style={{ ...columnHeader, borderColor: `${color}66`, color }}>
      <MarkerIcon color={color} />
      <span>{title}</span>
    </div>
  );
}

function ReasoningCard({ block, index, color }: { block: MarkerBlock; index: number; color: string }) {
  return (
    <article style={reasonCard}>
      <div style={{ ...markerStripe, background: color }} />
      <div style={{ ...blockIndex, color }}>{index}.</div>
      <h3 style={{ ...blockHeading, color }}>{block.title}</h3>
      <p style={blockCopy}>{block.content}</p>
      {block.visual_hint && <div style={hintNote}>{block.visual_hint}</div>}
    </article>
  );
}

function TrapCard({ block, index }: { block: MarkerBlock; index: number }) {
  return (
    <article style={trapCard}>
      <div style={trapHeader}>
        <span style={xMark}>x</span>
        <h3 style={trapTitle}>Trampa {index}: {block.title}</h3>
      </div>
      <p style={blockCopy}>{block.content}</p>
      {block.visual_warning && <div style={warningNote}>{block.visual_warning}</div>}
    </article>
  );
}

function FormulaGroup({ label, items }: { label: string; items: string[] }) {
  return (
    <div style={formulaGroup}>
      <div style={formulaItems}>{items.filter(Boolean).join(' + ') || 'Dato'}</div>
      <div style={braceLine} />
      <div style={formulaLabel}>{label}</div>
    </div>
  );
}

// ── Molecule-specific geometry configs ───────────────────────────────────────
type AtomSpec  = { s: string; r: number };
type BondSpec  = [number, number, number?]; // [from, to, order?]
type MolConfig = { atoms: AtomSpec[]; pos: [number, number][]; bonds: BondSpec[] };

const MOL_CONFIGS: Record<string, MolConfig> = {
  CH4:  { atoms:[{s:'C',r:13},{s:'H',r:8},{s:'H',r:8},{s:'H',r:8},{s:'H',r:8}],
           pos:[[46,32],[46,9],[72,46],[20,46],[46,56]], bonds:[[0,1],[0,2],[0,3],[0,4]] },
  O2:   { atoms:[{s:'O',r:12},{s:'O',r:12}],
           pos:[[28,32],[64,32]], bonds:[[0,1,2]] },
  CO2:  { atoms:[{s:'O',r:12},{s:'C',r:13},{s:'O',r:12}],
           pos:[[10,32],[46,32],[82,32]], bonds:[[0,1,2],[1,2,2]] },
  H2O:  { atoms:[{s:'O',r:13},{s:'H',r:9},{s:'H',r:9}],
           pos:[[46,22],[22,50],[70,50]], bonds:[[0,1],[0,2]] },
  N2:   { atoms:[{s:'N',r:12},{s:'N',r:12}], pos:[[28,32],[64,32]], bonds:[[0,1,3]] },
  H2:   { atoms:[{s:'H',r:9},{s:'H',r:9}],   pos:[[28,32],[64,32]], bonds:[[0,1]] },
  HCl:  { atoms:[{s:'H',r:9},{s:'Cl',r:13}], pos:[[24,32],[62,32]], bonds:[[0,1]] },
  NaCl: { atoms:[{s:'Na',r:12},{s:'Cl',r:13}],pos:[[24,32],[62,32]],bonds:[[0,1]] },
  NH3:  { atoms:[{s:'N',r:12},{s:'H',r:9},{s:'H',r:9},{s:'H',r:9}],
           pos:[[46,22],[22,50],[70,50],[46,54]], bonds:[[0,1],[0,2],[0,3]] },
  SO2:  { atoms:[{s:'S',r:13},{s:'O',r:12},{s:'O',r:12}],
           pos:[[46,22],[20,50],[72,50]], bonds:[[0,1,2],[0,2,2]] },
  SO3:  { atoms:[{s:'S',r:13},{s:'O',r:12},{s:'O',r:12},{s:'O',r:12}],
           pos:[[46,32],[16,20],[76,20],[46,58]], bonds:[[0,1,2],[0,2,2],[0,3]] },
  C6H12O6: { atoms:[{s:'C',r:10},{s:'O',r:11},{s:'H',r:7},{s:'H',r:7},{s:'H',r:7}],
              pos:[[46,32],[70,20],[22,20],[70,44],[22,44]], bonds:[[0,1],[0,2],[1,3],[2,4]] },
};

function normalizeMolKey(formula: string): string {
  // Strip leading coefficient like "2H2O" → "H2O"
  return formula.trim().replace(/^\d+/, '');
}

const ATOM_COLORS: Record<string, string> = {
  C:'#1a1a1a', H:'#e8edf3', O:'#dc2626', N:'#2563eb',
  S:'#ca8a04', Cl:'#16a34a', Na:'#ea580c', P:'#9333ea', default:'#94a3b8',
};
const ATOM_HIGHLIGHTS: Record<string, string> = {
  C:'#374151', H:'#f8fafc', O:'#f87171', N:'#60a5fa',
  S:'#fde047', Cl:'#86efac', Na:'#fb923c', P:'#c084fc', default:'#cbd5e1',
};
const ATOM_TEXT: Record<string, string> = {
  C:'#fff', H:'#1e293b', O:'#fff', N:'#fff',
  S:'#1e293b', Cl:'#fff', Na:'#fff', P:'#fff', default:'#fff',
};

function ChemicalMoleculeStrip({ reactants, products }: { reactants: string[]; products: string[] }) {
  return (
    <div style={moleculeStrip}>
      <div style={{ ...moleculeGroup, flexDirection: 'column', gap: 4 }}>
        <div style={moleculeGroupLabel}>REACTIVOS (ANTES)</div>
        <div style={moleculeGroup}>
          {reactants.map(item => <MoleculeGlyph key={item} formula={item} />)}
        </div>
      </div>
      <ArrowSvg color="#15803d" width={88} />
      <div style={{ ...moleculeGroup, flexDirection: 'column', gap: 4 }}>
        <div style={moleculeGroupLabel}>PRODUCTOS (DESPUÉS)</div>
        <div style={moleculeGroup}>
          {products.map(item => <MoleculeGlyph key={item} formula={item} />)}
        </div>
      </div>
    </div>
  );
}

function MoleculeGlyph({ formula }: { formula: string }) {
  const key    = normalizeMolKey(formula);
  const config = MOL_CONFIGS[key];
  const uid    = formula.replace(/[^a-zA-Z0-9]/g, '_');

  if (config) {
    return (
      <div style={moleculeGlyph} title={formula}>
        <div style={moleculeFormula}>{formula}</div>
        <svg width="96" height="72" viewBox="0 0 96 72" aria-hidden="true">
          <defs>
            {config.atoms.map((a, i) => (
              <radialGradient key={i} id={`g_${uid}_${i}`} cx="33%" cy="28%" r="65%">
                <stop offset="0%"   stopColor={ATOM_HIGHLIGHTS[a.s] ?? ATOM_HIGHLIGHTS.default} />
                <stop offset="100%" stopColor={ATOM_COLORS[a.s]    ?? ATOM_COLORS.default} />
              </radialGradient>
            ))}
          </defs>
          {/* Bonds */}
          {config.bonds.map(([a, b, order], i) => {
            const [x1, y1] = config.pos[a];
            const [x2, y2] = config.pos[b];
            const off = order === 2 ? 3 : order === 3 ? 4 : 0;
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#475569" strokeWidth={off ? 1.8 : 2.5} />
                {order === 2 && <line x1={x1} y1={y1 + off} x2={x2} y2={y2 + off} stroke="#475569" strokeWidth="1.8" />}
                {order === 3 && <>
                  <line x1={x1} y1={y1 - off} x2={x2} y2={y2 - off} stroke="#475569" strokeWidth="1.5" />
                  <line x1={x1} y1={y1 + off} x2={x2} y2={y2 + off} stroke="#475569" strokeWidth="1.5" />
                </>}
              </g>
            );
          })}
          {/* Atoms */}
          {config.atoms.map((a, i) => {
            const [cx, cy] = config.pos[i];
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={a.r} fill={`url(#g_${uid}_${i})`} stroke="#0f172a" strokeWidth="1.5" />
                <text x={cx} y={cy + 4} textAnchor="middle"
                  style={{ fill: ATOM_TEXT[a.s] ?? ATOM_TEXT.default, fontSize: a.r > 10 ? 10 : 8, fontWeight: 900, fontFamily: 'inherit' }}>
                  {a.s}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // Generic fallback — parse symbols from formula
  const atoms = atomSymbols(key).slice(0, 5);
  const positions: [number,number][] = [[46,32],[22,14],[70,14],[22,50],[70,50]];
  return (
    <div style={moleculeGlyph} title={formula}>
      <div style={moleculeFormula}>{formula}</div>
      <svg width="96" height="72" viewBox="0 0 96 72" aria-hidden="true">
        <defs>
          {atoms.map((a, i) => (
            <radialGradient key={i} id={`gf_${uid}_${i}`} cx="33%" cy="28%" r="65%">
              <stop offset="0%"   stopColor={ATOM_HIGHLIGHTS[a] ?? ATOM_HIGHLIGHTS.default} />
              <stop offset="100%" stopColor={ATOM_COLORS[a]    ?? ATOM_COLORS.default} />
            </radialGradient>
          ))}
        </defs>
        {atoms.slice(1).map((_, i) => (
          <line key={i}
            x1={positions[0][0]} y1={positions[0][1]}
            x2={positions[i+1][0]} y2={positions[i+1][1]}
            stroke="#475569" strokeWidth="2" />
        ))}
        {atoms.map((a, i) => {
          const [cx, cy] = positions[i];
          const r = i === 0 ? 13 : 9;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} fill={`url(#gf_${uid}_${i})`} stroke="#0f172a" strokeWidth="1.5" />
              <text x={cx} y={cy + 4} textAnchor="middle"
                style={{ fill: ATOM_TEXT[a] ?? ATOM_TEXT.default, fontSize: r > 10 ? 10 : 8, fontWeight: 900, fontFamily: 'inherit' }}>
                {a}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FunctionSketch({ equation }: { equation?: string }) {
  return (
    <div style={functionSketch}>
      {equation && (
        <div style={{ fontFamily: '"Comic Sans MS","Segoe Print",sans-serif', fontSize: 18, fontWeight: 900, color: '#174de8', marginBottom: 6 }}>
          {equation}
        </div>
      )}
      <svg width="260" height="116" viewBox="0 0 260 116" aria-hidden="true">
        {/* Grid lines */}
        {[1,2,3,4].map(i => (
          <path key={`h${i}`} d={`M38 ${100-i*18} H238`} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {[1,2,3,4].map(i => (
          <path key={`v${i}`} d={`M${48+i*42} 12 V100`} stroke="#e2e8f0" strokeWidth="1" />
        ))}
        {/* Axes */}
        <path d="M38 100 H242" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M48 108 V10"  stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
        {/* Curve */}
        <path d="M52 94 C90 80 128 60 200 22" stroke="#174de8" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* Point */}
        <circle cx="148" cy="50" r="7" fill="#15803d" stroke="#fff" strokeWidth="2" />
        <path d="M148 50 V100" stroke="#15803d" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M48 50 H148" stroke="#c5141b" strokeWidth="2" strokeDasharray="4 4" />
        {/* Axis labels */}
        <text x="244" y="104" style={{...svgDarkText, fontSize:13}}>x</text>
        <text x="32"  y="14"  style={{...svgDarkText, fontSize:13}}>y</text>
        {/* Arrow heads */}
        <path d="M238 95 L244 100 L238 105" stroke="#334155" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M43 14 L48 8 L53 14" stroke="#334155" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function SubjectCenterSketch({ subject, element }: { subject: string; element?: VisualElement }) {
  const visualType = element?.type || visualTypeForSubject(subject);
  const items = element?.items?.length ? element.items : defaultItemsForSubject(subject);
  const shape = element?.shape || shapeForSubject(subject);

  if (visualType === 'geometry_diagram') {
    const geo: VisualElement = element || { type: visualType, shape, items, labels: items };
    return <GeometrySketch element={geo} large />;
  }
  if (visualType === 'coordinate_plane') return <CoordinatePlane points={element?.points} large />;
  if (visualType === 'number_line') return <NumberLine labels={element?.labels?.length ? element.labels : items} large />;
  if (visualType === 'concept_map') return <ConceptMap items={items} large />;
  if (visualType === 'timeline') return <TimelineSketch items={items} large />;
  if (visualType === 'system_diagram') return <SystemDiagram items={items} large />;

  return (
    <div style={centerSketch}>
      <div style={centerSubject}>{subject}</div>
      <ProcessFlowVisual items={items} large />
    </div>
  );
}

// Renders a colored label box WITH text, directly on the SVG (marker-on-board style)
function SvgLabel({ text, x, y, color, bg, fs = 12 }: {
  text: string; x: number; y: number; color: string; bg: string; fs?: number;
}) {
  const w = Math.max(32, text.length * (fs * 0.68) + 10);
  return (
    <g>
      <rect x={x - w / 2} y={y - fs - 2} width={w} height={fs + 8} rx={5} fill={bg} />
      <text x={x} y={y} textAnchor="middle"
        style={{ fill: color, fontSize: fs, fontWeight: 900, fontFamily: '"Comic Sans MS","Segoe Print",sans-serif' }}>
        {text}
      </text>
    </g>
  );
}

function GeometrySketch({ element, large = false }: { element: VisualElement; large?: boolean }) {
  const shape  = (element.shape || 'triangle').toLowerCase();
  const labels = element.labels?.length ? element.labels : element.items?.length ? element.items : [];
  const l0 = labels[0] || '';
  const l1 = labels[1] || '';
  const l2 = labels[2] || '';
  const fs = large ? 14 : 12;
  const W  = large ? 430 : 270;
  const H  = large ? 180 : 136;

  const isTriangle = shape === 'triangle' || !['circle', 'rectangle', 'solid'].includes(shape);

  // Triangle geometry (pre-computed)
  const tbx1  = large ? 68 : 36;
  const tbx2  = large ? 362 : 234;
  const tby   = H - 22;
  const tapex = H - (large ? 148 : 110);
  const tmx   = W / 2;

  // Rectangle geometry
  const rrx = large ? 70 : 42;
  const rry = large ? 26 : 20;
  const rrw = large ? 290 : 186;
  const rrh = large ? 110 : 84;

  // Circle geometry
  const ccx = W / 2;
  const ccy = H / 2;
  const ccr = large ? 62 : 46;

  // Solid (3-D box) paths
  const sfront = large ? 'M116 52 H286 V140 H116 Z' : 'M58 38 H164 V96 H58 Z';
  const stop   = large ? 'M116 52 L156 24 H326 L286 52 Z' : 'M58 38 L90 16 H196 L164 38 Z';
  const sside  = large ? 'M286 52 L326 24 V112 L286 140 Z' : 'M164 38 L196 16 V74 L164 96 Z';

  return (
    <div style={large ? centerSketch : sketchFrame}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">

        {/* ── TRIANGLE ──────────────────────────────────────── */}
        {isTriangle && (
          <>
            <path d={`M${tbx1} ${tby} L${tmx} ${tapex} L${tbx2} ${tby} Z`}
              fill="rgba(23,77,232,0.07)" stroke="#174de8" strokeWidth={large ? 4 : 3.5} strokeLinejoin="round" />
            <path d={`M${tmx} ${tapex} V${tby}`} stroke="#c5141b" strokeWidth="2.5" strokeDasharray="7 5" />
            <path d={`M${tbx1 + 20} ${tby} Q${tbx1 + 24} ${tby - 18} ${tbx1 + 36} ${tby - 13}`} stroke="#c5141b" strokeWidth="2" fill="none" />
            {l0 && <SvgLabel text={l0} x={tmx} y={tby + 2} color="#15803d" bg="rgba(21,128,61,0.15)" fs={fs} />}
            {l1 && <SvgLabel text={l1} x={tmx + (large ? 46 : 34)} y={Math.round((tapex + tby) / 2)} color="#b91c1c" bg="rgba(197,20,27,0.12)" fs={fs} />}
            {l2 && <SvgLabel text={l2} x={tbx1 + (large ? 54 : 40)} y={tby - (large ? 26 : 20)} color="#174de8" bg="rgba(23,77,232,0.12)" fs={fs - 1} />}
          </>
        )}

        {/* ── RECTANGLE ─────────────────────────────────────── */}
        {shape === 'rectangle' && (
          <>
            <rect x={rrx} y={rry} width={rrw} height={rrh} rx="3"
              fill="rgba(23,77,232,0.06)" stroke="#174de8" strokeWidth={large ? 4 : 3.5} />
            <path d={`M${rrx} ${rry + rrh + 4} H${rrx + rrw}`} stroke="#15803d" strokeWidth="3" />
            <path d={`M${rrx + rrw + 4} ${rry} V${rry + rrh}`} stroke="#c5141b" strokeWidth="3" />
            {l0 && <SvgLabel text={l0} x={rrx + rrw / 2} y={rry + rrh + 18} color="#15803d" bg="rgba(21,128,61,0.15)" fs={fs} />}
            {l1 && <SvgLabel text={l1} x={rrx + rrw + (large ? 32 : 26)} y={rry + rrh / 2} color="#b91c1c" bg="rgba(197,20,27,0.12)" fs={fs} />}
            {l2 && <SvgLabel text={l2} x={rrx + rrw / 2} y={rry + rrh / 2 + 6} color="#174de8" bg="rgba(23,77,232,0.12)" fs={fs} />}
          </>
        )}

        {/* ── CIRCLE ────────────────────────────────────────── */}
        {shape === 'circle' && (
          <>
            <circle cx={ccx} cy={ccy} r={ccr} fill="rgba(23,77,232,0.06)" stroke="#174de8" strokeWidth={large ? 4 : 3.5} />
            <path d={`M${ccx} ${ccy} H${ccx + ccr}`} stroke="#c5141b" strokeWidth="3" />
            <path d={`M${ccx - ccr} ${ccy} H${ccx + ccr}`} stroke="#15803d" strokeWidth="2.5" strokeDasharray="5 4" />
            {l0 && <SvgLabel text={l0} x={ccx + ccr / 2} y={ccy - 10} color="#b91c1c" bg="rgba(197,20,27,0.12)" fs={fs} />}
            {l1 && <SvgLabel text={l1} x={ccx} y={ccy + (large ? 82 : 60)} color="#15803d" bg="rgba(21,128,61,0.15)" fs={fs} />}
            {l2 && <SvgLabel text={l2} x={ccx} y={ccy + 8} color="#174de8" bg="rgba(23,77,232,0.12)" fs={fs} />}
          </>
        )}

        {/* ── SOLID (3-D box) ───────────────────────────────── */}
        {shape === 'solid' && (
          <>
            <path d={sfront} fill="rgba(23,77,232,0.07)" stroke="#174de8" strokeWidth="3" />
            <path d={stop}   fill="rgba(23,77,232,0.12)" stroke="#174de8" strokeWidth="3" />
            <path d={sside}  fill="rgba(23,77,232,0.10)" stroke="#174de8" strokeWidth="3" />
            {l0 && <SvgLabel text={l0} x={large ? 200 : 110} y={large ? 152 : 108} color="#15803d" bg="rgba(21,128,61,0.15)" fs={fs} />}
            {l1 && <SvgLabel text={l1} x={large ? 320 : 174} y={large ? 80 : 56} color="#b91c1c" bg="rgba(197,20,27,0.12)" fs={fs} />}
            {l2 && <SvgLabel text={l2} x={large ? 200 : 110} y={large ? 96 : 68} color="#174de8" bg="rgba(23,77,232,0.12)" fs={fs} />}
          </>
        )}

      </svg>
      {element.caption && <p style={visualCaption}>{element.caption}</p>}
    </div>
  );
}

function CoordinatePlane({ points, large = false }: { points?: Array<Record<string, string | number>>; large?: boolean }) {
  const width = large ? 430 : 250;
  const height = large ? 170 : 124;
  const normalized = (points?.length ? points : [{ x: -2, y: 1 }, { x: 0, y: 2 }, { x: 2, y: 4 }]).slice(0, 5);
  const toX = (x: string | number) => width / 2 + Number(x || 0) * (large ? 42 : 25);
  const toY = (y: string | number) => height - 34 - Number(y || 0) * (large ? 18 : 12);
  const path = normalized.map((point, index) => `${index === 0 ? 'M' : 'L'}${toX(point.x)} ${toY(point.y)}`).join(' ');

  return (
    <div style={large ? centerSketch : sketchFrame}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <path key={`v-${i}`} d={`M${34 + i * ((width - 68) / 7)} 16 V${height - 22}`} stroke="#cbd5e1" strokeWidth="1" />
        ))}
        {Array.from({ length: 5 }).map((_, i) => (
          <path key={`h-${i}`} d={`M28 ${22 + i * ((height - 48) / 4)} H${width - 24}`} stroke="#cbd5e1" strokeWidth="1" />
        ))}
        <path d={`M28 ${height - 34} H${width - 20}`} stroke="#111827" strokeWidth="2" />
        <path d={`M${width / 2} ${height - 18} V16`} stroke="#111827" strokeWidth="2" />
        <path d={path} stroke="#174de8" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {normalized.map((point, index) => (
          <circle key={index} cx={toX(point.x)} cy={toY(point.y)} r={large ? 6 : 4} fill={index === normalized.length - 1 ? '#15803d' : '#c5141b'} />
        ))}
        <text x={width - 28} y={height - 40} style={svgDarkText}>x</text>
        <text x={width / 2 + 8} y="24" style={svgDarkText}>y</text>
      </svg>
    </div>
  );
}

function NumberLine({ labels, large = false }: { labels?: string[]; large?: boolean }) {
  const ticks = (labels?.length ? labels : ['dato', 'operacion', 'resultado']).slice(0, 5);
  const width = large ? 430 : 250;
  const height = large ? 132 : 96;
  const start = 32;
  const end = width - 32;

  return (
    <div style={large ? centerSketch : sketchFrame}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <path d={`M${start} ${height / 2} H${end}`} stroke="#174de8" strokeWidth="4" strokeLinecap="round" />
        <path d={`M${end - 12} ${height / 2 - 9} L${end} ${height / 2} L${end - 12} ${height / 2 + 9}`} stroke="#174de8" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {ticks.map((label, index) => {
          const x = start + index * ((end - start) / Math.max(1, ticks.length - 1));
          return (
            <g key={`${label}-${index}`}>
              <path d={`M${x} ${height / 2 - 16} V${height / 2 + 16}`} stroke={index === ticks.length - 1 ? '#15803d' : '#c5141b'} strokeWidth="3" />
              <text x={x} y={height / 2 + 36} textAnchor="middle" style={index === ticks.length - 1 ? svgGreenText : svgRedText}>{shortLabel(label, 12)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ConceptMap({ items, large = false }: { items?: string[]; large?: boolean }) {
  const nodes = (items?.length ? items : ['idea central', 'evidencia', 'criterio', 'respuesta']).slice(0, 5);
  const width = large ? 430 : 250;
  const height = large ? 170 : 124;
  const branches = nodes.slice(1, 5);
  const positions = large
    ? [[70, 44], [356, 44], [84, 136], [346, 136]]
    : [[48, 32], [202, 32], [58, 98], [192, 98]];

  return (
    <div style={large ? centerSketch : sketchFrame}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {branches.map((branch, index) => {
          const [x, y] = positions[index];
          return <path key={branch} d={`M${width / 2} ${height / 2} L${x} ${y}`} stroke="#174de8" strokeWidth="2.5" strokeLinecap="round" />;
        })}
        <rect x={width / 2 - 66} y={height / 2 - 22} width="132" height="44" rx="12" fill="rgba(21,128,61,0.1)" stroke="#15803d" strokeWidth="2" />
        <text x={width / 2} y={height / 2 + 5} textAnchor="middle" style={svgGreenText}>{shortLabel(nodes[0], 16)}</text>
        {branches.map((branch, index) => {
          const [x, y] = positions[index];
          return (
            <g key={`${branch}-${index}`}>
              <rect x={x - 48} y={y - 16} width="96" height="32" rx="10" fill="rgba(255,255,255,0.72)" stroke={index % 2 ? '#c5141b' : '#174de8'} strokeWidth="2" />
              <text x={x} y={y + 4} textAnchor="middle" style={index % 2 ? svgRedText : svgBlueText}>{shortLabel(branch, 13)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TimelineSketch({ items, large = false }: { items?: string[]; large?: boolean }) {
  const steps = (items?.length ? items : ['contexto', 'causa', 'proceso', 'consecuencia']).slice(0, 5);
  return (
    <div style={large ? centerSketch : sketchFrame}>
      <div style={visualTimeline}>
        {steps.map((step, index) => (
          <React.Fragment key={`${step}-${index}`}>
            <div style={timelineNode}>
              <span style={{ ...timelineNodeDot, background: index === steps.length - 1 ? '#15803d' : '#174de8' }} />
              <span>{shortLabel(step, large ? 16 : 12)}</span>
            </div>
            {index < steps.length - 1 && <ArrowSvg color={index === steps.length - 2 ? '#15803d' : '#c5141b'} width={large ? 54 : 34} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function SystemDiagram({ items, large = false }: { items?: string[]; large?: boolean }) {
  const steps = (items?.length ? items : ['entrada', 'proceso', 'salida', 'evidencia']).slice(0, 4);
  return (
    <div style={large ? centerSketch : sketchFrame}>
      <div style={systemVisual}>
        <svg width={large ? 126 : 84} height={large ? 126 : 84} viewBox="0 0 126 126" aria-hidden="true">
          <circle cx="63" cy="63" r="38" fill="rgba(23,77,232,0.07)" stroke="#174de8" strokeWidth="4" />
          <path d="M22 64 H6 M120 64 H104 M64 22 V6 M64 120 V104" stroke="#c5141b" strokeWidth="4" strokeLinecap="round" />
          <path d="M40 68 C50 46 80 46 88 68 C78 58 52 58 40 68Z" fill="rgba(21,128,61,0.18)" stroke="#15803d" strokeWidth="3" />
        </svg>
        <ProcessFlowVisual items={steps} large={large} />
      </div>
    </div>
  );
}

function ProcessFlowVisual({ items, large = false }: { items?: string[]; large?: boolean }) {
  const nodes = (items?.length ? items : ['leer', 'criterio', 'verificar']).slice(0, 5);
  return (
    <div style={large ? largeProcessFlow : processFlow}>
      {nodes.map((item, itemIndex) => (
        <React.Fragment key={`${item}-${itemIndex}`}>
          <span style={large ? largeProcessNode : processNode}>{item}</span>
          {itemIndex < nodes.length - 1 && <ArrowSvg color={itemIndex === nodes.length - 2 ? '#15803d' : '#174de8'} width={large ? 58 : 46} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function FlowArrow({ labelLeft, labelRight }: { labelLeft?: string; labelRight?: string }) {
  return (
    <div style={flowArrow}>
      <span style={flowLabel}>{labelLeft}</span>
      <ArrowSvg color="#174de8" width={120} />
      <span style={flowLabel}>{labelRight}</span>
    </div>
  );
}

function ArrowSvg({ color, width = 80 }: { color: string; width?: number }) {
  return (
    <svg width={width} height="28" viewBox={`0 0 ${width} 28`} fill="none" aria-hidden="true">
      <path d={`M4 14 H${width - 18}`} stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d={`M${width - 20} 6 L${width - 6} 14 L${width - 20} 22`} stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarkerIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 17.5 14.8 6.7l2.5 2.5L6.5 20H4v-2.5Z" fill={color} opacity="0.9" />
      <path d="m16 5.5 1.2-1.2a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2L18.5 8 16 5.5Z" fill={color} />
    </svg>
  );
}

function BrainMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="36" height="36" rx="12" stroke="#174de8" strokeWidth="1.4" />
      <path d="M17 14c-3 0-5 2.1-5 4.8 0 1.2.4 2.3 1.2 3.1A5.2 5.2 0 0 0 12 25.5C12 28.5 14.4 31 17.4 31H20V14h-3Z" stroke="#174de8" strokeWidth="1.5" />
      <path d="M27 14c3 0 5 2.1 5 4.8 0 1.2-.4 2.3-1.2 3.1a5.2 5.2 0 0 1 1.2 3.6c0 3-2.4 5.5-5.4 5.5H24V14h3Z" stroke="#174de8" strokeWidth="1.5" />
      <path d="M17 20h3M24 20h3M17 25h3M24 25h3" stroke="#174de8" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function sortBlocks(blocks?: MarkerBlock[]) {
  return [...(blocks ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function fadeIn(show: boolean): React.CSSProperties {
  return {
    opacity: show ? 1 : 0,
    transform: show ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity 0.55s ease, transform 0.55s ease',
  };
}

function toneForStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('correct')) {
    return { color: '#166534', border: 'rgba(22,101,52,0.45)', background: 'rgba(22,163,74,0.09)' };
  }
  if (normalized.includes('review') || normalized.includes('analiz') || normalized.includes('verificar')) {
    return { color: '#174de8', border: 'rgba(23,77,232,0.42)', background: 'rgba(23,77,232,0.07)' };
  }
  if (normalized.includes('partial') || normalized.includes('plausible')) {
    return { color: '#92400e', border: 'rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.08)' };
  }
  return { color: '#b91c1c', border: 'rgba(185,28,28,0.42)', background: 'rgba(239,68,68,0.07)' };
}

function statusLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes('correct')) return 'Correcta';
  if (normalized.includes('review') || normalized.includes('analiz') || normalized.includes('verificar')) return 'Verificar';
  if (normalized.includes('partial')) return 'Parcial';
  if (normalized.includes('plausible')) return 'Plausible';
  return 'Incorrecta';
}

function labelForVisual(type: string) {
  return type.replace(/_/g, ' ');
}

function visualTypeForSubject(subject: string) {
  const normalized = normalizeText(subject);
  if (normalized.includes('geometr')) return 'geometry_diagram';
  if (normalized.includes('quim')) return 'system_diagram';
  if (normalized.includes('fisic') || normalized.includes('biolog')) return 'system_diagram';
  if (normalized.includes('lectura')) return 'concept_map';
  if (normalized.includes('ingles')) return 'process_flow';
  if (normalized.includes('social')) return 'timeline';
  return 'coordinate_plane';
}

function defaultItemsForSubject(subject: string) {
  const normalized = normalizeText(subject);
  if (normalized.includes('geometr')) return ['figura', 'medidas', 'formula', 'unidad'];
  if (normalized.includes('quim')) return ['sustancias', 'transformacion', 'productos', 'evidencia'];
  if (normalized.includes('fisic')) return ['magnitud', 'unidad', 'formula', 'sentido'];
  if (normalized.includes('biolog')) return ['sistema', 'proceso', 'efecto', 'evidencia'];
  if (normalized.includes('lectura')) return ['tema', 'pista textual', 'inferencia', 'respuesta'];
  if (normalized.includes('ingles')) return ['contexto', 'verbo', 'conector', 'coherencia'];
  if (normalized.includes('social')) return ['contexto', 'causa', 'proceso', 'consecuencia'];
  return ['dato', 'regla', 'procedimiento', 'verificacion'];
}

function shapeForSubject(subject: string) {
  return normalizeText(subject).includes('geometr') ? 'triangle' : 'rectangle';
}

function normalizeText(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function shortLabel(text: string, maxLength: number) {
  const clean = String(text || '').trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, maxLength - 1).trim()}…`;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function atomSymbols(formula: string) {
  const clean = formula.replace(/^\d+/, '');
  const symbols = clean.match(/[A-Z][a-z]?/g) ?? [clean || 'X'];
  return symbols.length ? symbols : ['X'];
}

function atomColor(atom: string) {
  const colors: Record<string, string> = {
    C: '#111827',
    H: '#f8fafc',
    O: '#dc2626',
    N: '#2563eb',
    S: '#facc15',
    Cl: '#22c55e',
  };
  return colors[atom] || '#94a3b8';
}

const boardShell: React.CSSProperties = {
  position: 'relative',
  minWidth: 1260,
  background: [
    'radial-gradient(circle at 16% 8%, rgba(255,255,255,0.98), transparent 15%)',
    'radial-gradient(circle at 48% 2%, rgba(255,255,255,0.95), transparent 13%)',
    'radial-gradient(circle at 78% 7%, rgba(255,255,255,0.86), transparent 14%)',
    'linear-gradient(145deg, #fbfcff 0%, #f4f7fb 42%, #e8edf4 100%)',
  ].join(','),
  color: '#111827',
  border: '8px solid rgba(15,23,42,0.78)',
  borderRadius: 20,
  padding: '22px 26px 34px',
  marginBottom: 14,
  overflow: 'hidden',
  boxShadow: '0 30px 90px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.96), inset 0 -8px 22px rgba(15,23,42,0.12)',
  fontFamily: '"Comic Sans MS", "Segoe Print", "Trebuchet MS", system-ui, sans-serif',
};

const topGlow: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 24,
  right: 24,
  height: 70,
  background: 'radial-gradient(circle at 20% 0%, rgba(255,255,255,0.95), transparent 28%), radial-gradient(circle at 54% 0%, rgba(255,255,255,0.75), transparent 18%), radial-gradient(circle at 82% 0%, rgba(255,255,255,0.72), transparent 18%)',
  pointerEvents: 'none',
};

const leftGlow: React.CSSProperties = {
  position: 'absolute',
  inset: 8,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.9)',
  boxShadow: 'inset 0 0 38px rgba(255,255,255,0.48), inset 0 -18px 26px rgba(15,23,42,0.08)',
  pointerEvents: 'none',
};

const screw: React.CSSProperties = {
  position: 'absolute',
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 35% 30%, #ffffff, #9ca3af 42%, #111827 78%)',
  boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.8), 0 2px 5px rgba(0,0,0,0.35)',
  zIndex: 4,
};

const header: React.CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '300px 1fr 170px',
  gap: 14,
  alignItems: 'center',
  paddingBottom: 14,
  borderBottom: '2px solid rgba(23,77,232,0.55)',
};

const brandCluster: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const modeText: React.CSSProperties = { color: '#174de8', fontSize: 18, fontWeight: 800, letterSpacing: 0, textTransform: 'uppercase' };
const subText: React.CSSProperties = { color: '#111827', fontSize: 12, marginTop: 3 };
const titleBlock: React.CSSProperties = { textAlign: 'center', minWidth: 0 };
const subjectText: React.CSSProperties = { color: '#174de8', fontSize: 13, fontWeight: 800, textTransform: 'uppercase' };
const boardTitle: React.CSSProperties = { margin: 0, color: '#111827', fontSize: 30, lineHeight: 1.1, letterSpacing: 0, textTransform: 'uppercase' };
const levelBadge: React.CSSProperties = {
  justifySelf: 'end',
  border: '1px solid rgba(15,23,42,0.65)',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 11,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  alignItems: 'center',
  background: 'rgba(255,255,255,0.38)',
};

const boardSurface: React.CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: '340px minmax(460px, 1fr) 340px',
  gap: 16,
  paddingTop: 18,
};

const sideColumn: React.CSSProperties = {
  borderRadius: 12,
  padding: 14,
  minHeight: 420,
  background: 'rgba(255,255,255,0.48)',
  backdropFilter: 'blur(10px)',
};

const blueColumn: React.CSSProperties = { border: '1px solid rgba(23,77,232,0.52)' };
const redColumn: React.CSSProperties = { border: '1px solid rgba(197,20,27,0.46)' };

const columnHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingBottom: 8,
  marginBottom: 10,
  borderBottom: '1.5px solid',
  fontSize: 15,
  fontWeight: 900,
  textTransform: 'uppercase',
};

const reasonCard: React.CSSProperties = {
  position: 'relative',
  padding: '12px 12px 13px 16px',
  borderBottom: '1px dashed rgba(23,77,232,0.3)',
};

const trapCard: React.CSSProperties = {
  padding: '12px 13px',
  border: '1px solid rgba(197,20,27,0.42)',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.55)',
  marginBottom: 10,
};

const markerStripe: React.CSSProperties = { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 4 };
const blockIndex: React.CSSProperties = { fontSize: 14, fontWeight: 900, marginBottom: 4 };
const blockHeading: React.CSSProperties = { fontSize: 15, fontWeight: 900, margin: '0 0 6px', textTransform: 'uppercase', lineHeight: 1.25 };
const blockCopy: React.CSSProperties = { margin: 0, color: '#111827', fontSize: 15, lineHeight: 1.6 };
const hintNote: React.CSSProperties = { marginTop: 8, padding: '7px 9px', borderRadius: 8, background: 'rgba(23,77,232,0.08)', color: '#174de8', fontSize: 12, fontWeight: 700 };
const warningNote: React.CSSProperties = { marginTop: 8, padding: '7px 9px', borderRadius: 8, background: 'rgba(197,20,27,0.08)', color: '#b91c1c', fontSize: 12, fontWeight: 700 };
const trapHeader: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 };
const xMark: React.CSSProperties = { color: '#c5141b', fontSize: 18, fontWeight: 900 };
const trapTitle: React.CSSProperties = { margin: 0, color: '#c5141b', fontSize: 13, fontWeight: 900 };

const centerStage: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 };

const formulaPanel: React.CSSProperties = {
  borderRadius: 14,
  padding: '22px 20px',
  minHeight: 230,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.72), rgba(255,255,255,0.36))',
  border: '1.5px solid rgba(23,77,232,0.3)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 10px 28px rgba(15,23,42,0.08)',
  textAlign: 'center',
};

const formulaKicker: React.CSSProperties = { color: '#174de8', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 };
const equationRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 };
const formulaGroup: React.CSSProperties = { minWidth: 0 };
const formulaItems: React.CSSProperties = { color: '#111827', fontSize: 44, fontWeight: 700, lineHeight: 1.15, wordBreak: 'break-word' };
const braceLine: React.CSSProperties = { height: 8, borderLeft: '2px solid #174de8', borderRight: '2px solid #174de8', borderBottom: '2px solid #174de8', borderRadius: '0 0 18px 18px', margin: '7px 10px 0' };
const formulaLabel: React.CSSProperties = { color: '#174de8', fontSize: 17, fontWeight: 900, textTransform: 'uppercase', marginTop: 4 };
const rawEquation: React.CSSProperties = { marginTop: 14, color: '#111827', fontSize: 24, fontWeight: 900 };
const mathEquation: React.CSSProperties = { color: '#111827', fontSize: 42, lineHeight: 1.15, fontWeight: 900, wordBreak: 'break-word', marginBottom: 8 };
const formulaSteps: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12, color: '#174de8', fontSize: 12, fontWeight: 700 };
const stepsBlock: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, margin: '14px 0', textAlign: 'left', background: 'rgba(23,77,232,0.04)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(23,77,232,0.18)' };
const stepRow: React.CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10 };
const stepBullet: React.CSSProperties = { flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#174de8', color: '#fff', fontSize: 12, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const stepText: React.CSSProperties = { color: '#111827', fontSize: 14, fontWeight: 700, lineHeight: 1.45, paddingTop: 2 };
const greenCheckStrip: React.CSSProperties = { display: 'inline-flex', marginTop: 14, color: '#15803d', border: '1px solid rgba(21,128,61,0.42)', background: 'rgba(22,163,74,0.09)', borderRadius: 10, padding: '7px 12px', fontSize: 13, fontWeight: 900 };
const moleculeStrip: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginTop: 16 };
const moleculeGroup: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' };
const moleculeGroupLabel: React.CSSProperties = { textAlign: 'center', fontSize: 11, fontWeight: 900, color: '#174de8', textTransform: 'uppercase', letterSpacing: 0.4 };
const moleculeGlyph: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 };
const moleculeFormula: React.CSSProperties = { color: '#111827', fontSize: 13, fontWeight: 900 };
const functionSketch: React.CSSProperties = { display: 'flex', justifyContent: 'center', marginTop: 14, border: '1px solid rgba(21,128,61,0.3)', borderRadius: 12, background: 'rgba(255,255,255,0.48)', padding: 8 };

const diagramGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 };
const diagramCard: React.CSSProperties = { border: '1px solid rgba(23,77,232,0.3)', borderRadius: 12, padding: 13, background: 'rgba(255,255,255,0.52)' };
const visualTitle: React.CSSProperties = { color: '#174de8', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', marginBottom: 8 };
const visualCaption: React.CSSProperties = { margin: '8px 0 0', color: '#15803d', fontSize: 11, fontWeight: 800, textAlign: 'center', lineHeight: 1.35 };
const flowArrow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 };
const flowLabel: React.CSSProperties = { border: '1px solid rgba(23,77,232,0.45)', color: '#174de8', borderRadius: 8, padding: '8px 10px', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', background: 'rgba(255,255,255,0.35)' };
const processFlow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' };
const processNode: React.CSSProperties = { border: '1px solid rgba(23,77,232,0.35)', color: '#111827', borderRadius: 999, padding: '7px 10px', fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.38)' };
const largeProcessFlow: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', minHeight: 68 };
const largeProcessNode: React.CSSProperties = { border: '2px solid rgba(23,77,232,0.45)', color: '#111827', borderRadius: 12, padding: '10px 13px', fontSize: 14, fontWeight: 900, background: 'rgba(255,255,255,0.58)', boxShadow: '0 5px 12px rgba(15,23,42,0.08)' };
const centerSketch: React.CSSProperties = { minHeight: 172, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 };
const centerSubject: React.CSSProperties = { color: '#111827', fontSize: 34, fontWeight: 900, textTransform: 'uppercase' };
const sketchFrame: React.CSSProperties = { minHeight: 128, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5 };
const sketchLabels: React.CSSProperties = { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 6, color: '#174de8', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' };
const systemVisual: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' };
const visualTimeline: React.CSSProperties = { minHeight: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' };
const timelineNode: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(23,77,232,0.34)', borderRadius: 999, padding: '7px 9px', background: 'rgba(255,255,255,0.55)', color: '#111827', fontSize: 12, fontWeight: 850 };
const timelineNodeDot: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 };
const svgBlueText: React.CSSProperties = { fill: '#174de8', fontSize: 11, fontWeight: 900, fontFamily: 'inherit' };
const svgRedText: React.CSSProperties = { fill: '#c5141b', fontSize: 11, fontWeight: 900, fontFamily: 'inherit' };
const svgGreenText: React.CSSProperties = { fill: '#15803d', fontSize: 11, fontWeight: 900, fontFamily: 'inherit' };
const svgDarkText: React.CSSProperties = { fill: '#111827', fontSize: 12, fontWeight: 900, fontFamily: 'inherit' };

const chartGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 };
const tablePanel: React.CSSProperties = { border: '1px solid rgba(23,77,232,0.34)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.58)' };
const comparisonTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const thCell: React.CSSProperties = { border: '1px solid rgba(23,77,232,0.28)', padding: '8px 8px', color: '#174de8', fontWeight: 900, background: 'rgba(23,77,232,0.06)' };
const tdCell: React.CSSProperties = { border: '1px solid rgba(23,77,232,0.25)', padding: '8px 8px', color: '#111827', textAlign: 'center', fontWeight: 650, fontSize: 13 };
const barChart: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const barRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '70px 1fr 38px', gap: 8, alignItems: 'center' };
const barLabel: React.CSSProperties = { color: '#111827', fontSize: 11, fontWeight: 800 };
const barTrack: React.CSSProperties = { height: 9, borderRadius: 999, overflow: 'hidden', background: 'rgba(15,23,42,0.12)' };
const barFill: React.CSSProperties = { height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#174de8,#38bdf8)' };
const barValue: React.CSSProperties = { color: '#174de8', fontSize: 11, fontWeight: 900, textAlign: 'right' };

const optionsPanel: React.CSSProperties = { marginTop: 12 };
const sectionDivider: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', color: '#174de8', fontSize: 13, fontWeight: 900, textTransform: 'uppercase' };
const optionsGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 10 };
const optionCard: React.CSSProperties = { position: 'relative', border: '1px solid', borderRadius: 12, padding: '28px 12px 12px', minHeight: 128, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)' };
const optionBadge: React.CSSProperties = { position: 'absolute', top: 9, left: 10, width: 24, height: 24, borderRadius: '50%', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 };
const optionReason: React.CSSProperties = { margin: '8px 0 0', color: '#111827', fontSize: 12, lineHeight: 1.45 };

const bottomBand: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 12, marginTop: 14 };
const closeBox: React.CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid rgba(21,128,61,0.4)', borderRadius: 12, padding: 12, background: 'rgba(22,163,74,0.08)' };
const closeIcon: React.CSSProperties = { width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(21,128,61,0.55)', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, flexShrink: 0 };
const closeTitle: React.CSSProperties = { color: '#15803d', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', marginBottom: 4 };
const closeText: React.CSSProperties = { margin: 0, color: '#111827', fontSize: 13, lineHeight: 1.5 };
const audioBar: React.CSSProperties = { border: '1px solid rgba(124,58,237,0.28)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.25)' };
const audioHeader: React.CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', color: '#6d28d9', fontSize: 12, textTransform: 'uppercase', marginBottom: 10 };
const audioDot: React.CSSProperties = { width: 9, height: 9, borderRadius: '50%', background: '#7c3aed', boxShadow: '0 0 10px rgba(124,58,237,0.8)' };
const timeline: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 };
const timelineMarker: React.CSSProperties = { display: 'grid', gridTemplateColumns: '10px auto', columnGap: 6, rowGap: 2, alignItems: 'center' };
const timelinePoint: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: '#7c3aed' };
const timelineTime: React.CSSProperties = { color: '#6d28d9', fontSize: 11, fontWeight: 900 };
const timelineLabel: React.CSSProperties = { gridColumn: '2', color: '#111827', fontSize: 11, lineHeight: 1.2 };
const markerTray: React.CSSProperties = { position: 'absolute', left: '50%', bottom: 5, transform: 'translateX(-50%)', display: 'flex', gap: 7, alignItems: 'center' };

// ── ResolutionPanel — marker-on-board style ───────────────────────────────
const resolPanel: React.CSSProperties = {
  border: '3px solid #174de8',
  borderRadius: 12,
  padding: '14px 16px',
  background: 'rgba(255,255,255,0.55)',
  boxShadow: '0 2px 12px rgba(23,77,232,0.13), inset 0 1px 0 rgba(255,255,255,0.9)',
  marginBottom: 4,
  fontFamily: '"Comic Sans MS","Segoe Print","Trebuchet MS",sans-serif',
};
const resolHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  color: '#174de8', fontWeight: 900, fontSize: 17,
  textTransform: 'uppercase', letterSpacing: 0.5,
  marginBottom: 10, paddingBottom: 7,
  borderBottom: '2px solid #174de8',
};
const resolIcon: React.CSSProperties = { fontSize: 18 };
const resolSteps: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7 };
const resolRow: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '118px 1fr', gap: 10, alignItems: 'flex-start',
  borderLeft: '4px solid #174de8', paddingLeft: 8, marginLeft: 2,
};
const resolBadge: React.CSSProperties = {
  color: '#fff', fontWeight: 900, fontSize: 12,
  padding: '4px 7px', borderRadius: 6, textAlign: 'center',
  textTransform: 'uppercase', letterSpacing: 0.2,
  border: '2px solid', lineHeight: 1.3,
  fontFamily: '"Comic Sans MS","Segoe Print",sans-serif',
};
const resolText: React.CSSProperties = {
  color: '#111827', fontSize: 15, fontWeight: 700,
  lineHeight: 1.55, paddingTop: 2,
  fontFamily: '"Comic Sans MS","Segoe Print","Trebuchet MS",sans-serif',
};
const pen: React.CSSProperties = { width: 76, height: 8, borderRadius: 999, boxShadow: '0 2px 5px rgba(0,0,0,0.32), inset 10px 0 0 rgba(255,255,255,0.28)' };
const eraser: React.CSSProperties = { width: 58, height: 12, borderRadius: 4, background: 'linear-gradient(90deg,#111827,#475569)' };
