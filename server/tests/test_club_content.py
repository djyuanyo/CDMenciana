import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from club_content import scorers,roster,news,news_article
class ClubContentTests(unittest.TestCase):
    def test_goals_penalties_and_unpublished_average(self):
        html='<table class="table-hover"><tr><td>JUGADOR</td><td>Equipo</td><td>Grupo 17</td><td>4</td><td>4 (1 P)</td><td>1,0000</td></tr><tr><td>OTRO</td><td>Otro equipo</td><td>Grupo 17</td><td>0</td><td>2</td><td></td></tr></table>'
        rows=scorers(html)
        self.assertEqual((4,1,1.0),(rows[0]['goals'],rows[0]['penalties'],rows[0]['average']))
        self.assertIsNone(rows[1]['average'])
    def test_missing_goal_table_rejected(self):
        with self.assertRaises(ValueError):scorers('<h1>Error</h1>')
    def test_roster_preserves_name_number_and_photo_version(self):
        rows=roster('<article class="player-card"><img src="/images/jugadores/alex.webp?v=2"><h3>Álex</h3><span>Portero</span><p>#3</p></article>')
        self.assertEqual('Álex',rows[0]['name']);self.assertEqual(3,rows[0]['number'])
        self.assertEqual('Portero',rows[0]['position'])
        self.assertEqual('https://cdmenciana.es/images/jugadores/alex.webp?v=2',rows[0]['photo'])
    def test_news_title_date_image_and_link(self):
        html='<article class="news-card"><a href="/noticias/victoria/"><img src="https://cms.cdmenciana.es/media/image/thumb"></a><h3>Victoria del equipo</h3><span>Primer equipo</span><time datetime="2026-10-03">3 octubre</time></article>'
        row=news(html)[0]
        self.assertEqual('Victoria del equipo',row['title'])
        self.assertEqual('2026-10-03',row['date'])
        self.assertEqual('https://cdmenciana.es/noticias/victoria/',row['url'])
    def test_lead_story_and_archive_are_both_imported(self):
        html='<section class="news-lead"><img src="https://cms.cdmenciana.es/media/latest/web"><time datetime="2026-10-05"></time><h2><a href="/noticias/ultima/">Última noticia</a></h2></section><article class="news-card"><a href="/noticias/anterior/"></a><h3>Noticia anterior</h3><time datetime="2026-10-03"></time></article>'
        rows=news(html)
        self.assertEqual(2,len(rows))
        self.assertEqual(['Última noticia','Noticia anterior'],[r['title'] for r in rows])
    def test_news_failure_does_not_look_like_empty_feed(self):
        with self.assertRaises(ValueError):news('<h1>Error</h1>')
        self.assertEqual([],news('<h1>Noticias</h1>'))
    def test_missing_roster_rejected(self):
        with self.assertRaises(ValueError):roster('<h1>Error</h1>')
    def test_internal_article_preserves_order_without_navigation_or_scripts(self):
        html='<main><nav><p>Menú</p></nav><article><h1>Título</h1><div class="prose"><p>Texto <strong>completo</strong> &amp; real.</p><h2>La segunda parte</h2><ul><li>Primero</li><li>Segundo</li></ul><figure><img src="/images/foto.webp"><figcaption>Foto del club</figcaption></figure><p>Final.</p><script>alert(1)</script></div><aside><p>Otra noticia</p></aside></article></main>'
        blocks=news_article(html,'https://cdmenciana.es/noticias/partido/')
        self.assertEqual(['paragraph','heading','list','image','paragraph'],[b['kind'] for b in blocks])
        self.assertEqual('Texto completo & real.',blocks[0]['text'])
        self.assertEqual('https://cdmenciana.es/images/foto.webp',blocks[3]['src'])
        self.assertEqual('Foto del club',blocks[3]['caption'])
    def test_missing_article_text_is_rejected(self):
        with self.assertRaises(ValueError):news_article('<main><h1>Error</h1></main>','https://cdmenciana.es/noticias/fallo/')
if __name__=='__main__':unittest.main()
