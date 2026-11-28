import React from 'react';
import { User } from 'firebase/auth';
import { LogIn, LogOut, UserCircle2, UserPlus } from 'lucide-react';
import { AppView, IssuedAccount } from '../types/quiz';

interface HeaderProps {
  activeView: AppView;
  isQuizActive: boolean;
  user: User | null;
  issuedProfile: IssuedAccount | null;
  isTeacherAuthorized: boolean;
  onNavigate: (view: AppView) => void;
  onQuickStart15Min: () => void;
  onOpenLogin: () => void;
  onOpenManageAccounts: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: 'home', label: 'Đề kiểm tra' },
  { id: 'history', label: 'Bảng điểm' },
  { id: 'wrong-stats', label: 'Thống kê câu sai nhiều' },
];

export const Header: React.FC<HeaderProps> = ({
  activeView,
  isQuizActive,
  user,
  issuedProfile,
  isTeacherAuthorized,
  onNavigate,
  onQuickStart15Min,
  onOpenLogin,
  onOpenManageAccounts,
  onSignOut,
}) => {
  const displayName =
    issuedProfile?.displayName ||
    user?.displayName ||
    issuedProfile?.username ||
    user?.email?.split('@')[0] ||
    'Tài khoản';

  const roleLabel = isTeacherAuthorized
    ? 'Giáo viên'
    : issuedProfile?.studentClass
    ? `HS · ${issuedProfile.studentClass}`
    : 'Học sinh';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm no-print">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="font-display text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-emerald-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          GVBM: Trần Văn Hữu
        </button>

        <nav aria-label="Điều hướng chính" className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-1 text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 ${
                  isActive
                    ? 'text-emerald-800 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-emerald-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {user ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-5 w-5 rounded-md object-cover shrink-0"
                />
              ) : (
                <UserCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
              )}
              <div className="hidden sm:flex items-center gap-1.5 max-w-[180px]">
                <span className="truncate font-semibold text-slate-800">{displayName}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                    isTeacherAuthorized
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {roleLabel}
                </span>
              </div>
              {isTeacherAuthorized && (
                <button
                  type="button"
                  onClick={onOpenManageAccounts}
                  title="Cấp và quản lý tài khoản đăng nhập"
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 transition-colors"
                >
                  <UserPlus className="h-3 w-3" aria-hidden="true" />
                  <span className="hidden lg:inline">Cấp tài khoản</span>
                </button>
              )}
              <button
                type="button"
                onClick={onSignOut}
                title="Đăng xuất tài khoản"
                aria-label="Đăng xuất"
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
              >
                <LogOut className="h-3 w-3" aria-hidden="true" />
                <span className="hidden lg:inline">Đăng xuất</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 whitespace-nowrap shrink-0 hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <LogIn className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              <span>Đăng nhập</span>
            </button>
          )}

          {isQuizActive && (
            <button
              type="button"
              onClick={onQuickStart15Min}
              className="rounded-lg bg-emerald-700 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white whitespace-nowrap shrink-0 hover:bg-emerald-800 active:scale-[0.99] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Quay lại bài thi
            </button>
          )}
        </div>
      </div>

      {/* Mobile compact single-line horizontal nav */}
      <nav
        aria-label="Điều hướng di động"
        className="flex md:hidden items-center gap-5 overflow-x-auto border-t border-slate-100 px-4 py-2 text-xs font-medium"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`whitespace-nowrap shrink-0 py-0.5 transition-colors ${
                isActive ? 'text-emerald-800 font-semibold underline underline-offset-4' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
