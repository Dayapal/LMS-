import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { filesApi, lessonsApi } from '../api.js';
import { LessonMaterialsPage } from './LessonMaterialsPage.jsx';
import { renderWithProviders, apiError } from '../../../test/renderWithProviders.jsx';
import { ADMIN } from '../../courses/test-fixtures.js';
import {
  codeMaterial,
  fileMaterial,
  linkMaterial,
  makeLessonDetail,
  noteMaterial,
} from '../test-fixtures.js';

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
  { path: '/admin/courses/:courseId/lessons/:lessonId', element: <LessonMaterialsPage /> },
];

function renderEditor({ lesson = makeLessonDetail(), materials } = {}) {
  vi.spyOn(lessonsApi, 'get').mockResolvedValue(lesson);
  vi.spyOn(lessonsApi, 'materials').mockResolvedValue(
    materials ?? [
      noteMaterial(),
      codeMaterial({ status: 'draft' }),
      fileMaterial(),
      linkMaterial('a'),
    ],
  );
  return renderWithProviders(routes, { path: '/admin/courses/c1/lessons/l2', user: ADMIN });
}

const dialog = (name) => screen.getByRole('dialog', { name });

afterEach(() => vi.restoreAllMocks());

describe('LessonMaterialsPage', () => {
  it('lists materials in order with summaries and a preview link', async () => {
    renderEditor();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Flexbox Layouts' }),
    ).toBeInTheDocument();
    const rows = within(await screen.findByRole('list')).getAllByRole('listitem');
    expect(
      rows.map((row) => within(row).getByText(/Lesson notes|Navbar|cheat sheet|Guide/).textContent),
    ).toEqual(['Lesson notes', 'Navbar layout', 'Flexbox cheat sheet', 'Guide a']);
    expect(within(rows[0]).getByText('One axis')).toBeInTheDocument();
    expect(
      within(rows[1]).getByText('3 lines · Space between the logo and links'),
    ).toBeInTheDocument();
    expect(within(rows[2]).getByText('flexbox.pdf · 47 KB')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preview as student' })).toHaveAttribute(
      'href',
      '/admin/courses/c1/lessons/l2/preview',
    );
  });

  it('warns when the lesson itself is not published', async () => {
    renderEditor({ lesson: makeLessonDetail({ status: 'draft' }) });
    expect(await screen.findByText(/students can't open it yet/)).toBeInTheDocument();
  });

  it('reorders and publishes materials', async () => {
    const reorder = vi.spyOn(lessonsApi, 'reorderMaterials').mockResolvedValue([]);
    const update = vi.spyOn(lessonsApi, 'updateMaterial').mockResolvedValue({});
    renderEditor();
    const user = userEvent.setup();

    expect(await screen.findByRole('button', { name: 'Move Lesson notes up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move Navbar layout up' }));
    expect(reorder).toHaveBeenCalledWith('l2', ['k1', 'n1', 'f1', 'a']);

    await user.click(screen.getByRole('button', { name: 'Publish Navbar layout' }));
    expect(update).toHaveBeenCalledWith('k1', { status: 'published' });
    expect(await screen.findByText('Material published.')).toBeInTheDocument();
  });

  it('adds a note with a live Markdown preview', async () => {
    const create = vi.spyOn(lessonsApi, 'createMaterial').mockResolvedValue({});
    renderEditor({ materials: [] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add note' }));
    const form = dialog('Add note');
    expect(within(form).getByLabelText(/^title/i)).toHaveValue('Lesson notes');
    await user.type(
      within(form).getByLabelText(/note \(markdown\)/i),
      '## Main axis{enter}{enter}Use **gap**.',
    );

    const preview = within(form).getByRole('region', { name: 'Live preview' });
    expect(await within(preview).findByRole('heading', { name: 'Main axis' })).toBeInTheDocument();
    expect(within(preview).getByText('gap').tagName).toBe('STRONG');

    await user.click(within(form).getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]).toEqual([
      'l2',
      {
        type: 'note',
        title: 'Lesson notes',
        status: 'draft',
        body: '## Main axis\n\nUse **gap**.',
      },
    ]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('requires a note body', async () => {
    const create = vi.spyOn(lessonsApi, 'createMaterial');
    renderEditor({ materials: [] });
    await userEvent.click(await screen.findByRole('button', { name: 'Add note' }));
    await userEvent.click(within(dialog('Add note')).getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Write the note before saving')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('adds a code example in the chosen language', async () => {
    const create = vi.spyOn(lessonsApi, 'createMaterial').mockResolvedValue({});
    renderEditor({ materials: [] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add code' }));
    const form = dialog('Add code example');
    await user.type(within(form).getByLabelText(/^title/i), 'Hello Java');
    await user.selectOptions(within(form).getByLabelText('Language'), 'java');
    await user.type(within(form).getByLabelText(/^code/i), 'class A {{}');
    await user.click(within(form).getByRole('button', { name: 'Add code example' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][1]).toEqual({
      type: 'code',
      title: 'Hello Java',
      status: 'draft',
      language: 'java',
      source: 'class A {}',
      caption: '',
    });
  });

  it('uploads a file before attaching it', async () => {
    const upload = vi.spyOn(filesApi, 'upload').mockResolvedValue({ id: 'file9' });
    const create = vi.spyOn(lessonsApi, 'createMaterial').mockResolvedValue({});
    renderEditor({ materials: [] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add file' }));
    const form = dialog('Add file');
    await user.type(within(form).getByLabelText(/^title/i), 'Cheat sheet');
    const pdf = new File(['%PDF-1.4'], 'sheet.pdf', { type: 'application/pdf' });
    await user.upload(within(form).getByLabelText(/^file/i), pdf);
    expect(within(form).getByText(/sheet\.pdf .* will be uploaded/)).toBeInTheDocument();
    await user.click(within(form).getByLabelText(/allow students to download/i));
    await user.click(within(form).getByRole('button', { name: 'Add file' }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(upload.mock.calls[0][0]).toBe('c1');
    expect(upload.mock.calls[0][1]).toBe(pdf);
    expect(create.mock.calls[0][1]).toEqual({
      type: 'file',
      title: 'Cheat sheet',
      status: 'draft',
      downloadable: false,
      fileId: 'file9',
    });
  });

  it('rejects disallowed or oversized files before uploading', async () => {
    const upload = vi.spyOn(filesApi, 'upload');
    renderEditor({ materials: [] });
    const user = userEvent.setup({ applyAccept: false });

    await user.click(await screen.findByRole('button', { name: 'Add file' }));
    const form = dialog('Add file');
    const input = within(form).getByLabelText(/^file/i);

    await user.upload(input, new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' }));
    expect(within(form).getByText('Only PDF, DOCX and PPTX files are allowed')).toBeInTheDocument();

    const big = new File(['%PDF'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(big, 'size', { value: 21 * 1024 * 1024 });
    await user.upload(input, big);
    expect(within(form).getByText('Files must be 20 MB or smaller')).toBeInTheDocument();

    await user.type(within(form).getByLabelText(/^title/i), 'Handout');
    await user.click(within(form).getByRole('button', { name: 'Add file' }));
    expect(upload).not.toHaveBeenCalled();
  });

  it('shows the server reason when an upload is rejected', async () => {
    vi.spyOn(filesApi, 'upload').mockRejectedValue(
      apiError(400, 'The file content is not a valid .pdf file'),
    );
    const create = vi.spyOn(lessonsApi, 'createMaterial');
    renderEditor({ materials: [] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add file' }));
    const form = dialog('Add file');
    await user.type(within(form).getByLabelText(/^title/i), 'Handout');
    await user.upload(
      within(form).getByLabelText(/^file/i),
      new File(['<html>'], 'fake.pdf', { type: 'application/pdf' }),
    );
    await user.click(within(form).getByRole('button', { name: 'Add file' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'The file content is not a valid .pdf file',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('validates links and maps server field errors', async () => {
    const create = vi
      .spyOn(lessonsApi, 'createMaterial')
      .mockRejectedValue(
        apiError(400, 'Some fields are invalid', [{ path: 'title', message: 'Title is taken' }]),
      );
    renderEditor({ materials: [] });
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Add link' }));
    const form = dialog('Add link');
    await user.type(within(form).getByLabelText(/^title/i), 'React docs');
    await user.type(within(form).getByLabelText(/^address/i), 'http://react.dev');
    await user.click(within(form).getByRole('button', { name: 'Add link' }));
    expect(await within(form).findByText('Must be a valid https:// URL')).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();

    await user.clear(within(form).getByLabelText(/^address/i));
    await user.type(within(form).getByLabelText(/^address/i), 'https://react.dev');
    await user.click(within(form).getByRole('button', { name: 'Add link' }));
    expect(await within(form).findByText('Title is taken')).toBeInTheDocument();
  });

  it('edits a material with its current values', async () => {
    const update = vi.spyOn(lessonsApi, 'updateMaterial').mockResolvedValue({});
    renderEditor();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Edit Guide a' }));
    const form = dialog('Edit link');
    expect(within(form).getByLabelText(/^address/i)).toHaveValue('https://developer.mozilla.org/a');
    await user.type(within(form).getByLabelText(/^description/i), 'Official docs');
    await user.click(within(form).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]).toEqual([
      'a',
      {
        title: 'Guide a',
        status: 'published',
        url: 'https://developer.mozilla.org/a',
        description: 'Official docs',
      },
    ]);
  });

  it('confirms before deleting and reports refusals', async () => {
    const remove = vi
      .spyOn(lessonsApi, 'removeMaterial')
      .mockRejectedValue(apiError(409, 'Published materials cannot be deleted.'));
    renderEditor();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Delete Flexbox cheat sheet' }));
    const confirm = dialog('Delete material?');
    expect(confirm).toHaveTextContent('its file is removed unless another material uses it');
    expect(remove).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(remove).toHaveBeenCalledWith('f1');
    expect(await screen.findByText('Published materials cannot be deleted.')).toBeInTheDocument();
  });

  it('shows a not-found message for unknown lessons', async () => {
    vi.spyOn(lessonsApi, 'get').mockRejectedValue(apiError(404, 'Lesson not found'));
    vi.spyOn(lessonsApi, 'materials').mockRejectedValue(apiError(404, 'Lesson not found'));
    renderWithProviders(routes, { path: '/admin/courses/c1/lessons/zzz', user: ADMIN });
    expect(await screen.findByText('This lesson does not exist.')).toBeInTheDocument();
  });
});
