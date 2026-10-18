import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import {
  useAdminStudyPreview,
  useStudentStudyModuleContent,
  useToggleModuleCompletion,
} from './api.js';
import { useReadingTelemetry } from './useReadingTelemetry.js';
import { Spinner } from '../../components/ui/Spinner.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Icon } from '../../components/Icon.jsx';

function formatReadingTime(seconds = 0) {
  if (seconds < 60) return `${seconds}s read`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m read`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m read`;
}

/**
 * Sandboxed HTML Study Book Reader with Telemetry & Completion Tracking.
 * - Renders original HTML bytes byte-for-byte in an isolated iframe.
 * - Strict sandbox: `sandbox="allow-scripts"` (strictly omitting `allow-same-origin`).
 * - Preserves original styling, embedded code, and inline SVG graphics without modification.
 * - Tracks active engaged reading time via useReadingTelemetry.
 * - Interactive completion toggle with optimistic UI.
 * - Integrated assignment quick-action banner when linked.
 */
export function StudyReaderPage({ mode = 'student' }) {
  const { moduleId, bookSlug, moduleSlug } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch data depending on mode
  const previewQuery = useAdminStudyPreview(mode === 'preview' ? moduleId : null);
  const studentQuery = useStudentStudyModuleContent(
    mode === 'student' ? bookSlug : null,
    mode === 'student' ? moduleSlug : null,
  );

  const query = mode === 'preview' ? previewQuery : studentQuery;
  const { data, isLoading, error } = query;

  // Telemetry hook
  const { totalReadingSeconds, isIdle } = useReadingTelemetry({
    bookSlug,
    moduleSlug,
    enabled: mode === 'student' && !isLoading && Boolean(data),
    initialSeconds: data?.readingProgress?.totalReadingSeconds || 0,
  });

  // Completion mutation
  const toggleCompletion = useToggleModuleCompletion(bookSlug, moduleSlug);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (data?.readingProgress?.isCompleted !== undefined) {
      setIsCompleted(data.readingProgress.isCompleted);
    }
  }, [data?.readingProgress?.isCompleted]);

  const handleToggleComplete = () => {
    const nextState = !isCompleted;
    setIsCompleted(nextState);
    toggleCompletion.mutate({ isCompleted: nextState });
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-12rem)] flex-col items-center justify-center gap-3">
        <Spinner className="size-10 text-cyan-500" label="Loading study material..." />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading original study material...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[calc(100vh-12rem)] flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-rose-500/10 p-4 text-[#D12052] dark:bg-rose-500/20 dark:text-rose-400">
          <Icon name="close" className="size-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Material Unavailable
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {error?.response?.data?.error?.message ||
              'This study module is not published or not yet assigned to your account.'}
          </p>
        </div>
        <Link
          to={mode === 'preview' ? '/admin/study-materials' : '/app/study-materials'}
          className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-cyan-600"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  const { module, book, navigation, content } = data;
  const activeBook = book || module.book;

  const backLink =
    mode === 'preview'
      ? '/admin/study-materials'
      : `/app/study-materials/${activeBook.slug}`;

  const goToPrev = () => {
    if (!navigation?.prev) return;
    if (mode === 'preview') {
      navigate(`/admin/study-materials/preview/${navigation.prev.id}`);
    } else {
      navigate(`/app/study-materials/${activeBook.slug}/modules/${navigation.prev.slug}`);
    }
  };

  const goToNext = () => {
    if (!navigation?.next) return;
    if (mode === 'preview') {
      navigate(`/admin/study-materials/preview/${navigation.next.id}`);
    } else {
      navigate(`/app/study-materials/${activeBook.slug}/modules/${navigation.next.slug}`);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-950/90 text-slate-100 transition-all ${
        isFullscreen
          ? 'fixed inset-0 z-50 h-screen w-screen'
          : 'h-[calc(100vh-5.5rem)] rounded-2xl border border-slate-200/50 shadow-2xl dark:border-white/10'
      }`}
    >
      {/* Top Reading Navigation Bar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200/30 bg-slate-900/90 px-4 py-2.5 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1222]/95 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={backLink}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700/60 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            title="Return to library"
          >
            <span>←</span>
            <span className="hidden sm:inline">Library</span>
          </Link>

          <div className="hidden h-5 w-px bg-slate-700 sm:block" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone="info" className="text-[11px] font-bold">
                {activeBook?.title || 'Study Book'}
              </Badge>
              {mode === 'preview' && (
                <Badge tone="warning" className="text-[10px]">
                  Trainer Preview
                </Badge>
              )}
              {module.phaseLabel && (
                <span className="text-xs font-semibold text-cyan-400">
                  {module.phaseLabel}
                </span>
              )}
            </div>
            <h1 className="truncate text-sm font-semibold text-white sm:text-base">
              {module.title}
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Active Reading Timer Indicator */}
          {mode === 'student' && (
            <div
              className={`hidden sm:flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-medium transition-colors ${
                isIdle
                  ? 'border-slate-800 bg-white/5 text-slate-400'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
              }`}
              title={isIdle ? 'Reading timer paused (idle)' : 'Reading telemetry active'}
            >
              <span className={`size-1.5 rounded-full ${isIdle ? 'bg-slate-500' : 'bg-cyan-400 animate-pulse'}`} />
              <span>{formatReadingTime(totalReadingSeconds)}</span>
            </div>
          )}

          {/* Mark Complete Button (Student Mode only) */}
          {mode === 'student' && (
            <button
              type="button"
              onClick={handleToggleComplete}
              disabled={toggleCompletion.isPending}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                isCompleted
                  ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  : 'border-slate-700/80 bg-white/5 text-slate-300 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300'
              }`}
              title={isCompleted ? 'Completed! Click to mark incomplete' : 'Mark module as complete'}
            >
              <span className="text-sm">{isCompleted ? '✓' : '○'}</span>
              <span>{isCompleted ? 'Completed' : 'Mark Complete'}</span>
            </button>
          )}

          {/* Previous module */}
          <button
            type="button"
            onClick={goToPrev}
            disabled={!navigation?.prev}
            className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              navigation?.prev
                ? 'border-slate-700/60 bg-white/5 text-slate-200 hover:bg-white/10'
                : 'cursor-not-allowed border-transparent text-slate-600'
            }`}
            title={navigation?.prev ? `Previous: ${navigation.prev.title}` : 'No previous module'}
          >
            <span>‹</span>
            <span className="hidden md:inline">Prev</span>
          </button>

          {/* Next module */}
          <button
            type="button"
            onClick={goToNext}
            disabled={!navigation?.next}
            className={`flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              navigation?.next
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
                : 'cursor-not-allowed border-transparent text-slate-600'
            }`}
            title={navigation?.next ? `Next: ${navigation.next.title}` : 'No next module'}
          >
            <span className="hidden md:inline">Next</span>
            <span>›</span>
          </button>

          <div className="h-5 w-px bg-slate-700" />

          {/* Fullscreen toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-xl border border-slate-700/60 bg-white/5 p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            aria-label="Toggle Fullscreen"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {isFullscreen ? (
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              ) : (
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Sandboxed iframe container */}
      <main className="relative flex-1 overflow-hidden bg-white">
        <iframe
          key={module.id || module.slug}
          sandbox="allow-scripts"
          srcDoc={content}
          title={module.title}
          className="h-full w-full border-0 bg-white"
        />
      </main>

      {/* Associated Assignment Banner (if linked) */}
      {module.linkedAssignment && (
        <footer className="shrink-0 flex items-center justify-between gap-4 border-t border-slate-700/60 bg-slate-900/95 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2.5 text-xs">
            <span className="rounded-md bg-amber-500/20 px-2 py-0.5 font-bold text-amber-300">
              Associated Assignment
            </span>
            <span className="truncate max-w-xs font-medium text-white sm:max-w-md">
              {module.linkedAssignment.title}
            </span>
          </div>
          <Link
            to="/app/assignments"
            className="flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/30"
          >
            <span>Go to Assignment</span>
            <span>→</span>
          </Link>
        </footer>
      )}
    </div>
  );
}
