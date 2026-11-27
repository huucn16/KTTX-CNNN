import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { AlertCircle, CheckCircle2, GraduationCap, UserCheck, X } from 'lucide-react';
import { BUILTIN_QUESTIONS, TOPICS } from './data/questions';
import { auth, googleProvider } from './firebase';
import { Header } from './components/Header';
import { HistoryView } from './components/HistoryView';
import { HomeDashboard } from './components/HomeDashboard';
import { QuizResultView } from './components/QuizResultView';
import { QuizRunner } from './components/QuizRunner';
import { WrongStatsView } from './components/WrongStatsView';
import {
  checkIsTeacherUser,
  deleteSavedExamFromArchive,
  deleteTeacherSubmission,
  dequeuePendingAttempt,
  doesExamControlMatchClass,
  enqueuePendingAttempt,
  findExistingTimedSubmission,
  loadPendingAttempts,
  reopenExamState,
  saveExamToCloudArchive,
  setExamEndedState,
  subscribeExamControl,
  subscribeSavedExams,
  subscribeTeacherSubmissions,
  syncAttemptToTeacher,
} from './services/gradeSync';
import {
  AppView,
  ExamControlState,
  GradeLevel,
  Question,
  QuizAttempt,
  QuizConfig,
  ShuffleMode,
  SubmitReason,
  TopicId,
} from './types/quiz';
import {
  buildTimedAttemptKey,
  clearAttempts,
  loadAttempts,
  loadLocalSavedExams,
  loadStudentClass,
  loadStudentName,
  loadTimedExamRegistry,
  normalizeIdentityKey,
  pruneDeletedSyncedFromRegistry,
  recordTimedExamCompletion,
  removeLocalSavedExam,
  saveAttempt,
  saveLocalExam,
  saveStudentClass,
  saveStudentName,
  shuffleArray,
  updateAttemptSyncStatus,
  updateTimedExamSyncStatus,
} from './utils/storage';

function shuffleQuestionOptions(q: Question): Question {
  const indexed = q.options.map((opt, idx) => ({
    opt,
    isCorrect: idx === q.correctIndex,
  }));
  const shuffled = shuffleArray(indexed);
  const newCorrect = shuffled.findIndex((item) => item.isCorrect) as 0 | 1 | 2 | 3;
  return {
    ...q,
    options: [shuffled[0].opt, shuffled[1].opt, shuffled[2].opt, shuffled[3].opt],
    correctIndex: newCorrect,
  };
}

function parseShuffleParam(raw: string | null): {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
} {
  const mode = (raw || 'ca-hai').trim() as ShuffleMode;
  switch (mode) {
    case 'cau-hoi':
      return { shuffleQuestions: true, shuffleOptions: false };
    case 'dap-an':
      return { shuffleQuestions: false, shuffleOptions: true };
    case 'khong':
      return { shuffleQuestions: false, shuffleOptions: false };
    case 'ca-hai':
    default:
      return { shuffleQuestions: true, shuffleOptions: true };
  }
}

function pickBalanced10Questions(pool: Question[]): Question[] {
  const nb = shuffleArray(pool.filter((q) => q.difficulty === 'nhan-biet')).slice(0, 4);
  const th = shuffleArray(pool.filter((q) => q.difficulty === 'thong-hieu')).slice(0, 3);
  const vd = shuffleArray(pool.filter((q) => q.difficulty === 'van-dung')).slice(0, 3);
  const combined = [...nb, ...th, ...vd];
  if (combined.length >= 10) return combined;
  const usedIds = new Set(combined.map((q) => q.id));
  const extra = shuffleArray(pool.filter((q) => !usedIds.has(q.id))).slice(0, 10 - combined.length);
  return [...combined, ...extra];
}

type PendingLaunch =
  | { type: 'config'; config: QuizConfig }
  | { type: 'wrong'; questions: Question[] };

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [attempts, setAttempts] = useState<QuizAttempt[]>(() => loadAttempts());
  const [studentName, setStudentName] = useState<string>(() => loadStudentName());
  const [studentClass, setStudentClass] = useState<string>(() => loadStudentClass());

  const [pendingLaunch, setPendingLaunch] = useState<PendingLaunch | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalClass, setModalClass] = useState('');
  const [modalError, setModalError] = useState('');

  const handleStudentNameChange = (name: string) => {
    setStudentName(name);
    saveStudentName(name);
  };

  const handleStudentClassChange = (cls: string) => {
    setStudentClass(cls);
    saveStudentClass(cls);
  };

  const [activeQuiz, setActiveQuiz] = useState<{
    config: QuizConfig;
    questions: Question[];
    startedAt: string;
  } | null>(null);
  const [lastConfig, setLastConfig] = useState<QuizConfig | null>(null);
  const [viewingAttempt, setViewingAttempt] = useState<QuizAttempt | null>(null);

  const [teacherUser, setTeacherUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isTeacherAuthorized, setIsTeacherAuthorized] = useState(false);
  const [syncedAttempts, setSyncedAttempts] = useState<QuizAttempt[]>([]);
  const [hasLoadedSynced, setHasLoadedSynced] = useState(false);
  const [timedRegistry, setTimedRegistry] = useState<QuizAttempt[]>(() => loadTimedExamRegistry());
  const [cloudSavedExams, setCloudSavedExams] = useState<QuizAttempt[]>([]);
  const [localSavedExams, setLocalSavedExams] = useState<QuizAttempt[]>(() =>
    loadLocalSavedExams()
  );
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncReconnectKey, setSyncReconnectKey] = useState(0);
  const [teacherError, setTeacherError] = useState('');
  const [examControl, setExamControl] = useState<ExamControlState | null>(null);
  const [examEndedNotice, setExamEndedNotice] = useState<string | null>(null);
  const [duplicateAttemptNotice, setDuplicateAttemptNotice] = useState<QuizAttempt | null>(null);
  const launchingRef = useRef(false);

  const syncSingleAttempt = useCallback(async (attempt: QuizAttempt) => {
    try {
      await syncAttemptToTeacher(attempt, BUILTIN_QUESTIONS);
      dequeuePendingAttempt(attempt.id);
      const updatedList = updateAttemptSyncStatus(attempt.id, 'synced');
      setAttempts(updatedList);
      setTimedRegistry(updateTimedExamSyncStatus(attempt.id, 'synced'));
      setViewingAttempt((prev) =>
        prev && prev.id === attempt.id ? { ...prev, syncStatus: 'synced' } : prev
      );
    } catch {
      enqueuePendingAttempt(attempt);
      const updatedList = updateAttemptSyncStatus(attempt.id, 'error');
      setAttempts(updatedList);
      setTimedRegistry(updateTimedExamSyncStatus(attempt.id, 'error'));
      setViewingAttempt((prev) =>
        prev && prev.id === attempt.id ? { ...prev, syncStatus: 'error' } : prev
      );
    }
  }, []);

  // Retry any unsynced submissions on startup and when coming back online
  useEffect(() => {
    const flushPending = () => {
      const pending = loadPendingAttempts();
      for (const item of pending) {
        void syncSingleAttempt(item);
      }
    };
    flushPending();
    window.addEventListener('online', flushPending);
    return () => window.removeEventListener('online', flushPending);
  }, [syncSingleAttempt]);

  // Watch Firebase Auth state for synced gradebook & teacher exam control
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setTeacherUser(user);
      setTeacherError('');
      if (!user) {
        setIsTeacherAuthorized(false);
        setAuthReady(true);
        return;
      }
      try {
        const authorized = await checkIsTeacherUser(user);
        if (!active) return;
        setIsTeacherAuthorized(authorized);
      } catch {
        if (!active) return;
        setIsTeacherAuthorized(false);
      } finally {
        if (active) setAuthReady(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Subscribe to real-time synced student submissions & saved exams in Firestore
  useEffect(() => {
    if (!authReady) {
      return;
    }
    let active = true;
    let retryTimer: number | null = null;

    const scheduleReconnect = () => {
      if (!active || retryTimer !== null) return;
      retryTimer = window.setTimeout(() => {
        if (active) {
          setSyncReconnectKey((k) => k + 1);
        }
      }, 4000);
    };

    const handleOnline = () => {
      if (active) {
        setSyncReconnectKey((k) => k + 1);
      }
    };
    window.addEventListener('online', handleOnline);

    setSyncLoading(true);
    const unsubSubmissions = subscribeTeacherSubmissions(
      BUILTIN_QUESTIONS,
      (list) => {
        if (!active) return;
        setSyncedAttempts(list);
        setHasLoadedSynced(true);
        setTimedRegistry(pruneDeletedSyncedFromRegistry(new Set(list.map((a) => a.id))));
        setSyncLoading(false);
        setTeacherError('');
      },
      () => {
        if (!active) return;
        setSyncLoading(false);
        setTeacherError('Kết nối đồng bộ tạm gián đoạn, hệ thống đang tự kết nối lại...');
        scheduleReconnect();
      }
    );
    const unsubSaved = subscribeSavedExams(
      BUILTIN_QUESTIONS,
      (list) => {
        if (!active) return;
        setCloudSavedExams(list);
      },
      () => {
        if (!active) return;
        scheduleReconnect();
      }
    );
    return () => {
      active = false;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      window.removeEventListener('online', handleOnline);
      unsubSubmissions();
      unsubSaved();
    };
  }, [authReady, syncReconnectKey]);

  const mergedAttempts = useMemo(() => {
    const byId = new Map<string, QuizAttempt>();
    for (const item of attempts) {
      byId.set(item.id, item);
    }
    for (const synced of syncedAttempts) {
      const local = byId.get(synced.id);
      byId.set(synced.id, local ? { ...synced, syncStatus: 'synced' } : synced);
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  }, [attempts, syncedAttempts]);

  const mergedSavedExams = useMemo(() => {
    const byId = new Map<string, QuizAttempt>();
    for (const item of localSavedExams) {
      byId.set(item.id, item);
    }
    for (const cloudItem of cloudSavedExams) {
      byId.set(cloudItem.id, { ...cloudItem, syncStatus: 'synced' });
    }
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );
  }, [localSavedExams, cloudSavedExams]);

  const syncedAttemptIds = useMemo(() => syncedAttempts.map((a) => a.id), [syncedAttempts]);
  const syncedIdSet = useMemo(() => new Set(syncedAttemptIds), [syncedAttemptIds]);

  const findExistingTimedAttemptLocal = useCallback(
    (name: string, cls: string, title: string): QuizAttempt | null => {
      const targetKey = buildTimedAttemptKey(name, cls, title);
      for (const item of syncedAttempts) {
        if (
          item.mode === 'timed' &&
          buildTimedAttemptKey(item.studentName || '', item.studentClass || '', item.title) ===
            targetKey
        ) {
          return item;
        }
      }
      for (const item of timedRegistry) {
        if (hasLoadedSynced && item.syncStatus === 'synced' && !syncedIdSet.has(item.id)) {
          continue;
        }
        if (
          item.mode === 'timed' &&
          buildTimedAttemptKey(item.studentName || '', item.studentClass || '', item.title) ===
            targetKey
        ) {
          return item;
        }
      }
      for (const item of attempts) {
        if (hasLoadedSynced && item.syncStatus === 'synced' && !syncedIdSet.has(item.id)) {
          continue;
        }
        if (
          item.mode === 'timed' &&
          buildTimedAttemptKey(item.studentName || '', item.studentClass || '', item.title) ===
            targetKey
        ) {
          return item;
        }
      }
      return null;
    },
    [syncedAttempts, timedRegistry, attempts, hasLoadedSynced, syncedIdSet]
  );

  const completedTimedTitles = useMemo(() => {
    const normName = normalizeIdentityKey(studentName);
    const normClass = normalizeIdentityKey(studentClass);
    if (!normName || !normClass) return [];

    const titles = new Set<string>();
    const collect = (list: QuizAttempt[], respectCloudPrune: boolean) => {
      for (const item of list) {
        if (item.mode !== 'timed') continue;
        if (respectCloudPrune && hasLoadedSynced && item.syncStatus === 'synced' && !syncedIdSet.has(item.id)) {
          continue;
        }
        if (
          normalizeIdentityKey(item.studentName || '') === normName &&
          normalizeIdentityKey(item.studentClass || '') === normClass
        ) {
          titles.add(item.title);
        }
      }
    };

    collect(syncedAttempts, false);
    collect(timedRegistry, true);
    collect(attempts, true);
    return Array.from(titles);
  }, [studentName, studentClass, syncedAttempts, timedRegistry, attempts, hasLoadedSynced, syncedIdSet]);

  const handleTeacherSignIn = async (): Promise<boolean> => {
    setTeacherError('');
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const ok = await checkIsTeacherUser(cred.user);
      setIsTeacherAuthorized(ok);
      if (!ok) {
        setTeacherError(
          `Tài khoản ${cred.user.email || ''} chưa được cấp quyền quản trị giáo viên.`
        );
      }
      return ok;
    } catch {
      setTeacherError('Đăng nhập Google chưa hoàn tất. Vui lòng thử lại.');
      return false;
    }
  };

  const handleTeacherSignOut = async () => {
    setTeacherError('');
    await signOut(auth);
    setIsTeacherAuthorized(false);
  };

  const handleSaveExam = async (attempt: QuizAttempt) => {
    setTeacherError('');
    const updatedLocal = saveLocalExam(attempt);
    setLocalSavedExams(updatedLocal);
    if (isTeacherAuthorized && teacherUser?.uid) {
      try {
        await saveExamToCloudArchive(attempt, BUILTIN_QUESTIONS, teacherUser.uid);
      } catch {
        setTeacherError('Đã lưu bài thi trên máy, nhưng chưa đồng bộ được lên kho đám mây.');
      }
    }
  };

  const handleRemoveSavedExam = async (attemptId: string) => {
    setTeacherError('');
    const updatedLocal = removeLocalSavedExam(attemptId);
    setLocalSavedExams(updatedLocal);
    if (isTeacherAuthorized && cloudSavedExams.some((item) => item.id === attemptId)) {
      try {
        await deleteSavedExamFromArchive(attemptId);
      } catch {
        setTeacherError('Không thể xóa bài thi khỏi kho lưu trữ đám mây.');
      }
    }
  };

  const handleDeleteSyncedAttempt = async (attemptId: string) => {
    setTeacherError('');
    try {
      await deleteTeacherSubmission(attemptId);
    } catch {
      setTeacherError('Không thể xóa bài nộp đồng bộ. Vui lòng thử lại.');
    }
  };

  // Listen to global teacher exam control state (ended / active)
  useEffect(() => {
    const unsubscribe = subscribeExamControl((state) => {
      setExamControl(state);
    });
    return () => unsubscribe();
  }, []);

  const handleEndExam = async (targetClass: string, note: string) => {
    setTeacherError('');
    try {
      await setExamEndedState(targetClass, note);
    } catch {
      setTeacherError('Không thể cập nhật trạng thái kết thúc bài thi. Vui lòng thử lại.');
    }
  };

  const handleReopenExam = async () => {
    setTeacherError('');
    try {
      await reopenExamState();
    } catch {
      setTeacherError('Không thể mở lại bài thi mới. Vui lòng thử lại.');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deParam = (params.get('de') || '').trim();
    const lopParam = (params.get('lop') || '').trim();
    const tronParam = params.get('tron');

    if (!deParam) {
      return;
    }

    const initialName = loadStudentName().trim();
    const initialClass = (lopParam || loadStudentClass()).trim();
    if (lopParam) {
      setStudentClass(lopParam);
      saveStudentClass(lopParam);
    }

    const { shuffleQuestions, shuffleOptions } = parseShuffleParam(tronParam);

    let deepConfig: QuizConfig | null = null;
    const examMatch = /^(cn10-c[1-8]|cn11-c[1-6]|cn12-c(?:[1-9]|10))-e([1-5])$/.exec(deParam);
    const topicMixMatch = /^(cn10-c[1-8]|cn11-c[1-6]|cn12-c(?:[1-9]|10))-tron$/.exec(deParam);
    const gradeMixMatch = /^(cn10|cn11|cn12)-all-tron$/.exec(deParam);

    if (examMatch) {
      const topicId = examMatch[1] as TopicId;
      const examNum = Number(examMatch[2]) as 1 | 2 | 3 | 4 | 5;
      const topic = TOPICS.find((t) => t.id === topicId);
      const count = BUILTIN_QUESTIONS.filter(
        (q) => q.topicId === topicId && q.examNumber === examNum
      ).length;

      if (topic && count > 0) {
        deepConfig = {
          title: `${topic.shortTitle} · Đề ${examNum}`,
          mode: 'timed',
          grade: topic.grade,
          topicIds: [topic.id],
          examNumber: examNum,
          shuffleQuestions,
          shuffleOptions,
          difficulty: 'all',
          questionCount: count,
          durationSeconds: 15 * 60,
          studentName: initialName,
          studentClass: initialClass,
        };
      }
    } else if (topicMixMatch) {
      const topicId = topicMixMatch[1] as TopicId;
      const topic = TOPICS.find((t) => t.id === topicId);
      const poolCount = BUILTIN_QUESTIONS.filter((q) => q.topicId === topicId).length;

      if (topic && poolCount > 0) {
        deepConfig = {
          title: `${topic.shortTitle} · Đề trộn ngẫu nhiên`,
          mode: 'timed',
          grade: topic.grade,
          topicIds: [topic.id],
          isBalancedMix: true,
          shuffleQuestions,
          shuffleOptions,
          difficulty: 'all',
          questionCount: Math.min(10, poolCount),
          durationSeconds: 15 * 60,
          studentName: initialName,
          studentClass: initialClass,
        };
      }
    } else if (gradeMixMatch) {
      const gradeMap: Record<string, GradeLevel> = {
        cn10: 'Công nghệ 10',
        cn11: 'Công nghệ 11',
        cn12: 'Công nghệ 12',
      };
      const grade = gradeMap[gradeMixMatch[1]];
      const gradeTopics = TOPICS.filter((t) => t.grade === grade);
      if (grade && gradeTopics.length > 0) {
        deepConfig = {
          title: `Kiểm tra 15 phút · Đề trộn ${grade}`,
          mode: 'timed',
          grade,
          topicIds: gradeTopics.map((t) => t.id),
          isBalancedMix: true,
          shuffleQuestions,
          shuffleOptions,
          difficulty: 'all',
          questionCount: 10,
          durationSeconds: 15 * 60,
          studentName: initialName,
          studentClass: initialClass,
        };
      }
    }

    window.history.replaceState({}, '', window.location.pathname);

    if (deepConfig) {
      setModalName(initialName);
      setModalClass(initialClass);
      setModalError('');
      setPendingLaunch({ type: 'config', config: deepConfig });
    }
  }, []);

  const launchQuizNow = async (config: QuizConfig) => {
    if (launchingRef.current) return;
    launchingRef.current = true;

    try {
      if (config.mode === 'timed' && doesExamControlMatchClass(examControl, config.studentClass)) {
        setExamEndedNotice(
          examControl?.note ||
            'Giáo viên đã kết thúc bài thi này trước giờ quy định. Vui lòng chờ giáo viên mở lại lượt thi mới.'
        );
        return;
      }

      if (config.mode === 'timed') {
        const localExisting = findExistingTimedAttemptLocal(
          config.studentName,
          config.studentClass,
          config.title
        );
        if (localExisting) {
          setDuplicateAttemptNotice(localExisting);
          return;
        }

        try {
          const cloudExisting = await findExistingTimedSubmission(
            config.studentName,
            config.studentClass,
            config.title,
            BUILTIN_QUESTIONS
          );
          if (cloudExisting) {
            setTimedRegistry(recordTimedExamCompletion(cloudExisting));
            setDuplicateAttemptNotice(cloudExisting);
            return;
          }
        } catch {
          // Allow launch if offline and no local duplicate exists
        }
      }

      const difficultyRank: Record<Question['difficulty'], number> = {
        'nhan-biet': 0,
        'thong-hieu': 1,
        'van-dung': 2,
      };

      let selectedRaw: Question[] = [];

      if (config.questionIds && config.questionIds.length > 0) {
        const idSet = new Set(config.questionIds);
        selectedRaw = BUILTIN_QUESTIONS.filter((q) => idSet.has(q.id)).sort(
          (a, b) => difficultyRank[a.difficulty] - difficultyRank[b.difficulty]
        );
      } else if (config.examNumber) {
        selectedRaw = BUILTIN_QUESTIONS.filter((q) => {
          const gradeOk = !config.grade || config.grade === 'all' || q.grade === config.grade;
          const topicOk = config.topicIds.includes(q.topicId);
          const examOk = q.examNumber === config.examNumber;
          return gradeOk && topicOk && examOk;
        }).sort((a, b) => difficultyRank[a.difficulty] - difficultyRank[b.difficulty]);
      } else if (config.isBalancedMix) {
        const pool = BUILTIN_QUESTIONS.filter((q) => {
          const gradeOk = !config.grade || config.grade === 'all' || q.grade === config.grade;
          const topicOk = config.topicIds.includes(q.topicId);
          return gradeOk && topicOk;
        });
        selectedRaw = pickBalanced10Questions(pool).sort(
          (a, b) => difficultyRank[a.difficulty] - difficultyRank[b.difficulty]
        );
      } else {
        const pool = BUILTIN_QUESTIONS.filter((q) => {
          const gradeOk = !config.grade || config.grade === 'all' || q.grade === config.grade;
          const topicOk = config.topicIds.includes(q.topicId);
          const diffOk = config.difficulty === 'all' || q.difficulty === config.difficulty;
          return gradeOk && topicOk && diffOk;
        });
        selectedRaw = shuffleArray(pool).slice(0, config.questionCount);
      }

      const shouldShuffleQuestions = config.shuffleQuestions !== false;
      const shouldShuffleOptions = config.shuffleOptions !== false;

      const orderedQuestions = shouldShuffleQuestions ? shuffleArray(selectedRaw) : selectedRaw;
      const selected = shouldShuffleOptions
        ? orderedQuestions.map(shuffleQuestionOptions)
        : orderedQuestions;

      if (selected.length === 0) return;

      setLastConfig(config);
      setActiveQuiz({
        config,
        questions: selected,
        startedAt: new Date().toISOString(),
      });
      setActiveView('quiz');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      launchingRef.current = false;
    }
  };

  const launchWrongQuestionsNow = (
    wrongQuestions: Question[],
    resolvedName: string,
    resolvedClass: string
  ) => {
    if (wrongQuestions.length === 0) return;
    const selected = shuffleArray(wrongQuestions).map(shuffleQuestionOptions);
    const config: QuizConfig = {
      title: `Ôn luyện lại các câu hay sai (${selected.length} câu)`,
      mode: 'practice',
      grade: 'all',
      topicIds: TOPICS.map((t) => t.id),
      difficulty: 'all',
      questionCount: selected.length,
      durationSeconds: 0,
      studentName: resolvedName,
      studentClass: resolvedClass,
    };
    setLastConfig(config);
    setActiveQuiz({
      config,
      questions: selected,
      startedAt: new Date().toISOString(),
    });
    setActiveView('quiz');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openIdentityModal = (launch: PendingLaunch, initialName: string, initialClass: string) => {
    setModalName(initialName);
    setModalClass(initialClass);
    setModalError('');
    setPendingLaunch(launch);
  };

  const startQuiz = (config: QuizConfig) => {
    const resolvedName = (config.studentName || studentName).trim();
    const resolvedClass = (config.studentClass || studentClass).trim();

    if (!resolvedName || !resolvedClass) {
      openIdentityModal(
        {
          type: 'config',
          config: { ...config, studentName: resolvedName, studentClass: resolvedClass },
        },
        resolvedName,
        resolvedClass
      );
      return;
    }

    void launchQuizNow({
      ...config,
      studentName: resolvedName,
      studentClass: resolvedClass,
    });
  };

  const handlePracticeWrongQuestions = (wrongQuestions: Question[]) => {
    if (wrongQuestions.length === 0) return;
    const resolvedName = studentName.trim();
    const resolvedClass = studentClass.trim();

    if (!resolvedName || !resolvedClass) {
      openIdentityModal(
        { type: 'wrong', questions: wrongQuestions },
        resolvedName,
        resolvedClass
      );
      return;
    }

    launchWrongQuestionsNow(wrongQuestions, resolvedName, resolvedClass);
  };

  const handleQuickStart15Min = () => {
    if (activeQuiz) {
      setActiveView('quiz');
      return;
    }
    startQuiz({
      title: 'Kiểm tra 15 phút · Tổng hợp Công nghệ 10, 11 & 12',
      mode: 'timed',
      grade: 'all',
      topicIds: TOPICS.map((t) => t.id),
      isBalancedMix: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      difficulty: 'all',
      questionCount: 10,
      durationSeconds: 15 * 60,
      studentName: studentName.trim(),
      studentClass: studentClass.trim(),
    });
  };

  const handleConfirmIdentityModal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = modalName.trim();
    const trimmedClass = modalClass.trim();

    if (!trimmedName || !trimmedClass) {
      setModalError('Vui lòng nhập đầy đủ Họ và tên và Lớp trước khi vào làm bài.');
      return;
    }

    handleStudentNameChange(trimmedName);
    handleStudentClassChange(trimmedClass);

    const launch = pendingLaunch;
    setPendingLaunch(null);
    setModalError('');

    if (!launch) return;
    if (launch.type === 'config') {
      void launchQuizNow({
        ...launch.config,
        studentName: trimmedName,
        studentClass: trimmedClass,
      });
    } else {
      launchWrongQuestionsNow(launch.questions, trimmedName, trimmedClass);
    }
  };

  const handleSubmitQuiz = ({
    answers,
    flaggedIds,
    durationUsedSeconds,
    leaveWarnings,
    submitReason,
  }: {
    answers: Record<string, number | null>;
    flaggedIds: string[];
    durationUsedSeconds: number;
    leaveWarnings?: number;
    submitReason?: SubmitReason;
  }) => {
    if (!activeQuiz) return;

    if (activeQuiz.config.mode === 'timed') {
      const existing = findExistingTimedAttemptLocal(
        activeQuiz.config.studentName,
        activeQuiz.config.studentClass,
        activeQuiz.config.title
      );
      if (existing) {
        setActiveQuiz(null);
        setViewingAttempt(existing);
        setActiveView('result');
        setDuplicateAttemptNotice(existing);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    const totalCount = activeQuiz.questions.length;
    const correctCount = activeQuiz.questions.reduce((acc, q) => {
      return acc + (answers[q.id] === q.correctIndex ? 1 : 0);
    }, 0);

    const score10 = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) / 10 : 0;

    const attempt: QuizAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: activeQuiz.config.title,
      studentName: activeQuiz.config.studentName,
      studentClass: activeQuiz.config.studentClass,
      mode: activeQuiz.config.mode,
      grade: activeQuiz.config.grade,
      topicIds: activeQuiz.config.topicIds,
      startedAt: activeQuiz.startedAt,
      completedAt: new Date().toISOString(),
      durationUsedSeconds,
      durationLimitSeconds: activeQuiz.config.durationSeconds,
      questions: activeQuiz.questions,
      answers,
      flaggedIds,
      correctCount,
      totalCount,
      score10,
      leaveWarnings,
      submitReason,
      syncStatus: 'pending',
    };

    const updated = saveAttempt(attempt);
    setAttempts(updated);
    if (attempt.mode === 'timed') {
      setTimedRegistry(recordTimedExamCompletion(attempt));
    }
    setActiveQuiz(null);
    setViewingAttempt(attempt);
    setActiveView('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    void syncSingleAttempt(attempt);
  };

  const handleClearHistory = () => {
    clearAttempts();
    setAttempts([]);
  };

  const handleNavigate = (view: AppView) => {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      <Header
        activeView={activeView}
        isQuizActive={Boolean(activeQuiz)}
        onNavigate={handleNavigate}
        onQuickStart15Min={handleQuickStart15Min}
      />

      <div className="flex-1">
        {activeView === 'home' && (
          <HomeDashboard
            questions={BUILTIN_QUESTIONS}
            studentName={studentName}
            studentClass={studentClass}
            completedTimedTitles={completedTimedTitles}
            onStudentNameChange={handleStudentNameChange}
            onStudentClassChange={handleStudentClassChange}
            onStartQuiz={startQuiz}
          />
        )}

        {activeView === 'history' && (
          <HistoryView
            attempts={mergedAttempts}
            savedExams={mergedSavedExams}
            syncedAttemptIds={syncedAttemptIds}
            syncLoading={syncLoading}
            teacherUser={teacherUser}
            isTeacherAuthorized={isTeacherAuthorized}
            teacherError={teacherError}
            examControl={examControl}
            onTeacherSignIn={handleTeacherSignIn}
            onTeacherSignOut={handleTeacherSignOut}
            onEndExam={handleEndExam}
            onReopenExam={handleReopenExam}
            onViewAttempt={(attempt) => {
              setViewingAttempt(attempt);
              setActiveView('result');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSaveExam={handleSaveExam}
            onRemoveSavedExam={handleRemoveSavedExam}
            onRetrySyncAttempt={(attempt) => {
              const updatedList = updateAttemptSyncStatus(attempt.id, 'pending');
              setAttempts(updatedList);
              void syncSingleAttempt({ ...attempt, syncStatus: 'pending' });
            }}
            onDeleteSyncedAttempt={handleDeleteSyncedAttempt}
            onClearHistory={handleClearHistory}
            onStartQuickQuiz={handleQuickStart15Min}
          />
        )}

        {activeView === 'wrong-stats' && (
          <WrongStatsView
            attempts={attempts}
            onPracticeWrongQuestions={handlePracticeWrongQuestions}
            onStartQuickQuiz={handleQuickStart15Min}
          />
        )}

        {activeView === 'quiz' && activeQuiz && (
          <QuizRunner
            config={activeQuiz.config}
            questions={activeQuiz.questions}
            examControl={examControl}
            onSubmit={handleSubmitQuiz}
            onExit={() => {
              setActiveQuiz(null);
              handleNavigate('home');
            }}
          />
        )}

        {activeView === 'result' && viewingAttempt && (
          <QuizResultView
            attempt={viewingAttempt}
            onRetrySync={() => {
              const pendingItem = { ...viewingAttempt, syncStatus: 'pending' as const };
              setViewingAttempt(pendingItem);
              void syncSingleAttempt(pendingItem);
            }}
            onRetakeSameConfig={() => {
              if (lastConfig) {
                startQuiz(lastConfig);
              } else {
                startQuiz({
                  title: viewingAttempt.title,
                  mode: viewingAttempt.mode,
                  grade: viewingAttempt.grade || 'all',
                  topicIds: viewingAttempt.topicIds,
                  difficulty: 'all',
                  questionCount: viewingAttempt.totalCount,
                  durationSeconds: viewingAttempt.durationLimitSeconds,
                  studentName: studentName.trim(),
                  studentClass: studentClass.trim(),
                });
              }
            }}
            onBackHome={() => handleNavigate('home')}
          />
        )}
      </div>

      {/* Required Student Identity Modal when launching from Header / History / WrongStats */}
      {pendingLaunch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="identity-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="identity-modal-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Thông tin học sinh bắt buộc
                </h2>
                {pendingLaunch.type === 'config' && (
                  <p className="mt-1 text-xs font-semibold text-emerald-800">
                    Đề được giao: {pendingLaunch.config.title}
                    {pendingLaunch.config.shuffleQuestions !== false &&
                    pendingLaunch.config.shuffleOptions !== false
                      ? ' · Đã bật trộn câu hỏi & đáp án'
                      : pendingLaunch.config.shuffleQuestions !== false
                      ? ' · Đã bật trộn thứ tự câu hỏi'
                      : pendingLaunch.config.shuffleOptions !== false
                      ? ' · Đã bật trộn đáp án A–D'
                      : ''}
                  </p>
                )}
                <p className="mt-1 text-xs text-slate-600">
                  Vui lòng nhập đầy đủ Họ tên và Lớp để ghi nhận kết quả vào Bảng điểm trước khi
                  làm bài.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingLaunch(null)}
                aria-label="Đóng hộp thoại"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmIdentityModal} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="modal-student-name"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700"
                >
                  <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Họ và tên học sinh</span>
                  <span className="text-rose-600" aria-hidden="true">*</span>
                </label>
                <input
                  id="modal-student-name"
                  type="text"
                  autoFocus
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
                />
              </div>

              <div>
                <label
                  htmlFor="modal-student-class"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700"
                >
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Lớp</span>
                  <span className="text-rose-600" aria-hidden="true">*</span>
                </label>
                <input
                  id="modal-student-class"
                  type="text"
                  value={modalClass}
                  onChange={(e) => setModalClass(e.target.value)}
                  placeholder="Ví dụ: 11A2"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
                />
              </div>

              {modalError && (
                <p
                  role="alert"
                  className="flex items-center gap-1.5 text-xs font-medium text-rose-700"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{modalError}</span>
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingLaunch(null)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Xác nhận và vào làm bài
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exam Ended Notice Dialog */}
      {examEndedNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="exam-ended-notice-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-300 bg-white p-6 shadow-xl">
            <h2
              id="exam-ended-notice-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              Bài thi đã kết thúc
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{examEndedNotice}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setExamEndedNotice(null)}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single-Attempt Enforcement Dialog */}
      {duplicateAttemptNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="duplicate-attempt-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-emerald-300 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div className="space-y-2">
                <h2
                  id="duplicate-attempt-title"
                  className="font-display text-lg font-bold text-slate-900"
                >
                  Bạn đã hoàn thành bài kiểm tra này
                </h2>
                <p className="text-sm leading-relaxed text-slate-700">
                  Mỗi học sinh chỉ được làm bài kiểm tra này 1 lần. Hệ thống đã ghi nhận bài nộp
                  của{' '}
                  <span className="font-semibold text-slate-900">
                    {duplicateAttemptNotice.studentName || 'Học sinh'}
                  </span>
                  {duplicateAttemptNotice.studentClass
                    ? ` (Lớp ${duplicateAttemptNotice.studentClass})`
                    : ''}{' '}
                  cho đề{' '}
                  <span className="font-semibold text-slate-900">
                    {duplicateAttemptNotice.title}
                  </span>
                  .
                </p>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
                  Kết quả đã ghi nhận:{' '}
                  <span className="font-mono-tabular font-bold text-emerald-800">
                    {duplicateAttemptNotice.score10.toFixed(1)} / 10
                  </span>{' '}
                  ({duplicateAttemptNotice.correctCount}/{duplicateAttemptNotice.totalCount} câu đúng)
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDuplicateAttemptNotice(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = duplicateAttemptNotice;
                  setDuplicateAttemptNotice(null);
                  setViewingAttempt(target);
                  setActiveView('result');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Xem lại bài đã nộp
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-12 border-t border-slate-200 bg-white no-print">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>GVBM: Trần Văn Hữu · Hệ thống kiểm tra trắc nghiệm thường xuyên Công nghệ 10, 11 & 12</p>
          <p>Điểm làm bài được lưu và đồng bộ trực tiếp về thẻ Bảng điểm.</p>
        </div>
      </footer>
    </div>
  );
}
