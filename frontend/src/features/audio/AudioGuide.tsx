// =============================================================================
//  AudioGuide.tsx — Sistema de audio guía pedagógica con voz IA
//  10 bienvenidas distintas + guía contextual por pantalla
// =============================================================================
import React, {
  createContext, useContext, useCallback,
  useRef, useState, useEffect, useMemo
} from 'react'
import { pickMaleVoice } from './voiceUtils'

// ─── 10 Bienvenidas (se eligen aleatoriamente) ───────────────────────────────
const WELCOMES = [
  "¡Bienvenido! Soy tu tutor virtual con inteligencia artificial. Estoy aquí para guiarte paso a paso hacia el éxito en tu examen.",
  "¡Hola! Qué alegría tenerte aquí. Con neurociencia e inteligencia artificial, vamos a prepararte de la mejor manera posible.",
  "¡Hola, estudiante! Hoy es un día perfecto para aprender. Juntos vamos a conquistar cada tema de tu examen.",
  "Bienvenido a la academia virtual más completa. Aquí tienes pizarra digital, simulacros reales, banco de preguntas y tu tutor socrático personal.",
  "¡Hola! Me alegra que hayas llegado. Recuerda: cada pregunta que practicas hoy, es una pregunta que dominarás en tu examen.",
  "Bienvenido. La neurociencia nos enseña que aprender con emoción fija el conocimiento para siempre. Aquí hacemos eso posible.",
  "¡Qué bueno verte! El camino hacia tu universidad empieza aquí. Yo te acompaño en cada paso con inteligencia artificial.",
  "Hola, futuro universitario. Estoy listo para ayudarte. Tenemos simulacros, banco de preguntas, explicaciones con audio y mucho más.",
  "¡Bienvenido de nuevo! Tu constancia es tu mayor fortaleza. Sigamos construyendo juntos el conocimiento que necesitas para triunfar.",
  "Bienvenido. Soy tu asistente pedagógico con inteligencia artificial. Mi misión es que llegues preparado y confiado a tu examen."
]

// ─── Guías por pantalla ───────────────────────────────────────────────────────
const GUIDES: Record<string, string> = {
  country: "Selecciona tu país para comenzar. Si eres de Colombia, elige la bandera colombiana para prepararte para el examen ICFES Saber Once. Si eres de Perú, elige la bandera peruana para acceder a TES-LA PRO y prepararte para el examen de admisión universitario.",
  login_co: "Para ingresar al sistema colombiano, escribe tu correo electrónico y contraseña. También puedes usar el botón de Google para entrar con un solo clic. Si no tienes cuenta, haz clic en Registrarse y elige si eres alumno, docente o institución.",
  login_pe: "Bienvenido a TES-LA PRO, la academia virtual para el examen de admisión universitario del Perú. Ingresa con tu correo o usa Google. Si es tu primera vez, regístrate gratis y elige el plan que necesitas.",
  home_co: "Este es tu panel de inicio del ICFES. Puedes iniciar un simulacro oficial de doscientas cuarenta y cinco preguntas, practicar en el banco de preguntas por materia, o consultar tus estadísticas de rendimiento.",
  home_pe: "Selecciona la sección de tu examen de admisión. Puedes elegir Sección A para letras, Sección B para ciencias, o las combinaciones que necesitas. Cada sección tiene preguntas específicas para tu área de estudio.",
  exam: "El simulacro ha iniciado. Lee cada pregunta con calma y sin apresurarte. Si tienes dudas sobre algún tema, usa el botón de Ayuda con Inteligencia Artificial y tu tutor socrático te explicará el concepto paso a paso, sin darte la respuesta directamente para que aprendas mejor.",
  banco: "Aquí está el banco de preguntas. Puedes filtrar por materia y por tema. Para cada pregunta puedes solicitar una explicación completa con audio. Avanza a tu propio ritmo y refuerza los temas donde necesites más práctica.",
  admin: "Panel de administración completo. Desde aquí puedes crear y gestionar usuarios, aprobar pagos, revisar estadísticas generales y administrar el banco de preguntas del sistema.",
  register: "Para registrarte, primero elige tu tipo de usuario: alumno para acceder a simulacros y práctica, docente para gestionar grupos de estudiantes, o institución para administrar múltiples usuarios. Completa tus datos y en segundos tendrás acceso completo al sistema.",
  payment: "Selecciona el plan que mejor se adapte a tus necesidades. Puedes pagar con Nequi, tarjeta de crédito, o transferencia bancaria. Una vez aprobado el pago, tu cuenta se activa automáticamente.",
  payment_pe: "Selecciona tu plan TES-LA PRO. Puedes pagar con Yape, Plin, o en efectivo en cualquier agente BCP. Después de enviar tu voucher, verificamos el pago en pocas horas.",
}

// ─── Sistema de eventos para speaking (no usa estado de contexto) ─────────────
// Esto evita que setSpeaking re-renderice TODOS los consumidores de contexto.
type SpeakingListener = (s: boolean) => void
const _speakingListeners = new Set<SpeakingListener>()
function _notifySpeaking(s: boolean) { _speakingListeners.forEach(fn => fn(s)) }

// ─── Context — SIN speaking para evitar re-renders en cadena ─────────────────
interface AudioCtx {
  play: (screen: string) => void
  playWelcome: () => void
  stop: () => void
  enabled: boolean
  toggleEnabled: () => void
}

const Ctx = createContext<AudioCtx>({
  play: () => {}, playWelcome: () => {}, stop: () => {},
  enabled: true, toggleEnabled: () => {}
})

export const useAudioGuide = () => useContext(Ctx)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AudioGuideProvider({ children, locale = 'es' }: { children: React.ReactNode; locale?: string }) {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem('audio_guide_enabled') !== 'false' } catch { return true }
  })
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  const speak = useCallback((text: string) => {
    if (!enabled || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    const isPe = locale.includes('PE') || locale.includes('pe')
    u.lang   = isPe ? 'es-PE' : 'es-CO'
    u.rate   = 1.25
    u.pitch  = isPe ? 0.85 : 1.05
    u.volume = 1
    // Perú siempre voz masculina; Colombia primera voz disponible del locale
    const voice = isPe
      ? pickMaleVoice()
      : (() => {
          const vs = window.speechSynthesis.getVoices()
          return vs.find(v => v.lang.startsWith(locale) && !v.localService)
              || vs.find(v => v.lang.startsWith(locale))
              || vs.find(v => v.lang.startsWith('es'))
              || null
        })()
    if (voice) u.voice = voice
    // Notifica a los listeners (solo AudioFloatingBtn) sin re-renderizar el contexto
    u.onstart = () => _notifySpeaking(true)
    u.onend   = () => _notifySpeaking(false)
    u.onerror = () => _notifySpeaking(false)
    utterRef.current = u
    window.speechSynthesis.speak(u)
  }, [enabled, locale])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    _notifySpeaking(false)
  }, [])

  const play = useCallback((screen: string) => {
    const text = GUIDES[screen]
    if (text) speak(text)
  }, [speak])

  const playWelcome = useCallback(() => {
    const idx  = Math.floor(Math.random() * WELCOMES.length)
    speak(WELCOMES[idx])
  }, [speak])

  const toggleEnabled = useCallback(() => {
    setEnabled(e => {
      const next = !e
      try { localStorage.setItem('audio_guide_enabled', String(next)) } catch {}
      if (!next) { window.speechSynthesis?.cancel(); _notifySpeaking(false) }
      return next
    })
  }, [])

  // Sincronizar singleton para useScreenGuide
  useEffect(() => {
    _screenGuideFn = play
    _screenGuideEnabled = enabled
  }, [play, enabled])

  // Cargar voces
  useEffect(() => {
    window.speechSynthesis?.getVoices()
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
    }
  }, [])

  const ctxValue = useMemo(
    () => ({ play, playWelcome, stop, enabled, toggleEnabled }),
    [play, playWelcome, stop, enabled, toggleEnabled]
  )

  return (
    <Ctx.Provider value={ctxValue}>
      {children}
      <AudioFloatingBtn />
    </Ctx.Provider>
  )
}

// ─── Floating Button — usa listener local, NO useContext para speaking ────────
function AudioFloatingBtn() {
  const { enabled, toggleEnabled, stop } = useAudioGuide()
  const [visible,  setVisible]  = useState(false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(t)
  }, [])

  // Escucha eventos de speaking sin pasar por el contexto
  useEffect(() => {
    _speakingListeners.add(setSpeaking)
    return () => { _speakingListeners.delete(setSpeaking) }
  }, [])

  if (!visible) return null

  return (
    <button
      onClick={() => { if (speaking) stop(); else toggleEnabled() }}
      title={speaking ? 'Detener audio' : enabled ? 'Audio guía activo · clic para desactivar' : 'Audio guía desactivado · clic para activar'}
      style={{
        position: 'fixed', bottom: 22, right: 22, zIndex: 9999,
        width: 46, height: 46, borderRadius: '50%',
        background: speaking
          ? 'rgba(239,68,68,0.9)'
          : enabled
            ? 'rgba(37,99,235,0.85)'
            : 'rgba(30,41,59,0.8)',
        border: `1px solid ${speaking ? 'rgba(239,68,68,0.4)' : enabled ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: speaking
          ? '0 0 16px rgba(239,68,68,0.4)'
          : enabled
            ? '0 0 12px rgba(37,99,235,0.3)'
            : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', fontSize: 18,
        transition: 'all 0.2s',
        animation: speaking ? 'pulse-audio 1s infinite' : 'none',
      }}
    >
      {speaking ? '⏹' : enabled ? '🔊' : '🔇'}
      <style>{`
        @keyframes pulse-audio {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }
      `}</style>
    </button>
  )
}

// ─── Hook público para leer speaking sin causar re-renders en el contexto ─────
export function useSpeaking() {
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => {
    _speakingListeners.add(setSpeaking)
    return () => { _speakingListeners.delete(setSpeaking) }
  }, [])
  return speaking
}

// ─── Singleton para useScreenGuide ────────────────────────────────────────────
let _screenGuideFn: (screen: string) => void = () => {}
let _screenGuideEnabled = true

// ─── Hook: auto-play al montar — NO usa useContext ───────────────────────────
export function useScreenGuide(screen: string, delay = 800) {
  useEffect(() => {
    if (!_screenGuideEnabled) return
    const key = `guide_played_${screen}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    const t = setTimeout(() => _screenGuideFn(screen), delay)
    return () => clearTimeout(t)
  }, [])
}
