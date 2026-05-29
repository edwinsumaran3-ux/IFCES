from fpdf import FPDF

OUT = r"C:\Users\USUARIO\Downloads\Pruebas ICFES,\MOCKUP_BancoPreguntas.pdf"

# Colors (R,G,B)
DARK   = (13, 17, 23)
CARD   = (22, 27, 34)
LINE   = (33, 38, 45)
WHITE  = (230, 237, 243)
GRAY   = (110, 118, 129)
GREEN  = (63, 185, 80)
BLUE   = (88, 166, 255)
YELLOW = (210, 153, 34)
PURPLE = (167, 139, 250)
RED    = (220, 80, 70)
ORANGE = (220, 140, 50)

def s(txt):
    return txt.encode('latin-1', 'replace').decode('latin-1')

MATERIAS = [
    ("Matematicas",     GREEN,  ["Algebra", "Geometria", "Estadistica", "Aritmetica"]),
    ("Ciencias Nat.",   BLUE,   ["Fisica", "Quimica", "Biologia"]),
    ("Lectura Critica", YELLOW, ["Comprension", "Analisis", "Inferencia"]),
    ("Sociales",        RED,    ["Historia", "Geografia", "Constitucion"]),
    ("Ingles",          PURPLE, ["Grammar", "Reading", "Vocabulary"]),
]

class PDF(FPDF):
    def header(self):
        self.set_fill_color(*DARK)
        self.rect(0, 0, 210, 297, 'F')

    def topbar(self, subtitle=""):
        self.set_fill_color(*CARD)
        self.rect(0, 0, 210, 12, 'F')
        self.set_draw_color(*LINE)
        self.line(0, 12, 210, 12)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*PURPLE)
        self.set_xy(5, 2)
        self.cell(120, 8, s("ERP ICFES Neuro-IA  |  Banco de Preguntas"))
        if subtitle:
            self.set_text_color(*GRAY)
            self.set_font("Helvetica", "", 6.5)
            self.set_xy(140, 3)
            self.cell(65, 6, s(subtitle), align="R")

    def materia_card(self, x, y, w, h, nombre, color, temas):
        self.set_fill_color(*CARD)
        self.set_draw_color(*color)
        self.set_line_width(0.35)
        self.rect(x, y, w, h, 'FD')
        self.set_fill_color(*color)
        self.rect(x, y, 2, h, 'F')
        # nombre
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*color)
        self.set_xy(x + 4, y + 2.5)
        self.cell(w - 30, 5, s(nombre))
        # badge preguntas
        self.set_fill_color(25, 35, 50)
        self.rect(x + w - 26, y + 2, 24, 7, 'F')
        self.set_font("Helvetica", "B", 5.5)
        self.set_text_color(*color)
        self.set_xy(x + w - 26, y + 3)
        self.cell(24, 5, "245 preguntas", align="C")
        # temas
        self.set_font("Helvetica", "", 6)
        ty = y + 9
        for tema in temas:
            self.set_text_color(*GRAY)
            self.set_xy(x + 5, ty)
            self.cell(2, 3.5, "-")
            self.cell(w - 10, 3.5, s(tema))
            ty += 4.2
        # boton entrar
        self.set_fill_color(20, 35, 55)
        self.set_draw_color(*BLUE)
        self.set_line_width(0.25)
        self.rect(x + 4, y + h - 9, 38, 7, 'FD')
        self.set_font("Helvetica", "B", 5.5)
        self.set_text_color(*BLUE)
        self.set_xy(x + 4, y + h - 8)
        self.cell(38, 5, "Ver preguntas  -->", align="C")

    def question_card(self, x, y, w, num, tema, stem, opts, correct, color):
        lines = max(1, len(stem) // 48 + stem.count('\n'))
        h = 22 + lines * 4 + len(opts) * 5.5 + 8
        self.set_fill_color(*CARD)
        self.set_draw_color(*LINE)
        self.set_line_width(0.25)
        self.rect(x, y, w, h, 'FD')
        self.set_fill_color(*color)
        self.rect(x, y, 1.5, h, 'F')
        # header
        self.set_font("Helvetica", "B", 6)
        self.set_text_color(*color)
        self.set_xy(x + 3, y + 2)
        self.cell(30, 4, s(f"Pregunta #{num}"))
        self.set_font("Helvetica", "", 5.5)
        self.set_text_color(*GRAY)
        self.set_xy(x + 34, y + 2.5)
        self.cell(30, 3.5, s(tema))
        # dificultad
        self.set_fill_color(30, 40, 55)
        self.rect(x + w - 26, y + 2, 24, 5, 'F')
        self.set_font("Helvetica", "B", 5)
        self.set_text_color(*YELLOW)
        self.set_xy(x + w - 26, y + 2.5)
        self.cell(24, 4, "DIFICULTAD: MEDIA", align="C")
        # separator
        self.set_draw_color(*LINE)
        self.line(x + 2, y + 9, x + w - 2, y + 9)
        # stem
        self.set_font("Helvetica", "", 6.5)
        self.set_text_color(*WHITE)
        self.set_xy(x + 3, y + 11)
        self.multi_cell(w - 6, 3.8, s(stem))
        cy = self.get_y() + 1
        # opciones
        for letter, txt in opts:
            ok = letter == correct
            if ok:
                self.set_fill_color(15, 50, 20)
                self.set_draw_color(*GREEN)
            else:
                self.set_fill_color(15, 20, 28)
                self.set_draw_color(*LINE)
            self.set_line_width(0.2)
            self.rect(x + 3, cy, w - 6, 4.5, 'FD')
            self.set_font("Helvetica", "B", 5.5)
            self.set_text_color(*GREEN if ok else GRAY)
            self.set_xy(x + 4, cy + 0.5)
            self.cell(5, 3.5, letter)
            self.set_font("Helvetica", "", 5.5)
            self.set_text_color(*WHITE if ok else GRAY)
            self.cell(w - 18, 3.5, s(txt))
            if ok:
                self.set_text_color(*GREEN)
                self.set_font("Helvetica", "B", 5.5)
                self.cell(10, 3.5, "[Correcta]")
            cy += 5.5
        # boton IA
        self.set_fill_color(35, 15, 75)
        self.set_draw_color(120, 70, 220)
        self.set_line_width(0.3)
        self.rect(x + 3, cy + 1, 36, 5.5, 'FD')
        self.set_font("Helvetica", "B", 5)
        self.set_text_color(*PURPLE)
        self.set_xy(x + 3, cy + 1.5)
        self.cell(36, 4.5, "  Explicar con IA  -->", align="C")
        return h

    def ai_box(self, x, y, w, h):
        self.set_fill_color(12, 8, 28)
        self.set_draw_color(100, 55, 210)
        self.set_line_width(0.4)
        self.rect(x, y, w, h, 'FD')
        self.set_fill_color(25, 12, 58)
        self.rect(x, y, w, 9, 'F')
        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*PURPLE)
        self.set_xy(x + 3, y + 2)
        self.cell(0, 5, "Tutor IA - Explicacion socratica")
        # chat burbuja IA
        self.set_fill_color(18, 12, 40)
        self.rect(x + 3, y + 11, w - 6, 28, 'F')
        self.set_font("Helvetica", "", 5.5)
        self.set_text_color(180, 160, 255)
        self.set_xy(x + 4, y + 12)
        self.multi_cell(w - 8, 3.5, s(
            "Pregunta: Por que la respuesta B\n"
            "es correcta en este ejercicio?\n\n"
            "IA: Recuerda que al despejar X en\n"
            "3x + 6 = 15, primero debes restar\n"
            "6 a ambos lados: 3x = 9.\n\n"
            "Ahora, que operacion aplicarias\n"
            "para encontrar X?"
        ))
        # pizarra mini
        self.set_fill_color(10, 18, 35)
        self.set_draw_color(*BLUE)
        self.set_line_width(0.3)
        self.rect(x + 3, y + 41, w - 6, 14, 'FD')
        self.set_font("Helvetica", "B", 6)
        self.set_text_color(*BLUE)
        self.set_xy(x + 4, y + 42.5)
        self.cell(0, 4, "Pizarra  |  3x + 6 = 15")
        self.set_font("Helvetica", "", 6)
        self.set_text_color(*WHITE)
        self.set_xy(x + 4, y + 47.5)
        self.cell(0, 4, "3x = 9   =>   x = 3")
        # botones
        by2 = y + 57
        for label, tc, bc in [("Pizarra", BLUE, BLUE), ("Audio", GREEN, GREEN), ("Espejo", PURPLE, PURPLE)]:
            self.set_fill_color(20, 28, 45)
            self.set_draw_color(*bc)
            self.set_line_width(0.25)
            self.rect(x + 3, by2, (w - 12) // 3, 6, 'FD')
            self.set_font("Helvetica", "B", 5)
            self.set_text_color(*tc)
            self.set_xy(x + 3, by2 + 1)
            self.cell((w - 12) // 3, 4.5, label, align="C")
            x += (w - 12) // 3 + 3
        return h

# ================================================================
# PAG 1 — Vista general (materias grid)
# ================================================================
pdf = PDF()
pdf.set_auto_page_break(False)
pdf.add_page()
pdf.topbar("Panel | Vista por Materia")

pdf.set_font("Helvetica", "B", 13)
pdf.set_text_color(*WHITE)
pdf.set_xy(8, 15)
pdf.cell(0, 8, s("Banco de Preguntas  |  Selecciona una Materia"))

pdf.set_font("Helvetica", "", 7)
pdf.set_text_color(*GRAY)
pdf.set_xy(8, 23)
pdf.cell(0, 5, "Estudia cada tema con preguntas reales del ICFES y apoyo del tutor IA")

# Materias grid 2 col
card_w, card_h = 95, 40
grid = [(8, 30), (108, 30), (8, 74), (108, 74), (8, 118)]
for i, (nom, col, temas) in enumerate(MATERIAS):
    x, y = grid[i]
    pdf.materia_card(x, y, card_w, card_h, nom, col, temas)

# Estadisticas banner
pdf.set_fill_color(*CARD)
pdf.set_draw_color(*LINE)
pdf.rect(8, 162, 194, 18, 'FD')
pdf.set_font("Helvetica", "B", 7)
pdf.set_text_color(*WHITE)
pdf.set_xy(12, 165)
pdf.cell(0, 5, "Resumen del banco")
bx = 12
for label, val, col in [
    ("Total preguntas", "1 240", GREEN),
    ("Materias",        "5",     BLUE),
    ("Temas",           "17",    PURPLE),
    ("Con tutor IA",    "100%",  YELLOW),
]:
    pdf.set_fill_color(20, 28, 40)
    pdf.rect(bx, 171, 44, 7, 'F')
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*col)
    pdf.set_xy(bx, 171.5)
    pdf.cell(44, 4, val, align="C")
    pdf.set_font("Helvetica", "", 5.5)
    pdf.set_text_color(*GRAY)
    pdf.set_xy(bx, 176)
    pdf.cell(44, 3.5, label, align="C")
    bx += 48

# Flujo
pdf.set_fill_color(15, 20, 30)
pdf.rect(8, 183, 194, 16, 'F')
pdf.set_font("Helvetica", "B", 6.5)
pdf.set_text_color(*YELLOW)
pdf.set_xy(12, 186)
pdf.cell(0, 5, "Flujo de estudio:")
steps = [
    ("1. Elige materia",      BLUE),
    ("2. Elige tema",          GREEN),
    ("3. Lee la pregunta",     YELLOW),
    ("4. Activa tutor IA",     PURPLE),
    ("5. Pizarra + audio",     ORANGE),
]
sx = 12
for txt, col in steps:
    pdf.set_font("Helvetica", "B", 5.5)
    pdf.set_text_color(*col)
    pdf.set_xy(sx, 192)
    pdf.cell(37, 5, s(txt))
    sx += 38

# ================================================================
# PAG 2 — Vista preguntas dentro de tema
# ================================================================
pdf.add_page()
pdf.topbar("Matematicas > Algebra")

# Breadcrumb
pdf.set_fill_color(18, 24, 36)
pdf.rect(0, 12, 210, 8, 'F')
pdf.set_font("Helvetica", "", 6)
pdf.set_text_color(*GRAY)
pdf.set_xy(8, 14)
pdf.cell(15, 5, "Materias")
pdf.set_text_color(*BLUE)
pdf.cell(6, 5, "  >  ")
pdf.set_text_color(*GREEN)
pdf.cell(22, 5, "Matematicas")
pdf.set_text_color(*BLUE)
pdf.cell(6, 5, "  >  ")
pdf.set_text_color(*WHITE)
pdf.cell(20, 5, "Algebra")

# Titulo tema
pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(*WHITE)
pdf.set_xy(8, 23)
pdf.cell(0, 7, "Algebra  |  Preguntas de practica")

pdf.set_font("Helvetica", "", 6.5)
pdf.set_text_color(*GRAY)
pdf.set_xy(8, 30)
pdf.cell(0, 5, "42 preguntas  |  Con explicacion IA  |  Dificultad: Basica a Alta")

# Filtros
pdf.set_fill_color(*CARD)
pdf.set_draw_color(*LINE)
pdf.rect(8, 36, 120, 8, 'FD')
pdf.set_font("Helvetica", "B", 5.5)
pdf.set_text_color(*GRAY)
pdf.set_xy(11, 38)
pdf.cell(12, 5, "Filtrar:")
fx = 25
for label, tc, bc in [("Todas", WHITE, LINE), ("Basica", GREEN, GREEN), ("Media", YELLOW, YELLOW), ("Alta", ORANGE, ORANGE), ("Reto", RED, RED)]:
    pdf.set_fill_color(20, 28, 40)
    pdf.set_draw_color(*bc)
    pdf.set_line_width(0.25)
    pdf.rect(fx, 37, 18, 6, 'FD')
    pdf.set_text_color(*tc)
    pdf.set_xy(fx, 37.5)
    pdf.cell(18, 5, label, align="C")
    fx += 20

PREGUNTAS = [
    (1, "Algebra", "Si 3x + 6 = 15, cual es el valor de x?",
     [("A","x = 1"), ("B","x = 3"), ("C","x = 5"), ("D","x = 7")], "B"),
    (2, "Algebra", "Resultado de simplificar: 4(2x - 3) + 2x",
     [("A","10x - 12"), ("B","6x - 12"), ("C","10x - 3"), ("D","8x - 12")], "A"),
    (3, "Algebra", "Si f(x) = 2x^2 - 4, cual es f(3)?",
     [("A","10"), ("B","14"), ("C","18"), ("D","22")], "B"),
]

qy = 47
colors = [GREEN, BLUE, PURPLE]
for i, (num, tema, stem, opts, correct) in enumerate(PREGUNTAS):
    h = pdf.question_card(8, qy, 120, num, tema, stem, opts, correct, colors[i])
    qy += h + 4

# Panel IA derecha
ia_x, ia_y = 132, 47
pdf.ai_box(ia_x, ia_y, 70, 65)

# Progreso
pdf.set_fill_color(*CARD)
pdf.set_draw_color(*LINE)
pdf.rect(8, 230, 194, 14, 'FD')
pdf.set_font("Helvetica", "B", 6)
pdf.set_text_color(*WHITE)
pdf.set_xy(12, 233)
pdf.cell(0, 4, "Tu progreso en Algebra")
pdf.set_fill_color(30, 38, 50)
pdf.rect(12, 238, 150, 4, 'F')
pdf.set_fill_color(*GREEN)
pdf.rect(12, 238, 45, 4, 'F')
pdf.set_font("Helvetica", "", 5.5)
pdf.set_text_color(*GRAY)
pdf.set_xy(165, 237)
pdf.cell(0, 5, "30%  (13/42)")

# ================================================================
# PAG 3 — Vista movil
# ================================================================
pdf.add_page()
pdf.topbar("Vista movil")

pdf.set_font("Helvetica", "B", 11)
pdf.set_text_color(*WHITE)
pdf.set_xy(8, 15)
pdf.cell(0, 7, "Vista movil  |  Pregunta con tutor IA activo")

# Marco movil
mx, mw = 52, 106
pdf.set_fill_color(8, 12, 18)
pdf.set_draw_color(55, 65, 85)
pdf.set_line_width(0.6)
pdf.rect(mx, 25, mw, 258, 'FD')

# Status
pdf.set_fill_color(14, 18, 28)
pdf.rect(mx, 25, mw, 9, 'F')
pdf.set_font("Helvetica", "B", 5.5)
pdf.set_text_color(*PURPLE)
pdf.set_xy(mx + 2, 27)
pdf.cell(mw - 4, 5, "ERP ICFES  |  Banco de Preguntas", align="C")

# Chips materia/tema
pdf.set_fill_color(15, 50, 20)
pdf.rect(mx + 4, 36, 28, 6, 'F')
pdf.set_font("Helvetica", "B", 5)
pdf.set_text_color(*GREEN)
pdf.set_xy(mx + 4, 36.5)
pdf.cell(28, 5, "Matematicas", align="C")

pdf.set_fill_color(15, 30, 55)
pdf.rect(mx + 35, 36, 22, 6, 'F')
pdf.set_text_color(*BLUE)
pdf.set_xy(mx + 35, 36.5)
pdf.cell(22, 5, "Algebra", align="C")

# Pregunta
pdf.set_font("Helvetica", "B", 7)
pdf.set_text_color(*WHITE)
pdf.set_xy(mx + 4, 45)
pdf.multi_cell(mw - 8, 4.5, "Si 3x + 6 = 15,\ncual es el valor de x?")

cy = 57
for letter, txt, ok in [("A","x = 1",False),("B","x = 3",True),("C","x = 5",False),("D","x = 7",False)]:
    if ok:
        pdf.set_fill_color(12, 45, 18)
        pdf.set_draw_color(*GREEN)
    else:
        pdf.set_fill_color(14, 20, 28)
        pdf.set_draw_color(*LINE)
    pdf.set_line_width(0.3)
    pdf.rect(mx + 4, cy, mw - 8, 7.5, 'FD')
    pdf.set_font("Helvetica", "B", 6)
    pdf.set_text_color(*GREEN if ok else GRAY)
    pdf.set_xy(mx + 6, cy + 1.5)
    pdf.cell(6, 4.5, letter)
    pdf.set_font("Helvetica", "", 6)
    pdf.set_text_color(*WHITE if ok else GRAY)
    pdf.cell(mw - 22, 4.5, txt)
    if ok:
        pdf.set_text_color(*GREEN)
        pdf.set_font("Helvetica", "B", 5.5)
        pdf.cell(14, 4.5, "[Correcta]")
    cy += 9

pdf.set_draw_color(*LINE)
pdf.line(mx + 4, cy + 2, mx + mw - 4, cy + 2)
cy += 5

# Chat IA movil
pdf.set_fill_color(18, 10, 42)
pdf.rect(mx + 4, cy, mw - 8, 48, 'F')
pdf.set_draw_color(100, 55, 210)
pdf.set_line_width(0.3)
pdf.rect(mx + 4, cy, mw - 8, 48, 'D')

pdf.set_fill_color(28, 15, 65)
pdf.rect(mx + 4, cy, mw - 8, 8, 'F')
pdf.set_font("Helvetica", "B", 6.5)
pdf.set_text_color(*PURPLE)
pdf.set_xy(mx + 6, cy + 1.5)
pdf.cell(0, 5, "Tutor IA")

pdf.set_font("Helvetica", "", 5.5)
pdf.set_text_color(180, 158, 255)
pdf.set_xy(mx + 5, cy + 10)
pdf.multi_cell(mw - 12, 3.5, s(
    "Primero resta 6 a ambos lados:\n"
    "3x + 6 - 6 = 15 - 6\n"
    "3x = 9\n\n"
    "Ahora divide entre 3:\n"
    "x = 9 / 3 = 3\n\n"
    "La respuesta correcta es B."
))

# Botones pizarra/audio/espejo
by2 = cy + 39
btn_w = (mw - 14) // 3
bx2 = mx + 4
for label, tc, bc in [("Pizarra", BLUE, BLUE), ("Audio", GREEN, GREEN), ("Espejo", PURPLE, PURPLE)]:
    pdf.set_fill_color(20, 28, 45)
    pdf.set_draw_color(*bc)
    pdf.set_line_width(0.25)
    pdf.rect(bx2, by2, btn_w, 7, 'FD')
    pdf.set_font("Helvetica", "B", 5)
    pdf.set_text_color(*tc)
    pdf.set_xy(bx2, by2 + 1)
    pdf.cell(btn_w, 5, label, align="C")
    bx2 += btn_w + 3

pdf.output(OUT)
print("PDF generado en:", OUT)
