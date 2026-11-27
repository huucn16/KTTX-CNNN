import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogOut,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { TOPICS } from '../data/questions';
import { doesExamControlMatchClass } from '../services/gradeSync';
import { ExamControlState, Question, QuizConfig, SubmitReason } from '../types/quiz';
import { formatDuration, getDifficultyLabel } from '../utils/storage';

const MAX_LEAVE_WARNINGS = 5;

interface QuizRunnerProps {
  config: QuizConfig;
  questions: Question[];
  examControl: ExamControlState | null;
  onSubmit: (payload: {
    answers: Record<string, number | null>;
    flaggedIds: string[];
    durationUsedSeconds: number;
    leaveWarnings: number;
    submitReason: SubmitReason;
  }) => void;
  onExit: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const QuizRunner: React.FC<QuizRunnerProps> = ({
  config,
  questions,
  examControl,
  onSubmit,
  onExit,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | null>>(() => {
    const initial: Record<string, number | null> = {};
    for (const q of questions) {
      initial[q.id] = null;
    }
    return initial;
  });
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [leaveWarnings, setLeaveWarnings] = useState(0);
  const [showLeaveWarningModal, setShowLeaveWarningModal] = useState(false);

  const answersRef = useRef(answers);
  const flaggedIdsRef = useRef(flaggedIds);
  const elapsedSecondsRef = useRef(elapsedSeconds);
  const onSubmitRef = useRef(onSubmit);
  const submittedRef = useRef(false);
  const leaveWarningsRef = useRef(0);
  const isAwayRef = useRef(false);
  const lastViolationAtRef = useRef(0);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    flaggedIdsRef.current = flaggedIds;
  }, [flaggedIds]);

  useEffect(() => {
    elapsedSecondsRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  const currentQuestion = questions[currentIndex];
  const isExamMode = config.mode === 'timed';
  const isTimed = isExamMode && config.durationSeconds > 0;
  const remainingSeconds = isTimed ? Math.max(0, config.durationSeconds - elapsedSeconds) : 0;
  const isLowTime = isTimed && remainingSeconds <= 120;

  const answeredCount = questions.filter((q) => answers[q.id] !== null && answers[q.id] !== undefined).length;
  const unansweredCount = questions.length - answeredCount;

  const submitExam = useCallback((reason: SubmitReason, warningsOverride?: number) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmitRef.current({
      answers: answersRef.current,
      flaggedIds: flaggedIdsRef.current,
      durationUsedSeconds: elapsedSecondsRef.current,
      leaveWarnings: warningsOverride ?? leaveWarningsRef.current,
      submitReason: reason,
    });
  }, []);

  const handleConfirmSubmit = useCallback(() => {
    submitExam('manual');
  }, [submitExam]);

  // Timer tick
  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Auto-submit when countdown hits 0
  useEffect(() => {
    if (isTimed && elapsedSeconds >= config.durationSeconds) {
      submitExam('timeout');
    }
  }, [isTimed, elapsedSeconds, config.durationSeconds, submitExam]);

  // Auto-submit immediately when teacher proactively ends the exam from Gradebook
  useEffect(() => {
    if (!isExamMode) return;
    if (doesExamControlMatchClass(examControl, config.studentClass)) {
      setShowSubmitModal(false);
      setShowExitModal(false);
      setShowLeaveWarningModal(false);
      submitExam('teacher-ended');
    }
  }, [isExamMode, examControl, config.studentClass, submitExam]);

  // Detect leaving the exam screen during timed tests: warn immediately, auto-submit on 5th warning
  useEffect(() => {
    if (!isExamMode) return;

    let blurTimer: number | undefined;

    const clearBlurTimer = () => {
      if (blurTimer !== undefined) {
        window.clearTimeout(blurTimer);
        blurTimer = undefined;
      }
    };

    const registerLeaveViolation = () => {
      if (submittedRef.current || isAwayRef.current) return;
      const now = Date.now();
      if (now - lastViolationAtRef.current < 800) return;

      isAwayRef.current = true;
      lastViolationAtRef.current = now;

      const nextCount = leaveWarningsRef.current + 1;
      leaveWarningsRef.current = nextCount;
      setLeaveWarnings(nextCount);

      if (nextCount >= MAX_LEAVE_WARNINGS) {
        setShowSubmitModal(false);
        setShowExitModal(false);
        setShowLeaveWarningModal(false);
        submitExam('auto-leave', nextCount);
      } else {
        setShowLeaveWarningModal(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearBlurTimer();
        registerLeaveViolation();
      } else if (document.visibilityState === 'visible') {
        clearBlurTimer();
        isAwayRef.current = false;
      }
    };

    const handleWindowBlur = () => {
      clearBlurTimer();
      blurTimer = window.setTimeout(() => {
        if (!document.hasFocus() || document.visibilityState === 'hidden') {
          registerLeaveViolation();
        }
      }, 150);
    };

    const handleWindowFocus = () => {
      clearBlurTimer();
      isAwayRef.current = false;
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearBlurTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isExamMode, submitExam]);

  const handleSelectOption = useCallback(
    (optionIdx: number) => {
      if (!currentQuestion) return;
      // In practice mode, lock answer once selected so user reads explanation cleanly
      if (config.mode === 'practice' && answers[currentQuestion.id] !== null) {
        return;
      }
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: optionIdx,
      }));
    },
    [currentQuestion, config.mode, answers]
  );

  const toggleFlag = useCallback(() => {
    if (!currentQuestion) return;
    setFlaggedIds((prev) =>
      prev.includes(currentQuestion.id)
        ? prev.filter((id) => id !== currentQuestion.id)
        : [...prev, currentQuestion.id]
    );
  }, [currentQuestion]);

  // Keyboard shortcuts (1-4 / A-D to answer, ArrowLeft/ArrowRight to navigate)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showSubmitModal || showExitModal || showLeaveWarningModal) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleSelectOption(Number(e.key) - 1);
      } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
        const idx = e.key.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && idx <= 3) {
          e.preventDefault();
          handleSelectOption(idx);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [questions.length, handleSelectOption, showSubmitModal, showExitModal, showLeaveWarningModal]);

  if (!currentQuestion) return null;

  const topicInfo = TOPICS.find((t) => t.id === currentQuestion.topicId);
  const selectedOption = answers[currentQuestion.id];
  const isFlagged = flaggedIds.includes(currentQuestion.id);
  const showInstantFeedback = config.mode === 'practice' && selectedOption !== null;
  const isCurrentCorrect = selectedOption === currentQuestion.correctIndex;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Top Quiz Context Strip */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-emerald-800">
            {config.mode === 'timed' ? 'Kiểm tra tính giờ' : 'Ôn luyện giải thích trực tiếp'}
            {config.studentName ? ` · Thí sinh: ${config.studentName}` : ''}
            {config.studentClass ? ` · Lớp ${config.studentClass}` : ''}
          </p>
          <h1 className="mt-0.5 font-display text-xl font-bold text-slate-900 truncate">
            {config.title}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowExitModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span>Thoát bài làm</span>
        </button>
      </div>

      {/* Two-Zone Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left Zone: Active Question Stage (65-70%) */}
        <section aria-label="Nội dung câu hỏi" className="lg:col-span-8 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            {/* Clean unboxed metadata header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-mono-tabular font-semibold text-slate-900">
                  Câu {String(currentIndex + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
                </span>
                <span aria-hidden="true">·</span>
                <span>{getDifficultyLabel(currentQuestion.difficulty)}</span>
                <span aria-hidden="true">·</span>
                <span>{currentQuestion.grade}</span>
                {topicInfo && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{topicInfo.shortTitle}</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={toggleFlag}
                aria-pressed={isFlagged}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  isFlagged
                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isFlagged ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại'}</span>
              </button>
            </div>

            {/* Question Stem */}
            <h2 className="mt-6 text-lg font-semibold leading-relaxed text-slate-900 sm:text-xl">
              {currentQuestion.question}
            </h2>

            {/* Options List */}
            <div className="mt-6 space-y-3" role="radiogroup" aria-label="Các phương án trả lời">
              {currentQuestion.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isRightOption = idx === currentQuestion.correctIndex;

                let containerStyle =
                  'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-800';
                let letterStyle = 'border-slate-300 bg-slate-50 text-slate-700';

                if (showInstantFeedback) {
                  if (isRightOption) {
                    containerStyle = 'border-emerald-600 bg-emerald-50/60 text-slate-900';
                    letterStyle = 'border-emerald-700 bg-emerald-700 text-white';
                  } else if (isSelected && !isRightOption) {
                    containerStyle = 'border-rose-500 bg-rose-50/60 text-slate-900';
                    letterStyle = 'border-rose-600 bg-rose-600 text-white';
                  } else {
                    containerStyle = 'border-slate-200 bg-white text-slate-500';
                  }
                } else if (isSelected) {
                  containerStyle = 'border-emerald-700 bg-emerald-50/60 text-slate-900';
                  letterStyle = 'border-emerald-700 bg-emerald-700 text-white';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleSelectOption(idx)}
                    className={`flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${containerStyle}`}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono-tabular text-xs font-semibold transition-colors ${letterStyle}`}
                    >
                      {OPTION_LETTERS[idx]}
                    </span>
                    <span className="flex-1 text-sm sm:text-base leading-relaxed">{opt}</span>

                    {showInstantFeedback && isRightOption && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 shrink-0 mt-1">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>Đáp án đúng</span>
                      </span>
                    )}
                    {showInstantFeedback && isSelected && !isRightOption && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 shrink-0 mt-1">
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        <span>Bạn chọn sai</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Instant Practice Explanation */}
            {showInstantFeedback && (
              <div
                className={`mt-6 rounded-xl border p-4 sm:p-5 ${
                  isCurrentCorrect
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-amber-200 bg-amber-50/50'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {isCurrentCorrect ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      <span className="text-emerald-900">Chính xác</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-rose-700" aria-hidden="true" />
                      <span className="text-slate-900">
                        Chưa chính xác · Đáp án đúng là {OPTION_LETTERS[currentQuestion.correctIndex]}
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {currentQuestion.explanation}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Căn cứ kiến thức: {currentQuestion.reference}
                </p>
              </div>
            )}

            {/* Navigation Footer inside Card */}
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
              <button
                type="button"
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 whitespace-nowrap hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Câu trước</span>
              </button>

              <p className="hidden sm:block text-xs text-slate-400">
                Phím tắt: A–D hoặc 1–4 để chọn · ← / → để chuyển câu
              </p>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap hover:bg-emerald-800 transition-colors"
                >
                  <span>Câu tiếp theo</span>
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap hover:bg-emerald-800 transition-colors"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>Nộp bài kiểm tra</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right Zone: Control & Question Palette Deck (30-35%) */}
        <aside aria-label="Bảng điều khiển bài thi" className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          {/* Timer & Progress */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <span>{isTimed ? 'Thời gian còn lại' : 'Thời gian đã làm'}</span>
              </span>
              {isLowTime && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sắp hết giờ</span>
                </span>
              )}
            </div>

            <div
              className={`font-mono-tabular text-3xl font-bold tracking-tight ${
                isLowTime ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {isTimed ? formatDuration(remainingSeconds) : formatDuration(elapsedSeconds)}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span>Tiến độ trả lời</span>
                <span className="font-mono-tabular font-semibold text-slate-900">
                  {answeredCount} / {questions.length} câu
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-emerald-700 transition-transform duration-200 origin-left"
                  style={{
                    transform: `scaleX(${questions.length > 0 ? answeredCount / questions.length : 0})`,
                  }}
                />
              </div>
            </div>

            {isExamMode && (
              <div
                className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                  leaveWarnings > 0
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert
                      className={`h-3.5 w-3.5 shrink-0 ${
                        leaveWarnings > 0 ? 'text-rose-600' : 'text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span>Giám sát màn hình làm bài</span>
                  </span>
                  <span className="font-mono-tabular font-semibold">
                    {leaveWarnings}/{MAX_LEAVE_WARNINGS}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug opacity-90">
                  {leaveWarnings > 0
                    ? `Đã cảnh báo ${leaveWarnings} lần. Đủ ${MAX_LEAVE_WARNINGS} lần hệ thống sẽ tự thu bài.`
                    : `Không thoát khỏi màn hình khi làm bài. Cảnh báo ${MAX_LEAVE_WARNINGS} lần hệ thống tự thu bài.`}
                </p>
              </div>
            )}
          </div>

          {/* Question Palette */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Phiếu câu hỏi</h3>
              <span className="text-xs text-slate-500 tabular-nums">
                Còn {unansweredCount} câu chưa làm
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answers[q.id] !== null && answers[q.id] !== undefined;
                const flagged = flaggedIds.includes(q.id);

                let btnClass = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300';
                if (isAnswered) {
                  btnClass = 'border-emerald-700 bg-emerald-700 text-white';
                }
                if (flagged && !isAnswered) {
                  btnClass = 'border-amber-400 bg-amber-50 text-amber-900';
                }
                if (isCurrent) {
                  btnClass += ' ring-2 ring-slate-900 ring-offset-2';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Câu ${idx + 1}${isAnswered ? ', đã trả lời' : ', chưa trả lời'}${
                      flagged ? ', đã đánh dấu' : ''
                    }`}
                    className={`relative flex h-10 items-center justify-center rounded-lg border font-mono-tabular text-xs font-semibold transition-colors ${btnClass}`}
                  >
                    <span>{idx + 1}</span>
                    {flagged && (
                      <Bookmark
                        className={`absolute -top-1 -right-1 h-3 w-3 ${
                          isAnswered ? 'text-amber-300 fill-amber-300' : 'text-amber-600 fill-amber-500'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Dual-coded legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-700 text-white">
                  <Check className="h-2.5 w-2.5" aria-hidden="true" />
                </span>
                <span>Đã trả lời</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-amber-400 bg-amber-50 text-amber-700">
                  <Bookmark className="h-2.5 w-2.5" aria-hidden="true" />
                </span>
                <span>Xem lại</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-4 w-4 rounded border border-slate-300 bg-white" />
                <span>Chưa làm</span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowSubmitModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              <span>Nộp bài và xem điểm</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="submit-dialog-title" className="font-display text-lg font-bold text-slate-900">
              Xác nhận nộp bài kiểm tra?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Bạn đã hoàn thành <strong className="font-mono-tabular text-slate-900">{answeredCount}/{questions.length}</strong> câu hỏi.
              {unansweredCount > 0
                ? ` Hiện vẫn còn ${unansweredCount} câu chưa chọn đáp án.`
                : ' Tất cả câu hỏi đều đã có đáp án.'}
              {flaggedIds.length > 0 ? ` Có ${flaggedIds.length} câu đang được đánh dấu xem lại.` : ''}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Kiểm tra lại
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Nộp bài ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 id="exit-dialog-title" className="font-display text-lg font-bold text-slate-900">
              Thoát khỏi bài kiểm tra hiện tại?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Kết quả đang làm sẽ không được lưu vào lịch sử điểm nếu bạn thoát trước khi nộp bài.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Thoát bài làm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Screen Warning Modal */}
      {showLeaveWarningModal && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="leave-warning-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-rose-500 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <ShieldAlert className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-0.5 font-mono-tabular text-xs font-bold text-rose-800 border border-rose-200">
                  Cảnh báo lần {leaveWarnings} / {MAX_LEAVE_WARNINGS}
                </p>
                <h2
                  id="leave-warning-title"
                  className="mt-2 font-display text-lg font-bold text-slate-900"
                >
                  Quay lại làm bài ngay!
                </h2>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Hệ thống phát hiện bạn vừa thoát khỏi màn hình làm bài kiểm tra. Vui lòng tập trung làm
              bài và không chuyển tab hoặc rời khỏi cửa sổ thi.
            </p>

            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-950">
              Cảnh báo đủ <strong className="font-bold">{MAX_LEAVE_WARNINGS} lần</strong> hệ thống sẽ
              tự động thu bài ngay lập tức (còn{' '}
              <strong className="font-mono-tabular font-bold">
                {Math.max(0, MAX_LEAVE_WARNINGS - leaveWarnings)}
              </strong>{' '}
              lần nhắc nhở).
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLeaveWarningModal(false)}
                className="w-full rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition-colors sm:w-auto"
              >
                Quay lại làm bài ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
