import { Outlet } from 'react-router';
import { Logo } from '../components/Logo.jsx';

const HIGHLIGHTS = [
  'Structured roadmaps for MERN, Java Full-Stack and DSA',
  'Notes, code examples and PDF resources in every lesson',
  'Assignments with trainer feedback and progress tracking',
];

export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-brand-900 p-10 text-brand-100 lg:flex">
        <Logo tone="light" />
        <div>
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-white">
            Learn full-stack development, one milestone at a time.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6">
                <svg
                  viewBox="0 0 20 20"
                  className="mt-0.5 size-5 shrink-0 text-brand-200"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
                  />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200/80">© {new Date().getFullYear()} Training LMS</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Logo className="mb-8 lg:hidden" />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
