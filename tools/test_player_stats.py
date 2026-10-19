"""Regression checks for current player totals, cache invalidation and last-good data."""
import datetime,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import player_stats as stats

NOW=datetime.datetime(2026,10,19,18,tzinfo=datetime.timezone.utc)
class CurrentPlayerStats(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.config={'key':'first','filename':'fixtures.json'}
        self.url='https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?jugador=12&codacta=100&cod_primaria=5000274'
        self.player={'name':'PLAYER, ONE','rfaf_id':'12','id':'aaaaaaaa','acta_id':'100','profile_url':self.url,'stats':[{'title':'Goles','rows':[['Total','2']]}]}
        self.data={'team_key':'first','roster':[self.player],'matches':[{'round':6,'played':True,'acta_url':'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?CodActa=106'}]}
        stats.save(self.root/'data/fixtures.json',self.data)
        self.profile={'name':'PLAYER, ONE','sections':[{'title':'Goles','rows':[['Total','3']]}],'updated_at':NOW.isoformat()}
    def sync(self,get=lambda url:'public HTML'):
        with patch('official_rfaf.write_roster_snapshot'),patch.object(stats,'player_profile',return_value=self.profile):
            return stats.refresh_stats(self.config,get,self.root,NOW)
    def result(self):return json.loads((self.root/'data/fixtures.json').read_text())['roster'][0]
    def test_new_round_invalidates_young_cache_and_keeps_match_identity(self):
        old={**self.profile,'stats_signature':'round-five','updated_at':NOW.isoformat()}
        stats.save(self.root/'data/rfaf-player-profiles.json',{'profiles':{self.url:old}})
        urls=[];self.assertEqual(self.sync(lambda url:urls.append(url) or 'HTML'),1)
        self.assertIn('codacta=106',urls[0])
        row=self.result();self.assertEqual(row['stats'][0]['rows'][0][1],'3');self.assertEqual(row['acta_id'],'100');self.assertEqual(row['id'],'aaaaaaaa');self.assertEqual(row['stats_round'],6)
    def test_same_round_fresh_cache_does_not_fetch_again(self):
        self.sync()
        with patch.object(stats,'player_profile') as parser:
            self.assertEqual(self.sync(lambda url:self.fail('Fresh cache should avoid network')),1)
    def test_failed_fetch_preserves_verified_stats(self):
        self.assertEqual(self.sync(lambda url:(_ for _ in ()).throw(OSError('unavailable'))),0)
        self.assertEqual(self.result()['stats'],self.player['stats'])
    def test_different_player_response_is_rejected(self):
        self.assertEqual(self.sync(lambda url:'<h4>OTHER, PERSON</h4>'),0)
        self.assertEqual(self.result()['id'],'aaaaaaaa')
if __name__=='__main__':unittest.main()
