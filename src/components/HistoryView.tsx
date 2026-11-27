import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowRight,
  BarChart3,
  BookmarkCheck,
  BookmarkPlus,
  Clock,
  CloudCheck,
  Download,
  FileDown,
  LogIn,
  LogOut,
  PlayCircle,
  RefreshCw,
  Search,
  StopCircle,
  Trash2,
} from 'lucide-react';
import { ExamControlState, QuizAttempt } from '../types/quiz';
import { downloadBatchExamsDoc, downloadStudentExamDoc } from '../utils/exportExam';
import { formatDuration, getGradeRank } from '../utils/storage';

interface HistoryViewProps {
  attempts: QuizAttempt[];
  savedExams: QuizAttempt[];
  syncedAttemptIds: string[];
  syncLoading: boolean;
  teacherUser: User | null;
  isTeacherAuthorized: boolean;
  teacherError: string;
  examControl: ExamControlState | null;
  onTeacherSignIn: () => Promise<boolean>;
  onTeacherSignOut: () => Promise<void>;
  onEndExam: (targetClass: string, note: string) => Promise<void>;
  onReopenExam: () => Promise<void>;
  onViewAttempt: (attempt: QuizAttempt) => void;
  onSaveExam: (attempt: QuizAttempt) => Promise<void>;
  onRemoveSavedExam: (attemptId: string) => Promise<void>;
  onRetrySyncAttempt: (attempt: QuizAttempt) => void;
  onDeleteSyncedAttempt: (attemptId: string) => Promise<void>;
  onClearHistory: () => void;
  onStartQuickQuiz: () => void;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  attempts,
  savedExams,
  syncedAttemptIds,
  syncLoading,
  teacherUser,
  isTeacherAuthorized,
  teacherError,
  examControl,
  onTeacherSignIn,
  onTeacherSignOut,
  onEndExam,
  onReopenExam,
  onViewAttempt,
  onSaveExam,
  onRemoveSavedExam,
  onRetrySyncAttempt,
  onDeleteSyncedAttempt,
  onClearHistory,
  onStartQuickQuiz,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [showEndExamModal, setShowEndExamModal] = useState(false);
  const [endTargetClass, setEndTargetClass] = useState<string>('all');
  const [endNote, setEndNote] = useState('Giáo viên đã kết thúc bài thi trước giờ quy định.');
  const [examActionPending, setExamActionPending] = useState(false);

  const [viewFilter, setViewFilter] = useState<'all' | 'saved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const syncedIdSet = useMemo(() => new Set(syncedAttemptIds), [syncedAttemptIds]);
  const savedIdSet = useMemo(() => new Set(savedExams.map((item) => item.id)), [savedExams]);

  const activeSourceList = viewFilter === 'saved' ? savedExams : attempts;

  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const item of activeSourceList) {
      const cls = (item.studentClass || '').trim();
      if (cls) set.add(cls);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [activeSourceList]);

  const filteredAttempts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeSourceList.filter((item) => {
      const classOk =
        selectedClass === 'all' || (item.studentClass || '').trim() === selectedClass;
      if (!classOk) return false;
      if (!q) return true;
      const haystack = `${item.studentName || ''} ${item.studentClass || ''} ${item.title || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [activeSourceList, searchQuery, selectedClass]);

  const summary = useMemo(() => {
    const source = filteredAttempts;
    const totalAttempts = source.length;
    if (totalAttempts === 0) {
      return {
        totalAttempts: 0,
        avgScoreText: '—',
        accuracyPctText: '—',
        totalRight: 0,
        totalAsked: 0,
        highest: 0,
        recent10: [] as QuizAttempt[],
      };
    }

    const scores = source.map((a) => a.score10);
    const highest = Math.max(...scores);
    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const totalRight = source.reduce((acc, a) => acc + a.correctCount, 0);
    const totalAsked = source.reduce((acc, a) => acc + a.totalCount, 0);
    const accuracyPct = totalAsked > 0 ? Math.round((totalRight / totalAsked) * 100) : 0;
    const recent10 = [...source].slice(0, 10).reverse();

    return {
      totalAttempts,
      avgScoreText: `${avg.toFixed(1)} / 10`,
      accuracyPctText: `${accuracyPct}%`,
      totalRight,
      totalAsked,
      highest,
      recent10,
    };
  }, [filteredAttempts]);

  const handleConfirmEndExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setExamActionPending(true);
    try {
      if (!isTeacherAuthorized) {
        const ok = await onTeacherSignIn();
        if (!ok) return;
      }
      await onEndExam(endTargetClass, endNote);
      setShowEndExamModal(false);
    } finally {
      setExamActionPending(false);
    }
  };

  const handleReopenExamClick = async () => {
    setExamActionPending(true);
    try {
      if (!isTeacherAuthorized) {
        const ok = await onTeacherSignIn();
        if (!ok) return;
      }
      await onReopenExam();
    } finally {
      setExamActionPending(false);
    }
  };

  const handleExportCsv = () => {
    const header = [
      'Họ và tên',
      'Lớp',
      'Bài kiểm tra',
      'Chế độ',
      'Số câu đúng',
      'Tổng số câu',
      'Điểm (10)',
      'Xếp loại',
      'Thời gian làm (giây)',
      'Cảnh báo thoát màn hình',
      'Thời điểm nộp',
    ];
    const rows = filteredAttempts.map((a) => [
      a.studentName || '',
      a.studentClass || '',
      a.title,
      a.mode === 'timed' ? 'Kiểm tra tính giờ' : 'Ôn luyện',
      a.correctCount,
      a.totalCount,
      a.score10.toFixed(1),
      getGradeRank(a.score10).label,
      a.durationUsedSeconds,
      a.leaveWarnings ?? 0,
      new Date(a.completedAt).toLocaleString('vi-VN'),
    ]);
    const csv =
      '\uFEFF' +
      [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bang-diem-cong-nghe-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-emerald-800">
            Nhật ký đánh giá thường xuyên
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Bảng điểm & Tiến bộ học tập
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Điểm số học sinh nộp bài tự động đồng bộ về đây, cho phép lưu trữ và tải hồ sơ bài thi hoàn chỉnh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isTeacherAuthorized ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
              <CloudCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span className="font-medium">
                {syncLoading
                  ? 'Đang đồng bộ điểm...'
                  : `GV: ${teacherUser?.email || 'Đã xác thực'}`}
              </span>
              <button
                type="button"
                onClick={() => void onTeacherSignOut()}
                className="ml-1 inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-3 w-3" aria-hidden="true" />
                <span>Đăng xuất</span>
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900">
              <CloudCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>{syncLoading ? 'Đang tải bảng điểm...' : 'Đồng bộ tự động'}</span>
            </div>
          )}

          {examControl?.status === 'ended' ? (
            <button
              type="button"
              disabled={examActionPending}
              onClick={handleReopenExamClick}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-sky-800 disabled:opacity-50 transition-colors"
            >
              <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{examActionPending ? 'Đang mở lại...' : 'Mở lại bài thi mới'}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={examActionPending}
              onClick={() => {
                setEndTargetClass('all');
                setEndNote('Giáo viên đã kết thúc bài thi trước giờ quy định.');
                setShowEndExamModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-rose-700 disabled:opacity-50 transition-colors"
            >
              <StopCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Kết thúc bài thi</span>
            </button>
          )}

          {attempts.length > 0 && (
            <div>
              {!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-rose-700 whitespace-nowrap hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Xóa lịch sử máy này</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      setConfirmClear(false);
                    }}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                  >
                    Xác nhận xóa
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {examControl?.status === 'ended' && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5 text-xs text-amber-950">
            <StopCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">
                Bài thi đã được kết thúc chủ động (
                {examControl.targetClass === 'all'
                  ? 'Tất cả các lớp'
                  : `Lớp ${examControl.targetClass}`}
                {examControl.endedAtMs > 0
                  ? ` · lúc ${new Date(examControl.endedAtMs).toLocaleTimeString('vi-VN')}`
                  : ''}
                )
              </p>
              <p className="mt-0.5 text-amber-900">
                Các thiết bị đang làm bài trong phạm vi đã tự động thu bài và tạm khóa mở đề mới
                cho đến khi bấm Mở lại bài thi mới.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={examActionPending}
            onClick={handleReopenExamClick}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-sky-800 disabled:opacity-50 transition-colors"
          >
            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Mở lại bài thi mới</span>
          </button>
        </div>
      )}

      {teacherError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800"
        >
          {teacherError}
        </div>
      )}

      {/* 3 KPI Cards */}
      <section aria-label="Thống kê học tập" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            {viewFilter === 'saved' ? 'Bài thi đã lưu' : 'Bài đã hoàn thành'}
          </p>
          <p className="mt-2 font-mono-tabular text-2xl font-semibold text-slate-900">
            {summary.totalAttempts} bài
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {viewFilter === 'saved'
              ? 'Lưu trữ lâu dài hồ sơ bài làm'
              : 'Gồm bài làm đồng bộ từ các máy'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Điểm trung bình</p>
          <p className="mt-2 font-mono-tabular text-2xl font-semibold text-emerald-800">
            {summary.avgScoreText}
          </p>
          <p className="mt-1 text-xs text-slate-500">Thang điểm 10 chuẩn</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Tỉ lệ trả lời đúng</p>
          <p className="mt-2 font-mono-tabular text-2xl font-semibold text-slate-900">
            {summary.accuracyPctText}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.totalAsked > 0
              ? `Đúng ${summary.totalRight}/${summary.totalAsked} câu đã làm`
              : 'Tính trên tổng lượt làm bài'}
          </p>
        </div>
      </section>

      {attempts.length === 0 && savedExams.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-slate-300 mb-3" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Chưa có dữ liệu bảng điểm
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Khi học sinh nộp bài kiểm tra 15 phút hoặc ôn luyện, điểm số và bài thi sẽ tự động lưu
            và đồng bộ về đây.
          </p>
          <button
            type="button"
            onClick={onStartQuickQuiz}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
          >
            <span>Làm bài kiểm tra 15 phút ngay</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      ) : (
        <>
          {/* Highest Score + Score Bar Chart */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6">
              <div>
                <p className="text-xs font-medium text-slate-500">Điểm cao nhất đạt được</p>
                <p className="mt-2 font-mono-tabular text-4xl font-bold text-slate-900">
                  {summary.totalAttempts > 0 ? `${summary.highest.toFixed(1)} / 10` : '—'}
                </p>
                <p className="mt-2 text-sm font-medium text-emerald-800">
                  Xếp loại: {summary.totalAttempts > 0 ? getGradeRank(summary.highest).label : '—'}
                </p>
              </div>
              <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-500">
                Nhấn vào cột bất kỳ trên biểu đồ để xem lại chi tiết đề và lời giải của lượt làm bài đó.
              </p>
            </div>

            <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900">
                  Biểu đồ điểm 10 lượt nộp bài gần nhất
                </h2>
                <span className="text-xs text-slate-500">Thang điểm 0 – 10</span>
              </div>

              {summary.recent10.length === 0 ? (
                <div className="flex h-44 items-center justify-center border-b border-slate-200 text-xs text-slate-500">
                  Không có bài làm phù hợp bộ lọc hiện tại.
                </div>
              ) : (
                <div className="flex h-44 items-end gap-3 border-b border-slate-200 pt-6 pb-2">
                  {summary.recent10.map((a, i) => {
                    const heightPct = Math.max(6, Math.round((a.score10 / 10) * 100));
                    return (
                      <div key={a.id} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
                        <span className="font-mono-tabular text-xs font-semibold text-slate-700">
                          {a.score10.toFixed(1)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onViewAttempt(a)}
                          title={`${a.studentName ? `${a.studentName} · ` : ''}${a.title} - ${a.score10.toFixed(1)} điểm`}
                          style={{ height: `${heightPct}%` }}
                          className={`w-full max-w-[36px] rounded-t-md transition-opacity hover:opacity-85 ${
                            a.score10 >= 8
                              ? 'bg-emerald-700'
                              : a.score10 >= 5
                              ? 'bg-slate-700'
                              : 'bg-rose-600'
                          }`}
                        />
                        <span className="font-mono-tabular text-[11px] text-slate-400">
                          #{i + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Filter + Archive/Export Toolbar */}
          <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setViewFilter('all');
                      setSelectedClass('all');
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả bài nộp ({attempts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewFilter('saved');
                      setSelectedClass('all');
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      viewFilter === 'saved'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Bài thi đã lưu ({savedExams.length})</span>
                  </button>
                </div>

                <div className="relative flex-1 min-w-[200px]">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên học sinh, lớp hoặc đề..."
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                  />
                </div>

                <select
                  aria-label="Lọc theo lớp"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-700 focus:outline-none"
                >
                  <option value="all">Tất cả các lớp ({activeSourceList.length})</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Lớp {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    downloadBatchExamsDoc(
                      filteredAttempts,
                      selectedClass === 'all' ? viewFilter : `lop-${selectedClass}`
                    )
                  }
                  disabled={filteredAttempts.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-emerald-800 disabled:opacity-50 transition-colors"
                >
                  <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Lưu hồ sơ bài thi (.doc) ({filteredAttempts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={filteredAttempts.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 whitespace-nowrap hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                  <span>Xuất CSV</span>
                </button>
              </div>
            </div>
          </section>

          {/* Attempts Table */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">Học sinh & Bài kiểm tra</th>
                    <th className="px-4 py-3.5">Chế độ</th>
                    <th className="px-4 py-3.5">Số câu đúng</th>
                    <th className="px-4 py-3.5">Thời gian</th>
                    <th className="px-4 py-3.5">Điểm (10)</th>
                    <th className="px-4 py-3.5">Xếp loại</th>
                    <th className="px-5 py-3.5 text-right">Lưu & Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-500">
                        {viewFilter === 'saved'
                          ? 'Chưa có bài thi nào được lưu trữ. Nhấn nút "Lưu bài thi" ở danh sách bài nộp để lưu hồ sơ lâu dài.'
                          : 'Không có kết quả nào khớp với điều kiện tìm kiếm.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAttempts.map((a) => {
                      const rank = getGradeRank(a.score10);
                      const isSyncedRecord = syncedIdSet.has(a.id) || a.syncStatus === 'synced';
                      const isSaved = savedIdSet.has(a.id);

                      return (
                        <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">
                              {a.studentName || 'Học sinh'}
                              {a.studentClass ? (
                                <span className="ml-1.5 text-xs font-medium text-emerald-800">
                                  · Lớp {a.studentClass}
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-600">{a.title}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                              <span>{new Date(a.completedAt).toLocaleString('vi-VN')}</span>
                              {isSyncedRecord && (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <CloudCheck className="h-3 w-3" aria-hidden="true" />
                                  <span>Đã đồng bộ</span>
                                </span>
                              )}
                              {a.syncStatus === 'error' && (
                                <button
                                  type="button"
                                  onClick={() => onRetrySyncAttempt(a)}
                                  className="inline-flex items-center gap-1 font-medium text-amber-800 hover:underline"
                                >
                                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                                  <span>Đồng bộ lại</span>
                                </button>
                              )}
                              {a.submitReason === 'auto-leave' && (
                                <span className="font-medium text-rose-700">
                                  · Thu bài do thoát màn hình
                                </span>
                              )}
                              {a.submitReason === 'teacher-ended' && (
                                <span className="font-medium text-sky-700">
                                  · GV kết thúc sớm
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-600 whitespace-nowrap">
                            {a.mode === 'timed' ? 'Kiểm tra tính giờ' : 'Ôn luyện'}
                          </td>
                          <td className="px-4 py-4 font-mono-tabular text-slate-800 whitespace-nowrap">
                            {a.correctCount}/{a.totalCount}
                          </td>
                          <td className="px-4 py-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                              <span>{formatDuration(a.durationUsedSeconds)}</span>
                            </span>
                          </td>
                          <td className="px-4 py-4 font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                            {a.score10.toFixed(1)}
                          </td>
                          <td className="px-4 py-4 text-xs font-semibold whitespace-nowrap">
                            <span
                              className={
                                rank.tone === 'emerald'
                                  ? 'text-emerald-800'
                                  : rank.tone === 'sky'
                                  ? 'text-sky-800'
                                  : rank.tone === 'amber'
                                  ? 'text-amber-800'
                                  : 'text-rose-700'
                              }
                            >
                              {rank.label}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onViewAttempt(a)}
                                className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950 transition-colors"
                              >
                                Xem bài
                              </button>

                              {viewFilter === 'saved' ? (
                                <button
                                  type="button"
                                  disabled={savingId === a.id}
                                  onClick={async () => {
                                    setSavingId(a.id);
                                    try {
                                      await onRemoveSavedExam(a.id);
                                    } finally {
                                      setSavingId(null);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 transition-colors"
                                >
                                  <span>Bỏ lưu</span>
                                </button>
                              ) : isSaved ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                  <BookmarkCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Đã lưu</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={savingId === a.id}
                                  onClick={async () => {
                                    setSavingId(a.id);
                                    try {
                                      await onSaveExam(a);
                                    } finally {
                                      setSavingId(null);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-700 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                                >
                                  <BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span>{savingId === a.id ? 'Đang lưu...' : 'Lưu bài thi'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => downloadStudentExamDoc(a)}
                                title="Tải phiếu bài thi hoàn chỉnh (.doc)"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                              >
                                <FileDown className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                                <span>Tải (.doc)</span>
                              </button>

                              {viewFilter === 'all' && isTeacherAuthorized && syncedIdSet.has(a.id) && (
                                <button
                                  type="button"
                                  disabled={deletingId === a.id}
                                  onClick={async () => {
                                    setDeletingId(a.id);
                                    try {
                                      await onDeleteSyncedAttempt(a.id);
                                    } finally {
                                      setDeletingId(null);
                                    }
                                  }}
                                  aria-label={`Xóa bài của ${a.studentName || 'học sinh'}`}
                                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* End Exam Confirmation Modal */}
      {showEndExamModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-exam-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                <StopCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="end-exam-title" className="font-display text-lg font-bold text-slate-900">
                  Kết thúc bài thi sớm?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Hệ thống sẽ lập tức thu bài trên các thiết bị học sinh đang thi và khóa mở lượt
                  thi mới cho đến khi bạn mở lại.
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmEndExam} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="end-target-class"
                  className="mb-1.5 block text-xs font-medium text-slate-700"
                >
                  Phạm vi lớp áp dụng
                </label>
                <select
                  id="end-target-class"
                  value={endTargetClass}
                  onChange={(e) => setEndTargetClass(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-700 focus:outline-none"
                >
                  <option value="all">Tất cả các lớp đang thi</option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      Chỉ lớp {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="end-exam-note"
                  className="mb-1.5 block text-xs font-medium text-slate-700"
                >
                  Thông báo gửi học sinh (tùy chọn)
                </label>
                <input
                  id="end-exam-note"
                  type="text"
                  maxLength={200}
                  value={endNote}
                  onChange={(e) => setEndNote(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              {!isTeacherAuthorized && (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                  {teacherUser
                    ? `Tài khoản ${teacherUser.email} chưa có quyền giáo viên. Bấm xác nhận để đổi sang tài khoản Google giáo viên.`
                    : 'Chỉ giáo viên được phép kết thúc bài thi. Hệ thống sẽ mở đăng nhập Google khi bạn xác nhận.'}
                </p>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEndExamModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={examActionPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {!isTeacherAuthorized && <LogIn className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span>
                    {examActionPending
                      ? 'Đang xử lý...'
                      : isTeacherAuthorized
                      ? 'Xác nhận kết thúc bài thi'
                      : 'Đăng nhập GV & Kết thúc bài thi'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
