// =============================================================================
//  terminosPorMateria.ts
//  Biblioteca de términos técnicos por materia y subtema.
//  Usada por el tutor de audio para hablar con el vocabulario correcto del curso.
// =============================================================================

export interface Termino {
  t: string   // término técnico
  d: string   // definición breve oral (sin símbolos)
}

// ─────────────────────────────────────────────────────────────────────────────
//  MATEMÁTICA
// ─────────────────────────────────────────────────────────────────────────────
const MAT_TRIGONOMETRIA: Termino[] = [
  { t: 'razón trigonométrica',   d: 'relación entre dos lados de un triángulo rectángulo' },
  { t: 'cateto opuesto',         d: 'lado del triángulo frente al ángulo que se estudia' },
  { t: 'cateto adyacente',       d: 'lado del triángulo junto al ángulo que se estudia' },
  { t: 'hipotenusa',             d: 'lado más largo del triángulo rectángulo, frente al ángulo recto' },
  { t: 'seno',                   d: 'razón entre el cateto opuesto y la hipotenusa' },
  { t: 'coseno',                 d: 'razón entre el cateto adyacente y la hipotenusa' },
  { t: 'tangente',               d: 'razón entre el cateto opuesto y el cateto adyacente' },
  { t: 'ángulo de elevación',    d: 'ángulo formado entre la horizontal y la visual hacia arriba' },
  { t: 'ángulo de depresión',    d: 'ángulo formado entre la horizontal y la visual hacia abajo' },
  { t: 'identidad trigonométrica', d: 'igualdad válida para cualquier valor del ángulo' },
]

const MAT_ALGEBRA: Termino[] = [
  { t: 'incógnita',              d: 'variable cuyo valor se busca encontrar' },
  { t: 'coeficiente',            d: 'número que multiplica a la variable en una expresión' },
  { t: 'término independiente',  d: 'número sin variable en una ecuación' },
  { t: 'ecuación de primer grado', d: 'ecuación donde la variable tiene exponente uno' },
  { t: 'sistema de ecuaciones',  d: 'conjunto de ecuaciones que se resuelven simultáneamente' },
  { t: 'despejar',               d: 'aislar la incógnita de un lado de la ecuación' },
  { t: 'solución o raíz',        d: 'valor que hace verdadera la ecuación' },
  { t: 'polinomio',              d: 'expresión algebraica con varios términos' },
  { t: 'factorizar',             d: 'expresar un polinomio como producto de factores más simples' },
  { t: 'discriminante',          d: 'expresión que determina el tipo de soluciones de una cuadrática' },
]

const MAT_GEOMETRIA: Termino[] = [
  { t: 'perímetro',              d: 'suma de todos los lados de una figura' },
  { t: 'área',                   d: 'medida de la superficie interior de una figura' },
  { t: 'volumen',                d: 'medida del espacio tridimensional que ocupa un sólido' },
  { t: 'teorema de Pitágoras',   d: 'el cuadrado de la hipotenusa es igual a la suma de los cuadrados de los catetos' },
  { t: 'semejanza',              d: 'figuras con la misma forma pero diferente tamaño' },
  { t: 'congruencia',            d: 'figuras con la misma forma y el mismo tamaño' },
  { t: 'ángulo inscrito',        d: 'ángulo cuyo vértice está sobre la circunferencia' },
  { t: 'trapecio',               d: 'cuadrilátero con exactamente un par de lados paralelos' },
  { t: 'altura',                 d: 'segmento perpendicular desde un vértice hasta el lado opuesto' },
  { t: 'diagonal',               d: 'segmento que une dos vértices no consecutivos de un polígono' },
]

const MAT_ESTADISTICA: Termino[] = [
  { t: 'media aritmética',       d: 'suma de todos los datos dividida entre la cantidad de datos' },
  { t: 'mediana',                d: 'valor central cuando los datos están ordenados' },
  { t: 'moda',                   d: 'dato que aparece con mayor frecuencia en el conjunto' },
  { t: 'rango',                  d: 'diferencia entre el dato mayor y el dato menor' },
  { t: 'varianza',               d: 'medida de dispersión de los datos respecto a la media' },
  { t: 'desviación estándar',    d: 'raíz cuadrada de la varianza; mide la dispersión de los datos' },
  { t: 'frecuencia absoluta',    d: 'número de veces que aparece un dato' },
  { t: 'frecuencia relativa',    d: 'proporción de veces que aparece un dato respecto al total' },
  { t: 'cuartil',                d: 'valor que divide los datos ordenados en cuatro partes iguales' },
  { t: 'histograma',             d: 'gráfico de barras que representa la distribución de frecuencias' },
]

const MAT_PROBABILIDAD: Termino[] = [
  { t: 'espacio muestral',       d: 'conjunto de todos los resultados posibles de un experimento' },
  { t: 'evento o suceso',        d: 'subconjunto del espacio muestral' },
  { t: 'evento complementario',  d: 'evento que contiene todos los resultados que no son del evento dado' },
  { t: 'eventos mutuamente excluyentes', d: 'eventos que no pueden ocurrir simultáneamente' },
  { t: 'regla de la multiplicación', d: 'para eventos independientes, se multiplican las probabilidades' },
  { t: 'probabilidad condicional', d: 'probabilidad de un evento dado que ya ocurrió otro' },
  { t: 'combinación',            d: 'selección sin importar el orden' },
  { t: 'permutación',            d: 'selección donde sí importa el orden' },
  { t: 'experimento aleatorio',  d: 'experimento cuyo resultado no se puede predecir con certeza' },
  { t: 'ley de Laplace',         d: 'probabilidad igual a casos favorables sobre casos totales' },
]

const MAT_ARITMETICA: Termino[] = [
  { t: 'múltiplo',               d: 'número que resulta de multiplicar otro número por un entero' },
  { t: 'divisor',                d: 'número que divide exactamente a otro sin dejar residuo' },
  { t: 'máximo común divisor',   d: 'mayor número que divide exactamente a dos o más números' },
  { t: 'mínimo común múltiplo',  d: 'menor número múltiplo común de dos o más números' },
  { t: 'número primo',           d: 'número mayor que uno divisible solo por uno y por sí mismo' },
  { t: 'porcentaje',             d: 'proporción por cada cien unidades' },
  { t: 'regla de tres directa',  d: 'si una cantidad aumenta, la otra también aumenta proporcionalmente' },
  { t: 'regla de tres inversa',  d: 'si una cantidad aumenta, la otra disminuye proporcionalmente' },
  { t: 'razón',                  d: 'cociente entre dos cantidades del mismo tipo' },
  { t: 'proporción',             d: 'igualdad entre dos razones' },
]

const MAT_FUNCIONES: Termino[] = [
  { t: 'función',                d: 'relación que asigna a cada elemento del dominio un único elemento del rango' },
  { t: 'dominio',                d: 'conjunto de todos los valores de entrada de una función' },
  { t: 'rango o imagen',         d: 'conjunto de todos los valores de salida de una función' },
  { t: 'función lineal',         d: 'función cuya gráfica es una línea recta' },
  { t: 'pendiente',              d: 'tasa de cambio de la función; inclinación de la recta' },
  { t: 'función cuadrática',     d: 'función cuya variable tiene exponente dos; su gráfica es una parábola' },
  { t: 'vértice de la parábola', d: 'punto más alto o más bajo de la parábola' },
  { t: 'asíntota',               d: 'línea a la que se acerca la gráfica sin llegar a tocarla' },
  { t: 'función inversa',        d: 'función que revierte la operación de la función original' },
  { t: 'función compuesta',      d: 'función que resulta de aplicar una función dentro de otra' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  FÍSICA
// ─────────────────────────────────────────────────────────────────────────────
const FIS_CINEMATICA: Termino[] = [
  { t: 'posición',               d: 'lugar que ocupa un objeto en el espacio en un instante dado' },
  { t: 'desplazamiento',         d: 'variación de posición; vector que va del punto inicial al final' },
  { t: 'velocidad media',        d: 'desplazamiento dividido entre el tiempo empleado' },
  { t: 'velocidad instantánea',  d: 'velocidad en un instante preciso de tiempo' },
  { t: 'aceleración',            d: 'tasa de cambio de la velocidad respecto al tiempo' },
  { t: 'movimiento rectilíneo uniforme', d: 'movimiento en línea recta con velocidad constante' },
  { t: 'movimiento uniformemente acelerado', d: 'movimiento con aceleración constante' },
  { t: 'caída libre',            d: 'movimiento vertical bajo la acción exclusiva de la gravedad' },
  { t: 'tiro parabólico',        d: 'movimiento con componente horizontal uniforme y vertical acelerado' },
  { t: 'velocidad inicial',      d: 'velocidad con la que comienza el movimiento' },
]

const FIS_DINAMICA: Termino[] = [
  { t: 'fuerza',                 d: 'magnitud vectorial que causa cambios en el movimiento de un objeto' },
  { t: 'masa',                   d: 'cantidad de materia que contiene un objeto; se mide en kilogramos' },
  { t: 'peso',                   d: 'fuerza gravitacional sobre un objeto; peso igual a masa por gravedad' },
  { t: 'primera ley de Newton',  d: 'un objeto en reposo o en movimiento uniforme seguirá así si no actúa una fuerza neta' },
  { t: 'segunda ley de Newton',  d: 'la fuerza neta es igual a la masa multiplicada por la aceleración' },
  { t: 'tercera ley de Newton',  d: 'a toda acción corresponde una reacción igual y opuesta' },
  { t: 'fricción o rozamiento',  d: 'fuerza que se opone al movimiento entre superficies en contacto' },
  { t: 'fuerza normal',          d: 'fuerza perpendicular a la superficie de contacto' },
  { t: 'equilibrio',             d: 'estado en que la fuerza neta sobre un objeto es cero' },
  { t: 'momento de fuerza',      d: 'efecto rotacional de una fuerza; producto de la fuerza por el brazo' },
]

const FIS_ENERGIA: Termino[] = [
  { t: 'energía cinética',       d: 'energía asociada al movimiento; depende de la masa y la velocidad' },
  { t: 'energía potencial gravitacional', d: 'energía almacenada por la posición de un objeto a cierta altura' },
  { t: 'energía mecánica total', d: 'suma de la energía cinética y la energía potencial' },
  { t: 'trabajo',                d: 'transferencia de energía cuando una fuerza desplaza un objeto' },
  { t: 'potencia',               d: 'trabajo realizado por unidad de tiempo' },
  { t: 'conservación de la energía', d: 'la energía total de un sistema aislado no cambia' },
  { t: 'joule',                  d: 'unidad de energía y trabajo en el Sistema Internacional' },
  { t: 'rendimiento',            d: 'cociente entre la energía útil obtenida y la energía total consumida' },
  { t: 'energía elástica',       d: 'energía almacenada en un resorte u objeto deformado' },
  { t: 'calor',                  d: 'transferencia de energía térmica entre cuerpos de diferente temperatura' },
]

const FIS_ELECTRICIDAD: Termino[] = [
  { t: 'carga eléctrica',        d: 'propiedad fundamental que poseen partículas como el electrón y el protón' },
  { t: 'corriente eléctrica',    d: 'flujo ordenado de cargas eléctricas; se mide en amperios' },
  { t: 'voltaje o tensión',      d: 'diferencia de potencial eléctrico entre dos puntos; se mide en voltios' },
  { t: 'resistencia eléctrica',  d: 'oposición al paso de la corriente; se mide en ohmios' },
  { t: 'ley de Ohm',             d: 'el voltaje es igual a la corriente multiplicada por la resistencia' },
  { t: 'circuito en serie',      d: 'circuito donde los componentes se conectan uno tras otro' },
  { t: 'circuito en paralelo',   d: 'circuito donde los componentes se conectan en ramas separadas' },
  { t: 'potencia eléctrica',     d: 'energía eléctrica consumida por unidad de tiempo; se mide en vatios' },
  { t: 'campo eléctrico',        d: 'región del espacio donde una carga eléctrica experimenta una fuerza' },
  { t: 'condensador',            d: 'dispositivo que almacena energía en forma de campo eléctrico' },
]

const FIS_ONDAS: Termino[] = [
  { t: 'onda',                   d: 'perturbación que transporta energía sin transportar materia' },
  { t: 'amplitud',               d: 'máximo desplazamiento de una partícula respecto a su posición de equilibrio' },
  { t: 'longitud de onda',       d: 'distancia entre dos puntos consecutivos en fase' },
  { t: 'frecuencia',             d: 'número de ciclos completos por segundo; se mide en hercios' },
  { t: 'período',                d: 'tiempo en que se completa un ciclo completo de la onda' },
  { t: 'velocidad de propagación', d: 'rapidez con que viaja la perturbación en el medio' },
  { t: 'onda transversal',       d: 'onda donde la vibración es perpendicular a la dirección de propagación' },
  { t: 'onda longitudinal',      d: 'onda donde la vibración es paralela a la dirección de propagación' },
  { t: 'reflexión',              d: 'cambio de dirección de una onda al encontrar una superficie' },
  { t: 'refracción',             d: 'cambio de dirección de una onda al pasar a otro medio' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  QUÍMICA
// ─────────────────────────────────────────────────────────────────────────────
const QUI_TABLA_PERIODICA: Termino[] = [
  { t: 'número atómico',         d: 'cantidad de protones en el núcleo de un átomo' },
  { t: 'masa atómica',           d: 'suma de protones y neutrones en el núcleo' },
  { t: 'período',                d: 'fila horizontal de la tabla periódica' },
  { t: 'grupo o familia',        d: 'columna vertical de la tabla periódica; elementos con propiedades similares' },
  { t: 'electronegatividad',     d: 'tendencia de un átomo a atraer electrones hacia sí' },
  { t: 'radio atómico',          d: 'distancia desde el núcleo hasta la capa de electrones más externa' },
  { t: 'energía de ionización',  d: 'energía necesaria para extraer un electrón de un átomo neutro en estado gaseoso' },
  { t: 'metal',                  d: 'elemento con alta conductividad eléctrica y tendencia a ceder electrones' },
  { t: 'no metal',               d: 'elemento que tiende a ganar electrones y tiene baja conductividad' },
  { t: 'elemento de transición', d: 'elemento del bloque d de la tabla periódica' },
]

const QUI_ENLACES: Termino[] = [
  { t: 'enlace covalente',       d: 'enlace formado por compartición de electrones entre dos átomos' },
  { t: 'enlace iónico',          d: 'enlace formado por transferencia de electrones entre iones' },
  { t: 'enlace metálico',        d: 'enlace por el que los electrones se comparten entre todos los átomos del metal' },
  { t: 'molécula polar',         d: 'molécula con distribución asimétrica de cargas eléctricas' },
  { t: 'ion',                    d: 'átomo o molécula que ha ganado o perdido electrones' },
  { t: 'catión',                 d: 'ion con carga positiva por haber perdido electrones' },
  { t: 'anión',                  d: 'ion con carga negativa por haber ganado electrones' },
  { t: 'geometría molecular',    d: 'forma tridimensional que adoptan los átomos en una molécula' },
  { t: 'fuerzas de Van der Waals', d: 'fuerzas de atracción débiles entre moléculas no polares' },
  { t: 'puente de hidrógeno',    d: 'atracción fuerte entre un átomo de hidrógeno y un átomo electronegativo' },
]

const QUI_REACCIONES: Termino[] = [
  { t: 'reactivo',               d: 'sustancia que se consume en una reacción química' },
  { t: 'producto',               d: 'sustancia que se forma como resultado de la reacción' },
  { t: 'balanceo',               d: 'igualar el número de átomos de cada elemento en ambos lados' },
  { t: 'estequiometría',         d: 'estudio de las proporciones cuantitativas en las reacciones' },
  { t: 'mol',                    d: 'unidad de cantidad de sustancia equivalente a 6 coma 02 por 10 a la 23 partículas' },
  { t: 'masa molar',             d: 'masa en gramos de un mol de sustancia' },
  { t: 'reacción de síntesis',   d: 'dos o más sustancias se combinan para formar una sola' },
  { t: 'reacción de descomposición', d: 'una sustancia se descompone en dos o más sustancias más simples' },
  { t: 'reacción de combustión', d: 'reacción con oxígeno que produce calor y luz' },
  { t: 'catalizador',            d: 'sustancia que aumenta la velocidad de reacción sin consumirse' },
]

const QUI_SOLUCIONES: Termino[] = [
  { t: 'soluto',                 d: 'sustancia que se disuelve en la solución' },
  { t: 'solvente',               d: 'sustancia en mayor cantidad que disuelve al soluto' },
  { t: 'concentración',          d: 'cantidad de soluto por unidad de solución' },
  { t: 'molaridad',              d: 'moles de soluto por litro de solución' },
  { t: 'pH',                     d: 'escala que mide la acidez o basicidad de una solución; va de 0 a 14' },
  { t: 'ácido',                  d: 'sustancia que dona protones o que en agua produce iones hidrógeno' },
  { t: 'base',                   d: 'sustancia que acepta protones o que en agua produce iones hidroxilo' },
  { t: 'solución saturada',      d: 'solución que contiene la máxima cantidad de soluto disuelto a esa temperatura' },
  { t: 'disolución',             d: 'mezcla homogénea de soluto y solvente' },
  { t: 'neutralización',         d: 'reacción entre un ácido y una base que produce sal y agua' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  BIOLOGÍA
// ─────────────────────────────────────────────────────────────────────────────
const BIO_CELULA: Termino[] = [
  { t: 'célula',                 d: 'unidad básica estructural y funcional de todos los seres vivos' },
  { t: 'membrana plasmática',    d: 'capa que rodea la célula y regula el paso de sustancias' },
  { t: 'núcleo celular',         d: 'organelo que contiene el material genético de la célula' },
  { t: 'mitocondria',            d: 'organelo donde se produce la mayor parte de la energía celular' },
  { t: 'ribosoma',               d: 'organelo donde se sintetizan las proteínas' },
  { t: 'célula procariota',      d: 'célula sin núcleo definido como las bacterias' },
  { t: 'célula eucariota',       d: 'célula con núcleo y organelos membranosos definidos' },
  { t: 'pared celular',          d: 'estructura rígida externa a la membrana de células vegetales y bacterias' },
  { t: 'cloroplasto',            d: 'organelo donde se realiza la fotosíntesis en células vegetales' },
  { t: 'vacuola',                d: 'organelo de almacenamiento de agua y nutrientes' },
]

const BIO_GENETICA: Termino[] = [
  { t: 'ADN',                    d: 'ácido desoxirribonucleico; molécula que contiene la información genética' },
  { t: 'gen',                    d: 'segmento de ADN que codifica para una característica o proteína' },
  { t: 'cromosoma',              d: 'estructura en el núcleo formada por ADN enrollado' },
  { t: 'alelo',                  d: 'variante de un gen que puede ser dominante o recesivo' },
  { t: 'genotipo',               d: 'conjunto de genes de un organismo' },
  { t: 'fenotipo',               d: 'características observables de un organismo resultado del genotipo' },
  { t: 'herencia dominante',     d: 'el alelo dominante se expresa aunque el otro sea recesivo' },
  { t: 'mutación',               d: 'cambio en la secuencia del ADN' },
  { t: 'mitosis',                d: 'división celular que produce dos células hijas idénticas a la madre' },
  { t: 'meiosis',                d: 'división celular que produce cuatro células con la mitad de cromosomas' },
]

const BIO_ECOLOGIA: Termino[] = [
  { t: 'ecosistema',             d: 'conjunto de seres vivos y su entorno físico que interactúan' },
  { t: 'cadena trófica',         d: 'secuencia de organismos donde cada uno come al anterior' },
  { t: 'productor',              d: 'organismo que fabrica su propio alimento mediante fotosíntesis' },
  { t: 'consumidor',             d: 'organismo que obtiene energía comiendo a otros organismos' },
  { t: 'descomponedor',          d: 'organismo que desintegra materia orgánica muerta' },
  { t: 'biodiversidad',          d: 'variedad de especies y genes en un ecosistema' },
  { t: 'nicho ecológico',        d: 'papel funcional de una especie en su ecosistema' },
  { t: 'simbiosis',              d: 'relación estrecha y duradera entre dos especies' },
  { t: 'depredación',            d: 'relación donde un organismo caza y consume a otro' },
  { t: 'bioma',                  d: 'gran zona geográfica con clima y organismos similares' },
]

const BIO_FISIOLOGIA: Termino[] = [
  { t: 'fotosíntesis',           d: 'proceso por el que las plantas convierten luz solar en glucosa' },
  { t: 'respiración celular',    d: 'proceso que convierte glucosa en energía utilizando oxígeno' },
  { t: 'homeostasis',            d: 'capacidad del organismo de mantener condiciones internas estables' },
  { t: 'sistema nervioso',       d: 'sistema que coordina y regula las funciones del organismo' },
  { t: 'neurona',                d: 'célula especializada en transmitir impulsos nerviosos' },
  { t: 'hormona',                d: 'mensajero químico que regula funciones corporales' },
  { t: 'enzima',                 d: 'proteína que acelera reacciones químicas en el organismo' },
  { t: 'proteína',               d: 'macromolécula formada por aminoácidos con múltiples funciones vitales' },
  { t: 'aminoácido',             d: 'unidad básica de las proteínas; existen 20 tipos distintos' },
  { t: 'metabolismo',            d: 'conjunto de reacciones químicas que ocurren en un ser vivo' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  LITERATURA
// ─────────────────────────────────────────────────────────────────────────────
const LIT_GENEROS: Termino[] = [
  { t: 'género narrativo',       d: 'género que cuenta historias mediante un narrador' },
  { t: 'género lírico',          d: 'género que expresa sentimientos y emociones del autor' },
  { t: 'género dramático',       d: 'género escrito para ser representado en escena' },
  { t: 'narrador omnisciente',   d: 'narrador que conoce los pensamientos de todos los personajes' },
  { t: 'narrador en primera persona', d: 'el narrador es también personaje de la historia' },
  { t: 'narrador testigo',       d: 'narrador que solo cuenta lo que observa externamente' },
  { t: 'personaje principal',    d: 'personaje central en torno al cual gira la historia' },
  { t: 'antagonista',            d: 'personaje que se opone al protagonista' },
  { t: 'clímax',                 d: 'momento de máxima tensión en la narración' },
  { t: 'desenlace',              d: 'resolución final del conflicto en la narración' },
]

const LIT_CORRIENTES: Termino[] = [
  { t: 'realismo mágico',        d: 'corriente literaria que mezcla elementos reales con fantásticos de forma natural' },
  { t: 'romanticismo',           d: 'movimiento que valora los sentimientos, la naturaleza y el individualismo' },
  { t: 'naturalismo',            d: 'corriente que describe la realidad de forma cruda y científica' },
  { t: 'modernismo',             d: 'movimiento hispanoamericano que renovó la forma y el lenguaje poético' },
  { t: 'vanguardismo',           d: 'conjunto de movimientos artísticos experimentales del siglo veinte' },
  { t: 'indigenismo',            d: 'corriente literaria que reivindicaba la cultura y el pueblo indígena' },
  { t: 'boom latinoamericano',   d: 'movimiento literario de los años sesenta que renovó la novela hispanoamericana' },
  { t: 'costumbrismo',           d: 'corriente que describe las costumbres y tradiciones de un pueblo' },
  { t: 'surrealismo',            d: 'movimiento que explora el subconsciente y los sueños en el arte' },
  { t: 'generación del 98',      d: 'grupo de escritores españoles que reflexionaron sobre la crisis de España' },
]

const LIT_RECURSOS: Termino[] = [
  { t: 'metáfora',               d: 'figura retórica que identifica un término con otro de forma imaginativa' },
  { t: 'símil o comparación',    d: 'figura que establece una semejanza usando como, tal como o cual' },
  { t: 'hipérbole',              d: 'exageración con fines expresivos' },
  { t: 'personificación',        d: 'atribuir características humanas a seres inanimados o animales' },
  { t: 'aliteración',            d: 'repetición de sonidos similares en una oración' },
  { t: 'ironía',                 d: 'decir lo contrario de lo que se quiere dar a entender' },
  { t: 'anáfora',                d: 'repetición de palabras al inicio de frases consecutivas' },
  { t: 'eufemismo',              d: 'expresión suave que sustituye a una expresión directa o desagradable' },
  { t: 'intertextualidad',       d: 'referencias que un texto hace a otros textos' },
  { t: 'cohesión textual',       d: 'relación gramatical entre las partes de un texto' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  HISTORIA DEL PERÚ
// ─────────────────────────────────────────────────────────────────────────────
const HIS_PREHISPANICO: Termino[] = [
  { t: 'Tawantinsuyo',           d: 'nombre del Imperio Inca; significa "las cuatro regiones del mundo"' },
  { t: 'ayllu',                  d: 'comunidad familiar base de la organización social andina' },
  { t: 'mita',                   d: 'sistema de trabajo obligatorio en el Tawantinsuyo' },
  { t: 'Sapa Inca',              d: 'gobernante supremo del Imperio Inca' },
  { t: 'quipu',                  d: 'sistema de cuerdas anudadas para registro de información inca' },
  { t: 'cerámica nazca',         d: 'arte cerámico policromo de la cultura Nazca' },
  { t: 'cultura Mochica',        d: 'civilización preinca de la costa norte conocida por su cerámica' },
  { t: 'suyu',                   d: 'cada una de las cuatro regiones del Imperio Inca' },
  { t: 'capacocha',              d: 'sacrificio ritual inca de niños en ocasiones especiales' },
  { t: 'panaca',                 d: 'linaje real inca que preservaba el culto al Sapa Inca fallecido' },
]

const HIS_COLONIA: Termino[] = [
  { t: 'virreinato',             d: 'unidad territorial colonial gobernada por un virrey en nombre del rey' },
  { t: 'encomienda',             d: 'sistema que entregaba indígenas a colonos para trabajar a cambio de evangelización' },
  { t: 'mita colonial',          d: 'trabajo forzado de indígenas en las minas durante la colonia' },
  { t: 'mestizaje',              d: 'mezcla cultural y racial entre españoles, indígenas y africanos' },
  { t: 'Inquisición',            d: 'tribunal eclesiástico que perseguía la herejía y desviaciones religiosas' },
  { t: 'corregidor',             d: 'autoridad colonial que administraba una provincia y cobraba tributos' },
  { t: 'repartimiento',          d: 'obligación colonial de comprar mercancías a precios impuestos por el corregidor' },
  { t: 'jesuitas',               d: 'orden religiosa que fundó misiones y colegios en la colonia' },
  { t: 'hacienda',               d: 'gran propiedad agraria colonial con trabajadores dependientes' },
  { t: 'criollo',                d: 'persona nacida en América de padres españoles' },
]

const HIS_REPUBLICA: Termino[] = [
  { t: 'independencia',          d: 'proceso por el que los países latinoamericanos se separaron de España' },
  { t: 'caudillismo',            d: 'fenómeno político en que líderes militares controlaban el poder' },
  { t: 'guerra del Pacífico',    d: 'conflicto armado entre Chile, Perú y Bolivia de 1879 a 1884' },
  { t: 'Constitución de 1993',   d: 'carta magna vigente del Perú promulgada bajo Fujimori' },
  { t: 'feudalismo republicano', d: 'sistema de grandes haciendas que persistió en el Perú republicano' },
  { t: 'oncenio de Leguía',      d: 'período de gobierno de Augusto Leguía de 1919 a 1930' },
  { t: 'reforma agraria',        d: 'proceso de redistribución de tierras; en Perú aplicada por Velasco Alvarado' },
  { t: 'velasquismo',            d: 'período del gobierno militar de Juan Velasco Alvarado de 1968 a 1975' },
  { t: 'sendero luminoso',       d: 'grupo terrorista maoísta que causó violencia en el Perú desde 1980' },
  { t: 'acuerdo de paz con Ecuador', d: 'tratado de 1998 que resolvió el conflicto limítrofe peruano-ecuatoriano' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  GEOGRAFÍA
// ─────────────────────────────────────────────────────────────────────────────
const GEO_FISICA: Termino[] = [
  { t: 'relieve',                d: 'conjunto de formas que presenta la superficie terrestre' },
  { t: 'erosión',                d: 'desgaste de la corteza terrestre por agua, viento o hielo' },
  { t: 'cuenca hidrográfica',    d: 'área drenada por un río y sus afluentes' },
  { t: 'latitud',                d: 'distancia angular al ecuador medida en grados' },
  { t: 'longitud',               d: 'distancia angular al meridiano de Greenwich medida en grados' },
  { t: 'meridiano',              d: 'semicírculo imaginario que une los polos de la Tierra' },
  { t: 'paralelo',               d: 'círculo imaginario paralelo al ecuador' },
  { t: 'clima',                  d: 'patrón promedio del tiempo atmosférico en una región a lo largo de años' },
  { t: 'bioma',                  d: 'gran comunidad de organismos determinada por el clima y la vegetación' },
  { t: 'tectónica de placas',    d: 'teoría que explica el movimiento de los continentes sobre placas rígidas' },
]

const GEO_PERU: Termino[] = [
  { t: 'costa peruana',          d: 'región árida al borde del Pacífico con clima desértico' },
  { t: 'sierra peruana',         d: 'región andina de altiplanos y valles interandinos' },
  { t: 'selva alta',             d: 'región de ceja de selva con relieve accidentado y lluvioso' },
  { t: 'selva baja',             d: 'región amazónica plana con gran biodiversidad' },
  { t: 'mar de Grau',            d: 'nombre del mar territorial peruano; parte del Pacífico Sur' },
  { t: 'Corriente de Humboldt',  d: 'corriente fría del Pacífico que define el clima árido de la costa peruana' },
  { t: 'fenómeno de El Niño',    d: 'calentamiento anormal de las aguas del Pacífico que altera el clima' },
  { t: 'lago Titicaca',          d: 'lago navegable más alto del mundo, en la frontera peruano-boliviana' },
  { t: 'Amazonas',               d: 'río más caudaloso del mundo; nace en los Andes peruanos' },
  { t: 'pisos ecológicos',       d: 'zonas altitudinales con características climáticas y biológicas distintas' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  FILOSOFÍA
// ─────────────────────────────────────────────────────────────────────────────
const FIL_GRIEGA: Termino[] = [
  { t: 'sofista',                d: 'filósofo griego que enseñaba retórica y relativizaba la verdad' },
  { t: 'mayéutica',              d: 'método socrático de hacer preguntas para extraer el conocimiento' },
  { t: 'alegoría de la caverna', d: 'mito platónico que ilustra la diferencia entre mundo sensible e inteligible' },
  { t: 'Ideas platónicas',       d: 'entidades eternas y perfectas que existen más allá del mundo material' },
  { t: 'silogismo',              d: 'forma de razonamiento deductivo de Aristóteles con premisas y conclusión' },
  { t: 'eudemonía',              d: 'término griego para felicidad o plenitud; fin último del ser humano según Aristóteles' },
  { t: 'estoicismo',             d: 'escuela filosófica que enseña la virtud y la indiferencia ante el placer y el dolor' },
  { t: 'epicureísmo',            d: 'filosofía que busca el placer moderado y la ausencia de dolor como felicidad' },
  { t: 'logos',                  d: 'razón o principio racional que ordena el universo' },
  { t: 'dialéctica',             d: 'método de razonamiento mediante preguntas y respuestas para llegar a la verdad' },
]

const FIL_MODERNA: Termino[] = [
  { t: 'racionalismo',           d: 'corriente filosófica que privilegia la razón como fuente del conocimiento' },
  { t: 'empirismo',              d: 'corriente que sostiene que el conocimiento proviene de la experiencia sensorial' },
  { t: 'duda metódica',          d: 'método de Descartes de dudar de todo para encontrar una certeza inamovible' },
  { t: 'imperativo categórico',  d: 'principio moral kantiano que ordena actuar según normas universalizables' },
  { t: 'alienación',             d: 'concepto marxista; separación del trabajador respecto al producto de su trabajo' },
  { t: 'voluntad de poder',      d: 'concepto nietzscheano; impulso vital de afirmación y superación del ser humano' },
  { t: 'existencialismo',        d: 'corriente que afirma que la existencia precede a la esencia' },
  { t: 'fenomenología',          d: 'método filosófico que estudia la experiencia consciente en primera persona' },
  { t: 'positivismo',            d: 'corriente que solo acepta el conocimiento científico verificable' },
  { t: 'hermenéutica',           d: 'teoría e interpretación de textos, especialmente filosóficos y religiosos' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  PSICOLOGÍA
// ─────────────────────────────────────────────────────────────────────────────
const PSI_GENERAL: Termino[] = [
  { t: 'conductismo',            d: 'corriente que estudia la conducta observable; descarta el estudio de la mente' },
  { t: 'psicoanálisis',          d: 'teoría freudiana que estudia el inconsciente como motor de la conducta' },
  { t: 'inconsciente',           d: 'parte de la mente que alberga contenidos no accesibles a la conciencia' },
  { t: 'psicología cognitiva',   d: 'corriente que estudia los procesos mentales como memoria, pensamiento y percepción' },
  { t: 'condicionamiento clásico', d: 'aprendizaje asociativo descubierto por Pavlov' },
  { t: 'condicionamiento operante', d: 'aprendizaje por consecuencias; refuerzos y castigos según Skinner' },
  { t: 'jerarquía de Maslow',    d: 'pirámide de necesidades que va de las básicas a la autorrealización' },
  { t: 'autoestima',             d: 'valoración que una persona tiene de sí misma' },
  { t: 'personalidad',           d: 'conjunto estable de características psicológicas de una persona' },
  { t: 'percepción',             d: 'proceso de interpretar la información que llega por los sentidos' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  ECONOMÍA
// ─────────────────────────────────────────────────────────────────────────────
const ECO_GENERAL: Termino[] = [
  { t: 'oferta',                 d: 'cantidad de bienes o servicios que los productores están dispuestos a vender' },
  { t: 'demanda',                d: 'cantidad de bienes o servicios que los consumidores están dispuestos a comprar' },
  { t: 'precio de equilibrio',   d: 'precio donde la cantidad ofrecida iguala a la cantidad demandada' },
  { t: 'inflación',              d: 'aumento generalizado y sostenido del nivel de precios' },
  { t: 'PBI o PIB',              d: 'valor total de bienes y servicios producidos en un país en un período' },
  { t: 'desempleo',              d: 'situación de quienes buscan trabajo y no lo encuentran' },
  { t: 'costo de oportunidad',   d: 'lo que se deja de obtener al elegir una alternativa sobre otra' },
  { t: 'economía de mercado',    d: 'sistema donde la oferta y la demanda determinan los precios' },
  { t: 'monopolio',              d: 'mercado controlado por un único proveedor' },
  { t: 'política monetaria',     d: 'medidas del banco central que regulan la cantidad de dinero en circulación' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  CIUDADANÍA
// ─────────────────────────────────────────────────────────────────────────────
const CIU_GENERAL: Termino[] = [
  { t: 'derechos fundamentales', d: 'derechos básicos de toda persona reconocidos por la Constitución' },
  { t: 'Estado de derecho',      d: 'sistema donde todos, incluso el gobierno, están sujetos a la ley' },
  { t: 'separación de poderes',  d: 'distribución del poder estatal entre ejecutivo, legislativo y judicial' },
  { t: 'soberanía',              d: 'poder supremo que tiene un Estado sobre su territorio y ciudadanos' },
  { t: 'Constitución',           d: 'norma jurídica suprema que establece los principios del Estado' },
  { t: 'sufragio universal',     d: 'derecho de todos los ciudadanos a elegir y ser elegidos' },
  { t: 'democracia representativa', d: 'sistema donde los ciudadanos eligen representantes para gobernar' },
  { t: 'tribunal constitucional', d: 'órgano que controla que las leyes respeten la Constitución' },
  { t: 'habeas corpus',          d: 'garantía constitucional que protege la libertad personal' },
  { t: 'amparo',                 d: 'acción judicial para proteger derechos constitucionales vulnerados' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  DESARROLLO PERSONAL
// ─────────────────────────────────────────────────────────────────────────────
const DES_PERSONAL: Termino[] = [
  { t: 'autoconocimiento',       d: 'capacidad de identificar las propias fortalezas y debilidades' },
  { t: 'asertividad',            d: 'habilidad de expresar opiniones y necesidades respetando a los demás' },
  { t: 'empatía',                d: 'capacidad de entender y compartir los sentimientos de otra persona' },
  { t: 'resiliencia',            d: 'capacidad de superar situaciones adversas y adaptarse positivamente' },
  { t: 'inteligencia emocional', d: 'habilidad de reconocer, comprender y gestionar las propias emociones y las ajenas' },
  { t: 'proyecto de vida',       d: 'plan de metas y acciones que orientan el desarrollo personal' },
  { t: 'autoestima',             d: 'valoración positiva o negativa que una persona tiene de sí misma' },
  { t: 'motivación intrínseca',  d: 'impulso interno para realizar una actividad por satisfacción propia' },
  { t: 'comunicación asertiva',  d: 'expresión clara, directa y respetuosa de ideas y emociones' },
  { t: 'habilidades sociales',   d: 'conjunto de conductas que permiten interactuar efectivamente con los demás' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  LENGUAJE
// ─────────────────────────────────────────────────────────────────────────────
const LEN_GENERAL: Termino[] = [
  { t: 'morfema',                d: 'unidad mínima con significado en una lengua' },
  { t: 'sintagma nominal',       d: 'grupo de palabras con un sustantivo como núcleo' },
  { t: 'sintagma verbal',        d: 'grupo de palabras con un verbo como núcleo' },
  { t: 'semántica',              d: 'estudio del significado de las palabras y oraciones' },
  { t: 'pragmática',             d: 'estudio del uso del lenguaje en contexto' },
  { t: 'sinonimia',              d: 'relación entre palabras de significado similar' },
  { t: 'antonimia',              d: 'relación entre palabras de significado opuesto' },
  { t: 'coherencia textual',     d: 'unidad temática y lógica que hace comprensible un texto' },
  { t: 'cohesión textual',       d: 'enlaces gramaticales entre oraciones de un texto' },
  { t: 'tildación diacrítica',   d: 'acento ortográfico para distinguir palabras de igual escritura pero distinto significado' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  INGLÉS
// ─────────────────────────────────────────────────────────────────────────────
const ING_GRAMMAR: Termino[] = [
  { t: 'simple present',         d: 'tiempo verbal para hábitos, verdades y hechos generales' },
  { t: 'present continuous',     d: 'tiempo verbal para acciones que ocurren en este momento' },
  { t: 'simple past',            d: 'tiempo verbal para acciones completadas en el pasado' },
  { t: 'present perfect',        d: 'tiempo verbal para acciones pasadas con relevancia en el presente' },
  { t: 'modal verb',             d: 'verbo auxiliar que expresa posibilidad, obligación o permiso' },
  { t: 'conditional sentence',   d: 'oración que expresa una condición y su resultado' },
  { t: 'relative clause',        d: 'cláusula que modifica a un sustantivo usando who, which o that' },
  { t: 'passive voice',          d: 'estructura que enfatiza la acción o el objeto, no el sujeto' },
  { t: 'reported speech',        d: 'forma de reportar lo que alguien dijo sin usar sus palabras exactas' },
  { t: 'coherence',              d: 'logical connection between ideas in a text' },
]

// =============================================================================
//  ÍNDICE PRINCIPAL: materia → subtema detectado → términos
// =============================================================================

type TerminoMap = Record<string, Termino[]>

const BIBLIOTECA: Record<string, TerminoMap> = {
  matematica: {
    trigonometria: MAT_TRIGONOMETRIA,
    algebra:       MAT_ALGEBRA,
    geometria:     MAT_GEOMETRIA,
    estadistica:   MAT_ESTADISTICA,
    probabilidad:  MAT_PROBABILIDAD,
    aritmetica:    MAT_ARITMETICA,
    funciones:     MAT_FUNCIONES,
  },
  fisica: {
    cinematica:    FIS_CINEMATICA,
    dinamica:      FIS_DINAMICA,
    energia:       FIS_ENERGIA,
    electricidad:  FIS_ELECTRICIDAD,
    ondas:         FIS_ONDAS,
  },
  quimica: {
    tabla:         QUI_TABLA_PERIODICA,
    enlaces:       QUI_ENLACES,
    reacciones:    QUI_REACCIONES,
    soluciones:    QUI_SOLUCIONES,
  },
  biologia: {
    celula:        BIO_CELULA,
    genetica:      BIO_GENETICA,
    ecologia:      BIO_ECOLOGIA,
    fisiologia:    BIO_FISIOLOGIA,
  },
  literatura: {
    generos:       LIT_GENEROS,
    corrientes:    LIT_CORRIENTES,
    recursos:      LIT_RECURSOS,
  },
  historia: {
    prehispanico:  HIS_PREHISPANICO,
    colonia:       HIS_COLONIA,
    republica:     HIS_REPUBLICA,
  },
  geografia: {
    fisica:        GEO_FISICA,
    peru:          GEO_PERU,
  },
  filosofia: {
    griega:        FIL_GRIEGA,
    moderna:       FIL_MODERNA,
  },
  psicologia: {
    general:       PSI_GENERAL,
  },
  economia: {
    general:       ECO_GENERAL,
  },
  ciudadania: {
    general:       CIU_GENERAL,
  },
  desarrollo: {
    general:       DES_PERSONAL,
  },
  lenguaje: {
    general:       LEN_GENERAL,
  },
  ingles: {
    grammar:       ING_GRAMMAR,
  },
}

// =============================================================================
//  DETECCIÓN DE SUBTEMA
// =============================================================================

function detectarSubtema(area: string, enunciado: string): { materia: string; subtema: string } | null {
  const a = area.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
  const e = enunciado.toLowerCase()
  const ctx = a + ' ' + e

  // MATEMÁTICA
  if (/matem|algebra|aritm|geometr|calculo|ecuac|funcion|estadistic|probabilid|trigon/.test(a)) {
    if (/trigon|seno|coseno|tangente|\bsen\b|\bcos\b|\btan\b|cateto|hipotenusa/.test(ctx)) return { materia: 'matematica', subtema: 'trigonometria' }
    if (/ecuac|incognita|despeja|polinomio|factor|logarit/.test(ctx))                        return { materia: 'matematica', subtema: 'algebra' }
    if (/area|perimetro|volumen|rectangulo|triangulo|trapecio|circulo|pitagor/.test(ctx))    return { materia: 'matematica', subtema: 'geometria' }
    if (/media|mediana|moda|promedio|varianza|frecuencia|histograma/.test(ctx))              return { materia: 'matematica', subtema: 'estadistica' }
    if (/probabilid|azar|evento|espacio muestral|combinac|permutac/.test(ctx))               return { materia: 'matematica', subtema: 'probabilidad' }
    if (/funcion|dominio|rango|pendiente|parabola/.test(ctx))                                return { materia: 'matematica', subtema: 'funciones' }
    return { materia: 'matematica', subtema: 'aritmetica' }
  }

  // FÍSICA
  if (/fisic/.test(a)) {
    if (/velocidad|aceleracion|desplazamiento|cinemat|caida|tiro|parabolico/.test(ctx))       return { materia: 'fisica', subtema: 'cinematica' }
    if (/fuerza|newton|masa|friccion|equilibrio|momento|torque/.test(ctx))                    return { materia: 'fisica', subtema: 'dinamica' }
    if (/energia|joule|trabajo|potencia|calor|temperatura/.test(ctx))                         return { materia: 'fisica', subtema: 'energia' }
    if (/voltaje|corriente|resistencia|ohm|circuito|amperio/.test(ctx))                       return { materia: 'fisica', subtema: 'electricidad' }
    if (/onda|frecuencia|longitud de onda|sonido|luz|refraccion/.test(ctx))                   return { materia: 'fisica', subtema: 'ondas' }
    return { materia: 'fisica', subtema: 'dinamica' }
  }

  // QUÍMICA
  if (/quim/.test(a)) {
    if (/tabla periodica|numero atomico|electron|proton|neutron|grupo|periodo/.test(ctx))     return { materia: 'quimica', subtema: 'tabla' }
    if (/enlace|covalente|ionico|electronega|polar|ion|cation|anion/.test(ctx))               return { materia: 'quimica', subtema: 'enlaces' }
    if (/reaccion|reactivo|producto|balancear|estequio|mol|combustion/.test(ctx))             return { materia: 'quimica', subtema: 'reacciones' }
    if (/solucion|soluto|solvente|concentracion|ph|acido|base|molaridad/.test(ctx))           return { materia: 'quimica', subtema: 'soluciones' }
    return { materia: 'quimica', subtema: 'reacciones' }
  }

  // BIOLOGÍA
  if (/biolog/.test(a)) {
    if (/celula|membrana|nucleo|mitocondria|organelo|procariota|eucariota/.test(ctx))         return { materia: 'biologia', subtema: 'celula' }
    if (/adn|gen|cromosoma|alelo|herencia|mutacion|mitosis|meiosis/.test(ctx))                return { materia: 'biologia', subtema: 'genetica' }
    if (/ecosistema|cadena trofica|biodiversidad|especie|nicho|bioma/.test(ctx))              return { materia: 'biologia', subtema: 'ecologia' }
    if (/fotosintesis|respiracion|hormona|enzima|proteina|metabolismo|aminoacido/.test(ctx))  return { materia: 'biologia', subtema: 'fisiologia' }
    return { materia: 'biologia', subtema: 'fisiologia' }
  }

  // LITERATURA
  if (/literatur/.test(a) || /lectura critica|lectura crítica/.test(a)) {
    if (/realismo magico|boom|modernismo|romanticismo|vanguard|naturalismo|indigenism/.test(ctx)) return { materia: 'literatura', subtema: 'corrientes' }
    if (/narrador|genero|novela|cuento|poema|drama|personaje|climax/.test(ctx))                   return { materia: 'literatura', subtema: 'generos' }
    if (/metafora|simil|hiperbole|personificacion|ironia|cohesion|coherencia/.test(ctx))          return { materia: 'literatura', subtema: 'recursos' }
    return { materia: 'literatura', subtema: 'generos' }
  }

  // HISTORIA
  if (/histor/.test(a)) {
    if (/inca|tawantinsuyo|prehispanico|chavin|nazca|mochica|wari/.test(ctx))  return { materia: 'historia', subtema: 'prehispanico' }
    if (/virreinato|colonia|conquista|encomienda|mita colonial/.test(ctx))      return { materia: 'historia', subtema: 'colonia' }
    return { materia: 'historia', subtema: 'republica' }
  }

  // GEOGRAFÍA
  if (/geograf/.test(a)) {
    if (/costa|sierra|selva|titicaca|amazonas|humboldt|el nino|piso ecologico/.test(ctx)) return { materia: 'geografia', subtema: 'peru' }
    return { materia: 'geografia', subtema: 'fisica' }
  }

  // FILOSOFÍA
  if (/filosof/.test(a)) {
    if (/socrates|platon|aristoteles|estoicismo|epicureo|logos|dialectica/.test(ctx)) return { materia: 'filosofia', subtema: 'griega' }
    return { materia: 'filosofia', subtema: 'moderna' }
  }

  if (/psicolog/.test(a))    return { materia: 'psicologia',  subtema: 'general' }
  if (/econom/.test(a))      return { materia: 'economia',    subtema: 'general' }
  if (/ciudadan/.test(a))    return { materia: 'ciudadania',  subtema: 'general' }
  if (/desarrollo/.test(a))  return { materia: 'desarrollo',  subtema: 'general' }
  if (/lenguaje|comunicac/.test(a)) return { materia: 'lenguaje', subtema: 'general' }
  if (/ingles|inglés/.test(a))      return { materia: 'ingles',   subtema: 'grammar' }

  return null
}

// =============================================================================
//  API PÚBLICA
// =============================================================================

/**
 * Retorna los términos clave para un área y enunciado dados.
 * Máximo `max` términos aleatorios del subtema detectado.
 */
export function getTerminos(area: string, enunciado: string, max = 4): Termino[] {
  const det = detectarSubtema(area, enunciado)
  if (!det) return []
  const lista = BIBLIOTECA[det.materia]?.[det.subtema] ?? []
  if (!lista.length) return []
  // Selección semi-aleatoria basada en el enunciado (determinista para misma pregunta)
  const seed = enunciado.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const shuffled = [...lista].sort((a, b) => {
    const ha = (seed * a.t.length * 31) % 100
    const hb = (seed * b.t.length * 37) % 100
    return ha - hb
  })
  return shuffled.slice(0, max)
}

/**
 * Genera una frase oral con los términos clave del tema detectado.
 * Lista para insertar al final de una explicación de audio.
 */
export function terminosParaAudio(area: string, enunciado: string): string {
  const terminos = getTerminos(area, enunciado, 3)
  if (!terminos.length) return ''
  const lista = terminos.map(t => `${t.t}: ${t.d}`).join('. ')
  return `Recuerda estos términos clave del tema: ${lista}.`
}
