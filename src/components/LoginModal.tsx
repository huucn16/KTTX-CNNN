import React, { useEffect, useState } from 'react';
import { AlertCircle, GraduationCap, ShieldCheck, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  errorMessage: string;
  onClose: () => void;
  onGoogleSignIn: () => Promise<boolean>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  errorMessage,
  onClose,
  onGoogleSignIn,
}) => {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSignInClick = async () => {
    setSubmitting(true);
    try {
      const ok = await onGoogleSignIn();
      if (ok) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-emerald-800">GVBM: Trần Văn Hữu</p>
            <h2
              id="login-modal-title"
              className="mt-1 font-display text-xl font-bold text-slate-900"
            >
              Đăng nhập hệ thống
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Sử dụng tài khoản Google để xác thực nhanh cho học sinh và giáo viên bộ môn.
            </p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Đóng hộp thoại đăng nhập"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <div className="text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Dành cho Học sinh (Tùy chọn)</p>
              <p className="mt-0.5 text-slate-600">
                Học sinh nhấp link đề thi có thể điền Họ tên, Lớp và làm bài ngay không cần đăng nhập.
                Đăng nhập Google chỉ để tự động điền sẵn họ tên.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <div className="text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Dành cho Giáo viên</p>
              <p className="mt-0.5 text-slate-600">
                Đồng bộ bảng điểm học sinh từ các thiết bị, lưu trữ hồ sơ bài thi và kết thúc bài thi sớm.
              </p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSignInClick}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-xs hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 transition-all"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>{submitting ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}</span>
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="w-full rounded-xl px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
};
