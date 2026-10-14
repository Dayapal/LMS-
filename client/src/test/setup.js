import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Browser APIs jsdom doesn't implement.
window.scrollTo = () => {};
URL.createObjectURL ??= () => 'blob:test';
URL.revokeObjectURL ??= () => {};

afterEach(() => {
  cleanup();
});
