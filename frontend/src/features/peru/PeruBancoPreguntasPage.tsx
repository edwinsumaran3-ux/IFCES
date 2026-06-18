// =============================================================================
//  PeruBancoPreguntasPage.tsx — Banco de Preguntas UNT con tutor IA peruano
//  Mismo formato que Colombia: Audio + Avatar + Fórmulas + Explicaciones
// =============================================================================
import React, { useState, useEffect, useRef } from 'react'
import { useScreenGuide } from '../audio/AudioGuide'
import { pickMaleVoice, makeSocratic, cleanForAudio } from '../audio/voiceUtils'
import QuestionInlineVisual, { getPureFormula } from '../exam/QuestionInlineVisual'
import AvatarTutorIA from '../avatar/AvatarTutorIA'
import PizarraExplicacion from './PizarraExplicacion'
import GraficoFuncion from '../../components/GraficoFuncion'
import GraficoEstadistico from '../../components/GraficoEstadistico'
import { detectarGrafico } from '../../utils/detectarGrafico'

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
  explicacion: string; explicacion_ia: string; dificultad: string
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
  const [resolSpeaking,    setResolSpeaking]    = useState(false)
  const [resolAvatarText,  setResolAvatarText]  = useState('')
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
    return pickMaleVoice()
  }

  function speakWithBrowser(id: string, partes: string[]) {
    if (!('speechSynthesis' in window)) { onAudioFinished(id); return }
    const voz     = pickPeruvianVoice()
    const token   = speakToken.current
    const limpias = partes.map(cleanForAudio)
    let idx       = 0
    const next  = () => {
      if (speakToken.current !== token) return
      if (idx >= limpias.length) { onAudioFinished(id); return }
      const utt   = new SpeechSynthesisUtterance(limpias[idx] || '.')
      utt.lang    = 'es-PE'
      utt.rate    = 1.1
      utt.pitch   = 0.85
      utt.volume  = 1
      if (voz) utt.voice = voz
      utt.onstart = () => { if (speakToken.current === token && idx === 0) setSpeaking(id) }
      utt.onend   = () => { idx++; next() }  // idx refers to limpias
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
  // ── Analiza el enunciado: qué tienes, qué te falta y la fórmula ──────────────
  function buildPasoAPaso(area: string, enunciado: string): string {
    const e   = enunciado.toLowerCase()
    const ctx = (area + ' ' + e).toLowerCase()

    // ── LECTURA CRÍTICA / LITERATURA — SIEMPRE PRIMERO para evitar falsos positivos ──
    if (/lectura|crítica|critica|literatur|lenguaje|comunicac/.test(ctx) ||
        /fragmento|párrafo|parrafo|el narrador|se infiere|de acuerdo con|según el texto/.test(e) ||
        /novela|cuento|poema|ensayo|crónica|realismo|naturalismo|modernismo|boom latinoamericano/.test(e) ||
        /garcía márquez|garcia marquez|vallejo|neruda|vargas llosa|arguedas|palma|cervantes|shakespeare/.test(e)) {
      return `Tienes el texto o fragmento con una pregunta de comprensión. Lo que debes identificar es la opción que mejor refleja el sentido del texto. Lee el fragmento completo con atención, identifica la idea principal, el tono del autor y su intención; luego descarta las opciones que contradigan lo planteado o incluyan información ajena al texto.`
    }

    // ── TRIGONOMETRÍA ────────────────────────────────────────────────────────────
    if (/trigon|seno\b|coseno\b|tangente\b|\bsen\b|\bcos\b|\btan\b/.test(ctx)) {
      const hAng = /[aá]ngulo|°|\bθ\b/.test(e)
      const hHip = /hipotenusa/.test(e)
      const hCOp = /cateto.{0,20}opuest|opuest.{0,20}cateto/.test(e)
      const hCAd = /cateto.{0,20}adyac|adyac.{0,20}cateto/.test(e)
      const pSen = /seno|sen\b/.test(e)
      const pCos = /coseno|cos\b/.test(e)
      const pTan = /tangente|tan\b/.test(e)

      const t  = [hAng && 'el ángulo', hHip && 'la hipotenusa', hCOp && 'el cateto opuesto', hCAd && 'el cateto adyacente'].filter(Boolean) as string[]
      const tStr = t.length ? t.map(x => `Tienes ${x}.`).join(' ') : 'Tienes datos del triángulo.'

      if (pSen || (hAng && hHip && !hCOp))
        return `${tStr} No tienes el cateto opuesto, eso es lo que hay que hallar. La fórmula es: seno del ángulo igual al cateto opuesto dividido entre la hipotenusa. Despeja el cateto opuesto multiplicando la hipotenusa por el seno del ángulo.`
      if (pCos || (hAng && hHip && !hCAd))
        return `${tStr} No tienes el cateto adyacente, eso es lo que hay que hallar. La fórmula es: coseno del ángulo igual al cateto adyacente dividido entre la hipotenusa. Despeja el cateto adyacente multiplicando la hipotenusa por el coseno del ángulo.`
      if (pTan || (hCOp && hCAd && !hAng))
        return `${tStr} No tienes la tangente o el ángulo, eso es lo que hay que hallar. La fórmula es: tangente del ángulo igual al cateto opuesto dividido entre el cateto adyacente.`
      return `${tStr} No tienes la razón trigonométrica pedida. Identifica qué dos elementos conoces y elige la razón que los relaciona: seno usa opuesto e hipotenusa; coseno usa adyacente e hipotenusa; tangente usa opuesto y adyacente.`
    }

    // ── PITÁGORAS ────────────────────────────────────────────────────────────────
    if (/pit[aá]gor|cateto|hipotenusa/.test(ctx)) {
      const hHip = /hipotenusa/.test(e)
      const hCat = /cateto\b/.test(e)
      const pHip = /halla|determin|calcul/.test(e) && /hipotenusa/.test(e)
      const tStr = [hHip && 'la hipotenusa', hCat && 'los catetos'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes las medidas del triángulo rectángulo.'
      if (!hHip || pHip)
        return `${tStr} No tienes la hipotenusa, eso es lo que hay que hallar. La fórmula es: hipotenusa al cuadrado igual a la suma de los cuadrados de los dos catetos. Eleva cada cateto al cuadrado, suma ambos y saca la raíz cuadrada.`
      return `${tStr} No tienes el cateto desconocido, eso es lo que hay que hallar. La fórmula es: cateto desconocido al cuadrado igual a la hipotenusa al cuadrado menos el cateto conocido al cuadrado. Saca la raíz cuadrada del resultado.`
    }

    // ── ÁREA / PERÍMETRO ─────────────────────────────────────────────────────────
    if (/[aá]rea|per[ií]metro/.test(ctx) && !/c[ií]rculo|circunfer/.test(ctx)) {
      const hBase = /base/.test(e), hAltura = /altura/.test(e), hLado = /lado|largo|ancho/.test(e)
      const pArea = /[aá]rea/.test(e) && /halla|calcul|determin/.test(e)
      const pPer  = /per[ií]metro/.test(e)
      const tStr  = [hBase && 'la base', hAltura && 'la altura', hLado && 'las medidas de los lados'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes las dimensiones de la figura.'
      if (pArea)
        return `${tStr} No tienes el área, eso es lo que hay que calcular. Para el triángulo la fórmula es: área igual a base por altura dividido entre dos. Para el rectángulo: área igual a base por altura.`
      if (pPer)
        return `${tStr} No tienes el perímetro, eso es lo que hay que calcular. La fórmula del perímetro es la suma de todos los lados de la figura.`
      return `${tStr} Identifica si te piden el área o el perímetro y aplica la fórmula correspondiente.`
    }

    // ── CÍRCULO ──────────────────────────────────────────────────────────────────
    if (/c[ií]rculo|circunfer|radio\b|di[aá]metro/.test(ctx)) {
      const hR = /radio/.test(e), hD = /di[aá]metro/.test(e)
      const pA = /[aá]rea/.test(e), pC = /circunfer|longitud/.test(e)
      const tStr = [hR && 'el radio', hD && 'el diámetro'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes datos del círculo.'
      if (pA) return `${tStr} No tienes el área, eso es lo que hay que hallar. La fórmula es: área igual a pi por el radio al cuadrado. Si te dan el diámetro, el radio es la mitad.`
      if (pC) return `${tStr} No tienes la longitud de la circunferencia, eso es lo que hay que hallar. La fórmula es: circunferencia igual a dos por pi por el radio.`
      return `${tStr} Identifica si te piden el área o la circunferencia y aplica la fórmula correspondiente.`
    }

    // ── ESTADÍSTICA / PROMEDIO ───────────────────────────────────────────────────
    if (/media\b|mediana\b|moda\b|promedio|conjunto de datos|datos.*son/.test(ctx)) {
      const pMed  = /media\b|promedio/.test(e)
      const pMdn  = /mediana/.test(e)
      const pMod  = /moda\b/.test(e)
      if (pMed) return `Tienes el conjunto de datos y la cantidad de elementos. No tienes la media, eso es lo que hay que calcular. La fórmula es: media igual a la suma de todos los datos dividida entre la cantidad total de datos.`
      if (pMdn) return `Tienes el conjunto de datos. No tienes la mediana, eso es lo que hay que hallar. Ordena todos los datos de menor a mayor y toma el valor central; si hay dos centrales, promédia los.`
      if (pMod) return `Tienes el conjunto de datos. No tienes la moda, eso es lo que hay que identificar. La moda es el dato que aparece con mayor frecuencia en el conjunto.`
      return `Tienes el conjunto de datos. Identifica si te piden la media, la mediana o la moda y aplica el procedimiento correspondiente.`
    }

    // ── PROBABILIDAD ─────────────────────────────────────────────────────────────
    if (/probabilid|favorable|azar|aleator|acertar|al azar/.test(ctx)) {
      const hTotal = /total|posibles|espacio|alternativas/.test(e)
      const hFav   = /favorable|exitoso|acertar|correcto/.test(e)
      const tStr   = [hTotal && 'el total de casos posibles', hFav && 'los casos favorables'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes los datos del experimento aleatorio.'
      return `${tStr} No tienes la probabilidad, eso es lo que hay que calcular. La fórmula es: probabilidad igual a casos favorables dividido entre el total de casos posibles. Si son dos eventos independientes que ocurren juntos, multiplica sus probabilidades individuales.`
    }

    // ── PORCENTAJE ───────────────────────────────────────────────────────────────
    if (/porcentaje|descuento|rebaja|\bpor ciento\b|\b%\b/.test(ctx)) {
      const hT = /total|precio|monto|cantidad/.test(e)
      const hP = /%|por ciento|porcentaje/.test(e)
      const tStr = [hT && 'el valor total o precio base', hP && 'el porcentaje'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes los datos del porcentaje.'
      return `${tStr} No tienes el valor resultante, eso es lo que hay que calcular. La fórmula es: parte igual al total multiplicado por el porcentaje en decimal. Para convertir el porcentaje a decimal, divídelo entre cien.`
    }

    // ── ECUACIONES ───────────────────────────────────────────────────────────────
    if (/ecuaci[oó]n|inc[oó]gnita|variable\b|despeja|halla x|valor de x/.test(ctx)) {
      const tStr = /ecuaci[oó]n/.test(e) ? 'Tienes la ecuación planteada.' : 'Tienes la relación entre los datos.'
      return `${tStr} No tienes el valor de la incógnita, eso es lo que hay que encontrar. La fórmula es: pasa todos los términos con la variable a un lado y los números al otro lado; luego divide ambos lados entre el coeficiente de la variable para despejarla.`
    }

    // ── FUNCIONES ────────────────────────────────────────────────────────────────
    if (/funci[oó]n|f\(x\)|dominio|rango\b/.test(ctx)) {
      const pDom = /dominio/.test(e), pImg = /imagen|rango|valor de f/.test(e)
      const tStr = /f\(x\)|g\(x\)/.test(e) ? 'Tienes la función definida.' : 'Tienes la regla de correspondencia.'
      if (pDom) return `${tStr} No tienes el dominio, eso es lo que hay que determinar. El dominio son todos los valores de x para los que la función tiene sentido: el denominador no puede ser cero y el interior de una raíz cuadrada no puede ser negativo.`
      if (pImg) return `${tStr} No tienes el valor de la función en ese punto. Sustituye el valor de x en la expresión y realiza las operaciones paso a paso.`
      return `${tStr} Identifica si te piden evaluar la función, el dominio o la imagen, y aplica el procedimiento correcto.`
    }

    // ── LOGARITMOS ───────────────────────────────────────────────────────────────
    if (/logarit|log\b|ln\b/.test(ctx)) {
      return `Tienes la expresión logarítmica con base y argumento. No tienes el valor simplificado, eso es lo que hay que hallar. La fórmula base es: logaritmo de un número N en base b pregunta a qué potencia hay que elevar b para obtener N. Aplica las propiedades: logaritmo de un producto es suma; de un cociente es resta; de una potencia el exponente baja como multiplicador.`
    }

    // ── POLINOMIOS ───────────────────────────────────────────────────────────────
    if (/polinomio|ra[ií]ces|monomio|binomio|factoriz|ra[ií]z del polinomio/.test(ctx)) {
      const pRaices = /ra[ií]z|ra[ií]ces/.test(e)
      const tStr    = /p\(x\)|polinomio/.test(e) ? 'Tienes el polinomio.' : 'Tienes la expresión algebraica.'
      if (pRaices) return `${tStr} No tienes las raíces, eso es lo que hay que encontrar. Un número es raíz del polinomio si al sustituirlo la expresión da cero. Factoriza o aplica el teorema del factor para encontrarlas.`
      return `${tStr} Identifica qué te piden: simplificar, factorizar, evaluar o encontrar raíces; y aplica las propiedades algebraicas correspondientes.`
    }

    // ── SUCESIONES ───────────────────────────────────────────────────────────────
    if (/sucesi[oó]n|progresi[oó]n|t[eé]rmino.*[aé]simo/.test(ctx)) {
      return `Tienes varios términos de la sucesión. No tienes el término que te piden, eso es lo que hay que encontrar. Determina si es aritmética: la diferencia entre términos consecutivos es constante; o geométrica: la razón entre términos consecutivos es constante. Luego aplica la fórmula del término general.`
    }

    // ── FÍSICA — CINEMÁTICA ──────────────────────────────────────────────────────
    if (/velocidad|aceleraci[oó]n|desplazamiento|tiempo\b|distancia recorrid/.test(ctx) && /física/.test(ctx)) {
      const hV = /velocidad/.test(e), hA = /aceleraci[oó]n/.test(e), hT = /tiempo/.test(e), hD = /distancia|desplazamiento/.test(e)
      const tStr = [hV && 'la velocidad', hA && 'la aceleración', hT && 'el tiempo', hD && 'la distancia'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes datos del movimiento.'
      const nT   = !hV ? 'la velocidad final' : !hD ? 'la distancia recorrida' : 'el dato pedido'
      return `${tStr} No tienes ${nT}, eso es lo que hay que hallar. Para la velocidad final: velocidad inicial más aceleración por tiempo. Para la distancia: velocidad inicial por tiempo más la mitad de la aceleración por el tiempo al cuadrado.`
    }

    // ── FÍSICA — NEWTON ──────────────────────────────────────────────────────────
    if (/fuerza|segunda ley|masa.*aceleraci|aceleraci.*masa/.test(ctx) && /física/.test(ctx)) {
      const hF = /fuerza/.test(e), hM = /masa|kg/.test(e), hA = /aceleraci[oó]n/.test(e)
      const tStr = [hM && 'la masa', hA && 'la aceleración', hF && 'la fuerza'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes datos de las fuerzas.'
      const nT   = !hF ? 'la fuerza neta' : !hA ? 'la aceleración' : 'la masa'
      return `${tStr} No tienes ${nT}, eso es lo que hay que hallar. La fórmula es: fuerza igual a masa por aceleración. Despeja la magnitud que te falta.`
    }

    // ── FÍSICA — ENERGÍA ─────────────────────────────────────────────────────────
    if (/energ[ií]a|joule|potencial.*grav|cin[eé]tica/.test(ctx)) {
      const hM = /masa|kg/.test(e), hH = /altura|metro/.test(e), hV = /velocidad/.test(e)
      const esCin = /cin[eé]tica|velocidad/.test(e)
      const tStr  = [hM && 'la masa', esCin ? (hV && 'la velocidad') : (hH && 'la altura')].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes los datos del sistema.'
      if (esCin) return `${tStr} No tienes la energía cinética, eso es lo que hay que hallar. La fórmula es: energía cinética igual a la mitad de la masa por la velocidad al cuadrado.`
      return `${tStr} No tienes la energía potencial gravitacional, eso es lo que hay que hallar. La fórmula es: energía potencial igual a masa por la aceleración de la gravedad por la altura.`
    }

    // ── QUÍMICA — TABLA PERIÓDICA ─────────────────────────────────────────────────
    if (/número at[oó]m|prot[oó]n|neutr[oó]n|electr[oó]n|tabla peri[oó]d/.test(ctx)) {
      const hZ = /número at[oó]m|\bz\b/.test(e), hA = /masa at[oó]m|\bmas[ae]\b/.test(e)
      const tStr = [hZ && 'el número atómico Z', hA && 'la masa atómica A'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes los datos del átomo.'
      if (/neutr[oó]n/.test(e)) return `${tStr} No tienes el número de neutrones, eso es lo que hay que hallar. La fórmula es: neutrones igual a masa atómica menos número atómico.`
      if (/electr[oó]n/.test(e)) return `${tStr} No tienes el número de electrones. Para un átomo neutro, los electrones son iguales al número atómico Z.`
      return `${tStr} Recuerda: protones igualan a Z; electrones igualan a Z en átomo neutro; neutrones igual a masa atómica menos Z.`
    }

    // ── QUÍMICA — REACCIONES ─────────────────────────────────────────────────────
    if (/reacci[oó]n|reactivo|producto|balancear|estequio/.test(ctx)) {
      return `Tienes la ecuación química con reactivos y productos. No tienes los coeficientes que la balancean, eso es lo que hay que determinar. Iguala el número de átomos de cada elemento a ambos lados colocando coeficientes; empieza por los metales, luego los no metales, y ajusta el hidrógeno y el oxígeno al final.`
    }

    // ── INGLÉS ───────────────────────────────────────────────────────────────────
    if (/ingl[eé]s|english|grammar|vocabulary|verb|tense/.test(ctx))
      return `Tienes el texto o la oración con un espacio en blanco o una pregunta de comprensión. No tienes la opción correcta, eso es lo que debes identificar. Lee todo el contexto, determina el tiempo verbal o el significado que encaja, y descarta las opciones que rompan la lógica gramatical o el sentido del texto.`

    // ── MATEMÁTICA genérica ──────────────────────────────────────────────────────
    if (/matemát|matem/.test(ctx))
      return `Tienes los datos numéricos del problema. Identifica qué magnitud o valor te piden encontrar; eso es lo que no tienes. Elige la fórmula o relación que conecta los datos que tienes con lo que te falta, sustituye los valores y despeja la incógnita paso a paso.`

    // ── HISTORIA ─────────────────────────────────────────────────────────────────
    if (/histor/.test(ctx))
      return `Tienes los datos del hecho histórico. Lo que debes identificar es cuál opción lo describe, explica o ubica correctamente en su período. Recuerda los protagonistas, las causas y las consecuencias del evento; descarta las opciones que mezclen épocas o atribuyan hechos a actores equivocados.`

    // ── LITERATURA ───────────────────────────────────────────────────────────────
    if (/literatur/.test(ctx))
      return `Tienes la referencia a una obra, autor o movimiento literario. Lo que debes identificar es la relación correcta entre ellos. Asocia el autor con su género, su época y sus obras más representativas; descarta las opciones que confundan autores o corrientes.`

    // ── FILOSOFÍA / PSICOLOGÍA ───────────────────────────────────────────────────
    if (/filosof|psicolog/.test(ctx))
      return `Tienes la descripción de un concepto, corriente o caso. Lo que debes identificar es el autor o la teoría que corresponde exactamente a esa descripción. Compara cada opción con la definición del enunciado y elige la que coincida con precisión.`

    // ── LENGUAJE ─────────────────────────────────────────────────────────────────
    if (/lenguaje|comunicac/.test(ctx))
      return `Tienes el texto o la oración. Lo que debes encontrar es la respuesta al concepto preguntado. Identifica si es ortografía, sintaxis, semántica o comprensión lectora y aplica la regla o principio correspondiente.`

    // ── CIUDADANÍA ───────────────────────────────────────────────────────────────
    if (/ciudadan|constituci/.test(ctx))
      return `Tienes los datos de la situación o el artículo legal. Lo que debes identificar es cuál derecho, deber o principio constitucional aplica. Recuerda los tres poderes del Estado y los derechos fundamentales de la Constitución de 1993; elige la opción que sea coherente con esos principios.`

    // ── ECONOMÍA ─────────────────────────────────────────────────────────────────
    if (/econom/.test(ctx)) {
      const hP = /precio|costo|monto/.test(e), hC = /cantidad|unidades/.test(e)
      const tStr = [hP && 'el precio o costo', hC && 'la cantidad'].filter(Boolean).map(x => `Tienes ${x}.`).join(' ') || 'Tienes los datos económicos del problema.'
      return `${tStr} Lo que debes determinar es cuál relación económica aplica: oferta, demanda, costo de producción o indicador macroeconómico. Elige la opción que refleje ese principio correctamente.`
    }

    // ── DESARROLLO PERSONAL ──────────────────────────────────────────────────────
    if (/desarrollo personal/.test(ctx))
      return `Tienes la descripción de una situación o conducta. Lo que debes identificar es el concepto o habilidad personal que corresponde. Si habla de valoración propia, es autoestima. Si habla de comunicar sin agredir ni ceder, es asertividad. Elige la opción que coincida exactamente con la situación descrita.`

    return `Tienes los datos del enunciado. Lo que debes encontrar es la respuesta correcta. Lee con cuidado, identifica las palabras clave, aplica el concepto que corresponde y descarta las opciones que contradigan lo que se plantea.`
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

  // ── Convierte explicacion_ia a narración socrática: pregunta → lógica → respuesta ──
  function iaToAudio(text: string): string {

    // Limpia LaTeX, símbolos y caracteres que el TTS lee como basura
    const clean = (s: string) => cleanForAudio(s)

    // Preguntas variadas según el título del PASO
    const preguntaPorTitulo = (titulo: string, idx: number): string => {
      const t = titulo.toLowerCase()
      const opts: Record<string, string[]> = {
        datos:   ['¿Qué datos nos da el problema?','¿Cuál es la información que tenemos?','¿Con qué elementos trabajamos?'],
        identif: ['¿Qué datos debemos identificar primero?','¿Qué información es clave aquí?'],
        formula: ['¿Qué fórmula necesitamos?','¿Cuál es la expresión que aplicamos?','¿Qué fórmula usamos en este caso?'],
        calculo: ['¿Cómo hacemos el cálculo?','¿Cómo aplicamos la fórmula paso a paso?','¿Cómo llegamos al número?'],
        calcula: ['¿Cómo operamos?','¿Cuánto da el cálculo?'],
        verif:   ['¿Cómo verificamos que el resultado es correcto?','¿Cómo comprobamos la respuesta?'],
        interp:  ['¿Qué significa este resultado?','¿Cómo interpretamos lo que obtuvimos?'],
        plant:   ['¿Cómo planteamos la ecuación?','¿Cómo expresamos el problema matemáticamente?'],
        simplif: ['¿Cómo simplificamos la expresión?','¿Cómo reducimos esto?'],
        conclu:  ['¿A qué conclusión llegamos?','¿Qué nos dice el resultado?'],
        analiz:  ['¿Qué debemos analizar aquí?','¿Cómo analizamos este punto?'],
      }
      for (const [key, arr] of Object.entries(opts)) {
        if (t.includes(key)) return arr[idx % arr.length]
      }
      const defaults = [
        '¿Qué hacemos en este paso?',
        '¿Cuál es el siguiente movimiento?',
        '¿Cómo continuamos la solución?',
        '¿Qué viene ahora?',
      ]
      return defaults[idx % defaults.length]
    }

    // Respuestas-apertura variadas
    const RESPONDE = [
      'Pues bien,', 'Fíjate:', 'Mira esto:', 'Resulta que',
      'Lo que hacemos es:', 'Te explico:', 'Aquí va:', 'Escucha:',
    ]
    const CONECTA = [
      'Perfecto. Ahora,', 'Sigamos.', 'Continuemos.', 'El siguiente paso:',
      'Avancemos.', 'Bien. Luego,', 'Ahora viene lo importante.',
    ]

    // Parsear secciones
    interface Sec { tipo: 'logica'|'paso'|'trampa'|'respuesta'|'texto'; titulo: string; cuerpo: string }
    const secs: Sec[] = []
    let cur: Sec | null = null

    for (const rawLine of text.split('\n')) {
      // Limpiar ANTES de detectar tipo — cleanForAudio ya elimina emojis
      const l = clean(rawLine).trim()
      if (!l) continue

      // Detectar secciones — los emojis ya fueron eliminados por cleanForAudio
      if (/^(LÓGICA|LOGICA)\s*[:\-—–]\s*/i.test(l)) {
        cur = { tipo: 'logica', titulo: '', cuerpo: l.replace(/^(LÓGICA|LOGICA)\s*[:\-—–]\s*/i, '') }
        secs.push(cur); continue
      }
      if (/^(TRAMPA|ERROR\s+COM[UÚ]N)\s*[:\-—–]\s*/i.test(l)) {
        cur = { tipo: 'trampa', titulo: '', cuerpo: l.replace(/^(TRAMPA|ERROR\s+COM[UÚ]N)\s*[:\-—–]\s*/i, '') }
        secs.push(cur); continue
      }
      if (/^(RESPUESTA|RPTA|RESULTADO|CONCLUSI[OÓ]N)\s*[:\-—–]\s*/i.test(l)) {
        cur = { tipo: 'respuesta', titulo: '', cuerpo: l.replace(/^(RESPUESTA|RPTA|RESULTADO|CONCLUSI[OÓ]N)\s*[:\-—–]\s*/i, '') }
        secs.push(cur); continue
      }
      if (/^(PRÁCTICA|PRACTICA)\s*:/i.test(l)) { cur = null; continue }

      // PASO N — TITULO o PASO N: contenido
      const mPaso = l.match(/^PASO\s+(\d+)\s*[—–\-:]+\s*([^:\n]*)?:?\s*(.*)/i)
      if (mPaso) {
        const titulo = (mPaso[2] || '').trim().replace(/[:]\s*$/, '')
        const cuerpo = (mPaso[3] || '').trim()
        cur = { tipo: 'paso', titulo, cuerpo }
        secs.push(cur); continue
      }

      // Línea de continuación — acumula en sección actual
      if (cur && cur.tipo !== 'respuesta') {
        cur.cuerpo += (cur.cuerpo ? ' ' : '') + l
      } else if (!cur) {
        cur = { tipo: 'texto', titulo: '', cuerpo: l }
        secs.push(cur)
      }
    }

    // Construir narración socrática
    const partes: string[] = []
    let pasoIdx = 0

    for (const s of secs) {
      const cb = s.cuerpo.trim()
      if (!cb) continue

      if (s.tipo === 'logica') {
        partes.push(`¿De qué trata este problema? ${cb}`)
      }
      else if (s.tipo === 'paso') {
        const pregunta = preguntaPorTitulo(s.titulo, pasoIdx)
        const responde = pasoIdx === 0 ? RESPONDE[0] : RESPONDE[pasoIdx % RESPONDE.length]
        const conecta  = pasoIdx === 0 ? '' : CONECTA[(pasoIdx - 1) % CONECTA.length] + ' '
        partes.push(`${conecta}${pregunta} ${responde} ${cb}`)
        pasoIdx++
      }
      else if (s.tipo === 'trampa') {
        partes.push(`¡Ojo! ¿En qué fallan muchos estudiantes aquí? En que ${cb} ¡No caigas en esa trampa!`)
      }
      else if (s.tipo === 'respuesta') {
        partes.push(`Por todo esto, la respuesta correcta es ${cb}.`)
      }
      else if (s.tipo === 'texto') {
        partes.push(cb)
      }
    }

    return partes
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\.\s*\./g, '.')
      .trim()
  }

  // ── buildScript: saludo único + explicación IA (con trampa) + cierre motivador ─
  function buildScript(p: Pregunta): string[] {
    const idx = saludoCounter.current % SALUDOS_PE.length
    saludoCounter.current += 1
    const iC = (saludoCounter.current >> 2) % CIERRES_PE.length

    const saludo    = SALUDOS_PE[idx]
    const trueArea  = fixArea(p.area, p.enunciado)
    const pf        = getPureFormula(trueArea, p.enunciado)
    const subtema   = detectSubtema(trueArea, p.enunciado)
    const fLabel    = pf ? pf.label : subtema
    const cierre    = CIERRES_PE[iC](fLabel)

    // Usar explicacion_ia (única por pregunta) si está disponible
    const ia = (p.explicacion_ia || '').trim()
    if (ia && ia.length > 60) {
      const cuerpo = iaToAudio(ia)
      return [saludo, cuerpo, cierre]
    }

    // Fallback: método genérico por materia — con formato socrático
    const metodo = makeSocratic(trueArea, p.enunciado, buildPasoAPaso(trueArea, p.enunciado))
    return [saludo, metodo, cierre]
  }

  async function handleSpeak(p: Pregunta) {
    if (speaking === p.id || audioLoading === p.id) { cancelAudio(); return }
    if (speaking || audioLoading) cancelAudio()
    setCurrentReadText(p.enunciado)
    setViewed(prev => new Set([...prev, p.id]))
    const partes      = buildScript(p)
    const textoLimpio = cleanForAudio(partes.join(' '))
    setAudioLoading(p.id)
    try {
      const res = await fetch(`${API}/banco/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textoLimpio, gender: 'male', locale: 'pe' }),
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
  const avatarState = audioLoading ? 'thinking' : (speaking || resolSpeaking) ? 'talking' : 'idle'

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
              onResolStart={(text: string) => { setResolSpeaking(true); setResolAvatarText(text) }}
              onResolEnd={() => { setResolSpeaking(false); setResolAvatarText('') }}
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
            text={resolAvatarText || currentReadText || m.label}
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

// ── Limpieza de enunciado ─────────────────────────────────────────────────────
function cleanEnunciado(s: string): string {
  return s.replace(/^[a-záéíóúüñ]{1,4}\s+(?=[A-ZÁÉÍÓÚ0-9¿])/u, '').trim()
}

// ── Formatea explicacion del PDF en segmentos visuales ───────────────────────
type Seg = { type: 'header' | 'step' | 'result' | 'body'; text: string; num?: number }

function isGarbledLine(s: string): boolean {
  const t = s.trim()
  if (t.length === 0) return true
  if (/^\d{1,3}$/.test(t)) return true
  const words = t.split(/\s+/)
  const realWords = words.filter(w => /[a-záéíóúüñ]{3,}/i.test(w))
  if (realWords.length === 0 && t.length < 60) return true
  return false
}

function cleanSegText(text: string): string {
  let t = text.replace(/\s+\d{1,3}\s*$/, '').trim()
  t = t.replace(/^(Tema:\s*[^.]+)\..*$/i, '$1')
  return t
}

function formatExplicacion(raw: string): Seg[] {
  // 1. Limpiar caracteres basura del PDF
  const cleaned = raw
    .replace(/[■□▪▫☐☑☒� --]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // 2. Dividir por saltos de línea existentes O por marcadores de sección conocidos
  const SECTION_RE = /(?=\b(Dato[s]?:|Resolviendo:|Enunciado:|Solución:|Solucio[nó]n:|Tema:|Tenemos:|Entonces:|Por lo tanto:|∴|Respuesta:|Rpta\.?:))/gi
  const parts = cleaned
    .split(/\n+/)
    .flatMap(line => line.split(SECTION_RE).filter(Boolean))
    .flatMap(part => {
      // Si sigue siendo muy largo (>200 chars) sin puntuación, dividir por ". " o " → "
      if (part.length > 200)
        return part.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])|\s+(?=→)\s*/).filter(Boolean)
      return [part]
    })
    .map(s => cleanSegText(s.trim()))
    .filter(s => s.length > 2)
    .filter(s => !isGarbledLine(s))
    .filter(s => !/^(Dato[s]?|Tenemos|Enunciado)\s*:\s*$/.test(s.trim()))

  let stepCounter = 0
  return parts.map((text): Seg => {
    const isHeader = /^(Dato[s]?:|Resolviendo:|Enunciado:|Solución:|Solucio[nó]n:|Tema:|Tenemos:)/i.test(text)
    const isResult = /^(Resultado:|Respuesta:|Rpta\.?:|Por lo tanto:|∴|Entonces:|Luego:)/i.test(text) || /respuesta.*=/.test(text.toLowerCase())
    const isNumbered = /^\d+[.)]\s/.test(text)
    if (isHeader) return { type: 'header', text }
    if (isResult) return { type: 'result', text }
    if (isNumbered) { stepCounter++; return { type: 'step', text: text.replace(/^\d+[.)]\s*/, ''), num: stepCounter } }
    // Heurística: si contiene '=' o '→' con números, es un paso de cálculo
    if (/[=→]\s*[-\d]/.test(text) && text.length < 180) { stepCounter++; return { type: 'step', text, num: stepCounter } }
    return { type: 'body', text }
  })
}


// ── Extrae el tema real desde la explicación del libro ───────────────────────
function extractTema(explicacion: string): string {
  const m = explicacion.match(/^Tema:\s*(.+)/im)
  return m ? m[1].trim() : ''
}

// Detecta y corrige área incorrecta en BD basándose en el contenido del enunciado
function fixArea(area: string, enunciado: string): string {
  const a = area.toLowerCase()
  // Si el área ya es de humanidades/ciencias sociales, confiar en ella
  if (/lectura|literatur|comunicac|lenguaje|histor|filosof|psicolog|econom|ciudadan|inglés|ingles|biolog/.test(a)) return area
  // Detectar comprensión lectora y literatura por contenido del enunciado
  const e = enunciado.toLowerCase()
  const isReading =
    /fragmento|párrafo|parrafo|el texto|del texto|lee el texto|el narrador|se infiere|de acuerdo con el|según el texto/.test(e) ||
    /novela|cuento|poema|ensayo|crónica|cuentista|narrativa|realismo|naturalismo|modernismo|vanguardia|boom latinoamericano/.test(e) ||
    /garcía márquez|garcia marquez|vallejo|neruda|vargas llosa|arguedas|palma|cervantes|shakespeare|rulfo|cortázar|borges/.test(e)
  if (isReading) return 'Lectura Crítica'
  return area
}

// ── QuestionCard ──────────────────────────────────────────────────────────────
function QuestionCard({ p, idx, materia, viewed: isViewed, speaking, audioLoading, played, showExplanation, onSpeak, onViewed, onResolStart, onResolEnd }: {
  p: Pregunta; idx: number; materia: Materia
  viewed: boolean; speaking: boolean; audioLoading: boolean; played: boolean; showExplanation: boolean
  onSpeak: (p: Pregunta) => void; onViewed: () => void
  onResolStart: (text: string) => void; onResolEnd: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const [speakingResol, setSpeakingResol] = useState(false)
  const [resolPlayed,   setResolPlayed]   = useState(false)
  const resolUtterRef = useRef<SpeechSynthesisUtterance | null>(null)
  const trueArea  = fixArea(p.area, p.enunciado)
  const pf        = getPureFormula(trueArea, p.enunciado)
  const answered  = selected !== null
  const isRight   = selected === p.respuesta

  const qvp = { id: p.id, stem: p.enunciado, area: trueArea, points: 1, difficulty: p.dificultad, options: p.opciones }
  const esCiencia = /matemát|física|química|biología|biolog/i.test(trueArea)

  // Para preguntas cortas (sin contexto del PDF), extraer "Del enunciado:" de la resolución
  const isContinuation = /problema anterior|anterior pregunta/i.test(p.explicacion || '')
  const problemData = (() => {
    if ((p.enunciado.length >= 100) || !p.explicacion) return ''
    const m = p.explicacion.match(/Del enunciado[:\s]*([\s\S]+?)(?=\nResolviendo|\nTenemos|\nDato|\n[A-ZÁÉÍÓÚ][a-záéíóúüñ]|Respuesta|$)/i)
    if (!m) return ''
    return m[1].replace(/[■□▪▫☐☑☒]/g, '').replace(/\s{2,}/g, ' ').trim().substring(0, 350)
  })()

  return (
    <div style={{ background: 'rgba(12,18,38,0.8)', border: `1px solid ${isViewed ? materia.color + '40' : 'rgba(255,255,255,0.07)'}`, borderLeft: `3px solid ${isViewed ? materia.color + '80' : 'transparent'}`, borderRadius: 12, padding: '18px 20px', marginBottom: 12, transition: 'border-color 0.2s' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: materia.color }}>Pregunta #{idx + 1}</span>
          <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{p.codigo}</span>
          <span style={{ fontSize: 10, color: '#475569' }}>{extractTema(p.explicacion || '') || p.tema}</span>
          <span style={{ fontSize: 9, color: SECCION_COLORS[p.seccion] || '#475569', background: `${SECCION_COLORS[p.seccion] || '#475569'}15`, border: `1px solid ${SECCION_COLORS[p.seccion] || '#475569'}30`, borderRadius: 8, padding: '1px 6px' }}>Sección {p.seccion}</span>
        </div>
      </div>

      {/* Contexto del problema (para preguntas en serie del PDF) */}
      {isContinuation && (
        <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#fbbf24' }}>
          ⚠️ Esta pregunta es continuación de la anterior — revisa los datos de la pregunta anterior.
        </div>
      )}
      {problemData && !isContinuation && (
        <div style={{ background: `${materia.color}10`, border: `1px solid ${materia.color}30`, borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: materia.color, marginBottom: 6 }}>📊 DATOS DEL PROBLEMA</div>
          <pre style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{problemData}</pre>
        </div>
      )}

      <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.7, marginBottom: 10 }}>{cleanEnunciado(p.enunciado)}</p>

      <QuestionInlineVisual question={qvp} color={materia.color} />
      {pf && <FormulaBox tex={pf.tex} isLatex={pf.isLatex} label={pf.label} vars={pf.vars} color={materia.color} />}

      {/* Gráfica automática por tipo de pregunta */}
      {(() => {
        const gi = detectarGrafico(trueArea, p.enunciado)
        if (gi.tipo === 'estadistica' || gi.tipo === 'probabilidad') return <GraficoEstadistico info={gi} />
        if (gi.tipo !== null) return <GraficoFuncion info={gi} />
        return null
      })()}

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: materia.color, letterSpacing: '.08em' }}>📋 RESOLUCIÓN COMPLETA — PASO A PASO</div>
            {!resolPlayed ? (
            <button
              onClick={() => {
                if (speakingResol) {
                  window.speechSynthesis.cancel()
                  setSpeakingResol(false)
                  onResolEnd()
                  return
                }
                // Leer siempre desde el libro — no usa IA
                const expl = (p.explicacion || '').replace(/[■□▪▫☐☑☒■●]/g, '').trim()
                const segs = formatExplicacion(expl)
                const correctaText = p.opciones.find(o => o.label === p.respuesta)?.text || ''
                const lines: string[] = [
                  `¡Hola! Vamos a resolver esta pregunta. La respuesta correcta es la opción ${p.respuesta}: ${correctaText}.`,
                ]
                let stepCount = 0
                const pasos = ['Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto', 'Luego', 'Finalmente']
                for (const seg of segs) {
                  if (seg.type === 'header') {
                    lines.push(seg.text.replace(/:/g, '.'))
                  } else if (seg.type === 'step') {
                    lines.push(`${pasos[stepCount] || `Paso ${stepCount + 1}`}. ${seg.text}`)
                    stepCount++
                  } else if (seg.type === 'result') {
                    lines.push(`Por lo tanto, ${seg.text.replace(/^(resultado:|respuesta:|rpta\.?:|por lo tanto:|entonces:)/i, '').trim()}`)
                  } else if (seg.type === 'body' && seg.text.length > 15) {
                    lines.push(seg.text)
                  }
                }
                lines.push(`Practica este procedimiento hasta que sea automático. ¡Tú puedes!`)
                const finalText = lines.join(' ').replace(/\.\s*\./g, '.').replace(/\s+/g, ' ').trim()
                window.speechSynthesis.cancel()
                const u = new SpeechSynthesisUtterance(finalText)
                u.lang   = 'es-PE'
                u.rate   = 1.1
                u.pitch  = 0.85
                u.volume = 1
                const voz = pickMaleVoice()
                if (voz) u.voice = voz
                u.onstart = () => { setSpeakingResol(true); onResolStart(finalText.slice(0, 120)) }
                u.onend   = () => { setSpeakingResol(false); setResolPlayed(true); onResolEnd() }
                u.onerror = () => { setSpeakingResol(false); onResolEnd() }
                resolUtterRef.current = u
                window.speechSynthesis.speak(u)
              }}
              style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${speakingResol ? 'rgba(239,68,68,0.5)' : materia.color + '60'}`, background: speakingResol ? 'rgba(239,68,68,0.1)' : `${materia.color}12`, color: speakingResol ? '#f87171' : materia.color, fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, animation: speakingResol ? 'pulse-audio 1.2s infinite' : 'none' }}
            >
              {speakingResol ? '⏹ Detener' : '🔊 Escuchar resolución'}
            </button>
            ) : (
            <span style={{ fontSize: 10, color: materia.color, background: `${materia.color}08`, border: `1px solid ${materia.color}20`, borderRadius: 8, padding: '5px 12px', fontWeight: 700 }}>
              ✓ Resolución escuchada
            </span>
            )}
          </div>

          <div style={{ background: 'rgba(63,185,80,0.08)', border: '1px solid rgba(63,185,80,0.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#3fb950', fontWeight: 600 }}>
            ✓ Respuesta correcta — Opción {p.respuesta}:{' '}
            <span style={{ fontWeight: 400 }}>{p.opciones.find(o => o.label === p.respuesta)?.text}</span>
          </div>

          <PizarraExplicacion
            explicacion_ia={p.explicacion_ia || ''}
            explicacion={p.explicacion || ''}
            respuesta={p.respuesta}
            opcion_resp={p.opciones.find(o => o.label === p.respuesta)?.text || ''}
            color={materia.color}
          />

          <div style={{ marginTop: 12, padding: '8px 12px', background: `${materia.color}08`, border: `1px solid ${materia.color}20`, borderRadius: 8, fontSize: 12, color: materia.color, fontStyle: 'italic' }}>
            🌟 ¡Muy bien! Repasa este procedimiento para que en el examen lo hagas en segundos.
          </div>
        </div>
      )}
    </div>
  )
}
