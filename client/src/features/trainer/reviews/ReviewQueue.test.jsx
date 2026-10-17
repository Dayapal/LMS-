import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewQueuePage } from './ReviewQueuePage.jsx';
import { SubmissionReviewPage } from '../../assignments/admin/SubmissionReviewPage.jsx';
import { assignmentsApi } from '../../assignments/api.js';
import { coursesApi } from '../../courses/api.js';
import {
  makeAssignment,
  makeSubmission,
  page as assignmentPage,
} from '../../assignments/test-fixtures.js';
import { ADMIN, makeCourse } from '../../courses/test-fixtures.js';
import { trainerApi } from '../api.js';
import { makeQueueRow, queuePage, reviewCounts } from '../test-fixtures.js';
import { apiError, renderWithProviders } from '../../../test/renderWithProviders.jsx';

const routes = [
  { path: '/admin/reviews', element: <ReviewQueuePage /> },
  {
    path: '/admin/courses/:courseId/assignments/:assignmentId/submissions/:submissionId',
    element: <SubmissionReviewPage />,
  },
];
const open = (path = '/admin/reviews') => renderWithProviders(routes, { path, user: ADMIN });

const rows = [
  makeQueueRow(),
  makeQueueRow({
    id: 'sub2',
    attempt: 2,
    attempts: 2,
    isLate: true,
    enrollmentStatus: 'removed',
    student: { id: 'st2', name: 'Vikram Shah', email: 'vikram@example.com' },
  }),
];

beforeEach(() => {
  vi.spyOn(coursesApi, 'list').mockResolvedValue(
    assignmentPage([makeCourse(), makeCourse({ id: 'c2', title: 'DSA with JavaScript' })]),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ReviewQueuePage', () => {
  it('lists work waiting for review with its details and tab counts', async () => {
    const queue = vi.spyOn(trainerApi, 'queue').mockResolvedValue(queuePage(rows));
    open();
    expect(screen.getByLabelText('Loading submissions')).toBeInTheDocument();
    const list = await screen.findByRole('list', { name: 'Submissions' });
    expect(queue.mock.calls[0][0]).toEqual({
      page: 1,
      limit: 20,
      sort: 'priority',
      status: 'submitted',
    });

    const [first, second] = within(list).getAllByRole('listitem');
    expect(within(first).getByRole('link', { name: 'Asha Rao' })).toHaveAttribute(
      'href',
      '/admin/students/st1',
    );
    expect(within(first).getByText('Personal Profile Page')).toBeInTheDocument();
    expect(within(first).getByText(/MERN Development · Attempt 1 of 2 · Due/)).toBeInTheDocument();
    expect(
      within(first).getByRole('link', { name: /Review Asha Rao's submission/ }),
    ).toHaveAttribute('href', '/admin/courses/c1/assignments/a1/submissions/sub1');
    expect(within(second).getByText('Resubmission')).toBeInTheDocument();
    expect(within(second).getByText('Late')).toBeInTheDocument();
    expect(within(second).getByText('Removed')).toBeInTheDocument();

    const tabs = screen.getByRole('group', { name: 'Review state' });
    expect(within(tabs).getByRole('button', { name: 'To review 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(tabs).getByRole('button', { name: 'All 5' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('sends the chosen state, course, assignment, timing and order', async () => {
    const queue = vi.spyOn(trainerApi, 'queue').mockResolvedValue(queuePage(rows));
    const assignments = vi
      .spyOn(assignmentsApi, 'list')
      .mockResolvedValue(assignmentPage([makeAssignment({ id: 'a7', title: 'Sorting' })]));
    open();
    const user = userEvent.setup();
    await screen.findByRole('list', { name: 'Submissions' });

    await user.click(screen.getByRole('button', { name: 'All 5' }));
    await waitFor(() => expect(queue.mock.calls.at(-1)[0]).not.toHaveProperty('status'));
    await user.click(screen.getByRole('button', { name: 'Reviewed 1' }));
    await waitFor(() => expect(queue.mock.calls.at(-1)[0]).toMatchObject({ status: 'reviewed' }));

    await user.selectOptions(await screen.findByLabelText('Course'), 'c2');
    await waitFor(() =>
      expect(assignments.mock.calls.at(-1)[0]).toEqual({ course: 'c2', limit: 100 }),
    );
    await user.selectOptions(await screen.findByLabelText('Assignment'), 'a7');
    await user.selectOptions(screen.getByLabelText('Timing'), 'true');
    await user.selectOptions(screen.getByLabelText('Order'), 'oldest');
    await waitFor(() =>
      expect(queue.mock.calls.at(-1)[0]).toEqual({
        page: 1,
        limit: 20,
        status: 'reviewed',
        course: 'c2',
        assignment: 'a7',
        late: 'true',
        sort: 'oldest',
      }),
    );
  });

  it('searches after typing pauses', async () => {
    const queue = vi.spyOn(trainerApi, 'queue').mockResolvedValue(queuePage(rows));
    open();
    await screen.findByRole('list', { name: 'Submissions' });
    await userEvent.type(screen.getByLabelText('Search students or assignments'), 'vik');
    await waitFor(() => expect(queue.mock.calls.at(-1)[0]).toMatchObject({ q: 'vik' }));
  });

  it('shows the empty and error states', async () => {
    const queue = vi
      .spyOn(trainerApi, 'queue')
      .mockResolvedValueOnce(queuePage([], reviewCounts({ all: 0, submitted: 0 })))
      .mockRejectedValueOnce(apiError(500, 'Server down'))
      .mockResolvedValue(queuePage(rows));
    open();
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reviewed 1' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server down');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('list', { name: 'Submissions' })).toBeInTheDocument();
    expect(queue).toHaveBeenCalledTimes(3);
  });

  it('opens the existing review page, which links back to the queue and refreshes it', async () => {
    vi.spyOn(trainerApi, 'queue').mockResolvedValue(queuePage(rows));
    const submission = {
      ...makeSubmission({ id: 'sub1' }),
      assignment: makeAssignment({ maxMarks: 100 }),
      history: [{ ...makeSubmission(), id: 'sub1' }],
    };
    vi.spyOn(assignmentsApi, 'submission').mockResolvedValue(submission);
    const review = vi.spyOn(assignmentsApi, 'review').mockResolvedValue(submission);
    const { router, queryClient } = open('/admin/reviews?late=true');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: /Review Asha Rao's submission/ }));
    const back = await screen.findByRole('link', { name: '← Review queue' });
    expect(back).toHaveAttribute('href', '/admin/reviews?late=true');

    await user.type(screen.getByLabelText(/Marks \(out of 100\)/), '90');
    await user.click(screen.getByRole('button', { name: 'Save review' }));
    await waitFor(() => expect(review).toHaveBeenCalled());
    expect(review.mock.calls[0][0]).toBe('sub1');
    // The queue's data is marked stale, so it shows the new state on return.
    await waitFor(() =>
      expect(
        queryClient.getQueryCache().findAll({ queryKey: ['trainer', 'queue'] })[0].state
          .isInvalidated,
      ).toBe(true),
    );

    await user.click(back);
    expect(router.state.location.search).toBe('?late=true');
    expect(await screen.findByRole('list', { name: 'Submissions' })).toBeInTheDocument();
  });
});
