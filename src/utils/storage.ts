import { DifficultyLevel, Question, QuizAttempt } from '../types/quiz';

const ATTEMPTS_KEY = 'agri_quiz_attempts_v1';
const SAVED_EXAMS_KEY = 'agri_quiz_saved_exams_v1';
const CUSTOM_QUESTIONS_KEY = 'agri_quiz_custom_questions_v1';
const STUDENT_NAME_KEY = 'agri_quiz_student_name_v1';
const STUDENT_CLASS_KEY = 'agri_quiz_student_class_v1';

export function loadAttempts(): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAttempt(attempt: QuizAttempt): QuizAttempt[] {
  const current = loadAttempts();
  const updated = [attempt, ...current].slice(0, 100);
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function updateAttemptSyncStatus(
  attemptId: string,
  syncStatus: 'synced' | 'pending' | 'error'
): QuizAttempt[] {
  const current = loadAttempts();
  const updated = current.map((item) =>
    item.id === attemptId ? { ...item, syncStatus } : item
  );
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function clearAttempts(): void {
  try {
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // Ignore
  }
}

export function loadLocalSavedExams(): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(SAVED_EXAMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalExam(attempt: QuizAttempt): QuizAttempt[] {
  const current = loadLocalSavedExams().filter((item) => item.id !== attempt.id);
  const updated = [attempt, ...current].slice(0, 200);
  try {
    localStorage.setItem(SAVED_EXAMS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

export function removeLocalSavedExam(attemptId: string): QuizAttempt[] {
  const updated = loadLocalSavedExams().filter((item) => item.id !== attemptId);
  try {
    localStorage.setItem(SAVED_EXAMS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
  return updated;
}

export function loadCustomQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomQuestions(questions: Question[]): void {
  try {
    localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(questions));
  } catch {
    // Ignore
  }
}

export function loadStudentName(): string {
  try {
    return localStorage.getItem(STUDENT_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStudentName(name: string): void {
  try {
    localStorage.setItem(STUDENT_NAME_KEY, name);
  } catch {
    // Ignore
  }
}

export function loadStudentClass(): string {
  try {
    return localStorage.getItem(STUDENT_CLASS_KEY) || '';
  } catch {
    return '';
  }
}

export function saveStudentClass(studentClass: string): void {
  try {
    localStorage.setItem(STUDENT_CLASS_KEY, studentClass);
  } catch {
    // Ignore
  }
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getDifficultyLabel(level: DifficultyLevel): string {
  switch (level) {
    case 'nhan-biet':
      return 'Nhận biết';
    case 'thong-hieu':
      return 'Thông hiểu';
    case 'van-dung':
      return 'Vận dụng';
  }
}

export interface GradeRank {
  label: string;
  tone: 'emerald' | 'sky' | 'amber' | 'rose';
  comment: string;
}

export function getGradeRank(score10: number): GradeRank {
  if (score10 >= 9.0) {
    return {
      label: 'Xuất sắc',
      tone: 'emerald',
      comment: 'Nắm vững toàn diện kiến thức lý thuyết và vận dụng thực tiễn nông nghiệp.',
    };
  }
  if (score10 >= 8.0) {
    return {
      label: 'Giỏi',
      tone: 'emerald',
      comment: 'Kết quả rất tốt. Hãy xem lại một vài câu sai để đạt điểm tuyệt đối.',
    };
  }
  if (score10 >= 6.5) {
    return {
      label: 'Khá',
      tone: 'sky',
      comment: 'Nắm được kiến thức cốt lõi, cần củng cố thêm các câu hỏi mức độ Vận dụng.',
    };
  }
  if (score10 >= 5.0) {
    return {
      label: 'Đạt yêu cầu',
      tone: 'amber',
      comment: 'Đạt mức trung bình. Nên ôn luyện lại chuyên đề còn yếu theo giải thích.',
    };
  }
  return {
    label: 'Cần ôn tập thêm',
    tone: 'rose',
    comment: 'Chưa đạt ngưỡng 5,0 điểm. Hãy chuyển sang chế độ Ôn luyện để xem giải thích từng câu.',
  };
}
