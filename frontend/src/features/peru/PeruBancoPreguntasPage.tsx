// =============================================================================
//  PeruBancoPreguntasPage.tsx — Banco de Preguntas UNT con tutor IA peruano
//  Mismo formato que Colombia: Audio + Avatar + Fórmulas + Explicaciones
// =============================================================================
import React, { useState, useEffect, useRef } from 'react'
import { useScreenGuide } from '../audio/AudioGuide'
import QuestionInlineVisual, { getPureFormula } from '../exam/QuestionInlineVisual'
import AvatarTutorIA from '../avatar/AvatarTutorIA'

declare const MathJax: { typesetPromise: (nodes?: HTMLElement[]) => Promise<void> }

const API = 'https://ifces-production.up.railway.app/api/v1'
const LIMIT = 20

interface Materia {
  key: string; label: string; color: string; total: number
  temas: string[]; tema_counts: Record<string, number>
}
interface Opcion { label: string; text: string }
interface Pregunta {
  id: string; codigo: string; area: string; tema: string; seccion: string
  enunciado: string; opciones: Opcion[]; respuesta: string
  explicacion: string; dificultad: string
}
type View = 'materias' | 'preguntas'

interface Props {
  user: { id: string; full_name: string; plan_code?: string }
  onBack: () => void
}

const SECCION_COLORS: Record<string, string> = {
  A: '#2563eb', B: '#16a34a', C: '#ca8a04', D: '#dc2626',
}

// =============================================================================
export default function PeruBancoPreguntasPage({ user, onBack }: Props) {
  useScreenGuide('banco_pe', 1000)
  const [view,             setView]             = useState<View>('materias')
  const [materias,         setMaterias]         = useState<Materia[]>([])
  const [materia,          setMateria]          = useState<Materia | null>(null)
  const [preguntas,        setPreguntas]        = useState<Pregunta[]>([])
  const [total,            setTotal]            = useState(0)
  const [skipOffset,       setSkipOffset]       = useState(0)
  const [loading,          setLoading]          = useState(false)
  const [viewed,           setViewed]           = useState<Set<string>>(new Set())
  const [speaking,         setSpeaking]         = useState<string | null>(null)
  const [audioLoading,     setAudioLoading]     = useState<string | null>(null)
  const [played,           setPlayed]           = useState<Set<string>>(new Set())
  const [explanationShown, setExplanationShown] = useState<Set<string>>(new Set())
  const [currentReadText,  setCurrentReadText]  = useState('')
  const audioRef      = useRef<HTMLAudioElement | null>(null)
  const voicesRef     = useRef<SpeechSynthesisVoice[]>([])
  const speakToken    = useRef(0)
  const saludoCounter = useRef(0)   // secuencial — nunca repite en orden

  function cancelAudio() {
    speakToken.current += 1
    window.speechSynthesis?.cancel()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setSpeaking(null); setAudioLoading(null)
  }

  useEffect(() => {
    fetchMaterias()
    const loadVoices = () => { voicesRef.current = window.speechSynthesis?.getVoices() || [] }
    loadVoices()
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = loadVoices
    return () => { cancelAudio() }
  }, [])

  async function fetchMaterias() {
    try {
      const res = await fetch(`${API}/peru/banco/materias`)
      if (res.ok) setMaterias(await res.json())
    } catch {}
  }

  async function fetchPreguntas(m: Materia, offset: number) {
    setLoading(true)
    try {
      const p = new URLSearchParams({ skip: String(offset), limit: String(LIMIT) })
      const res = await fetch(`${API}/peru/banco/materias/${encodeURIComponent(m.key)}/preguntas?${p}`)
      if (!res.ok) return
      const data = await res.json()
      if (offset === 0) setPreguntas(data.preguntas ?? [])
      else              setPreguntas(prev => [...prev, ...(data.preguntas ?? [])])
      setTotal(data.total ?? 0)
    } catch {}
    setLoading(false)
  }

  function openMateria(m: Materia) {
    setMateria(m); setSkipOffset(0); setPreguntas([])
    setView('preguntas')
    fetchPreguntas(m, 0)
  }

  function loadMore() {
    const next = skipOffset + LIMIT
    setSkipOffset(next)
    if (materia) fetchPreguntas(materia, next)
  }

  function onAudioFinished(id: string) {
    setSpeaking(null); setAudioLoading(null)
    setPlayed(prev => new Set([...prev, id]))
    setExplanationShown(prev => new Set([...prev, id]))
    setViewed(prev => new Set([...prev, id]))
  }

  // ── Limpieza de texto para TTS ───────────────────────────────────────────────
  function cleanForSpeech(text: string): string {
    const MATH: Record<string, string> = {
      '∴': ' por lo tanto, ', '→': ', entonces, ', '≈': ' aproximadamente ',
      '≠': ' diferente de ', '≤': ' menor o igual a ', '≥': ' mayor o igual a ',
      '×': ' por ', '÷': ' dividido entre ', '±': ' más o menos ', '°': ' grados',
      '∫': ' integral de ', '√': ' raíz cuadrada de ', '∞': ' infinito',
      '∑': ' suma de ', 'α': ' alfa', 'β': ' beta', 'π': ' pi', 'Δ': ' delta',
      '²': ' al cuadrado', '³': ' al cubo', '½': ' un medio', '¼': ' un cuarto',
    }
    let t = text
    for (const [sym, word] of Object.entries(MATH)) t = t.split(sym).join(word)
    t = t
      .replace(/Tema:\s*([^.]+)\./gi, 'El tema es $1.')
      .replace(/\b(RE|Te|dim|sto|ste|ma|co|ob|igu|res|bá|rec|las)\s+(?=[A-ZÁÉÍÓÚ])/g, ' ')
      .replace(/\bVerdadero\b/g, 'Verdadero.')
      .replace(/\bFalso\b/g, 'Falso.')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+\d{1,3}\s*$/, '.')
      .trim()
    return t
  }

  // ── Descripción oral de fórmula ───────────────────────────────────────────────
  function formulaToSpeech(pf: NonNullable<ReturnType<typeof getPureFormula>>): string {
    const vars = pf.vars ? ` Donde: ${pf.vars}.` : ''
    return `La fórmula que necesitas aquí es la de ${pf.label}.${vars}`
  }

  // ── Voz masculina peruana ─────────────────────────────────────────────────────
  function pickPeruvianVoice(): SpeechSynthesisVoice | null {
    const all = voicesRef.current.length ? voicesRef.current : (window.speechSynthesis?.getVoices() || [])
    const MALE_NAMES   = ['raúl','raul','jorge','diego','carlos','miguel','pablo',
                          'andres','juan','antonio','rodrigo','sergio','male','hombre','man','masculino',
                          'alvaro','alvaro','ricardo','luis','victor','alberto','gustavo']
    const FEMALE_NAMES = ['angela','maria','lucia','sofia','elena','laura','isabel','valentina',
                          'ana','female','mujer','woman','femenino','dalia','marisol','sabina',
                          'conchita','esperanza','monica','paula','andrea']
    const score = (v: SpeechSynthesisVoice) => {
      let s = 0
      const n = v.name.toLowerCase(), lang = v.lang.toLowerCase()
      // 1. GÉNERO — prioridad máxima absoluta
      if (MALE_NAMES.some(m => n.includes(m)))   s += 500   // voz masculina → gana siempre
      if (FEMALE_NAMES.some(f => n.includes(f))) s -= 500   // voz femenina  → descartada
      // 2. Idioma (secundario al género)
      if (lang === 'es-pe' || /peru/i.test(n)) s += 80
      else if (lang.startsWith('es-'))          s += 40
      else if (lang.startsWith('es'))           s += 20
      // 3. Calidad
      if (/neural|natural|enhanced|premium/i.test(n)) s += 15
      return s
    }
    const spanish = all.filter(v => /^es/i.test(v.lang))
    if (!spanish.length) return all[0] ?? null
    return spanish.sort((a, b) => score(b) - score(a))[0]
  }

  function speakWithBrowser(id: string, partes: string[]) {
    if (!('speechSynthesis' in window)) { onAudioFinished(id); return }
    const voz   = pickPeruvianVoice()
    const token = speakToken.current
    let idx     = 0
    const next  = () => {
      if (speakToken.current !== token) return
      if (idx >= partes.length) { onAudioFinished(id); return }
      const utt   = new SpeechSynthesisUtterance(partes[idx])
      utt.lang    = 'es-PE'
      utt.rate    = 0.88     // Más lento = más claro
      utt.pitch   = 0.80     // Más grave = más masculino
      utt.volume  = 1
      if (voz) utt.voice = voz
      utt.onstart = () => { if (speakToken.current === token && idx === 0) setSpeaking(id) }
      utt.onend   = () => { idx++; next() }
      utt.onerror = () => { if (speakToken.current === token) onAudioFinished(id) }
      window.speechSynthesis.speak(utt)
    }
    next()
  }

  // ── 200 frases motivacionales peruanas — nunca repetidas en secuencia ────────
  const nombre = user.full_name?.split(' ')[0] || 'estudiante'
  const SALUDOS_PE = [
    `¡Hola ${nombre}! Qué bacán que estés practicando. Yo te explico esta pregunta paso a paso. ¡Tú puedes!`,
    `¡Causita ${nombre}! Estás aquí estudiando y eso ya es ganársela. Vamos con esta pregunta juntos.`,
    `${nombre}, cada minuto de estudio hoy es un punto ganado en el examen. ¡Escúchame y aprende esto bien!`,
    `¡Oe ${nombre}! No existe pregunta imposible cuando entiendes el concepto. Yo te lo explico clarito.`,
    `¡Hola ${nombre}! Los crack del examen de admisión no nacen, se hacen practicando. ¡Sigue así!`,
    `${nombre}, qué chévere que estés aquí. Esta pregunta tiene su gracia y yo te la descubro ahora mismo.`,
    `¡Oe pata ${nombre}! Tu esfuerzo de hoy te abre las puertas de la universidad. ¡Vamos con esta!`,
    `${nombre}, soy tu tutor y juntos vamos a dominar esta pregunta. No te rindas, que la entendemos.`,
    `¡Qué crack eres, ${nombre}! Estar practicando cuando otros no estudian marca la diferencia.`,
    `¡Hola ${nombre}! Esta pregunta viene en el examen sí o sí. Apréndela hoy y gánala el día del examen.`,
    `${nombre}, el camino a la UNT se recorre pregunta por pregunta. Ya tienes una más. ¡Vamos!`,
    `¡Bacán ${nombre}! Tu constancia es tu mayor fuerza. Escucha bien y entenderás esto fácil.`,
    `¡Oe ${nombre}! Los que ingresan a la universidad son los que practican todos los días. ¡Tú eres uno de ellos!`,
    `${nombre}, esta pregunta parece complicada pero tiene su lógica bonita. Deja que te la cuento.`,
    `¡Hola ${nombre}! No hay pregunta que un peruano estudioso no pueda dominar. ¡Adelante!`,
    `${nombre}, eres más inteligente de lo que crees. Esta pregunta solo necesita que la entiendas bien.`,
    `¡Oe causita ${nombre}! Tu futuro profesional depende de momentos como este. ¡Con todo!`,
    `¡Hola ${nombre}! Cada pregunta que resuelves es una victoria chiquita. Suma victorias hoy.`,
    `${nombre}, yo creo en ti más de lo que crees. Esta pregunta la dominas. Escúchame.`,
    `¡Oe ${nombre}! Recuerda: la universidad te espera. Hoy practicamos para que ese día llegue. ¡Vamos!`,
    `¡Hola ${nombre}! Esta pregunta es de las que diferencian a los que ingresan. Apréndela bien.`,
    `${nombre}, qué bien que no te rendiste. La constancia vence al talento. Escucha esta explicación.`,
    `¡Oe pata ${nombre}! Muchos sueñan con entrar a la universidad pero tú lo estás trabajando. ¡Qué crack!`,
    `¡Hola ${nombre}! Yo estoy aquí para que no haya pregunta que te sorprenda en el examen. ¡Escucha!`,
    `${nombre}, el conocimiento que adquieres hoy nadie te lo quita. ¡Aprendamos esto juntos!`,
    `¡Hola ${nombre}! Esta pregunta tiene un concepto clave. Cuando lo entiendes, todo lo demás fluye. ¡Vamos!`,
    `${nombre}, los campeones también estudian. Y tú eres un campeón en potencia. ¡Escucha!`,
    `¡Oe ${nombre}! En cada pregunta hay una oportunidad de aprender algo nuevo. Aquí va la de hoy.`,
    `¡Hola ${nombre}! La diferencia entre los que pasan y los que no, es la práctica diaria. ¡Tú sí practicas!`,
    `${nombre}, no subestimes esta pregunta. Tiene su ciencia. Yo te la explico y ya no te va a ganar.`,
    `¡Oe causita ${nombre}! La universidad que sueñas te espera. ¡Sigue practicando!`,
    `¡Hola ${nombre}! El examen de admisión no es un obstáculo, es tu trampolín al éxito. ¡Salta con esta!`,
    `${nombre}, cada respuesta incorrecta que entiendes es un punto ganado en el futuro. ¡Escucha bien!`,
    `¡Oe ${nombre}! Tu mamá, tu papá, tu familia. Todos confían en ti. Aprendamos esto para ellos.`,
    `¡Hola ${nombre}! Qué honor practicar contigo. Esta pregunta te esperaba. ¡Vamos con todo!`,
    `${nombre}, el estudio es la inversión más rentable que existe. Esta pregunta te da retorno de por vida.`,
    `¡Oe pata ${nombre}! Ya falta menos para el examen. Cada pregunta que dominas es una menos que temer.`,
    `¡Hola ${nombre}! Esta pregunta tiene el nivel perfecto para practicar. Escucha y aprende.`,
    `${nombre}, los peruanos tenemos capacidad para todo. Esta pregunta es solo un ejemplo. ¡Adelante!`,
    `¡Oe ${nombre}! No pares. Los sueños se hacen realidad con esfuerzo diario. Escucha esta explicación.`,
    `¡Hola ${nombre}! Esta pregunta está lista para ser tuya. Yo te la entrego ahora mismo.`,
    `${nombre}, el cerebro aprende mejor cuando está motivado. Óyeme: ¡tú eres un crack y esto lo aprendes!`,
    `¡Oe causita ${nombre}! No te compares con otros. Compárate con quien eras ayer y sigue mejorando.`,
    `¡Hola ${nombre}! Esta pregunta apareció en el examen real. Por eso es importante que la entiendas.`,
    `${nombre}, médico, ingeniero, abogado. Sea lo que sueñas, empieza aquí. ¡Escucha!`,
    `¡Oe ${nombre}! Estudiar con tutor es la manera más inteligente de prepararse. ¡Aprovecha!`,
    `¡Hola ${nombre}! La explicación de esta pregunta te va a ayudar en cinco similares. ¡Oro puro!`,
    `${nombre}, cuando llega el examen, los que estudiaron con método ganan. ¡Ese método lo aprendemos aquí!`,
    `¡Oe pata ${nombre}! Anota lo que aprendas. El conocimiento anotado es conocimiento guardado.`,
    `¡Hola ${nombre}! Aquí va una pregunta importante. Presta toda tu atención. ¡La entenderás!`,
    `${nombre}, los retos académicos se convierten en victorias para quienes perseveran.`,
    `¡Oe ${nombre}! Esta pregunta la puedes con los ojos cerrados una vez que la entiendes.`,
    `¡Hola ${nombre}! Hoy estás un paso más cerca de tu universidad. Esta pregunta suma a ese camino.`,
    `${nombre}, recuerda: el esfuerzo de hoy es el título universitario de mañana. ¡Sigue adelante!`,
    `¡Oe causita ${nombre}! Este tipo de pregunta sale siempre. Dominarla es obligatorio. ¡Aprende!`,
    `¡Hola ${nombre}! Tu dedicación me inspira. Vamos a hacer justicia a ese esfuerzo. ¡Escucha bien!`,
    `${nombre}, en el examen no hay suerte, hay preparación. Y tú estás preparándote ahora mismo. ¡Bien!`,
    `¡Oe ${nombre}! Esta pregunta tiene un secreto que muy pocos conocen. Yo te lo digo ahora.`,
    `¡Hola ${nombre}! La universidad peruana necesita estudiantes como tú. ¡No la decepciones, llega!`,
    `${nombre}, practicar con explicaciones es cuatro veces más efectivo que solo memorizar. ¡Escúchame!`,
    `¡Oe pata ${nombre}! Qué orgulloso me siento de verte estudiar. Esta explicación te la dedico.`,
    `¡Hola ${nombre}! Las mejores mentes del Perú también tuvieron que practicar. Estás en el camino correcto.`,
    `${nombre}, no existe obstáculo que el conocimiento no pueda superar. Esta pregunta lo demuestra.`,
    `¡Oe ${nombre}! La UNT, la UNSA, la UNI, la UNMSM: la que sueñas te espera. ¡Sigue practicando!`,
    `¡Hola ${nombre}! Esta explicación es tu arma secreta para el examen. Escúchala bien.`,
    `${nombre}, el éxito académico no es suerte. Es esto: practicar, entender, repetir. ¡Hazlo!`,
    `¡Oe causita ${nombre}! Cinco minutos de escuchar esta explicación pueden valer un punto en el examen.`,
    `¡Hola ${nombre}! Mira lejos. Más allá del examen está tu carrera, tu futuro. Esta pregunta te acerca.`,
    `${nombre}, los que no se rinden llegan. Los que llegan, transforman. ¡Sé uno de ellos!`,
    `¡Oe ${nombre}! Esta pregunta la van a poner en el examen. Si la entiendes hoy, la ganas seguro.`,
    `¡Hola ${nombre}! Sé que hay días difíciles. Pero hoy estás aquí y eso es lo que vale. ¡Escucha!`,
    `${nombre}, tu historia de éxito empieza con pequeños momentos de aprendizaje como este.`,
    `¡Oe pata ${nombre}! El Perú necesita profesionales preparados. Tú puedes ser uno. ¡Sigue!`,
    `¡Hola ${nombre}! Esta pregunta tiene todo para ser interesante. Deja que te cuento por qué.`,
    `${nombre}, aprender a resolver un problema de examen es aprender a pensar mejor en la vida.`,
    `¡Oe ${nombre}! Tu cerebro en este momento está creando conexiones nuevas. ¡El aprendizaje está pasando!`,
    `¡Hola ${nombre}! Yo no te dejo hasta que entiendas esto. ¡Somos equipo!`,
    `${nombre}, la diferencia entre soñar y lograr es una palabra: acción. Y tú estás actuando ahora. ¡Bien!`,
    `¡Oe causita ${nombre}! Si este examen de admisión fuera fácil, no valdría la pena. Tú puedes con él.`,
    `¡Hola ${nombre}! Esta es la pregunta del día. Apréndetela como si fuera oro. ¡Va a caer en el examen!`,
    `${nombre}, soy tu tutor y mi misión es que tú ingreses a la universidad. ¡Esta pregunta es clave!`,
    `¡Oe ${nombre}! Una pregunta bien entendida vale más que diez memorizadas. ¡Entiende esta!`,
    `¡Hola ${nombre}! Tu potencial es ilimitado. Esta pregunta es solo un pequeño ejemplo de lo que puedes.`,
    `${nombre}, el conocimiento que ganas hoy lo usarás mañana, pasado y siempre. ¡Apréndelo bien!`,
    `¡Oe pata ${nombre}! Tú sabes más de lo que crees. Esta pregunta solo necesita que apliques lo que sabes.`,
    `¡Hola ${nombre}! Esta es mi explicación favorita de este tema. Escúchala con atención.`,
    `${nombre}, en el examen no habrá tiempo para dudar. Por eso practicamos ahora. ¡Aprendamos esto!`,
    `¡Oe ${nombre}! El conocimiento es el único tesoro que nadie te puede robar. ¡Acumula hoy!`,
    `¡Hola ${nombre}! Esta pregunta tiene un concepto que se repite mucho en la UNT. ¡Domínala!`,
    `${nombre}, los grandes profesionales del Perú también estuvieron donde tú estás. ¡Sigue su camino!`,
    `¡Oe causita ${nombre}! No es que seas malo en esto. Es que aún no lo has entendido bien. ¡Yo te ayudo!`,
    `¡Hola ${nombre}! Esta pregunta es tu aliada una vez que la dominas. Deja que te la presento bien.`,
    `${nombre}, recuerda siempre: la universidad es el primer escalón a tus sueños. ¡Súbelo!`,
    `¡Oe ${nombre}! El examen de admisión es un juego que se gana con preparación. ¡Estás jugando bien!`,
    `¡Hola ${nombre}! Esta explicación te va a ahorrar muchos errores en el examen real. ¡Escúchame!`,
    `${nombre}, cada pregunta tiene su corazón, su esencia. Hoy yo te la encuentro para ti.`,
    `¡Oe pata ${nombre}! Ya sé que a veces es cansador estudiar. Pero vale la pena. ¡Escucha y verás!`,
    `¡Hola ${nombre}! Esta pregunta te va a parecer más fácil después de escuchar la explicación. ¡Confía!`,
    `${nombre}, los talentos se desarrollan. Hoy desarrollamos el tuyo con esta pregunta. ¡Vamos!`,
    `¡Oe ${nombre}! Esta pregunta es especial. ¡Escucha con todo!`,
    `¡Hola ${nombre}! Desde el norte hasta el sur del Perú, los estudiantes como tú hacen grande a la nación.`,
    `${nombre}, tu esfuerzo de hoy va a mover montañas mañana. Esta pregunta es parte del camino.`,
    `¡Oe ${nombre}! Esta pregunta tiene su dificultad pero también su método. Yo te doy el método ahora.`,
    `¡Hola ${nombre}! Los peruanos somos resilientes y creativos. Esas son tus mejores herramientas aquí.`,
    `${nombre}, el que busca, encuentra. El que practica, aprende. Tú estás practicando. ¡Bien!`,
    `¡Oe causita ${nombre}! Esta explicación es como un mapa del tesoro. El tesoro es la respuesta correcta.`,
    `¡Hola ${nombre}! No te preocupes si aún no sabes la respuesta. Para eso estoy yo aquí.`,
    `${nombre}, la curiosidad es el motor del aprendizaje. Esta pregunta te invita a ser curioso. ¡Escucha!`,
    `¡Oe ${nombre}! La práctica hace al maestro. Y en el examen de admisión, tú vas a ser el maestro.`,
    `¡Hola ${nombre}! Cada vez que practicas, tu cerebro guarda la información mejor. ¡Sigue practicando!`,
    `${nombre}, no hay examen que resista a un estudiante bien preparado. ¡Tú eres ese estudiante!`,
    `¡Oe pata ${nombre}! Esta pregunta tiene historia. Cuando la entiendes, entiendes más que solo la respuesta.`,
    `¡Hola ${nombre}! Hoy aprenderás algo que te acompañará mucho tiempo. ¡Escucha con atención!`,
    `${nombre}, ser estudiante universitario es posible para ti. Esta pregunta te acerca a ello. ¡Escucha!`,
    `¡Oe ${nombre}! Los buenos estudiantes hacen parecer fácil lo difícil. ¿Sabes por qué? Lo practican.`,
    `¡Hola ${nombre}! Esta explicación está hecha especialmente para ti. Con cariño y precisión. ¡Escúchame!`,
    `${nombre}, un día vas a recordar este momento como el inicio de tu historia universitaria. ¡Escucha!`,
    `¡Oe causita ${nombre}! Esta pregunta es de práctica pero tiene el mismo nivel que el examen real. ¡Aprende!`,
    `¡Hola ${nombre}! Tu motivación es lo más poderoso que tienes. Úsala ahora. Escucha esta explicación.`,
    `${nombre}, paso a paso, pregunta a pregunta, así se construye el éxito académico. ¡Construye hoy!`,
    `¡Oe ${nombre}! Cuando entiendas esta pregunta, sentirás esa satisfacción de dominar algo nuevo. ¡Vamos!`,
    `¡Hola ${nombre}! Esta es la clase que el colegio no siempre da pero el examen sí evalúa. ¡Aprende aquí!`,
    `${nombre}, en Perú hay mucho talento. Tú eres parte de ese talento. Esta pregunta lo demuestra.`,
    `¡Oe pata ${nombre}! El éxito no llega de casualidad sino de causalidad: estudias, ingresas.`,
    `¡Hola ${nombre}! Esta pregunta tiene su truco. Cuando lo sabes, nunca más la vas a errar. ¡Escúchame!`,
    `${nombre}, el camino a la universidad puede ser largo pero cada pregunta que dominas lo acorta.`,
    `¡Oe ${nombre}! Esta es mi pregunta favorita para enseñar este tema. Escúchame bien.`,
    `¡Hola ${nombre}! No importa tu nota anterior. Lo que importa es lo que aprendes ahora. ¡Avancemos!`,
    `${nombre}, el examen de admisión mide lo que sabes, no quién eres. Demuestra lo que sabes.`,
    `¡Oe causita ${nombre}! Esta explicación es como la llave de un candado. ¡Abre el conocimiento!`,
    `¡Hola ${nombre}! Cuanto más practicas, más fácil se vuelve. Esta pregunta te lo va a demostrar.`,
    `${nombre}, voy a explicarte esto de la manera más clara posible. Solo necesito tu atención completa.`,
    `¡Oe ${nombre}! Los que estudian hoy, mañana son los profesionales que transforman el Perú.`,
    `¡Hola ${nombre}! Esta pregunta apareció en el examen de admisión. Por eso la estudiamos ahora.`,
    `${nombre}, confía en el proceso. Cada pregunta que escuchas te prepara mejor. ¡Confía y escucha!`,
    `¡Oe pata ${nombre}! Yo he ayudado a muchos estudiantes como tú. Esta explicación también te ayudará.`,
    `¡Hola ${nombre}! El aprendizaje es la única inversión que nunca pierde valor. ¡Invierte ahora!`,
    `${nombre}, más allá del examen, entender estos conceptos te hace mejor pensador y profesional.`,
    `¡Oe ${nombre}! Esta pregunta tiene varias trampas. Yo te las muestro para que no caigas en ellas.`,
    `¡Hola ${nombre}! Prepárate para entender algo que muchos estudiantes no entienden. ¡Atención!`,
    `${nombre}, la perseverancia es la virtud que convierte los sueños en realidad. ¡Persevera aquí!`,
    `¡Oe causita ${nombre}! Una pregunta a la vez. Un concepto a la vez. Así se llega a la universidad.`,
    `¡Hola ${nombre}! Hoy tu cerebro va a agradecer haber escuchado esta explicación. ¡Escúchala!`,
    `${nombre}, no tengas miedo de no saber. El no saber es el inicio del aprender. ¡Escucha y aprende!`,
    `¡Oe ${nombre}! El examen de admisión te pregunta, tú le respondes. Practica la respuesta ahora.`,
    `¡Hola ${nombre}! Esta explicación es breve pero poderosa. Escucha cada palabra. ¡Vale oro!`,
    `${nombre}, los grandes estudiantes no son los que nunca se equivocan, sino los que aprenden del error.`,
    `¡Oe pata ${nombre}! Qué bueno practicar juntos. Esta pregunta nos une en el aprendizaje. ¡Escucha!`,
    `¡Hola ${nombre}! Esta pregunta te va a pedir que pienses. Y tú tienes esa capacidad. ¡Escucha!`,
    `${nombre}, la mitad del camino ya lo tienes recorrido por el simple hecho de estar aquí practicando.`,
    `¡Oe ${nombre}! Cada conocimiento nuevo que tienes es un ladrillo en el edificio de tu éxito.`,
    `¡Hola ${nombre}! Esta pregunta toca un tema que es importante para tu carrera también. ¡Escucha!`,
    `${nombre}, el futuro ${nombre} te va a agradecer haber practicado tanto hoy. ¡Sigue adelante!`,
    `¡Oe causita ${nombre}! Esta es la última vez que esta pregunta te va a sorprender. ¡Aprende hoy!`,
    `¡Hola ${nombre}! Escucha esta explicación como si fuera la primera vez que la oyes. ¡Atención total!`,
    `${nombre}, estudiar es el acto más valiente de un joven que quiere cambiar su historia. ¡Qué valiente!`,
    `¡Oe ${nombre}! Esta pregunta fue diseñada para evaluar si entiendes el concepto a fondo. ¡Demuéstralo!`,
    `¡Hola ${nombre}! Me alegra ser tu tutor hoy. Esta pregunta es mi regalo de conocimiento para ti.`,
    `${nombre}, la disciplina de estudiar todos los días separa a los que ingresan de los que no.`,
    `¡Oe pata ${nombre}! ¿Sabes qué? Esta pregunta es bacán porque te enseña a pensar diferente.`,
    `¡Hola ${nombre}! Escucha esto: tú tienes todo lo necesario para ingresar a la universidad. ¡Esta confirma!`,
    `${nombre}, el conocimiento te da libertad. Esta pregunta es una llave de esa libertad. ¡Tómala!`,
    `¡Oe ${nombre}! Hoy aprendiste muchas cosas. Esta es una más. ¡Súmala a tu arsenal!`,
    `¡Hola ${nombre}! Esta pregunta es como un rompecabezas. Yo te doy las piezas para que lo armes.`,
    `${nombre}, con cada pregunta que practicas, el examen de admisión se vuelve menos intimidante. ¡Sigue!`,
    `¡Oe causita ${nombre}! Tú no eres del promedio. Tú eres de los que se esfuerzan. ¡Escucha bien!`,
    `¡Hola ${nombre}! Esta pregunta es un clásico del examen UNT. Conócela y tendrá menos secretos.`,
    `${nombre}, no estudias para la nota. Estudias para el conocimiento. Y el conocimiento dura para siempre.`,
    `¡Oe ${nombre}! Los peruanos que han hecho historia también empezaron con preguntas como esta. ¡Sigue!`,
    `¡Hola ${nombre}! Esta es la explicación que hubieras querido escuchar antes. Aquí la tienes ahora.`,
    `${nombre}, la mente que aprende es la mente que crece. Tu mente está creciendo ahora mismo.`,
    `¡Oe pata ${nombre}! Este es el momento. Esta es la pregunta. Esta es la explicación. ¡Aprovéchala!`,
    `¡Hola ${nombre}! Entender esta pregunta te dará ventaja sobre los que no la estudiaron. ¡Escucha!`,
    `${nombre}, el conocimiento que construyes hoy nadie te lo quita en el examen. ¡Constrúyelo bien!`,
    `¡Oe ${nombre}! Tú eres la razón por la que este tutor existe. Para ayudarte a ingresar. ¡Escucha!`,
    `¡Hola ${nombre}! Esta explicación es un mapa del camino correcto para esta pregunta. ¡Síguelo!`,
    `${nombre}, practicar es creer en ti mismo. Y yo creo en ti tanto como tú crees en practicar.`,
    `¡Oe causita ${nombre}! Los errores de hoy en la práctica evitan los errores del día del examen. ¡Practica!`,
    `¡Hola ${nombre}! El secreto del éxito en el examen es simple: entender, no memorizar. Te enseño a entender.`,
    `${nombre}, esta pregunta viene con su historia. Entender la historia hace la respuesta obvia. ¡Escucha!`,
    `¡Oe ${nombre}! Tus padres trabajan por tu futuro. Tú trabajas con esta pregunta por ese mismo futuro.`,
    `¡Hola ${nombre}! Esta es una pregunta de las que hacen la diferencia en el examen. ¡Domínala!`,
    `${nombre}, el examen de admisión es solo un paso. Pero un paso importante. Esta pregunta te prepara.`,
    `¡Oe pata ${nombre}! Imagínate el día que ves tu nombre en la lista de ingresantes. ¡Trabaja por ese día!`,
    `¡Hola ${nombre}! Esta pregunta tiene la forma de una que siempre va a salir. ¡Reconócela y resuélvela!`,
    `${nombre}, estudiar es un acto de amor hacia tu propio futuro. ¡Cuánto te quieres a ti mismo!`,
    `¡Oe ${nombre}! Esta explicación está hecha para que nunca más olvides este concepto. ¡Escúchala!`,
    `¡Hola ${nombre}! Tu concentración en este momento vale más que mil distracciones. ¡Escucha bien!`,
    `${nombre}, el verdadero crack no es el que lo sabe todo, es el que nunca deja de aprender. ¡Eso eres tú!`,
    `¡Oe causita ${nombre}! Esta pregunta es un regalo del examen. Cuando la sabes, sumas puntos seguros.`,
    `¡Hola ${nombre}! Yo te acompaño en cada pregunta. Nunca estás solo en este camino. ¡Escucha!`,
    `${nombre}, aprende esta pregunta hoy y mañana enséñasela a otro. Así se multiplica el conocimiento.`,
    `¡Oe ${nombre}! ¡Qué bueno verte practicar! El examen no te va a ganar porque tú te preparas bien.`,
    `¡Hola ${nombre}! Esta explicación es el puente entre donde estás y donde quieres llegar. ¡Crúzalo!`,
    `${nombre}, el tiempo que dedicas a estudiar hoy el examen te lo va a devolver en puntos. ¡Vale la pena!`,
    `¡Oe pata ${nombre}! Tú mereces estar en la universidad. Esta pregunta te ayuda a llegar. ¡Escucha!`,
    `¡Hola ${nombre}! Esta es la explicación más clara de este concepto que vas a escuchar. ¡Aprovéchala!`,
    `${nombre}, creo firmemente que vas a ingresar a la universidad. Esta pregunta es evidencia de tu preparación.`,
    `¡Oe ${nombre}! Falta poco. Sigue practicando. El examen llega pero tú llegas preparado. ¡Con todo!`,
    `¡Hola ${nombre}! ¡Doscientas frases de motivación y aquí seguimos juntos! Esta pregunta también la dominamos.`,
  ]

  const CIERRES_PE = [
    (f: string) => `¡Eso ${nombre}! Recuerda bien ${f}. Y si no te quedó claro, elige tu respuesta y te mostraré la solución resuelta paso a paso. ¡Tú puedes!`,
    (f: string) => `¡Bien ahí ${nombre}! ${f} es tu herramienta de oro. Si necesitas ver cómo se resuelve exactamente, selecciona tu respuesta y aparecerá la resolución completa. ¡Dale que sí!`,
    (f: string) => `¡Qué crack, ${nombre}! Grábate ${f}. Si no recuerdas cómo aplicarla, elige tu opción y te explico todo el procedimiento paso a paso. ¡El examen te espera!`,
    (f: string) => `¡Así se hace! ${f} es la clave. Cuando elijas tu respuesta, verás la fórmula resuelta con todos los datos. ¡Repasa y sigue adelante!`,
    (f: string) => `¡Qué bacán ${nombre}! Lo importante es ${f}. Si algo no quedó claro, selecciona tu respuesta y te aparecerá la explicación completa y detallada. ¡Vas muy bien!`,
    (f: string) => `¡Excelente ${nombre}! El concepto es ${f}. No te preocupes si no recuerdas cómo se calcula; cuando marques tu opción te mostraré el desarrollo completo. ¡Sigue así!`,
    (f: string) => `¡Oe causita! ¿Grabaste ${f}? Si quieres ver cómo se resuelve paso a paso con los datos del problema, elige tu respuesta y te aparece todo. ¡Eso es!`,
    (f: string) => `¡Arriba ${nombre}! ${f} es lo que necesitas. Cuando selecciones tu respuesta, verás la resolución detallada. ¡Repasa, que el examen lo vas a reventar!`,
    (f: string) => `¡Ánimo ${nombre}! Con ${f} estás listo. Si la explicación no fue suficiente, elige tu opción y te muestro la solución completa paso a paso. ¡Tú puedes con todo!`,
    (f: string) => `¡Qué campeón, ${nombre}! Recuerda ${f}. Si no recuerdas la fórmula o quieres ver el desarrollo completo, selecciona tu respuesta. ¡Allí te lo explico todo!`,
    (f: string) => `¡Bravo ${nombre}! ${f} nunca te abandona. Cuando marques tu opción, verás la resolución paso a paso con todos los datos. ¡Dale con todo!`,
    (f: string) => `¡Hermano ${nombre}, tú puedes! ${f} es tu aliada. Si quieres reforzar, elige tu respuesta y aparece la explicación completa y detallada. ¡Eso es estudiar inteligente!`,
    (f: string) => `¡Vamos ${nombre}! Aplica ${f} y lo logras. No te preocupes si algo no quedó claro; selecciona tu respuesta y te muestro el procedimiento completo. ¡El ingreso es tuyo!`,
    (f: string) => `¡Sigue así ${nombre}! ${f} es fundamental. Si quieres ver cómo se aplica con números reales, elige tu opción y verás la resolución detallada. ¡Confío en ti!`,
    (f: string) => `¡Eso mismo ${nombre}! ${f} marca la diferencia. Cuando elijas tu respuesta, aparecerá la explicación resuelta con cada paso. ¡El camino a la universidad está claro!`,
    (f: string) => `¡Tremendo ${nombre}! Con ${f} ya tienes la base. Selecciona tu respuesta y te mostraré cómo se resuelve completo. ¡Estudia duro y el examen es tuyo!`,
    (f: string) => `¡Qué nivel, ${nombre}! ${f} es exactamente lo que necesitas. Si algo se escapó, marca tu opción y te aparece el desarrollo completo. ¡Vas en la dirección correcta!`,
    (f: string) => `¡Genial ${nombre}! Domina ${f} y ganas puntos seguros. Cuando elijas tu opción, verás la solución detallada. ¡Tu esfuerzo de hoy es tu victoria mañana!`,
    (f: string) => `¡Adelante ${nombre}! ${f} es la herramienta. No dudes; elige tu respuesta y te muestro el paso a paso completo. ¡Cada pregunta que practicas te acerca más a la meta!`,
    (f: string) => `¡Impresionante ${nombre}! Tienes claro ${f}. Cuando marques tu opción, verás la resolución completa con datos reales del problema. ¡Tú naciste para esto!`,
    (f: string) => `¡Eso es ${nombre}! ${f} es tu as bajo la manga. Si quieres repasar el procedimiento, selecciona tu respuesta y te explico todo paso a paso. ¡El examen te teme!`,
    (f: string) => `¡Qué disciplina, ${nombre}! Recuerda ${f}. Elige tu respuesta y verás cómo se resuelve completo. ¡Cada minuto que estudias suma puntos en la UNT!`,
    (f: string) => `¡Ánimo campeón! ${f} ya lo tienes. Si la explicación fue rápida y quieres el detalle, marca tu opción y aparece la resolución completa. ¡Tú puedes!`,
    (f: string) => `¡Fuerte ${nombre}! ${f} es la clave del éxito. Cuando elijas tu respuesta, verás el desarrollo completo con cada operación. ¡El ingreso a la universidad es tuyo!`,
    (f: string) => `¡Crack total ${nombre}! ${f} está grabado en tu mente. Selecciona tu respuesta y aparecerá la explicación paso a paso. ¡Así se estudia para entrar!`,
    (f: string) => `¡Oe ${nombre}! Ya sabes ${f}. Cuando marques tu opción, verás la solución resuelta con los datos reales. ¡Nada te detiene, ${nombre}!`,
    (f: string) => `¡Brillante ${nombre}! Con ${f} no hay pregunta que se resista. Selecciona tu respuesta y te muestro el procedimiento detallado. ¡Tú llegas a la universidad!`,
    (f: string) => `¡Firme ${nombre}! ${f} siempre funciona. Si necesitas ver cómo se aplica exactamente, elige tu opción y aparece la resolución completa. ¡Tú puedes con todo!`,
    (f: string) => `¡Duro ahí ${nombre}! ${f} es tu fórmula ganadora. Cuando elijas tu respuesta, verás todo resuelto paso a paso. ¡El sacrificio de hoy es el triunfo de mañana!`,
    (f: string) => `¡Qué talento ${nombre}! ${f} ya es tuya. Si quieres repasar el cálculo completo, selecciona tu respuesta y aparece la explicación detallada. ¡Sigue adelante!`,
    (f: string) => `¡Increíble ${nombre}! Recuerda siempre ${f}. Cuando marques tu opción, verás cómo se resuelve paso a paso con los datos del enunciado. ¡El examen no te gana!`,
    (f: string) => `¡Eso ${nombre}, a estudiar! ${f} es la base. Elige tu respuesta y verás la solución completa resuelta. ¡Cada pregunta practicada es un punto más en la UNT!`,
    (f: string) => `¡Que bueno, ${nombre}! Ya tienes ${f}. Si algo no quedó del todo claro, marca tu opción y te mostraré el procedimiento completo. ¡Confía en ti!`,
    (f: string) => `¡Qué dedicación ${nombre}! ${f} es poderosa. Selecciona tu respuesta y aparecerá la resolución detallada. ¡Eres capaz de lograr el ingreso!`,
    (f: string) => `¡A tope ${nombre}! ${f} está de tu lado. Cuando elijas tu opción, verás todo el desarrollo. ¡Así que anímate, elige y aprende al máximo!`,
    (f: string) => `¡Sigue fuerte ${nombre}! ${f} te abre las puertas de la universidad. Marca tu respuesta y verás la explicación completa y detallada. ¡Tú puedes lograrlo!`,
    (f: string) => `¡Qué potencial ${nombre}! Con ${f} dominas el tema. Elige tu respuesta y aparecerá la resolución paso a paso. ¡El esfuerzo siempre vale la pena!`,
    (f: string) => `¡Sensacional ${nombre}! ${f} ya la dominas. Si quieres reforzar el procedimiento, selecciona tu opción y te explico todo completo. ¡El examen es tuyo!`,
    (f: string) => `¡Arriba Perú y arriba ${nombre}! ${f} es la clave. Cuando marques tu respuesta, verás el desarrollo completo con cada paso y operación. ¡Dale!`,
    (f: string) => `¡Espectacular ${nombre}! Tienes ${f} en la cabeza. Selecciona tu respuesta y te mostraré la solución detallada. ¡Estudiar así es lo que lleva al éxito!`,
    (f: string) => `¡Bien por ti ${nombre}! ${f} es fundamental en el examen. Elige tu opción y verás cómo se resuelve completo el problema. ¡No te rindas nunca!`,
    (f: string) => `¡Qué valor ${nombre}! Ya entendiste ${f}. Cuando elijas tu respuesta, aparecerá la resolución completa. ¡Tú tienes el nivel para ingresar a la universidad!`,
    (f: string) => `¡Con todo ${nombre}! ${f} es lo que marca diferencia. Selecciona tu opción y verás la explicación paso a paso. ¡Estudia, confía y triunfa!`,
    (f: string) => `¡Orgulloso de ti ${nombre}! ${f} ya la tienes. Marca tu respuesta y te explico el procedimiento completo. ¡El ingreso a la UNT está cada vez más cerca!`,
    (f: string) => `¡Resistente ${nombre}! ${f} nunca falla. Si quieres ver el cálculo detallado, elige tu opción y aparece la resolución completa. ¡Tú eres capaz de lograrlo!`,
    (f: string) => `¡Qué fuerza ${nombre}! Grabaste ${f} en tu mente. Cuando marques tu respuesta, verás todo resuelto paso a paso. ¡El esfuerzo de hoy es el ingreso de mañana!`,
    (f: string) => `¡Champion ${nombre}! ${f} está lista para usarla en el examen. Selecciona tu respuesta y verás la solución resuelta. ¡Tú tienes lo que se necesita!`,
    (f: string) => `¡Qué orgullo ${nombre}! ${f} ya es parte de ti. Elige tu opción y te muestro la resolución detallada paso a paso. ¡Nada te puede parar!`,
    (f: string) => `¡A seguir ${nombre}! ${f} es tu mejor aliada. Cuando elijas tu respuesta, verás el procedimiento completo resuelto. ¡El camino al éxito está en cada pregunta que practicas!`,
    (f: string) => `¡Tú puedes ${nombre}! ${f} ya la dominaste. Selecciona tu respuesta y aparecerá la explicación completa con cada paso. ¡Sigue así que el ingreso está cerca!`,
    (f: string) => `¡Lo lograste ${nombre}! Con ${f} ya tienes la herramienta. Marca tu opción y verás cómo se resuelve todo paso a paso. ¡El examen UNT no te va a ganar!`,
  ]

  // ── Detecta subcurso de Matemática ───────────────────────────────────────────
  function detectSubcursoMat(ctx: string): string {
    if (/trigon|seno\b|coseno\b|tangente\b|\bsen\b|\bcos\b|\btan\b|razón trigon|identidad trigon/.test(ctx))
      return 'Trigonometría'
    if (/logarit|log\b|ln\b|exponencial|potencia.*base|antilogarit/.test(ctx))
      return 'Álgebra — Logaritmos y Potencias'
    if (/función|dominio|rango|gráfica.*función|imagen.*función|f\(x\)|composición/.test(ctx))
      return 'Álgebra — Funciones'
    if (/ecuación|sistema.*ecuac|desigualdad|inecuación|variable|incógnita|despeja/.test(ctx))
      return 'Álgebra — Ecuaciones'
    if (/polinomio|monomio|binomio|factor|producto notable|factoriz|simplific.*algebr/.test(ctx))
      return 'Álgebra — Polinomios'
    if (/pitágor|cateto|hipotenusa|triángulo.*rect|triángulo.*isosc|triángulo.*equil/.test(ctx))
      return 'Geometría — Triángulos'
    if (/círculo|circunferencia|radio\b|diámetro|arco|sector|área.*círc/.test(ctx))
      return 'Geometría — Círculo y Circunferencia'
    if (/área|perímetro|volumen|rectángulo|cuadrado|prisma|cilindro|cono|esfera|pirámide/.test(ctx))
      return 'Geometría — Áreas y Volúmenes'
    if (/media\b|mediana\b|moda\b|promedio|estadíst|datos\b|muestra|varianza|desviación/.test(ctx))
      return 'Estadística y Probabilidad'
    if (/mcm|mcd|divisib|múltiplo|divisor|primo\b|compuesto\b|fracción|fraccionario|decimal|porcentaj/.test(ctx))
      return 'Aritmética'
    if (/sucesión|progresión|serie|término/.test(ctx))
      return 'Aritmética — Sucesiones'
    return 'Matemática'
  }

  // ── Explicación del MÉTODO paso a paso — sin nombrar el curso, sin datos del problema ──
  function buildPasoAPaso(area: string, enunciado: string): string {
    const ctx = (area + ' ' + enunciado).toLowerCase()

    // ── INGLÉS ────────────────────────────────────────────────────────────────────
    if (/inglés|ingles|english|grammar|vocabulary|verb|tense|past|present|future/.test(ctx))
      return `Primero lee el enunciado completo con calma para entender qué te piden. Si es una pregunta de vocabulario, busca las palabras claves que te rodean la palabra desconocida y deduce su significado por el contexto. Si es gramática, identifica qué tiempo verbal encaja lógicamente con el resto de la oración. Descarta las opciones que no concuerden gramaticalmente o que cambien el sentido del texto.`

    // ── MATEMÁTICA ────────────────────────────────────────────────────────────────
    if (/matemát|matem/.test(ctx)) {
      const sub = detectSubcursoMat(ctx)

      // Trigonometría
      if (/trigon/.test(sub.toLowerCase()))
        return `Empieza dibujando un triángulo rectángulo y ubica el ángulo que te mencionan. Recuerda las tres razones: el seno es el cateto opuesto dividido entre la hipotenusa; el coseno es el cateto adyacente dividido entre la hipotenusa; y la tangente es el cateto opuesto dividido entre el cateto adyacente. Identifica cuál de los tres lados te dan y cuál te piden, elige la razón que relaciona esos dos lados y despeja el valor desconocido.`

      // Pitágoras / triángulos
      if (/geometr.*triáng|pitágor|cateto|hipotenusa/.test(sub.toLowerCase() + ' ' + ctx))
        return `Dibuja el triángulo y marca los lados que conoces. Si el triángulo es rectángulo, aplica el Teorema de Pitágoras: la hipotenusa al cuadrado es igual a la suma de los cuadrados de los dos catetos. Si te dan la hipotenusa y un cateto, resta el cuadrado del cateto al cuadrado de la hipotenusa y saca la raíz cuadrada. Para el área de cualquier triángulo, multiplica la base por la altura y divide entre dos.`

      // Círculo
      if (/geometr.*círculo|geometr.*circ|círculo|circunferencia/.test(sub.toLowerCase() + ' ' + ctx))
        return `Identifica primero si te dan el radio o el diámetro. Recuerda que el diámetro es el doble del radio. Para calcular el área, eleva el radio al cuadrado y multiplica por pi. Para calcular la longitud de toda la circunferencia, multiplica el radio por dos y por pi. Si solo te piden un arco, calcula qué fracción del círculo completo representa el ángulo central y aplica esa fracción.`

      // Geometría general (áreas y volúmenes)
      if (/geometr/.test(sub.toLowerCase()))
        return `Identifica la figura geométrica: si es un rectángulo, el área es base por altura; si es un triángulo, es base por altura entre dos; si es un círculo, es pi por radio al cuadrado. Para volúmenes: el cubo es lado al cubo; el prisma rectangular es largo por ancho por alto; el cilindro es pi por radio al cuadrado por la altura. Asegúrate de trabajar siempre con las mismas unidades.`

      // Estadística
      if (/estadíst|media|mediana|moda|promedio/.test(sub.toLowerCase() + ' ' + ctx))
        return `Si te piden el promedio o la media, suma todos los valores del conjunto y divide entre la cantidad total de datos. Si te piden la mediana, ordena los números de menor a mayor y toma el valor del centro; si son dos valores centrales, promédia los. Si te piden la moda, busca el número que aparece con mayor frecuencia en el conjunto.`

      // Probabilidad
      if (/probabilid/.test(ctx))
        return `Escribe todos los resultados posibles del experimento y cuántos de ellos corresponden al evento que te preguntan. La probabilidad es el número de casos favorables dividido entre el número de casos totales posibles. Si el experimento tiene dos etapas independientes, multiplica las probabilidades de cada etapa. Si los eventos son mutuamente excluyentes, suma sus probabilidades.`

      // Álgebra — Ecuaciones
      if (/ecuación|sistema.*ecuac|desigualdad|inecuación|incógnita|despeja/.test(ctx))
        return `Pasa todos los términos con la variable al lado izquierdo y los números al lado derecho, cambiando el signo cada vez que cruzas el signo igual. Si hay fracciones, multiplica toda la ecuación por el mínimo común denominador para eliminarlas. Al final, divide ambos lados por el coeficiente que acompaña a la variable para despejarla. Verifica sustituyendo tu respuesta en la ecuación original.`

      // Álgebra — Funciones
      if (/función|dominio|rango|f\(x\)|composición/.test(ctx))
        return `Para evaluar una función en un punto, reemplaza la variable por el valor indicado y calcula la expresión. Para encontrar el dominio, busca los valores que hacen imposible la operación: si hay división, el denominador no puede ser cero; si hay raíz cuadrada, el interior no puede ser negativo. Para componer funciones, primero aplica la función interior y luego substituye ese resultado en la función exterior.`

      // Logaritmos y potencias
      if (/logarit|log\b|ln\b|exponencial|potencia/.test(ctx))
        return `Recuerda que el logaritmo pregunta a qué exponente hay que elevar la base para obtener el número. Para simplificar, aplica las propiedades: el logaritmo de un producto es la suma de logaritmos; el de un cociente es la resta; y el de una potencia es el exponente multiplicado por el logaritmo. Para ecuaciones exponenciales, aplica logaritmo a ambos lados y despeja el exponente.`

      // Polinomios
      if (/polinomio|monomio|binomio|factor|producto notable|factoriz/.test(ctx))
        return `Identifica si puedes aplicar un producto notable: diferencia de cuadrados, cuadrado de binomio o cubo de binomio. Si te piden factorizar, busca un factor común primero, luego intenta agrupar términos o usar la fórmula cuadrática si hay un trinomio de segundo grado. Para evaluar el polinomio en un valor, sustituye directamente o usa el esquema de Horner para simplificar el cálculo.`

      // Aritmética / porcentajes / fracciones / sucesiones
      if (/sucesión|progresión|serie/.test(ctx))
        return `Identifica si la sucesión es aritmética o geométrica. En una sucesión aritmética la diferencia entre términos consecutivos es constante; el término general es el primer término más la diferencia por el número de paso. En una sucesión geométrica cada término se obtiene multiplicando el anterior por una razón constante; el término general es el primer término por la razón elevada al número de paso.`
      if (/mcm|mcd|fracción|decimal|porcentaj/.test(ctx))
        return `Para porcentajes, convierte el tanto por ciento a decimal dividiéndolo entre cien, y luego multiplica por el total. Para sumar o restar fracciones, busca el mínimo común múltiplo de los denominadores, convierte cada fracción y opera los numeradores. Para el MCM y MCD, descompón cada número en factores primos: el MCM toma los factores con el mayor exponente y el MCD toma los factores comunes con el menor exponente.`

      return `Lee el enunciado y extrae los valores numéricos con sus unidades. Identifica qué operación o relación te piden establecer. Escribe la fórmula o la ecuación que corresponde a la situación, sustituye los datos y resuelve paso a paso. Antes de marcar tu respuesta, verifica que el resultado tenga sentido con el problema.`
    }

    // ── FÍSICA ────────────────────────────────────────────────────────────────────
    if (/física/.test(ctx)) {
      if (/velocidad|aceleración|movimiento|tiempo|distancia|desplazamiento/.test(ctx))
        return `Identifica qué magnitudes te dan y cuál te piden: posición, velocidad, aceleración o tiempo. Si el movimiento es uniforme, divide la distancia entre el tiempo para obtener la velocidad. Si hay aceleración constante, usa las ecuaciones de movimiento: la velocidad final es la inicial más la aceleración por el tiempo; la distancia es la velocidad inicial por el tiempo más la mitad de la aceleración por el tiempo al cuadrado.`
      if (/fuerza|newton|masa|aceleración/.test(ctx))
        return `Dibuja el diagrama de fuerzas sobre el objeto. Aplica la Segunda Ley de Newton: la suma de todas las fuerzas es igual a la masa multiplicada por la aceleración. Si el objeto está en equilibrio, la suma de fuerzas es cero. Despeja la magnitud que te piden y asegúrate de que la respuesta esté en Newtons si es fuerza, o en metros por segundo al cuadrado si es aceleración.`
      if (/energía|trabajo|potencia|joule/.test(ctx))
        return `Para la energía potencial gravitacional, multiplica la masa por la aceleración de la gravedad y por la altura. Para la energía cinética, multiplica la mitad de la masa por la velocidad al cuadrado. El trabajo es la fuerza aplicada multiplicada por la distancia en la dirección del movimiento. Si no hay fricción, la energía total se conserva: la pérdida de energía potencial se convierte en energía cinética y viceversa.`
      return `Anota los datos del enunciado con sus unidades. Identifica la ley o principio físico que aplica: Newton, conservación de energía, ondas, termodinámica u óptica. Escribe la ecuación, sustituye los valores y resuelve. Verifica que las unidades del resultado sean correctas.`
    }

    // ── QUÍMICA ───────────────────────────────────────────────────────────────────
    if (/química/.test(ctx)) {
      if (/tabla periódica|número atóm|protón|neutrón|electrón/.test(ctx))
        return `Recuerda que el número atómico Z indica cuántos protones tiene el átomo y, si es neutro, también cuántos electrones. La masa atómica A es la suma de protones y neutrones, por eso los neutrones se calculan restando Z de A. En la tabla periódica, cada fila es un período y cada columna es un grupo con propiedades similares.`
      if (/reacción|reactivo|producto|balancear|estequio/.test(ctx))
        return `Para balancear una ecuación, escribe los reactivos a la izquierda y los productos a la derecha. Cuenta cuántos átomos de cada elemento hay en cada lado. Coloca coeficientes delante de las fórmulas para igualar los átomos de cada elemento sin modificar los subíndices. Empieza por los elementos que aparecen en menos compuestos y deja el oxígeno e hidrógeno para el final.`
      return `Identifica si la pregunta es sobre nomenclatura, enlace, propiedades o reacciones. Lee cuidadosamente el enunciado, aplica las reglas o conceptos correspondientes y descarta las opciones que contradigan las leyes básicas de la química.`
    }

    // ── BIOLOGÍA ─────────────────────────────────────────────────────────────────
    if (/biolog/.test(ctx))
      return `Ubica en qué nivel de organización se sitúa la pregunta: célula, tejido, órgano, sistema u organismo. Si habla de genética, recuerda que el ADN porta la información y los genes determinan los caracteres hereditarios. Si habla de ecología, identifica las relaciones entre organismos y su ambiente. Lee cada opción y descarta las que contradigan los procesos biológicos mencionados en el enunciado.`

    // ── LENGUAJE ─────────────────────────────────────────────────────────────────
    if (/lenguaje|comunicac/.test(ctx))
      return `Lee el enunciado e identifica si te preguntan sobre ortografía, morfología, sintaxis o semántica. Para la tildación, recuerda: las palabras agudas llevan tilde si terminan en n, s o vocal; las graves llevan tilde si terminan en consonante distinta de n o s; las esdrújulas siempre llevan tilde. Para la sintaxis, localiza el verbo principal de la oración y luego identifica el sujeto que concuerda con él en número y persona.`

    // ── LITERATURA ───────────────────────────────────────────────────────────────
    if (/literatur/.test(ctx))
      return `Identifica el género literario: narrativa si hay narrador y personajes, lírica si expresa sentimientos en verso, dramática si es diálogo para ser representado. Recuerda los autores peruanos clave: César Vallejo en poesía, José María Arguedas y Mario Vargas Llosa en narrativa, Ricardo Palma con las Tradiciones Peruanas. Relaciona el autor con su corriente y su época para responder correctamente.`

    // ── HISTORIA ─────────────────────────────────────────────────────────────────
    if (/histor/.test(ctx))
      return `Ubica el hecho en su período histórico: culturas prehispánicas, Imperio Inca, Conquista española, Virreinato, Independencia o República del Perú. Para cada evento identifica quiénes fueron los protagonistas, cuándo ocurrió, cuáles fueron las causas principales y qué consecuencias tuvo. Descarta las opciones que mezclen hechos de épocas distintas o que atribuyan acciones a los actores equivocados.`

    // ── FILOSOFÍA ────────────────────────────────────────────────────────────────
    if (/filosof/.test(ctx))
      return `Identifica el autor o la corriente filosófica que menciona el enunciado. Recuerda las posturas principales: Sócrates usaba el diálogo para descubrir la verdad; Platón defendía el mundo de las ideas; Aristóteles partía de la observación; Descartes dudaba de todo para encontrar una certeza; Kant estableció el imperativo categórico como norma moral. Relaciona cada afirmación del enunciado con el pensador que la propone.`

    // ── CIUDADANÍA ───────────────────────────────────────────────────────────────
    if (/ciudadan/.test(ctx))
      return `Recuerda que el Estado peruano se organiza en tres poderes: el Ejecutivo que gobierna, el Legislativo que hace las leyes y el Judicial que las aplica. La Constitución de 1993 es la norma suprema. Los derechos fundamentales —vida, libertad, igualdad— no pueden ser desconocidos por ninguna autoridad. Lee cada alternativa y elige la que sea coherente con esos principios constitucionales.`

    // ── PSICOLOGÍA ───────────────────────────────────────────────────────────────
    if (/psicolog/.test(ctx))
      return `Ubica el concepto que describe el enunciado y relaciona con el autor correspondiente. Freud explicaba la conducta por el inconsciente, el id, el ego y el superego. Piaget describió cuatro etapas del desarrollo cognitivo: sensoriomotora, preoperacional, operacional concreta y formal. Maslow ordenó las necesidades en una pirámide desde las fisiológicas hasta la autorrealización. Elige la opción que mejor describa el proceso o la etapa que se plantea.`

    // ── ECONOMÍA ─────────────────────────────────────────────────────────────────
    if (/econom/.test(ctx))
      return `Identifica cuál principio económico aplica la situación: si habla de precios y cantidades en el mercado, piensa en la ley de oferta y demanda. Si habla del crecimiento de un país, relaciona con el PBI. Para calcular el costo, precio de venta o ganancia, parte de la fórmula básica: utilidad es precio de venta menos costo. Elige la opción que refleje correctamente esa relación económica.`

    // ── DESARROLLO PERSONAL ──────────────────────────────────────────────────────
    if (/desarrollo personal/.test(ctx))
      return `Lee el caso o situación que describe el enunciado e identifica qué habilidad o proceso personal está en juego. Si habla de cómo alguien se siente consigo mismo, es autoestima. Si habla de expresar ideas sin agredir ni ceder, es asertividad. Si describe una etapa del crecimiento humano, ubícala en la línea niñez, adolescencia, adultez o vejez. Elige la opción que corresponda exactamente a la definición o al ejemplo presentado.`

    return `Lee con cuidado el enunciado completo. Identifica la idea central y las palabras clave. Descarta las opciones que sean claramente incorrectas o que contradigan lo planteado. Entre las opciones restantes, elige la que responda de forma más precisa y completa lo que se pregunta.`
  }

  // ── Detecta el subtema para cualquier materia ────────────────────────────────
  function detectSubtema(area: string, enunciado: string): string {
    const ctx = (area + ' ' + enunciado).toLowerCase()
    const a = area.toLowerCase()
    if (/matemát|matem/.test(a)) return detectSubcursoMat(ctx)
    if (/física/.test(a)) {
      if (/velocidad|aceleración|movimiento|tiempo|distancia|cinemát/.test(ctx)) return 'Cinemática'
      if (/fuerza|newton|masa/.test(ctx)) return 'Dinámica — Leyes de Newton'
      if (/energía|trabajo|potencia|joule/.test(ctx)) return 'Trabajo y Energía'
      if (/onda|sonido|luz|óptica/.test(ctx)) return 'Ondas y Óptica'
      return 'Física General'
    }
    if (/química/.test(a)) {
      if (/tabla periódica|número atóm|protón|electrón/.test(ctx)) return 'Tabla Periódica'
      if (/reacción|reactivo|balancear|estequio/.test(ctx)) return 'Reacciones Químicas'
      if (/enlace|molecular|iónico|covalente/.test(ctx)) return 'Enlace Químico'
      return 'Química General'
    }
    if (/biolog/.test(a)) {
      if (/célula|mitosis|meiosis/.test(ctx)) return 'Citología'
      if (/adn|gen|herencia|cromosoma/.test(ctx)) return 'Genética'
      if (/ecosistema|ecolog|especie/.test(ctx)) return 'Ecología'
      if (/fotosíntes|respiración celular/.test(ctx)) return 'Metabolismo'
      return 'Biología General'
    }
    if (/lenguaje|comunicac/.test(a)) {
      if (/tildación|ortografía|acento/.test(ctx)) return 'Ortografía y Tildación'
      if (/sintaxis|oración|sujeto|predicado/.test(ctx)) return 'Sintaxis'
      if (/semántica|significado|sinónimo/.test(ctx)) return 'Semántica'
      return 'Comprensión Lectora'
    }
    if (/literatur/.test(a)) {
      if (/vallejo|arguedas|palma|vargas llosa/.test(ctx)) return 'Literatura Peruana'
      if (/cervantes|shakespeare|García Márquez/.test(ctx)) return 'Literatura Universal'
      if (/género|narrativa|lírica|dramática/.test(ctx)) return 'Géneros Literarios'
      return 'Literatura'
    }
    if (/histor/.test(a)) {
      if (/inca|tawantisuyo|prehispánico/.test(ctx)) return 'Cultura Inca y Prehispánica'
      if (/conquista|virreinato|colonia/.test(ctx)) return 'Conquista y Virreinato'
      if (/independencia|república|siglo xix/.test(ctx)) return 'Independencia y República'
      return 'Historia del Perú'
    }
    if (/filosof/.test(a)) {
      if (/sócrates|platón|aristóteles|grecia/.test(ctx)) return 'Filosofía Griega'
      if (/descartes|kant|racionalismo|empirismo/.test(ctx)) return 'Filosofía Moderna'
      if (/lógica|silogismo|razonamiento/.test(ctx)) return 'Lógica'
      return 'Filosofía'
    }
    if (/psicolog/.test(a)) {
      if (/freud|inconsciente|psicoanálisis/.test(ctx)) return 'Psicoanálisis'
      if (/piaget|vygotsky|desarrollo/.test(ctx)) return 'Psicología del Desarrollo'
      if (/maslow|motivación|necesidades/.test(ctx)) return 'Motivación y Conducta'
      return 'Psicología General'
    }
    if (/econom/.test(a)) {
      if (/oferta|demanda|mercado|precio/.test(ctx)) return 'Oferta y Demanda'
      if (/pbi|inflación|macroeconomía/.test(ctx)) return 'Macroeconomía'
      return 'Economía'
    }
    if (/ciudadan/.test(a)) return 'Ciudadanía y Constitución'
    if (/desarrollo personal/.test(a)) {
      if (/autoestima|identidad/.test(ctx)) return 'Autoestima e Identidad'
      if (/asertividad|comunicación|habilidades sociales/.test(ctx)) return 'Habilidades Sociales'
      return 'Desarrollo Personal'
    }
    if (/inglés|ingles/.test(a)) {
      if (/past|preterite/.test(ctx)) return 'Inglés — Past Tense'
      if (/present.*simple|present.*continuous/.test(ctx)) return 'Inglés — Present Tense'
      if (/vocabulary|reading/.test(ctx)) return 'Inglés — Reading Comprehension'
      return 'Inglés'
    }
    return area || 'General'
  }

  // ── buildScript: nombra curso + subtema, luego explica el método ──────────────
  function buildScript(p: Pregunta): string[] {
    const idx = saludoCounter.current % SALUDOS_PE.length
    saludoCounter.current += 1
    const iC = (saludoCounter.current >> 2) % CIERRES_PE.length

    const saludo   = SALUDOS_PE[idx]
    const subtema  = detectSubtema(p.area, p.enunciado)
    const intro    = `Curso: ${p.area || 'General'}. Tema: ${subtema}.`
    const metodo   = buildPasoAPaso(p.area, p.enunciado)
    const pf       = getPureFormula(p.area, p.enunciado)
    const fLabel   = pf ? pf.label : subtema
    const cierre   = CIERRES_PE[iC](fLabel)
    return [saludo, intro + ' ' + metodo, cierre]
  }

  async function handleSpeak(p: Pregunta) {
    if (speaking === p.id || audioLoading === p.id) { cancelAudio(); return }
    if (speaking || audioLoading) cancelAudio()
    setCurrentReadText(p.enunciado)
    setViewed(prev => new Set([...prev, p.id]))
    const partes = buildScript(p)
    setAudioLoading(p.id)
    try {
      const res = await fetch(`${API}/banco/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: partes.join(' '), gender: 'male', locale: 'pe' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.audio_b64) {
          if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
          const audio = new Audio(`data:audio/mpeg;base64,${data.audio_b64}`)
          audioRef.current = audio
          audio.onplay  = () => { setSpeaking(p.id); setAudioLoading(null) }
          audio.onended = () => onAudioFinished(p.id)
          audio.onerror = () => { setAudioLoading(null); speakWithBrowser(p.id, partes) }
          await audio.play()
          return
        }
      }
    } catch {}
    setAudioLoading(null)
    speakWithBrowser(p.id, partes)
  }

  const viewedCount = viewed.size
  const progressPct = total > 0 ? Math.round((viewedCount / total) * 100) : 0

  // ── VISTA: MATERIAS ───────────────────────────────────────────────────────────
  if (view === 'materias') {
    const sumTotal = materias.reduce((s, m) => s + m.total, 0)
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={onBack} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#475569', fontSize: 11, cursor: 'pointer' }}>← Inicio</button>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              🇵🇪 Banco de Preguntas UNT — Selecciona Materia
            </h2>
            <p style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>Explicaciones completas · Audio tutor peruano · Fórmulas visuales</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          {materias.map(m => <MateriaCard key={m.key} m={m} onSelect={openMateria} />)}
        </div>

        <div style={{ background: 'rgba(12,18,38,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 24px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', letterSpacing: 1, marginBottom: 14 }}>RESUMEN DEL BANCO UNT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, textAlign: 'center' }}>
            {[
              { val: sumTotal ? sumTotal.toLocaleString() : '—', label: 'Total preguntas',      color: '#38bdf8' },
              { val: String(materias.length || '—'),             label: 'Materias',              color: '#a78bfa' },
              { val: '776',                                      label: 'Pregs. UNT reales',     color: '#34d399' },
              { val: '200',                                      label: 'Frases motivacionales', color: '#fbbf24' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 600 }}>Flujo de estudio:</span>
          {['1. Elige materia','2. Lee la pregunta','3. Intenta responder','4. Escucha la explicación IA','5. Ve la fórmula'].map((s, i) => (
            <React.Fragment key={s}>
              <span style={{ fontSize: 11, color: i === 0 ? '#fbbf24' : '#475569' }}>{s}</span>
              {i < 4 && <span style={{ color: '#1e293b', fontSize: 14 }}>›</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    )
  }

  // ── VISTA: PREGUNTAS ──────────────────────────────────────────────────────────
  const m = materia!
  const avatarState = audioLoading ? 'thinking' : speaking ? 'talking' : 'idle'

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px' }}>
      <style>{`
        @media (max-width: 900px) {
          .peru-banco-body { flex-direction: column !important; }
          .peru-banco-avatar { position: static !important; width: 100% !important; height: 360px !important; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, fontSize: 12, color: '#475569' }}>
        <span style={{ cursor: 'pointer', color: '#fca5a5' }} onClick={onBack}>🇵🇪 TES-LA PRO</span>
        <span>›</span>
        <span style={{ cursor: 'pointer', color: '#60a5fa' }} onClick={() => setView('materias')}>Materias</span>
        <span>›</span>
        <span style={{ color: m.color, fontWeight: 600 }}>{m.label}</span>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{m.label} | Preguntas de práctica UNT</h2>
        <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>{total} preguntas · Con explicación IA · Tutor peruano · 200 frases motivacionales</p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }} className="peru-banco-body">
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading && preguntas.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 13 }}>Cargando preguntas UNT...</div>
          )}
          {!loading && preguntas.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#334155', fontSize: 13 }}>No hay preguntas disponibles aún.</div>
          )}

          {preguntas.map((p, i) => (
            <QuestionCard
              key={p.id}
              p={p}
              idx={skipOffset + i}
              materia={m}
              viewed={viewed.has(p.id)}
              speaking={speaking === p.id}
              audioLoading={audioLoading === p.id}
              played={played.has(p.id)}
              showExplanation={explanationShown.has(p.id)}
              onSpeak={handleSpeak}
              onViewed={() => setViewed(prev => new Set([...prev, p.id]))}
            />
          ))}

          {preguntas.length < total && (
            <button onClick={loadMore} disabled={loading} style={{ width: '100%', padding: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, color: '#475569', fontSize: 12, cursor: loading ? 'wait' : 'pointer', marginBottom: 16 }}>
              {loading ? 'Cargando...' : `Cargar más (${total - preguntas.length} restantes)`}
            </button>
          )}

          <div style={{ background: 'rgba(12,18,38,0.8)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '12px 16px', marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Tu progreso en {m.label}</span>
              <span style={{ fontSize: 11, color: m.color }}>{progressPct}% ({viewedCount}/{total})</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3 }}>
              <div style={{ width: `${progressPct}%`, height: '100%', background: m.color, borderRadius: 3, transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>

        <div className="peru-banco-avatar" style={{ flex: '0 0 320px', position: 'sticky' as const, top: 72, height: 'calc(100vh - 100px)', minHeight: 460 }}>
          <AvatarTutorIA
            text={currentReadText || m.label}
            gender="male"
            autoPlay={false}
            externalState={avatarState as any}
            label="Tutor IA · Banco UNT Perú"
          />
        </div>
      </div>
    </div>
  )
}

// ── MateriaCard ───────────────────────────────────────────────────────────────
function MateriaCard({ m, onSelect }: { m: Materia; onSelect: (m: Materia) => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div onClick={() => onSelect(m)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: 'rgba(12,18,38,0.8)', border: `1.5px solid ${hover ? m.color + 'a0' : m.color + '30'}`, borderRadius: 14, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.2s', transform: hover ? 'translateY(-2px)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: m.color }}>{m.label}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: m.color, background: `${m.color}15`, border: `1px solid ${m.color}30`, borderRadius: 20, padding: '2px 10px' }}>{m.total} preguntas</span>
      </div>
      <button style={{ padding: '6px 16px', background: 'transparent', border: `1px solid ${m.color}50`, borderRadius: 8, color: m.color, fontSize: 12, cursor: 'pointer', pointerEvents: 'none' }}>Ver preguntas →</button>
    </div>
  )
}

// ── StrategySteps — muestra texto de estrategia como pasos visuales ──────────
function StrategySteps({ text, color }: { text: string; color: string }) {
  // Detectar si es lista de pasos separados por →
  if (text.includes('→')) {
    const steps = text.split('→').map(s => s.trim()).filter(Boolean)
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '6px 0' }}>
        {steps.map((step, i) => (
          <React.Fragment key={i}>
            <div style={{ background: `${color}18`, border: `1px solid ${color}40`, borderRadius: 8, padding: '5px 12px', fontSize: 12, color, fontWeight: 600, textAlign: 'center' }}>
              {step}
            </div>
            {i < steps.length - 1 && (
              <span style={{ color, fontSize: 16, fontWeight: 700 }}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }
  // Detectar si es lista de conceptos separados por ·
  if (text.includes('·')) {
    const items = text.split('·').map(s => s.trim()).filter(Boolean)
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', padding: '6px 0' }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: `${color}15`, border: `1px solid ${color}35`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color, fontWeight: 600 }}>
            {item}
          </div>
        ))}
      </div>
    )
  }
  // Texto simple
  return (
    <div style={{ fontSize: 13, color, textAlign: 'center', padding: '6px 0', lineHeight: 1.7 }}>{text}</div>
  )
}

// ── FormulaBox — LaTeX como imagen real, estrategias como pasos visuales ──────
function FormulaBox({ tex, isLatex, label, vars, color }: { tex: string; isLatex: boolean; label: string; vars?: string; color: string }) {
  const [imgError, setImgError] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Para LaTeX: renderizar con MathJax (await startup para evitar fórmula vacía)
  useEffect(() => {
    if (!ref.current || !isLatex) return
    const el = ref.current
    el.innerHTML = `\\[${tex}\\]`
    ;(async () => {
      try {
        if (typeof MathJax !== 'undefined') {
          if ((MathJax as any).startup?.promise) await (MathJax as any).startup.promise
          await MathJax.typesetPromise([el])
        }
      } catch {
        el.style.fontFamily = 'monospace'
        el.style.fontSize = '13px'
        el.innerHTML = tex
      }
    })()
  }, [tex, isLatex])

  return (
    <div style={{ background: '#0d1117', border: `1px solid ${color}40`, borderRadius: 10, padding: '12px 16px', marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.08em', marginBottom: 8 }}>🧮 FÓRMULA — {label.toUpperCase()}</div>
      {isLatex ? (
        /* Imagen LaTeX via MathJax — fallback a image CDN si falla */
        <>
          <div ref={ref} style={{ color, fontSize: 15, textAlign: 'center', minHeight: 40 }} />
          {imgError && (
            <img
              src={`https://math.vercel.app/?from=${encodeURIComponent(tex)}&color=white`}
              alt={tex}
              style={{ maxWidth: '100%', maxHeight: 60, display: 'block', margin: '0 auto' }}
            />
          )}
        </>
      ) : (
        /* Estrategia visual — pasos con colores, no texto plano */
        <StrategySteps text={tex} color={color} />
      )}
      {vars && <div style={{ fontSize: 11, color: '#6e7681', marginTop: 8, lineHeight: 1.6 }}>{vars}</div>}
    </div>
  )
}

// ── QuestionCard ──────────────────────────────────────────────────────────────
function QuestionCard({ p, idx, materia, viewed: isViewed, speaking, audioLoading, played, showExplanation, onSpeak, onViewed }: {
  p: Pregunta; idx: number; materia: Materia
  viewed: boolean; speaking: boolean; audioLoading: boolean; played: boolean; showExplanation: boolean
  onSpeak: (p: Pregunta) => void; onViewed: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const pf       = getPureFormula(p.area, p.enunciado)
  const answered = selected !== null
  const isRight  = selected === p.respuesta

  const qvp = { id: p.id, stem: p.enunciado, area: p.area, points: 1, difficulty: p.dificultad, options: p.opciones }

  return (
    <div style={{ background: 'rgba(12,18,38,0.8)', border: `1px solid ${isViewed ? materia.color + '40' : 'rgba(255,255,255,0.07)'}`, borderLeft: `3px solid ${isViewed ? materia.color + '80' : 'transparent'}`, borderRadius: 12, padding: '18px 20px', marginBottom: 12, transition: 'border-color 0.2s' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: materia.color }}>Pregunta #{idx + 1}</span>
          <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{p.codigo}</span>
          <span style={{ fontSize: 10, color: '#475569' }}>{p.tema}</span>
          <span style={{ fontSize: 9, color: SECCION_COLORS[p.seccion] || '#475569', background: `${SECCION_COLORS[p.seccion] || '#475569'}15`, border: `1px solid ${SECCION_COLORS[p.seccion] || '#475569'}30`, borderRadius: 8, padding: '1px 6px' }}>Sección {p.seccion}</span>
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, marginBottom: 10 }}>{p.enunciado}</p>

      {/* Gráfico visual (diagrama canvas + chips de datos) — siempre visible */}
      <QuestionInlineVisual question={qvp} color={materia.color} />

      {/* Fórmula / estrategia — siempre visible, sin necesidad de responder */}
      {pf && <FormulaBox tex={pf.tex} isLatex={pf.isLatex} label={pf.label} vars={pf.vars} color={materia.color} />}

      {/* Opciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, marginTop: 14 }}>
        {p.opciones.map(o => {
          const isCorrect  = o.label === p.respuesta
          const isSelected = o.label === selected
          let bg = 'rgba(255,255,255,0.02)', border = 'rgba(255,255,255,0.06)', textColor = '#94a3b8'
          if (answered) {
            if (isCorrect)       { bg = 'rgba(63,185,80,0.12)'; border = 'rgba(63,185,80,0.4)';  textColor = '#3fb950' }
            else if (isSelected) { bg = 'rgba(248,81,73,0.10)'; border = 'rgba(248,81,73,0.4)';  textColor = '#f87171' }
          } else if (isSelected) { bg = `${materia.color}12`;   border = `${materia.color}60`;    textColor = materia.color }
          return (
            <button key={o.label} onClick={() => { if (!answered) { setSelected(o.label); onViewed() } }}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 6, width: '100%', textAlign: 'left' as const, background: bg, border: `1px solid ${border}`, cursor: answered ? 'default' : 'pointer', transition: 'all 0.18s' }}>
              <span style={{ fontSize: 11, fontWeight: 700, width: 18, flexShrink: 0, marginTop: 1, color: answered ? (isCorrect ? '#3fb950' : isSelected ? '#f87171' : '#475569') : materia.color }}>{o.label}</span>
              <span style={{ fontSize: 12, color: textColor, flex: 1, lineHeight: 1.55 }}>{o.text}</span>
              {answered && isCorrect            && <span style={{ fontSize: 10, color: '#3fb950', fontWeight: 700, flexShrink: 0 }}>✓ Correcta</span>}
              {answered && isSelected && !isCorrect && <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700, flexShrink: 0 }}>✗ Incorrecta</span>}
            </button>
          )
        })}
      </div>

      {answered && (
        <div style={{ padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, background: isRight ? 'rgba(63,185,80,0.08)' : 'rgba(248,81,73,0.08)', border: `1px solid ${isRight ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)'}`, color: isRight ? '#3fb950' : '#f87171' }}>
          {isRight
            ? '¡Excelente! Respondiste correctamente. ¡Tú puedes con todo!'
            : `No te rindas — la opción correcta es la ${p.respuesta}. Haz clic en "Ver respuesta" para ver el desarrollo completo.`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        {!played ? (
          <button onClick={() => onSpeak(p)} disabled={speaking || audioLoading}
            style={{ padding: '6px 14px', background: (speaking || audioLoading) ? 'rgba(52,211,153,0.12)' : 'transparent', border: `1px solid ${(speaking || audioLoading) ? 'rgba(52,211,153,0.5)' : 'rgba(52,211,153,0.25)'}`, borderRadius: 8, color: '#34d399', fontSize: 11, cursor: (speaking || audioLoading) ? 'wait' : 'pointer' }}>
            {audioLoading ? '⏳ Generando audio...' : speaking ? '🔊 Reproduciendo...' : '🔊 Escuchar explicación'}
          </button>
        ) : (
          <span style={{ padding: '6px 14px', fontSize: 11, color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8 }}>✓ Audio reproducido</span>
        )}

        {answered && !showSolution && (
          <button
            onClick={() => setShowSolution(true)}
            style={{ padding: '6px 16px', background: `${materia.color}18`, border: `1px solid ${materia.color}60`, borderRadius: 8, color: materia.color, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s' }}>
            📖 Ver respuesta paso a paso
          </button>
        )}
      </div>

      {answered && showSolution && (
        <div style={{ marginTop: 14, background: 'rgba(12,18,38,0.95)', border: `1px solid ${materia.color}30`, borderLeft: `3px solid ${materia.color}`, borderRadius: 10, padding: '14px 16px', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: materia.color, letterSpacing: '.08em', marginBottom: 10 }}>📋 RESOLUCIÓN COMPLETA — PASO A PASO</div>

          <div style={{ background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#3fb950', fontWeight: 600 }}>
            ✓ Respuesta correcta — Opción {p.respuesta}:{' '}
            <span style={{ fontWeight: 400 }}>{p.opciones.find(o => o.label === p.respuesta)?.text}</span>
          </div>

          {p.explicacion ? (
            <div style={{ margin: '0 0 10px' }}>
              {p.explicacion.split('\n').filter(l => l.trim()).map((line, li) => {
                const clean = line.trim()
                const isStep = /^(paso\s*\d|step\s*\d|\d+[.)]\s)/i.test(clean)
                const isResult = /^(resultado|respuesta|por lo tanto|luego|entonces|∴)/i.test(clean)
                return (
                  <p key={li} style={{
                    fontSize: 13,
                    color: isStep ? '#fbbf24' : isResult ? '#3fb950' : '#c9d1d9',
                    fontWeight: isStep || isResult ? 600 : 400,
                    lineHeight: 1.75,
                    margin: '0 0 6px',
                    borderLeft: isStep ? '2px solid rgba(251,191,36,0.4)' : isResult ? '2px solid rgba(63,185,80,0.4)' : 'none',
                    paddingLeft: (isStep || isResult) ? 8 : 0,
                  }}>{clean}</p>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.75, margin: '0 0 10px', fontStyle: 'italic' }}>
              💡 Escucha el audio para obtener la explicación completa del concepto de esta pregunta.
            </p>
          )}

          <div style={{ marginTop: 12, padding: '8px 12px', background: `${materia.color}08`, border: `1px solid ${materia.color}20`, borderRadius: 8, fontSize: 12, color: materia.color, fontStyle: 'italic' }}>
            🌟 ¡Muy bien! Repasa este procedimiento para que en el examen lo hagas en segundos.
          </div>
        </div>
      )}
    </div>
  )
}
