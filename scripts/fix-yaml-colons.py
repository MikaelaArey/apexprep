#!/usr/bin/env python3
"""Rewrites one-line YAML values that are invalid as written (a plain value containing
': ', or a quoted value that continues after its closing quote)
as folded blocks, e.g.  why: Same flaw: x  ->  why: >-\n  Same flaw: x
Usage: python3 scripts/fix-yaml-colons.py content/**/*.yaml"""
import re, sys

KEYS = r'(text|why|body|tldr|takeaway|prompt|stimulus|label|front|back|title)'
def closing_quote(value):
    """Index of the quote that closes value[0], honoring \\" escapes and '' doubling."""
    q, i = value[0], 1
    while i < len(value):
        if q == '"' and value[i] == '\\':
            i += 2
            continue
        if value[i] == q:
            if q == "'" and i + 1 < len(value) and value[i + 1] == "'":
                i += 2
                continue
            return i
        i += 1
    return -1

pat = re.compile(r'^(\s*)(- )?' + KEYS + r': (.+)$')

for path in sys.argv[1:]:
    out, changed = [], 0
    for line in open(path, encoding='utf8').read().split('\n'):
        m = pat.match(line)
        if m:
            indent, dash, key, value = m.group(1), m.group(2) or '', m.group(3), m.group(4)
            plain = value[0] not in '"\'>|[{'
            # A quoted value that keeps going after its closing quote is invalid YAML.
            broken_quote = value[0] in '"\'' and closing_quote(value) not in (-1, len(value) - 1)
            if (plain and ': ' in value) or broken_quote:
                pad = indent + ('  ' if dash else '') + '  '
                out.append(f'{indent}{dash}{key}: >-')
                out.append(f'{pad}{value}')
                changed += 1
                continue
        out.append(line)
    if changed:
        open(path, 'w', encoding='utf8').write('\n'.join(out))
        print(f'{path}: fixed {changed}')
