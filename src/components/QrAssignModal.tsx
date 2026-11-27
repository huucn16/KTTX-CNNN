import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, GraduationCap, Play, QrCode, Shuffle, X } from 'lucide-react';
import QRCode from 'qrcode';
import { ShuffleMode } from '../types/quiz';

export interface QrShareTarget {
  title: string;
  meta: string;
  baseUrl: string;
  filenameSlug?: string;
  isRandomMix?: boolean;
  onStartLocalTest: (shuffleMode: ShuffleMode) => void;
}

interface QrAssignModalProps {
  target: QrShareTarget | null;
  onClose: () => void;
}

const SHUFFLE_OPTIONS: { value: ShuffleMode; label: string; hint: string }[] = [
  {
    value: 'ca-hai',
    label: 'Trộn câu hỏi & đáp án',
    hint: 'Mỗi học sinh nhận thứ tự câu và A/B/C/D khác nhau',
  },
  {
    value: 'cau-hoi',
    label: 'Chỉ trộn thứ tự câu hỏi',
    hint: 'Đảo vị trí các câu, giữ nguyên thứ tự đáp án A/B/C/D',
  },
  {
    value: 'dap-an',
    label: 'Chỉ trộn đáp án A–D',
    hint: 'Giữ nguyên thứ tự câu hỏi, đảo ngẫu nhiên 4 đáp án',
  },
  {
    value: 'khong',
    label: 'Giữ nguyên đề gốc',
    hint: 'Không đảo câu hỏi và không đảo đáp án',
  },
];

export const QrAssignModal: React.FC<QrAssignModalProps> = ({ target, onClose }) => {
  const [presetClass, setPresetClass] = useState('');
  const [shuffleMode, setShuffleMode] = useState<ShuffleMode>('ca-hai');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (target) {
      setShuffleMode('ca-hai');
    }
  }, [target]);

  const shareUrl = useMemo(() => {
    if (!target) return '';
    const params: string[] = [`tron=${encodeURIComponent(shuffleMode)}`];
    const trimmedClass = presetClass.trim();
    if (trimmedClass) {
      params.push(`lop=${encodeURIComponent(trimmedClass)}`);
    }
    const sep = target.baseUrl.includes('?') ? '&' : '?';
    return `${target.baseUrl}${sep}${params.join('&')}`;
  }, [target, presetClass, shuffleMode]);

  useEffect(() => {
    setCopied(false);
  }, [shareUrl]);

  useEffect(() => {
    if (!shareUrl) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(shareUrl, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  if (!target) return null;

  const activeShuffleInfo =
    SHUFFLE_OPTIONS.find((opt) => opt.value === shuffleMode) ?? SHUFFLE_OPTIONS[0];

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked in restricted iframe
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    const rawSlug = target.filenameSlug
      ? target.filenameSlug
      : target.title
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/gi, 'd');
    const slug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '');
    link.href = qrDataUrl;
    link.download = `qr-${slug || 'de-kiem-tra'}-${shuffleMode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-assign-title"
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800">
              <QrCode className="h-4 w-4" />
              <span>Giao đề kiểm tra qua mã QR</span>
            </div>
            <h2
              id="qr-assign-title"
              className="font-display text-lg font-bold text-slate-900 leading-snug"
            >
              {target.title}
            </h2>
            <p className="font-mono-tabular text-xs text-slate-600">{target.meta}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại mã QR"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Mã QR giao ${target.title}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400">Đang tạo mã QR...</span>
              )}
            </div>
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-900">
              <Shuffle className="h-3 w-3 shrink-0" />
              <span>{activeShuffleInfo.label}</span>
            </span>
          </div>

          <div className="flex-1 space-y-3.5 min-w-0 w-full">
            <p className="text-xs leading-relaxed text-slate-600">
              {target.isRandomMix
                ? 'Mỗi học sinh quét mã QR sẽ được rút ngẫu nhiên 10 câu chuẩn ma trận (4 Nhận biết · 3 Thông hiểu · 3 Vận dụng) tạo mã đề riêng biệt.'
                : 'Học sinh dùng điện thoại quét mã QR để mở thẳng đề thi này và nhập Họ tên, Lớp trước khi làm bài.'}
            </p>

            {/* Shuffle Mode Selection */}
            <div>
              <label
                htmlFor="qr-shuffle-mode"
                className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700"
              >
                <Shuffle className="h-3.5 w-3.5 text-emerald-700" />
                <span>Chế độ trộn đề khi giao cho học sinh</span>
              </label>
              <select
                id="qr-shuffle-mode"
                value={shuffleMode}
                onChange={(e) => setShuffleMode(e.target.value as ShuffleMode)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
              >
                {SHUFFLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">{activeShuffleInfo.hint}</p>
            </div>

            <div>
              <label
                htmlFor="qr-preset-class"
                className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-700"
              >
                <GraduationCap className="h-3.5 w-3.5 text-emerald-700" />
                <span>Gắn sẵn tên lớp (tuỳ chọn)</span>
              </label>
              <input
                id="qr-preset-class"
                type="text"
                value={presetClass}
                onChange={(e) => setPresetClass(e.target.value)}
                placeholder="Ví dụ: 11A2 (để trống nếu giao nhiều lớp)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15"
              />
            </div>

            <div>
              <label
                htmlFor="qr-share-url"
                className="mb-1 block text-xs font-medium text-slate-700"
              >
                Đường dẫn đề thi
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="qr-share-url"
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono-tabular text-[11px] text-slate-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-50 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-700" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={!qrDataUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-50 disabled:opacity-40 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Tải ảnh mã QR</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-50 transition-colors"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                target.onStartLocalTest(shuffleMode);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:bg-emerald-800 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Làm thử đề này</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
