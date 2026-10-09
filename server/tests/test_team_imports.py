import unittest,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from team_imports import source_config,preview,validate_catalog,ROOT
from official_rfaf import calendar,team_query
SOURCE='https://www.rfaf.es/pnfg/NPcd/NFG_VisCalendario_Vis?codtemporada=22&codcompeticion=49465203&codgrupo=49465413&CodJornada=3'
class TeamImportTests(unittest.TestCase):
 def test_url_validation_and_season_query(self):
  cfg=source_config(SOURCE);self.assertEqual(cfg['competition_id'],'49465203');self.assertIn('CodTemporada=23',team_query(dict(cfg,season_id='23')))
  for url in ['https://evil.test/calendar?codgrupo=1','http://www.rfaf.es/pnfg/NPcd/NFG_VisCalendario_Vis','https://www.rfaf.es/pnfg/NPcd/NFG_VisCalendario_Vis?codtemporada=22&codcompeticion=1&codgrupo=../x']:
   with self.assertRaises(ValueError):source_config(url)
 def test_preview_selects_only_official_club_and_supports_byes(self):
  html='<h4>2ª Andaluza Cadete F.S. (Cordoba), Grupo A</h4><div>Temporada 2026-2027</div>'
  for n in range(1,7):
   bye=n in (2,5)
   html+=f'<table class="table-hover"><tr><th>Jornada {n} (11-10-2026)</th></tr><tr><td>C.D. MENCIANA</td><td></td><td>{"Descansa" if bye else "Rival"}</td></tr><tr><td>{"Rival" if bye else "Otro"}</td><td></td><td>{"Otro" if bye else "Descansa"}</td></tr></table>'
  links='<a href="/pnfg/NPcd/NFG_VisEquipos?Codigo_Equipo=1234">C.D. MENCIANA</a><a href="/pnfg/NPcd/NFG_VisEquipos?Codigo_Equipo=999">Rival</a><a href="https://evil.test/pnfg/NPcd/NFG_VisEquipos?Codigo_Equipo=888">C.D. MENCIANA</a>'
  p=preview(html,links,SOURCE);self.assertEqual(p['team_count'],3);self.assertEqual(p['round_count'],6);self.assertTrue(p['has_byes']);self.assertEqual(p['candidates'],[dict(team_id='1234',team_name='C.D. MENCIANA')])
  cfg=dict(p,key='rfaf_49465413_1234',team_name='C.D. MENCIANA');games,rounds=calendar(html,True,cfg);self.assertEqual(len(games),6);self.assertFalse(any(m['away']=='Descansa' for m in games));games,rounds=calendar(html,False,cfg);self.assertEqual(len(games),4)
 def test_catalog_preserves_original_ids_and_blocks_path_injection(self):
  value=json.loads((ROOT/'data/club-teams.json').read_text());self.assertEqual([t['key'] for t in validate_catalog(value)],['first','filial','infantil'])
  value['teams'][0]['filename']='../private.json'
  with self.assertRaises(ValueError):validate_catalog(value)
