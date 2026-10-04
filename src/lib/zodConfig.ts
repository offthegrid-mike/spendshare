import { config } from 'zod';

// Zod v4 JIT-compiles validators with `new Function`, and probes for eval
// support the first time a schema is built. Both violate our CSP, which has no
// 'unsafe-eval' — and Chrome logs each blocked attempt even though Zod catches
// the probe and quietly falls back to the interpreted path. Turning the JIT off
// keeps the console clean without loosening the policy.
//
// This must be imported before anything that builds a schema. ES imports are
// hoisted and evaluated in source order, so calling `config()` in main.tsx's own
// body is too late: App.tsx's module graph — and the schemas in it — has already
// been evaluated by then.
config({ jitless: true });
