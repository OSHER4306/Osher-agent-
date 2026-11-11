"""Executable model of Codex marketplace source classification (not the Codex Rust suite)."""
from pathlib import Path
from tempfile import TemporaryDirectory


def old_parse(source):
    base, sep, suffix = source.rpartition('#')
    base = base if sep else source
    ref = suffix or None if sep else None
    if Path(base).is_absolute() or base.startswith(('./', '../')):
        if ref is not None:
            raise ValueError('git ref on local source')
        return ('local', str(Path(base).resolve()))
    return ('git', base, ref)


def new_parse(source, explicit_ref=None):
    if Path(source).is_absolute() or source.startswith(('./', '../')):
        if explicit_ref is not None:
            raise ValueError('git ref on local source')
        return ('local', str(Path(source).resolve()))
    return old_parse(source)


def test():
    with TemporaryDirectory() as root:
        for name in ['folder', 'folder#', 'folder#one']:
            (Path(root)/name).mkdir()
        for name in ['folder#', 'folder#one']:
            source = str(Path(root)/name)
            assert new_parse(source) == ('local', str(Path(source).resolve()))
            try:
                old = old_parse(source)
            except ValueError:
                old = 'rejected'
            assert old != new_parse(source), (source, old)
        try:
            new_parse(str(Path(root)/'folder#one'), explicit_ref='main')
        except ValueError:
            pass
        else:
            raise AssertionError('explicit ref should be rejected')
    print('PASS: 3 regression checks (simulation only)')


if __name__ == '__main__':
    test()
