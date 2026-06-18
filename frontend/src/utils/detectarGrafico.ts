// =============================================================================
//  detectarGrafico.ts
//  Detecta si una pregunta puede beneficiarse de una visualización gráfica
//  y extrae la expresión matemática o el tipo de gráfico a mostrar.
// =============================================================================

export type TipoGrafico =
  | 'funcion'       // gráfica de función y = f(x)
  | 'trigonometria' // gráfica de seno/coseno/tangente
  | 'geometria'     // figura geométrica (triángulo, círculo, etc.)
  | 'estadistica'   // histograma, diagrama de barras
  | 'probabilidad'  // distribución, diagrama de árbol
  | 'fisica'        // gráfica posición/velocidad-tiempo
  | null

export interface InfoGrafico {
  tipo: TipoGrafico
  expresiones: string[]   // funciones para function-plot, ej: ["sin(x)", "x^2-4"]
  dominio: [number, number]
  titulo: string
  datosBar?: { label: string; valor: number }[]  // para gráficas de barras
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXTRACCIÓN DE FUNCIONES DESDE TEXTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte la notación española/LaTeX a notación function-plot.
 * "2x²-3x+1" → "2*x^2-3*x+1"
 * "sen(x)" → "sin(x)"
 */
function normalizarExpresion(expr: string): string {
  return expr
    .replace(/\bsen\b/gi, 'sin')
    .replace(/\btg\b/gi,  'tan')
    .replace(/\bln\b/gi,  'log')
    .replace(/\bLn\b/gi,  'log')
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')   // 2x → 2*x, 3( → 3*(
    .replace(/([a-zA-Z\d)])\s*\^/g, '$1^')  // normalizar exponentes
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√\(([^)]+)\)/g, 'sqrt($1)')
    .replace(/√(\w+)/g, 'sqrt($1)')
    .replace(/\s+/g, '')
}

/**
 * Busca patrones "f(x) = ...", "y = ...", "g(t) = ...", "h(x) = ..." en el texto.
 */
function extraerFunciones(texto: string): string[] {
  const resultados: string[] = []
  const text = texto.replace(/\n/g, ' ')

  // Patrones: f(x) = expr | y = expr | g(x) = expr
  const patronFn = /(?:[fghpqFGHP]\s*\([xt]\)\s*=\s*|y\s*=\s*)([^,;.\n\)]{3,50})/gi
  let m: RegExpExecArray | null
  while ((m = patronFn.exec(text)) !== null) {
    const norm = normalizarExpresion(m[1].trim())
    if (norm && !resultados.includes(norm)) resultados.push(norm)
  }

  return resultados
}

/**
 * Extrae pares dato-frecuencia para gráficas estadísticas.
 * Busca tablas o listas con números en el texto.
 */
function extraerDatosEstadisticos(texto: string): { label: string; valor: number }[] | null {
  // Busca patrones como "Matemática: 30", "A: 15, B: 25"
  const patron = /([A-Za-záéíóúÁÉÍÓÚñÑ][A-Za-záéíóúÁÉÍÓÚñÑ\s]{1,20})\s*[:=]\s*(\d+)/g
  const datos: { label: string; valor: number }[] = []
  let m: RegExpExecArray | null
  while ((m = patron.exec(texto)) !== null) {
    datos.push({ label: m[1].trim(), valor: parseInt(m[2]) })
  }
  if (datos.length >= 2) return datos

  // Alternativa: busca listas de números "10, 15, 20, 25, 30"
  const listaNum = texto.match(/\b(\d{1,4})\b/g)
  if (listaNum && listaNum.length >= 4 && listaNum.length <= 12) {
    return listaNum.map((n, i) => ({ label: `Dato ${i + 1}`, valor: parseInt(n) }))
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
//  BIBLIOTECA DE GRÁFICAS POR SUBTEMA (cuando no hay expresión explícita)
// ─────────────────────────────────────────────────────────────────────────────

const GRAFICAS_REFERENCIA: Record<string, { expresiones: string[]; dominio: [number, number]; titulo: string }> = {
  seno:          { expresiones: ['sin(x)'],              dominio: [-7, 7],    titulo: 'y = sen(x)' },
  coseno:        { expresiones: ['cos(x)'],              dominio: [-7, 7],    titulo: 'y = cos(x)' },
  tangente:      { expresiones: ['tan(x)'],              dominio: [-1.4, 1.4], titulo: 'y = tan(x)' },
  seno_coseno:   { expresiones: ['sin(x)', 'cos(x)'],   dominio: [-7, 7],    titulo: 'sen(x) y cos(x)' },
  cuadratica:    { expresiones: ['x^2'],                 dominio: [-5, 5],    titulo: 'y = x²' },
  lineal:        { expresiones: ['2*x+1'],               dominio: [-5, 5],    titulo: 'y = 2x + 1' },
  exponencial:   { expresiones: ['exp(x)'],              dominio: [-3, 3],    titulo: 'y = eˣ' },
  logaritmo:     { expresiones: ['log(x)'],              dominio: [0.1, 10],  titulo: 'y = ln(x)' },
  parabola:      { expresiones: ['x^2 - 4'],             dominio: [-4, 4],    titulo: 'y = x² - 4' },
  velocidad:     { expresiones: ['3*x'],                 dominio: [0, 10],    titulo: 'Velocidad constante v = 3 m/s' },
  aceleracion:   { expresiones: ['0.5*x^2'],             dominio: [0, 8],     titulo: 'Posición con aceleración uniforme' },
}

// ─────────────────────────────────────────────────────────────────────────────
//  FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

export function detectarGrafico(area: string, enunciado: string): InfoGrafico {
  const ctx = (area + ' ' + enunciado).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')

  // 1. Intentar extraer función explícita del enunciado
  const funciones = extraerFunciones(enunciado)

  // ── FUNCIONES EXPLÍCITAS ─────────────────────────────────────────────────
  if (funciones.length > 0) {
    const dominio: [number, number] =
      /trigon|seno|coseno|tangente|\bsin\b|\bcos\b/.test(ctx) ? [-7, 7] :
      /exponencial|exp/.test(ctx) ? [-3, 5] :
      [-10, 10]

    return {
      tipo: 'funcion',
      expresiones: funciones,
      dominio,
      titulo: `Gráfica: ${funciones.map(f => 'y = ' + f).join(' | ')}`,
    }
  }

  // ── TRIGONOMETRÍA ────────────────────────────────────────────────────────
  if (/trigon|seno|coseno|tangente|sen\b|cos\b|tan\b|razon trigon/.test(ctx)) {
    const ambas = /seno.*coseno|coseno.*seno/.test(ctx)
    if (ambas) return { tipo: 'trigonometria', ...GRAFICAS_REFERENCIA.seno_coseno }
    if (/coseno/.test(ctx)) return { tipo: 'trigonometria', ...GRAFICAS_REFERENCIA.coseno }
    if (/tangente|\btan\b/.test(ctx)) return { tipo: 'trigonometria', ...GRAFICAS_REFERENCIA.tangente }
    return { tipo: 'trigonometria', ...GRAFICAS_REFERENCIA.seno }
  }

  // ── FUNCIONES ALGEBRAICAS ────────────────────────────────────────────────
  if (/funcion cuadratic|parabola|parabolica|x\^2|x2/.test(ctx)) {
    return { tipo: 'funcion', ...GRAFICAS_REFERENCIA.cuadratica }
  }
  if (/funcion lineal|recta|pendiente/.test(ctx)) {
    return { tipo: 'funcion', ...GRAFICAS_REFERENCIA.lineal }
  }
  if (/funcion exponencial|crecimiento exponencial/.test(ctx)) {
    return { tipo: 'funcion', ...GRAFICAS_REFERENCIA.exponencial }
  }
  if (/logaritmo|funcion logaritm/.test(ctx)) {
    return { tipo: 'funcion', ...GRAFICAS_REFERENCIA.logaritmo }
  }

  // ── FÍSICA: CINEMÁTICA ───────────────────────────────────────────────────
  if (/velocidad.*tiempo|distancia.*tiempo|posicion.*tiempo|cinemat|movimiento/.test(ctx)) {
    if (/aceleracion|uniformemente acelerado|mua/.test(ctx)) {
      return { tipo: 'fisica', ...GRAFICAS_REFERENCIA.aceleracion }
    }
    return { tipo: 'fisica', ...GRAFICAS_REFERENCIA.velocidad }
  }

  // ── ESTADÍSTICA ──────────────────────────────────────────────────────────
  if (/histograma|frecuencia|tabla.*datos|promedio|media|mediana|moda/.test(ctx)) {
    const datos = extraerDatosEstadisticos(enunciado)
    if (datos) {
      return {
        tipo: 'estadistica',
        expresiones: [],
        dominio: [0, 100],
        titulo: 'Distribución de datos',
        datosBar: datos,
      }
    }
  }

  // ── PROBABILIDAD ─────────────────────────────────────────────────────────
  if (/probabilidad|distribucion|frecuencia relativa/.test(ctx)) {
    const datos = extraerDatosEstadisticos(enunciado)
    if (datos) {
      return {
        tipo: 'probabilidad',
        expresiones: [],
        dominio: [0, 1],
        titulo: 'Distribución de probabilidad',
        datosBar: datos,
      }
    }
  }

  return { tipo: null, expresiones: [], dominio: [-10, 10], titulo: '' }
}
