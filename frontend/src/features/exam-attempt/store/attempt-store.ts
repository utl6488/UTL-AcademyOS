import { create } from "zustand";
import type { AttemptInfo, Answer, QuestionStatus } from "../schemas/attempt-schemas";

interface AttemptState {
  attemptInfo: AttemptInfo | null;
  answers: Map<string, Answer>;
  currentQuestionIndex: number;
  currentSectionIndex: number;
  serverTimeOffset: number; // client - server diff in ms
  violationCount: number;
  isSubmitting: boolean;
  isDisconnected: boolean;

  // Actions
  setAttemptInfo: (info: AttemptInfo) => void;
  setAnswers: (answers: Answer[]) => void;
  updateAnswer: (questionId: string, answer: unknown, isMarked?: boolean) => void;
  toggleMark: (questionId: string) => void;
  setCurrentQuestion: (sectionIndex: number, questionIndex: number) => void;
  syncServerTime: (serverTime: number) => void;
  incrementViolation: () => void;
  setSubmitting: (v: boolean) => void;
  setDisconnected: (v: boolean) => void;
  reset: () => void;

  // Computed
  getQuestionStatus: (questionId: string) => QuestionStatus;
  getUnansweredCount: () => number;
  getMarkedCount: () => number;
  getRemainingMs: () => number;
}

export const useAttemptStore = create<AttemptState>((set, get) => ({
  attemptInfo: null,
  answers: new Map(),
  currentQuestionIndex: 0,
  currentSectionIndex: 0,
  serverTimeOffset: 0,
  violationCount: 0,
  isSubmitting: false,
  isDisconnected: false,

  setAttemptInfo: (info) => set({ attemptInfo: info }),

  setAnswers: (answers) => {
    const map = new Map<string, Answer>();
    answers.forEach((a) => map.set(a.questionId, a));
    set({ answers: map });
  },

  updateAnswer: (questionId, answer, isMarked) => {
    const { answers } = get();
    const existing = answers.get(questionId);
    const updated = new Map(answers);
    updated.set(questionId, {
      questionId,
      answer,
      isMarked: isMarked ?? existing?.isMarked ?? false,
      answeredAt: new Date().toISOString(),
    });
    set({ answers: updated });
  },

  toggleMark: (questionId) => {
    const { answers } = get();
    const existing = answers.get(questionId);
    const updated = new Map(answers);
    updated.set(questionId, {
      questionId,
      answer: existing?.answer ?? null,
      isMarked: !(existing?.isMarked ?? false),
      answeredAt: existing?.answeredAt ?? null,
    });
    set({ answers: updated });
  },

  setCurrentQuestion: (sectionIndex, questionIndex) =>
    set({ currentSectionIndex: sectionIndex, currentQuestionIndex: questionIndex }),

  syncServerTime: (serverTime) => {
    set({ serverTimeOffset: Date.now() - serverTime });
  },

  incrementViolation: () => set((s) => ({ violationCount: s.violationCount + 1 })),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setDisconnected: (isDisconnected) => set({ isDisconnected }),

  reset: () =>
    set({
      attemptInfo: null,
      answers: new Map(),
      currentQuestionIndex: 0,
      currentSectionIndex: 0,
      serverTimeOffset: 0,
      violationCount: 0,
      isSubmitting: false,
      isDisconnected: false,
    }),

  getQuestionStatus: (questionId) => {
    const answer = get().answers.get(questionId);
    if (!answer) return "unanswered";
    const hasAnswer = answer.answer !== null && answer.answer !== undefined && answer.answer !== "";
    if (hasAnswer && answer.isMarked) return "marked_answered";
    if (hasAnswer) return "answered";
    if (answer.isMarked) return "marked";
    return "unanswered";
  },

  getUnansweredCount: () => {
    const { attemptInfo, answers } = get();
    if (!attemptInfo) return 0;
    let total = 0;
    attemptInfo.sections.forEach((s) => {
      s.questions.forEach((q) => {
        const a = answers.get(q.questionId);
        if (!a || a.answer === null || a.answer === undefined || a.answer === "") total++;
      });
    });
    return total;
  },

  getMarkedCount: () => {
    const { answers } = get();
    let count = 0;
    answers.forEach((a) => {
      if (a.isMarked) count++;
    });
    return count;
  },

  getRemainingMs: () => {
    const { attemptInfo, serverTimeOffset } = get();
    if (!attemptInfo?.endsAt) return Infinity;
    const serverNow = Date.now() - serverTimeOffset;
    return Math.max(0, new Date(attemptInfo.endsAt).getTime() - serverNow);
  },
}));
