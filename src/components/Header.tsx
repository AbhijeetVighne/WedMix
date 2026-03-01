import { Music, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

function getInitialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function Header() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const meta = document.getElementById('theme-color-meta');
    if (theme === 'dark') {
      root.classList.add('dark');
      meta?.setAttribute('content', '#0c0a09');
    } else {
      root.classList.remove('dark');
      meta?.setAttribute('content', '#fafaf9');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <header className="border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-2.5 sm:gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20 flex-shrink-0">
          <Music className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold bg-gradient-to-r from-rose-600 to-amber-600 dark:from-rose-400 dark:to-amber-400 bg-clip-text text-transparent">
            WedMix
          </h1>
          <p className="text-[10px] sm:text-xs text-stone-400 dark:text-stone-500 -mt-0.5">Wedding Music Editor</p>
        </div>

        <div className="flex-1" />

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}
