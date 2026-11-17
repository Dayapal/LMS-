import { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { useAdminStudentAccessDetail, useUpdateStudentAccess } from '../../study-materials/api.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
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

function AccessStatusBadge({ status }) {
  switch (status) {
    case 'active':
      return <Badge tone="success">Active</Badge>;
    case 'partially_released':
      return <Badge tone="info">Partially Released</Badge>;
    case 'revoked':
      return <Badge tone="danger">Revoked</Badge>;
    case 'not_granted':
    default:
      return <Badge tone="neutral">Not Granted</Badge>;
  }
}

export function StudentBooksAccessPanel({ studentId, studentName }) {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useAdminStudentAccessDetail(studentId);
  const updateAccess = useUpdateStudentAccess(studentId);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Currently focused book for Phase/Module management
  const [activeBookId, setActiveBookId] = useState(null);

  // Modals & Dialogs state
  const [grantModalBook, setGrantModalBook] = useState(null);
  const [grantScope, setGrantScope] = useState('all'); // 'all' | 'selected' | 'none'
  const [grantSelectedModuleIds, setGrantSelectedModuleIds] = useState(new Set());
  const [grantCanViewReport, setGrantCanViewReport] = useState(false);

  const [confirmRevokeBook, setConfirmRevokeBook] = useState(null);
  const [confirmRestoreBook, setConfirmRestoreBook] = useState(null);

  // Batch module selection in active book
  const [batchSelectedModules, setBatchSelectedModules] = useState(new Set());

  const books = useMemo(() => data?.books || [], [data?.books]);

  // Filtered books based on search & status
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        !searchQuery ||
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || book.accessStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [books, searchQuery, statusFilter]);

  // Set default active book once books load if not set
  const activeBook = useMemo(() => {
    if (activeBookId) {
      const found = books.find((b) => b.bookId === activeBookId);
      if (found) return found;
    }
    return books[0] || null;
  }, [books, activeBookId]);

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

  const assignedBooks = books.filter((b) => b.isAssigned);
  const totalReleased = books.reduce((acc, b) => acc + (b.isAssigned ? b.progress.releasedCount : 0), 0);
  const totalCompleted = books.reduce((acc, b) => acc + (b.isAssigned ? b.progress.completedCount : 0), 0);
  const totalReadingSecs = books.reduce(
    (acc, b) => acc + (b.isAssigned ? b.progress.totalReadingSeconds : 0),
    0,
  );
  const overallPercent = totalReleased > 0 ? Math.round((totalCompleted / totalReleased) * 100) : 0;
  const canViewAnyReport = assignedBooks.some((b) => b.canViewReport);

  // Handlers
  const handleOpenGrantModal = (book) => {
    setGrantModalBook(book);
    setGrantScope('all');
    setGrantSelectedModuleIds(new Set((book.modules || []).map((m) => m.id)));
    setGrantCanViewReport(false);
  };

  const handleConfirmGrant = async () => {
    if (!grantModalBook) return;
    try {
      await updateAccess.mutateAsync({
        bookId: grantModalBook.bookId,
        isBookAssigned: true,
        scope: grantScope,
        releasedModuleIds:
          grantScope === 'selected' ? Array.from(grantSelectedModuleIds) : undefined,
        canViewReport: grantCanViewReport,
      });
      toast.success(`Access to ${grantModalBook.title} granted for ${studentName}.`);
      setActiveBookId(grantModalBook.bookId);
      setGrantModalBook(null);
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
      toast.success(`Access to ${book.title} revoked for ${studentName}.`);
      setConfirmRevokeBook(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRestoreBook = async (book) => {
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        action: 'restore',
      });
      toast.success(`Access to ${book.title} restored for ${studentName}.`);
      setActiveBookId(book.bookId);
      setConfirmRestoreBook(null);
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

  const handleToggleModule = async (book, moduleId, currentReleased) => {
    const releasedSet = new Set((book.modules || []).filter((m) => m.isReleased).map((m) => m.id));
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
      toast.success(currentReleased ? 'Phase locked.' : 'Phase released.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleBatchReleaseSelected = async (book) => {
    if (batchSelectedModules.size === 0) return;
    const currentReleased = new Set((book.modules || []).filter((m) => m.isReleased).map((m) => m.id));
    for (const id of batchSelectedModules) {
      currentReleased.add(id);
    }
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        isBookAssigned: true,
        releasedModuleIds: Array.from(currentReleased),
      });
      toast.success(`Selected phases released.`);
      setBatchSelectedModules(new Set());
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleBatchLockSelected = async (book) => {
    if (batchSelectedModules.size === 0) return;
    const currentReleased = new Set((book.modules || []).filter((m) => m.isReleased).map((m) => m.id));
    for (const id of batchSelectedModules) {
      currentReleased.delete(id);
    }
    try {
      await updateAccess.mutateAsync({
        bookId: book.bookId,
        isBookAssigned: true,
        releasedModuleIds: Array.from(currentReleased),
      });
      toast.success(`Selected phases locked.`);
      setBatchSelectedModules(new Set());
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
        {books.map((b) => {
          const isSelected = activeBook?.bookId === b.bookId;
          return (
            <button
              key={b.bookId}
              type="button"
              onClick={() => setActiveBookId(b.bookId)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                isSelected
                  ? 'border border-cyan-500/40 bg-cyan-500/15 text-cyan-700 shadow-xs dark:border-cyan-400/40 dark:text-cyan-300'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
              }`}
            >
              <span>📖 {b.title}</span>
              {b.isAssigned ? (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  {b.progress.releasedCount} Released
                </span>
              ) : b.accessStatus === 'revoked' ? (
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-[#D12052] dark:text-rose-300">
                  Revoked
                </span>
              ) : (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-400">
                  Locked
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search & Status Filter Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search books by title or category..."
            aria-label="Search study books"
            className="w-full rounded-xl border border-slate-200/80 bg-white/70 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 backdrop-blur-md transition-colors focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="status-filter-select" className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Status:
          </label>
          <select
            id="status-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs backdrop-blur-md transition-colors focus:border-cyan-500 focus:outline-none dark:border-white/10 dark:bg-[#0d1527] dark:text-slate-200"
          >
            <option value="all">All Statuses ({books.length})</option>
            <option value="active">Active</option>
            <option value="partially_released">Partially Released</option>
            <option value="revoked">Revoked</option>
            <option value="not_granted">Not Granted</option>
          </select>
        </div>
      </div>

      {/* Available Books Catalogue Grid */}
      {filteredBooks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white/40 p-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-400">
          No books match your search or filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBooks.map((book) => {
            const isCurrentlySelected = activeBook?.bookId === book.bookId;

            return (
              <div
                key={book.bookId}
                className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${
                  isCurrentlySelected
                    ? 'border-cyan-500/60 bg-white/90 shadow-md ring-1 ring-cyan-500/40 dark:border-cyan-400/40 dark:bg-white/[0.06]'
                    : 'border-slate-200/80 bg-white/70 shadow-xs hover:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20'
                }`}
              >
                {/* Decorative Gradient Bar */}
                <div className="h-1.5 w-full" style={{ background: book.gradient }} />

                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                        {book.category.toUpperCase()}
                      </span>
                      <h3 className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                        {book.title}
                      </h3>
                    </div>
                    <AccessStatusBadge status={book.accessStatus} />
                  </div>

                  {/* Metrics */}
                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span>Phases:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {book.progress.releasedCount} of {book.modules.length} released
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Reading Time:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        ⏱️ {formatReadingTime(book.progress.totalReadingSeconds)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Last Studied:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {book.lastAccessedAt ? formatDate(book.lastAccessedAt) : 'Never accessed'}
                      </span>
                    </div>

                    {book.progress.releasedCount > 0 && (
                      <div className="pt-1 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span>Completion:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {book.progress.percent}% ({book.progress.completedCount}/{book.progress.releasedCount})
                          </span>
                        </div>
                        <ProgressBar
                          value={book.progress.percent}
                          label={`${book.title} completion`}
                          size="sm"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="border-t border-slate-200/60 p-3 bg-slate-50/50 dark:border-white/5 dark:bg-white/[0.01] flex items-center justify-between gap-2">
                  {book.accessStatus === 'not_granted' ? (
                    <Button
                      size="sm"
                      onClick={() => handleOpenGrantModal(book)}
                      className="w-full"
                    >
                      Grant Access
                    </Button>
                  ) : book.accessStatus === 'revoked' ? (
                    <div className="flex items-center gap-2 w-full">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setConfirmRestoreBook(book)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        Restore Access
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setActiveBookId(book.bookId)}
                      >
                        Inspect
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <Button
                        size="sm"
                        variant={isCurrentlySelected ? 'primary' : 'secondary'}
                        onClick={() => setActiveBookId(book.bookId)}
                        className="flex-1"
                      >
                        {isCurrentlySelected ? 'Managing' : 'Manage Access'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setConfirmRevokeBook(book)}
                        disabled={updateAccess.isPending}
                        className="border-rose-500/30 text-[#D12052] hover:bg-rose-500/10 dark:text-rose-400"
                        title="Revoke access to this book"
                      >
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Book Detail & Phase Control Workspace */}
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
                <AccessStatusBadge status={activeBook.accessStatus} />
              </div>
            }
            description={
              activeBook.isAssigned ? (
                <span>
                  Granted {activeBook.grantedAt ? `on ${formatDate(activeBook.grantedAt)}` : ''}{' '}
                  {activeBook.grantedBy ? `by ${activeBook.grantedBy.name}` : ''}
                  {activeBook.lastAccessedAt && ` · Last studied: ${formatDate(activeBook.lastAccessedAt)}`}
                </span>
              ) : activeBook.accessStatus === 'revoked' ? (
                <span className="text-[#D12052] dark:text-rose-400">
                  Access revoked {activeBook.revokedAt ? `on ${formatDate(activeBook.revokedAt)}` : ''}{' '}
                  {activeBook.revokedBy ? `by ${activeBook.revokedBy.name}` : ''}. Student progress history is safely preserved.
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
                ) : activeBook.accessStatus === 'revoked' ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setConfirmRestoreBook(activeBook)}
                    loading={updateAccess.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Restore Book Access
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleOpenGrantModal(activeBook)}
                    loading={updateAccess.isPending}
                  >
                    Grant Book Access
                  </Button>
                )}
              </div>

              {/* Progress Report Visibility Toggle */}
              {activeBook.isAssigned && (
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
              )}
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
              </div>
            )}

            {/* Granular Module Release Syllabus */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Phase & Module Access Controls ({activeBook.modules.length} Total)
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Check to release an individual phase to {studentName}
                  </span>
                </div>

                {/* Batch Action Toolbar */}
                {activeBook.isAssigned && batchSelectedModules.size > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {batchSelectedModules.size} selected:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleBatchReleaseSelected(activeBook)}
                      disabled={updateAccess.isPending}
                      className="rounded-lg bg-cyan-500/20 px-2 py-1 font-semibold text-cyan-700 hover:bg-cyan-500/30 dark:text-cyan-300"
                    >
                      Release Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBatchLockSelected(activeBook)}
                      disabled={updateAccess.isPending}
                      className="rounded-lg bg-rose-500/20 px-2 py-1 font-semibold text-[#D12052] hover:bg-rose-500/30 dark:text-rose-300"
                    >
                      Lock Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchSelectedModules(new Set())}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/50 dark:border-white/10 dark:bg-white/[0.02]">
                <ul className="divide-y divide-slate-200/60 dark:divide-white/5">
                  {activeBook.modules.map((m) => {
                    const isCompleted = Boolean(m.readingProgress?.isCompleted);
                    const inProgress = !isCompleted && (m.readingProgress?.totalReadingSeconds || 0) > 0;
                    const isBatchChecked = batchSelectedModules.has(m.id);

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
                          {/* Granular release checkbox */}
                          <input
                            type="checkbox"
                            checked={m.isReleased}
                            onChange={() => handleToggleModule(activeBook, m.id, m.isReleased)}
                            disabled={updateAccess.isPending || !activeBook.isAssigned}
                            className="mt-1 size-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700"
                            title={m.isReleased ? 'Click to lock phase' : 'Click to release phase'}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {m.phaseLabel && (
                                <Badge tone="neutral" className="text-[10px] font-bold">
                                  {m.phaseLabel}
                                </Badge>
                              )}
                              <span className="font-medium text-slate-900 dark:text-white">
                                {m.title}
                              </span>

                              {m.isReleased ? (
                                <Badge tone="success" className="text-[10px]">
                                  Released
                                </Badge>
                              ) : (
                                <Badge tone="neutral" className="text-[10px]">
                                  Locked
                                </Badge>
                              )}

                              {isCompleted && (
                                <Badge tone="success" className="text-[10px]">
                                  ✓ Completed {m.readingProgress.completedAt ? formatDate(m.readingProgress.completedAt) : ''}
                                </Badge>
                              )}
                              {inProgress && (
                                <Badge tone="warning" className="text-[10px]">
                                  ⏱️ In Progress
                                </Badge>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <span>Order: {m.order}</span>
                              <span>•</span>
                              <span>~{m.estimatedMinutes} mins</span>
                              {Boolean(m.readingProgress?.totalReadingSeconds > 0) && (
                                <>
                                  <span>•</span>
                                  <span>⏱️ {formatReadingTime(m.readingProgress.totalReadingSeconds)} read</span>
                                </>
                              )}
                              {m.readingProgress?.lastAccessedAt && (
                                <>
                                  <span>•</span>
                                  <span>Last accessed: {formatDate(m.readingProgress.lastAccessedAt)}</span>
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

                        {/* Right quick actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {activeBook.isAssigned && (
                            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isBatchChecked}
                                onChange={(e) => {
                                  const next = new Set(batchSelectedModules);
                                  if (e.target.checked) next.add(m.id);
                                  else next.delete(m.id);
                                  setBatchSelectedModules(next);
                                }}
                                className="size-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700"
                              />
                              <span className="hidden sm:inline">Select</span>
                            </label>
                          )}
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

      {/* Grant Book Access Scope Modal */}
      {grantModalBook && (
        <Modal
          open={Boolean(grantModalBook)}
          onClose={() => setGrantModalBook(null)}
          title={`Grant Book Access: ${grantModalBook.title}`}
          description={`Configure access scope and release permissions for ${studentName}.`}
          size="lg"
        >
          <div className="space-y-5 p-6">
            {/* Scope Selection */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Initial Access Scope
              </label>

              <div className="space-y-2.5">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200/80 p-3.5 transition-colors cursor-pointer hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.02]">
                  <input
                    type="radio"
                    name="grantScope"
                    value="all"
                    checked={grantScope === 'all'}
                    onChange={() => setGrantScope('all')}
                    className="mt-0.5 size-4 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                      Release entire book (All {grantModalBook.modules.length} phases)
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Instantly unlocks all chapters and learning materials for this student.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200/80 p-3.5 transition-colors cursor-pointer hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.02]">
                  <input
                    type="radio"
                    name="grantScope"
                    value="selected"
                    checked={grantScope === 'selected'}
                    onChange={() => setGrantScope('selected')}
                    className="mt-0.5 size-4 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                      Select specific phases/modules
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Hand-pick which initial phases are released; remaining phases stay locked.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200/80 p-3.5 transition-colors cursor-pointer hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.02]">
                  <input
                    type="radio"
                    name="grantScope"
                    value="none"
                    checked={grantScope === 'none'}
                    onChange={() => setGrantScope('none')}
                    className="mt-0.5 size-4 text-cyan-600 focus:ring-cyan-500"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white block">
                      Grant book only (All phases locked)
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      The book appears in student&apos;s library, but all phases remain locked until released sequentially.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* If selected phases scope chosen: show module checkboxes */}
            {grantScope === 'selected' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Choose phases to release immediately:
                  </span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() =>
                        setGrantSelectedModuleIds(new Set(grantModalBook.modules.map((m) => m.id)))
                      }
                      className="text-cyan-600 hover:underline dark:text-cyan-400"
                    >
                      Select all
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setGrantSelectedModuleIds(new Set())}
                      className="text-slate-500 hover:underline"
                    >
                      Deselect all
                    </button>
                  </div>
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1 rounded-xl border border-slate-200/80 p-2 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
                  {grantModalBook.modules.map((m) => {
                    const checked = grantSelectedModuleIds.has(m.id);
                    return (
                      <label
                        key={m.id}
                        className="flex items-center gap-2.5 rounded-lg p-2 text-xs hover:bg-white dark:hover:bg-white/5 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(grantSelectedModuleIds);
                            if (e.target.checked) next.add(m.id);
                            else next.delete(m.id);
                            setGrantSelectedModuleIds(next);
                          }}
                          className="size-3.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-700"
                        />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {m.phaseLabel ? `${m.phaseLabel}: ` : ''}
                          {m.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Progress Report Permission */}
            <div className="rounded-xl border border-slate-200/80 p-3.5 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={grantCanViewReport}
                  onChange={(e) => setGrantCanViewReport(e.target.checked)}
                  className="mt-0.5 size-4 rounded text-cyan-600 focus:ring-cyan-500 dark:border-slate-700"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                    Allow student to view progress & completion reports
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Disabled by default. When enabled, student can view their progress report for this book.
                  </span>
                </div>
              </label>
            </div>

            {/* Confirmation Box */}
            <div className="rounded-xl bg-cyan-500/10 p-3 text-xs text-cyan-800 dark:text-cyan-200">
              ℹ️ Granting <strong>{grantModalBook.title}</strong> to <strong>{studentName}</strong> with{' '}
              <strong>
                {grantScope === 'all'
                  ? `all ${grantModalBook.modules.length} phases released`
                  : grantScope === 'selected'
                    ? `${grantSelectedModuleIds.size} of ${grantModalBook.modules.length} phases released`
                    : 'all phases initially locked'}
              </strong>
              .
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setGrantModalBook(null)}
                disabled={updateAccess.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmGrant}
                loading={updateAccess.isPending}
              >
                Confirm & Grant Access
              </Button>
            </div>
          </div>
        </Modal>
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
          }
        }}
      />

      {/* Confirm Restore Dialog */}
      <ConfirmDialog
        open={Boolean(confirmRestoreBook)}
        title="Restore book access?"
        message={`Access to ${confirmRestoreBook?.title} will be restored for ${studentName}. Previously released phases and historical learning progress (${confirmRestoreBook?.progress?.completedCount || 0} completed modules) will be immediately available.`}
        confirmLabel="Restore Access"
        loading={updateAccess.isPending}
        onCancel={() => setConfirmRestoreBook(null)}
        onConfirm={async () => {
          if (confirmRestoreBook) {
            await handleRestoreBook(confirmRestoreBook);
          }
        }}
      />
    </section>
  );
}
