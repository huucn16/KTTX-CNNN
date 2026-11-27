export type TopicId =
  | 'cn10-c1'
  | 'cn10-c2'
  | 'cn10-c3'
  | 'cn10-c4'
  | 'cn10-c5'
  | 'cn10-c6'
  | 'cn10-c7'
  | 'cn10-c8'
  | 'cn11-c1'
  | 'cn11-c2'
  | 'cn11-c3'
  | 'cn11-c4'
  | 'cn11-c5'
  | 'cn11-c6'
  | 'cn12-c1'
  | 'cn12-c2'
  | 'cn12-c3'
  | 'cn12-c4'
  | 'cn12-c5'
  | 'cn12-c6'
  | 'cn12-c7'
  | 'cn12-c8'
  | 'cn12-c9'
  | 'cn12-c10';

export type DifficultyLevel = 'nhan-biet' | 'thong-hieu' | 'van-dung';

export type GradeLevel = 'Công nghệ 10' | 'Công nghệ 11' | 'Công nghệ 12';

export type QuizMode = 'timed' | 'practice';

export type ShuffleMode = 'ca-hai' | 'cau-hoi' | 'dap-an' | 'khong';

export type SubmitReason = 'manual' | 'timeout' | 'auto-leave' | 'teacher-ended';

export interface ExamControlState {
  id: 'global';
  status: 'active' | 'ended';
  targetClass: string;
  endedAtMs: number;
  note: string;
}

export type AppView = 'home' | 'history' | 'wrong-stats' | 'quiz' | 'result';

export interface TopicInfo {
  id: TopicId;
  code: string;
  title: string;
  shortTitle: string;
  grade: GradeLevel;
  lessons: string;
}

export interface Question {
  id: string;
  topicId: TopicId;
  grade: GradeLevel;
  examNumber?: 1 | 2 | 3 | 4 | 5;
  difficulty: DifficultyLevel;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
  reference: string;
}

export interface QuizConfig {
  title: string;
  mode: QuizMode;
  grade: GradeLevel | 'all';
  topicIds: TopicId[];
  examNumber?: 1 | 2 | 3 | 4 | 5;
  questionIds?: string[];
  isBalancedMix?: boolean;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  difficulty: DifficultyLevel | 'all';
  questionCount: number;
  durationSeconds: number;
  studentName: string;
  studentClass: string;
}

export interface QuizAttempt {
  id: string;
  title: string;
  studentName: string;
  studentClass?: string;
  mode: QuizMode;
  grade: GradeLevel | 'all';
  topicIds: TopicId[];
  startedAt: string;
  completedAt: string;
  durationUsedSeconds: number;
  durationLimitSeconds: number;
  questions: Question[];
  answers: Record<string, number | null>;
  flaggedIds: string[];
  correctCount: number;
  totalCount: number;
  score10: number;
  leaveWarnings?: number;
  submitReason?: SubmitReason;
  syncStatus?: 'synced' | 'pending' | 'error';
}
