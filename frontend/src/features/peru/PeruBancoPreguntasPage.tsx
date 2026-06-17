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
    (f: string) => `¡Eso ${nombre}! Sigue practicando y recuerda: ${f}. ¡Tú estás hecho para entrar a la universidad!`,
    (f: string) => `¡Bien ahí ${nombre}! Guarda esto siempre: ${f}. ¡Dale duro que el examen no te va a ganar!`,
    (f: string) => `¡Qué crack! Grábate esto: ${f}. Vale oro en el examen. ¡Arriba Perú!`,
    (f: string) => `¡Así se hace! ${f}. Síguela repasando. ¡Tú puedes con todo!`,
    (f: string) => `¡Qué bacán ${nombre}! Eso es lo que necesitabas entender. ${f}. ¡Sigue así!`,
    (f: string) => `¡Excelente ${nombre}! El concepto clave es: ${f}. ¡Con esta herramienta el examen no te para!`,
    (f: string) => `¡Oe causita! ¿Grabaste esto? ${f}. ¡Eso es exactamente lo que el examen va a preguntar!`,
  ]

  // ── Explicación por tema cuando no hay fórmula ───────────────────────────────
  function buildPasoAPaso(area: string, enunciado: string): string {
    const ctx = (area + ' ' + enunciado).toLowerCase()

    // Inglés: siempre en español, explica el tema
    if (/inglés|ingles|english|grammar|vocabulary|verb|tense|past|present|future|reading comprehension/.test(ctx))
      return `Esta es una pregunta de Inglés. Te explico el tema en español: el inglés evalúa tu capacidad de comprender textos, identificar la idea principal, entender el vocabulario en contexto y reconocer estructuras gramaticales básicas como los tiempos verbales. Para responder bien, identifica la pregunta exacta que se hace, busca las palabras clave en el texto o enunciado y descarta las opciones que no tengan relación directa con lo que se pregunta.`

    if (/matemát|matem|álgebra|geometr|aritmét|trigon|cálculo|ecuación|función|estadíst/.test(ctx))
      return `Esta es una pregunta de Matemática. Identifica qué tipo de operación o concepto se pide: puede ser álgebra, geometría, aritmética o estadística. Aplica la fórmula o procedimiento correspondiente paso a paso. Verifica que tu resultado sea consistente con las opciones y que las unidades sean correctas.`

    if (/física|movimiento|velocidad|aceleración|fuerza|energía|trabajo|potencia|onda|calor|temperatura|electric|magnét/.test(ctx))
      return `Esta pregunta evalúa un concepto de Física. Identifica las magnitudes que intervienen y sus unidades. Aplica las leyes físicas: Newton, conservación de energía, termodinámica, óptica o electromagnetismo según el caso. Siempre verifica las unidades en tu respuesta final.`

    if (/química|elemento|compuesto|reacción|molécula|átomo|tabla periódica|enlace|ácido|base|estequi|mol|concentración/.test(ctx))
      return `En Química, identifica el tema central: nomenclatura, reacciones, estequiometría, tabla periódica o propiedades. Analiza los datos y aplica el concepto específico. En reacciones, recuerda balancear y conservar la masa.`

    if (/biolog|célula|gen|adn|herencia|ecolog|evolución|fotosíntesis|respiración celular|mitosis|meiosis|ecosistema|proteína/.test(ctx))
      return `Esta pregunta de Biología evalúa procesos vitales. Identifica el tema: célula, genética, ecología, fisiología o evolución. Relaciona el enunciado con los sistemas biológicos y sus procesos. La biología molecular y la ecología son temas frecuentes en la UNT.`

    if (/comunicac|lenguaje|literatura|comprensión|texto|lectura|sintaxis|semántica|ortografía|narrador|género literario|autor peruano/.test(ctx))
      return `Esta pregunta de Comunicación o Literatura evalúa comprensión lectora o conocimiento literario. Lee el enunciado con atención, identifica el tema central y las ideas principales. En literatura, recuerda los géneros literarios y autores peruanos como Vallejo, Vargas Llosa y Ricardo Palma.`

    if (/histor|incas|colonia|república|independencia|guerra|civilización|época|siglo|revolución|virreinato|conquista/.test(ctx))
      return `Esta pregunta de Historia requiere ubicar el hecho en su contexto temporal y espacial. Identifica el período: prehispánico, conquista, virreinato, independencia o república. Relaciona los hechos con sus causas y consecuencias. Perú tiene una historia rica que va desde los incas hasta la actualidad.`

    if (/geografí|geograf|región|clima|relieve|hidrografía|población|recursos naturales|costa|sierra|selva|territorio|amazonas/.test(ctx))
      return `En Geografía, analiza el espacio geográfico que se menciona. El Perú tiene tres regiones naturales: costa, sierra y selva. Cada una tiene características propias de clima, flora, fauna y actividades económicas. Relaciona los datos del enunciado con las características del territorio peruano o mundial.`

    if (/filosof|platón|aristóteles|sócrates|kant|descartes|epistemolog|ética|metafísica|lógica|razonamiento|silogismo/.test(ctx))
      return `La Filosofía evalúa tu capacidad de razonamiento y análisis de ideas. Identifica el autor, la corriente filosófica y el problema planteado. Las corrientes principales son racionalismo, empirismo, idealismo y existencialismo. Para lógica formal, identifica si el argumento es deductivo o inductivo.`

    if (/ciudadan|cívica|constitución|derechos|deberes|democracia|estado|poder judicial|ejecutivo|legislativo|gobierno/.test(ctx))
      return `Esta pregunta de Ciudadanía evalúa derechos fundamentales, deberes e instituciones del Estado peruano. Relaciona el enunciado con la Constitución Política del Perú, los tres poderes del Estado y los valores democráticos.`

    if (/psicolog|conducta|comportamiento|aprendizaje|memoria|personalidad|emoción|motivación|desarrollo|freud|piaget/.test(ctx))
      return `En Psicología, identifica el proceso mental o la etapa del desarrollo que se describe. Relaciona con Freud en psicoanálisis, Piaget en desarrollo cognitivo, Vygotsky en aprendizaje social y Maslow en motivación.`

    if (/econom|mercado|oferta|demanda|producción|inflación|pbi|presupuesto|empresa|comercio|importac|exportac/.test(ctx))
      return `Esta pregunta de Economía evalúa oferta, demanda, producción o política económica. Identifica los agentes: familias, empresas, Estado y sector externo. Aplica los principios básicos al caso planteado.`

    if (/desarrollo personal|autoestima|identidad|proyecto de vida|habilidades sociales|valores|adolescencia/.test(ctx))
      return `Desarrollo Personal evalúa autoconocimiento, habilidades sociales y proyecto de vida. Reflexiona sobre la identidad personal, las etapas del desarrollo humano y los valores que guían la conducta. La autoestima y la asertividad son temas frecuentes.`

    return `Analiza bien el enunciado. Identifica las palabras clave que indican el concepto central que se evalúa. Recuerda los contenidos del curso y aplica el razonamiento adecuado. Descarta las opciones que contradigan la lógica o los hechos estudiados. La opción correcta siempre es la más completa y precisa según los fundamentos del tema.`
  }

  function buildScript(p: Pregunta): string[] {
    const idx = saludoCounter.current % SALUDOS_PE.length
    saludoCounter.current += 1
    const iC  = (saludoCounter.current >> 2) % CIERRES_PE.length
    const pf  = getPureFormula(p.area, p.enunciado)

    const saludo = SALUDOS_PE[idx]

    // Intro del tema
    const topicIntro = `Esta pregunta es de ${p.area || 'la materia'}${p.tema ? ', tema: ' + p.tema : ''}.`

    // Descripción oral de la fórmula (si existe)
    const formulaPart = pf ? formulaToSpeech(pf) + ' ' : ''

    // Explicación limpia: primero la del PDF, si no hay → general por materia
    let explicacionText: string
    if (p.explicacion && p.explicacion.length > 40) {
      explicacionText = cleanForSpeech(p.explicacion)
    } else {
      explicacionText = buildPasoAPaso(p.area, p.enunciado)
    }

    const explica = `${topicIntro} ${formulaPart}${explicacionText}`

    const formulaLabel = pf ? `la fórmula de ${pf.label}` : `este concepto de ${p.area || 'la materia'}`
    const cierre = CIERRES_PE[iC](formulaLabel)
    return [saludo, explica, cierre]
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

// ── FormulaBox ────────────────────────────────────────────────────────────────
function FormulaBox({ tex, isLatex, label, vars, color }: { tex: string; isLatex: boolean; label: string; vars?: string; color: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current || !isLatex) return
    ref.current.innerHTML = `\\[${tex}\\]`
    try { MathJax.typesetPromise([ref.current]).catch(() => {}) } catch {}
  }, [tex, isLatex])
  return (
    <div style={{ background: '#0d1117', border: `1px solid ${color}40`, borderRadius: 10, padding: '12px 16px', marginTop: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '.08em', marginBottom: 6 }}>🧮 FÓRMULA — {label.toUpperCase()}</div>
      {isLatex
        ? <div ref={ref} style={{ color, fontSize: 15, textAlign: 'center', minHeight: 36 }} />
        : <div style={{ fontSize: 13, color, fontFamily: 'monospace', textAlign: 'center', padding: '6px 0' }}>{tex}</div>
      }
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
            : `No te rindas, la opción ${p.respuesta} es la correcta. Abajo tienes la explicación completa.`}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
        {!played ? (
          <button onClick={() => onSpeak(p)} disabled={speaking || audioLoading}
            style={{ padding: '6px 14px', background: (speaking || audioLoading) ? 'rgba(52,211,153,0.12)' : 'transparent', border: `1px solid ${(speaking || audioLoading) ? 'rgba(52,211,153,0.5)' : 'rgba(52,211,153,0.25)'}`, borderRadius: 8, color: '#34d399', fontSize: 11, cursor: (speaking || audioLoading) ? 'wait' : 'pointer' }}>
            {audioLoading ? '⏳ Generando audio...' : speaking ? '🔊 Reproduciendo...' : '🔊 Escuchar explicación'}
          </button>
        ) : (
          <span style={{ padding: '6px 14px', fontSize: 11, color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8 }}>✓ Audio reproducido</span>
        )}
      </div>

      {answered && (
        <div style={{ marginTop: 14, background: 'rgba(12,18,38,0.95)', border: `1px solid ${materia.color}30`, borderLeft: `3px solid ${materia.color}`, borderRadius: 10, padding: '14px 16px', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: materia.color, letterSpacing: '.08em', marginBottom: 10 }}>📋 RESOLUCIÓN COMPLETA</div>

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
            🌟 ¡Tú puedes! Sigue practicando esta pregunta y en el examen la vas a dominar.
          </div>
        </div>
      )}
    </div>
  )
}
