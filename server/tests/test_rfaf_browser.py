import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from rfaf_browser import PublicBrowserReader

class CardPage:
 url='https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador'
 def goto(self,*args,**kwargs):pass
 def locator(self,selector):
  if selector!='body':raise OSError('This public player page has cards, not tables')
  return self
 def inner_text(self):return 'Jugador del club · Partidos 2 · Goles 3'
 def content(self):return '<div class="card">Partidos: 2 · Goles: 3</div>'

class PublicReaderTests(unittest.TestCase):
 def test_rendered_card_statistics_are_not_discarded_without_a_table(self):
  reader=PublicBrowserReader();reader.page=CardPage()
  try:self.assertIn('Goles: 3',reader._read(CardPage.url))
  finally:reader.worker.shutdown()
