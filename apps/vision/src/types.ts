export type AnswerType = 'box' | 'noul' | 'choice' | 'score';
export type Box = { top: number; bottom: number; left: number; right: number };
export type Answer = {
  type: AnswerType;
  box?: Box;
  noul?: number;
  choice?: string;
  score?: number;
  confidence?: number | null;
  probabilities?: Record<string, number>;
  legend?: Record<string, string>;
};
export type Evaluation = {
  answer: Answer;
  raw: { model: string; answers: Record<string, Answer>; usage?: { input_tokens: number; output_tokens: number } };
  elapsedMs: number;
};
export type Photo = { dataUrl: string; width: number; height: number; name: string; size: number };
