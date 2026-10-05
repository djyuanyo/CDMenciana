import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('fixtures',Path(__file__).resolve().parents[2]/'tools/sync_fixtures.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)

def row(home='C.D. APAGA Y VAMONOS',away='Rival',state='Jugado',score='5-3'):
    return f'<article class="novanet-match-row"><img alt="{home}" src="https://stars.rfaf.es/storage/novanet/a.png"><div class="novanet-score-value">{score}</div><details><div><span>Fecha:</span> 12/09/2026</div><div><span>Hora:</span> 18:30</div><div><span>Lugar:</span> Pabellón municipal</div><div><span>Estado:</span> {state}</div></details><img alt="{away}" src="https://stars.rfaf.es/storage/novanet/b.png"></article>'
class FixtureTests(unittest.TestCase):
    def test_official_results_and_only_club(self):
        values=f.parse(row()+row(home='Equipo A',away='Equipo B'),1)
        self.assertEqual(len(values),1);self.assertEqual(values[0]['home_score'],5);self.assertEqual(values[0]['away_score'],3);self.assertEqual(values[0]['date'],'2026-09-12')
    def test_upcoming_time_is_not_a_score(self):
        values=f.parse(row(state='Pendiente',score='18:30'),5);self.assertIsNone(values[0]['home_score']);self.assertFalse(values[0]['played'])
    def test_mobile_duplicate_ignored(self):
        mobile=row().replace('novanet-match-row','sm:hidden');self.assertEqual(len(f.parse(mobile+row(),1)),1)
    def test_empty_is_distinct_from_broken_source(self):
        self.assertEqual(f.parse('<div>No hay partidos publicados para esta jornada.</div>',5),[])
        with self.assertRaises(ValueError):f.parse('<html>Error del servicio</html>',5)
    def test_accented_club_and_bad_results(self):
        self.assertTrue(f.is_club('Apaga y Vámonos RAVI'))
        with self.assertRaises(ValueError):f.parse(row(score='-'),1)
if __name__=='__main__':unittest.main()
