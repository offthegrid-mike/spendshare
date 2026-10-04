import { describe, it, expect } from 'vitest';
import mainSource from '../main.tsx?raw';

describe('zodConfig', () => {
  it('disables the Zod JIT before any schema is built, so no new Function runs', async () => {
    const RealFunction = globalThis.Function;
    const constructed: string[] = [];
    globalThis.Function = new Proxy(RealFunction, {
      construct(target, args) {
        constructed.push(String(args[0] ?? ''));
        return Reflect.construct(target, args as []);
      },
    }) as FunctionConstructor;

    try {
      await import('./zodConfig');
      const { z } = await import('zod');
      // Building a schema is what triggers Zod's eval probe; parsing is what
      // triggers its JIT compiler. Neither may reach `new Function`, or the
      // browser logs a CSP violation against our 'unsafe-eval'-free policy.
      const schema = z.object({ name: z.string().min(1) });
      schema.safeParse({ name: 'Milk' });

      expect(constructed).toEqual([]);
    } finally {
      globalThis.Function = RealFunction;
    }
  });

  it('is the first import in main.tsx, where the ordering matters', () => {
    // Any module evaluated before this one may already have built a schema.
    // Anchored to the start of a line so a comment or a commented-out import
    // can't satisfy it.
    const firstImport = mainSource.match(/^import .*$/m)?.[0];

    expect(firstImport).toBe("import './lib/zodConfig'");
  });
});
