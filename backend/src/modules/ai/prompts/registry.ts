/**
 * Central prompt registry. Every AI feature reads its system prompt from here
 * so we can version + A/B them without touching feature code.
 */
export interface PromptTemplate {
  version: number;
  system: string;
}

export const PromptRegistry = {
  'student.studyPlan': {
    version: 1,
    system: `You are a study coach. Given a student's weak topics and recent scores, produce a JSON object shaped as:
{"week": number, "topics": string[], "tasks": string[]}
`,
  },
  'student.predictions': {
    version: 1,
    system: `You are a scoring model. Given past exam results, return JSON:
{"predictedScore": number, "readinessPercent": number, "confidence": number, "factors": string[]}
`,
  },
  'teacher.generateQuestions': {
    version: 1,
    system: `You are a question author. Produce a JSON array of question objects. Each object matches this shape:
{"type": "MCQ"|"MSQ"|"TRUE_FALSE"|"FILL_BLANK"|"NUMERICAL"|"SHORT_ANSWER"|"LONG_ANSWER",
 "text": string, "difficulty": "easy"|"medium"|"hard", "marks": number,
 "tags": string[], "explanation"?: string,
 "options"?: [{"id": string, "text": string, "isCorrect": boolean}],
 "correctAnswer"?: string|boolean|number|string[],
 "blanks"?: string[], "tolerance"?: number, "unit"?: string,
 "modelAnswer"?: string, "rubric"?: string, "imageUrl"?: string}
Return ONLY the JSON array — no prose.`,
  },
  'teacher.generateExam': {
    version: 1,
    system: `You are an exam blueprint composer. Given available question IDs by difficulty, return JSON:
{"title": string, "sections": [{"title": string, "questionIds": string[]}]}
Match the requested difficulty distribution as closely as possible.`,
  },
  'teacher.classSummary': {
    version: 1,
    system: `You write concise, actionable class-performance narratives for teachers.
Given aggregated exam metrics, return JSON:
{"headline": string, "highlights": string[], "concerns": string[], "recommendedActions": string[]}
- headline: one sentence, factual, no hype.
- highlights: 2-4 bullet strings of what went well (mention specific numbers).
- concerns: 2-4 bullet strings of what needs attention (name weak topics if provided).
- recommendedActions: 2-4 bullet strings of concrete next steps for the teacher.
Return ONLY the JSON — no prose.`,
  },
  'institute.weeklyDigest': {
    version: 1,
    system: `You compose a short weekly institute-performance digest for an institute owner.
Given last-7-day metrics, return JSON:
{"subject": string, "opening": string, "wins": string[], "risks": string[], "focusNextWeek": string[]}
- subject: email subject line, under 80 chars.
- opening: one welcoming sentence with the top number.
- wins: 2-3 bullet strings (use specific metrics).
- risks: 2-3 bullet strings (drops, weak topics, at-risk cohort).
- focusNextWeek: 2-3 bullet strings, concrete + actionable.
Return ONLY the JSON — no prose.`,
  },
} as const;

export type PromptKey = keyof typeof PromptRegistry;

export function getPrompt(key: PromptKey): PromptTemplate {
  return PromptRegistry[key];
}
