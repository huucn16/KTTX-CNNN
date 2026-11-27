import React from 'react';
import { AppView } from '../types/quiz';

interface HeaderProps {
  activeView: AppView;
  isQuizActive: boolean;
  onNavigate: (view: AppView) => void;
  onQuickStart15Min: () => void;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: 'home', label: 'Đề kiểm tra' },
  { id: 'history', label: 'Bảng điểm' },
  { id: 'wrong-stats', label: 'Thống kê câu sai nhiều' },
];

export const Header: React.FC<HeaderProps> = ({
  activeView,
  isQuizActive,
  onNavigate,
  onQuickStart15Min,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm no-print">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-emerald-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
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

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onQuickStart15Min}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white whitespace-nowrap shrink-0 hover:bg-emerald-800 active:scale-[0.99] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            {isQuizActive ? 'Quay lại bài thi' : 'Làm bài 15 phút'}
          </button>
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
