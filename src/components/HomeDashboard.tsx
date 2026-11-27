import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Play,
  QrCode,
  Shuffle,
  UserCheck,
} from 'lucide-react';
import { TEXTBOOKS, TOPICS } from '../data/questions';
import {
  GradeLevel,
  Question,
  QuizConfig,
  ShuffleMode,
  TopicInfo,
} from '../types/quiz';
import { normalizeIdentityKey } from '../utils/storage';
import { QrAssignModal, QrShareTarget } from './QrAssignModal';

interface HomeDashboardProps {
  questions: Question[];
  studentName: string;
  studentClass: string;
  completedTimedTitles?: string[];
  onStudentNameChange: (name: string) => void;
  onStudentClassChange: (studentClass: string) => void;
  onStartQuiz: (config: QuizConfig) => void;
}

const GRADE_TABS: { value: GradeLevel; label: string; subtitle: string }[] = [
  { value: 'Công nghệ 10', label: 'Công nghệ 10', subtitle: 'Công nghệ Trồng trọt' },
  { value: 'Công nghệ 11', label: 'Công nghệ 11', subtitle: 'Công nghệ Chăn nuôi' },
  { value: 'Công nghệ 12', label: 'Công nghệ 12', subtitle: 'Lâm nghiệp – Thuỷ sản' },
];

function shuffleModeToFlags(mode: ShuffleMode): {
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
} {
  switch (mode) {
    case 'ca-hai':
      return { shuffleQuestions: true, shuffleOptions: true };
    case 'cau-hoi':
      return { shuffleQuestions: true, shuffleOptions: false };
    case 'dap-an':
      return { shuffleQuestions: false, shuffleOptions: true };
    case 'khong':
      return { shuffleQuestions: false, shuffleOptions: false };
  }
}

function getGradeSlug(grade: GradeLevel): 'cn10' | 'cn11' | 'cn12' {
  if (grade === 'Công nghệ 10') return 'cn10';
  if (grade === 'Công nghệ 11') return 'cn11';
  return 'cn12';
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  questions,
  studentName,
  studentClass,
  completedTimedTitles = [],
  onStudentNameChange,
  onStudentClassChange,
  onStartQuiz,
}) => {
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>('Công nghệ 10');
  const [attemptedStart, setAttemptedStart] = useState(false);
  const [qrTarget, setQrTarget] = useState<QrShareTarget | null>(null);

  const completedTitleSet = useMemo(
    () => new Set(completedTimedTitles.map((t) => normalizeIdentityKey(t))),
    [completedTimedTitles]
  );

  const isQuick15MinDone = completedTitleSet.has(
    normalizeIdentityKey(`Kiểm tra 15 phút · Tổng hợp ${selectedGrade}`)
  );

  const nameInputRef = useRef<HTMLInputElement>(null);
  const classInputRef = useRef<HTMLInputElement>(null);

  const visibleTopics = useMemo(() => {
    return TOPICS.filter((t) => t.grade === selectedGrade);
  }, [selectedGrade]);

  const activeTextbook = useMemo(() => {
    return TEXTBOOKS.find((b) => b.grade === selectedGrade) ?? TEXTBOOKS[0];
  }, [selectedGrade]);

  const handleGradeChange = (grade: GradeLevel) => {
    setSelectedGrade(grade);
  };

  const isNameMissing = studentName.trim().length === 0;
  const isClassMissing = studentClass.trim().length === 0;
  const hasMissingStudentInfo = isNameMissing || isClassMissing;

  const tryStartQuiz = (config: Omit<QuizConfig, 'studentName' | 'studentClass'>) => {
    const trimmedName = studentName.trim();
    const trimmedClass = studentClass.trim();

    if (!trimmedName || !trimmedClass) {
      setAttemptedStart(true);
      const targetRef = !trimmedName ? nameInputRef : classInputRef;
      targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => targetRef.current?.focus(), 200);
      return;
    }

    setAttemptedStart(false);
    onStartQuiz({
      ...config,
      studentName: trimmedName,
      studentClass: trimmedClass,
    });
  };

  const handleStartChapterExam = (
    topic: TopicInfo,
    examNumber: 1 | 2 | 3 | 4 | 5,
    shuffleMode: ShuffleMode = 'ca-hai'
  ) => {
    const { shuffleQuestions, shuffleOptions } = shuffleModeToFlags(shuffleMode);
    tryStartQuiz({
      title: `${topic.shortTitle} · Đề ${examNumber}`,
      mode: 'timed',
      grade: topic.grade,
      topicIds: [topic.id],
      examNumber,
      shuffleQuestions,
      shuffleOptions,
      difficulty: 'all',
      questionCount: 10,
      durationSeconds: 15 * 60,
    });
  };

  const handleStartChapterMixedExam = (
    topic: TopicInfo,
    shuffleMode: ShuffleMode = 'ca-hai'
  ) => {
    const { shuffleQuestions, shuffleOptions } = shuffleModeToFlags(shuffleMode);
    tryStartQuiz({
      title: `${topic.shortTitle} · Đề trộn ngẫu nhiên`,
      mode: 'timed',
      grade: topic.grade,
      topicIds: [topic.id],
      isBalancedMix: true,
      shuffleQuestions,
      shuffleOptions,
      difficulty: 'all',
      questionCount: 10,
      durationSeconds: 15 * 60,
    });
  };

  const getShareBasePath = () => `${window.location.origin}${window.location.pathname}`;

  const handleOpenChapterExamQr = (
    topic: TopicInfo,
    examNumber: 1 | 2 | 3 | 4 | 5
  ) => {
    setQrTarget({
      title: `${topic.shortTitle} · Đề ${examNumber}`,
      meta: `${topic.grade} · 10 câu (4 Nhận biết · 3 Thông hiểu · 3 Vận dụng) · 15 phút`,
      baseUrl: `${getShareBasePath()}?de=${topic.id}-e${examNumber}`,
      filenameSlug: `${topic.id}-de-${examNumber}`,
      onStartLocalTest: (shuffleMode) => handleStartChapterExam(topic, examNumber, shuffleMode),
    });
  };

  const handleOpenChapterMixedQr = (topic: TopicInfo) => {
    setQrTarget({
      title: `${topic.shortTitle} · Đề trộn ngẫu nhiên`,
      meta: `${topic.grade} · Bốc ngẫu nhiên 10/50 câu (4 NB · 3 TH · 3 VD) · 15 phút`,
      baseUrl: `${getShareBasePath()}?de=${topic.id}-tron`,
      filenameSlug: `${topic.id}-tron-de`,
      isRandomMix: true,
      onStartLocalTest: (shuffleMode) => handleStartChapterMixedExam(topic, shuffleMode),
    });
  };

  const handleStartQuick15Min = (shuffleMode: ShuffleMode = 'ca-hai') => {
    const { shuffleQuestions, shuffleOptions } = shuffleModeToFlags(shuffleMode);
    tryStartQuiz({
      title: `Kiểm tra 15 phút · Tổng hợp ${selectedGrade}`,
      mode: 'timed',
      grade: selectedGrade,
      topicIds: visibleTopics.map((t) => t.id),
      isBalancedMix: true,
      shuffleQuestions,
      shuffleOptions,
      difficulty: 'all',
      questionCount: 10,
      durationSeconds: 15 * 60,
    });
  };

  const handleOpenQuick15MinQr = () => {
    const gradeSlug = getGradeSlug(selectedGrade);
    setQrTarget({
      title: `Kiểm tra 15 phút · Đề trộn ${selectedGrade}`,
      meta: `${selectedGrade} · Bốc ngẫu nhiên 10 câu (4 NB · 3 TH · 3 VD) · 15 phút`,
      baseUrl: `${getShareBasePath()}?de=${gradeSlug}-all-tron`,
      filenameSlug: `${gradeSlug}-de-tron-15-phut`,
      isRandomMix: true,
      onStartLocalTest: (shuffleMode) => handleStartQuick15Min(shuffleMode),
    });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-10">
      {/* Hero Section */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="w-full aspect-[16/9] sm:aspect-[2.35/1] lg:aspect-[2.5/1] bg-slate-100 border-b border-slate-200 overflow-hidden">
          <img
            src="/assets/aistudio/Gemini_Generated_Image_jzibbxjzibbxjzib_abbd8de2.png"
            alt="Kiểm tra thường xuyên môn Công nghệ Nông nghiệp - Trường THPT Tịnh Biên"
            className="h-full w-full object-cover object-center"
          />
        </div>

        <div className="p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2 max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Bộ sách Kết nối tri thức với cuộc sống · Công nghệ 10, 11 & 12
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
                Đề kiểm tra trắc nghiệm thường xuyên Môn Công nghệ Nông nghiệp
              </h1>
              <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                Hệ thống đề kiểm tra 15 phút, định kì 45 phút và luyện tập theo từng chương được biên
                soạn bám sát 3 bộ sách giáo khoa chính thức: Công nghệ Trồng trọt 10, Công nghệ Chăn
                nuôi 11 và Lâm nghiệp – Thuỷ sản 12.
              </p>
            </div>
            <p className="font-mono-tabular text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 shrink-0 self-start lg:self-end">
              24 Chương · 77 Bài học · 120 Đề chuẩn SGK
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-y border-slate-100 py-4 text-xs text-slate-600">
            {TEXTBOOKS.map((book) => (
              <button
                key={book.grade}
                type="button"
                onClick={() => handleGradeChange(book.grade)}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  selectedGrade === book.grade
                    ? 'border-emerald-700 bg-emerald-50/60 text-emerald-950'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                }`}
              >
                <p className="font-semibold text-slate-900">{book.grade}</p>
                <p className="mt-0.5 text-slate-600">{book.bookTitle}</p>
                <p className="mt-1 font-mono-tabular text-[11px] text-slate-500">
                  {book.chapterCount} Chương · {book.lessonCount} Bài
                </p>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label
                  htmlFor="student-name-input"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700"
                >
                  <UserCheck className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Họ và tên học sinh</span>
                  <span className="text-rose-600" aria-hidden="true">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  id="student-name-input"
                  type="text"
                  required
                  aria-required="true"
                  aria-invalid={attemptedStart && isNameMissing}
                  value={studentName}
                  onChange={(e) => onStudentNameChange(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    attemptedStart && isNameMissing
                      ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/15'
                      : 'border-slate-300 focus:border-emerald-700 focus:ring-emerald-700/15'
                  }`}
                />
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="student-class-input"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700"
                >
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Lớp</span>
                  <span className="text-rose-600" aria-hidden="true">*</span>
                </label>
                <input
                  ref={classInputRef}
                  id="student-class-input"
                  type="text"
                  required
                  aria-required="true"
                  aria-invalid={attemptedStart && isClassMissing}
                  value={studentClass}
                  onChange={(e) => onStudentClassChange(e.target.value)}
                  placeholder="VD: 11A2"
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
                    attemptedStart && isClassMissing
                      ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/15'
                      : 'border-slate-300 focus:border-emerald-700 focus:ring-emerald-700/15'
                  }`}
                />
              </div>

              <div className="sm:col-span-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStartQuick15Min('ca-hai')}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                    isQuick15MinDone
                      ? 'border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                      : 'bg-emerald-700 text-white hover:bg-emerald-800'
                  }`}
                >
                  {isQuick15MinDone ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                  ) : (
                    <Play className="h-4 w-4 shrink-0" />
                  )}
                  <span>{isQuick15MinDone ? 'Đã làm đề 15 phút' : 'Làm đề 15 phút'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenQuick15MinQr}
                  title={`Giao đề trộn 15 phút (${selectedGrade}) qua mã QR`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-900 whitespace-nowrap shrink-0 hover:bg-emerald-100 transition-colors"
                >
                  <QrCode className="h-4 w-4 shrink-0" />
                  <span>QR trộn đề</span>
                </button>
              </div>
            </div>

            {attemptedStart && hasMissingStudentInfo && (
              <p
                role="alert"
                className="flex items-center gap-1.5 text-xs font-medium text-rose-700"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Vui lòng nhập đầy đủ Họ và tên học sinh và Lớp trước khi vào làm bài.
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Grade Filter & Textbook Context */}
      <section className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900">
              Bộ đề kiểm tra theo sách giáo khoa
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Chọn khối lớp tương ứng với phân môn Công nghệ để lọc bộ đề chuẩn chương trình.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Chọn sách giáo khoa theo khối lớp"
            className="flex flex-wrap items-center gap-2"
          >
            {GRADE_TABS.map((tab) => {
              const isSelected = selectedGrade === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleGradeChange(tab.value)}
                  className={`rounded-lg border px-3.5 py-2 text-left transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-xs font-semibold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Textbook Details Banner */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-800">
              <BookOpen className="h-4 w-4" />
              <span>{activeTextbook.grade}</span>
              <span>·</span>
              <span>{activeTextbook.bookTitle}</span>
              <span>·</span>
              <span className="font-mono-tabular">
                {activeTextbook.chapterCount} Chương · {activeTextbook.lessonCount} Bài
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{activeTextbook.summary}</p>
          </div>
        </div>
      </section>

      {/* Structured 5 Exams per Chapter with per-exam QR codes & Chapter-wide Mixed QR across Grades 10, 11 & 12 */}
      <section className="space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              {selectedGrade === 'Công nghệ 10'
                ? 'Công nghệ Trồng trọt 10 · 8 Chương · 40 Đề kiểm tra'
                : selectedGrade === 'Công nghệ 11'
                  ? 'Công nghệ Chăn nuôi 11 · 6 Chương · 30 Đề kiểm tra'
                  : 'Lâm nghiệp – Thuỷ sản 12 · 10 Chương · 50 Đề kiểm tra'}
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-900">
              Bộ 5 đề trắc nghiệm & Trộn đề theo từng Chương SGK
            </h2>
          </div>
          <p className="font-mono-tabular text-xs text-slate-600">
            Mỗi đề 10 câu (4 Nhận biết · 3 Thông hiểu · 3 Vận dụng) · 15 phút
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleTopics.map((topic) => {
            const examsForTopic = ([1, 2, 3, 4, 5] as const).map((examNum) => {
              const count = questions.filter(
                (q) => q.topicId === topic.id && q.examNumber === examNum
              ).length;
              return { examNum, count };
            });

            return (
              <article
                key={topic.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="font-semibold text-emerald-800">{topic.code}</span>
                    <span className="font-mono-tabular">
                      {topic.lessons} · 5 đề · 10 câu/đề
                    </span>
                  </div>
                  <h3 className="mt-1.5 font-display text-base font-bold text-slate-900 leading-snug">
                    {topic.title}
                  </h3>
                  <p className="mt-1 font-mono-tabular text-xs text-slate-500">
                    Cấu trúc mỗi đề: 4 Nhận biết · 3 Thông hiểu · 3 Vận dụng · 15 phút
                  </p>
                </div>

                <div className="space-y-3 border-t border-slate-100 pt-3.5">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {examsForTopic.map(({ examNum, count }) => {
                      const examTitle = `${topic.shortTitle} · Đề ${examNum}`;
                      const isDone = completedTitleSet.has(normalizeIdentityKey(examTitle));
                      return (
                        <div
                          key={examNum}
                          className={`flex flex-col overflow-hidden rounded-lg border bg-white ${
                            isDone ? 'border-emerald-300' : 'border-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            disabled={count === 0}
                            onClick={() => handleStartChapterExam(topic, examNum, 'ca-hai')}
                            title={
                              isDone
                                ? `${topic.code} · Đề ${examNum} (Bạn đã hoàn thành đề này · bấm để xem lại)`
                                : `Làm ${topic.code} · Đề ${examNum} (${count} câu · 15 phút)`
                            }
                            className={`inline-flex min-h-[38px] items-center justify-center gap-1 px-2 py-2 text-xs font-semibold whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-40 transition-colors ${
                              isDone
                                ? 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                                : 'bg-slate-50/80 text-slate-800 hover:bg-emerald-700 hover:text-white'
                            }`}
                          >
                            {isDone && (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                            )}
                            <span>Đề {examNum}</span>
                          </button>
                          <button
                            type="button"
                            disabled={count === 0}
                            onClick={() => handleOpenChapterExamQr(topic, examNum)}
                            title={`Lấy mã QR giao ${topic.code} · Đề ${examNum} (có tùy chọn trộn đề)`}
                            aria-label={`Mã QR giao ${topic.code} Đề ${examNum}`}
                            className="inline-flex min-h-[30px] items-center justify-center gap-1 border-t border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-emerald-800 whitespace-nowrap shrink-0 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-40 transition-colors"
                          >
                            <QrCode className="h-3 w-3 shrink-0" />
                            <span>Mã QR</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Mixed Random Exam Bar for the whole Chapter */}
                  {(() => {
                    const mixedTitle = `${topic.shortTitle} · Đề trộn ngẫu nhiên`;
                    const isMixDone = completedTitleSet.has(normalizeIdentityKey(mixedTitle));
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-950">
                          <Shuffle className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                          <span>Trộn ngẫu nhiên 10/50 câu cả chương</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartChapterMixedExam(topic, 'ca-hai')}
                            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              isMixDone
                                ? 'border-emerald-300 bg-emerald-100 text-emerald-900 hover:bg-emerald-200/70'
                                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            {isMixDone && (
                              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-700" aria-hidden="true" />
                            )}
                            <span>{isMixDone ? 'Đã làm đề trộn' : 'Làm đề trộn'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenChapterMixedQr(topic)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 transition-colors"
                          >
                            <QrCode className="h-3 w-3 shrink-0" />
                            <span>Giao QR trộn đề</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <QrAssignModal target={qrTarget} onClose={() => setQrTarget(null)} />
    </main>
  );
};
