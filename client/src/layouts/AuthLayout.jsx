import { Outlet } from 'react-router';
import { Logo } from '../components/Logo.jsx';
import { ThemeToggle } from '../components/ui/ThemeToggle.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const HIGHLIGHTS = [
  'Structured roadmaps for MERN, Java Full-Stack and DSA',
  'Notes, code examples and PDF resources in every lesson',
  'Assignments with trainer feedback and progress tracking',
];

export function AuthLayout() {
  useDocumentTitle();
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Decorative ambient aurora background */}
      <div className="aurora-bg" aria-hidden="true" />

      {/* Brand Hero Panel (Left) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#061826] via-[#0b2438] to-[#120a1f] p-12 text-slate-200 lg:flex">
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-[#03AED2]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#D12052]/25 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/3 h-64 w-64 rounded-full bg-[#F45B26]/15 blur-3xl" />

        <div className="relative z-10">
          <Logo tone="light" />
        </div>

        <div className="relative z-10 max-w-lg">
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-cyan-300 ring-1 ring-white/15 backdrop-blur-md">
            Android 16 Glassmorphism LMS
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Learn full-stack development,{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-cyan-400 via-[#F8DE22] to-rose-400">
              one milestone at a time.
            </span>
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm leading-6 text-slate-200">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#03AED2]/20 text-[#03AED2] ring-1 ring-[#03AED2]/40">
                  <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-xs text-slate-400">
          © {new Date().getFullYear()} Training LMS · Expressive SaaS Design System
        </div>
      </aside>

      {/* Form area (Right) */}
      <main className="relative flex items-center justify-center px-4 py-12 sm:px-8">
        {/* Floating ThemeToggle in top right */}
        <div className="absolute top-6 right-6 z-20">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <Logo className="mb-8 lg:hidden" />
          <div className="rounded-3xl border border-slate-200/80 bg-white/75 p-8 shadow-[0_20px_50px_rgba(0,0,0,0.05)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
