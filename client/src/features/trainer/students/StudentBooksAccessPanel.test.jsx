import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentBooksAccessPanel } from './StudentBooksAccessPanel.jsx';
import { studyMaterialsApi } from '../../study-materials/api.js';
import { ADMIN } from '../../courses/test-fixtures.js';
import { renderWithProviders } from '../../../test/renderWithProviders.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mockBooksData = {
  student: { id: 's1', name: 'Asha Rao', email: 'asha@example.com' },
  books: [
    {
      bookId: 'b1',
      slug: 'dsa-javascript',
      title: 'DSA with JavaScript',
      category: 'dsa',
      gradient: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
      status: 'published',
      accessStatus: 'partially_released',
      totalModulesCount: 2,
      isAssigned: true,
      grantedAt: '2026-10-20T10:00:00.000Z',
      grantedBy: { id: 'u1', name: 'Admin Instructor' },
      lastAccessedAt: '2026-10-21T10:00:00.000Z',
      canViewReport: false,
      nextUnreleasedModule: {
        id: 'm2',
        title: 'Module 2: Arrays',
        slug: 'module-2-arrays',
        phaseLabel: 'Module 2',
        order: 2,
      },
      progress: {
        releasedCount: 1,
        completedCount: 1,
        percent: 100,
        totalReadingSeconds: 420,
        assignmentsTotal: 1,
        assignmentsSubmitted: 1,
      },
      modules: [
        {
          id: 'm1',
          title: 'Module 1: Complexity Analysis & Big-O',
          slug: 'module-1-complexity-analysis-and-big-o',
          phaseLabel: 'Module 1',
          order: 1,
          estimatedMinutes: 25,
          isReleased: true,
          releasedAt: '2026-10-20T10:00:00.000Z',
          readingProgress: {
            isCompleted: true,
            completedAt: '2026-10-21T10:00:00.000Z',
            totalReadingSeconds: 420,
            lastHeartbeatAt: '2026-10-21T10:00:00.000Z',
            lastAccessedAt: '2026-10-21T10:00:00.000Z',
          },
          linkedAssignment: {
            id: 'a1',
            title: 'Big-O Homework',
            dueAt: '2026-11-01T00:00:00.000Z',
            maxMarks: 100,
            submission: {
              id: 'sub1',
              status: 'submitted',
              submittedAt: '2026-10-22T00:00:00.000Z',
              grade: null,
            },
          },
        },
        {
          id: 'm2',
          title: 'Module 2: Arrays',
          slug: 'module-2-arrays',
          phaseLabel: 'Module 2',
          order: 2,
          estimatedMinutes: 30,
          isReleased: false,
          releasedAt: null,
          readingProgress: {
            isCompleted: false,
            completedAt: null,
            totalReadingSeconds: 0,
            lastAccessedAt: null,
          },
          linkedAssignment: null,
        },
      ],
    },
    {
      bookId: 'b2',
      slug: 'javascript-mastery',
      title: 'JavaScript Mastery',
      category: 'javascript',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      status: 'published',
      accessStatus: 'not_granted',
      totalModulesCount: 7,
      isAssigned: false,
      grantedAt: null,
      grantedBy: null,
      lastAccessedAt: null,
      canViewReport: false,
      nextUnreleasedModule: null,
      progress: {
        releasedCount: 0,
        completedCount: 0,
        percent: 0,
        totalReadingSeconds: 0,
        assignmentsTotal: 0,
        assignmentsSubmitted: 0,
      },
      modules: [
        {
          id: 'm201',
          title: 'JS Phase 1: Engine & Execution Context',
          slug: 'js-phase-1',
          phaseLabel: 'Phase 1',
          order: 1,
          estimatedMinutes: 40,
          isReleased: false,
        },
      ],
    },
  ],
};

function renderPanel() {
  const routes = [
    {
      path: '/admin/students/s1',
      element: <StudentBooksAccessPanel studentId="s1" studentName="Asha Rao" />,
    },
  ];
  return renderWithProviders(routes, { path: '/admin/students/s1', user: ADMIN });
}

describe('StudentBooksAccessPanel', () => {
  it('renders KPI stats, book tabs, search input and status filter', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    renderPanel();

    expect(await screen.findByText('Assigned Books')).toBeInTheDocument();
    expect(screen.getByText('Released Modules')).toBeInTheDocument();
    expect(screen.getByText('Active Reading Time')).toBeInTheDocument();
    expect(screen.getByText('Report Visibility')).toBeInTheDocument();
    expect(screen.getAllByText(/DSA with JavaScript/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/JavaScript Mastery/).length).toBeGreaterThan(0);

    // Search input and status filter
    expect(screen.getByPlaceholderText(/Search books by title or category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Status:/i)).toBeInTheDocument();

    // Module 1 is released
    expect(screen.getByText('Module 1: Complexity Analysis & Big-O')).toBeInTheDocument();
    // Module 2 is locked
    expect(screen.getByText('Module 2: Arrays')).toBeInTheDocument();
  });

  it('allows sequential "Release Next Phase" 1-click action', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    const updateSpy = vi.spyOn(studyMaterialsApi, 'updateStudentAccess').mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    const releaseNextBtn = await screen.findByRole('button', {
      name: /Release Next: Module 2/i,
    });
    expect(releaseNextBtn).toBeInTheDocument();

    await user.click(releaseNextBtn);
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b1',
        action: 'release_next',
      });
    });
  });

  it('allows toggling "Release All" and "Lock All" phases', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    const updateSpy = vi.spyOn(studyMaterialsApi, 'updateStudentAccess').mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    const releaseAllBtn = await screen.findByRole('button', { name: /Release All/i });
    await user.click(releaseAllBtn);
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b1',
        action: 'release_all',
      });
    });

    const lockAllBtn = screen.getByRole('button', { name: /Lock All/i });
    await user.click(lockAllBtn);
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b1',
        action: 'revoke_all',
      });
    });
  });

  it('toggles granular module release checkboxes', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    const updateSpy = vi.spyOn(studyMaterialsApi, 'updateStudentAccess').mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText('Module 2: Arrays');
    const module2ReleaseCheckbox = screen.getByTitle('Click to release phase');
    expect(module2ReleaseCheckbox).toBeInTheDocument();
    expect(module2ReleaseCheckbox.checked).toBe(false);

    await user.click(module2ReleaseCheckbox);
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b1',
        isBookAssigned: true,
        releasedModuleIds: ['m1', 'm2'],
      });
    });
  });

  it('toggles student progress report visibility permission', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    const updateSpy = vi.spyOn(studyMaterialsApi, 'updateStudentAccess').mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    const reportBtn = await screen.findByRole('button', {
      name: /Hidden ✕/i,
    });
    expect(reportBtn).toBeInTheDocument();

    await user.click(reportBtn);
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b1',
        canViewReport: true,
      });
    });
  });

  it('opens Grant Access Modal and confirms granting book access', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    const updateSpy = vi.spyOn(studyMaterialsApi, 'updateStudentAccess').mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    // Click "Grant Access" on the unassigned book in the cards grid
    const grantBtn = await screen.findByRole('button', { name: /Grant Access/i });
    await user.click(grantBtn);

    // Modal opens
    const modal = await screen.findByRole('dialog', { name: /Grant Book Access/i });
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent(/Configure access scope and release permissions for Asha Rao/i);

    // Confirm button in modal
    const confirmGrantBtn = screen.getByRole('button', { name: /Confirm & Grant Access/i });
    await user.click(confirmGrantBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b2',
        isBookAssigned: true,
        scope: 'all',
        canViewReport: false,
      });
    });
  });

  it('revokes and restores book access with confirmation dialogs', async () => {
    const revokedData = {
      ...mockBooksData,
      books: [
        {
          ...mockBooksData.books[0],
          isAssigned: false,
          accessStatus: 'revoked',
          revokedAt: '2026-10-28T12:00:00.000Z',
        },
        mockBooksData.books[1],
      ],
    };

    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    const updateSpy = vi.spyOn(studyMaterialsApi, 'updateStudentAccess').mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    // Revoke book button triggers confirmation dialog
    const revokeBtn = await screen.findByRole('button', { name: /Revoke Book/i });
    await user.click(revokeBtn);

    const revokeDialog = await screen.findByRole('dialog', { name: /Revoke book access\?/i });
    expect(revokeDialog).toBeInTheDocument();

    const confirmRevokeBtn = within(revokeDialog).getByRole('button', { name: 'Revoke Access' });
    await user.click(confirmRevokeBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b1',
        isBookAssigned: false,
      });
    });

    cleanup();

    // Now test restoring when book is in revoked state
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(revokedData);
    renderPanel();

    const restoreBtn = await screen.findByRole('button', { name: /Restore Access/i });
    await user.click(restoreBtn);

    const restoreDialog = await screen.findByRole('dialog', { name: /Restore book access\?/i });
    expect(restoreDialog).toBeInTheDocument();

    const confirmRestoreBtn = within(restoreDialog).getByRole('button', { name: 'Restore Access' });
    await user.click(confirmRestoreBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b1',
        action: 'restore',
      });
    });
  });

  it('filters books by search query and status selector', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    const user = userEvent.setup();
    renderPanel();

    const searchInput = await screen.findByPlaceholderText(/Search books by title or category/i);
    await user.type(searchInput, 'DSA');

    // DSA card remains, JS card is filtered out
    expect(screen.getAllByText(/DSA with JavaScript/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'JavaScript Mastery' })).not.toBeInTheDocument();

    // Clear search
    await user.clear(searchInput);

    // Filter by status "Not Granted"
    const statusSelect = screen.getByLabelText(/Status:/i);
    await user.selectOptions(statusSelect, 'not_granted');

    // Only JavaScript Mastery (not_granted) is visible in the grid
    expect(screen.getByRole('heading', { name: 'JavaScript Mastery' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'DSA with JavaScript' })).not.toBeInTheDocument();
  });
});
