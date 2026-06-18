// Utilidad compartida de selección de voz masculina española para TTS
export function pickMaleVoice(): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis?.getVoices() || []
  const MALE = [
    'pablo','jorge','diego','carlos','miguel','raul','raúl','juan','andres','andrés',
    'antonio','rodrigo','sergio','male','hombre','man','masculino','alvaro','álvaro',
    'ricardo','luis','victor','víctor','alberto','gustavo','javier','alejandro',
    'manuel','francisco','pedro','roberto','eduardo','gabriel','daniel','mario',
    'felipe','enrique','rafael','nicolas','nicolás','jose','josé','felix','félix',
    'ernesto','hugo','arturo','oscar','óscar','armando','julio','marco','rubén',
    'ruben','xavier','mateo','sebastian','sebastián','ignacio','emilio',
  ]
  const FEMALE = [
    'angela','ángela','maria','maría','lucia','lucía','sofia','sofía','elena',
    'laura','isabel','valentina','ana','female','mujer','woman','femenino',
    'dalia','marisol','sabina','conchita','esperanza','monica','mónica',
    'paula','andrea','helena','raquel','pilar','carmen','rosa',
    'marta','patricia','sara','clara','irene','beatriz','alicia','silvia',
    'cristina','nuria','eva','inés','ines','gloria','olga','sonia','paloma',
    'dolores','lola','concepcion','concepción','rocio','rocío','lupe','guadalupe',
    'fernanda','renata','daniela','camila','isabella','emilia','natalia','valeria',
    'mariana','claudia','viviana','paola','verónica','veronica','susana','julia',
    'elvira','penelope','penélope','yolanda','ximena','adriana','alejandra',
    'leticia','lorena','martha','miriam','nadia','noelia','rebeca',
    'vanesa','vanessa','wendy','zoe','sabrina','selena','linda',
    'lisa','samantha','stephanie','jessica','jennifer','sarah','karen',
  ]
  const score = (v: SpeechSynthesisVoice) => {
    const n = v.name.toLowerCase(), lang = v.lang.toLowerCase()
    let s = 0
    if (MALE.some(m => n.includes(m)))   s += 500
    if (FEMALE.some(f => n.includes(f))) s -= 500
    // Voces Google Neural2-B / Wavenet-B suelen ser masculinas
    if (/[-_\s][bdfhjlnprtvxz]\b/i.test(v.name)) s += 30
    if (lang === 'es-pe' || /peru/i.test(n)) s += 80
    else if (lang === 'es-mx' || lang === 'es-us') s += 50
    else if (lang.startsWith('es-'))               s += 40
    else if (lang.startsWith('es'))                s += 20
    if (/neural|natural|enhanced|premium/i.test(n)) s += 15
    return s
  }
  const es = all.filter(v => /^es/i.test(v.lang))
  if (!es.length) return all[0] ?? null
  return es.sort((a, b) => score(b) - score(a))[0]
}
