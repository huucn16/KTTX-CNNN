import { Question } from '../types/quiz';
import { QUESTIONS_10 } from './questions10';
import { QUESTIONS_11 } from './questions11';
import { QUESTIONS_12 } from './questions12';

export { TEXTBOOKS, TOPICS } from './topics';
export type { TextbookMeta } from './topics';

export const BUILTIN_QUESTIONS: Question[] = [
  ...QUESTIONS_10,
  ...QUESTIONS_11,
  ...QUESTIONS_12,
];
