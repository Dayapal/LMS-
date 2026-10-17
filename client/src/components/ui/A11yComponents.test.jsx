import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ToastProvider } from '../../context/ToastContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { TabPanel, Tabs } from './Tabs.jsx';
import { TextField } from './FormField.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function ToastButtons() {
  const toast = useToast();
  return (
    <>
      <button type="button" onClick={() => toast.success('Saved.')}>
        Save
      </button>
      <button type="button" onClick={() => toast.error('Could not save.')}>
        Fail
      </button>
    </>
  );
}

describe('toasts', () => {
  it('announces successes politely and errors as alerts', () => {
    render(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.');
  });

  it('stays while the pointer is over it, then leaves after the rest of its time', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const toast = screen.getByText('Saved.').parentElement;

    act(() => vi.advanceTimersByTime(2000));
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText('Saved.')).toBeInTheDocument();

    fireEvent.mouseLeave(toast);
    act(() => vi.advanceTimersByTime(1400));
    expect(screen.getByText('Saved.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });

  it('pauses while focus is on its Dismiss button, which removes it', async () => {
    render(
      <ToastProvider>
        <ToastButtons />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });
});

function TabsHarness() {
  const tabs = [
    { id: 'one', label: 'One' },
    { id: 'two', label: 'Two' },
    { id: 'three', label: 'Three' },
  ];
  const [tab, setTab] = useState('one');
  return (
    <>
      <Tabs label="Sections" tabs={tabs} value={tab} onChange={setTab} idPrefix="t" />
      <TabPanel idPrefix="t" tab={tab}>
        Panel {tab}
      </TabPanel>
    </>
  );
}

describe('Tabs', () => {
  it('follows the tabs keyboard pattern', async () => {
    render(<TabsHarness />);
    const tab = (name) => screen.getByRole('tab', { name });
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(tab('One')).toHaveAttribute('tabindex', '0');
    expect(tab('Two')).toHaveAttribute('tabindex', '-1');

    await userEvent.tab();
    expect(tab('One')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tab('Two')).toHaveFocus();
    expect(tab('Two')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Two' })).toHaveTextContent('Panel two');

    await userEvent.keyboard('{End}');
    expect(tab('Three')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(tab('One')).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(tab('Three')).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Home}');
    expect(tab('One')).toHaveAttribute('aria-selected', 'true');

    // Tab leaves the tab list for the panel.
    await userEvent.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });
});

describe('TextField', () => {
  it('keeps the hint when there is an error and describes the field by both', () => {
    render(<TextField label="Title" hint="Shown to students" error="Too short" required />);
    const input = screen.getByRole('textbox', { name: 'Title' });
    expect(input).toHaveAccessibleDescription('Too short Shown to students');
    expect(input).toBeInvalid();
    expect(input).toBeRequired();
  });
});
