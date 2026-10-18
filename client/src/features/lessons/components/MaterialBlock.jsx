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
        className="group block h-full rounded-2xl border border-slate-200/80 bg-white/75 p-5 shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-[0_8px_25px_rgba(3,174,210,0.12)] dark:border-white/10 dark:bg-white/[0.05] dark:hover:border-cyan-400/40 dark:hover:bg-white/[0.08]"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-brand-600 transition-colors group-hover:text-brand-700 dark:text-cyan-400 dark:group-hover:text-cyan-300">
            {material.title}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </span>
          <DraftBadge material={material} show={showStatus} />
        </span>
        <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">{hostOf(material.url)}</span>
        {material.description && (
          <span className="mt-2 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">{material.description}</span>
        )}
      </a>
    </li>
  );
}

/** A note, code example or file, with its title as a section heading. */
function MaterialSection({ material, showStatus }) {
  const headingId = `material-${material.id}`;
  return (
    <section aria-labelledby={headingId} className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={headingId} className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
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
          <section key={group.key} aria-labelledby={`links-${group.key}`} className="space-y-3.5">
            <h2
              id={`links-${group.key}`}
              className="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              Further reading
            </h2>
            <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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
