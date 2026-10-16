import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { assignmentsApi } from '../api.js';
import { AssignmentPage } from './AssignmentPage.jsx';
import {
  renderWithProviders,
  apiError,
  notFoundError,
} from '../../../test/renderWithProviders.jsx';
import { STUDENT } from '../../courses/test-fixtures.js';
import { makeAssignment, makeSubmission, studentState } from '../test-fixtures.js';

// CodeMirror needs real layout; a textarea stands in for it in jsdom.
vi.mock('../../../components/content/LazyCodeEditor.jsx', () => ({
  LazyCodeEditor: ({ value, onChange, labelledBy }) => (
    <textarea
      aria-labelledby={labelledBy}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

const routes = [
  { path: '/app/courses/:courseId/assignments/:assignmentId', element: <AssignmentPage /> },
];

function open({ assignment = makeAssignment(), state = studentState(), history = [] } = {}) {
  vi.spyOn(assignmentsApi, 'get').mockResolvedValue({ ...assignment, mySubmission: state });
  vi.spyOn(assignmentsApi, 'mySubmissions').mockResolvedValue(history);
  return renderWithProviders(routes, { path: '/app/courses/c1/assignments/a1', user: STUDENT });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const heading = (name) => screen.findByRole('heading', { level: 1, name });

describe('AssignmentPage', () => {
  it('shows the instructions, deadline in local time, late policy and handouts', async () => {
    open({
      assignment: makeAssignment({
        instructions: '## Requirements\n\n<script>window.hacked = true</script>\n\n- A **form**',
        attachments: [
          { id: 'f1', originalName: 'brief.pdf', mimeType: 'application/pdf', size: 2048 },
        ],
        latePolicy: {
          allowLate: true,
          lateUntil: '2030-01-20T00:00:00.000Z',
          penaltyPercent: 10,
        },
      }),
    });
    expect(await heading('Personal Profile Page')).toBeInTheDocument();
    expect(screen.getByText('Not submitted')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    expect(window.hacked).toBeUndefined();
    expect(screen.getByText(/with a 10% penalty/)).toBeInTheDocument();
    expect(screen.getByText('2 attempts')).toBeInTheDocument();
    expect(screen.getByText('brief.pdf')).toBeInTheDocument();
    expect(screen.getByText('HTML Fundamentals')).toBeInTheDocument();
  });

  it('submits links and code as one attempt', async () => {
    const submit = vi.spyOn(assignmentsApi, 'submit').mockResolvedValue(makeSubmission());
    open();
    const user = userEvent.setup();
    await heading('Personal Profile Page');

    await user.type(screen.getByLabelText('GitHub repository'), 'https://github.com/asha/profile');
    await user.type(screen.getByLabelText('Code snippet'), 'const x = 1;');
    await user.selectOptions(screen.getByLabelText('Code language'), 'java');
    await user.type(screen.getByLabelText(/Note for your trainer/), 'See README');
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit.mock.calls[0][0]).toBe('a1');
    expect(submit.mock.calls[0][1]).toEqual({
      items: [
        { type: 'github_url', url: 'https://github.com/asha/profile' },
        { type: 'code', code: { language: 'java', source: 'const x = 1;' } },
      ],
      note: 'See README',
    });
    expect(await screen.findByText('Your work was submitted.')).toBeInTheDocument();
  });

  it('requires at least one item and checks links before sending', async () => {
    const submit = vi.spyOn(assignmentsApi, 'submit');
    open();
    const user = userEvent.setup();
    await heading('Personal Profile Page');

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Add at least one link, file or code snippet',
    );

    await user.type(screen.getByLabelText('Deployed project'), 'http://localhost:3000');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Enter a full https:// address')).toBeInTheDocument();
    expect(screen.getByLabelText('Deployed project')).toHaveAttribute('aria-invalid', 'true');
    expect(submit).not.toHaveBeenCalled();
  });

  it('only offers the submission types the assignment accepts', async () => {
    open({ assignment: makeAssignment({ allowedSubmissionTypes: ['drive_url'] }) });
    await heading('Personal Profile Page');
    expect(screen.getByLabelText('Google Drive link')).toBeInTheDocument();
    expect(screen.queryByLabelText('GitHub repository')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/PDF file/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Code snippet')).not.toBeInTheDocument();
  });

  it('shows a server field error on the field that sent it', async () => {
    vi.spyOn(assignmentsApi, 'submit').mockRejectedValue(
      apiError(400, 'Some fields are invalid', [
        { path: 'items.1.url', message: 'Use the public address of your deployed project' },
      ]),
    );
    open();
    const user = userEvent.setup();
    await heading('Personal Profile Page');
    await user.type(screen.getByLabelText('GitHub repository'), 'https://github.com/a/b');
    await user.type(screen.getByLabelText('Deployed project'), 'https://intranet.example');
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText('Use the public address of your deployed project'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Deployed project')).toHaveAttribute('aria-invalid', 'true');
  });

  it('uploads a chosen PDF, then submits it', async () => {
    const uploadFile = vi
      .spyOn(assignmentsApi, 'uploadSubmissionFile')
      .mockResolvedValue({ id: 'file9', originalName: 'answers.pdf', size: 1000 });
    const submit = vi.spyOn(assignmentsApi, 'submit').mockResolvedValue(makeSubmission());
    open();
    // Pick files the input's `accept` would hide, as a determined user can.
    const user = userEvent.setup({ applyAccept: false });
    await heading('Personal Profile Page');

    const input = screen.getByLabelText('PDF file');
    await user.upload(input, new File(['x'], 'notes.docx', { type: 'application/msword' }));
    expect(screen.getByText('Only PDF files can be submitted')).toBeInTheDocument();

    const pdf = new File(['%PDF-1.4'], 'answers.pdf', { type: 'application/pdf' });
    await user.upload(input, pdf);
    expect(
      screen.getByText(/answers\.pdf .* will be uploaded when you submit/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(uploadFile.mock.calls[0][0]).toBe('a1');
    expect(uploadFile.mock.calls[0][1]).toBe(pdf);
    expect(submit.mock.calls[0][1].items).toEqual([{ type: 'pdf', fileId: 'file9' }]);
  });

  it('shows the server’s reason when an upload is refused', async () => {
    vi.spyOn(assignmentsApi, 'uploadSubmissionFile').mockRejectedValue(
      apiError(400, 'The file content is not a valid .pdf file'),
    );
    const submit = vi.spyOn(assignmentsApi, 'submit');
    open();
    const user = userEvent.setup();
    await heading('Personal Profile Page');
    await user.upload(
      screen.getByLabelText('PDF file'),
      new File(['<html>'], 'fake.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The file content is not a valid .pdf file',
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it('lets the student edit an unreviewed submission', async () => {
    const latest = makeSubmission({ note: 'First go' });
    const update = vi
      .spyOn(assignmentsApi, 'updateSubmission')
      .mockResolvedValue({ ...latest, note: 'Second go' });
    open({
      state: studentState({
        status: 'submitted',
        attempts: 1,
        canSubmit: false,
        canEdit: true,
        latest: { id: 's1', attempt: 1, status: 'submitted' },
      }),
      history: [latest],
    });
    const user = userEvent.setup();
    await heading('Personal Profile Page');
    expect(screen.getByText('https://github.com/asha/profile')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit submission' }));
    expect(screen.getByLabelText('GitHub repository')).toHaveValue(
      'https://github.com/asha/profile',
    );
    const note = screen.getByLabelText(/Note for your trainer/);
    await user.clear(note);
    await user.type(note, 'Second go');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][0]).toBe('s1');
    expect(update.mock.calls[0][1]).toEqual({
      items: [{ type: 'github_url', url: 'https://github.com/asha/profile' }],
      note: 'Second go',
    });
  });

  it('shows the trainer’s feedback and asks for a new attempt after a resubmission request', async () => {
    const requested = makeSubmission({
      status: 'resubmit_requested',
      review: { marks: 40, finalMarks: 40, feedback: 'Add **form validation**', reviewedAt: null },
    });
    open({
      state: studentState({
        status: 'resubmit_requested',
        attempts: 1,
        canSubmit: true,
        latest: { id: 's1', attempt: 1, status: 'resubmit_requested' },
      }),
      history: [requested],
    });
    await heading('Personal Profile Page');
    expect(screen.getByRole('heading', { name: 'Resubmit (attempt 2)' })).toBeInTheDocument();
    expect(screen.getAllByText('form validation')[0].tagName).toBe('STRONG');
    expect(screen.getAllByText('Resubmission requested').length).toBeGreaterThan(0);
  });

  it('shows marks after review and explains why nothing more can be submitted', async () => {
    const reviewed = makeSubmission({
      status: 'reviewed',
      isLate: true,
      review: { marks: 80, finalMarks: 72, feedback: 'Well done', reviewedAt: null },
    });
    open({
      state: studentState({
        status: 'reviewed',
        attempts: 1,
        canSubmit: false,
        blockedReason: 'This assignment has been reviewed.',
        latest: { id: 's1', attempt: 1, status: 'reviewed', finalMarks: 72 },
      }),
      history: [reviewed],
    });
    await heading('Personal Profile Page');
    const attempt = screen.getByRole('article');
    expect(within(attempt).getByText(/Marks: 72 \/ 100/)).toBeInTheDocument();
    expect(within(attempt).getByText('(80 before the late penalty)')).toBeInTheDocument();
    expect(within(attempt).getByText('Late')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });

  it('explains when the window has closed', async () => {
    open({
      state: studentState({
        status: 'overdue',
        canSubmit: false,
        blockedReason: 'The submission window has closed.',
      }),
    });
    await heading('Personal Profile Page');
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('The submission window has closed.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });

  it('says when the assignment is not available', async () => {
    vi.spyOn(assignmentsApi, 'get').mockRejectedValue(notFoundError());
    vi.spyOn(assignmentsApi, 'mySubmissions').mockRejectedValue(notFoundError());
    renderWithProviders(routes, { path: '/app/courses/c1/assignments/a1', user: STUDENT });
    expect(await screen.findByText(/This assignment is not available/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to the course/ })).toHaveAttribute(
      'href',
      '/app/courses/c1',
    );
  });
});
