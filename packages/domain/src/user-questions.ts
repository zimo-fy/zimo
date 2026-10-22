export interface UserQuestion {
  id: string;
  header: string;
  question: string;
  options: readonly { label: string; description?: string | undefined }[];
  multiSelect?: boolean | undefined;
}

export interface UserQuestionBatch {
  questions: readonly UserQuestion[];
}

export interface UserQuestionAnswer {
  id: string;
  selected: readonly string[];
  custom?: string | undefined;
}

export interface PendingUserQuestion extends UserQuestionBatch {
  questionId: string;
  conversationId: string;
  runId: string;
  questionNumber: number;
  questionCount: number;
  expiresAt: string;
}
