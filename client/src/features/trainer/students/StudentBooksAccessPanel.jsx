import { useState } from 'react';
import { Link } from 'react-router';
import { useAdminStudentAccessDetail, useUpdateStudentAccess } from '../../study-materials/api.js';
import { Badge, StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { ErrorState, Skeleton } from '../../../components/ui/Feedback.jsx';
import { ProgressBar } from '../../../components/ui/ProgressBar.jsx';
import { StatTile } from '../../../components/ui/StatTile.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';
import { formatDate } from '../format.js';

function formatReadingTime(seconds = 0) {
  if (!seconds) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function StudentBooksAccessPanel({ studentId, studentName }) {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useAdminStudentAccessDetail(studentId);
  const updateAccess = useUpdateStudentAccess(studentId);

  const [confirmRevokeBook, setConfirmRevokeBook] = useState(null);
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading study book access">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={getErrorMessage(error) || 'Failed to load study books access settings.'}
        onRetry={refetch}
      />
    );
  }

  const books = data?.books || [];
  const assignedBooks = books.filter((b) => b.isAssigned);
  const totalReleased = books.reduce((acc, b) => acc + (b.isAssigned ? b.progress.releasedCount : 0), 0);
  const totalCompleted = books.reduce((acc, b) => acc + (b.isAssigned ? b.progress.completedCount : 0), 0);
  const totalReadingSecs = books.reduce(
    (acc, b) => acc + (b.isAssigned ? b.progress.totalReadingSeconds : 0),
    0,
  );
  const overallPercent = totalReleased > 0 ? Math.round((totalCompleted / totalReleased) * 100) : 0;

  // Check if report viewing is enabled on any book
  const canViewAnyReport = assignedBooks.some((b) => b.canViewReport);

  const activeBook = books[selectedBookIndex] || books[0];

  const handleToggleReportVisibility = async (book, allow) => {
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        canViewReport: allow,
      });
      toast.success(
        allow
          ? `Report viewing enabled for ${book.title}.`
          : `Report viewing disabled for ${book.title}.`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleGrantBook = async (book) => {
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        isBookAssigned: true,
      });
      toast.success(`Access to ${book.title} granted.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRevokeBook = async (book) => {
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        isBookAssigned: false,
      });
      toast.success(`Access to ${book.title} revoked.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleReleaseNext = async (book) => {
    if (!book.nextUnreleasedModule) return;
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        action: 'release_next',
      });
      toast.success(
        `Released ${book.nextUnreleasedModule.phaseLabel || book.nextUnreleasedModule.title} to ${studentName}.`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleReleaseAll = async (book) => {
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        action: 'release_all',
      });
      toast.success(`All published phases for ${book.title} released to ${studentName}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleLockAll = async (book) => {
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        action: 'revoke_all',
      });
      toast.success(`All phases for ${book.title} locked.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleToggleModule = async (book, moduleId, currentReleased) => {
    const releasedSet = new Set(book.modules.filter((m) => m.isReleased).map((m) => m.id));
    if (currentReleased) {
      releasedSet.delete(moduleId);
    } else {
      releasedSet.add(moduleId);
    }

    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        isBookAssigned: true,
        releasedModuleIds: Array.from(releasedSet),
      });
      toast.success(currentReleased ? 'Module revoked.' : 'Module released.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <section className="space-y-6" aria-label="Books and Learning Access Panel">
      {/* Top Aggregate Stats */}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Assigned Books"
          value={`${assignedBooks.length} of ${books.length}`}
          hint={assignedBooks.length === 0 ? 'None granted yet' : undefined}
        />
        <StatTile
          label="Released Modules"
          value={totalReleased}
          hint={`${totalCompleted} completed (${overallPercent}%)`}
        />
        <StatTile label="Active Reading Time" value={formatReadingTime(totalReadingSecs)} />
        <StatTile
          label="Report Visibility"
          value={canViewAnyReport ? 'Allowed' : 'Disabled'}
          tone={canViewAnyReport ? 'default' : 'danger'}
        />
      </dl>

      {/* Book Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200/80 pb-3 dark:border-white/10">
        {books.map((b, idx) => (
          <button
            key={b.bookId}
            type="button"
            onClick={() => setSelectedBookIndex(idx)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
              selectedBookIndex === idx
                ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-700 shadow-xs dark:border-cyan-400/40 dark:text-cyan-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
            }`}
          >
            <span>📖 {b.title}</span>
            {b.isAssigned ? (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                {b.progress.releasedCount} Released
              </span>
            ) : (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-400">
                Locked
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active Book Detail Card */}
      {activeBook && (
        <Card aria-label={`${activeBook.title} Access Management`} className="overflow-hidden">
          {/* Decorative Gradient Bar */}
          <div className="h-1.5 w-full" style={{ background: activeBook.gradient }} />

          <CardHeader
            title={
              <div className="flex flex-wrap items-center gap-2.5">
                <span>{activeBook.title}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                  {activeBook.category.toUpperCase()}
                </span>
                <Badge tone={activeBook.isAssigned ? 'success' : 'neutral'}>
                  {activeBook.isAssigned ? 'Access Granted' : 'Locked for Student'}
                </Badge>
              </div>
            }
            description={
              activeBook.isAssigned ? (
                <span>
                  Granted {activeBook.grantedAt ? `on ${formatDate(activeBook.grantedAt)}` : ''}{' '}
                  {activeBook.grantedBy ? `by ${activeBook.grantedBy.name}` : ''}
                </span>
              ) : (
                'Student has not been granted access to this book. Its content is completely hidden.'
              )
            }
          />

          <CardBody className="space-y-6">
            {/* Book-Level Controls & Quick Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex flex-wrap items-center gap-2">
                {activeBook.isAssigned ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirmRevokeBook(activeBook)}
                      disabled={updateAccess.isPending}
                      className="border-rose-500/30 text-[#D12052] hover:bg-rose-500/10 dark:text-rose-400"
                    >
                      Revoke Book
                    </Button>

                    {activeBook.nextUnreleasedModule ? (
                      <Button
                        size="sm"
                        onClick={() => handleReleaseNext(activeBook)}
                        loading={updateAccess.isPending}
                        className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xs"
                      >
                        Release Next: {activeBook.nextUnreleasedModule.phaseLabel || activeBook.nextUnreleasedModule.title}
                      </Button>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ All published phases released
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleReleaseAll(activeBook)}
                      disabled={updateAccess.isPending}
                    >
                      Release All
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleLockAll(activeBook)}
                      disabled={updateAccess.isPending}
                    >
                      Lock All
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleGrantBook(activeBook)}
                    loading={updateAccess.isPending}
                  >
                    Grant Book Access
                  </Button>
                )}
              </div>

              {/* Progress Report Visibility Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Student Progress Report:
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleReportVisibility(activeBook, !activeBook.canViewReport)
                  }
                  disabled={updateAccess.isPending}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                    activeBook.canViewReport
                      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'border border-slate-300 bg-slate-200 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300'
                  }`}
                  title="Toggle whether student can view their progress report"
                >
                  {activeBook.canViewReport ? 'Allowed ✓' : 'Hidden ✕'}
                </button>
              </div>
            </div>

            {/* Reading Progress Bar for this book */}
            {activeBook.isAssigned && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Syllabus Reading Progress</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {activeBook.progress.completedCount} of {activeBook.progress.releasedCount} released
                    modules completed ({activeBook.progress.percent}%)
                  </span>
                </div>
                <ProgressBar
                  value={activeBook.progress.percent}
                  label={`${activeBook.title} progress`}
                  size="sm"
                />
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>⏱️ {formatReadingTime(activeBook.progress.totalReadingSeconds)} active reading</span>
                  <span>Total Modules: {activeBook.progress.totalModules}</span>
                </div>
              </div>
            )}

            {/* Granular Phase & Module Release List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Phases & Modules Release Controls
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Check to release an individual phase to {studentName}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/50 dark:border-white/10 dark:bg-white/[0.02]">
                <ul className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {activeBook.modules.map((m) => {
                    const isCompleted = Boolean(m.readingProgress?.isCompleted);
                    const inProgress = !isCompleted && (m.readingProgress?.totalReadingSeconds || 0) > 0;

                    return (
                      <li
                        key={m.id}
                        className={`flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                          m.isReleased
                            ? 'hover:bg-slate-50/70 dark:hover:bg-white/[0.02]'
                            : 'bg-slate-50/50 opacity-60 dark:bg-white/[0.01]'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={m.isReleased}
                            onChange={() => handleToggleModule(activeBook, m.id, m.isReleased)}
                            disabled={updateAccess.isPending}
                            className="mt-1 size-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700"
                            aria-label={`Release ${m.title}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {m.phaseLabel && (
                                <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                                  {m.phaseLabel}
                                </span>
                              )}
                              <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {m.title}
                              </span>
                              <StatusBadge status={m.status} />

                              {isCompleted && (
                                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  ✓ Completed
                                </span>
                              )}
                              {inProgress && (
                                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                  In Progress
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                📄 {m.originalFilename}
                              </span>
                              <span>•</span>
                              <span>~{m.estimatedMinutes} mins</span>
                              {Boolean(m.readingProgress?.totalReadingSeconds > 0) && (
                                <>
                                  <span>•</span>
                                  <span>⏱️ {formatReadingTime(m.readingProgress.totalReadingSeconds)} read</span>
                                </>
                              )}
                              {m.linkedAssignment && (
                                <>
                                  <span>•</span>
                                  <span className="font-medium text-cyan-600 dark:text-cyan-400">
                                    Linked Assignment: {m.linkedAssignment.title}
                                  </span>
                                  {m.linkedAssignment.submission ? (
                                    <Badge
                                      tone={
                                        m.linkedAssignment.submission.status === 'reviewed'
                                          ? 'success'
                                          : 'info'
                                      }
                                      className="text-[10px]"
                                    >
                                      {m.linkedAssignment.submission.status === 'reviewed'
                                        ? `Graded: ${m.linkedAssignment.submission.marks}/${m.linkedAssignment.maxMarks}`
                                        : 'Submitted'}
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">Not submitted</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Quick Action: Preview Button */}
                        <div className="shrink-0 flex items-center gap-2">
                          <Link
                            to={`/admin/study-materials/preview/${m.id}`}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                            title="Preview original material"
                          >
                            👁️ Preview
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Confirm Revoke Dialog */}
      <ConfirmDialog
        open={Boolean(confirmRevokeBook)}
        title="Revoke book access?"
        message={`${studentName} will lose access to ${confirmRevokeBook?.title}. Their past reading progress and submission history are safely preserved, and access can be restored at any time.`}
        confirmLabel="Revoke Access"
        loading={updateAccess.isPending}
        onCancel={() => setConfirmRevokeBook(null)}
        onConfirm={async () => {
          if (confirmRevokeBook) {
            await handleRevokeBook(confirmRevokeBook);
            setConfirmRevokeBook(null);
          }
        }}
      />
    </section>
  );
}
