import { useState } from 'react';
import { Link } from 'react-router';
import { useAdminStudyReports } from '../api.js';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';

function formatReadingTime(seconds = 0) {
  if (!seconds) return '0m';
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function AdminStudyReportsPage() {
  const [subjectFilter, setSubjectFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, error, refetch } = useAdminStudyReports({
    subject: subjectFilter || undefined,
    search: search || undefined,
  });

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (subjectFilter) params.append('subject', subjectFilter);
    const url = `/api/v1/study-materials/admin/reports/export?${params.toString()}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Spinner className="size-10 text-cyan-500" label="Loading reports..." />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading student study progress reports...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-[#D12052] dark:text-rose-300">
        <p>Failed to load study reports.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  const { rows = [] } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/admin/study-materials"
              className="text-xs font-semibold text-cyan-600 hover:underline dark:text-cyan-400"
            >
              ← Manage Books Catalogue
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Study Books Student Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Real-time syllabus completion, telemetry durations, and visibility permissions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            <span>📥</span>
            <span>Export CSV Report</span>
          </button>
          <Link
            to="/admin/study-materials"
            className="rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-cyan-600"
          >
            Manage Student Access
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'All Subjects', value: '' },
            { label: 'DSA in JS', value: 'dsa' },
            { label: 'JavaScript', value: 'javascript' },
            { label: 'React JS', value: 'react' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSubjectFilter(tab.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                subjectFilter === tab.value
                  ? 'bg-cyan-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search student name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-hidden dark:border-white/10 dark:bg-slate-900/80 dark:text-white"
          />
        </div>
      </div>

      {/* Reports Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/70 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.02]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50 text-xs font-semibold text-slate-500 dark:border-white/5 dark:bg-white/[0.01] dark:text-slate-400">
                <th className="px-6 py-4">Student</th>
                <th className="px-4 py-4 text-center">Assigned Books</th>
                <th className="px-4 py-4 text-center">Modules (Done / Released)</th>
                <th className="px-4 py-4 text-center">Active Reading Time</th>
                <th className="px-6 py-4">Syllabus Completion</th>
                <th className="px-4 py-4 text-center">Report Visibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 text-xs dark:divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No students match the selected filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.student.id}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                  >
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      <div>
                        <div className="font-semibold text-sm">{row.student.name}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                          {row.student.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge tone={row.assignedBooksCount > 0 ? 'info' : 'neutral'}>
                        {row.assignedBooksCount} of 3 Books
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-center font-medium">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {row.totalCompletedModules}
                      </span>
                      <span className="text-slate-400"> / {row.totalReleasedModules}</span>
                    </td>
                    <td className="px-4 py-4 text-center font-medium text-cyan-600 dark:text-cyan-400">
                      ⏱️ {formatReadingTime(row.totalReadingSeconds)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-36 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {row.overallPercent}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                          <div
                            className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                            style={{ width: `${row.overallPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge tone={row.books.every((b) => b.canViewReport) ? 'success' : 'warning'}>
                        {row.books.every((b) => b.canViewReport) ? 'Visible' : 'Hidden by Admin'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
