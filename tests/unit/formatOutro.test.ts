import { describe, it, expect } from 'vitest';
import { buildOutroMessage } from '../../src/helpers/formatOutro.ts';

describe('formatOutro.buildOutroMessage', () => {
  it('includes db steps for prisma ts', () => {
    const msg = buildOutroMessage({ projectName: 'app', language: 'ts', orm: 'prisma', database: 'postgresql' });
    expect(msg).toContain('npm run build-schema');
    expect(msg).toContain('npm run db:migrate');
  });

  it('handles mongoose without db setup', () => {
    const msg = buildOutroMessage({ projectName: 'app', language: 'js', orm: 'mongoose', database: 'mongodb' });
    expect(msg).toContain('MONGO_CONNECTION_STRING');
  });
});
