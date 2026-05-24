# =============================================================================
#  src/ai/schemas.py  — Contratos JSON completos
# =============================================================================
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, Field

class QuestionOption(BaseModel):
    label: str
    text: str

class AIHelpRequest(BaseModel):
    question_id: str
    student_id: str
    attempt_id: str
    question_text: str
    options: list[QuestionOption]
    area: str | None = None
    help_number: int = 1
    student_gender: str = "neutral"
    accessibility_mode: bool = False
    locale: str = "es-CO"

class ICFESClassification(BaseModel):
    area: str = ""
    competency: str = ""
    component: str = ""
    evidence: str = ""
    cognitive_operation: str = ""
    difficulty_band: str = ""
    knowledge_tags: list[str] = []
    distractor_patterns: list[str] = []
    answer_leakage_risk: str = "low"
    mirror_generation_strategy: str = ""

class SocraticPlan(BaseModel):
    opening_question: str = ""
    guiding_questions: list[str] = []
    micro_concepts: list[str] = []
    cognitive_load_reduction: list[str] = []
    metacognitive_prompt: str = ""
    what_to_avoid: list[str] = []

class WhiteboardBlock(BaseModel):
    order: int = 1
    title: str = ""
    content: str = ""
    visual_hint: str = ""

class RedMarkerBlock(BaseModel):
    order: int = 1
    title: str = ""
    content: str = ""
    visual_warning: str = ""

class WhiteboardOutput(BaseModel):
    blue_marker_blocks: list[WhiteboardBlock] = []
    red_marker_blocks: list[RedMarkerBlock] = []
    final_student_instruction: str = ""
    rendering_instruction: dict[str, Any] = {}

class VoiceStyle(BaseModel):
    tone: str = "empathetic"
    speed: str = "slow-medium"
    pause_density: str = "medium"

class AudioScriptOutput(BaseModel):
    tts_script: str = ""
    voice_style: VoiceStyle = VoiceStyle()
    estimated_duration_seconds: int = 58
    accessibility_notes: list[str] = []

class MirrorOption(BaseModel):
    label: str = ""
    text: str = ""
    distractor_type: str = ""

class InternalSolution(BaseModel):
    correct_option: str = ""
    solution_path: str = ""
    why_each_option: dict[str, str] = {}

class EquivalenceReport(BaseModel):
    same_competency: bool = True
    same_component: bool = True
    same_cognitive_operation: bool = True
    same_difficulty: bool = True
    context_changed: bool = True
    copy_risk: str = "low"

class MirrorQuestion(BaseModel):
    stem: str = ""
    options: list[MirrorOption] = []
    difficulty: str = ""
    competency: str = ""
    component: str = ""
    internal_solution: InternalSolution | None = None
    equivalence_report: EquivalenceReport = EquivalenceReport()

class LeakageViolation(BaseModel):
    type: str = ""
    evidence: str = ""
    severity: str = ""

class LeakageEvaluation(BaseModel):
    approved: bool = True
    risk_level: str = "low"
    violations: list[LeakageViolation] = []
    repair_instruction: str = ""
    must_regenerate: bool = False

class AIHelpResponse(BaseModel):
    session_id: str
    prompt_bundle_version: str
    approved: bool
    risk_level: str
    icfes_classification: ICFESClassification
    whiteboard: WhiteboardOutput
    audio_script: AudioScriptOutput
    audio_mp3_base64: str = ""
    mirror_question: MirrorQuestion
    latency_ms: int
