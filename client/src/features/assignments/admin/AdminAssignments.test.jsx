import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assignmentsApi } from '../api.js';
import { coursesApi } from '../../courses/api.js';
import { AssignmentEditorPage } from './AssignmentEditorPage.jsx';
import { AdminAssignmentPage } from './AdminAssignmentPage.jsx';
import { SubmissionReviewPage } from './SubmissionReviewPage.jsx';
import { CourseBuilderPage } from '../../courses/admin/CourseBuilderPage.jsx';
import { renderWithProviders, apiError } from '../../../test/renderWithProviders.jsx';
import { ADMIN, makeRoadmap } from '../../courses/test-fixtures.js';
import { makeAssignment, makeSubmission, page } from '../test-fixtures.js';
import { fromLocalInput } from '../format.js';

const base = '/admin/courses/:courseId/assignments';
const routes = [
  { path: '/admin/courses/:courseId', element: <CourseBuilderPage /> },
  { path: `${base}/new`, element: <AssignmentEditorPage /> },
  { path: `${base}/:assignmentId`, element: <AdminAssignmentPage /> },
  { path: `${base}/:assignmentId/edit`, element: <AssignmentEditorPage /> },
  { path: `${base}/:assignmentId/submissions/:submissionId`, element: <SubmissionReviewPage /> },
];

const adminAssignment = (overrides = {}) =>
  makeAssignment({ stats: { students: 2, awaitingReview: 1 }, ...overrides });

const render = (path) => renderWithProviders(routes, { path, user: ADMIN });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Course builder assignments tab', () => {
  it('lists the course’s assignments with placement and review counts', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(makeRoadmap());
    const list = vi
      .spyOn(assignmentsApi, 'list')
      .mockResolvedValue(page([adminAssignment({ lessonId: 'l1' })]));
    render('/admin/courses/c1');
    await userEvent.click(await screen.findByRole('tab', { name: 'Assignments' }));

    const link = await screen.findByRole('link', { name: 'Personal Profile Page' });
    expect(link).toHaveAttribute('href', '/admin/courses/c1/assignments/a1');
    expect(screen.getByText(/HTML Fundamentals › Lesson l1/)).toBeInTheDocument();
    expect(screen.getByText(/1 to review/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New assignment' })).toHaveAttribute(
      'href',
      '/admin/courses/c1/assignments/new',
    );
    expect(list.mock.calls[0][0]).toMatchObject({ course: 'c1' });
  });
});

describe('AssignmentEditorPage', () => {
  const openNew = () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(makeRoadmap());
    const get = vi.spyOn(assignmentsApi, 'get');
    render('/admin/courses/c1/assignments/new');
    return { get };
  };

  it('validates before saving, including the late cutoff', async () => {
    const create = vi.spyOn(assignmentsApi, 'create');
    const { get } = openNew();
    const user = userEvent.setup();
    const title = await screen.findByLabelText(/^Title/);
    expect(get).not.toHaveBeenCalled();

    await user.type(title, 'ab');
    await user.click(screen.getByLabelText('GitHub repository')); // unticks the default
    await user.click(screen.getByLabelText(/Accept late work/));
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));

    expect(await screen.findByText('Title must be at least 3 characters')).toBeInTheDocument();
    expect(screen.getByText('Allow at least one way to submit')).toBeInTheDocument();
    expect(screen.getByText('Set the last date late work is accepted')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Accept late work until/), '2020-01-01T10:00');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));
    expect(
      await screen.findByText('The late cutoff must be after the due date'),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('creates an assignment in a lesson with UTC dates and a late policy', async () => {
    const create = vi.spyOn(assignmentsApi, 'create').mockResolvedValue(makeAssignment());
    vi.spyOn(assignmentsApi, 'get').mockResolvedValue(adminAssignment());
    vi.spyOn(assignmentsApi, 'submissions').mockResolvedValue(page([]));
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(makeRoadmap());
    const { router } = render('/admin/courses/c1/assignments/new');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/^Title/), 'Contact form');
    await user.selectOptions(screen.getByLabelText('Belongs to'), 'lesson:l1');
    const due = screen.getByLabelText(/^Due/);
    await user.clear(due);
    await user.type(due, '2030-03-10T23:59');
    await user.clear(screen.getByLabelText(/^Maximum marks/));
    await user.type(screen.getByLabelText(/^Maximum marks/), '50');
    await user.clear(screen.getByLabelText(/Attempts allowed/));
    await user.click(screen.getByLabelText('Code snippet'));
    await user.click(screen.getByLabelText(/Accept late work/));
    await user.type(screen.getByLabelText(/Accept late work until/), '2030-03-12T23:59');
    await user.clear(screen.getByLabelText(/Late penalty/));
    await user.type(screen.getByLabelText(/Late penalty/), '20');
    await user.type(screen.getByLabelText('Objectives'), 'Validate input{enter}Show errors');
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toEqual({
      courseId: 'c1',
      title: 'Contact form',
      status: 'draft',
      moduleId: null,
      lessonId: 'l1',
      dueAt: fromLocalInput('2030-03-10T23:59'),
      maxMarks: 50,
      maxAttempts: null,
      allowedSubmissionTypes: ['github_url', 'code'],
      latePolicy: {
        allowLate: true,
        lateUntil: fromLocalInput('2030-03-12T23:59'),
        penaltyPercent: 20,
      },
      objectives: ['Validate input', 'Show errors'],
      instructions: '',
      attachmentIds: [],
    });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/courses/c1/assignments/a1'),
    );
  });

  it('puts server errors on the right fields and uploads handouts first', async () => {
    const uploadAttachment = vi
      .spyOn(assignmentsApi, 'uploadAttachment')
      .mockResolvedValue({ id: 'h1', originalName: 'brief.pdf', size: 10 });
    const create = vi
      .spyOn(assignmentsApi, 'create')
      .mockRejectedValue(
        apiError(400, 'Some fields are invalid', [
          { path: 'lessonId', message: 'Choose a lesson from this course' },
        ]),
      );
    openNew();
    const user = userEvent.setup({ applyAccept: false });
    await user.type(await screen.findByLabelText(/^Title/), 'Contact form');
    const brief = new File(['%PDF'], 'brief.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Add files'), [
      brief,
      new File(['x'], 'virus.exe', { type: 'application/x-msdownload' }),
    ]);
    expect(screen.getByText('Only PDF, DOCX and PPTX files are allowed')).toBeInTheDocument();
    expect(screen.getByText(/uploaded when you save/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));

    expect(await screen.findByText('Choose a lesson from this course')).toBeInTheDocument();
    expect(screen.getByLabelText('Belongs to')).toHaveAttribute('aria-invalid', 'true');
    expect(uploadAttachment.mock.calls[0].slice(0, 2)).toEqual(['c1', brief]);
    expect(create.mock.calls[0][0].attachmentIds).toEqual(['h1']);

    // A retry doesn't upload the handout again.
    await user.click(screen.getByRole('button', { name: 'Create assignment' }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(uploadAttachment).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[1][0].attachmentIds).toEqual(['h1']);
  });

  it('loads an existing assignment for editing', async () => {
    vi.spyOn(coursesApi, 'roadmap').mockResolvedValue(makeRoadmap());
    vi.spyOn(assignmentsApi, 'get').mockResolvedValue(
      adminAssignment({ lessonId: 'l1', maxAttempts: null }),
    );
    const update = vi.spyOn(assignmentsApi, 'update').mockResolvedValue(makeAssignment());
    render('/admin/courses/c1/assignments/a1/edit');
    const user = userEvent.setup();
    expect(await screen.findByLabelText(/^Title/)).toHaveValue('Personal Profile Page');
    expect(screen.getByLabelText('Belongs to')).toHaveValue('lesson:l1');
    expect(screen.getByLabelText(/Attempts allowed/)).toHaveValue(null);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toBe('a1');
    expect(update.mock.calls[0][1]).not.toHaveProperty('courseId');
  });
});

describe('AdminAssignmentPage', () => {
  it('shows details and the latest submission per student, with filters', async () => {
    vi.spyOn(assignmentsApi, 'get').mockResolvedValue(adminAssignment());
    const submissions = vi.spyOn(assignmentsApi, 'submissions').mockResolvedValue(
      page([
        { ...makeSubmission({ attempt: 2, isLate: true }), attempts: 2 },
        {
          ...makeSubmission({
            id: 's2',
            student: { id: 'st2', name: 'Ravi Kumar', email: 'ravi@example.com' },
            status: 'reviewed',
            review: { marks: 80, finalMarks: 80, reviewedAt: null },
          }),
          attempts: 1,
        },
      ]),
    );
    render('/admin/courses/c1/assignments/a1');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Personal Profile Page' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 students submitted · 1 waiting for review/)).toBeInTheDocument();

    const section = screen.getByRole('region', { name: 'Submissions' });
    const rows = within(await within(section).findByRole('list')).getAllByRole('listitem');
    expect(within(rows[0]).getByText(/Attempt 2 of 2/)).toBeInTheDocument();
    expect(within(rows[0]).getByText('Late')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link', { name: /Asha Student/ })).toHaveAttribute(
      'href',
      '/admin/courses/c1/assignments/a1/submissions/s1',
    );
    expect(within(rows[1]).getByText('80 / 100')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'To review' }));
    await waitFor(() =>
      expect(submissions).toHaveBeenLastCalledWith('a1', {
        page: 1,
        limit: 20,
        status: 'submitted',
      }),
    );
  });

  it('publishes, and shows the server’s refusal to delete', async () => {
    vi.spyOn(assignmentsApi, 'get').mockResolvedValue(adminAssignment({ status: 'draft' }));
    vi.spyOn(assignmentsApi, 'submissions').mockResolvedValue(page([]));
    const update = vi.spyOn(assignmentsApi, 'update').mockResolvedValue({});
    vi.spyOn(assignmentsApi, 'remove').mockRejectedValue(
      apiError(409, 'Students have already submitted work for this assignment.'),
    );
    render('/admin/courses/c1/assignments/a1');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(update).toHaveBeenCalledWith('a1', { status: 'published' }));

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete assignment' }),
    );
    expect(
      await screen.findByText('Students have already submitted work for this assignment.'),
    ).toBeInTheDocument();
  });
});

describe('SubmissionReviewPage', () => {
  const reviewData = (overrides = {}) => ({
    ...makeSubmission({
      isLate: true,
      note: 'Please check the form',
      items: [
        { type: 'github_url', url: 'https://github.com/asha/profile' },
        { type: 'code', code: { language: 'javascript', source: 'const ok = true;' } },
      ],
    }),
    assignment: makeAssignment({
      maxMarks: 50,
      maxAttempts: 2,
      latePolicy: { allowLate: true, lateUntil: '2030-01-01T00:00:00Z', penaltyPercent: 20 },
    }),
    history: [{ ...makeSubmission(), id: 's1' }],
    ...overrides,
  });
  const path = '/admin/courses/c1/assignments/a1/submissions/s1';

  it('shows the work and grades it, previewing the late penalty', async () => {
    vi.spyOn(assignmentsApi, 'submission').mockResolvedValue(reviewData());
    const review = vi.spyOn(assignmentsApi, 'review').mockResolvedValue(reviewData());
    render(path);
    const user = userEvent.setup();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Asha Student' }),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /github\.com\/asha\/profile/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(screen.getByRole('region', { name: 'Code: Submitted code 2' })).toHaveTextContent(
      'const ok = true;',
    );
    expect(screen.getByText('Please check the form')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Marks \(out of 50\)/), '60');
    await user.click(screen.getByRole('button', { name: 'Save review' }));
    expect(await screen.findByText('At most 50 marks')).toBeInTheDocument();

    const marks = screen.getByLabelText(/Marks \(out of 50\)/);
    await user.clear(marks);
    await user.type(marks, '45.5');
    expect(screen.getByText(/gets 36.4 after the 20% penalty/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Feedback'), 'Nice work');
    await user.click(screen.getByRole('button', { name: 'Save review' }));
    await waitFor(() => expect(review).toHaveBeenCalled());
    expect(review.mock.calls[0]).toEqual(['s1', { marks: 45.5, feedback: 'Nice work' }]);
  });

  it('says a student PDF was type-checked but not virus-scanned', async () => {
    const pdf = { id: 'f1', originalName: 'answers.pdf', mimeType: 'application/pdf', size: 2048 };
    vi.spyOn(assignmentsApi, 'submission').mockResolvedValue(
      reviewData({ items: [{ type: 'pdf', file: pdf }] }),
    );
    render(path);
    expect(await screen.findByText(/answers\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/not scanned for viruses/)).toBeInTheDocument();
    expect(screen.queryByText(/virus-free|scanned and safe/i)).not.toBeInTheDocument();
  });

  it('requires feedback to request a resubmission, with optional marks', async () => {
    vi.spyOn(assignmentsApi, 'submission').mockResolvedValue(reviewData());
    const request = vi.spyOn(assignmentsApi, 'requestResubmission').mockResolvedValue({});
    render(path);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Request resubmission' }));
    expect(await screen.findByText('Tell the student what to change')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Feedback'), 'Add validation');
    await user.click(screen.getByRole('button', { name: 'Request resubmission' }));
    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(request.mock.calls[0]).toEqual(['s1', { marks: null, feedback: 'Add validation' }]);
  });

  it('offers only a final review when no attempts are left', async () => {
    vi.spyOn(assignmentsApi, 'submission').mockResolvedValue(
      reviewData({ attempt: 2, history: [{ ...makeSubmission(), id: 's1', attempt: 2 }] }),
    );
    render(path);
    expect(await screen.findByRole('button', { name: 'Request resubmission' })).toBeDisabled();
    expect(screen.getByText(/used all 2 attempts/)).toBeInTheDocument();
  });

  it('shows an earlier attempt read-only', async () => {
    vi.spyOn(assignmentsApi, 'submission').mockResolvedValue(
      reviewData({
        status: 'resubmit_requested',
        review: { marks: 20, finalMarks: 16, feedback: 'Try again', reviewedAt: null },
        history: [
          { ...makeSubmission(), id: 's2', attempt: 2 },
          { ...makeSubmission(), id: 's1', status: 'resubmit_requested' },
        ],
      }),
    );
    render(path);
    expect(await screen.findByText(/Only the latest attempt can be reviewed/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Marks \(out of/)).not.toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Attempt 2' })).toHaveAttribute(
      'href',
      '/admin/courses/c1/assignments/a1/submissions/s2',
    );
  });
});
