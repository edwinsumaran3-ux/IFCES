// ── Convierte explicación plana en narración socrática (pregunta → respuesta) ──
export function makeSocratic(area: string, enunciado: string, texto: string): string {
  const ctx = (area + ' ' + enunciado).toLowerCase()

  // Primera pregunta: específica al tema
  const q1 =
    /celsius|fahrenheit|kelvin|temperatura/.test(ctx)    ? '¿Cómo se construye esa fórmula de temperatura?' :
    /energía cin|energia cin|cinética/.test(ctx)         ? '¿Qué es la energía cinética físicamente?' :
    /energía pot|energia pot|potencial/.test(ctx)        ? '¿Qué es la energía potencial gravitacional?' :
    /velocidad.*(distancia|tiempo)|distancia.*velocidad/.test(ctx) ? '¿Qué relación existe entre velocidad, distancia y tiempo?' :
    /fuerza.*(masa|acelerac)|newton/.test(ctx)           ? '¿Qué dice la Segunda Ley de Newton?' :
    /caída libre|caida libre|proyectil/.test(ctx)        ? '¿Cómo funciona la caída libre?' :
    /onda|frecuenc|longitud de onda|refrac/.test(ctx)    ? '¿Qué son las ondas y cómo se comportan?' :
    /voltaje|corriente|resistencia|ohm/.test(ctx)        ? '¿Qué nos dice la Ley de Ohm?' :
    /mol|estequiom|reactivo|reacción/.test(ctx)          ? '¿Cómo funciona la estequiometría?' :
    /ph|ácido|acido|alcalin|base/.test(ctx)              ? '¿Qué mide realmente el pH?' :
    /átomo|protón|electron|neutrón|masa atómica/.test(ctx) ? '¿Cómo está organizado el átomo?' :
    /enlace|covalente|iónico|electroneg/.test(ctx)       ? '¿Por qué se forman los enlaces químicos?' :
    /tabla periódica|período|grupo.*element/.test(ctx)   ? '¿Cómo se organiza la tabla periódica?' :
    /solución|concentración|soluto|solvente/.test(ctx)   ? '¿Qué es la concentración de una solución?' :
    /fotosíntesis|clorofila|cloroplasto/.test(ctx)       ? '¿Cómo funciona la fotosíntesis?' :
    /genética|adn|gen|cromosoma|alelo|herencia/.test(ctx)? '¿Cómo se transmiten los rasgos hereditarios?' :
    /evolución|selección natural|adaptación/.test(ctx)   ? '¿Cómo funciona la selección natural?' :
    /célula|mitosis|meiosis|mitocondria/.test(ctx)       ? '¿Qué hace cada parte de la célula?' :
    /ecosistema|cadena.*tróf|biodiversidad/.test(ctx)    ? '¿Cómo fluye la energía en un ecosistema?' :
    /hipotenusa|cateto|triángulo rect/.test(ctx)         ? '¿Por qué funciona el Teorema de Pitágoras?' :
    /porcentaje|descuento|rebaja|interés/.test(ctx)      ? '¿Qué significa el porcentaje realmente?' :
    /área|perímetro|volumen|superficie/.test(ctx)        ? '¿De dónde vienen las fórmulas de geometría?' :
    /promedio|media|moda|mediana/.test(ctx)              ? '¿Qué diferencia hay entre media, mediana y moda?' :
    /ecuación|despeja|incógnita/.test(ctx)               ? '¿Cómo despejamos una incógnita?' :
    /proporción|regla de tres|fracción/.test(ctx)        ? '¿Cómo funciona la regla de tres?' :
    /función|pendiente|coordenadas/.test(ctx)            ? '¿Qué nos dice la función lineal?' :
    /permut|combina|factorial/.test(ctx)                 ? '¿Cuándo usamos permutaciones y cuándo combinaciones?' :
    /probabilidad|azar|evento/.test(ctx)                 ? '¿Cómo calculamos la probabilidad?' :
    /lectura|crítica|texto|fragmento|narrador|novela|cuento|literatur|realismo|narrativa/.test(ctx) ? '¿Cómo abordamos la lectura crítica?' :
    /sociales|historia|geografía|ciudadan/.test(ctx)     ? '¿Qué relación causa-efecto hay aquí?' :
    /inglés|ingles/.test(ctx)                            ? '¿Qué estrategia usamos en comprensión de lectura?' :
    /ecuación|despeja|incógnita/.test(ctx)               ? '¿Cómo despejamos una incógnita?' :
    '¿Por qué ocurre esto y cómo lo resolvemos?'

  const q2 =
    /matemát|fisica|química|biolog/.test(ctx) ? '¿Y cómo aplicamos eso al problema concreto?' :
    /lectura|sociales|inglés/.test(ctx)       ? '¿Cómo eliminamos las opciones incorrectas?' :
    '¿Cómo llegamos a la respuesta correcta?'

  const q3 = '¿En qué detalle debemos tener cuidado?'

  // Dividir en frases y agrupar en 3 bloques
  const frases = texto.split(/(?<=[.!?])\s+/).filter(Boolean)
  const n = frases.length
  const c1 = Math.ceil(n * 0.40)
  const c2 = Math.ceil(n * 0.75)

  const p1 = frases.slice(0, c1).join(' ')
  const p2 = frases.slice(c1, c2).join(' ')
  const p3 = frases.slice(c2).join(' ')

  const partes: string[] = []
  if (p1) partes.push(`${q1} ${p1}`)
  if (p2) partes.push(`${q2} ${p2}`)
  if (p3) partes.push(`${q3} ${p3}`)

  return partes.join(' ')
}

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
