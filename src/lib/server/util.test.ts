import { describe, expect, it } from 'vitest';
import { sanitizeName } from './util';

describe('sanitizeName', () => {
  it('replaces illegal chars and trims length', () => {
    const s = sanitizeName('a:/\\*?"<>| very long name !!!!!');
    expect(s).toMatch(/^[A-Za-z0-9-_]+(?:_[A-Za-z0-9-_]+)*$/);
    expect(s.length).toBeLessThanOrEqual(120);
  });
});
