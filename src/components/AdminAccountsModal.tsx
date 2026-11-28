import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Unlock,
  UserPlus,
  X,
} from 'lucide-react';
import { mapAuthErrorToVietnamese, normalizeIssuedAccountIdentifier } from '../firebase';
import { IssuedAccount, IssuedAccountRole } from '../types/quiz';

interface AdminAccountsModalProps {
  isOpen: boolean;
  accounts: IssuedAccount[];
  loading: boolean;
  onClose: () => void;
  onCreateAccount: (input: {
    identifier: string;
    password: string;
    displayName: string;
    role: IssuedAccountRole;
    studentClass: string;
  }) => Promise<IssuedAccount>;
  onToggleActive: (account: IssuedAccount, active: boolean) => Promise<void>;
  onDeleteAccount: (account: IssuedAccount) => Promise<void>;
}

function generateStrongPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const length = 8;
  const randomValues = new Uint32Array(length);
  window.crypto.getRandomValues(randomValues);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

export const AdminAccountsModal: React.FC<AdminAccountsModalProps> = ({
  isOpen,
  accounts,
  loading,
  onClose,
  onCreateAccount,
  onToggleActive,
  onDeleteAccount,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<IssuedAccountRole>('student');
  const [studentClass, setStudentClass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastIssued, setLastIssued] = useState<{
    username: string;
    displayName: string;
    role: IssuedAccountRole;
    studentClass: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormError('');
    setActionError('');
  }, [isOpen]);

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

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((acc) => {
      const hay = `${acc.displayName} ${acc.username} ${acc.email} ${acc.studentClass}`.toLowerCase();
      return hay.includes(q);
    });
  }, [accounts, searchQuery]);

  if (!isOpen) return null;

  const previewNormalized = normalizeIssuedAccountIdentifier(identifier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setActionError('');

    if (!displayName.trim()) {
      setFormError('Vui lòng nhập Họ và tên người dùng.');
      return;
    }
    if (previewNormalized.username.length < 2) {
      setFormError('Tên đăng nhập phải có ít nhất 2 ký tự (không dấu, không khoảng trắng).');
      return;
    }
    if (password.length < 6) {
      setFormError('Mật khẩu ban đầu phải có ít nhất 6 ký tự.');
      return;
    }
    if (role === 'student' && !studentClass.trim()) {
      setFormError('Vui lòng nhập Lớp cho tài khoản học sinh.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await onCreateAccount({
        identifier,
        password,
        displayName,
        role,
        studentClass,
      });
      setLastIssued({
        username: created.username,
        displayName: created.displayName,
        role: created.role,
        studentClass: created.studentClass,
        password,
      });
      setDisplayName('');
      setIdentifier('');
      setPassword('');
      setStudentClass('');
    } catch (error) {
      setFormError(mapAuthErrorToVietnamese(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!lastIssued) return;
    const text = [
      `Thông tin đăng nhập · GVBM: Trần Văn Hữu`,
      `Họ và tên: ${lastIssued.displayName}`,
      `Vai trò: ${lastIssued.role === 'teacher' ? 'Giáo viên' : `Học sinh (${lastIssued.studentClass})`}`,
      `Tên đăng nhập: ${lastIssued.username}`,
      `Mật khẩu: ${lastIssued.password}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId('last');
      window.setTimeout(() => setCopiedId(null), 2200);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-accounts-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-emerald-800">Quản trị tài khoản · GVBM: Trần Văn Hữu</p>
            <h2
              id="admin-accounts-title"
              className="mt-0.5 font-display text-lg font-bold text-slate-900 sm:text-xl"
            >
              Cấp & Quản lý tài khoản đăng nhập
            </h2>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label="Đóng quản lý tài khoản"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 divide-y divide-slate-200 overflow-y-auto lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Create Account Form */}
          <section className="p-5 sm:p-6 lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <UserPlus className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              <span>Cấp tài khoản mới</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="issue-display-name"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Họ và tên <span className="text-rose-600">*</span>
                </label>
                <input
                  id="issue-display-name"
                  type="text"
                  maxLength={100}
                  disabled={submitting}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Minh Anh"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="issue-identifier"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Tên đăng nhập hoặc Email <span className="text-rose-600">*</span>
                </label>
                <input
                  id="issue-identifier"
                  type="text"
                  maxLength={150}
                  disabled={submitting}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Ví dụ: hs11a2_01 hoặc gv_anh@truong.edu.vn"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                />
                {previewNormalized.username && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Định danh đăng nhập:{' '}
                    <span className="font-mono-tabular font-semibold text-slate-700">
                      {previewNormalized.username}
                    </span>
                  </p>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="issue-password"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Mật khẩu ban đầu <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setPassword(generateStrongPassword());
                      setShowPassword(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                    <span>Tạo ngẫu nhiên</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="issue-password"
                    type={showPassword ? 'text' : 'password'}
                    disabled={submitting}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-9 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="issue-role"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Vai trò
                  </label>
                  <select
                    id="issue-role"
                    disabled={submitting}
                    value={role}
                    onChange={(e) => setRole(e.target.value as IssuedAccountRole)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-900 focus:border-emerald-700 focus:outline-none"
                  >
                    <option value="student">Học sinh</option>
                    <option value="teacher">Giáo viên</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="issue-class"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Lớp {role === 'student' && <span className="text-rose-600">*</span>}
                  </label>
                  <input
                    id="issue-class"
                    type="text"
                    maxLength={30}
                    disabled={submitting || role === 'teacher'}
                    value={role === 'teacher' ? '' : studentClass}
                    onChange={(e) => setStudentClass(e.target.value)}
                    placeholder={role === 'teacher' ? 'Không bắt buộc' : 'VD: 11A2'}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
                >
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{submitting ? 'Đang tạo tài khoản...' : 'Tạo & Cấp tài khoản'}</span>
              </button>
            </form>

            {lastIssued && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-emerald-900">
                    Đã cấp tài khoản thành công
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyCredentials()}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    {copiedId === 'last' ? (
                      <>
                        <Check className="h-3 w-3" aria-hidden="true" />
                        <span>Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" aria-hidden="true" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="space-y-0.5 font-mono-tabular text-[11px] text-slate-700">
                  <p>
                    Tài khoản: <strong className="text-slate-900">{lastIssued.username}</strong>
                  </p>
                  <p>
                    Mật khẩu: <strong className="text-slate-900">{lastIssued.password}</strong>
                  </p>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Vui lòng sao chép ngay để gửi cho người dùng. Hệ thống không lưu lại mật khẩu gốc.
                </p>
              </div>
            )}
          </section>

          {/* Account List */}
          <section className="flex flex-col p-5 sm:p-6 lg:col-span-7 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                <span>Tài khoản đã cấp ({accounts.length})</span>
              </div>

              <div className="relative min-w-[200px]">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên, tài khoản, lớp..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:outline-none"
                />
              </div>
            </div>

            {actionError && (
              <div
                role="alert"
                className="flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Đang tải danh sách tài khoản...
                </div>
              ) : filteredAccounts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {accounts.length === 0
                    ? 'Chưa có tài khoản nào được cấp. Sử dụng biểu mẫu bên cạnh để tạo tài khoản mới.'
                    : 'Không tìm thấy tài khoản phù hợp.'}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredAccounts.map((acc) => {
                    const isBusy = busyUid === acc.uid;
                    return (
                      <li
                        key={acc.uid}
                        className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/70"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-xs font-semibold text-slate-900">
                              {acc.displayName}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                acc.role === 'teacher'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {acc.role === 'teacher'
                                ? 'Giáo viên'
                                : `HS${acc.studentClass ? ` · ${acc.studentClass}` : ''}`}
                            </span>
                            {!acc.active && (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                Đã khóa
                              </span>
                            )}
                          </div>
                          <p className="truncate font-mono-tabular text-[11px] text-slate-600">
                            {acc.username}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setActionError('');
                              setBusyUid(acc.uid);
                              try {
                                await onToggleActive(acc, !acc.active);
                              } catch {
                                setActionError('Không thể cập nhật trạng thái tài khoản.');
                              } finally {
                                setBusyUid(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium disabled:opacity-40 transition-colors ${
                              acc.active
                                ? 'border-slate-300 bg-white text-slate-700 hover:bg-amber-50 hover:text-amber-800'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                            }`}
                          >
                            {acc.active ? (
                              <>
                                <Lock className="h-3 w-3" aria-hidden="true" />
                                <span>Khóa</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="h-3 w-3" aria-hidden="true" />
                                <span>Mở khóa</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setActionError('');
                              setBusyUid(acc.uid);
                              try {
                                await onDeleteAccount(acc);
                              } catch {
                                setActionError('Không thể xóa hồ sơ tài khoản này.');
                              } finally {
                                setBusyUid(null);
                              }
                            }}
                            aria-label={`Thu hồi tài khoản ${acc.username}`}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
