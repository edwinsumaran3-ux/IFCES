// =============================================================================
//  src/services/api.ts  — Cliente HTTP para el backend
// =============================================================================

const BASE = 'https://ifces-production.up.railway.app/api/v1';

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`,
});

export const api = {
  // Solicitar ayuda IA
  requestAIHelp: (attemptId: string, questionId: string, body: object) =>
    fetch(`${BASE}/exam-attempts/${attemptId}/questions/${questionId}/ai-help`, {
      method: 'POST', headers: headers(), body: JSON.stringify(body),
    }).then(r => r.json()),

  // Responder pregunta espejo
  answerMirror: (sessionId: string, selectedOption: string) =>
    fetch(`${BASE}/exam-attempts/mirror-questions/${sessionId}/answer`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ selected_option: selectedOption }),
    }).then(r => r.json()),

  // Obtener preguntas del intento
  getAttemptQuestions: (attemptId: string) =>
    fetch(`${BASE}/exam-attempts/${attemptId}/questions`, {
      headers: headers(),
    }).then(r => r.json()),
};
