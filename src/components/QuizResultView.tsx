import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Bookmark,
  CheckCircle2,
  CloudCheck,
  CloudOff,
  FileDown,
  Printer,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { TOPICS } from '../data/questions';
import { DifficultyLevel, QuizAttempt, TopicId } from '../types/quiz';
import { downloadStudentExamDoc } from '../utils/exportExam';
import { formatDuration, getDifficultyLabel, getGradeRank } from '../utils/storage';

interface QuizResultViewProps {
  attempt: QuizAttempt;
  onRetakeSameConfig: () => void;
  onRetrySync?: () => void;
  onBackHome: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const QuizResultView: React.FC<QuizResultViewProps> = ({
  attempt,
  onRetakeSameConfig,
  onRetrySync,
  onBackHome,
}) => {
  const [filter, setFilter] = useState<'all' | 'wrong' | 'flagged'>('all');

  const rank = getGradeRank(attempt.score10);

  const breakdownByDifficulty = useMemo(() => {
    const levels: DifficultyLevel[] = ['nhan-biet', 'thong-hieu', 'van-dung'];
    return levels.map((lvl) => {
      const qs = attempt.questions.filter((q) => q.difficulty === lvl);
      const right = qs.filter((q) => attempt.answers[q.id] === q.correctIndex).length;
      return { level: lvl, label: getDifficultyLabel(lvl), total: qs.length, right };
    }).filter((item) => item.total > 0);
  }, [attempt]);

  const breakdownByTopic = useMemo(() => {
    const map = new Map<TopicId, { title: string; total: number; right: number }>();
    for (const q of attempt.questions) {
      const topic = TOPICS.find((t) => t.id === q.topicId);
      const prev = map.get(q.topicId) || {
        title: topic?.shortTitle || q.topicId,
        total: 0,
        right: 0,
      };
      prev.total += 1;
      if (attempt.answers[q.id] === q.correctIndex) {
        prev.right += 1;
      }
      map.set(q.topicId, prev);
    }
    return Array.from(map.entries()).map(([id, val]) => ({ id, ...val }));
  }, [attempt]);

  const filteredQuestions = useMemo(() => {
    return attempt.questions
      .map((q, idx) => ({ q, index: idx }))
      .filter(({ q }) => {
        if (filter === 'wrong') {
          return attempt.answers[q.id] !== q.correctIndex;
        }
        if (filter === 'flagged') {
          return attempt.flaggedIds.includes(q.id);
        }
        return true;
      });
  }, [attempt, filter]);

  const wrongCount = attempt.questions.filter(
    (q) => attempt.answers[q.id] !== q.correctIndex
  ).length;

  const rankToneClasses: Record<typeof rank.tone, string> = {
    emerald: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    sky: 'text-sky-800 bg-sky-50 border-sky-200',
    amber: 'text-amber-900 bg-amber-50 border-amber-200',
    rose: 'text-rose-800 bg-rose-50 border-rose-200',
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Về danh sách đề kiểm tra</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => downloadStudentExamDoc(attempt)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 whitespace-nowrap hover:bg-emerald-100 transition-colors"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Lưu bài thi (.doc)</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 whitespace-nowrap hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>In phiếu kết quả</span>
          </button>
          {attempt.mode === 'timed' ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 whitespace-nowrap">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>Đã hoàn thành (mỗi HS chỉ làm 1 lần)</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onRetakeSameConfig}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap hover:bg-emerald-800 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Làm đề mới tương tự</span>
            </button>
          )}
        </div>
      </div>

      {/* Score Summary Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-500">
              Phiếu kết quả kiểm tra · {new Date(attempt.completedAt).toLocaleString('vi-VN')}
            </p>
            <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
              {attempt.title}
            </h1>
            <p className="text-sm text-slate-600">
              {attempt.studentName ? `Học sinh: ${attempt.studentName}` : ''}
              {attempt.studentClass ? ` · Lớp: ${attempt.studentClass}` : ''}
              {attempt.studentName || attempt.studentClass ? ' · ' : ''}
              Thời gian làm bài:{' '}
              <span className="font-mono-tabular font-medium text-slate-900">
                {formatDuration(attempt.durationUsedSeconds)}
              </span>
            </p>
            <p className="pt-1 text-sm text-slate-700">{rank.comment}</p>
            {(attempt.leaveWarnings ?? 0) > 0 && attempt.submitReason !== 'auto-leave' && (
              <p className="text-xs font-medium text-amber-800">
                Cảnh báo thoát màn hình khi làm bài: {attempt.leaveWarnings}/5 lần
              </p>
            )}
          </div>

          <div className="flex items-center gap-5 rounded-xl border border-slate-200 bg-slate-50/70 px-6 py-5 shrink-0">
            <div>
              <p className="text-xs font-medium text-slate-500">Điểm số (thang 10)</p>
              <p className="mt-1 font-mono-tabular text-4xl font-bold text-slate-900">
                {attempt.score10.toFixed(1)}
              </p>
              <p className="mt-1 font-mono-tabular text-xs text-slate-600">
                Đúng {attempt.correctCount}/{attempt.totalCount} câu
              </p>
            </div>
            <div className="h-12 w-px bg-slate-200" aria-hidden="true" />
            <div className={`rounded-lg border px-3.5 py-2 text-center ${rankToneClasses[rank.tone]}`}>
              <Award className="mx-auto h-5 w-5 mb-1" aria-hidden="true" />
              <p className="text-xs font-semibold whitespace-nowrap">{rank.label}</p>
            </div>
          </div>
        </div>

        {attempt.submitReason === 'auto-leave' && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
            <span>
              Hệ thống đã tự động thu bài do thí sinh thoát khỏi màn hình làm bài đủ 5 lần.
            </span>
          </div>
        )}

        {attempt.submitReason === 'timeout' && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>Đã hết thời gian làm bài, hệ thống tự động thu bài.</span>
          </div>
        )}

        {attempt.submitReason === 'teacher-ended' && (
          <div
            role="status"
            className="mt-5 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-950"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
            <span>
              Giáo viên đã chủ động kết thúc bài thi trước giờ quy định. Hệ thống đã thu bài và ghi
              nhận điểm số của bạn.
            </span>
          </div>
        )}

        {attempt.syncStatus && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs no-print">
            {attempt.syncStatus === 'synced' ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                <CloudCheck className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                <span>Điểm số đã được đồng bộ về thẻ Bảng điểm.</span>
              </span>
            ) : attempt.syncStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-700" aria-hidden="true" />
                <span>Đang đồng bộ điểm số về thẻ Bảng điểm...</span>
              </span>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                  <CloudOff className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <span>Chưa đồng bộ được về Bảng điểm (đã lưu trên máy).</span>
                </span>
                {onRetrySync && (
                  <button
                    type="button"
                    onClick={onRetrySync}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-50 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                    <span>Đồng bộ lại</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Breakdown Grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-slate-100 pt-6 md:grid-cols-2">
          {/* By Difficulty */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Phân tích theo mức độ nhận thức
            </h2>
            <div className="space-y-2.5">
              {breakdownByDifficulty.map((item) => {
                const pct = Math.round((item.right / item.total) * 100);
                return (
                  <div key={item.level} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-mono-tabular text-slate-600">
                        {item.right}/{item.total} câu ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Topic */}
          <div>
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Phân tích theo chuyên đề
            </h2>
            <div className="space-y-2.5">
              {breakdownByTopic.map((item) => {
                const pct = Math.round((item.right / item.total) * 100);
                return (
                  <div key={item.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.title}</span>
                      <span className="font-mono-tabular text-slate-600">
                        {item.right}/{item.total} câu ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-slate-800"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Answer Review List */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900">
            Chi tiết đáp án & Giải thích kiến thức
          </h2>

          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 no-print">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({attempt.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('wrong')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === 'wrong' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Câu chưa đúng ({wrongCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('flagged')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === 'flagged' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đánh dấu ({attempt.flaggedIds.length})
            </button>
          </div>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Không có câu hỏi nào thuộc mục lọc này.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map(({ q, index }) => {
              const userChoice = attempt.answers[q.id];
              const isCorrect = userChoice === q.correctIndex;
              const isUnanswered = userChoice === null || userChoice === undefined;
              const isFlagged = attempt.flaggedIds.includes(q.id);
              const topic = TOPICS.find((t) => t.id === q.topicId);

              return (
                <article
                  key={q.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 print-break-inside-avoid"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono-tabular font-semibold text-slate-900">
                        Câu {index + 1}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{getDifficultyLabel(q.difficulty)}</span>
                      {topic && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{topic.shortTitle}</span>
                        </>
                      )}
                      {isFlagged && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                            <Bookmark className="h-3 w-3" aria-hidden="true" />
                            <span>Đã đánh dấu</span>
                          </span>
                        </>
                      )}
                    </div>

                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        <span>Trả lời đúng</span>
                      </span>
                    ) : isUnanswered ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                        <AlertCircle className="h-4 w-4" aria-hidden="true" />
                        <span>Chưa trả lời</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        <span>Trả lời sai</span>
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-base font-semibold text-slate-900 leading-relaxed">
                    {q.question}
                  </h3>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.options.map((opt, oIdx) => {
                      const isRightOpt = oIdx === q.correctIndex;
                      const isUserOpt = oIdx === userChoice;

                      let cls = 'border-slate-200 bg-white text-slate-600';
                      if (isRightOpt) {
                        cls = 'border-emerald-600 bg-emerald-50/70 text-slate-900 font-medium';
                      } else if (isUserOpt && !isRightOpt) {
                        cls = 'border-rose-400 bg-rose-50/70 text-rose-900';
                      }

                      return (
                        <div
                          key={oIdx}
                          className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${cls}`}
                        >
                          <span className="font-mono-tabular font-semibold shrink-0">
                            {OPTION_LETTERS[oIdx]}.
                          </span>
                          <span className="flex-1">{opt}</span>
                          {isRightOpt && (
                            <CheckCircle2
                              className="h-4 w-4 shrink-0 text-emerald-700 mt-0.5"
                              aria-label="Đáp án đúng"
                            />
                          )}
                          {isUserOpt && !isRightOpt && (
                            <XCircle
                              className="h-4 w-4 shrink-0 text-rose-600 mt-0.5"
                              aria-label="Lựa chọn của bạn"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">Giải thích: </span>
                      {q.explanation}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Nguồn: {q.reference}</p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
