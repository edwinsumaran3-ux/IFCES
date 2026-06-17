// =============================================================================
//  frontend/src/features/banco/BancoPreguntasPage.tsx
//  Banco de Preguntas — Panel por Materia / Tema / Preguntas + Visual + Audio
// =============================================================================
import React, { useState, useEffect, useRef } from 'react';
import { useScreenGuide } from '../audio/AudioGuide';
import QuestionInlineVisual, { getPureFormula } from '../exam/QuestionInlineVisual';
import QuestionVisualPanel  from '../exam/QuestionVisualPanel';
import AvatarTutorIA from '../avatar/AvatarTutorIA';

declare const MathJax: { typesetPromise: (nodes?: HTMLElement[]) => Promise<void> };

const API = 'https://ifces-production.up.railway.app/api/v1';
const LIMIT = 20;

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Materia {
  key: string;
  label: string;
  color: string;
  total: number;
  temas: string[];
  tema_counts: Record<string, number>;
}

interface Opcion { label: string; text: string }

interface Pregunta {
  id: string;
  codigo: string;
  area: string;
  tema: string;
  enunciado: string;
  opciones: Opcion[];
  respuesta: string;
  explicacion: string;
  dificultad: string;
}

// Formato que esperan QuestionInlineVisual y QuestionVisualPanel
interface QVP {
  id: string;
  stem: string;
  area: string;
  points: number;
  difficulty: string;
  options: Opcion[];
}

type View = 'materias' | 'preguntas';

// ── Paleta de dificultad ──────────────────────────────────────────────────────
const DIFF: Record<string, { color: string; bg: string }> = {
  MEDIA: { color: '#d29922', bg: 'rgba(210,153,34,0.12)' },
  ALTA:  { color: '#f85149', bg: 'rgba(248,81,73,0.10)' },
  RETO:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
};

function diffStyle(d: string) {
  return DIFF[d] ?? { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  user: { id: string; full_name: string; plan_code?: string };
  onBuyPlan?: () => void;
}

const ACTIVE_PLANS = ['basic', 'plus', 'premium'];

// =============================================================================
export default function BancoPreguntasPage({ user, onBuyPlan }: Props) {
  useScreenGuide('banco', 1000)
  const [view,           setView]           = useState<View>('materias');
  const [materias,       setMaterias]       = useState<Materia[]>([]);
  const [materia,        setMateria]        = useState<Materia | null>(null);
  const [temaFiltro,     setTemaFiltro]     = useState('Todas');
  const [difFiltro,      setDifFiltro]      = useState('Todas');
  const [preguntas,      setPreguntas]      = useState<Pregunta[]>([]);
  const [total,          setTotal]          = useState(0);
  const [skipOffset,     setSkipOffset]     = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [revealed,       setRevealed]       = useState<Set<string>>(new Set());
  const [viewed,         setViewed]         = useState<Set<string>>(new Set());
  // Panel visual flotante
  const [visualPanel,       setVisualPanel]       = useState<QVP | null>(null);
  // Audio
  const [speaking,          setSpeaking]          = useState<string | null>(null);
  const [audioLoading,      setAudioLoading]      = useState<string | null>(null);
  const [played,            setPlayed]            = useState<Set<string>>(new Set());
  const [explanationShown,  setExplanationShown]  = useState<Set<string>>(new Set());
  const [currentReadText,   setCurrentReadText]   = useState('');
  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const voicesRef   = useRef<SpeechSynthesisVoice[]>([]);
  const speakToken  = useRef(0); // cancela cadenas recursivas al incrementar

  // Cancelar todo el audio activo
  function cancelAudio() {
    speakToken.current += 1;
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(null);
    setAudioLoading(null);
  }

  // Cargar materias al montar + precargar voces de fallback + cleanup en unmount
  useEffect(() => {
    fetchMaterias();
    const loadVoices = () => { voicesRef.current = window.speechSynthesis?.getVoices() || []; };
    loadVoices();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { cancelAudio(); };
  }, []);

  async function fetchMaterias() {
    try {
      const res = await fetch(`${API}/banco/materias`);
      if (res.ok) setMaterias(await res.json());
    } catch {}
  }

  async function fetchPreguntas(m: Materia, tema: string, dif: string, offset: number) {
    setLoading(true);
    try {
      const p = new URLSearchParams({ skip: String(offset), limit: String(LIMIT) });
      if (tema && tema !== 'Todas') p.set('tema', tema);
      if (dif  && dif  !== 'Todas') p.set('dificultad', dif);
      const res = await fetch(`${API}/banco/materias/${encodeURIComponent(m.key)}/preguntas?${p}`);
      if (!res.ok) return;
      const data = await res.json();
      if (offset === 0) setPreguntas(data.preguntas ?? []);
      else              setPreguntas(prev => [...prev, ...(data.preguntas ?? [])]);
      setTotal(data.total ?? 0);
    } catch {}
    setLoading(false);
  }

  function openMateria(m: Materia) {
    setMateria(m);
    setTemaFiltro('Todas');
    setDifFiltro('Todas');
    setSkipOffset(0);
    setPreguntas([]);
    setVisualPanel(null);
    setView('preguntas');
    fetchPreguntas(m, 'Todas', 'Todas', 0);
  }

  function applyFilter(tema: string, dif: string) {
    setTemaFiltro(tema);
    setDifFiltro(dif);
    setSkipOffset(0);
    setPreguntas([]);
    if (materia) fetchPreguntas(materia, tema, dif, 0);
  }

  function loadMore() {
    const next = skipOffset + LIMIT;
    setSkipOffset(next);
    if (materia) fetchPreguntas(materia, temaFiltro, difFiltro, next);
  }

  // Convierte Pregunta → formato QVP para los componentes visuales
  function toQVP(p: Pregunta): QVP {
    return {
      id: p.id,
      stem: p.enunciado,
      area: p.area,
      points: 1,
      difficulty: p.dificultad,
      options: p.opciones,
    };
  }

  function openVisualPanel(p: Pregunta) {
    setVisualPanel(toQVP(p));
    setViewed(prev => { const s = new Set(prev); s.add(p.id); return s; });
    try {
      fetch(`${API}/banco/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: user.id, question_id: p.id }),
      });
    } catch {}
  }

  function toggleReveal(id: string) {
    setRevealed(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
    setViewed(prev => { const s = new Set(prev); s.add(id); return s; });
  }

  // ── Callback compartido cuando el audio termina ───────────────────────────
  function onAudioFinished(id: string) {
    setSpeaking(null);
    setAudioLoading(null);
    setPlayed(prev => new Set([...prev, id]));
    setExplanationShown(prev => new Set([...prev, id]));
    setViewed(prev => new Set([...prev, id]));
  }

  // ── Selección de voz colombiana — prioridad: Salomé/Gonzalo Neural > es-CO > es-US ──
  function pickColombianVoice(gender: 'male' | 'female'): SpeechSynthesisVoice | null {
    const all = (voicesRef.current.length
      ? voicesRef.current
      : window.speechSynthesis?.getVoices() || []);

    const score = (v: SpeechSynthesisVoice): number => {
      let s = 0;
      const n = v.name.toLowerCase();
      // Voces colombianas específicas (Microsoft Edge) — máxima prioridad
      if (/salome/i.test(n)  && gender === 'female') s += 100;
      if (/gonzalo/i.test(n) && gender === 'male')   s += 100;
      if (/es.co/i.test(v.lang) || /colombia/i.test(n)) s += 40;
      // Neural/Natural online >> locales robóticas
      if (!v.localService) s += 20;
      if (/neural|natural/i.test(n)) s += 15;
      // Acento latinoamericano
      if (v.lang === 'es-US') s += 8;
      if (v.lang === 'es-MX') s += 6;
      if (/^es/i.test(v.lang)) s += 4;
      // Género aproximado
      if (gender === 'female' && /female|mujer|woman|girl|sabina|helena|laura|maria|isabel|luciana|monica|paloma|paulina|fernanda|natalia|daniela|sofia|valeria|dalia|conchita|camila|paola|andrea|claudia|rosa|alicia|beatriz/i.test(n)) s += 12;
      if (gender === 'male'   && /male|hombre|man|pablo|juan|jorge|diego|carlos|andres|alvaro|arturo|miguel|antonio|rodrigo|felipe|alejandro|sergio|manuel|javier/i.test(n)) s += 12;
      return s;
    };

    const spanish = all.filter(v => /^es/i.test(v.lang));
    if (!spanish.length) return all[0] ?? null;
    return spanish.sort((a, b) => score(b) - score(a))[0];
  }

  // ── Web Speech con voz colombiana del navegador ───────────────────────────
  function speakWithBrowser(id: string, partes: string[], gender: 'male' | 'female') {
    if (!('speechSynthesis' in window)) { onAudioFinished(id); return; }
    const voz   = pickColombianVoice(gender);
    const token = speakToken.current; // snapshot — si cambia, esta cadena es obsoleta
    let idx     = 0;
    const next  = () => {
      if (speakToken.current !== token) return; // cancelada
      if (idx >= partes.length) { onAudioFinished(id); return; }
      const utt   = new SpeechSynthesisUtterance(partes[idx]);
      utt.lang    = 'es-CO';
      utt.rate    = 0.93;
      utt.pitch   = gender === 'female' ? 1.15 : 0.95;
      utt.volume  = 1;
      if (voz) utt.voice = voz;
      utt.onstart = () => { if (speakToken.current === token && idx === 0) setSpeaking(id); };
      utt.onend   = () => { idx++; next(); };
      utt.onerror = () => { if (speakToken.current === token) onAudioFinished(id); };
      window.speechSynthesis.speak(utt);
    };
    next();
  }

  // ── ¿El navegador tiene voz colombiana neural? ────────────────────────────
  function hasColombiaNeuralVoice(): boolean {
    const all = voicesRef.current.length
      ? voicesRef.current
      : window.speechSynthesis?.getVoices() || [];
    return all.some(v => /salome|gonzalo/i.test(v.name) || /es.co/i.test(v.lang));
  }

  // ── Inferir género del nombre (para voz y pronombres) ────────────────────────
  function inferGender(fullName: string): 'male' | 'female' {
    const first = (fullName || '').trim().split(/\s+/)[0].toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const femeninos = ['maria','valentina','sofia','isabella','camila','daniela',
      'sara','laura','paula','natalia','juliana','andrea','diana','carolina',
      'alejandra','paola','marcela','claudia','monica','patricia','fernanda',
      'luisa','catalina','isabel','viviana','lorena','olga','rocio','gloria',
      'esperanza','manuela','salome','mariana','tatiana','vanessa','veronica',
      'adriana','angela','beatriz','cecilia','elena','fabiola','gabriela',
      'helena','irene','jessica','karen','lina','milena','norma','pilar',
      'rosa','sandra','teresa','ursula','xiomara','yolanda','zulma'];
    if (femeninos.some(n => first === n || first.startsWith(n))) return 'female';
    if (/[ao]$/.test(first)) return first.endsWith('o') ? 'male' : 'female';
    return 'male';
  }

  // ── Pronombres y apelativos según género ──────────────────────────────────
  const g = inferGender(user.full_name);
  const APE = {
    parce:    g === 'female' ? 'parcera' : 'parcero',
    mije:     g === 'female' ? 'mija'    : 'mijo',
    campeon:  g === 'female' ? 'campeona' : 'campeón',
    duro:     g === 'female' ? 'la dura'  : 'el duro',
    teso:     g === 'female' ? 'tesa'    : 'teso',
    llave:    g === 'female' ? 'mi llave' : 'mi llave',
    lo_logro: g === 'female' ? 'lo logró' : 'lo logró',
    usted:    'usted',
  };

  // ── 10 saludos — siempre "¡Hola [nombre]! Gracias por estar aquí." + contexto distinto ─
  const SALUDOS_CO = [
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. Mire, yo sé que esta pregunta puede parecer difícil al principio, pero entre los dos la resolvemos, ¿listo? ¡Pilas que esto no tiene pérdida!`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. Venga le cuento algo: usted tiene toda la capacidad para resolver esto. No se me achicopale. Yo le explico paso a paso y verá que sí entiende.`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. ¡Qué nota que estés practicando! Eso es lo que diferencia a los que pasan el ICFES de los que no. ¡Hágale que esto está más fácil de lo que parece!`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. Verá que esta pregunta tiene un truco, y cuando lo entienda va a decir: ¡uy, era tan fácil! Así que abra bien los oídos, que le voy a explicar.`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. Los mejores estudiantes no son los más inteligentes, son los más constantes, y usted ya está demostrando esa constancia. ¡Con todo!`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. Quiero que sepa algo importante: yo creo en usted. Esta pregunta tiene solución, y juntos la vamos a encontrar. ¡Eso es lo que hay!`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. Esta pregunta puede parecer difícil, pero no se me raje. Los que no se rajan son los que entienden. ¡Échele el cuerpo que yo le explico paso a paso!`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. Todos empezamos sin saber y con práctica nos volvemos tesos. ¿Está listo para entender esto? ¡Vamos con toda!`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. ¿Sabe cuál es el secreto del ICFES? El método. Y yo se lo voy a enseñar ahora mismo. Una vez que lo aprende, ninguna pregunta lo tumba. ¡Hágale!`,
    (n:string) => `¡Hola ${n}! Gracias por estar aquí. Respire profundo, que esto no es ninguna berraquera. Con calma y método, todo se puede. ¡Yo lo acompaño en cada paso!`,
  ];

  const CIERRE_RETO = `Ya tiene toda la explicación. Ahora inténtelo. Ya tiene la respuesta dentro de usted. Y si en este momento no la ve, no se preocupe: le voy a mostrar la fórmula resuelta y la respuesta para que la entienda bien.`;

  const CIERRES_CO = [
    (f:string) => `¡Eso ${APE.parce}! Siga practicando ${f}. ¡Usted es ${APE.teso}! ${CIERRE_RETO}`,
    (f:string) => `¡Bien ahí ${APE.mije}! ${f} es su aliada. ¡Dele duro que el ICFES no le va a quedar grande! ${CIERRE_RETO}`,
    (f:string) => `¡Qué berraquera la de usted, ${APE.campeon}! ${f} Recuérdela, que vale oro en el examen. ${CIERRE_RETO}`,
    (f:string) => `¡Severo! Eso es exactamente lo que necesitaba entender. ${f} Sígala repasando. ${CIERRE_RETO}`,
    (f:string) => `¡Chimba! Así se hace ${APE.parce}. ${f} Guárdela en la memoria. ${CIERRE_RETO}`,
    (f:string) => `Mire pues ${APE.parce}. ${f} Practique un poco más y el ICFES va a ser pan comido. ${CIERRE_RETO}`,
    (f:string) => `¡Ni que nada, ${APE.duro}! Eso estuvo bacano. ${f} Repásela esta noche. ${CIERRE_RETO}`,
    (f:string) => `¡Eso es lo que hay, ${APE.mije}! ${f} ¡Échele ganas! ${CIERRE_RETO}`,
    (f:string) => `¡Qué nota ${APE.parce}! ${f} En el examen va a sonreír por dentro. ${CIERRE_RETO}`,
    (f:string) => `¡Le juro que usted puede, ${APE.campeon}! ${f} ¡Con todo Colombia! ${CIERRE_RETO}`,
  ];

  // ── 10 transiciones al tema (jerga paisa) ─────────────────────────────────
  const TEMAS_CO = [
    (a:string,t:string) => `Esta pregunta es de ${a}${t?', específicamente '+t:''}. Léala bien, identifique los datos y piense qué concepto aplica. ¡Pilas que los datos están ahí, solo hay que verlos!`,
    (a:string,t:string) => `Mire, esto es ${a}${t?', tema de '+t:''}. Antes de resolver, lea el enunciado dos veces. La segunda vez ya ve los datos claros. ¿Qué le están pidiendo? Esa es la pregunta del millón.`,
    (a:string,t:string) => `Bueno, aquí la cosa es de ${a}${t?', puntualmente '+t:''}. No se le olvide: en el ICFES cada palabra del enunciado importa. Léalo bien y anote los datos clave.`,
    (a:string,t:string) => `Esta es una pregunta de ${a}${t?' sobre '+t:''}. Venga y la atacamos con método: primero datos, luego fórmula, luego resultado. Así de simple, así de bacano.`,
    (a:string,t:string) => `Uy, ${a}${t?', tema '+t:''}. Tranquilo/a. Esta área parece difícil pero tiene sus trucos y yo se los voy a enseñar. Una vez que los entiende, todo cambia.`,
  ];

  // ── 10 cierres de explicación ─────────────────────────────────────────────
  const EXPLICA_CO = [
    `Aprenda bien este razonamiento, porque en el ICFES preguntas similares aparecen varias veces. El que entiende el proceso, no el que memoriza, es el que gana.`,
    `¿Lo vio? Paso a paso, sin afanes. Así es como se resuelve en el examen. No hay magia, hay método. Y usted ya lo tiene.`,
    `Eso es todo. Sin complicaciones. Cuando le llegue algo parecido en el examen, va a recordar esto y va a resolverlo sin pensarlo dos veces.`,
    `Bacano, ¿verdad? No era tan difícil. Así son la mayoría de preguntas del ICFES: fáciles cuando uno sabe el truco. Y ese truco ya lo sabe.`,
    `Mire pues cómo todo tiene sentido cuando se aplica el método correcto. Por eso estudiar con cabeza es mejor que estudiar de memoria.`,
  ];

  // ── 10 estilos motivacionales — rotan por pregunta (deterministamente) ───────
  const ESTILOS = [
    // 0 — El entrenador campeón
    {
      saludo: (n: string) =>
        `¡Hola ${n}! Bienvenido a esta sesión de práctica. Quiero que sepas algo antes de empezar: los campeones no nacen sabiendo, se hacen practicando. Y tú ya estás aquí, eso es lo primero. Vamos paso a paso con esta pregunta.`,
      cierre: (f: string) =>
        `¡Eso es! Lo lograste. Cada pregunta que practicas es un músculo que fortaleces. ${f} No hay atajos, pero sí hay métodos, y tú acabas de aprender uno. ¡Sigue entrenando, campeón!`,
    },
    // 1 — El amigo estudiante
    {
      saludo: (n: string) =>
        `Oye ${n}, ¿sabes qué? Esta pregunta al principio parece difícil, pero te juro que cuando la entiendes dices: ¡era obvio! Déjame mostrarte cómo yo la vería. No te compliques, vamos sencillo.`,
      cierre: (f: string) =>
        `¿Ves? No era para tanto. ${f} A mí también me costó al principio, pero con práctica todo fluye. Tú tienes todo para lograrlo, solo sigue así. ¡Échale ganas!`,
    },
    // 2 — La maestra apasionada
    {
      saludo: (n: string) =>
        `Bienvenido, ${n}. Me alegra mucho que estés aquí practicando. Quiero que sepas que creo en ti, y que con cada pregunta que estudias te acercas más a tu meta. Ahora, te voy a guiar para que entiendas esta pregunta desde su raíz.`,
      cierre: (f: string) =>
        `Muy bien hecho. Ver a mis estudiantes comprender es lo que más me llena de alegría. ${f} Sigue así, con esa actitud y esa constancia llegarás muy lejos. ¡Estoy orgullosa de ti!`,
    },
    // 3 — El motivador de madrugada
    {
      saludo: (n: string) =>
        `${n}, escúchame bien: el hecho de que estés aquí practicando, mientras otros no lo hacen, ya te pone por delante. Eso es lo que hace la diferencia. Ahora vamos a resolver esto juntos porque tú sí puedes.`,
      cierre: (f: string) =>
        `¡Así se hace! Recuerda: el éxito no es suerte, es preparación más oportunidad. ${f} Tú estás construyendo esa preparación ahora mismo. ¡No te detengas, sigue adelante!`,
    },
    // 4 — El sabio tranquilo
    {
      saludo: (n: string) =>
        `Respira, ${n}. No hay prisa. El aprendizaje ocurre cuando la mente está tranquila y abierta. Esta pregunta tiene una lógica interna que vamos a descubrir juntos. No hay error posible cuando entiendes el proceso.`,
      cierre: (f: string) =>
        `Excelente. La comprensión que acabas de ganar no te la quita nadie. ${f} Guarda esta idea en tu memoria con calma, y verás cómo el día del examen simplemente sale sola. Confía en ti.`,
    },
    // 5 — El hermano mayor
    {
      saludo: (n: string) =>
        `Mira ${n}, te voy a decir lo que nadie te dice: el ICFES no es para los más inteligentes, es para los más preparados. Y tú estás aquí preparándote. Eso ya es ganar. Vamos con esta pregunta, te la explico clarito.`,
      cierre: (f: string) =>
        `¡Crack! Eso es lo que eres. ${f} Yo sé que a veces da pereza estudiar, pero cuando ves los resultados todo tiene sentido. ¡Sigue así, que vas muy bien!`,
    },
    // 6 — El científico curioso
    {
      saludo: (n: string) =>
        `¡Hola ${n}! ¿Sabes lo que más me gusta de esta pregunta? Que tiene una belleza oculta. Cuando la descomponemos en partes, verás que todo tiene sentido lógico. No es memorizar fórmulas, es entender por qué funcionan. ¡Eso es la ciencia!`,
      cierre: (f: string) =>
        `¡Ahí está! La lógica nunca falla cuando la aplicas bien. ${f} Cada vez que entiendes el por qué de una fórmula, se te graba para siempre. Sigue explorando, eso es lo que hace a los grandes mentes. ¡Tú tienes esa curiosidad!`,
    },
    // 7 — El coach de vida
    {
      saludo: (n: string) =>
        `${n}, quiero que pienses en esto: cada obstáculo que superas en el estudio te enseña a superar obstáculos en la vida. Esta pregunta es más que matemáticas o ciencias, es una oportunidad de demostrar que tú no te rindes. ¡Vamos!`,
      cierre: (f: string) =>
        `Lo superaste. Así como superaste esta pregunta, vas a superar todo lo que venga. ${f} No olvides: la disciplina de hoy es la libertad de mañana. ¡Tú tienes un futuro increíble por delante!`,
    },
    // 8 — El compañero de sala
    {
      saludo: (n: string) =>
        `¡Epale ${n}! Mira, yo sé que a veces uno mira una pregunta y dice: ¿esto qué es? Pero te prometo que cuando la vemos juntos te das cuenta de que no es nada del otro mundo. Te explico rápido y fácil.`,
      cierre: (f: string) =>
        `¿Verdad que sí se podía? ${f} Así son todas estas preguntas: parecen difíciles hasta que alguien te muestra el truco. ¡Ahora ya sabes, y eso nadie te lo quita! ¡Dale que vas!`,
    },
    // 9 — El inspirador de sueños
    {
      saludo: (n: string) =>
        `${n}, cada punto que sumes en el ICFES es una puerta que se abre para tu futuro. Medicina, ingeniería, derecho, arte... todo empieza aquí, con esta pregunta, con este momento. Vamos a resolverla con todo.`,
      cierre: (f: string) =>
        `¡Brillante! Esa mente que acabas de usar es la misma que va a cambiar tu vida y la de los tuyos. ${f} Cada pregunta es un ladrillo de tu futuro. ¡Sigue construyendo, que el edificio va quedando precioso!`,
    },
  ];

  // ── Limpia notación matemática para que gTTS suene natural ──────────────────
  function cleanForSpeech(raw: string): string {
    if (!raw) return '';
    return raw
      // LaTeX fracciones → "X sobre Y"
      .replace(/\\d?frac\{([^}]+)\}\{([^}]+)\}/gi, '$1 sobre $2')
      // Raíces
      .replace(/\\sqrt\{([^}]+)\}/gi, 'raíz de $1')
      .replace(/\\sqrt/gi, 'raíz cuadrada')
      // Potencias
      .replace(/\^2/g, ' al cuadrado')
      .replace(/\^3/g, ' al cubo')
      .replace(/\^{([^}]*)}/g, ' elevado a $1')
      .replace(/\^(\w)/g, ' elevado a $1')
      // Subíndices
      .replace(/_\{([^}]*)\}/g, ' $1')
      .replace(/_(\w)/g, ' $1')
      // Comandos LaTeX comunes
      .replace(/\\cdot|\\times/gi, ' por ')
      .replace(/\\pi/gi, 'pi')
      .replace(/\\text\{([^}]+)\}/gi, '$1')
      .replace(/\\overrightarrow\{([^}]+)\}/gi, '$1')
      .replace(/\\left|\\right|\\quad|\\qquad|\\,|\\!|\\;/gi, ' ')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}$\\]/g, '')
      // Símbolos especiales → palabras
      .replace(/·/g, ', ')
      .replace(/→/g, '. Por lo tanto, ')
      .replace(/←/g, '. Es decir, ')
      .replace(/≈/g, ' aproximadamente ')
      .replace(/≠/g, ' diferente de ')
      .replace(/≤/g, ' menor o igual a ')
      .replace(/≥/g, ' mayor o igual a ')
      .replace(/±/g, ' más o menos ')
      .replace(/×/g, ' por ')
      .replace(/÷/g, ' dividido entre ')
      .replace(/°/g, ' grados ')
      .replace(/\[|\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // ── Explicación razonada: construye el PORQUÉ de la fórmula, no solo la fórmula ─
  function buildPasoAPaso(enunciado: string, area: string): string {
    const e = enunciado.toLowerCase();
    const a = area.toLowerCase();

    // ── FÍSICA — Temperatura ─────────────────────────────────────────────────
    if (e.includes('celsius') || e.includes('fahrenheit') || e.includes('kelvin')) {
      if (e.includes('fahrenheit') || e.includes('celsius')) {
        return 'Construyamos la fórmula desde cero. Sabemos dos puntos fijos: cero grados Celsius equivale a 32 Fahrenheit, y cien grados Celsius equivale a 212 Fahrenheit. Si subimos 100 grados en Celsius, ¿cuántos Fahrenheit cambian? 212 menos 32 es 180. Entonces 100 grados Celsius corresponden a 180 Fahrenheit. Cada grado Celsius vale 180 dividido entre 100, que es 9 sobre 5. Por eso la fórmula multiplica por 9 sobre 5. Pero cuando Celsius vale cero, Fahrenheit no vale cero sino 32, así que sumamos ese desfase. La fórmula completa es: F igual a C por 9 sobre 5, más 32. Toma el valor del enunciado, aplica esa lógica y elige la opción más cercana.';
      }
      return 'La escala Kelvin empieza en el cero absoluto, que es el punto donde los átomos dejan de moverse. Los científicos midieron que ese punto ocurre a menos 273 grados Celsius. Por eso para convertir de Celsius a Kelvin simplemente se suma 273. No hay factor de escala porque ambas escalas tienen el mismo tamaño de grado. Toma el valor del enunciado, aplica esa suma y compara con las opciones.';
    }

    // ── FÍSICA — Energía cinética ────────────────────────────────────────────
    if (e.includes('cinética') || e.includes('cinetica') || (e.includes('energía') && e.includes('veloc') && e.includes('masa'))) {
      return 'Pensemos en qué es la energía cinética. Es la energía que tiene un objeto por estar en movimiento. Intuitivamente, si duplicamos la masa el objeto es el doble de difícil de detener. Pero si duplicamos la velocidad, el objeto es cuatro veces más difícil de detener, porque la velocidad aparece al cuadrado. Los físicos demostraron con cálculo que la energía cinética es exactamente la mitad de la masa por la velocidad al cuadrado. El factor un medio viene de integrar la fuerza sobre la distancia. Con los datos del enunciado: primero eleva la velocidad al cuadrado, luego multiplica por la masa y finalmente divide entre dos. El resultado está en Joules.';
    }

    // ── FÍSICA — Energía potencial gravitacional ─────────────────────────────
    if (e.includes('potencial') && (e.includes('gravit') || e.includes('altura') || e.includes('masa'))) {
      return 'La energía potencial gravitacional es la energía que almacena un objeto por estar elevado. Piensa así: para subir un objeto necesitas hacer fuerza hacia arriba contra la gravedad. Esa fuerza es la masa multiplicada por g. Y el trabajo que haces es esa fuerza por la distancia recorrida, que es la altura. Por eso la fórmula es Ep igual a masa por g por altura. No hay factores extraños porque es una acumulación directa: más masa, más altura o más gravedad, más energía almacenada. Con los datos del enunciado multiplica los tres valores. El resultado es en Joules.';
    }

    // ── FÍSICA — Cinemática ──────────────────────────────────────────────────
    if (e.includes('velocidad') && (e.includes('distancia') || e.includes('tiempo') || e.includes('recorre'))) {
      return 'La velocidad mide cuánto espacio se recorre por unidad de tiempo. Si en un segundo recorres 10 metros, en dos segundos recorres 20. La relación es directamente proporcional: distancia igual a velocidad por tiempo. Esta es la base de toda cinemática. Si el enunciado te da dos de las tres magnitudes, despeja la tercera. Si te dan distancia y tiempo, la velocidad es distancia dividida entre tiempo. Si te dan velocidad y tiempo, la distancia es la multiplicación de ambas. Identifica qué te dan y qué te piden, luego opera.';
    }

    // ── FÍSICA — Segunda Ley de Newton ───────────────────────────────────────
    if (e.includes('fuerza') && (e.includes('masa') || e.includes('aceleración') || e.includes('aceleracion'))) {
      return 'Newton observó que empujar algo más pesado requiere más fuerza para conseguir la misma aceleración. También observó que la misma fuerza sobre algo más liviano produce más aceleración. Esa relación proporcional directa entre fuerza, masa y aceleración se escribe como F igual a masa por aceleración. No hay constantes extrañas porque Newton definió el Newton precisamente como la fuerza que acelera un kilogramo a un metro sobre segundo cuadrado. Identifica en el enunciado cuáles dos magnitudes te dan, despeja la tercera y sustituye.';
    }

    // ── FÍSICA — Ondas ───────────────────────────────────────────────────────
    if (e.includes('refracc') || e.includes('reflexi') || e.includes('onda') || e.includes('frecuenc') || e.includes('longitud de onda')) {
      return 'Pensemos en las ondas. Una onda tiene dos características independientes: la frecuencia, cuántas veces vibra por segundo, y la longitud de onda, qué tan larga es cada ciclo. La velocidad de la onda es el producto de ambas, porque en cada segundo la onda avanza tantas longitudes como ciclos completa. Por eso v igual a frecuencia por longitud de onda. La refracción ocurre cuando la onda pasa de un medio a otro y cambia velocidad, lo que obliga a cambiar de dirección. La reflexión es cuando la onda rebota sin cambiar de medio. Identifica cuál fenómeno describe el enunciado y aplica esa definición.';
    }

    // ── FÍSICA — Ley de Ohm ──────────────────────────────────────────────────
    if (e.includes('voltaje') || e.includes('corriente') || e.includes('resistencia') || e.includes('ohm')) {
      return 'Ohm descubrió que en un conductor la corriente que fluye es directamente proporcional al voltaje aplicado e inversamente proporcional a la resistencia. Piénsalo así: el voltaje es la presión que empuja los electrones, la resistencia es el obstáculo, y la corriente es cuántos electrones pasan. Más presión, más corriente. Más obstáculo, menos corriente. Eso se escribe V igual a I por R, o despejando, I igual a V sobre R. Con los datos del enunciado identifica cuáles dos magnitudes te dan y despeja la tercera.';
    }

    // ── FÍSICA — Caída libre ──────────────────────────────────────────────────
    if (e.includes('caída') || e.includes('caida') || e.includes('lanzamiento') || e.includes('proyectil') || (e.includes('gravedad') && e.includes('tiempo'))) {
      return 'En caída libre, la gravedad acelera el objeto de forma constante. Piensa en la velocidad: empieza en cero y crece a razón de g metros por segundo cada segundo. La distancia recorrida es el área bajo esa curva de velocidad, que es un triángulo: base por altura sobre dos. Eso nos da la mitad de g por tiempo al cuadrado. Si hay velocidad inicial, simplemente se agrega como distancia adicional. La fórmula es h igual a velocidad inicial por tiempo más la mitad de g por tiempo al cuadrado. Con los datos del enunciado sustituye los valores que te dan y despeja lo que te preguntan.';
    }

    // ── QUÍMICA — Reacciones y estequiometría ────────────────────────────────
    if (e.includes('mol') || e.includes('estequiom') || e.includes('reactivo') || e.includes('producto') || e.includes('reacción') || e.includes('reaccion')) {
      return 'Construyamos la lógica de la estequiometría. Una ecuación química balanceada es como una receta: los coeficientes te dicen cuántos moles de cada ingrediente necesitas y cuántos moles de producto obtienes. Si la receta dice que 2 moles de hidrógeno reaccionan con 1 mol de oxígeno, entonces la razón es siempre 2 a 1, sin importar la cantidad total. Para resolver el problema primero verifica que la ecuación esté balanceada, luego establece una proporción entre los coeficientes y los moles que te dan en el enunciado. Aplica regla de tres entre el coeficiente conocido y la incógnita.';
    }

    // ── QUÍMICA — Ácidos y bases ─────────────────────────────────────────────
    if (e.includes('ph') || e.includes('ácido') || e.includes('acido') || e.includes('base') || e.includes('alcalin')) {
      return 'El pH nació de la necesidad de medir la acidez sin usar números enormes. La concentración de iones de hidrógeno en el agua pura es 0.0000001, que es 10 elevado a menos 7. Para simplificar, se toma el exponente con signo cambiado: pH 7. Un ácido tiene más iones de hidrógeno que el agua pura, así que su concentración es mayor a 10 a la menos 7, lo que da un pH menor a 7. Una base tiene menos iones de hidrógeno, pH mayor a 7. La escala va de 0 a 14. Aplica ese razonamiento a la sustancia que describe el enunciado y elige la opción coherente con ese concepto.';
    }

    // ── QUÍMICA — Estructura atómica ─────────────────────────────────────────
    if (e.includes('átomo') || e.includes('atomo') || e.includes('protón') || e.includes('proton') || e.includes('electrón') || e.includes('electron') || e.includes('neutrón') || e.includes('neutron') || e.includes('número atómico') || e.includes('masa atómica')) {
      return 'El modelo atómico se construyó así: Rutherford descubrió que hay un núcleo pequeño y denso con carga positiva, rodeado de electrones. Los protones en el núcleo definen de qué elemento se trata, por eso su cantidad se llama número atómico. Los neutrones no tienen carga pero sí masa, y junto con los protones dan la masa atómica. Si quieres saber cuántos neutrones hay, razona así: la masa total del núcleo es protones más neutrones, entonces neutrones es masa atómica menos número atómico. Para un átomo neutro, los electrones igualan a los protones. Con los datos del enunciado aplica esa lógica.';
    }

    // ── QUÍMICA — Enlaces ────────────────────────────────────────────────────
    if (e.includes('enlace') || e.includes('covalente') || e.includes('iónico') || e.includes('ionico') || e.includes('electronegativi')) {
      return 'Los enlaces químicos se forman porque los átomos buscan completar su capa de valencia con 8 electrones. Cuando dos no metales se juntan, ninguno quiere ceder sus electrones definitivamente, así que los comparten: eso es un enlace covalente. Cuando un metal se junta con un no metal, el metal cede sus electrones fácilmente porque tiene pocos en la capa exterior, y el no metal los acepta: eso es un enlace iónico, que genera cargas opuestas que se atraen. Identifica en el enunciado si los elementos son metales o no metales y decide qué tipo de enlace describe mejor la situación.';
    }

    // ── QUÍMICA — Tabla periódica ─────────────────────────────────────────────
    if (e.includes('tabla periódica') || e.includes('tabla periodica') || e.includes('período') || e.includes('periodo') || e.includes('grupo') || (e.includes('element') && (e.includes('propiedad') || e.includes('tendencia')))) {
      return 'Mendeléev organizó los elementos por número atómico creciente y notó que las propiedades se repetían periódicamente. Los que tienen las mismas propiedades quedaron en la misma columna, los grupos. Los elementos del mismo grupo tienen igual número de electrones de valencia, que son los que participan en las reacciones. Por eso se comportan de forma similar. En los períodos, filas horizontales, al avanzar hacia la derecha el núcleo atrae más fuerte a los electrones porque hay más protones. Esa tensión define tendencias como electronegatividad y radio atómico. Identifica qué propiedad pregunta el enunciado y aplica la tendencia del período o grupo correspondiente.';
    }

    // ── QUÍMICA — Soluciones ──────────────────────────────────────────────────
    if (e.includes('mezcla') || e.includes('solución') || e.includes('solucion') || e.includes('concentración') || e.includes('concentracion') || e.includes('soluto') || e.includes('solvente')) {
      return 'Una solución es una mezcla homogénea donde el soluto se disuelve en el solvente. La concentración mide cuánto soluto hay en cierto volumen de solución. Piénsalo como una receta de café: si pones más café en la misma agua, la concentración sube. La fórmula es concentración igual a masa del soluto dividida entre el volumen de la solución. Si el enunciado tiene valores numéricos, identifica cuál es el soluto, cuál es su masa y cuál es el volumen total de la solución, luego divide. Si es una pregunta conceptual, razona si al agregar más soluto o más solvente la concentración sube o baja.';
    }

    // ── BIOLOGÍA — Fotosíntesis ───────────────────────────────────────────────
    if (e.includes('fotosíntesis') || e.includes('fotosintesis') || e.includes('clorofila') || e.includes('cloroplasto')) {
      return 'La fotosíntesis resuelve un problema fundamental: las plantas necesitan energía pero no pueden moverse a buscar comida. La solución fue capturar la energía de la luz solar. Los cloroplastos tienen clorofila, un pigmento verde que absorbe la luz. Esa energía se usa para romper moléculas de agua y combinar el hidrógeno liberado con el dióxido de carbono del aire, formando glucosa. El oxígeno que sobra se libera como subproducto. Eso explica por qué las plantas necesitan luz, agua y CO2, y producen oxígeno y glucosa. Con esa lógica identifica qué parte del proceso pregunta el enunciado.';
    }

    // ── BIOLOGÍA — Genética ───────────────────────────────────────────────────
    if (e.includes('adn') || e.includes('gen') || e.includes('cromosoma') || e.includes('herencia') || e.includes('mutación') || e.includes('mutacion') || e.includes('alelo') || e.includes('dominant') || e.includes('recesiv')) {
      return 'Mendel descubrió las leyes de la herencia observando guisantes. Notó que los rasgos se transmiten en unidades discretas, los genes, y que cada individuo tiene dos copias de cada gen, una de cada progenitor. Cuando los dos alelos son distintos, uno se impone sobre el otro: el dominante se expresa y el recesivo se oculta. Para predecir la descendencia se usa el cuadro de Punnett: escribe los alelos de un progenitor en filas y los del otro en columnas, y las combinaciones del interior muestran los posibles descendientes. Identifica en el enunciado cuáles son los alelos dominantes y recesivos y aplica esa lógica.';
    }

    // ── BIOLOGÍA — Evolución ──────────────────────────────────────────────────
    if (e.includes('selección natural') || e.includes('seleccion natural') || e.includes('evolución') || e.includes('evolucion') || e.includes('adaptación') || e.includes('adaptacion') || e.includes('supervivencia') || e.includes('heredable')) {
      return 'Darwin razonó así: en una población siempre hay variación entre individuos. Algunos tienen rasgos que les permiten sobrevivir mejor o reproducirse más. Si ese rasgo es heredable, los descendientes también lo tendrán. Con el tiempo, ese rasgo se vuelve más común en la población. No hay un plan o dirección: simplemente los que sobreviven dejan más descendientes. Eso es la selección natural. Para responder la pregunta, identifica cuál es la variación que describe el enunciado, qué ventaja ofrece en ese ambiente y por qué esa ventaja se volvería más común con el tiempo.';
    }

    // ── BIOLOGÍA — Célula ────────────────────────────────────────────────────
    if (e.includes('célula') || e.includes('celula') || e.includes('mitosis') || e.includes('meiosis') || e.includes('membrana') || e.includes('orgánulo') || e.includes('organulo') || e.includes('mitocondria')) {
      return 'La célula es la unidad básica de la vida porque tiene todo lo necesario para vivir de forma autónoma. La membrana plasmática actúa como frontera selectiva: deja entrar nutrientes y saca desechos. El núcleo es el centro de control porque contiene el ADN con las instrucciones para fabricar proteínas. La mitocondria produce la energía en forma de ATP usando oxígeno y glucosa. En la división celular, la mitosis produce dos células idénticas para crecer o reparar tejidos, mientras la meiosis produce cuatro células con la mitad de cromosomas para la reproducción sexual. Identifica cuál proceso o estructura pregunta el enunciado.';
    }

    // ── BIOLOGÍA — Sistemas corporales ───────────────────────────────────────
    if (e.includes('sistema') && (e.includes('digestivo') || e.includes('respiratorio') || e.includes('circulatorio') || e.includes('nervioso') || e.includes('excretor') || e.includes('inmune') || e.includes('endocrino'))) {
      return 'Los sistemas del cuerpo evolucionaron para resolver problemas específicos. El digestivo desmenuza los alimentos y absorbe nutrientes. El circulatorio transporta esos nutrientes y el oxígeno a cada célula usando el corazón como bomba. El respiratorio capta oxígeno del aire y elimina dióxido de carbono. El excretor filtra la sangre y elimina desechos en la orina. El nervioso procesa información y coordina respuestas. El endocrino regula procesos a largo plazo mediante hormonas. Identifica cuál sistema menciona el enunciado, recuerda su función principal y elige la opción que la describe correctamente.';
    }

    // ── BIOLOGÍA — Ecología ───────────────────────────────────────────────────
    if (e.includes('ecosistema') || e.includes('cadena') || e.includes('trófica') || e.includes('trofica') || e.includes('biodiversidad') || e.includes('hábitat') || e.includes('habitat') || e.includes('depredador') || e.includes('presa')) {
      return 'Un ecosistema funciona como una red de transferencia de energía. Las plantas capturan energía solar y la almacenan en glucosa: son los productores. Los herbívoros comen plantas y transfieren esa energía: consumidores primarios. Los carnívoros comen herbívoros: consumidores secundarios. En cada paso se pierde energía como calor, por eso las cadenas tienen pocos eslabones. Si un eslabón desaparece, los que dependían de él se afectan. La biodiversidad hace al ecosistema más resistente porque hay más opciones de alimento. Con esa lógica analiza la relación que describe el enunciado y elige la opción coherente.';
    }

    // ── MATEMÁTICAS — Pitágoras ───────────────────────────────────────────────
    if (e.includes('hipotenusa') || e.includes('cateto') || (e.includes('triángulo') && (e.includes('rectángulo') || e.includes('rectangulo')))) {
      return 'El Teorema de Pitágoras nació de observar que en todo triángulo rectángulo se puede construir un cuadrado sobre cada lado. El área del cuadrado de la hipotenusa siempre es exactamente igual a la suma de las áreas de los cuadrados de los dos catetos. Eso es lo que dice la fórmula: cateto A al cuadrado más cateto B al cuadrado es igual a la hipotenusa al cuadrado. Si te dan los dos catetos, súmalos al cuadrado y saca la raíz para encontrar la hipotenusa. Si te dan la hipotenusa y un cateto, resta el cuadrado del cateto conocido al cuadrado de la hipotenusa y saca la raíz. Identifica cuáles valores te da el enunciado y cuál te piden.';
    }

    // ── MATEMÁTICAS — Porcentajes ─────────────────────────────────────────────
    if (e.includes('porcentaje') || e.includes('%') || e.includes('descuento') || e.includes('interés') || e.includes('interes') || e.includes('rebaja')) {
      return 'El porcentaje nació para comparar proporciones sobre una base común de cien. Si digo que el 30 porciento de algo es mío, significa que de cada cien partes tengo 30. Para encontrar el porcentaje de un número multiplica ese número por el porcentaje y divide entre cien. O de forma equivalente multiplica por la fracción decimal: 30 por ciento es lo mismo que multiplicar por 0.30. Para un descuento, calcula el porcentaje del precio y réstalo. Para un aumento, calcula el porcentaje y súmalo. Identifica en el enunciado qué operación te piden y cuáles son el valor total y el porcentaje.';
    }

    // ── MATEMÁTICAS — Geometría ───────────────────────────────────────────────
    if (e.includes('área') || e.includes('area') || e.includes('perímetro') || e.includes('perimetro') || e.includes('volumen') || e.includes('superficie')) {
      return 'Las fórmulas de geometría no son arbitrarias, tienen una lógica. El área del rectángulo es base por altura porque estás contando cuántos cuadrados de lado 1 caben: tantos como columnas por filas. El área del triángulo es la mitad de base por altura porque un triángulo es exactamente la mitad de un paralelogramo. El área del círculo es pi por radio al cuadrado porque pi es la constante que relaciona la circunferencia con el diámetro. El volumen de un prisma es área de la base por la altura porque estás apilando capas del área base. Identifica la figura del enunciado y aplica la fórmula correspondiente con los valores que te dan.';
    }

    // ── MATEMÁTICAS — Estadística ─────────────────────────────────────────────
    if (e.includes('promedio') || e.includes('media') || e.includes('moda') || e.includes('mediana') || (e.includes('datos') && e.includes('conjunto'))) {
      return 'Las medidas de tendencia central resumen un conjunto de datos de formas distintas. La media aritmética es el valor que tendría cada dato si todos fueran iguales: suma todos y divide entre cuántos son. La mediana es el valor del centro cuando ordenas los datos de menor a mayor: la mitad está por debajo y la mitad por encima. La moda es el valor que más se repite, el más frecuente. Ninguna es mejor que las otras en general: depende de qué quieres representar. La media se afecta por valores extremos, la mediana no. Identifica cuál medida pide el enunciado y aplica el procedimiento correspondiente con los datos que te dan.';
    }

    // ── MATEMÁTICAS — Álgebra ─────────────────────────────────────────────────
    if (e.includes('ecuación') || e.includes('ecuacion') || e.includes('despeja') || e.includes('incógnita') || e.includes('incognita') || e.includes('valor de x') || e.includes('valor de y')) {
      return 'Una ecuación es una balanza en equilibrio: lo que haces a un lado debes hacerlo al otro para mantener la igualdad. Para despejar la incógnita aplica operaciones inversas: si está sumando, resta; si está multiplicando, divide; si está al cuadrado, saca raíz. El orden es: primero elimina lo que está fuera de paréntesis, luego lo que está dentro. Siempre verifica al final sustituyendo el valor que encontraste en la ecuación original. Si ambos lados son iguales, la solución es correcta. Con el enunciado identifica la ecuación, despeja la incógnita siguiendo esa lógica.';
    }

    // ── MATEMÁTICAS — Proporciones y razones ──────────────────────────────────
    if (e.includes('proporción') || e.includes('proporcion') || e.includes('razón') || e.includes('razon') || e.includes('fracción') || e.includes('fraccion') || e.includes('regla de tres')) {
      return 'Una proporción dice que dos razones son iguales. La lógica de la regla de tres viene de ahí: si la relación entre dos cantidades es constante, cuando una cambia la otra cambia en la misma proporción. Para resolver, el producto cruzado de una proporción siempre es igual: si A sobre B es igual a C sobre D, entonces A por D es igual a B por C. Identifica en el enunciado cuáles tres valores te dan y cuál incógnita debes encontrar. Escribe la proporción, cruza los productos y despeja. Eso funciona tanto para aumentos directos como para variaciones inversas.';
    }

    // ── MATEMÁTICAS — Funciones ───────────────────────────────────────────────
    if (e.includes('función') || e.includes('funcion') || e.includes('gráfica') || e.includes('grafica') || e.includes('pendiente') || e.includes('coordenadas') || e.includes('eje x') || e.includes('eje y')) {
      return 'Una función describe cómo una cantidad depende de otra. La función lineal y igual a m por x más b es la más simple: m es la pendiente, que mide cuánto sube y por cada unidad que avanza x, y b es el punto de partida cuando x vale cero. La pendiente se construye así: toma dos puntos, calcula el cambio en y dividido entre el cambio en x. Si la pendiente es positiva la función sube, si es negativa baja. Para evaluar una función en un punto, sustituye el valor de x y opera. Identifica en el enunciado qué te piden: la pendiente, un valor de la función o interpretar su gráfica.';
    }

    // ── LECTURA CRÍTICA ───────────────────────────────────────────────────────
    if (a.includes('lectura') || a.includes('crítica') || a.includes('critica')) {
      return 'La lectura crítica no busca que memorices el texto, sino que razones sobre él. Hay tres niveles de lectura: el literal, que es lo que el texto dice explícitamente; el inferencial, que es lo que se puede deducir de lo que dice; y el crítico, que evalúa por qué lo dice y qué pretende el autor. Para responder, primero identifica en qué nivel está la pregunta. Luego busca en el texto la evidencia directa. La opción correcta siempre puede justificarse con algo que dice o implica el texto. Las incorrectas suelen exagerar, contradecir o añadir información que el texto no da. Con esa lógica evalúa cada opción.';
    }

    // ── INGLÉS — explicación siempre en español ───────────────────────────────
    if (a.includes('inglés') || a.includes('ingles')) {
      return 'Esta es una pregunta de Inglés. Te explico el tema en español: las preguntas de inglés evalúan comprensión de lectura, vocabulario en contexto y estructuras gramaticales básicas como los tiempos verbales. Para responder bien, lee la pregunta con cuidado e identifica las palabras clave. Luego busca en el texto donde aparecen esas palabras o sus sinónimos. La opción correcta parafrasea lo que dice el texto usando palabras diferentes pero con el mismo significado. Las incorrectas suelen distorsionar el significado, agregar información que no está en el texto o contradecir lo que dice. Elimina las que no puedas sustentar directamente con el texto.';
    }

    // ── SOCIALES ──────────────────────────────────────────────────────────────
    if (a.includes('sociales') || a.includes('ciudadan') || a.includes('historia') || a.includes('geografía') || a.includes('geografia')) {
      return 'En ciencias sociales las preguntas buscan que entiendas relaciones causa-efecto, contextos históricos y conceptos cívicos. Primero identifica de qué período, región o concepto trata el enunciado. Luego pregúntate: ¿qué condiciones llevaron a ese evento? ¿Qué consecuencias tuvo? ¿Qué principios democráticos o geográficos aplican? La opción correcta explica el fenómeno con coherencia interna: la causa produce la consecuencia de forma lógica. Las incorrectas suelen mezclar períodos, invertir causas y efectos o usar conceptos de otro contexto. Aplica ese razonamiento a lo que describe el enunciado.';
    }

    // Fallback genérico razonado
    return 'Abordemos esta pregunta desde la lógica. Primero lee el enunciado completo e identifica qué concepto o relación está describiendo. Pregúntate: ¿por qué ese fenómeno ocurre de esa manera? ¿Qué principio explica la situación? Una vez que tienes claro el concepto, evalúa cada opción preguntándote si es coherente con ese principio. La opción correcta siempre tiene una razón clara que la sustenta; las incorrectas suelen ser parcialmente ciertas o mezclan conceptos. Razona desde el porqué, no solo desde la fórmula.';
  }

  // ── Construir guion completo — SIN usar p.explicacion que revela la respuesta ─
  function buildScript(p: Pregunta): string[] {
    const nombre = user.full_name?.split(' ')[0] || 'estudiante';
    const h  = p.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const iS = h % SALUDOS_CO.length;
    const iC = (h >> 3) % CIERRES_CO.length;

    const formula      = getPureFormula(p.area, p.enunciado);
    const formulaLabel = formula ? `la fórmula de ${formula.label}` : 'este tipo de preguntas';

    const saludo    = SALUDOS_CO[iS](nombre);
    const pasoAPaso = buildPasoAPaso(p.enunciado, p.area);
    const cierre    = CIERRES_CO[iC](formulaLabel);

    return [saludo, pasoAPaso, cierre];
  }

  // ── Reproducir audio ─────────────────────────────────────────────────────
  async function handleSpeak(p: Pregunta) {
    if (played.has(p.id)) return;
    // Toggle: si ya está sonando esta pregunta, parar
    if (speaking === p.id || audioLoading === p.id) { cancelAudio(); return; }
    // Si suena otra, cancelarla primero
    if (speaking || audioLoading) cancelAudio();
    setCurrentReadText(p.enunciado);

    const partes = buildScript(p);
    const texto  = partes.join(' ');

    // ── OPCIÓN A: Voz colombiana neural del navegador (Edge/Chrome con voces MS) ──
    // Si el alumno usa Edge, tiene Salomé (mujer) o Gonzalo (hombre) — gratis y nativa
    if (hasColombiaNeuralVoice()) {
      speakWithBrowser(p.id, partes, g);
      return;
    }

    // ── OPCIÓN B: Backend Google Neural2 (ya configurado en Railway) ──────────
    setAudioLoading(p.id);
    try {
      const res = await fetch(`${API}/banco/tts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text: texto, gender: g }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audio_b64) {
          if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
          const audio = new Audio(`data:audio/mpeg;base64,${data.audio_b64}`);
          audioRef.current = audio;
          audio.onplay  = () => { setSpeaking(p.id); setAudioLoading(null); };
          audio.onended = () => onAudioFinished(p.id);
          audio.onerror = () => { setAudioLoading(null); speakWithBrowser(p.id, partes, g); };
          await audio.play();
          return;
        }
      }
    } catch {}

    // ── OPCIÓN C: Web Speech con mejor voz disponible ────────────────────────
    setAudioLoading(null);
    speakWithBrowser(p.id, partes, g);
  }

  // ── Contadores de progreso ──────────────────────────────────────────────────
  const viewedCount  = viewed.size;
  const progressPct  = total > 0 ? Math.round((viewedCount / total) * 100) : 0;

  // ===========================================================================
  //  PAYWALL — sin plan activo
  // ===========================================================================
  if (!ACTIVE_PLANS.includes(user.plan_code || '')) {
    return (
      <div style={{ maxWidth: 540, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 }}>
          Acceso exclusivo para suscriptores
        </h2>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.75, marginBottom: 28 }}>
          El Banco de Preguntas con tutor IA requiere un plan activo.<br />
          Elige el plan que mejor se ajuste a ti y empieza a practicar hoy.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 28 }}>
          {[
            { name: 'Básico',   price: '$8.000',  color: '#60a5fa', helps: '1 ayuda IA' },
            { name: 'Plus',     price: '$12.000', color: '#a78bfa', helps: '3 ayudas IA' },
            { name: 'Premium',  price: '$15.000', color: '#34d399', helps: '5 ayudas IA' },
          ].map(p => (
            <div key={p.name} style={{
              background: 'rgba(12,18,38,0.9)',
              border: `1px solid ${p.color}30`,
              borderRadius: 12, padding: '14px 10px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: p.color, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{p.price}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>COP · {p.helps}</div>
            </div>
          ))}
        </div>
        <button
          onClick={onBuyPlan}
          style={{
            padding: '12px 36px',
            background: '#2563eb',
            border: 'none', borderRadius: 10,
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', letterSpacing: -0.2,
          }}
        >
          💳 Activar mi plan ahora
        </button>
        <p style={{ fontSize: 11, color: '#334155', marginTop: 12 }}>
          El administrador activa el plan en máximo 24 h tras confirmar el pago.
        </p>
      </div>
    );
  }

  // ===========================================================================
  //  VISTA: MATERIAS
  // ===========================================================================
  if (view === 'materias') {
    const sumTotal  = materias.reduce((s, m) => s + m.total, 0);
    const sumTemas  = materias.reduce((s, m) => s + m.temas.length, 0);

    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>

        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            Banco de Preguntas&nbsp;|&nbsp;Selecciona una Materia
          </h2>
          <p style={{ fontSize: 13, color: '#475569', marginTop: 6 }}>
            Estudia cada tema con preguntas reales del ICFES y apoyo del tutor IA
          </p>
        </div>

        {/* Grid de materias */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {materias.map(m => (
            <MateriaCard key={m.key} m={m} onSelect={openMateria} />
          ))}
        </div>

        {/* Resumen */}
        <div style={{
          background: 'rgba(12,18,38,0.8)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: '18px 24px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', letterSpacing: 1, marginBottom: 14 }}>
            RESUMEN DEL BANCO
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, textAlign: 'center' }}>
            {[
              { val: sumTotal ? sumTotal.toLocaleString() : '—', label: 'Total preguntas', color: '#38bdf8' },
              { val: String(materias.length || 5),               label: 'Materias',         color: '#a78bfa' },
              { val: String(sumTemas || 17),                     label: 'Temas',             color: '#34d399' },
              { val: '100%',                                     label: 'Con tutor IA',      color: '#fbbf24' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Flujo de estudio */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Flujo de estudio:</span>
          {['1. Elige materia','2. Elige tema','3. Lee la pregunta','4. Activa tutor IA','5. Pizarra + audio'].map((s, i) => (
            <React.Fragment key={s}>
              <span style={{ fontSize: 11, color: i === 0 ? '#fbbf24' : '#475569' }}>{s}</span>
              {i < 4 && <span style={{ color: '#1e293b', fontSize: 14 }}>›</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // ===========================================================================
  //  VISTA: PREGUNTAS
  // ===========================================================================
  const m = materia!;

  // Estado del avatar sincronizado con el audio del banco
  const avatarState = audioLoading
    ? 'thinking'
    : speaking
    ? 'talking'
    : 'idle';

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
      <style>{`
        @media (max-width: 900px) {
          .banco-body { flex-direction: column !important; }
          .banco-avatar-col { position: static !important; width: 100% !important; height: 380px !important; flex-basis: auto !important; }
        }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 12, color: '#475569' }}>
        <span style={{ cursor: 'pointer', color: '#60a5fa' }} onClick={() => setView('materias')}>
          Materias
        </span>
        <span>›</span>
        <span style={{ color: m.color, fontWeight: 600 }}>{m.label}</span>
        {temaFiltro !== 'Todas' && <><span>›</span><span style={{ color: '#94a3b8' }}>{temaFiltro}</span></>}
      </div>

      {/* Título */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          {m.label}&nbsp;|&nbsp;Preguntas de práctica
        </h2>
        <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
          {total} preguntas&nbsp;·&nbsp;Con explicación IA&nbsp;·&nbsp;Dificultad: Básica a Alta
        </p>
      </div>

      {/* Layout: columna principal + avatar sticky */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }} className="banco-body">
      <div style={{ flex: 1, minWidth: 0 }}>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Filtro tema */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {['Todas', ...m.temas].map(t => (
            <FilterBtn
              key={t}
              label={t}
              active={temaFiltro === t}
              color={m.color}
              onClick={() => applyFilter(t, difFiltro)}
            />
          ))}
        </div>
        {/* Filtro dificultad */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['Todas', 'MEDIA', 'ALTA', 'RETO'].map(d => {
            const dc = d === 'Todas' ? '#60a5fa' : (diffStyle(d).color);
            return (
              <FilterBtn
                key={d}
                label={d}
                active={difFiltro === d}
                color={dc}
                onClick={() => applyFilter(temaFiltro, d)}
                small
              />
            );
          })}
        </div>
      </div>

      {/* Panel visual flotante */}
      {visualPanel && (
        <QuestionVisualPanel
          question={visualPanel}
          onClose={() => setVisualPanel(null)}
        />
      )}

      {/* Listado de preguntas */}
      <div>
          {loading && preguntas.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 13 }}>
              Cargando preguntas...
            </div>
          )}

          {!loading && preguntas.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 13 }}>
              No hay preguntas para los filtros seleccionados.
            </div>
          )}

          {preguntas.map((p, idx) => (
            <QuestionCard
              key={p.id}
              p={p}
              idx={skipOffset + idx}
              materia={m}
              viewed={viewed.has(p.id)}
              speaking={speaking === p.id}
              audioLoading={audioLoading === p.id}
              played={played.has(p.id)}
              showExplanation={explanationShown.has(p.id)}
              onVisual={openVisualPanel}
              onSpeak={handleSpeak}
            />
          ))}

          {/* Cargar más */}
          {preguntas.length < total && (
            <button
              onClick={loadMore}
              disabled={loading}
              style={{
                width: '100%', padding: 12,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 8, color: '#475569', fontSize: 12,
                cursor: loading ? 'wait' : 'pointer', marginBottom: 16,
              }}
            >
              {loading ? 'Cargando...' : `Cargar más (${total - preguntas.length} restantes)`}
            </button>
          )}

          {/* Barra de progreso */}
          <div style={{
            background: 'rgba(12,18,38,0.8)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '12px 16px', marginTop: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Tu progreso en {m.label}</span>
              <span style={{ fontSize: 11, color: m.color }}>{progressPct}% ({viewedCount}/{total})</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }}>
              <div style={{
                width: `${progressPct}%`, height: '100%',
                background: m.color, borderRadius: 3, transition: 'width 0.4s',
              }} />
            </div>
          </div>
        </div>
      </div>{/* fin columna principal */}

      {/* ── PANEL DERECHO: AVATAR TUTOR IA ──────────────────────────────── */}
      <div
        className="banco-avatar-col"
        style={{
          flex: '0 0 320px',
          position: 'sticky',
          top: 72,
          height: 'calc(100vh - 100px)',
          minHeight: 460,
        }}
      >
        <AvatarTutorIA
          text={currentReadText || m.label}
          gender={g}
          autoPlay={false}
          externalState={avatarState as any}
          label="Tutor IA · Banco de Preguntas"
        />
      </div>

      </div>{/* fin banco-body */}
    </div>
  );
}

// =============================================================================
//  Sub-componentes
// =============================================================================

// ── Tarjeta de materia ────────────────────────────────────────────────────────
function MateriaCard({ m, onSelect }: { m: Materia; onSelect: (m: Materia) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={() => onSelect(m)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'rgba(12,18,38,0.8)',
        border: `1.5px solid ${hover ? m.color + 'a0' : m.color + '30'}`,
        borderRadius: 14, padding: '20px 22px',
        cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.label}</span>
        <span style={{
          fontSize: 11, fontWeight: 600, color: m.color,
          background: `${m.color}15`, border: `1px solid ${m.color}30`,
          borderRadius: 20, padding: '2px 10px',
        }}>
          {m.total} preguntas
        </span>
      </div>
      <div style={{ marginBottom: 16 }}>
        {m.temas.map(t => (
          <div key={t} style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
            - {t}{m.tema_counts[t] ? ` (${m.tema_counts[t]})` : ''}
          </div>
        ))}
      </div>
      <button
        style={{
          padding: '6px 16px', background: 'transparent',
          border: `1px solid ${m.color}50`, borderRadius: 8,
          color: m.color, fontSize: 12, cursor: 'pointer',
          pointerEvents: 'none',
        }}
      >
        Ver preguntas →
      </button>
    </div>
  );
}

// ── Botón de filtro ───────────────────────────────────────────────────────────
function FilterBtn({
  label, active, color, onClick, small = false,
}: { label: string; active: boolean; color: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '4px 10px' : '5px 14px',
        borderRadius: small ? 6 : 20,
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.09)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : '#64748b',
        fontSize: 11, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

// ── Tarjeta de pregunta ───────────────────────────────────────────────────────
// ── Mini componente fórmula MathJax ───────────────────────────────────────────
function FormulaBox({ tex, isLatex, label, vars, color }: {
  tex: string; isLatex: boolean; label: string; vars?: string; color: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !isLatex) return;
    ref.current.innerHTML = `\\[${tex}\\]`;
    try { MathJax.typesetPromise([ref.current]).catch(() => {}); } catch {}
  }, [tex, isLatex]);

  return (
    <div style={{
      background: '#0d1117', border: `1px solid ${color}40`,
      borderRadius: 10, padding: '12px 16px', marginTop: 10,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.08em', marginBottom: 6 }}>
        🧮 FÓRMULA — {label.toUpperCase()}
      </div>
      {isLatex
        ? <div ref={ref} style={{ color, fontSize: 15, textAlign: 'center', minHeight: 36 }} />
        : <div style={{ fontSize: 13, color, fontFamily: 'monospace', textAlign: 'center', padding: '6px 0' }}>{tex}</div>
      }
      {vars && (
        <div style={{ fontSize: 11, color: '#6e7681', marginTop: 8, lineHeight: 1.6 }}>{vars}</div>
      )}
    </div>
  );
}

// ── Tarjeta de pregunta ───────────────────────────────────────────────────────
function QuestionCard({
  p, idx, materia, viewed: isViewed,
  speaking, audioLoading, played, showExplanation,
  onVisual, onSpeak,
}: {
  p: Pregunta; idx: number; materia: Materia;
  viewed: boolean;
  speaking: boolean; audioLoading: boolean; played: boolean; showExplanation: boolean;
  onVisual: (p: Pregunta) => void;
  onSpeak:  (p: Pregunta) => void;
}) {
  const [selected,    setSelected]    = useState<string | null>(null); // opción elegida
  const [showFormula, setShowFormula] = useState(false);
  const dc  = diffStyle(p.dificultad);
  const pf  = getPureFormula(p.area, p.enunciado);

  // Cuando el alumno elige una opción → revelar resultado + fórmula
  const answered = selected !== null;
  const isRight  = selected === p.respuesta;

  // Fórmula automática al terminar el audio O al responder
  // Fórmula y explicación SOLO cuando el alumno selecciona una opción
  useEffect(() => { if (answered && pf) setShowFormula(true); }, [answered]);

  const qvp = {
    id: p.id, stem: p.enunciado, area: p.area,
    points: 1, difficulty: p.dificultad, options: p.opciones,
  };

  return (
    <div style={{
      background: 'rgba(12,18,38,0.8)',
      border: `1px solid ${isViewed ? materia.color + '40' : 'rgba(255,255,255,0.07)'}`,
      borderLeft: `3px solid ${isViewed ? materia.color + '80' : 'transparent'}`,
      borderRadius: 12, padding: '18px 20px', marginBottom: 12,
      transition: 'border-color 0.2s',
    }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: materia.color }}>Pregunta #{idx + 1}</span>
          {p.codigo && <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{p.codigo}</span>}
          <span style={{ fontSize: 10, color: '#475569' }}>{p.tema}</span>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 700, color: dc.color,
          background: dc.bg, border: `1px solid ${dc.color}30`,
          padding: '2px 8px', borderRadius: 10,
        }}>
          {p.dificultad}
        </span>
      </div>

      {/* Enunciado */}
      <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, marginBottom: 10 }}>{p.enunciado}</p>

      {/* Visual inline */}
      <QuestionInlineVisual question={qvp} color={materia.color} />

      {/* Instrucción cuando el audio ya se escuchó */}
      {played && !answered && (
        <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', margin: '10px 0 6px', textAlign: 'center' }}>
          ← Selecciona tu respuesta →
        </div>
      )}

      {/* Opciones — clickeables si ya escuchó el audio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, marginTop: 10 }}>
        {p.opciones.map(o => {
          const isCorrect  = o.label === p.respuesta;
          const isSelected = o.label === selected;

          // Colores según estado
          let bg = 'rgba(255,255,255,0.02)';
          let border = 'rgba(255,255,255,0.06)';
          let textColor = '#94a3b8';

          if (answered) {
            if (isCorrect) { bg = 'rgba(63,185,80,0.12)'; border = 'rgba(63,185,80,0.4)'; textColor = '#3fb950'; }
            else if (isSelected) { bg = 'rgba(248,81,73,0.10)'; border = 'rgba(248,81,73,0.4)'; textColor = '#f87171'; }
          } else if (isSelected) {
            bg = `${materia.color}12`; border = `${materia.color}60`; textColor = materia.color;
          }

          return (
            <button
              key={o.label}
              onClick={() => { if (!answered) setSelected(o.label); }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 12px', borderRadius: 6, width: '100%', textAlign: 'left',
                background: bg, border: `1px solid ${border}`,
                cursor: answered ? 'default' : 'pointer',
                transition: 'all 0.18s',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, width: 18, flexShrink: 0, marginTop: 1, color: answered ? (isCorrect ? '#3fb950' : isSelected ? '#f87171' : '#475569') : materia.color }}>
                {o.label}
              </span>
              <span style={{ fontSize: 12, color: textColor, flex: 1, lineHeight: 1.55 }}>{o.text}</span>
              {answered && isCorrect  && <span style={{ fontSize: 10, color: '#3fb950', fontWeight: 700, flexShrink: 0 }}>✓ Correcta</span>}
              {answered && isSelected && !isCorrect && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, flexShrink: 0 }}>✗ Incorrecta</span>}
            </button>
          );
        })}
      </div>

      {/* Feedback inmediato al responder */}
      {answered && (
        <div style={{
          padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600,
          background: isRight ? 'rgba(63,185,80,0.08)' : 'rgba(248,81,73,0.08)',
          border: `1px solid ${isRight ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)'}`,
          color: isRight ? '#3fb950' : '#f87171',
        }}>
          {isRight
            ? '¡Excelente! Respondiste correctamente. ¡Eso es lo que hay!'
            : `No te rindas. La respuesta correcta es la opción ${p.respuesta}. Aquí abajo tienes la fórmula resuelta y la explicación completa.`}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => onVisual(p)}
          style={{
            padding: '6px 14px', background: 'transparent',
            border: '1px solid rgba(96,165,250,0.35)', borderRadius: 8,
            color: '#60a5fa', fontSize: 11, cursor: 'pointer',
          }}
        >
          📐 Ver guía visual
        </button>
        {/* Botón audio: solo disponible si no se ha reproducido aún */}
        {!played ? (
          <button
            onClick={() => onSpeak(p)}
            disabled={speaking || audioLoading}
            style={{
              padding: '6px 14px',
              background: (speaking || audioLoading) ? 'rgba(52,211,153,0.12)' : 'transparent',
              border: `1px solid ${(speaking || audioLoading) ? 'rgba(52,211,153,0.5)' : 'rgba(52,211,153,0.25)'}`,
              borderRadius: 8, color: '#34d399', fontSize: 11,
              cursor: (speaking || audioLoading) ? 'wait' : 'pointer',
              opacity: (speaking || audioLoading) ? 0.8 : 1,
            }}
          >
            {audioLoading ? '⏳ Generando audio...' : speaking ? '🔊 Reproduciendo...' : '🔊 Escuchar explicación'}
          </button>
        ) : (
          <span style={{
            padding: '6px 14px', fontSize: 11, color: '#34d399',
            background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
            borderRadius: 8,
          }}>
            ✓ Audio reproducido
          </span>
        )}
        {pf && (
          <button
            onClick={() => setShowFormula(f => !f)}
            style={{
              padding: '6px 14px', background: 'transparent',
              border: '1px solid rgba(210,153,34,0.3)',
              borderRadius: 8, color: '#d29922', fontSize: 11, cursor: 'pointer',
            }}
          >
            {showFormula ? 'Ocultar fórmula' : '🧮 Ver fórmula'}
          </button>
        )}
      </div>

      {/* ── Fórmula MathJax — aparece tras el audio ── */}
      {showFormula && pf && (
        <FormulaBox tex={pf.tex} isLatex={pf.isLatex} label={pf.label} vars={pf.vars} color={materia.color} />
      )}

      {/* ── Explicación completa — aparece al terminar el audio ── */}
      {answered && (
        <div style={{
          marginTop: 14,
          background: 'rgba(12,18,38,0.95)',
          border: `1px solid ${materia.color}30`,
          borderLeft: `3px solid ${materia.color}`,
          borderRadius: 10, padding: '14px 16px',
          animation: 'fadeIn 0.5s ease',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: materia.color, letterSpacing: '.08em', marginBottom: 10 }}>
            📋 EXPLICACIÓN COMPLETA
          </div>

          {/* Respuesta correcta destacada */}
          <div style={{
            background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.25)',
            borderRadius: 8, padding: '8px 12px', marginBottom: 10,
            fontSize: 12, color: '#3fb950', fontWeight: 600,
          }}>
            ✓ Respuesta correcta — Opción {p.respuesta}:{' '}
            <span style={{ fontWeight: 400 }}>
              {p.opciones.find(o => o.label === p.respuesta)?.text}
            </span>
          </div>

          {/* Explicación del banco */}
          {p.explicacion && (
            <p style={{ fontSize: 13, color: '#c9d1d9', lineHeight: 1.75, margin: '0 0 10px' }}>
              {p.explicacion}
            </p>
          )}

          {/* Pasos de razonamiento */}
          <div style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6, color: '#94a3b8', fontWeight: 600 }}>Método paso a paso:</div>
            {['Identifica los datos que te dan en el enunciado.',
              'Elige la fórmula o concepto que aplica al tipo de problema.',
              'Sustituye los valores con cuidado, sin saltarte pasos.',
              'Verifica que tu resultado tenga sentido con las unidades y el contexto.',
            ].map((paso, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: materia.color, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span>{paso}</span>
              </div>
            ))}
          </div>

          {/* Mensaje motivacional */}
          <div style={{
            marginTop: 12, padding: '8px 12px',
            background: `${materia.color}08`, border: `1px solid ${materia.color}20`,
            borderRadius: 8, fontSize: 12, color: materia.color, fontStyle: 'italic',
          }}>
            🌟 ¡Tú puedes! Sigue practicando esta fórmula y cada vez te saldrá más natural.
          </div>
        </div>
      )}
    </div>
  );
}

