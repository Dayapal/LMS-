import { MarkdownView } from '../../../components/content/MarkdownView.jsx';
import { CodeBlock } from '../../../components/content/CodeBlock.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { FileMaterial } from './FileMaterial.jsx';

const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

function DraftBadge({ material, show }) {
  return show && material.status !== 'published' ? <StatusBadge status={material.status} /> : null;
}

function LinkCard({ material, showStatus }) {
  return (
    <li>
      <a
        href={material.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block h-full rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-brand-300 hover:bg-brand-50/40"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-brand-700 group-hover:text-brand-800">
            {material.title}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </span>
          <DraftBadge material={material} show={showStatus} />
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">{hostOf(material.url)}</span>
        {material.description && (
          <span className="mt-2 block text-sm text-slate-600">{material.description}</span>
        )}
      </a>
    </li>
  );
}

/** A note, code example or file, with its title as a section heading. */
function MaterialSection({ material, showStatus }) {
  const headingId = `material-${material.id}`;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="text-xl font-semibold tracking-tight text-slate-900">
          {material.title}
        </h2>
        <DraftBadge material={material} show={showStatus} />
      </div>
      {material.type === 'note' && <MarkdownView>{material.body}</MarkdownView>}
      {material.type === 'code' && (
        <CodeBlock
          source={material.source}
          language={material.language}
          caption={material.caption}
          label={material.title}
        />
      )}
      {material.type === 'file' && <FileMaterial material={material} />}
    </section>
  );
}

/** Splits materials into single blocks and runs of consecutive links. */
function groupMaterials(materials) {
  const groups = [];
  for (const material of materials) {
    const last = groups.at(-1);
    if (material.type === 'link' && last?.links) last.links.push(material);
    else if (material.type === 'link') groups.push({ key: material.id, links: [material] });
    else groups.push({ key: material.id, material });
  }
  return groups;
}

/**
 * A lesson's study materials in order. Consecutive links are shown together
 * as "Further reading". `showStatus` marks unpublished blocks in the trainer's preview.
 */
export function LessonMaterials({ materials, showStatus = false }) {
  return (
    <div className="space-y-10">
      {groupMaterials(materials).map((group) =>
        group.links ? (
          <section key={group.key} aria-labelledby={`links-${group.key}`} className="space-y-3">
            <h2
              id={`links-${group.key}`}
              className="text-xl font-semibold tracking-tight text-slate-900"
            >
              Further reading
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.links.map((link) => (
                <LinkCard key={link.id} material={link} showStatus={showStatus} />
              ))}
            </ul>
          </section>
        ) : (
          <MaterialSection key={group.key} material={group.material} showStatus={showStatus} />
        ),
      )}
    </div>
  );
}
