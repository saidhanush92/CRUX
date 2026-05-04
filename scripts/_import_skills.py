"""One-shot import of curated skills into .claude/skills/ with Crux-augmented frontmatter.
Run from the repo root: python scripts/_import_skills.py
This script is intentionally bootstrap-only and may be deleted after Phase 4.
"""
import os
import re
import datetime

ROOT = r'C:\Dev\CRUX'
DEST = os.path.join(ROOT, '.claude', 'skills')
NOW = datetime.datetime.utcnow().strftime('%Y-%m-%d')

POCOCK_BASE = r'C:\Users\Dhanush Sai\AppData\Local\Temp\pocock-skills\skills'
ECC_BASE = r'C:\Dev\everything-claude-code'

# (target_name, source_path, origin, source_kind, provides_capabilities)
IMPORTS = [
    ('grill-me',        f'{POCOCK_BASE}/productivity/grill-me/SKILL.md',       'pocock', 'skill',
     ['process.adversarial-grill', 'process.assumption-surfacing']),
    ('grill-with-docs', f'{POCOCK_BASE}/engineering/grill-with-docs/SKILL.md', 'pocock', 'skill',
     ['process.adversarial-grill', 'process.docs-grounded-grill']),
    ('diagnose',        f'{POCOCK_BASE}/engineering/diagnose/SKILL.md',        'pocock', 'skill',
     ['process.diagnostic-loop', 'quality.root-cause-analysis']),
    ('zoom-out',        f'{POCOCK_BASE}/engineering/zoom-out/SKILL.md',        'pocock', 'skill',
     ['process.context-reframing']),
    ('tdd-workflow',                 f'{ECC_BASE}/skills/tdd-workflow/SKILL.md',                 'ecc', 'skill',
     ['testing.tdd-loop', 'quality.coverage-floor']),
    ('architecture-decision-records',f'{ECC_BASE}/skills/architecture-decision-records/SKILL.md','ecc', 'skill',
     ['process.adr-authoring']),
    ('accessibility',                f'{ECC_BASE}/skills/accessibility/SKILL.md',                'ecc', 'skill',
     ['design.a11y', 'design.wcag-aa']),
    ('verification-loop',            f'{ECC_BASE}/skills/verification-loop/SKILL.md',            'ecc', 'skill',
     ['quality.verification-loop']),
    ('documentation-lookup',         f'{ECC_BASE}/skills/documentation-lookup/SKILL.md',         'ecc', 'skill',
     ['process.docs-lookup']),
    ('hexagonal-architecture',       f'{ECC_BASE}/skills/hexagonal-architecture/SKILL.md',       'ecc', 'skill',
     ['process.hex-architecture']),
    ('git-workflow',                 f'{ECC_BASE}/skills/git-workflow/SKILL.md',                 'ecc', 'skill',
     ['process.git-workflow']),
    ('e2e-testing',                  f'{ECC_BASE}/skills/e2e-testing/SKILL.md',                  'ecc', 'skill',
     ['testing.e2e', 'testing.playwright']),
    # Seed-list items present in ECC as commands/agents rather than skills.
    ('code-review',                  f'{ECC_BASE}/commands/code-review.md',                      'ecc', 'command',
     ['quality.code-review']),
    ('silent-failure-hunter',        f'{ECC_BASE}/agents/silent-failure-hunter.md',              'ecc', 'agent',
     ['quality.silent-failure-detection']),
    ('update-codemaps',              f'{ECC_BASE}/commands/update-codemaps.md',                  'ecc', 'command',
     ['process.codemap-maintenance']),
]

DROP_KEYS = {
    'name', 'provides_capabilities', 'purpose', 'origin',
    'imported_at', 'source_kind', 'imported_from',
}


def split_frontmatter(text):
    if text.startswith('---'):
        m = re.match(r'---\s*\n(.*?)\n---\s*\n?', text, re.S)
        if m:
            return m.group(1), text[m.end():]
    return None, text


def normalize_path_for_yaml(p):
    p = p.replace('\\', '/')
    if re.match(r'^[A-Za-z]:', p):
        p = p[0].lower() + p[1:]
    return p


def augment(name, src_path, origin, kind, caps):
    with open(src_path, 'r', encoding='utf-8') as f:
        src = f.read()
    fm, body = split_frontmatter(src)
    kept = []
    if fm:
        for line in fm.splitlines():
            key = line.split(':', 1)[0].strip().lstrip('-').strip() if ':' in line else ''
            if key in DROP_KEYS:
                continue
            kept.append(line)
    kept_block = '\n'.join(kept).rstrip()
    caps_yaml = '\n'.join(f'  - {c}' for c in caps)
    rel_src = normalize_path_for_yaml(src_path)
    new_fm = (
        f'name: {name}\n'
        f'origin: {origin}\n'
        f'source_kind: {kind}\n'
        f'imported_from: "{rel_src}"\n'
        f'imported_at: {NOW}\n'
        f'purpose: harness\n'
        f'provides_capabilities:\n{caps_yaml}\n'
    )
    if kept_block:
        new_fm += kept_block + '\n'
    out = f'---\n{new_fm}---\n{body.lstrip()}'
    dest_dir = os.path.join(DEST, name)
    os.makedirs(dest_dir, exist_ok=True)
    with open(os.path.join(dest_dir, 'SKILL.md'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(out)


def main():
    errs = 0
    for name, src, origin, kind, caps in IMPORTS:
        if not os.path.exists(src):
            print(f'MISSING source for {name}: {src}')
            errs += 1
            continue
        augment(name, src, origin, kind, caps)
        print(f'OK  {origin:6} {kind:7} {name}')
    print(f'imported: {len(IMPORTS) - errs}, errors: {errs}')
    return errs


if __name__ == '__main__':
    raise SystemExit(main())
