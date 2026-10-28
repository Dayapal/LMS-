import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
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
      totalModulesCount: 2,
      isAssigned: true,
      grantedAt: '2026-10-20T10:00:00.000Z',
      grantedBy: { id: 'u1', name: 'Admin Instructor' },
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
      totalModulesCount: 7,
      isAssigned: false,
      grantedAt: null,
      grantedBy: null,
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
      modules: [],
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
  it('renders KPI stats and book syllabus tabs', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    renderPanel();

    expect(await screen.findByText('Assigned Books')).toBeInTheDocument();
    expect(screen.getByText('Released Modules')).toBeInTheDocument();
    expect(screen.getByText('Active Reading Time')).toBeInTheDocument();
    expect(screen.getByText('Report Visibility')).toBeInTheDocument();
    expect(screen.getAllByText(/DSA with JavaScript/).length).toBeGreaterThan(0);
    expect(screen.getByText(/JavaScript Mastery/)).toBeInTheDocument();

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
    const checkboxes = screen.getAllByRole('checkbox');
    // Module 2 checkbox (order 2, unchecked)
    const module2Checkbox = checkboxes[1];
    expect(module2Checkbox).toBeInTheDocument();
    expect(module2Checkbox.checked).toBe(false);

    await user.click(module2Checkbox);
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

  it('grants and revokes book access', async () => {
    vi.spyOn(studyMaterialsApi, 'getStudentAccessDetail').mockResolvedValue(mockBooksData);
    const updateSpy = vi.spyOn(studyMaterialsApi, 'updateStudentAccess').mockResolvedValue({});
    const user = userEvent.setup();
    renderPanel();

    // Switch to second unassigned book tab
    const jsBookTab = await screen.findByRole('button', { name: /JavaScript Mastery/i });
    await user.click(jsBookTab);

    // Grant access button
    const grantBtn = await screen.findByRole('button', { name: /Grant Book Access/i });
    await user.click(grantBtn);
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b2',
        isBookAssigned: true,
      });
    });

    // Switch back to assigned book
    const dsaBookTab = screen.getByRole('button', { name: /DSA with JavaScript/i });
    await user.click(dsaBookTab);

    // Revoke book button triggers confirmation dialog
    const revokeBtn = await screen.findByRole('button', { name: /Revoke Book/i });
    await user.click(revokeBtn);

    const dialog = await screen.findByRole('dialog', { name: /Revoke book access\?/i });
    expect(dialog).toBeInTheDocument();

    const confirmRevokeBtn = screen.getByRole('button', { name: 'Revoke Access' });
    await user.click(confirmRevokeBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('s1', {
        bookId: 'b1',
        isBookAssigned: false,
      });
    });
  });
});
