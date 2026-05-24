# =============================================================================
#  src/api/routes/teacher.py  — Panel docente en tiempo real + WebSocket
# =============================================================================
from __future__ import annotations
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy import text
from src.infrastructure.database import get_db

router = APIRouter(prefix="/teacher", tags=["Teacher"])
active_ws: dict[str, WebSocket] = {}

@router.websocket("/ws/{teacher_id}")
async def teacher_ws(websocket: WebSocket, teacher_id: str):
    await websocket.accept()
    active_ws[teacher_id] = websocket
    try:
        while True:
            msg = await websocket.receive_text()
            if msg == "ping": await websocket.send_text("pong")
    except WebSocketDisconnect:
        active_ws.pop(teacher_id, None)

async def notify_teacher(teacher_id: str, event: dict):
    import json
    ws = active_ws.get(teacher_id)
    if ws:
        await ws.send_text(json.dumps(event))

@router.get("/exam/{exam_id}/live")
async def live(exam_id: str, db=Depends(get_db)):
    rows = (await db.execute(text("""
        SELECT ea.id, s.full_name, s.group_name, ea.status,
               ea.remaining_ai_helps, ea.score_weighted,
               (SELECT COUNT(*) FROM student_answers sa WHERE sa.attempt_id=ea.id) answered,
               (SELECT COUNT(*) FROM ai_help_sessions h WHERE h.attempt_id=ea.id) helps_used,
               (SELECT AVG(CASE WHEN h.mirror_correct THEN 1.0 ELSE 0.0 END)*100
                FROM ai_help_sessions h WHERE h.attempt_id=ea.id) mirror_rate
        FROM exam_attempts ea JOIN students s ON s.id=ea.student_id
        WHERE ea.exam_instance_id=:eid ORDER BY ea.score_weighted DESC
    """), {"eid": exam_id})).fetchall()
    return {"students": [
        {"id":str(r.id),"name":r.full_name,"group":r.group_name,"status":r.status,
         "remaining_helps":r.remaining_ai_helps,"score":float(r.score_weighted or 0),
         "answered":r.answered,"helps_used":r.helps_used,
         "mirror_rate":round(float(r.mirror_rate or 0),1)}
        for r in rows]}

@router.get("/exam/{exam_id}/alerts")
async def alerts(exam_id: str, db=Depends(get_db)):
    rows = (await db.execute(text("""
        SELECT ea.id, s.full_name, ea.remaining_ai_helps, ea.score_weighted,
               (SELECT AVG(CASE WHEN h.mirror_correct THEN 1.0 ELSE 0.0 END)*100
                FROM ai_help_sessions h WHERE h.attempt_id=ea.id) mirror_rate
        FROM exam_attempts ea JOIN students s ON s.id=ea.student_id
        WHERE ea.exam_instance_id=:eid AND ea.status='in_progress'
    """), {"eid": exam_id})).fetchall()
    alerts_list = []
    for r in rows:
        if r.remaining_ai_helps == 0:
            alerts_list.append({"type":"ai_limit","severity":"critical","student":r.full_name,"message":"Agotó las 5 ayudas IA"})
        if float(r.score_weighted or 0) < 40:
            alerts_list.append({"type":"low_score","severity":"critical","student":r.full_name,"message":f"Puntaje crítico: {r.score_weighted:.1f}"})
        if float(r.mirror_rate or 0) < 30 and r.remaining_ai_helps < 3:
            alerts_list.append({"type":"dependency","severity":"warning","student":r.full_name,"message":f"Alta dependencia IA. Espejo: {r.mirror_rate:.0f}%"})
    return {"alerts": alerts_list}

@router.get("/exam/{exam_id}/cognitive-map")
async def cognitive_map(exam_id: str, db=Depends(get_db)):
    rows = (await db.execute(text("""
        SELECT qi.area, COUNT(*) total,
               SUM(CASE WHEN sa.is_correct THEN 1 ELSE 0 END) correct
        FROM student_answers sa
        JOIN question_items qi ON qi.id=sa.question_id
        JOIN exam_attempts ea ON ea.id=sa.attempt_id
        WHERE ea.exam_instance_id=:eid GROUP BY qi.area
    """), {"eid": exam_id})).fetchall()
    return {"cognitive_map":[
        {"area":r.area,"mastery":round((r.correct/r.total)*100) if r.total else 0,"total":r.total}
        for r in rows]}
