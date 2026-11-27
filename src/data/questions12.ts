import { Question } from '../types/quiz';
import { QUESTIONS_12_C1_C2 } from './questions12_part1';
import { QUESTIONS_12_C3_C4 } from './questions12_part2';
import { QUESTIONS_12_C5_C6 } from './questions12_part3';
import { QUESTIONS_12_C7_C8 } from './questions12_part4';
import { QUESTIONS_12_C9_C10 } from './questions12_part5';

export const QUESTIONS_12: Question[] = [
  ...QUESTIONS_12_C1_C2,
  ...QUESTIONS_12_C3_C4,
  ...QUESTIONS_12_C5_C6,
  ...QUESTIONS_12_C7_C8,
  ...QUESTIONS_12_C9_C10,
];
