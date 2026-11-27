import { Question } from '../types/quiz';
import { QUESTIONS_10_C1_C2 } from './questions10_part1';
import { QUESTIONS_10_C3_C4 } from './questions10_part2';
import { QUESTIONS_10_C5_C6 } from './questions10_part3';
import { QUESTIONS_10_C7_C8 } from './questions10_part4';

export const QUESTIONS_10: Question[] = [
  ...QUESTIONS_10_C1_C2,
  ...QUESTIONS_10_C3_C4,
  ...QUESTIONS_10_C5_C6,
  ...QUESTIONS_10_C7_C8,
];
