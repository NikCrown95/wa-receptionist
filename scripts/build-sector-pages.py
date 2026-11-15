#!/usr/bin/env python3
"""Genera le pagine di settore della landing (una per settore) a partire da
public/provahtml/index.html.

Ogni pagina e' la stessa landing, con:
  - titolo, descrizione, canonical e dati strutturati dedicati al settore
  - window.PSEC = chiave del settore: la landing mostra solo quel settore
    (animazione in alto, sezione Dashboard, "Per chi e'?" su telefono)

Uso (dalla radice del repo):
    python3 scripts/build-sector-pages.py

Va rieseguito ogni volta che si modifica public/provahtml/index.html,
altrimenti le pagine di settore restano indietro rispetto alla home.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'provahtml', 'index.html')
BASE = 'https://prenolia.it'

# key = chiave del settore usata dalla landing (h, c, m, d, p)
SECTORS = [
    {
        'key': 'h',
        'slug': 'servizi-alla-persona',
        'title': 'Prenolia: agenda online per parrucchieri, barbieri ed estetiste',
        'desc': "L'agenda online con la segretaria virtuale per parrucchieri, barbieri ed estetiste. I clienti prenotano da soli, tu gestisci appuntamenti, clienti e statistiche.",
    },
    {
        'key': 'c',
        'slug': 'centri-sportivi',
        'title': 'Prenolia: agenda online per centri sportivi, campi e palestre',
        'desc': "L'agenda online con la segretaria virtuale per centri sportivi, campi da tennis, calcetto e padel. I clienti prenotano il campo da soli, tu gestisci orari, prenotazioni e statistiche.",
    },
    {
        'key': 'p',
        'slug': 'personal-trainer',
        'title': 'Prenolia: agenda online per personal trainer',
        'desc': "L'agenda online con la segretaria virtuale per personal trainer. I tuoi iscritti prenotano da soli le sessioni, tu gestisci pacchetti, ingressi e appuntamenti.",
    },
    {
        'key': 'm',
        'slug': 'studi-medici',
        'title': 'Prenolia: agenda online per studi medici e professionisti della salute',
        'desc': "L'agenda online per studi medici e professionisti della salute. Appuntamenti, promemoria automatici e pazienti sempre in ordine in un unico calendario.",
    },
    {
        'key': 'd',
        'slug': 'servizi-a-domicilio',
        'title': 'Prenolia: agenda online per servizi a domicilio e lezioni online',
        'desc': "L'agenda online con la segretaria virtuale per chi lavora a domicilio o online: lezioni, consulenze e interventi. I clienti prenotano da soli, tu gestisci appuntamenti e clienti.",
    },
]


def one(s, old, new):
    if s.count(old) != 1:
        sys.exit('Pattern non trovato (o ripetuto): %s' % old[:90])
    return s.replace(old, new)


def build(src, sec):
    url = '%s/%s' % (BASE, sec['slug'])
    t, d = sec['title'], sec['desc']
    s = src
    s = one(s, '<meta charset=utf8>', '<meta charset=utf8><script>window.PSEC=%r</script>' % sec['key'])
    s = re.sub(r"<title>.*?</title>", lambda m: '<title>%s</title>' % t, s, count=1, flags=re.S)
    s = one(s, '<link rel="canonical" href="https://prenolia.it/">', '<link rel="canonical" href="%s">' % url)
    s = re.sub(r'<meta name="description" content="[^"]*">', lambda m: '<meta name="description" content="%s">' % d, s, count=1)
    s = re.sub(r'<meta property="og:title" content="[^"]*">', lambda m: '<meta property="og:title" content="%s">' % t, s, count=1)
    s = re.sub(r'<meta property="og:description" content="[^"]*">', lambda m: '<meta property="og:description" content="%s">' % d, s, count=1)
    s = one(s, '<meta property="og:url" content="https://prenolia.it/">', '<meta property="og:url" content="%s">' % url)
    page = '{"@type":"WebPage","@id":"%s","url":"%s","name":"%s","isPartOf":{"@id":"%s/#site"},"inLanguage":"it"}' % (url, url, t, BASE)
    s = one(s, '"publisher":{"@id":"https://prenolia.it/#org"}}]}</script>', '"publisher":{"@id":"https://prenolia.it/#org"}},%s]}</script>' % page)
    # nelle pagine di settore le linguette di scelta non servono
    s = one(s, '</head>', '<style>.tabs,#pfTabs,#pfSc,#pfScD,#pfDd{display:none!important}</style></head>')
    s = one(s, "Scegli il tuo settore e guarda com'è fatta per te.", "Guarda com'è fatta per te.")
    return s


def main():
    src = open(SRC, encoding='utf8').read()
    for sec in SECTORS:
        out = os.path.join(ROOT, 'public', 'provahtml', sec['slug'] + '.html')
        open(out, 'w', encoding='utf8').write(build(src, sec))
        print('scritto', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    main()
