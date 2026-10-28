import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import {
  useAdminStudyCatalogue,
  useUpdateStudyModule,
  useAdminStudentsAccess,
  useAdminStudentAccessDetail,
  useUpdateStudentAccess,
} from '../api.js';
import { useAssignments } from '../../assignments/api.js';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Badge, StatusBadge } from '../../../components/ui/Badge.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Icon } from '../../../components/Icon.jsx';

function LinkAssignmentModal({ moduleDoc, open, onClose }) {
  const { data: assignmentsData } = useAssignments({ limit: 100 }, { enabled: open });
  const updateModule = useUpdateStudyModule();
  const [selectedId, setSelectedId] = useState(moduleDoc?.linkedAssignment?.id || '');

  useEffect(() => {
    setSelectedId(moduleDoc?.linkedAssignment?.id || '');
  }, [moduleDoc]);

  const handleSave = async () => {
    await updateModule.mutateAsync({
      id: moduleDoc.id,
      body: { linkedAssignment: selectedId || null },
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Link Assignment: ${moduleDoc?.title || ''}`}
      description="Associate an LMS assignment with this study phase/module."
    >
      <div className="space-y-4">
        <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span>Choose Existing Assignment</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white p-2.5 text-sm dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            <option value="">(No Assignment Linked)</option>
            {assignmentsData?.items?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title} ({a.course?.title || 'Course'})
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} loading={updateModule.isPending}>
            Save Association
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function StudentAccessModal({ studentId, open, onClose }) {
  const { data, isLoading } = useAdminStudentAccessDetail(open ? studentId : null);
  const updateMutation = useUpdateStudentAccess(studentId);
  const [selectedBookIndex, setSelectedBookIndex] = useState(0);

  if (!open) return null;

  const currentBook = data?.books?.[selectedBookIndex];

  const handleToggleModule = (moduleId, currentReleased) => {
    if (!currentBook) return;
    const releasedSet = new Set(
      currentBook.modules.filter((m) => m.isReleased).map((m) => m.id),
    );
    if (currentReleased) {
      releasedSet.delete(moduleId);
    } else {
      releasedSet.add(moduleId);
    }

    updateMutation.mutate({
      bookId: currentBook.bookId,
      isBookAssigned: true,
      releasedModuleIds: Array.from(releasedSet),
    });
  };

  const handleToggleBook = (assigned) => {
    if (!currentBook) return;
    updateMutation.mutate({
      bookId: currentBook.bookId,
      isBookAssigned: !assigned,
    });
  };

  const handleReleaseNext = () => {
    if (!currentBook) return;
    updateMutation.mutate({
      bookId: currentBook.bookId,
      action: 'release_next',
    });
  };

  const handleReleaseAll = () => {
    if (!currentBook) return;
    updateMutation.mutate({
      bookId: currentBook.bookId,
      action: 'release_all',
    });
  };

  const handleLockAll = () => {
    if (!currentBook) return;
    updateMutation.mutate({
      bookId: currentBook.bookId,
      action: 'revoke_all',
    });
  };

  const handleToggleReport = (allowed) => {
    if (!currentBook) return;
    updateMutation.mutate({
      bookId: currentBook.bookId,
      canViewReport: !allowed,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Manage Study Access: ${data?.student?.name || 'Student'}`}
      description="Release specific modules and configure report permissions for this student."
      size="lg"
    >
      {isLoading || !data ? (
        <div className="flex justify-center py-12">
          <Spinner className="size-8 text-cyan-500" label="Loading access settings..." />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Book selector tabs inside modal */}
          <div className="flex border-b border-slate-200/70 pb-3 gap-2 dark:border-white/10">
            {data.books.map((b, idx) => (
              <button
                key={b.bookId}
                type="button"
                onClick={() => setSelectedBookIndex(idx)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  selectedBookIndex === idx
                    ? 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30 dark:text-cyan-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                }`}
              >
                {b.title}
                {b.isAssigned && (
                  <span className="ml-2 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                    Active
                  </span>
                )}
              </button>
            ))}
          </div>

          {currentBook && (
            <div className="space-y-4">
              {/* Book Level Access & Report Setting */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {currentBook.title} Access
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentBook.isAssigned
                      ? 'Student is granted access to this book.'
                      : 'Book is currently locked for this student.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleBook(currentBook.isAssigned)}
                    disabled={updateMutation.isPending}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                      currentBook.isAssigned
                        ? 'border border-rose-500/30 bg-rose-500/15 text-[#D12052] hover:bg-rose-500/25'
                        : 'border border-cyan-500/40 bg-cyan-500/20 text-cyan-700 hover:bg-cyan-500/30 dark:text-cyan-300'
                    }`}
                  >
                    {currentBook.isAssigned ? 'Revoke Entire Book' : 'Grant Book Access'}
                  </button>

                  {currentBook.isAssigned && (
                    <>
                      {currentBook.nextUnreleasedModule && (
                        <button
                          type="button"
                          onClick={handleReleaseNext}
                          disabled={updateMutation.isPending}
                          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-95"
                        >
                          Release Next: {currentBook.nextUnreleasedModule.phaseLabel || currentBook.nextUnreleasedModule.title}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleReleaseAll}
                        disabled={updateMutation.isPending}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      >
                        Release All
                      </button>
                      <button
                        type="button"
                        onClick={handleLockAll}
                        disabled={updateMutation.isPending}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                      >
                        Lock All
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Progress Report Permission Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200/50 bg-white/40 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
                <div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Progress Report Viewing Permission
                  </span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    When disabled, student cannot view their study progress report.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleReport(currentBook.canViewReport)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    currentBook.canViewReport
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {currentBook.canViewReport ? 'Allowed ✓' : 'Hidden ✕'}
                </button>
              </div>

              {/* Granular Module Release List */}
              <div>
                <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Select Modules to Release to Student
                </h5>
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {currentBook.modules.map((m) => (
                    <label
                      key={m.id}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200/60 bg-white/50 px-3.5 py-2.5 transition-colors hover:bg-slate-100/60 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={m.isReleased}
                          onChange={() => handleToggleModule(m.id, m.isReleased)}
                          className="size-4 rounded-md border-slate-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {m.phaseLabel && (
                              <span className="mr-2 font-bold text-cyan-600 dark:text-cyan-400">
                                {m.phaseLabel}:
                              </span>
                            )}
                            {m.title}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={m.status} />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function AdminStudyMaterialsPage() {
  const [activeTab, setActiveTab] = useState('books'); // 'books' | 'access'
  const [selectedBookSlug, setSelectedBookSlug] = useState('dsa-javascript');
  const [managingStudentId, setManagingStudentId] = useState(null);
  const [linkingModule, setLinkingModule] = useState(null);

  const { data: catalogue, isLoading: isCatalogueLoading } = useAdminStudyCatalogue();
  const { data: studentsAccess, isLoading: isAccessLoading } = useAdminStudentsAccess();
  const updateModuleMutation = useUpdateStudyModule();

  if (isCatalogueLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner className="size-10 text-cyan-500" label="Loading study materials..." />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading study books & modules...
        </p>
      </div>
    );
  }

  const selectedBook =
    catalogue?.find((b) => b.slug === selectedBookSlug) || catalogue?.[0];

  const handleToggleStatus = (module) => {
    const nextStatus = module.status === 'published' ? 'draft' : 'published';
    updateModuleMutation.mutate({
      id: module.id,
      body: { status: nextStatus },
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Study Books & Materials
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Publish or unpublish original books, inspect modules, and manage student access.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-2xl border border-slate-200/80 bg-white/70 p-1.5 shadow-xs backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('books')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'books'
                ? 'bg-cyan-500/15 text-cyan-600 shadow-xs border border-cyan-500/30 dark:text-cyan-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Icon name="book-open" className="size-4" />
            <span>Books & Modules</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              activeTab === 'access'
                ? 'bg-cyan-500/15 text-cyan-600 shadow-xs border border-cyan-500/30 dark:text-cyan-400'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Icon name="users" className="size-4" />
            <span>Student Access</span>
          </button>
          <Link
            to="/admin/study-materials/reports"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all"
          >
            <span>📊</span>
            <span>Progress Reports</span>
          </Link>
        </div>
      </div>

      {activeTab === 'books' && (
        <div className="space-y-6">
          {/* Books Selector Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {catalogue?.map((book) => {
              const isSelected = book.slug === selectedBook?.slug;
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBookSlug(book.slug)}
                  className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300 ${
                    isSelected
                      ? 'border-cyan-500/50 bg-white/95 shadow-[0_10px_30px_rgba(3,174,210,0.18)] dark:bg-[#12182d] dark:border-cyan-400/50'
                      : 'border-slate-200/70 bg-white/60 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1.5 opacity-90 transition-opacity"
                    style={{ background: book.gradient }}
                  />
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                      {book.category.toUpperCase()}
                    </span>
                    <Badge tone={book.publishedModules === book.totalModules ? 'success' : 'warning'}>
                      {book.publishedModules} / {book.totalModules} Published
                    </Badge>
                  </div>
                  <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                    {book.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                    {book.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Book Header & Modules Table */}
          {selectedBook && (
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02]">
              <div className="flex flex-col gap-3 border-b border-slate-200/70 p-6 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedBook.title}
                    </h2>
                    <Badge tone="info">{selectedBook.totalModules} Modules</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {selectedBook.description}
                  </p>
                </div>
              </div>

              {/* Modules list */}
              <div className="divide-y divide-slate-200/60 dark:divide-white/5">
                {selectedBook.modules.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-4 p-5 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {m.phaseLabel && (
                          <span className="rounded-lg bg-cyan-500/15 px-2 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
                            {m.phaseLabel}
                          </span>
                        )}
                        <h4 className="truncate text-base font-semibold text-slate-900 dark:text-white">
                          {m.title}
                        </h4>
                        <StatusBadge status={m.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                          📄 {m.originalFilename}
                        </span>
                        <span>•</span>
                        <span>{(m.fileBytes / 1024).toFixed(0)} KB</span>
                        <span>•</span>
                        <span>~{m.estimatedMinutes} mins</span>
                        {m.linkedAssignment && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                              📝 Linked: {m.linkedAssignment.title}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions: Preview, Link Assignment, & Publish toggle */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      <Link
                        to={`/admin/study-materials/preview/${m.id}`}
                        className="flex items-center gap-1.5 rounded-xl border border-slate-300/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                        title="Read and preview this HTML document"
                      >
                        <span>👁️ Preview</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => setLinkingModule(m)}
                        className="rounded-xl border border-slate-300/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white"
                        title="Associate an LMS assignment with this module"
                      >
                        <span>🔗 Assignment</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(m)}
                        disabled={updateModuleMutation.isPending}
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                          m.status === 'published'
                            ? 'border border-amber-500/40 bg-amber-500/15 text-amber-800 hover:bg-amber-500/25 dark:text-amber-300'
                            : 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/25 dark:text-emerald-300'
                        }`}
                      >
                        {m.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'access' && (
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02]">
          <div className="border-b border-slate-200/70 p-6 dark:border-white/10">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Student Study Access Matrix
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Grant book access and release specific phases to individual students.
            </p>
          </div>

          {isAccessLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="size-8 text-cyan-500" label="Loading students..." />
            </div>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-white/5">
              {studentsAccess?.map((item) => (
                <div
                  key={item.student.id}
                  className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-semibold text-slate-900 dark:text-white">
                      {item.student.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {item.student.email}
                    </p>

                    {/* Book assignment tags */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.books.map((b) => (
                        <span
                          key={b.bookId}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                            b.isAssigned
                              ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : 'border border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400'
                          }`}
                        >
                          {b.title}:{' '}
                          <span className="font-bold">
                            {b.isAssigned ? `${b.releasedCount} released` : 'Locked'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setManagingStudentId(item.student.id)}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/25 dark:text-cyan-300"
                  >
                    <span>Manage Access</span>
                    <span>→</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student Access Modal */}
      <StudentAccessModal
        studentId={managingStudentId}
        open={Boolean(managingStudentId)}
        onClose={() => setManagingStudentId(null)}
      />

      {/* Link Assignment Modal */}
      <LinkAssignmentModal
        moduleDoc={linkingModule}
        open={Boolean(linkingModule)}
        onClose={() => setLinkingModule(null)}
      />
    </div>
  );
}
