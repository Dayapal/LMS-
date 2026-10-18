import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarkdownView } from './MarkdownView.jsx';
import { CodeBlock } from './CodeBlock.jsx';

afterEach(() => vi.restoreAllMocks());

describe('MarkdownView', () => {
  it('renders Markdown with GFM tables and headings nested under the page', () => {
    const { container } = render(
      <MarkdownView>
        {'## Overview\n\nSome **bold** text.\n\n- one\n- two\n\n| A | B |\n| - | - |\n| 1 | 2 |'}
      </MarkdownView>,
    );
    // `##` renders one level deeper (h3) so it nests under the material's h2.
    expect(screen.getByRole('heading', { level: 3, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(within(screen.getByRole('table')).getByText('2')).toBeInTheDocument();
    expect(container.querySelector('.md-h2')).not.toBeNull();
  });

  it('renders <script> and other raw HTML inert', () => {
    const onError = vi.fn();
    window.__xss = onError;
    const { container } = render(
      <MarkdownView>
        {[
          'Before <script>window.__xss()</script> after',
          '',
          '<img src="x" onerror="window.__xss()">',
          '',
          '<iframe src="https://evil.example"></iframe>',
          '',
          '<a href="javascript:window.__xss()">raw link</a>',
          '',
          '[markdown link](javascript:window.__xss())',
          '',
          '<div onclick="window.__xss()">click</div>',
        ].join('\n')}
      </MarkdownView>,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('[onerror], [onclick]')).toBeNull();
    for (const link of container.querySelectorAll('a')) {
      expect(link.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    }
    expect(container.innerHTML).not.toMatch(/javascript:/i);
    expect(onError).not.toHaveBeenCalled();
    delete window.__xss;
  });

  it('opens external links in a new tab without opener access', () => {
    render(<MarkdownView>{'[MDN](https://developer.mozilla.org/) and [home](/app)'}</MarkdownView>);
    const external = screen.getByRole('link', { name: /MDN/ });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'home' })).not.toHaveAttribute('target');
  });

  it('highlights fenced code blocks', () => {
    const { container } = render(<MarkdownView>{'```js\nconst answer = 42;\n```'}</MarkdownView>);
    expect(screen.getByRole('region', { name: /code/i })).toHaveTextContent('const answer = 42;');
    expect(container.querySelector('.token.keyword')).toHaveTextContent('const');
  });
});

describe('CodeBlock', () => {
  it.each([
    ['java', 'public class A {}', 'public'],
    ['bash', 'if true; then echo hi; fi', 'if'],
    ['sql', 'SELECT * FROM users;', 'SELECT'],
    ['yaml', 'server:\n  port: 8080', 'server'],
  ])('highlights %s', (language, source, firstToken) => {
    const { container } = render(<CodeBlock source={source} language={language} />);
    const tokens = [...container.querySelectorAll('.token')].map((t) => t.textContent);
    expect(tokens).toContain(firstToken);
  });

  it('renders code as text, never as HTML', () => {
    const { container } = render(
      <CodeBlock source={'<script>alert(1)</script>'} language="html" />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByRole('region', { name: /code/i })).toHaveTextContent(
      '<script>alert(1)</script>',
    );
  });

  it('copies the source to the clipboard', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    render(<CodeBlock source="npm test" language="bash" title="Run the tests" caption="Twice" />);

    await user.click(screen.getByRole('button', { name: 'Copy code: Run the tests' }));
    expect(writeText).toHaveBeenCalledWith('npm test');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
    // The name follows the visible text (label in name).
    expect(screen.getByRole('button', { name: 'Copied code: Run the tests' })).toBeInTheDocument();
    expect(screen.getByText('Twice')).toBeInTheDocument();
  });
});
