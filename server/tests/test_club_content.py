import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from club_content import scorers,roster
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
    def test_missing_roster_rejected(self):
        with self.assertRaises(ValueError):roster('<h1>Error</h1>')
if __name__=='__main__':unittest.main()
