import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from official_rfaf import Document,scores,standings
class OfficialRFAFTests(unittest.TestCase):
    def score(self,html):return scores(Document('<td>'+html+'</td>').root.find('td')[0])
    def test_hidden_digits_and_icons(self):
        self.assertEqual((5,3),self.score('<strong><style>#x:before{content:"0";display:none}</style><span>5<span style="display:none">9</span></span></strong><strong><i id="x"><script>ntype("x",8,0,"fa-6");</script><span style="display:none">6</span></i></strong>'))
    def test_visible_css_digit(self):
        self.assertEqual((5,3),self.score('<strong>5</strong><strong><style>#x:before{content:"\\0033"}</style><span id="x"><span style="display:none">4</span></span></strong>'))
    def test_two_digit_result(self):
        self.assertEqual((11,4),self.score('<strong><i id="a"><script>ntype("a",4,0,"fa-1");</script></i><i id="b"><script>ntype("b",4,0,"fa-1");</script></i></strong><strong><i id="c"><script>ntype("c",3,0,"fa-6");</script></i></strong>'))
    def test_future_is_not_zero_zero(self):self.assertEqual((None,None),self.score('<strong></strong><strong></strong>'))
    def test_unknown_score_rejected(self):
        with self.assertRaises(ValueError):self.score('<strong>?</strong><strong>4</strong>')
    def test_home_away_standings_totals(self):
        rows=[]
        for pos in range(1,17):
            vals=['',str(pos),'C.D. APAGA Y VAMONOS' if pos==7 else 'Equipo '+str(pos),'1,7500','7','2','2','0','0','2','0','1','1','13','16','G E G P','0']
            rows.append('<tr>'+''.join('<td>'+v+'</td>' for v in vals)+'</tr>')
        row=standings('<table class="table-bordered">'+''.join(rows)+'</table>')[6]
        self.assertEqual((4,2,1,1,13,16,-3),tuple(row[k] for k in ['played','won','drawn','lost','gf','ga','gd']))
if __name__=='__main__':unittest.main()
