import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHarnessCommand } from '../../../src/commands/harness/index.js';

function write(rootDir: string, relativePath: string, content: string): void {
  const target = path.join(rootDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

describe('createHarnessCommand', () => {
  let rootDir = '';

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crux-cli-harness-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('requires --accept-defaults for non-interactive install runs', async () => {
    write(
      rootDir,
      'docs/sdlc/stack/stack.yaml',
      'quality_gates:\n  typecheck: pnpm tsc --noEmit\n',
    );
    write(rootDir, '.claude/settings.json', '{ "hooks": {} }');
    const command = createHarnessCommand();

    const result = await command(['install'], { rootDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--accept-defaults');
    expect(result.stdout).toBe('');
  });

  it('detects unresolved matcher/event collisions and halts before harness.lock can be written', async () => {
    write(
      rootDir,
      '.claude/settings.json',
      JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [
                  {
                    type: 'command',
                    command: 'pnpm prettier --write "$FILE_PATH"',
                    source_skill: 'formatter',
                  },
                  {
                    type: 'command',
                    command: 'pnpm eslint --fix "$FILE_PATH"',
                    source_skill: 'linter',
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
    );

    const command = createHarnessCommand();
    const result = await command(['install', '--accept-defaults'], { rootDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Write|Edit');
    expect(result.stderr).toContain('formatter');
    expect(result.stderr).toContain('linter');
    expect(result.stderr).toContain('harness.lock');
    expect(fs.existsSync(path.join(rootDir, 'docs/sdlc/harness/harness.lock'))).toBe(false);
    expect(result.stdout).toBe('');
  });

  it('allows same matcher/event hooks once explicit priorities are present', async () => {
    write(rootDir, 'docs/sdlc/stack/stack.yaml', 'quality_gates:\n  lint: pnpm eslint .\n');
    write(
      rootDir,
      '.claude/settings.json',
      JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'Write|Edit',
                hooks: [
                  {
                    type: 'command',
                    command: 'pnpm prettier --write "$FILE_PATH"',
                    source_skill: 'formatter',
                    priority: 10,
                  },
                  {
                    type: 'command',
                    command: 'pnpm eslint --fix "$FILE_PATH"',
                    source_skill: 'linter',
                    priority: 20,
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
    );

    const command = createHarnessCommand();
    const result = await command(['install', '--accept-defaults'], { rootDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Advisory harness plan');
    expect(result.stdout).toContain('formatter');
    expect(result.stdout).toContain('linter');
    expect(result.stderr).toBe('');
  });
});
