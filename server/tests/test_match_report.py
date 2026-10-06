import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from match_report import report,player_profile,player_refs,participant_refs,profile_for_acta
class MatchReportTests(unittest.TestCase):
    def test_visible_data_cards_goals_and_metadata_without_scripts(self):
        html='<div class="container"><h4>Ficha de Partido</h4>'+''.join('<h5>'+name+'</h5>' for name in ['Jornada 1','Árbitros','Goles','Estadio','Local','Titulares','Suplentes','Cuerpo Técnico','Tarjetas','Visitante'])
        html+='<table><tr><td><img src="tarj_amar.gif"></td><td>(13\') Jugador</td></tr><tr><td><i class="fa-futbol" style="color:red"></i><style>#x:after{content:"2"}</style><span id="x">0</span> - 2</td><td>Nombre</td></tr></table><script>alert("bad")</script></div>'
        blocks=report(html)['blocks'];text=str(blocks)
        self.assertIn('Tarjeta amarilla',text);self.assertIn('Gol en propia puerta · 02 - 2',text)
        self.assertIn('Suplentes',text);self.assertNotIn('alert',text)

    def test_player_link_photo_and_public_stats_are_preserved(self):
        html='''<div class="container"><h4>Ficha de Partido</h4><h5>Local</h5><h5>Titulares</h5>
        <table><tr><td>10</td><td><a href="/pnfg/NPcd/NFG_EstadisticasJugador?cod_primaria=3000328&jugador=77&codacta=1234&nueva_ventana=0">SANCHEZ, ALBERTO</a></td></tr></table>
        <h5>Suplentes</h5><h5>Cuerpo Técnico</h5><h5>Tarjetas</h5><h5>Visitante</h5><h5>Titulares</h5>
        <table><tr><td>1</td><td>LOPEZ, JUAN</td></tr></table><h5>Suplentes</h5><h5>Cuerpo Técnico</h5><h5>Tarjetas</h5></div>'''
        data=report(html);self.assertEqual(1,len(data['players']))
        player=data['players'][0];self.assertEqual('SANCHEZ, ALBERTO',player['name'])
        self.assertIn('NFG_EstadisticasJugador',player['profile_url'])
        profile=player_profile('''<main><img class="foto-jugador" width="180" height="220" src="/pnfg/pimg/Jugadores/77.jpg">
        <table><tr><th>Temporada</th><th>Partidos</th><th>Goles</th></tr><tr><td>2026-2027</td><td>4</td><td>3</td></tr></table></main>''',player['profile_url'],player['name'])
        self.assertEqual('https://www.rfaf.es/pnfg/pimg/Jugadores/77.jpg',profile['photo_source'])
        self.assertTrue(profile['sections']);self.assertIn('Partidos',str(profile['sections']))

    def test_preview_onclick_can_recover_player_profile_reference(self):
        html='''<div><a href="#" onclick="window.open('/pnfg/NPcd/NFG_EstadisticasJugador?cod_primaria=3000328&amp;jugador=9981&amp;codacta=222&amp;nueva_ventana=0')">PEREZ LOPEZ, ANA</a></div>'''
        players=player_refs(html)
        self.assertEqual(1,len(players));self.assertEqual('PEREZ LOPEZ, ANA',players[0]['name'])
        self.assertIn('jugador=9981',players[0]['profile_url'])
    def test_team_roster_profiles_are_filtered_to_acta_participants(self):
        data={'blocks':[{'kind':'table','rows':[['10','SANCHEZ, ALBERTO'],['Gol · 1 - 0',"(5') PEREZ, JUAN"]]}]}
        refs=[{'name':'SANCHEZ, ALBERTO','profile_url':'https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?cod_primaria=3000328&jugador=77&codacta=1&nueva_ventana=0'},
              {'name':'PEREZ, JUAN','profile_url':'https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?cod_primaria=3000328&jugador=88&codacta=1&nueva_ventana=0'},
              {'name':'NO JUEGA, PEDRO','profile_url':'https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?cod_primaria=3000328&jugador=99&codacta=1&nueva_ventana=0'}]
        picked=participant_refs(data,refs)
        self.assertEqual({'SANCHEZ, ALBERTO','PEREZ, JUAN'},{p['name'] for p in picked})
        linked=profile_for_acta(picked[0],'2645766')
        self.assertIn('codacta=2645766',linked['profile_url'])
    def test_cookie_wall_is_not_an_acta(self):
        with self.assertRaises(ValueError):report('<html>Cookies pendientes</html>')
