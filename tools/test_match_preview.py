import json, pathlib, sys, tempfile, unittest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'tools'))
import match_report

PAGE = '''<html><body><div class="container"><h4>Ficha de Partido</h4>
<table><tr><td>C.D. APAGA Y VAMONOS</td><td>-</td><td>C.D. CARCABUEY</td></tr></table>
<h4>Árbitros</h4><table><tr><td>ARBITRO PRINCIPAL</td></tr><tr><td>PEREZ LOPEZ, JUAN DELEGACION CORDOBA</td></tr></table>
</div></body></html>'''
EMPTY = PAGE.replace('PEREZ LOPEZ, JUAN DELEGACION CORDOBA', 'Pendiente de designar')
MATCH = {'played': False, 'acta_url': 'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=2645807'}

class MatchPreviewTests(unittest.TestCase):
    def test_upcoming_match_with_referees_is_saved_as_preview(self):
        root = pathlib.Path(tempfile.mkdtemp())
        self.assertEqual(1, match_report.sync_previews([MATCH, {'played': True, 'acta_url': MATCH['acta_url']}], lambda url: PAGE, root))
        data = json.loads((root / 'data/actas/2645807.json').read_text())
        self.assertTrue(data['preview'])
        self.assertTrue(match_report.has_referees(data))
        self.assertTrue((root / 'android/app/src/main/assets/actas/2645807.json').exists())

    def test_no_preview_until_referees_are_appointed(self):
        root = pathlib.Path(tempfile.mkdtemp())
        self.assertEqual(0, match_report.sync_previews([MATCH], lambda url: EMPTY, root))
        self.assertFalse((root / 'data/actas/2645807.json').exists())

    def test_players_are_published_before_referees_or_final_result(self):
        page=EMPTY.replace('<h4>Árbitros</h4>','<h4>C.D. APAGA Y VAMONOS</h4><h4>Titulares</h4><table><tr><td>7</td><td>LOPEZ, PEDRO</td></tr></table><h4>Árbitros</h4>')
        with tempfile.TemporaryDirectory() as folder:
            root=pathlib.Path(folder)
            self.assertEqual(1,match_report.sync_previews([MATCH],lambda url:page,root))
            data=json.loads((root/'data/actas/2645807.json').read_text())
            self.assertTrue(data['preview']);self.assertFalse(match_report.has_referees(data))
            self.assertIn('LOPEZ, PEDRO',json.dumps(data))

    def test_venue_only_is_useful_before_referees_are_assigned(self):
        page=EMPTY.replace('</div>','<table><tr><td>Estadio: Pabellón Municipal</td></tr></table></div>')
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(1,match_report.sync_previews([MATCH],lambda url:page,pathlib.Path(folder)))

if __name__ == '__main__':
    unittest.main()
