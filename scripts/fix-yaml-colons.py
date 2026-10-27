#!/usr/bin/env python3
"""Rewrites one-line YAML values that contain ': ' (invalid as plain scalars)
as folded blocks, e.g.  why: Same flaw: x  ->  why: >-\n  Same flaw: x
Usage: python3 scripts/fix-yaml-colons.py content/**/*.yaml"""
import re, sys

KEYS = r'(text|why|body|tldr|takeaway|prompt|stimulus|label|front|back|title)'
pat = re.compile(r'^(\s*)(- )?' + KEYS + r': (.+)$')

for path in sys.argv[1:]:
    out, changed = [], 0
    for line in open(path, encoding='utf8').read().split('\n'):
        m = pat.match(line)
        if m:
            indent, dash, key, value = m.group(1), m.group(2) or '', m.group(3), m.group(4)
            plain = value[0] not in '"\'>|[{'
            if plain and ': ' in value:
                pad = indent + ('  ' if dash else '') + '  '
                out.append(f'{indent}{dash}{key}: >-')
                out.append(f'{pad}{value}')
                changed += 1
                continue
        out.append(line)
    if changed:
        open(path, 'w', encoding='utf8').write('\n'.join(out))
        print(f'{path}: fixed {changed}')
