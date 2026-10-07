import json, sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from official_rfaf import Document,scores,standings,team_crests,apply_crests,verify_results,calendar,enrich,TEAMS,team_staff,staff_source,team_players,official_roster
class OfficialRFAFTests(unittest.TestCase):
    def test_official_roster_uses_identity_and_latest_acta_numbers(self):
        names=team_players((Path(__file__).parent/'fixtures/rfaf_first_roster.html').read_text())
        data=json.loads((Path(__file__).resolve().parents[2]/'data/fixtures.json').read_text())
        rows=official_roster([m for m in data['matches'] if m['round']<=4],data['team'],names)
        self.assertEqual(13,len(rows))
        expected={5:('BAENA PRIEGO, ALBERTO','7503'),15:('CORDOBA CORTES, JUAN FRANCISCO','42718'),27:('CARRILLO RUBIO, ANTONIO JESUS','42566')}
        for row in rows:
            if row['number'] in expected:self.assertEqual(expected[row['number']],(row['name'],row['rfaf_id']))
            self.assertIn('jugador='+row['rfaf_id'],row['profile_url'])
            self.assertIn('codacta='+row['acta_id'],row['profile_url'])
    def test_official_roster_never_guesses_an_unpublished_identity(self):
        with self.assertRaises(ValueError):official_roster([],'C.D. APAGA Y VAMONOS',['NOMBRE, SIN PERFIL'])
    def test_first_team_staff_has_all_three_roles(self):
        html=(Path(__file__).parent/'fixtures/rfaf_first_staff.html').read_text()
        rows=team_staff(html)
        self.assertEqual(['technicians','delegates','delegates','assistants'],[r['group'] for r in rows])
        self.assertEqual('LUNA RUZ, JUAN',rows[-1]['name'])
        self.assertEqual('CÓRDOBA ÚBEDA, FRANCISCO JAVIER',rows[1]['name'])
        self.assertTrue(staff_source(TEAMS['first']).endswith('Codigo_Equipo=2137495'))
    def test_filial_staff_does_not_invent_absent_auxiliaries(self):
        html=(Path(__file__).parent/'fixtures/rfaf_filial_staff.html').read_text()
        self.assertEqual([('LOZANO GARCIA, JULIO','technicians'),('RUEDA JIMÉNEZ, FRANCISO JAVIER','delegates')],[(r['name'],r['group']) for r in team_staff(html)])
        self.assertTrue(staff_source(TEAMS['filial']).endswith('Codigo_Equipo=48536795'))
    def test_partial_or_wrong_staff_source_is_rejected(self):
        html=(Path(__file__).parent/'fixtures/rfaf_first_staff.html').read_text()
        for broken in [html.replace('Delegados (2)','Delegados (3)'),html.replace('C.D. APAGA Y VAMONOS','Otro club'),'<p>Sesión no disponible</p>']:
            with self.assertRaises(ValueError):team_staff(broken)
    def test_filial_regional_table_without_coefficient(self):
        html=(Path(__file__).parent/'fixtures/rfaf_filial_standings.html').read_text()
        rows=standings(html,team_count=8)
        club=next(r for r in rows if 'APAGA' in r['team'])
        self.assertEqual((4,1,1,0,1,0,1,1),tuple(club[k] for k in ['position','points','played','won','drawn','lost','gf','ga']))
        with self.assertRaises(ValueError):standings(html)
    def test_filial_calendar_has_four_matches_and_its_own_ids(self):
        tables=[]
        for n in range(1,15):
            rows=''.join(f'<tr><td>{"C.D. APAGA Y VAMONOS" if i==0 else "Local "+str(i)}</td><td><strong></strong><strong></strong></td><td>Visitante {i}</td></tr>' for i in range(4))
            tables.append(f'<table class="table-hover">Jornada {n} (10-10-2026){rows}</table>')
        html=''.join(tables);matches,numbers=calendar(html,all_teams=True,config=TEAMS['filial'])
        self.assertEqual((56,14),(len(matches),len(numbers)))
        self.assertEqual(56,len({m['id'] for m in matches}))
        self.assertTrue(all(m['id'].startswith('49113036-') and 'CodCompeticion=49113015' in m['source'] for m in matches))
        with self.assertRaises(ValueError):calendar(html,all_teams=True)
    def score(self,html):return scores(Document('<td>'+html+'</td>').root.find('td')[0])
    def test_hidden_digits_and_icons(self):
        self.assertEqual((5,3),self.score('<strong><style>#x:before{content:"0";display:none}</style><span>5<span style="display:none">9</span></span></strong><strong><i id="x"><script>ntype("x",8,0,"fa-6");</script><span style="display:none">6</span></i></strong>'))
    def test_visible_css_digit(self):
        self.assertEqual((5,3),self.score('<strong>5</strong><strong><style>#x:before{content:"\\0033"}</style><span id="x"><span style="display:none">4</span></span></strong>'))
    def test_two_digit_result(self):
        self.assertEqual((11,4),self.score('<strong><i id="a"><script>ntype("a",4,0,"fa-1");</script></i><i id="b"><script>ntype("b",4,0,"fa-1");</script></i></strong><strong><i id="c"><script>ntype("c",3,0,"fa-6");</script></i></strong>'))
    def test_icon_digit_preserves_visible_following_digit(self):
        self.assertEqual((11,4),self.score('<strong><i id="a"><script>ntype("a",4,0,"fa-2");</script>1<span style="display:none">2</span></i></strong><strong>4</strong>'))
    def test_score_mismatch_does_not_freeze_new_kickoff_times(self):
        prior={'id':'match','home':'Rival','away':'APAGA Y VAMONOS','played':True,'home_score':11,'away_score':4}
        current=dict(prior,home_score=1,time='19:00')
        state=verify_results([current],{'played':1,'gf':4,'ga':11},{'matches':[prior]})
        self.assertEqual('pending',state)
        self.assertEqual((11,4,'19:00'),(current['home_score'],current['away_score'],current['time']))
    def test_future_is_not_zero_zero(self):self.assertEqual((None,None),self.score('<strong></strong><strong></strong>'))
    def test_unknown_score_rejected(self):
        with self.assertRaises(ValueError):self.score('<strong>?</strong><strong>4</strong>')
    def test_crests_fill_future_calendar(self):
        html='<table><div class="font_widgetL"><h4>C.D. APAGA Y VAMONOS</h4></div><img class="escudo_widget2" src="https://official/club.jpg"><div class="font_widgetV"><h4>Rival</h4></div><img class="escudo_widget2" src="https://official/rival.png"></table>'
        logos=team_crests(html)
        matches=[{'home':'C.D. APAGA Y VAMONOS','away':'Rival','home_crest':'','away_crest':''}]
        apply_crests(matches,[],logos)
        self.assertEqual('https://official/club.jpg',matches[0]['home_crest'])
        self.assertEqual('https://official/rival.png',matches[0]['away_crest'])
    def test_calendar_contains_all_eight_matches_in_every_round(self):
        tables=[]
        for n in range(1,31):
            rows=''.join(f'<tr><td>{"C.D. APAGA Y VAMONOS" if i==0 else "Local "+str(i)}</td><td><strong></strong><strong></strong></td><td>Visitante {i}</td></tr>' for i in range(8))
            tables.append(f'<table class="table-hover">Jornada {n} (10-10-2026){rows}</table>')
        matches,_=calendar(''.join(tables),all_teams=True)
        self.assertEqual(240,len(matches))
        self.assertEqual(240,len({m['id'] for m in matches}))
        self.assertEqual(8,len([m for m in matches if m['round']==5]))
    def test_kickoff_is_attached_to_matching_rival_pair(self):
        def table(home,away,hour):
            return f'<table><div class="font_widgetL"><h4>{home}</h4></div><div class="font_widgetV"><h4>{away}</h4></div><span class="horario">10-10-2026 {hour}</span></table>'
        match={'home':'Local rival','away':'Visitante rival','played':False}
        enrich(match,table('C.D. APAGA Y VAMONOS','Otro','19:00')+table('Local rival','Visitante rival','17:30'))
        self.assertEqual('17:30',match['time'])
        self.assertEqual('2026-10-10',match['date'])
    def test_team_roster_links_belong_to_home_and_away(self):
        match={'home':'Local','away':'Visitante','played':True}
        html='''<table><a href="/pnfg/NPcd/NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=11"><div class="font_widgetL"><h4>Local</h4></div></a><a href="/pnfg/NPcd/NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=22"><div class="font_widgetV"><h4>Visitante</h4></div></a></table>'''
        enrich(match,html)
        self.assertIn('Codigo_Equipo=11',match['home_team_url'])
        self.assertIn('Codigo_Equipo=22',match['away_team_url'])
    def test_acta_link_belongs_to_correct_match(self):
        match={'home':'Local','away':'Visitante','played':True}
        html='<table><div class="font_widgetL"><h4>Local</h4></div><div class="font_widgetV"><h4>Visitante</h4></div><a class="btn btn-success btn-sm" href="/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&amp;CodActa=2645799">Acta</a></table>'
        enrich(match,html)
        self.assertEqual('https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=2645799',match['acta_url'])
    def test_home_away_standings_totals(self):
        rows=[]
        for pos in range(1,17):
            vals=['',str(pos),'C.D. APAGA Y VAMONOS' if pos==7 else 'Equipo '+str(pos),'1,7500','7','2','2','0','0','2','0','1','1','13','16','G E G P','0']
            rows.append('<tr>'+''.join('<td>'+v+'</td>' for v in vals)+'</tr>')
        row=standings('<table class="table-bordered">'+''.join(rows)+'</table>')[6]
        self.assertEqual((4,2,1,1,13,16,-3),tuple(row[k] for k in ['played','won','drawn','lost','gf','ga','gd']))
if __name__=='__main__':unittest.main()
