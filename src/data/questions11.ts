import { Question } from '../types/quiz';
import { QUESTIONS_11_C1_C2 } from './questions11_part1';
import { QUESTIONS_11_C3_C4 } from './questions11_part2';
import { QUESTIONS_11_C5_C6 } from './questions11_part3';

export const QUESTIONS_11: Question[] = [
  ...QUESTIONS_11_C1_C2,
  ...QUESTIONS_11_C3_C4,
  ...QUESTIONS_11_C5_C6,
];
