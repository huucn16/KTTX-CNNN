import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ExamControlState,
  GradeLevel,
  Question,
  QuizAttempt,
  QuizMode,
  SubmitReason,
  TopicId,
} from '../types/quiz';
import { buildTimedAttemptKey } from '../utils/storage';

export const PRIMARY_TEACHER_EMAIL = 'huucn16@gmail.com';
const PENDING_SYNC_KEY = 'agri_quiz_pending_sync_v1';

interface SubmissionPayload {
  id: string;
  title: string;
  studentName: string;
  studentClass: string;
  mode: QuizMode;
  grade: GradeLevel | 'all';
  topicIds: TopicId[];
  startedAt: string;
  completedAt: string;
  durationUsedSeconds: number;
  durationLimitSeconds: number;
  questionIds: string[];
  selectedIndices: number[];
  flaggedIds: string[];
  correctCount: number;
  totalCount: number;
  score10: number;
  leaveWarnings: number;
  submitReason: SubmitReason;
  createdAt: ReturnType<typeof serverTimestamp>;
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  return cleaned.length >= 4 ? cleaned : `att-${Date.now()}`;
}

export function attemptToSubmissionPayload(
  attempt: QuizAttempt,
  builtinQuestions: Question[]
): SubmissionPayload {
  const questionById = new Map(builtinQuestions.map((q) => [q.id, q]));
  const boundedQuestions = attempt.questions.slice(0, 100);
  const questionIds = boundedQuestions.map((q) => q.id);

  const selectedIndices = boundedQuestions.map((q) => {
    const pickedIdx = attempt.answers[q.id];
    if (pickedIdx === null || pickedIdx === undefined) return -1;
    const pickedText = q.options[pickedIdx];
    const orig = questionById.get(q.id);
    if (!orig || !pickedText) {
      return typeof pickedIdx === 'number' && pickedIdx >= 0 && pickedIdx <= 3 ? pickedIdx : -1;
    }
    const canonicalIdx = orig.options.indexOf(pickedText);
    return canonicalIdx >= 0 ? canonicalIdx : -1;
  });

  const safeTopicIds = (
    attempt.topicIds.length > 0 ? attempt.topicIds : (['cn10-c1'] as TopicId[])
  ).slice(0, 30);

  const totalCount = Math.max(1, questionIds.length);
  const correctCount = Math.max(0, Math.min(totalCount, Math.round(attempt.correctCount)));

  return {
    id: sanitizeId(attempt.id),
    title: (attempt.title || 'Bài kiểm tra').trim().slice(0, 200) || 'Bài kiểm tra',
    studentName: (attempt.studentName || 'Học sinh').trim().slice(0, 100) || 'Học sinh',
    studentClass: (attempt.studentClass || 'Chưa rõ').trim().slice(0, 30) || 'Chưa rõ',
    mode: attempt.mode === 'practice' ? 'practice' : 'timed',
    grade: attempt.grade || 'all',
    topicIds: safeTopicIds,
    startedAt: (attempt.startedAt || new Date().toISOString()).slice(0, 40),
    completedAt: (attempt.completedAt || new Date().toISOString()).slice(0, 40),
    durationUsedSeconds: Math.max(0, Math.min(7200, Math.round(attempt.durationUsedSeconds || 0))),
    durationLimitSeconds: Math.max(0, Math.min(7200, Math.round(attempt.durationLimitSeconds || 0))),
    questionIds,
    selectedIndices,
    flaggedIds: (attempt.flaggedIds || []).slice(0, 100),
    correctCount,
    totalCount,
    score10: Math.max(0, Math.min(10, Math.round((attempt.score10 || 0) * 10) / 10)),
    leaveWarnings: Math.max(0, Math.min(100, Math.round(attempt.leaveWarnings ?? 0))),
    submitReason: attempt.submitReason ?? 'manual',
    createdAt: serverTimestamp(),
  };
}

export function submissionDocToQuizAttempt(
  data: Record<string, unknown>,
  builtinQuestions: Question[]
): QuizAttempt {
  const questionById = new Map(builtinQuestions.map((q) => [q.id, q]));
  const questionIds = Array.isArray(data.questionIds)
    ? data.questionIds.filter((id): id is string => typeof id === 'string')
    : [];
  const selectedIndices = Array.isArray(data.selectedIndices)
    ? data.selectedIndices
    : [];

  const questions: Question[] = [];
  const answers: Record<string, number | null> = {};

  questionIds.forEach((qId, idx) => {
    const q = questionById.get(qId);
    if (!q) return;
    questions.push(q);
    const val = selectedIndices[idx];
    answers[qId] = typeof val === 'number' && val >= 0 && val <= 3 ? val : null;
  });

  let completedAt = typeof data.completedAt === 'string' ? data.completedAt : '';
  if (!completedAt && data.createdAt instanceof Timestamp) {
    completedAt = data.createdAt.toDate().toISOString();
  }
  if (!completedAt) {
    completedAt = new Date().toISOString();
  }

  return {
    id: typeof data.id === 'string' ? data.id : `sub-${Date.now()}`,
    title: typeof data.title === 'string' ? data.title : 'Bài kiểm tra',
    studentName: typeof data.studentName === 'string' ? data.studentName : 'Học sinh',
    studentClass: typeof data.studentClass === 'string' ? data.studentClass : '',
    mode: data.mode === 'practice' ? 'practice' : 'timed',
    grade: (data.grade as GradeLevel | 'all') || 'all',
    topicIds: Array.isArray(data.topicIds) ? (data.topicIds as TopicId[]) : [],
    startedAt: typeof data.startedAt === 'string' ? data.startedAt : completedAt,
    completedAt,
    durationUsedSeconds: typeof data.durationUsedSeconds === 'number' ? data.durationUsedSeconds : 0,
    durationLimitSeconds:
      typeof data.durationLimitSeconds === 'number' ? data.durationLimitSeconds : 0,
    questions,
    answers,
    flaggedIds: Array.isArray(data.flaggedIds)
      ? data.flaggedIds.filter((id): id is string => typeof id === 'string')
      : [],
    correctCount: typeof data.correctCount === 'number' ? data.correctCount : 0,
    totalCount: typeof data.totalCount === 'number' ? data.totalCount : questions.length,
    score10: typeof data.score10 === 'number' ? data.score10 : 0,
    leaveWarnings: typeof data.leaveWarnings === 'number' ? data.leaveWarnings : 0,
    submitReason: (data.submitReason as SubmitReason) || 'manual',
    syncStatus: 'synced',
  };
}

export async function syncAttemptToTeacher(
  attempt: QuizAttempt,
  builtinQuestions: Question[]
): Promise<void> {
  const payload = attemptToSubmissionPayload(attempt, builtinQuestions);
  const path = `submissions/${payload.id}`;
  try {
    await setDoc(doc(db, 'submissions', payload.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function enqueuePendingAttempt(attempt: QuizAttempt): void {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    const list: QuizAttempt[] = raw ? JSON.parse(raw) : [];
    const filtered = Array.isArray(list) ? list.filter((a) => a.id !== attempt.id) : [];
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify([attempt, ...filtered].slice(0, 30)));
  } catch {
    // Ignore localStorage quota issues
  }
}

export function dequeuePendingAttempt(attemptId: string): void {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return;
    const list: QuizAttempt[] = JSON.parse(raw);
    if (!Array.isArray(list)) return;
    localStorage.setItem(
      PENDING_SYNC_KEY,
      JSON.stringify(list.filter((a) => a.id !== attemptId))
    );
  } catch {
    // Ignore
  }
}

export function loadPendingAttempts(): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function checkIsTeacherUser(user: User | null): Promise<boolean> {
  if (!user || !user.emailVerified) return false;
  if (user.email?.toLowerCase() === PRIMARY_TEACHER_EMAIL) return true;
  const path = `admins/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', user.uid));
    return snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeTeacherSubmissions(
  builtinQuestions: Question[],
  onData: (attempts: QuizAttempt[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'submissions';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(500));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        submissionDocToQuizAttempt(d.data() as Record<string, unknown>, builtinQuestions)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function findExistingTimedSubmission(
  studentName: string,
  studentClass: string,
  title: string,
  builtinQuestions: Question[]
): Promise<QuizAttempt | null> {
  const targetKey = buildTimedAttemptKey(studentName, studentClass, title);
  const path = 'submissions';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(500));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      const data = d.data() as Record<string, unknown>;
      if (data.mode !== 'timed') continue;
      const rowKey = buildTimedAttemptKey(
        typeof data.studentName === 'string' ? data.studentName : '',
        typeof data.studentClass === 'string' ? data.studentClass : '',
        typeof data.title === 'string' ? data.title : ''
      );
      if (rowKey === targetKey) {
        return submissionDocToQuizAttempt(data, builtinQuestions);
      }
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteTeacherSubmission(submissionId: string): Promise<void> {
  const path = `submissions/${submissionId}`;
  try {
    await deleteDoc(doc(db, 'submissions', submissionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function deleteTeacherSubmissionsBatch(submissionIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(submissionIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const CHUNK_SIZE = 450;
  try {
    for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
      const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.delete(doc(db, 'submissions', id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'submissions');
  }
}

export async function saveExamToCloudArchive(
  attempt: QuizAttempt,
  builtinQuestions: Question[],
  savedByUid: string
): Promise<void> {
  const basePayload = attemptToSubmissionPayload(attempt, builtinQuestions);
  const { createdAt: _ignoredCreatedAt, ...rest } = basePayload;
  const path = `savedExams/${basePayload.id}`;
  try {
    await setDoc(doc(db, 'savedExams', basePayload.id), {
      ...rest,
      savedByUid: sanitizeId(savedByUid),
      savedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeSavedExams(
  builtinQuestions: Question[],
  onData: (attempts: QuizAttempt[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'savedExams';
  const q = query(collection(db, path), orderBy('savedAt', 'desc'), limit(500));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        submissionDocToQuizAttempt(d.data() as Record<string, unknown>, builtinQuestions)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function deleteSavedExamFromArchive(savedExamId: string): Promise<void> {
  const path = `savedExams/${savedExamId}`;
  try {
    await deleteDoc(doc(db, 'savedExams', savedExamId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function doesExamControlMatchClass(
  control: ExamControlState | null,
  studentClass: string
): boolean {
  if (!control || control.status !== 'ended') return false;
  const target = (control.targetClass || 'all').trim().toLowerCase();
  if (target === 'all') return true;
  return target === studentClass.trim().toLowerCase();
}

export function subscribeExamControl(
  onData: (state: ExamControlState) => void,
  onError?: (err: Error) => void
): () => void {
  const path = 'examControl/global';
  return onSnapshot(
    doc(db, 'examControl', 'global'),
    (snap) => {
      if (!snap.exists()) {
        onData({
          id: 'global',
          status: 'active',
          targetClass: 'all',
          endedAtMs: 0,
          note: '',
        });
        return;
      }
      const d = snap.data() as Record<string, unknown>;
      onData({
        id: 'global',
        status: d.status === 'ended' ? 'ended' : 'active',
        targetClass: typeof d.targetClass === 'string' ? d.targetClass : 'all',
        endedAtMs: typeof d.endedAtMs === 'number' ? d.endedAtMs : 0,
        note: typeof d.note === 'string' ? d.note : '',
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        if (onError) {
          onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    }
  );
}

export async function setExamEndedState(
  targetClass: string,
  note = 'Giáo viên đã kết thúc bài thi trước giờ quy định.'
): Promise<void> {
  const path = 'examControl/global';
  const safeTarget = (targetClass || 'all').trim().slice(0, 30) || 'all';
  const safeNote = (note || '').trim().slice(0, 200);
  try {
    await setDoc(doc(db, 'examControl', 'global'), {
      id: 'global',
      status: 'ended',
      targetClass: safeTarget,
      endedAtMs: Date.now(),
      note: safeNote,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function reopenExamState(): Promise<void> {
  const path = 'examControl/global';
  try {
    await setDoc(doc(db, 'examControl', 'global'), {
      id: 'global',
      status: 'active',
      targetClass: 'all',
      endedAtMs: 0,
      note: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
