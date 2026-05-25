# src/services/email_service.py
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging

logger = logging.getLogger(__name__)

GMAIL_USER = "edwinsumaran3@gmail.com"
GMAIL_PASS = "kgsw ftpv fzuh xtot"

def send_exam_results(
    student_email: str,
    student_name: str,
    score: float,
    area_results: list,
    attempt_id: str,
    plan: str = "basic"
):
    try:
        areas_html = ""
        for a in area_results:
            pct = a.get('pct', 0)
            color = '#34d399' if pct >= 70 else '#fbbf24' if pct >= 50 else '#f87171'
            areas_html += f"""
            <tr>
                <td style="padding:8px 12px;font-size:13px;color:#e2e8f0;">{a['area']}</td>
                <td style="padding:8px 12px;font-size:13px;color:#94a3b8;text-align:center;">{a.get('correct',0)}/{a.get('total',0)}</td>
                <td style="padding:8px 12px;text-align:center;">
                    <span style="background:{color}22;color:{color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;">{pct}%</span>
                </td>
            </tr>"""

        nivel = 'Excelente' if score >= 70 else 'Bueno' if score >= 50 else 'Necesita refuerzo'
        color_score = '#34d399' if score >= 70 else '#fbbf24' if score >= 50 else '#f87171'

        html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#040813;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">

    <div style="background:linear-gradient(135deg,#0d1230,#1a1f3a);border:1px solid rgba(37,99,235,0.3);border-radius:16px;overflow:hidden;">

      <div style="background:linear-gradient(90deg,rgba(37,99,235,0.3),rgba(124,58,237,0.2));padding:24px;text-align:center;">
        <div style="font-size:32px;margin-bottom:8px;">🧠</div>
        <h1 style="color:#e2e8f0;font-size:22px;margin:0 0 4px;">ERP ICFES Neuro-IA</h1>
        <p style="color:#60a5fa;font-size:13px;margin:0;">Resultados de tu Simulacro Saber 11</p>
      </div>

      <div style="padding:24px;">
        <p style="color:#94a3b8;font-size:14px;">Hola <strong style="color:#e2e8f0;">{student_name}</strong>,</p>
        <p style="color:#94a3b8;font-size:13px;line-height:1.6;">Aquí están los resultados de tu simulacro oficial Saber 11.</p>

        <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;text-align:center;margin:16px 0;">
          <div style="font-size:11px;color:#475569;letter-spacing:1px;margin-bottom:8px;">PUNTAJE GENERAL</div>
          <div style="font-size:48px;font-weight:700;color:{color_score};margin-bottom:4px;">{score:.1f}</div>
          <div style="font-size:12px;color:{color_score};background:{color_score}22;padding:4px 14px;border-radius:20px;display:inline-block;">{nivel}</div>
        </div>

        <div style="margin:16px 0;">
          <div style="font-size:11px;color:#475569;letter-spacing:1px;margin-bottom:10px;">RESULTADOS POR ÁREA</div>
          <table style="width:100%;border-collapse:collapse;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:rgba(255,255,255,0.04);">
                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:left;">Área</th>
                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:center;">Correctas</th>
                <th style="padding:8px 12px;font-size:11px;color:#475569;text-align:center;">Porcentaje</th>
              </tr>
            </thead>
            <tbody>{areas_html}</tbody>
          </table>
        </div>

        <div style="background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);border-radius:10px;padding:14px;margin-top:16px;">
          <p style="color:#60a5fa;font-size:12px;margin:0 0 6px;font-weight:600;">💡 ¿Quieres mejorar tu puntaje?</p>
          <p style="color:#475569;font-size:12px;margin:0;line-height:1.6;">Compra un nuevo simulacro y usa las ayudas IA socráticas para reforzar las áreas donde tuviste dificultades.</p>
        </div>

        <div style="text-align:center;margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="color:#334155;font-size:11px;margin:0;">ERP ICFES Neuro-IA · Simulacro oficial Saber 11 · Colombia</p>
          <p style="color:#334155;font-size:10px;margin:4px 0 0;">ID del intento: {attempt_id[:8]}...</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>"""

        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"Tus resultados ICFES Saber 11 — Puntaje: {score:.1f} pts"
        msg['From']    = f"ERP ICFES Neuro-IA <{GMAIL_USER}>"
        msg['To']      = student_email
        msg.attach(MIMEText(html, 'html'))

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS.replace(' ', ''))
            server.sendmail(GMAIL_USER, student_email, msg.as_string())

        logger.info(f"Correo enviado a {student_email}")
        return True

    except Exception as e:
        logger.error(f"Error enviando correo: {e}")
        return False


def send_plan_approved(student_email: str, student_name: str, plan: str):
    try:
        plan_names = {'basic':'Básico','plus':'Plus','premium':'Premium'}
        plan_name  = plan_names.get(plan, plan)

        html = f"""
<!DOCTYPE html>
<html>
<body style="margin:0;padding:20px;background:#040813;font-family:Arial,sans-serif;">
  <div style="max-width:500px;margin:0 auto;background:linear-gradient(135deg,#0d1230,#1a1f3a);border:1px solid rgba(52,211,153,0.3);border-radius:16px;padding:24px;">
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-size:40px;">✅</div>
      <h2 style="color:#34d399;margin:8px 0;">¡Plan activado!</h2>
    </div>
    <p style="color:#94a3b8;font-size:14px;">Hola <strong style="color:#e2e8f0;">{student_name}</strong>,</p>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;">Tu pago fue verificado y el <strong style="color:#34d399;">Plan {plan_name}</strong> ha sido activado.</p>
    <div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.2);border-radius:10px;padding:14px;margin:16px 0;text-align:center;">
      <div style="font-size:11px;color:#475569;margin-bottom:6px;">PLAN ACTIVO</div>
      <div style="font-size:20px;font-weight:700;color:#34d399;">{plan_name}</div>
    </div>
    <p style="color:#94a3b8;font-size:13px;">Ya puedes ingresar al sistema y presentar tu simulacro Saber 11.</p>
    <div style="text-align:center;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06);">
      <p style="color:#334155;font-size:11px;margin:0;">ERP ICFES Neuro-IA · Colombia</p>
    </div>
  </div>
</body>
</html>"""

        msg = MIMEMultipart('alternative')
        msg['Subject'] = f"Plan {plan_name} activado — ERP ICFES Neuro-IA"
        msg['From']    = f"ERP ICFES Neuro-IA <{GMAIL_USER}>"
        msg['To']      = student_email
        msg.attach(MIMEText(html, 'html'))

        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS.replace(' ', ''))
            server.sendmail(GMAIL_USER, student_email, msg.as_string())

        return True
    except Exception as e:
        logger.error(f"Error enviando correo de aprobacion: {e}")
        return False
