import { QuizAttempt } from '../types/quiz';
import { formatDuration, getDifficultyLabel, getGradeRank } from './storage';

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyFileName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function formatSubmitReason(reason?: QuizAttempt['submitReason']): string {
  switch (reason) {
    case 'timeout':
      return 'Hết giờ làm bài (tự động thu bài)';
    case 'auto-leave':
      return 'Thoát màn hình 5 lần (tự động thu bài)';
    case 'teacher-ended':
      return 'Giáo viên kết thúc bài thi sớm';
    default:
      return 'Học sinh chủ động nộp bài';
  }
}

function renderExamSectionHtml(attempt: QuizAttempt, indexInBatch?: number): string {
  const rank = getGradeRank(attempt.score10);
  const studentDisplay = attempt.studentName || 'Học sinh';
  const classDisplay = attempt.studentClass || 'Chưa rõ';
  const submittedAt = new Date(attempt.completedAt).toLocaleString('vi-VN');

  const questionsHtml = attempt.questions
    .map((q, qIdx) => {
      const userChoice = attempt.answers[q.id];
      const isCorrect = userChoice === q.correctIndex;
      const isUnanswered = userChoice === null || userChoice === undefined;

      const statusBadge = isCorrect
        ? '<span style="color:#065f46;font-weight:bold;">[ĐÚNG]</span>'
        : isUnanswered
        ? '<span style="color:#92400e;font-weight:bold;">[BỎ TRỐNG]</span>'
        : '<span style="color:#9f1239;font-weight:bold;">[SAI]</span>';

      const optionsHtml = q.options
        .map((opt, oIdx) => {
          const isRight = oIdx === q.correctIndex;
          const isChosen = oIdx === userChoice;
          let mark = '';
          let bgStyle = 'background:#ffffff;border:1px solid #cbd5e1;';
          if (isRight && isChosen) {
            mark = ' &mdash; <b>[Học sinh chọn · Đáp án đúng]</b>';
            bgStyle = 'background:#ecfdf5;border:1px solid #10b981;color:#064e3b;';
          } else if (isRight) {
            mark = ' &mdash; <b>[Đáp án đúng]</b>';
            bgStyle = 'background:#ecfdf5;border:1px solid #10b981;color:#064e3b;';
          } else if (isChosen) {
            mark = ' &mdash; <b>[Học sinh chọn]</b>';
            bgStyle = 'background:#fff1f2;border:1px solid #f43f5e;color:#881337;';
          }
          return `<div style="margin:4px 0;padding:6px 10px;border-radius:4px;${bgStyle}">
            <b>${OPTION_LETTERS[oIdx]}.</b> ${escapeHtml(opt)}${mark}
          </div>`;
        })
        .join('');

      return `
        <div style="margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 6px 0;font-size:11pt;">
            <b>Câu ${qIdx + 1}</b> (${escapeHtml(getDifficultyLabel(q.difficulty))}) ${statusBadge}:
            ${escapeHtml(q.question)}
          </p>
          ${optionsHtml}
          <p style="margin:6px 0 0 0;font-size:9.5pt;color:#475569;">
            <i>Giải thích:</i> ${escapeHtml(q.explanation)} (${escapeHtml(q.reference)})
          </p>
        </div>
      `;
    })
    .join('');

  const pageBreak =
    typeof indexInBatch === 'number' && indexInBatch > 0
      ? 'page-break-before:always;'
      : '';

  return `
    <div style="${pageBreak}">
      <h2 style="margin:0 0 4px 0;font-size:14pt;color:#0f172a;text-align:center;">
        PHIẾU LƯU BÀI THI MÔN CÔNG NGHỆ
      </h2>
      <p style="margin:0 0 12px 0;font-size:11pt;color:#334155;text-align:center;">
        ${escapeHtml(attempt.title)}
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10.5pt;">
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Họ và tên:</b> ${escapeHtml(studentDisplay)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Lớp:</b> ${escapeHtml(classDisplay)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Điểm (10):</b> <b style="font-size:12pt;color:#065f46;">${attempt.score10.toFixed(1)}</b></td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Số câu đúng:</b> ${attempt.correctCount}/${attempt.totalCount}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Thời gian làm:</b> ${escapeHtml(formatDuration(attempt.durationUsedSeconds))}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Xếp loại:</b> ${escapeHtml(rank.label)}</td>
        </tr>
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Thời điểm nộp:</b> ${escapeHtml(submittedAt)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Thoát màn hình:</b> ${attempt.leaveWarnings ?? 0}/5 lần</td>
          <td style="border:1px solid #cbd5e1;padding:6px 8px;"><b>Hình thức nộp:</b> ${escapeHtml(formatSubmitReason(attempt.submitReason))}</td>
        </tr>
      </table>

      ${questionsHtml}
    </div>
  `;
}

function wrapWordDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "Times New Roman", Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.45; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF', content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadStudentExamDoc(attempt: QuizAttempt): void {
  const nameSlug = slugifyFileName(attempt.studentName || 'hoc-sinh') || 'hoc-sinh';
  const classSlug = slugifyFileName(attempt.studentClass || 'lop') || 'lop';
  const dateSlug = new Date(attempt.completedAt).toISOString().slice(0, 10);
  const html = wrapWordDocument(
    `Bài thi ${attempt.studentName || 'Học sinh'} - ${attempt.title}`,
    renderExamSectionHtml(attempt)
  );
  triggerDownload(
    html,
    `bai-thi-${nameSlug}-${classSlug}-${dateSlug}.doc`,
    'application/msword;charset=utf-8'
  );
}

export function downloadBatchExamsDoc(attempts: QuizAttempt[], filterLabel = 'tat-ca'): void {
  if (attempts.length === 0) return;

  const summaryRows = attempts
    .map(
      (a, idx) => `
      <tr>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:center;">${idx + 1}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;">${escapeHtml(a.studentName || 'Học sinh')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;">${escapeHtml(a.studentClass || '')}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;">${escapeHtml(a.title)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:center;">${a.correctCount}/${a.totalCount}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:center;"><b>${a.score10.toFixed(1)}</b></td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:center;">${a.leaveWarnings ?? 0}</td>
        <td style="border:1px solid #cbd5e1;padding:5px 8px;">${escapeHtml(new Date(a.completedAt).toLocaleString('vi-VN'))}</td>
      </tr>
    `
    )
    .join('');

  const coverHtml = `
    <div>
      <h1 style="margin:0 0 6px 0;font-size:15pt;text-align:center;">
        HỒ SƠ LƯU TRỮ BÀI THI HỌC SINH · MÔN CÔNG NGHỆ
      </h1>
      <p style="margin:0 0 12px 0;font-size:10.5pt;text-align:center;color:#475569;">
        Tổng số bài thi: ${attempts.length} · Ngày xuất: ${escapeHtml(new Date().toLocaleString('vi-VN'))}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:10pt;margin-bottom:20px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #cbd5e1;padding:6px 8px;">STT</th>
            <th style="border:1px solid #cbd5e1;padding:6px 8px;">Họ và tên</th>
            <th style="border:1px solid #cbd5e1;padding:6px 8px;">Lớp</th>
            <th style="border:1px solid #cbd5e1;padding:6px 8px;">Đề kiểm tra</th>
            <th style="border:1px solid #cbd5e1;padding:6px 8px;">Đúng</th>
            <th style="border:1px solid #cbd5e1;padding:6px 8px;">Điểm</th>
            <th style="border:1px solid #cbd5e1;padding:6px 8px;">Cảnh báo</th>
            <th style="border:1px solid #cbd5e1;padding:6px 8px;">Thời điểm nộp</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
        </tbody>
      </table>
    </div>
  `;

  const allPapersHtml = attempts
    .map((a, idx) => renderExamSectionHtml(a, idx + 1))
    .join('');

  const labelSlug = slugifyFileName(filterLabel) || 'tat-ca';
  const dateSlug = new Date().toISOString().slice(0, 10);
  const html = wrapWordDocument(
    'Hồ sơ lưu bài thi học sinh',
    coverHtml + allPapersHtml
  );
  triggerDownload(
    html,
    `ho-so-bai-thi-${labelSlug}-${dateSlug}.doc`,
    'application/msword;charset=utf-8'
  );
}
