"""
fix_preguntas.py — Corrige materias, añade explicaciones y respuestas correctas
"""
import json, re, unicodedata

def strip_accents(t):
    return ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')

SECCION_MAP = {
    'Matemática':'B','Física':'B','Química':'B','Biología':'B',
    'Lenguaje':'A','Literatura':'A','Inglés':'A','Historia del Perú':'A',
    'Geografía':'A','Filosofía':'A','Psicología':'A','Ciudadanía':'A',
    'Desarrollo Personal':'A','Economía':'A','General':'A',
}

def detectar_materia(q):
    full = strip_accents((q['enunciado'] + ' ' + q.get('opcion_a','') + ' ' + q.get('opcion_b','') + ' ' +
            q.get('opcion_c','') + ' ' + q.get('opcion_d','') + ' ' + q.get('explicacion','')).lower())
    expl = strip_accents(q.get('explicacion','').lower())

    # Inglés: texto en inglés
    english_kw = ['what','firewood','flowers','stones','hiking','charity','festival','annual',
                  'henry stuart','has designed','has always liked','henry wants','poor children']
    if sum(1 for w in english_kw if w in full) >= 2:
        return 'Inglés'
    english_verbs = ['what is','what are','why can','read the text and answer','choose the right']
    if any(p in full for p in english_verbs):
        return 'Inglés'

    # Detectar por Tema: en la explicación (más confiable)
    if 'tema: potencia' in expl or 'tema: mru' in expl or 'tema: cinematica' in expl or \
       'tema: graficas de cinematica' in expl or 'tema: grafica' in expl:
        return 'Física'
    if 'tema: soluciones' in expl or 'tema: molaridad' in expl:
        return 'Química'
    if any(t in expl for t in ['tema: fotosintesis', 'tema: bioquimica', 'tema: sistema endocrino',
                                'tema: evolucion', 'fosfolipidos', 'tilacoides', 'lamarck']):
        return 'Biología'
    if any(t in expl for t in ['tema: polinomios','tema: ecuaciones','tema: probabilidades','tema: mru']):
        return 'Matemática'
    if any(t in expl for t in ['tema: barroco','tema: romanticismo','tema: renacimiento','tema: modernismo',
                                'shakespeare','cervantes','garcia marquez','gabriel garcia','tema: vanguardismo',
                                'tema: generacion','tema: literatura']):
        return 'Literatura'

    # Contenido de la pregunta
    if any(w in full for w in ['oxitocina','hipotalamo','hormona producida','fotosintesis','fotolisis',
                                 'tilacoide','lamarck','darwin','darwin','aminoacido','semipermeable',
                                 'fosfolipido','membrana biologica','ciclo celular','meiosis','mitosis']):
        return 'Biología'
    if any(w in full for w in ['alcano','iupac','hidrocarburo','isopropil','dimetiloctano','dimetilheptano',
                                 'molaridad','soluto','solvente','mol/l','hidrocarburo organico']):
        return 'Química'
    if any(w in full for w in ['potencia mecanica','m/s','km/h','movil','velocidad constante',
                                 'aceleracion','cinematica','dinamica','newton','fuerza de igual']):
        if any(w in full for w in ['metros','kilom','distancia que los separa','velocidad de']):
            return 'Física'
    if any(w in full for w in ['polinomio','suma de coeficiente','potencia del monomio',
                                 'probabilidad de acertar','acierta','alternativas y solo una',
                                 'progresion aritmetica','progresion geometrica']):
        return 'Matemática'
    if any(w in full for w in ['vertice b','vertice a','cable a utilizar','distancia del vertice',
                                 'medias de la marca','precio en soles de las medias',
                                 'volumen del liquido','funcion que representa','celeste incursiona',
                                 'atletismo','entrenador le recomienda']):
        return 'Matemática'

    # Psicología / Desarrollo Personal
    if any(w in full for w in ['tipo de amor','triangular del amor','sternberg','intimidad y compromiso',
                                 'proyecto de vida','difusion de identidad','emocion primaria',
                                 'oscar','ira','sorpresa','repulsion','tristeza - ira']):
        return 'Psicología'
    if any(w in full for w in ['linea 100','violencia','denunciar','situacion de violencia',
                                 'adolescente de 17','comportamiento','buscan estrategias']):
        return 'Desarrollo Personal'

    # Conservar materia original si no hay match claro
    return q['materia']


# Explicaciones para las 14 preguntas sin explicación
EXPLICACIONES = {
    # Identificamos por un fragmento único del enunciado
    'El tipo de amor en que se encuentra Cristiano Ronaldo': {
        'materia': 'Psicología',
        'respuesta': 'B',
        'explicacion': (
            'Tema: Triángulo del Amor (Sternberg). Según la teoría triangular del amor de Robert Sternberg, '
            'existen tres componentes: PASIÓN (atracción física), INTIMIDAD (cercanía emocional) y COMPROMISO '
            '(decisión de amar a largo plazo). Los tipos de amor son: '
            'Romántico = pasión + intimidad; Consumado = pasión + intimidad + compromiso (el más completo); '
            'Sociable = intimidad + compromiso; Vacío = solo compromiso. '
            'Cristiano Ronaldo, en una relación estable con compromiso, pasión e intimidad, presenta amor CONSUMADO.'
        )
    },
    'Ante ello, Roberto debería': {
        'materia': 'Desarrollo Personal',
        'respuesta': 'A',
        'explicacion': (
            'Tema: Violencia y derechos ciudadanos. En el Perú, la Línea 100 es el servicio del Ministerio de la '
            'Mujer y Poblaciones Vulnerables (MIMP) para atender casos de violencia familiar y sexual. '
            'Ante una situación de violencia, la acción correcta es DENUNCIAR llamando a la Línea 100 '
            'para que los especialistas brinden orientación y protección inmediata a la víctima. '
            'Ignorar o publicar en redes puede agravar la situación y no garantiza la protección legal.'
        )
    },
    'Luciana es una adolescente de 17 años que se encuentra en un estado de difusión': {
        'materia': 'Psicología',
        'respuesta': 'A',
        'explicacion': (
            'Tema: Desarrollo de identidad (Erikson/Marcia). La difusión de identidad es una etapa en la que '
            'el adolescente no ha explorado ni comprometido su identidad. '
            'Las estrategias efectivas son: (1) identificar gustos y valores propios como base de identidad, '
            '(2) apoyo de un psicólogo o consejero para guiar el proceso, '
            '(5) establecer metas y compromisos graduales. '
            'Estas tres estrategias (1, 2 y 5) constituyen un abordaje integral y profesional del caso.'
        )
    },
    'La primera emoción experimentada por Oscar fue la': {
        'materia': 'Psicología',
        'respuesta': 'A',
        'explicacion': (
            'Tema: Emociones primarias y secundarias. Según Paul Ekman, las 6 emociones PRIMARIAS universales son: '
            'alegría, tristeza, ira, miedo, SORPRESA y ASCO/REPULSIÓN. '
            'Las emociones secundarias (o complejas) son mezclas de primarias: vergüenza, culpa, orgullo, etc. '
            'La sorpresa y la repulsión son ambas emociones PRIMARIAS según la clasificación de Ekman, '
            'lo que corresponde a la alternativa A) sorpresa - repulsión - primarias.'
        )
    },
    'Patricia desea realizar un ensayo filosófico': {
        'materia': 'Filosofía',
        'respuesta': 'D',
        'explicacion': (
            'Tema: Características de la Filosofía. La filosofía tiene varias características: '
            'REFLEXIVA: vuelve sobre los propios pensamientos, los cuestiona y analiza (Patricia medita para '
            'identificar sus propias ideas y argumentos). '
            'Universal: trata temas válidos para toda la humanidad. '
            'Metódica: sigue un método riguroso. '
            'Trascendente: va más allá de lo inmediato. '
            'La acción de Patricia (meditación y concentración para elaborar sus propias ideas) es la '
            'característica REFLEXIVA de la filosofía: la introspección y el pensamiento sobre el propio pensamiento.'
        )
    },
    'La profesora de Física de 5.o grado de secundaria explica a sus alumnos': {
        'materia': 'Filosofía',
        'respuesta': 'D',
        'explicacion': (
            'Tema: Categorías científicas. La Tercera Ley de Newton (Ley de Acción y Reacción) establece que '
            'cuando un cuerpo A ejerce una fuerza sobre un cuerpo B, B ejerce sobre A una fuerza igual en módulo '
            'y dirección, pero de sentido contrario. '
            'Esta regularidad natural probada experimentalmente y sin excepciones se denomina LEY científica. '
            'Diferencia: principio = enunciado general no siempre verificable; teoría = explicación con evidencia; '
            'axioma = verdad aceptada sin demostración; ley = regularidad universal verificada experimentalmente.'
        )
    },
    'Durante la Edad Media los señores feudales de la península ibérica': {
        'materia': 'Historia del Perú',
        'respuesta': 'B',
        'explicacion': (
            'Tema: Monarquías medievales en Europa. El texto describe la inestabilidad política de los reinos '
            'medievales: la península ibérica con monarquías efímeras, el Sacro Imperio Romano Germánico donde '
            'los emperadores dependían de los príncipes electores, e Inglaterra donde la Magna Carta (1215) '
            'obligó al rey a consultar al Parlamento. '
            'Comparativamente, Inglaterra desarrolló un sistema parlamentario más estable y organizado, '
            'mientras que los otros territorios tenían mayor fragmentación del poder.'
        )
    },
    'El manejo económico durante el primer gobierno de Alan García Pérez': {
        'materia': 'Ciudadanía',
        'respuesta': 'A',
        'explicacion': (
            'Tema: Historia económica del Perú. Alan García en su primer gobierno (1985-1990) declaró '
            'unilateralmente que el Perú solo pagaría su deuda externa con el 10% de sus exportaciones, '
            'violando los compromisos con los acreedores internacionales. '
            'El Fondo Monetario Internacional (FMI) declaró al Perú "inelegible" para recibir nuevos '
            'créditos internacionales como consecuencia directa de esta política. '
            'Esto generó aislamiento financiero, hiperinflación (llegó al 7,649% en 1990) y grave crisis económica.'
        )
    },
    'Por el tipo de suelo de origen aluviónico se está': {
        'materia': 'Ciudadanía',
        'respuesta': 'A',
        'explicacion': (
            'Tema: Geografía agrícola del Perú. La región Lambayeque cuenta con varios valles. '
            'El valle de Jequetepeque, ubicado en la parte sur de la región Lambayeque, tiene suelos de '
            'origen aluviónico (formados por depósitos de ríos) que son fértiles y retienen bien el agua, '
            'condiciones ideales para el cultivo intensivo del arroz. '
            'Este valle es uno de los principales productores de arroz del norte del Perú gracias a su '
            'sistema de irrigación y tipo de suelo.'
        )
    },
    'Los ríos de la vertiente occidental exhiben un régi': {
        'materia': 'Historia del Perú',
        'respuesta': 'C',
        'explicacion': (
            'Tema: Hidrografía del Perú. Los ríos se clasifican según su destino: '
            'EXORREICOS: desembocan en el mar u océano. '
            'ENDORREICOS: desembocan en lagos o mares interiores. '
            'ARREICOS: no llegan a ningún cuerpo de agua, su caudal se pierde por infiltración o evaporación. '
            'KRIPTORREICOS: ríos subterráneos. '
            'Los ríos de la vertiente occidental del Perú que durante la sequía pierden su flujo superficial '
            'y no llegan a desembocar en el océano Pacífico son ARREICOS.'
        )
    },
    'Con respecto al segundo párrafo, es posible': {
        'materia': 'Lenguaje',
        'respuesta': 'D',
        'explicacion': (
            'Tema: Análisis gramatical de pronombres y conectores. '
            'Los pronombres indefinidos son: alguien, nadie, algo, nada, cualquiera. '
            'El pronombre "me" es un pronombre personal (1ra persona singular), NO indefinido (afirmación 1 es falsa). '
            'Los conectores de consecuencia son: entonces, por lo tanto, en consecuencia, así que. '
            '"entonces" SÍ es un conector de consecuencia (afirmación 4 es verdadera). '
            'Por tanto, la respuesta correcta incluye solo las afirmaciones verdaderas: solo 2 y 4.'
        )
    },
    'What is John collecting': {
        'materia': 'Inglés',
        'respuesta': 'B',
        'explicacion': (
            'Esta es una pregunta de Inglés. Te explico en español: '
            'El texto describe a John y sus amigos realizando actividades en el campo. '
            'La pregunta "What is John collecting?" (¿Qué está recolectando John?) '
            'según el contexto de la lectura, John está recolectando leña (firewood). '
            'VOCABULARIO: collect = recolectar; firewood = leña; flowers = flores; stones = piedras; mountains = montañas. '
            'Tip: para responder preguntas de comprensión lectora en inglés, busca palabras clave en el texto '
            'que respondan directamente la pregunta (información explícita).'
        )
    },
    'He Read the text and answer the question': {
        'materia': 'Inglés',
        'respuesta': 'D',
        'explicacion': (
            'Esta es una pregunta de Inglés. Te explico en español: '
            'El texto habla de Henry Stuart, diseñador de videojuegos, que usó sus ganancias para crear '
            'una organización benéfica llamada "Computer Charity" para donar computadoras a niños pobres '
            'en un festival ANUAL (annual = una vez al año). '
            'Análisis de opciones: '
            'A) "Henry se ha vuelto pobre" → INCORRECTO (ganó mucho dinero). '
            'B) "Nunca le gustaron los videojuegos" → INCORRECTO (siempre le gustaron). '
            'C) "El proyecto se llama Computers for children" → INCORRECTO (se llama Computer Charity). '
            'D) "Hay un festival de computadoras una vez al año" → CORRECTO (annual = anual = una vez al año).'
        )
    },
    'Respecto al siguiente alcano ramificado: CH': {
        'materia': 'Química',
        'respuesta': 'A',
        'explicacion': (
            'Tema: Nomenclatura IUPAC de alcanos ramificados. Para nombrar alcanos ramificados: '
            '1) Identificar la cadena principal más larga (cadena madre). '
            '2) Numerar desde el extremo más cercano a una ramificación. '
            '3) Nombrar sustituyentes por orden alfabético con sus posiciones. '
            'Para la estructura del alcano dado con cadena de 8 carbonos (octano), un sustituyente '
            'isopropil (-CH(CH₃)₂) en posición 7 y grupos metilo (-CH₃) en posiciones 2 y 6: '
            'Nombre IUPAC = 7-isopropil-2,6-dimetiloctano. '
            'RECUERDA: isopropil = -CH(CH₃)₂; isobutil = -CH₂CH(CH₃)₂; las posiciones se numeran '
            'para dar los locantes más bajos posibles.'
        )
    },
}

with open('PERU/preguntas_unt.json', 'r', encoding='utf-8') as f:
    qs = json.load(f)

fixed = 0
materia_fixed = 0
expl_added = 0
resp_fixed = 0

for q in qs:
    enun = q['enunciado']

    # 1. Añadir explicación y respuesta correcta para las 14 sin explicación
    for key, patch in EXPLICACIONES.items():
        if key.lower() in enun.lower():
            if not q.get('explicacion'):
                q['explicacion'] = patch['explicacion']
                expl_added += 1
            if q['respuesta'] == 'A' and patch.get('respuesta') and patch['respuesta'] != 'A':
                q['respuesta'] = patch['respuesta']
                resp_fixed += 1
            if patch.get('materia'):
                old = q['materia']
                q['materia'] = patch['materia']
                if old != q['materia']:
                    materia_fixed += 1
            break

    # 2. Detectar y corregir materia
    nueva = detectar_materia(q)
    if nueva != q['materia']:
        q['materia'] = nueva
        materia_fixed += 1

    # 3. Recalcular sección
    q['seccion'] = SECCION_MAP.get(q['materia'], 'A')
    fixed += 1

print(f'Processed: {fixed}')
print(f'Materia fixed: {materia_fixed}')
print(f'Explanations added: {expl_added}')
print(f'Answer letters corrected: {resp_fixed}')

# Resumen final
by_mat = {}
for q in qs:
    m = q['materia']
    by_mat[m] = by_mat.get(m, 0) + 1
print('\nBy materia:')
for m, c in sorted(by_mat.items(), key=lambda x: -x[1]):
    print(f'  {m}: {c}')

no_expl = [q for q in qs if not q.get('explicacion')]
print(f'\nStill missing explanation: {len(no_expl)}')
for q in no_expl:
    print(f'  [{q["materia"]}] {q["enunciado"][:60]}')

with open('PERU/preguntas_unt.json', 'w', encoding='utf-8') as f:
    json.dump(qs, f, ensure_ascii=False, indent=2)
print('\nSaved preguntas_unt.json')
