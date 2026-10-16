import net from 'node:net';
import { z } from 'zod';

/*
 * Link rules for submissions (spec §8). Links are only stored and shown to the
 * trainer; the server never fetches them. The rules keep out typos, links to
 * private machines, and anything that isn't a plain https address.
 */

const DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);

// GitHub account names: letters, digits and single hyphens, at most 39 characters.
const GITHUB_OWNER = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const GITHUB_REPO = /^[\w.-]{1,100}$/;
// First path segments that are GitHub pages, not accounts.
const GITHUB_RESERVED = new Set([
  'about',
  'collections',
  'explore',
  'features',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'pricing',
  'search',
  'settings',
  'sponsors',
  'topics',
  'trending',
]);

const PRIVATE_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.arpa'];

/** Parses an https URL without credentials, or returns null. */
function parseHttps(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null;
  return url;
}

function isPrivateIpv4(address) {
  const [a, b] = address.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast and reserved
  );
}

function isPrivateIpv6(address) {
  const lower = address.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (lower.startsWith('::ffff:')) return true; // mapped IPv4 in hex form
  return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower); // unique-local, link-local
}

/**
 * True for hosts that are not on the public internet: localhost, private and
 * reserved IP ranges, single-label names and local-only suffixes. `new URL()`
 * has already normalised odd IPv4 spellings such as `0x7f.1` to dotted form.
 */
export function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const bare = host.startsWith('[') ? host.slice(1, -1) : host;
  if (net.isIPv4(bare)) return isPrivateIpv4(bare);
  if (net.isIPv6(bare)) return isPrivateIpv6(bare);
  if (host === 'localhost' || !host.includes('.')) return true;
  return PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/** Why `value` is not an acceptable link of `type`, or null when it is. */
export function linkProblem(type, value) {
  const url = parseHttps(value);
  if (!url) return 'Enter a full https:// address';
  const host = url.hostname.toLowerCase();

  if (type === 'drive_url') {
    return DRIVE_HOSTS.has(host) ? null : 'Use a Google Drive or Google Docs link';
  }
  if (type === 'github_url') {
    if (!GITHUB_HOSTS.has(host)) return 'Use a github.com repository link';
    const [owner, repo] = url.pathname.split('/').filter(Boolean);
    const valid =
      owner &&
      repo &&
      GITHUB_OWNER.test(owner) &&
      !GITHUB_RESERVED.has(owner.toLowerCase()) &&
      GITHUB_REPO.test(repo) &&
      repo !== '.' &&
      repo !== '..';
    return valid ? null : 'Link to a repository: https://github.com/<owner>/<repository>';
  }
  return isPrivateHost(host) ? 'Use the public address of your deployed project' : null;
}

/** A zod schema for a link of the given submission type. */
export const submissionLink = (type) =>
  z
    .string({ error: 'Enter the link' })
    .trim()
    .min(1, 'Enter the link')
    .max(2048, 'Links must be at most 2048 characters')
    .superRefine((value, ctx) => {
      const problem = linkProblem(type, value);
      if (problem) ctx.addIssue({ code: 'custom', message: problem });
    });
