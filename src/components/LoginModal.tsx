import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  UserCheck,
  X,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  errorMessage: string;
  onClose: () => void;
  onCredentialSignIn: (identifier: string, password: string) => Promise<boolean>;
  onGoogleSignIn: () => Promise<boolean>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  errorMessage,
  onClose,
  onCredentialSignIn,
  onGoogleSignIn,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLocalError('');
    setPassword('');
    setShowPassword(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting && !googleSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, submitting, googleSubmitting, onClose]);

  if (!isOpen) return null;

  const isBusy = submitting || googleSubmitting;
  const displayedError = localError || errorMessage;

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setLocalError('Vui lòng nhập Tên đăng nhập hoặc Email được Admin cấp.');
      return;
    }
    if (!password) {
      setLocalError('Vui lòng nhập mật khẩu.');
      return;
    }
    setLocalError('');
    setSubmitting(true);
    try {
      const ok = await onCredentialSignIn(trimmedId, password);
      if (ok) {
        setIdentifier('');
        setPassword('');
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setLocalError('');
    setGoogleSubmitting(true);
    try {
      const ok = await onGoogleSignIn();
      if (ok) {
        onClose();
      }
    } finally {
      setGoogleSubmitting(false);
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
              Đăng nhập bằng tài khoản do Admin cấp hoặc tài khoản Google quản trị.
            </p>
          </div>
          <button
            type="button"
            disabled={isBusy}
            onClick={onClose}
            aria-label="Đóng hộp thoại đăng nhập"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleCredentialSubmit} className="mt-5 space-y-3.5">
          <div>
            <label
              htmlFor="login-identifier"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700"
            >
              <UserCheck className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>Tên đăng nhập hoặc Email</span>
            </label>
            <input
              id="login-identifier"
              type="text"
              autoFocus
              autoComplete="username"
              disabled={isBusy}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Ví dụ: hs11a2_01 hoặc gv01@truong.edu.vn"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-700"
            >
              <Lock className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>Mật khẩu</span>
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isBusy}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu được cấp"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/15 disabled:bg-slate-50"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {displayedError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
              <span>{displayedError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 active:scale-[0.99] disabled:opacity-50 transition-all"
          >
            <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{submitting ? 'Đang đăng nhập...' : 'Đăng nhập tài khoản'}</span>
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-[11px] font-medium text-slate-400">Hoặc dành cho Admin / GV</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-2">
          <button
            type="button"
            disabled={isBusy}
            onClick={handleGoogleClick}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-xs hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 transition-all"
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
            <span>{googleSubmitting ? 'Đang kết nối Google...' : 'Đăng nhập bằng Google'}</span>
          </button>

          <p className="pt-1 text-center text-[11px] leading-relaxed text-slate-500">
            Học sinh làm bài qua link hoặc mã QR không cần đăng nhập, chỉ cần điền Họ tên và Lớp.
          </p>
        </div>
      </div>
    </div>
  );
};
