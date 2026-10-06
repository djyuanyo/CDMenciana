import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from match_report import report
class MatchReportTests(unittest.TestCase):
    def test_visible_data_cards_goals_and_metadata_without_scripts(self):
        html='<div class="container"><h4>Ficha de Partido</h4>'+''.join('<h5>'+name+'</h5>' for name in ['Jornada 1','Árbitros','Goles','Estadio','Local','Titulares','Suplentes','Cuerpo Técnico','Tarjetas','Visitante'])
        html+='<table><tr><td><img src="tarj_amar.gif"></td><td>(13\') Jugador</td></tr><tr><td><i class="fa-futbol" style="color:red"></i><style>#x:after{content:"2"}</style><span id="x">0</span> - 2</td><td>Nombre</td></tr></table><script>alert("bad")</script></div>'
        blocks=report(html)['blocks'];text=str(blocks)
        self.assertIn('Tarjeta amarilla',text);self.assertIn('Gol en propia puerta · 02 - 2',text)
        self.assertIn('Suplentes',text);self.assertNotIn('alert',text)
    def test_cookie_wall_is_not_an_acta(self):
        with self.assertRaises(ValueError):report('<html>Cookies pendientes</html>')
