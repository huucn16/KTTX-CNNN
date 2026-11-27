import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  XCircle,
} from 'lucide-react';
import { TOPICS } from '../data/questions';
import { GradeLevel, Question, QuizAttempt } from '../types/quiz';
import { getDifficultyLabel } from '../utils/storage';

interface WrongStatsViewProps {
  attempts: QuizAttempt[];
  onPracticeWrongQuestions: (questions: Question[]) => void;
  onStartQuickQuiz: () => void;
}

interface WrongQuestionStat {
  question: Question;
  wrongCount: number;
  unansweredCount: number;
  totalSeen: number;
  errorRate: number;
  mostChosenWrongIndex: number | null;
  mostChosenWrongCount: number;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

export const WrongStatsView: React.FC<WrongStatsViewProps> = ({
  attempts,
  onPracticeWrongQuestions,
  onStartQuickQuiz,
}) => {
  const [gradeFilter, setGradeFilter] = useState<GradeLevel | 'all'>('all');
  const [sortBy, setSortBy] = useState<'count' | 'rate'>('count');
  const [showAnswers, setShowAnswers] = useState(true);

  const { allWrongStats, totalWrongAnswers, topTopicSummary } = useMemo(() => {
    const map = new Map<
      string,
      {
        question: Question;
        wrongCount: number;
        unansweredCount: number;
        totalSeen: number;
        wrongOptionCounts: Record<number, number>;
      }
    >();

    let totalWrongOccurrences = 0;

    for (const attempt of attempts) {
      for (const q of attempt.questions) {
        const chosen = attempt.answers[q.id];
        const existing = map.get(q.id) || {
          question: q,
          wrongCount: 0,
          unansweredCount: 0,
          totalSeen: 0,
          wrongOptionCounts: {},
        };

        existing.totalSeen += 1;

        if (chosen === null || chosen === undefined) {
          existing.unansweredCount += 1;
          existing.wrongCount += 1;
          totalWrongOccurrences += 1;
        } else if (chosen !== q.correctIndex) {
          existing.wrongCount += 1;
          totalWrongOccurrences += 1;
          existing.wrongOptionCounts[chosen] = (existing.wrongOptionCounts[chosen] || 0) + 1;
        }

        map.set(q.id, existing);
      }
    }

    const stats: WrongQuestionStat[] = [];
    const topicWrongCounts = new Map<string, number>();

    for (const entry of map.values()) {
      if (entry.wrongCount > 0) {
        let bestIdx: number | null = null;
        let bestCount = 0;
        for (const [optStr, cnt] of Object.entries(entry.wrongOptionCounts)) {
          if (cnt > bestCount) {
            bestCount = cnt;
            bestIdx = Number(optStr);
          }
        }

        stats.push({
          question: entry.question,
          wrongCount: entry.wrongCount,
          unansweredCount: entry.unansweredCount,
          totalSeen: entry.totalSeen,
          errorRate: Math.round((entry.wrongCount / entry.totalSeen) * 100),
          mostChosenWrongIndex: bestIdx,
          mostChosenWrongCount: bestCount,
        });

        const tId = entry.question.topicId;
        topicWrongCounts.set(tId, (topicWrongCounts.get(tId) || 0) + entry.wrongCount);
      }
    }

    let topTopicTitle = '—';
    let topTopicCount = 0;
    for (const [tId, cnt] of topicWrongCounts.entries()) {
      if (cnt > topTopicCount) {
        topTopicCount = cnt;
        const found = TOPICS.find((t) => t.id === tId);
        topTopicTitle = found ? found.shortTitle : tId;
      }
    }

    return {
      allWrongStats: stats,
      totalWrongAnswers: totalWrongOccurrences,
      topTopicSummary:
        topTopicCount > 0 ? { title: topTopicTitle, count: topTopicCount } : null,
    };
  }, [attempts]);

  const filteredStats = useMemo(() => {
    const byGrade =
      gradeFilter === 'all'
        ? allWrongStats
        : allWrongStats.filter((item) => item.question.grade === gradeFilter);

    return [...byGrade].sort((a, b) => {
      if (sortBy === 'rate') {
        if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
        return b.wrongCount - a.wrongCount;
      }
      if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
      return b.errorRate - a.errorRate;
    });
  }, [allWrongStats, gradeFilter, sortBy]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-emerald-800">
            Phân tích lỗ hổng kiến thức · Công nghệ 10, 11 & 12
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Thống kê câu sai nhiều
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Tổng hợp những câu hỏi bạn thường chọn nhầm hoặc bỏ trống qua các lần kiểm tra để tập trung ôn luyện lại.
          </p>
        </div>

        {filteredStats.length > 0 && (
          <button
            type="button"
            onClick={() =>
              onPracticeWrongQuestions(filteredStats.map((item) => item.question))
            }
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-emerald-800 transition-colors"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Ôn luyện lại {filteredStats.length} câu này</span>
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <section aria-label="Tổng quan câu sai" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Số câu từng làm sai</p>
          <p className="mt-2 font-mono-tabular text-2xl font-semibold text-slate-900">
            {allWrongStats.length} câu
          </p>
          <p className="mt-1 text-xs text-slate-500">Tổng hợp trên {attempts.length} bài đã nộp</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Tổng lượt trả lời sai</p>
          <p className="mt-2 font-mono-tabular text-2xl font-semibold text-rose-700">
            {totalWrongAnswers} lượt
          </p>
          <p className="mt-1 text-xs text-slate-500">Bao gồm cả câu chưa kịp chọn đáp án</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Chuyên đề sai nhiều nhất</p>
          <p className="mt-2 font-display text-lg font-semibold text-slate-900 truncate">
            {topTopicSummary ? topTopicSummary.title : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {topTopicSummary
              ? `${topTopicSummary.count} lượt sai ở chuyên đề này`
              : 'Chưa ghi nhận câu sai'}
          </p>
        </div>
      </section>

      {attempts.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-slate-300 mb-3" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Chưa có dữ liệu thống kê câu sai
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Hãy hoàn thành ít nhất một bài kiểm tra 15 phút để hệ thống ghi nhận và xếp hạng những câu bạn hay làm nhầm.
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
      ) : allWrongStats.length === 0 ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700 mb-3" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Tuyệt vời, bạn chưa làm sai câu nào!
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
            Tất cả câu hỏi trong {attempts.length} lượt kiểm tra vừa qua đều được trả lời chính xác 100%.
          </p>
        </section>
      ) : (
        <>
          {/* Filter & Sort Controls */}
          <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
              {(
                [
                  { id: 'all', label: 'Tất cả khối 10–12' },
                  { id: 'Công nghệ 10', label: 'Công nghệ 10' },
                  { id: 'Công nghệ 11', label: 'Công nghệ 11' },
                  { id: 'Công nghệ 12', label: 'Công nghệ 12' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setGradeFilter(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    gradeFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Sắp xếp câu sai"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'count' | 'rate')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-emerald-700 focus:outline-none"
              >
                <option value="count">Ưu tiên: Số lần sai nhiều nhất</option>
                <option value="rate">Ưu tiên: Tỉ lệ sai cao nhất (%)</option>
              </select>

              <button
                type="button"
                onClick={() => setShowAnswers((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 whitespace-nowrap hover:bg-slate-100 transition-colors"
              >
                {showAnswers ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ẩn đáp án</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Hiện đáp án</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {filteredStats.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
              Không có câu sai nào thuộc khối lớp đã chọn.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStats.map((item, idx) => {
                const { question: q } = item;
                const topic = TOPICS.find((t) => t.id === q.topicId);

                return (
                  <article
                    key={q.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono-tabular font-semibold text-slate-900">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{q.grade}</span>
                        {topic && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{topic.shortTitle}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{getDifficultyLabel(q.difficulty)}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 font-mono-tabular">
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          <span>
                            Sai {item.wrongCount}/{item.totalSeen} lượt ({item.errorRate}%)
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Error Rate Progress Bar */}
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-rose-600"
                        style={{ width: `${item.errorRate}%` }}
                      />
                    </div>

                    <h2 className="mt-4 text-base font-semibold leading-relaxed text-slate-900">
                      {q.question}
                    </h2>

                    <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {q.options.map((opt, oIdx) => {
                        const isRight = showAnswers && oIdx === q.correctIndex;
                        const isMostCommonWrong =
                          showAnswers &&
                          item.mostChosenWrongIndex === oIdx &&
                          oIdx !== q.correctIndex;

                        let cls = 'border-slate-200 bg-white text-slate-700';
                        if (isRight) {
                          cls = 'border-emerald-600 bg-emerald-50/70 font-medium text-slate-900';
                        } else if (isMostCommonWrong) {
                          cls = 'border-rose-300 bg-rose-50/60 text-rose-900';
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
                            {isRight && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 shrink-0 mt-0.5">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Đúng</span>
                              </span>
                            )}
                            {isMostCommonWrong && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 shrink-0 mt-0.5">
                                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Hay chọn nhầm ({item.mostChosenWrongCount} lần)</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {showAnswers && (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-sm text-slate-700">
                        <p>
                          <span className="font-semibold text-slate-900">Giải thích: </span>
                          {q.explanation}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">Nguồn: {q.reference}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
};
