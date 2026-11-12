"""Assemble the site from src/ into one self-contained page, docs/index.html (the page GitHub Pages serves).
Usage: python build.py   (run from the repository root)"""
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = HERE / 'src'
VIEWS = ['home.html', 'cocktail.html', 'effort.html', 'internship.html']
SCRIPTS = ['data/cocktail_data.js', 'core.js', 'fx.js', 'effort.js', 'internship.js', 'cocktail.js']

TITLE = 'Sudan Duwadi Research'
ICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23060A12'/%3E"
        "%3Ccircle cx='16' cy='16' r='7' fill='%23FF6A4D'/%3E%3C/svg%3E")
FONTS = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400..600&family=Source+Sans+3:ital,wght@0,400..700;1,400&display=swap'
HEAD = f'''<title>{TITLE}</title>
<meta name="description" content="Three projects from Sudan Duwadi's PhD, explained from the ground up.">
<link rel="icon" href="{ICON}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="{FONTS}">
'''


def read(name):
    return (SRC / name).read_text(encoding='utf-8')


def page():
    """The two halves of the page: what goes in <head>, and what goes in <body>."""
    head = HEAD + '<style>\n' + read('styles.css') + '\n</style>\n'
    body = read('nav.html') + '<main id="main">\n' + '\n'.join(read(v) for v in VIEWS) + '\n</main>\n' + read('footer.html')
    for s in SCRIPTS:
        body += f'<script>\n{read(s)}\n</script>\n'
    return head, body


if __name__ == '__main__':
    head, body = page()
    html = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n'
            + head + '</head>\n<body>\n' + body + '</body>\n</html>\n')
    (HERE / 'docs').mkdir(exist_ok=True)
    (HERE / 'docs' / 'index.html').write_text(html, encoding='utf-8')
    print(f'docs/index.html {len(html) / 1024:.0f} kB')
