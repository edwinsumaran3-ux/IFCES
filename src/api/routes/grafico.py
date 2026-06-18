"""
grafico.py
Endpoint para generar gráficas matemáticas con Matplotlib + SymPy.
Devuelve imagen PNG en base64 o datos JSON para Plotly.
"""
from __future__ import annotations
import io, base64, math
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/grafico", tags=["grafico"])

# ─── Importaciones opcionales (no fallar si no están instaladas) ─────────────
try:
    import numpy as np                          # type: ignore
    import matplotlib                           # type: ignore
    matplotlib.use("Agg")                       # backend sin GUI
    import matplotlib.pyplot as plt             # type: ignore
    import sympy as sp                          # type: ignore
    from sympy.parsing.sympy_parser import (    # type: ignore
        parse_expr, standard_transformations,
        implicit_multiplication_application,
    )
    LIBS_OK = True
except ImportError:
    LIBS_OK = False


# ─── Modelos de request ──────────────────────────────────────────────────────

class FuncionRequest(BaseModel):
    expresion: str                      # "sin(x)", "x**2 - 4*x + 3"
    x_min: float = -10.0
    x_max: float = 10.0
    titulo: Optional[str] = None
    color: str = "#4ade80"

class MultiRequest(BaseModel):
    funciones: list[str]                # lista de expresiones
    x_min: float = -10.0
    x_max: float = 10.0
    titulo: Optional[str] = None
    colores: list[str] = ["#4ade80", "#60a5fa", "#f97316", "#a78bfa"]

class DatosBarRequest(BaseModel):
    labels: list[str]
    valores: list[float]
    titulo: Optional[str] = "Distribución"
    tipo: str = "bar"                   # "bar" | "line"


# ─── Utilidades ─────────────────────────────────────────────────────────────

def _fig_a_base64(fig) -> str:
    """Convierte figura matplotlib a PNG base64."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight",
                facecolor="#0f172a", edgecolor="none", dpi=130)
    buf.seek(0)
    plt.close(fig)
    return base64.b64encode(buf.read()).decode()


def _estilo_dark(ax, fig):
    """Aplica tema oscuro consistente con el frontend."""
    fig.patch.set_facecolor("#0f172a")
    ax.set_facecolor("#1e293b")
    ax.tick_params(colors="#64748b")
    ax.xaxis.label.set_color("#94a3b8")
    ax.yaxis.label.set_color("#94a3b8")
    ax.title.set_color("#cbd5e1")
    for spine in ax.spines.values():
        spine.set_edgecolor("#334155")
    ax.grid(True, color="#334155", linewidth=0.5, linestyle="--", alpha=0.6)
    ax.axhline(0, color="#475569", linewidth=0.8)
    ax.axvline(0, color="#475569", linewidth=0.8)


def _safe_eval(expr_str: str, x_vals):
    """Evalúa expresión matemática de forma segura usando SymPy + NumPy."""
    transformations = standard_transformations + (implicit_multiplication_application,)
    x = sp.Symbol("x")
    expr = parse_expr(
        expr_str.replace("^", "**").replace("sen(", "sin(").replace("tg(", "tan("),
        transformations=transformations,
        local_dict={"x": x, "e": sp.E, "pi": sp.pi},
    )
    f = sp.lambdify(x, expr, modules=["numpy"])
    y_vals = f(x_vals)
    return y_vals


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/ping")
def ping():
    return {"libs": LIBS_OK}


@router.post("/funcion")
def graficar_funcion(req: FuncionRequest):
    """Genera PNG de una función y = f(x)."""
    if not LIBS_OK:
        raise HTTPException(503, "Matplotlib/SymPy no disponibles en este entorno")

    x = np.linspace(req.x_min, req.x_max, 600)
    try:
        y = _safe_eval(req.expresion, x)
    except Exception as e:
        raise HTTPException(400, f"Expresión inválida: {e}")

    fig, ax = plt.subplots(figsize=(7, 4))
    _estilo_dark(ax, fig)

    # Clip valores muy grandes (asíntotas)
    y = np.where(np.abs(y) > 1e6, np.nan, y)

    ax.plot(x, y, color=req.color, linewidth=2.2, label=f"y = {req.expresion}")
    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title(req.titulo or f"y = {req.expresion}", fontsize=11)
    ax.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#94a3b8", fontsize=9)

    return {"imagen": _fig_a_base64(fig)}


@router.post("/multifuncion")
def graficar_multiples(req: MultiRequest):
    """Genera PNG con múltiples funciones superpuestas."""
    if not LIBS_OK:
        raise HTTPException(503, "Matplotlib/SymPy no disponibles en este entorno")

    x = np.linspace(req.x_min, req.x_max, 600)
    fig, ax = plt.subplots(figsize=(7, 4))
    _estilo_dark(ax, fig)

    colores = req.colores + ["#34d399", "#fbbf24", "#38bdf8"]

    for i, expr_str in enumerate(req.funciones):
        try:
            y = _safe_eval(expr_str, x)
            y = np.where(np.abs(y) > 1e6, np.nan, y)
            ax.plot(x, y, color=colores[i % len(colores)],
                    linewidth=2.2, label=f"y = {expr_str}")
        except Exception:
            continue

    ax.set_xlabel("x")
    ax.set_ylabel("y")
    ax.set_title(req.titulo or "Funciones", fontsize=11)
    ax.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="#94a3b8", fontsize=9)

    return {"imagen": _fig_a_base64(fig)}


@router.post("/barras")
def graficar_barras(req: DatosBarRequest):
    """Genera PNG de diagrama de barras o líneas para estadística."""
    if not LIBS_OK:
        raise HTTPException(503, "Matplotlib no disponible en este entorno")

    PALETA = ["#4ade80", "#60a5fa", "#f97316", "#a78bfa", "#fb7185",
              "#34d399", "#fbbf24", "#38bdf8", "#e879f9", "#f472b6"]
    colores = [PALETA[i % len(PALETA)] for i in range(len(req.labels))]

    fig, ax = plt.subplots(figsize=(7, 4))
    _estilo_dark(ax, fig)

    if req.tipo == "line":
        ax.plot(req.labels, req.valores, color="#60a5fa",
                linewidth=2.2, marker="o", markersize=6)
    else:
        bars = ax.bar(req.labels, req.valores, color=colores,
                      edgecolor="#0f172a", linewidth=0.8)
        for bar, val in zip(bars, req.valores):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5,
                    str(val), ha="center", va="bottom",
                    color="#94a3b8", fontsize=9)

    ax.set_title(req.titulo, fontsize=11)
    ax.set_xlabel("Categoría")
    ax.set_ylabel("Valor")
    plt.xticks(rotation=25, ha="right", fontsize=9)

    return {"imagen": _fig_a_base64(fig)}


@router.post("/sympy/simplificar")
def simplificar_expresion(body: dict):
    """Simplifica una expresión algebraica con SymPy y devuelve LaTeX."""
    if not LIBS_OK:
        raise HTTPException(503, "SymPy no disponible")

    expr_str = body.get("expresion", "")
    try:
        x = sp.Symbol("x")
        expr = sp.sympify(
            expr_str.replace("^", "**").replace("sen(", "sin("),
            locals={"x": x}
        )
        simplificado  = sp.simplify(expr)
        latex_result  = sp.latex(simplificado)
        return {
            "original":     expr_str,
            "simplificado": str(simplificado),
            "latex":        latex_result,
        }
    except Exception as e:
        raise HTTPException(400, f"No se pudo simplificar: {e}")


@router.post("/sympy/resolver")
def resolver_ecuacion(body: dict):
    """Resuelve ecuación f(x)=0 con SymPy, devuelve soluciones + pasos."""
    if not LIBS_OK:
        raise HTTPException(503, "SymPy no disponible")

    expr_str = body.get("ecuacion", "")
    try:
        x = sp.Symbol("x")
        expr = sp.sympify(
            expr_str.replace("^", "**").replace("sen(", "sin("),
            locals={"x": x}
        )
        soluciones = sp.solve(expr, x)
        return {
            "ecuacion":   expr_str,
            "soluciones": [str(s) for s in soluciones],
            "latex":      [sp.latex(s) for s in soluciones],
        }
    except Exception as e:
        raise HTTPException(400, f"No se pudo resolver: {e}")
