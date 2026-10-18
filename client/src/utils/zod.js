import { z } from 'zod';

// The production Content Security Policy (client/vercel.json) has no
// 'unsafe-eval'. Without `jitless`, zod probes for eval with `new Function`,
// which browsers report as a CSP violation even though zod catches it.
// Every client schema imports zod from here so the setting is always applied.
z.config({ jitless: true });

export { z };
