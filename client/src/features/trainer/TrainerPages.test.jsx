import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrainerDashboardPage } from './dashboard/TrainerDashboardPage.jsx';
import { ReportsPage } from './reports/ReportsPage.jsx';
import { CourseReportPage } from './reports/CourseReportPage.jsx';
import { coursesApi } from '../courses/api.js';
import { ADMIN } from '../courses/test-fixtures.js';
import { trainerApi } from './api.js';
import { makeCourseReport, makeCourseSummary, makeDashboard, page } from './test-fixtures.js';
import { apiError, notFoundError, renderWithProviders } from '../../test/renderWithProviders.jsx';

const routes = [
  { path: '/admin', element: <TrainerDashboardPage /> },
  { path: '/admin/reports', element: <ReportsPage /> },
  { path: '/admin/reports/courses/:courseId', element: <CourseReportPage /> },
];
const open = (path) => renderWithProviders(routes, { path, user: ADMIN });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TrainerDashboardPage', () => {
  it('shows the server’s figures with links to act on them', async () => {
    vi.spyOn(trainerApi, 'dashboard').mockResolvedValue(makeDashboard());
    open('/admin');
    expect(screen.getByLabelText('Loading dashboard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Welcome, Tara' })).toBeInTheDocument();
    // The welcome shows at once; wait for the figures.
    await screen.findByRole('region', { name: 'Waiting for review' });

    const stat = (label) =>
      screen.getByRole('link', { name: label }).closest('dt').nextElementSibling;
    expect(stat('Students')).toHaveTextContent('12');
    expect(screen.getByText('9 enrolled · 5 active this week')).toBeInTheDocument();
    expect(stat('Waiting for review')).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: 'Waiting for review' })).toHaveAttribute(
      'href',
      '/admin/reviews',
    );
    expect(stat('Overdue assignments')).toHaveTextContent('4');
    expect(stat('Overdue assignments')).toHaveClass('text-red-700');
    expect(screen.getByText('across 3 students')).toBeInTheDocument();

    const queue = screen.getByRole('region', { name: 'Waiting for review' });
    expect(within(queue).getByRole('link', { name: /Review Asha Rao/ })).toHaveAttribute(
      'href',
      '/admin/courses/c1/assignments/a1/submissions/sub1',
    );
    expect(within(queue).getByRole('link', { name: 'Review queue (3)' })).toBeInTheDocument();

    const courses = screen.getByRole('region', { name: 'Courses' });
    expect(within(courses).getByRole('link', { name: 'MERN Development' })).toHaveAttribute(
      'href',
      '/admin/reports/courses/c1',
    );
    expect(
      within(courses).getByRole('progressbar', { name: 'MERN Development average progress' }),
    ).toHaveAttribute('aria-valuenow', '14');
    expect(within(courses).getByText('3 overdue')).toBeInTheDocument();

    const overdue = screen.getByRole('region', { name: 'Overdue' });
    expect(overdue).toHaveTextContent('7 of 10 handed in · 3 missing · late work still accepted');
    expect(within(overdue).getByRole('link', { name: 'Personal Profile Page' })).toHaveAttribute(
      'href',
      '/admin/courses/c1/assignments/a1',
    );
    expect(screen.getByRole('region', { name: 'Due this week' })).toHaveTextContent(
      '4 of 10 handed in · 6 still to hand in',
    );
    expect(screen.getByRole('region', { name: 'Recent activity' })).toHaveTextContent(
      'Asha Rao handed in attempt 2 of Personal Profile Page',
    );
  });

  it('approves an enrollment request from the dashboard', async () => {
    vi.spyOn(trainerApi, 'dashboard').mockResolvedValue(makeDashboard());
    const update = vi.spyOn(coursesApi, 'updateEnrollment').mockResolvedValue({});
    open('/admin');
    const requests = await screen.findByRole('region', { name: 'Enrollment requests' });
    expect(within(requests).getByRole('link', { name: 'Kabir Singh' })).toHaveAttribute(
      'href',
      '/admin/students/st2',
    );
    await userEvent.click(within(requests).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('e2', 'active'));
    expect(await screen.findByText('Kabir Singh enrolled.')).toBeInTheDocument();
  });

  it('shows empty lists for a new install, and errors with a retry', async () => {
    const empty = makeDashboard({
      courses: [],
      reviewQueue: [],
      pendingRequests: { total: 0, items: [] },
      upcoming: [],
      overdue: [],
      recentActivity: [],
    });
    const dashboard = vi
      .spyOn(trainerApi, 'dashboard')
      .mockRejectedValueOnce(apiError(500, 'Server down'))
      .mockResolvedValue(empty);
    open('/admin');
    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument();
    expect(screen.getByText('No assignments are due in the next 7 days.')).toBeInTheDocument();
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Enrollment requests' })).not.toBeInTheDocument();
    expect(dashboard).toHaveBeenCalledTimes(2);
  });
});

describe('ReportsPage', () => {
  it('lists course rows and labelled totals, and filters by status', async () => {
    const reports = vi.spyOn(trainerApi, 'courseReports').mockResolvedValue(
      page(
        [
          makeCourseSummary(),
          makeCourseSummary({ id: 'c9', title: 'Old', status: 'archived', overdue: 0 }),
        ],
        {
          limit: 50,
          totals: {
            courses: 2,
            enrollments: { active: 4, pending: 1, removed: 0 },
            completedEnrollments: 0,
            publishedAssignments: 4,
            reviews: { submitted: 2, resubmitted: 0, resubmit_requested: 2, reviewed: 2 },
            overdue: 3,
          },
        },
      ),
    );
    open('/admin/reports');
    const table = await screen.findByRole('table', { name: 'Course reports' });
    expect(within(table).getByRole('link', { name: 'MERN Development' })).toHaveAttribute(
      'href',
      '/admin/reports/courses/c1',
    );
    const mern = within(table).getByRole('row', { name: /MERN Development/ });
    expect(
      within(mern)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['2', '1', '14%', '0', '2', '1', '1', '1', '3']);
    expect(
      within(table).getByRole('rowheader', { name: 'Totals (2 courses shown)' }),
    ).toBeInTheDocument();
    expect(within(table).getByText('Archived')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Archived' }));
    await waitFor(() =>
      expect(reports.mock.calls.at(-1)[0]).toEqual({ page: 1, limit: 50, status: 'archived' }),
    );
  });
});

describe('CourseReportPage', () => {
  it('shows class progress, the distribution, modules, assignments and students', async () => {
    const report = vi.spyOn(trainerApi, 'courseReport').mockResolvedValue(makeCourseReport());
    open('/admin/reports/courses/c1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'MERN Development' }),
    ).toBeInTheDocument();
    expect(report.mock.calls[0]).toEqual([
      'c1',
      { page: 1, limit: 20, enrollment: 'active', sort: 'name' },
    ]);
    const stat = (label) => screen.getByText(label).nextElementSibling;
    expect(stat('Average progress')).toHaveTextContent('14%');

    const bars = screen.getByRole('list', { name: 'Students per progress range' });
    expect(
      within(bars)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Not started0', '1–24%2', '25–49%0', '50–74%0', '75–99%0', 'Completed0']);
    expect(
      screen.getByRole('progressbar', { name: 'HTML Fundamentals completion' }),
    ).toHaveAttribute('aria-valuenow', '83');
    const assignments = screen.getByRole('table', { name: 'Assignment statistics' });
    expect(within(assignments).getByText('2 of 2')).toBeInTheDocument();
    expect(within(assignments).getByText('86 / 100')).toBeInTheDocument();

    const students = screen.getByRole('region', { name: 'Students' });
    expect(within(students).getByRole('link', { name: 'Aarav Mehta' })).toHaveAttribute(
      'href',
      '/admin/students/st1',
    );
    expect(within(students).getByText('1 overdue')).toBeInTheDocument();
    expect(within(students).getByRole('button', { name: 'Requests 1' })).toBeInTheDocument();
  });

  it('switches the student list and sorts it', async () => {
    const report = vi.spyOn(trainerApi, 'courseReport').mockResolvedValue(makeCourseReport());
    open('/admin/reports/courses/c1');
    const user = userEvent.setup();
    await screen.findByRole('region', { name: 'Students' });
    await user.click(screen.getByRole('button', { name: 'Removed 0' }));
    await user.selectOptions(screen.getByLabelText('Order'), 'progress_asc');
    await waitFor(() =>
      expect(report.mock.calls.at(-1)).toEqual([
        'c1',
        { page: 1, limit: 20, enrollment: 'removed', sort: 'progress_asc' },
      ]),
    );
  });

  it('shows a missing course', async () => {
    vi.spyOn(trainerApi, 'courseReport').mockRejectedValue(notFoundError());
    open('/admin/reports/courses/zz');
    expect(await screen.findByText('This course does not exist.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Reports' })).toHaveAttribute(
      'href',
      '/admin/reports',
    );
  });
});
