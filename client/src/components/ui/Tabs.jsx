import { useRef } from 'react';

const NEXT_INDEX = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/**
 * Tabs following the WAI-ARIA pattern: only the selected tab is in the Tab
 * order, arrow keys (and Home/End) move between tabs and select them.
 * `tabs` is a list of { id, label }; pair it with <TabPanel> using the same `idPrefix`.
 */
export function Tabs({ label, tabs, value, onChange, idPrefix }) {
  const refs = useRef({});

  const onKeyDown = (event) => {
    const next = NEXT_INDEX[event.key];
    if (!next) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === value);
    const target = tabs[next(index, tabs.length)];
    onChange(target.id);
    refs.current[target.id]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-2 overflow-x-auto border-b border-slate-200/80 pb-px dark:border-white/10"
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[tab.id] = node;
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-all ${
              selected
                ? 'border-brand-500 text-brand-600 dark:border-cyan-400 dark:text-cyan-400 font-semibold'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ idPrefix, tab, children }) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tab}`}
      aria-labelledby={`${idPrefix}-tab-${tab}`}
      tabIndex={0}
      className="focus:outline-none focus-visible:outline-2 focus-visible:outline-brand-500 rounded-xl"
    >
      {children}
    </div>
  );
}
