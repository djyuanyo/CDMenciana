import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from match_report import report,player_profile,player_refs,participant_refs,profile_for_acta,merge_saved_players,competition_summaries
class MatchReportTests(unittest.TestCase):
    def test_totals_need_all_actas_and_bench_does_not_prove_played(self):
        players=[dict(name=name,profile_url='https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?jugador='+id) for name,id in [('PEREZ, JUAN','77'),('LOPEZ, ANA','88'),('GARCIA, EVA','99')]]
        data={'players':players,'blocks':[
            {'kind':'heading','text':'Goles'},{'kind':'table','rows':[['Gol · 1 - 0',"(5') PEREZ, JUAN"],['Gol en propia puerta · 1 - 1',"(6') PEREZ, JUAN"]]},
            {'kind':'heading','text':'Local'},{'kind':'heading','text':'Titulares'},{'kind':'table','rows':[['9','PEREZ, JUAN']]},
            {'kind':'heading','text':'Suplentes'},{'kind':'table','rows':[['8','LOPEZ, ANA']]},
            {'kind':'heading','text':'Visitante'},{'kind':'heading','text':'Titulares'},{'kind':'table','rows':[['1','GARCIA, EVA']]}]}
        match={'played':True,'home':'Local','away':'Visitante','acta_url':'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?CodActa=123'}
        totals=competition_summaries({'123':data},[match])
        self.assertEqual(1,totals[('77','Local')]['goals']);self.assertEqual(1,totals[('77','Local')]['starts'])
        self.assertEqual(0,totals[('88','Local')]['starts']);self.assertIsNone(totals[('88','Local')]['played'])
        missing={**match,'acta_url':'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?CodActa=124'}
        self.assertEqual({},competition_summaries({'123':data},[match,missing]))
    def test_partial_refresh_keeps_only_the_same_players_portrait_and_stats(self):
        def ref(id,**extra):return dict(name='PEREZ, JUAN',profile_url='https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?jugador='+id,**extra)
        old={'players':[ref('77',photo='public-photo.jpg',stats=[{'title':'Partidos','rows':[['Jugados','3']]}],profile_updated_at='2026-10-07T10:00:00Z')]}
        data=merge_saved_players({'players':[ref('77',photo='')]},old)
        self.assertEqual('public-photo.jpg',data['players'][0]['photo'])
        self.assertEqual('3',data['players'][0]['stats'][0]['rows'][0][1])
        other=merge_saved_players({'players':[ref('88',photo='')]},old)
        self.assertEqual('',other['players'][0]['photo'])
        self.assertFalse(other['players'][0].get('stats'))
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
    def test_anchor_photo_is_read_from_its_own_table_row(self):
        players=player_refs('<table><tr><td><img data-src="/pnfg/pimg/Jugadores/9981.jpg"></td><td><a href="NFG_EstadisticasJugador?jugador=9981&codacta=222">PEREZ LOPEZ, ANA</a></td></tr><tr><td><img src="/pnfg/pimg/Jugadores/9982.jpg"></td><td><a href="NFG_EstadisticasJugador?jugador=9982&codacta=222">GARCIA, MARIA</a></td></tr></table>')
        self.assertEqual('https://www.rfaf.es/pnfg/pimg/Jugadores/9981.jpg',players[0]['photo'])
        self.assertEqual('https://www.rfaf.es/pnfg/pimg/Jugadores/9982.jpg',players[1]['photo'])
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
    def test_real_acta_rows_keep_correct_names_and_inline_jpeg_photos(self):
        html=(Path(__file__).parent/'fixtures/rfaf_acta_players.html').read_text()
        players=player_refs(html)
        self.assertEqual(['PEREZ MORALES, FABIAN','LUNA CUBERO, JESUS'],[p['name'] for p in players])
        self.assertTrue(all(p['photo'].startswith('data:image/jpeg;base64,') for p in players))
        self.assertNotEqual(players[0]['photo'],players[1]['photo'])
        self.assertIn('jugador=20961931',players[0]['profile_url'])
        self.assertIn('jugador=319856',players[1]['profile_url'])
        self.assertTrue(all('/pnfg/NPcd/NFG_EstadisticasJugador?' in p['profile_url'] for p in players))
    def test_current_rfaf_statistics_keep_section_titles_and_values(self):
        html=''.join('<table><tr><th colspan="2">'+title+'</th></tr>'+''.join('<tr><td>'+label+'</td><td>'+value+'</td></tr>' for label,value in rows)+'</table>' for title,rows in [('Partidos',[('Convocados','4'),('Titular','3'),('Suplente','1'),('Jugados','3')]),('Sanciones',[('Total','1'),('Tarjeta roja','1')]),('Goles',[('Total','0'),('Goles por partido','0.0')])])
        stats=player_profile(html,'https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?jugador=319856','LUNA CUBERO, JESUS')['sections']
        self.assertEqual(['Partidos','Sanciones','Goles'],[s['title'] for s in stats])
        self.assertEqual(['Convocados','4'],stats[0]['rows'][0])
        self.assertEqual(['Goles por partido','0.0'],stats[2]['rows'][-1])
        with self.assertRaises(ValueError):player_profile('<html>Cookies pendientes</html>','https://www.rfaf.es/','PRUEBA, NOMBRE')
