# src/api/middleware/plan_restrictions.py
# Restricciones por plan — se aplica en exams.py y ai_help.py

PLAN_CONFIG = {
    'basic': {
        'max_ai_helps': 1,
        'difficulty_levels': ['MEDIA'],
        'label': 'Básico'
    },
    'plus': {
        'max_ai_helps': 3,
        'difficulty_levels': ['MEDIA', 'ALTA'],
        'label': 'Plus'
    },
    'premium': {
        'max_ai_helps': 5,
        'difficulty_levels': ['MEDIA', 'ALTA', 'RETO'],
        'label': 'Premium'
    },
}

def get_plan_config(plan_code: str) -> dict:
    return PLAN_CONFIG.get(plan_code, PLAN_CONFIG['basic'])

def get_difficulty_filter(plan_code: str) -> list[str]:
    return get_plan_config(plan_code)['difficulty_levels']

def get_max_helps(plan_code: str) -> int:
    return get_plan_config(plan_code)['max_ai_helps']
