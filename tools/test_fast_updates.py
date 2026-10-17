"""Regression checks for fast publication and last-good report retention."""
import datetime,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import match_report as reports
import sync_news

NOW=datetime.datetime(2026,10,17,15,tzinfo=datetime.timezone.utc)
class FastReports(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.match={'date':'2026-10-17','round':3,'played':True,'acta_url':'https://www.rfaf.es/pnfg/NPcd/NFG_CmpPartido?CodActa=123'}
        self.old={'id':'123','blocks':[{'kind':'paragraph','text':'Acta'}]*10,'players':[], 'updated_at':(NOW-datetime.timedelta(minutes=6)).isoformat()}
        self.save(self.old)
    def save(self,data):
        p=self.root/'data/actas/123.json';p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data))
    def run_sync(self,matches=None):
        return reports.sync_recent_reports(matches or [self.match],lambda url:'official HTML',self.root,NOW)
    def test_recent_acta_rechecked_after_five_minutes(self):
        with patch.object(reports,'report',return_value={'blocks':[{'text':'New score'}]*10,'players':[]}):
            self.assertEqual(self.run_sync(),1)
        data=json.loads((self.root/'data/actas/123.json').read_text());self.assertEqual(data['blocks'][0]['text'],'New score')
    def test_fresh_copy_avoids_duplicate_fetch(self):
        self.old['updated_at']=(NOW-datetime.timedelta(minutes=2)).isoformat();self.save(self.old)
        with patch.object(reports,'report') as parser:self.assertEqual(self.run_sync(),0);parser.assert_not_called()
    def test_closed_match_replaces_fresh_preview(self):
        self.old.update(preview=True,updated_at=NOW.isoformat());self.save(self.old)
        with patch.object(reports,'report',return_value={'blocks':[{'text':'Final'}]*10,'players':[]}):self.assertEqual(self.run_sync(),1)
        self.assertNotIn('preview',json.loads((self.root/'data/actas/123.json').read_text()))
    def test_invalid_report_keeps_last_good_copy(self):
        before=(self.root/'data/actas/123.json').read_bytes()
        with patch.object(reports,'report',side_effect=ValueError('Incomplete acta')):self.assertEqual(self.run_sync(),0)
        self.assertEqual((self.root/'data/actas/123.json').read_bytes(),before)
    def test_historical_report_does_not_delay_recent_one(self):
        older={**self.match,'date':'2026-09-01','acta_url':self.match['acta_url'].replace('123','99')}
        with patch.object(reports,'report',return_value={'blocks':[{'text':'Fresh'}]*10,'players':[]}) as parser:
            self.assertEqual(self.run_sync([older,self.match,self.match]),1);self.assertEqual(parser.call_count,1)
    def test_played_matches_take_priority_over_future_previews(self):
        future={**self.match,'date':'2026-10-20','played':False,'acta_url':self.match['acta_url'].replace('123','456')}
        urls=[]
        def get(url):urls.append(url);return 'official HTML'
        with patch.object(reports,'report',return_value={'blocks':[{'text':'Fresh'}]*10,'players':[]}):reports.sync_recent_reports([future,self.match],get,self.root,NOW)
        self.assertTrue(urls[0].endswith('CodActa=123'))
    def test_partial_refresh_preserves_participant_stats_and_portrait(self):
        url='https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?jugador=12'
        self.old['players']=[{'name':'PLAYER, ONE','profile_url':url,'photo':'portrait','stats':[{'goals':2}],'competition_summary':{'goals':2}}];self.save(self.old)
        with patch.object(reports,'report',return_value={'blocks':[{'text':'Fresh'}]*10,'players':[{'name':'PLAYER, ONE','profile_url':url}]}):self.run_sync()
        player=json.loads((self.root/'data/actas/123.json').read_text())['players'][0]
        self.assertEqual(player['photo'],'portrait');self.assertEqual(player['stats'],[{'goals':2}]);self.assertEqual(player['competition_summary'],{'goals':2})
    def test_next_match_without_referees_does_not_replace_saved_report(self):
        before=(self.root/'data/actas/123.json').read_bytes()
        with patch.object(reports,'report',return_value={'blocks':[{'kind':'paragraph','text':'Pending'}],'players':[]}):self.assertEqual(self.run_sync([{**self.match,'played':False}]),0)
        self.assertEqual((self.root/'data/actas/123.json').read_bytes(),before)

class NewsRetention(unittest.TestCase):
    def test_failed_article_retains_previous_body_while_new_index_is_published(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for folder in ['data','server/static','android/app/src/main/assets']:(root/folder).mkdir(parents=True)
            row={'url':'https://cdmenciana.es/noticias/test/','title':'Updated','image':'https://cdmenciana.es/cover.jpg'}
            old={**row,'content':[{'kind':'paragraph','text':'Saved body'}]}
            (root/'data/news.json').write_text(json.dumps({'news':[old]}))
            class Reply:
                def __enter__(self):return self
                def __exit__(self,*args):pass
                def read(self,*args):return b'index'
            def open_url(request,**kwargs):
                if request.full_url==sync_news.NEWS_SOURCE:return Reply()
                raise OSError('Article temporarily unavailable')
            with patch.object(sync_news,'ROOT',root),patch.object(sync_news,'news',return_value=[row]),patch.object(sync_news.urllib.request,'urlopen',side_effect=open_url):sync_news.sync()
            saved=json.loads((root/'data/news.json').read_text())
            self.assertEqual(saved['news'][0]['content'],old['content']);self.assertEqual(saved['news'][0]['title'],'Updated')
if __name__=='__main__':unittest.main()
