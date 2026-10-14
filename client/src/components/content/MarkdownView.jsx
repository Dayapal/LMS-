import { createElement } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { CodeBlock } from './CodeBlock.jsx';

const isExternal = (href = '') => /^https?:\/\//i.test(href);

const headingCache = new Map();

/**
 * Renders Markdown headings `offset` levels deeper, so they nest under the
 * page's own headings, while keeping the visual size of the original level.
 * Cached so the component identities stay stable between renders.
 */
function headingComponents(offset) {
  if (!headingCache.has(offset)) {
    const entries = [1, 2, 3, 4, 5, 6].map((level) => {
      // eslint-disable-next-line no-unused-vars
      function Heading({ node, ...props }) {
        return createElement(`h${Math.min(6, level + offset)}`, {
          ...props,
          className: `md-h${level}`,
        });
      }
      return [`h${level}`, Heading];
    });
    headingCache.set(offset, Object.fromEntries(entries));
  }
  return headingCache.get(offset);
}

function FencedCode({ children }) {
  // Without a custom `code` renderer, the child is the plain <code> element.
  const { className = '', children: text = '' } = children?.props ?? {};
  const language = /language-(\S+)/.exec(className)?.[1] ?? 'text';
  return (
    <div className="my-4">
      <CodeBlock source={String(text)} language={language} />
    </div>
  );
}

// eslint-disable-next-line no-unused-vars
function Link({ node, href, children, ...props }) {
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

/**
 * Trusted-looking but untrusted Markdown, rendered safely: raw HTML in the
 * source is never rendered, `javascript:` and other unsafe URLs are dropped,
 * and the output is sanitized again with rehype-sanitize's GitHub schema.
 */
export function MarkdownView({ children, headingOffset = 1, className = '' }) {
  return (
    <div className={`markdown ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{ ...headingComponents(headingOffset), pre: FencedCode, a: Link }}
      >
        {children ?? ''}
      </Markdown>
    </div>
  );
}
