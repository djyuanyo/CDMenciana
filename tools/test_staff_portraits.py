import unittest
from match_report import merge_saved_players

class StaffPortraits(unittest.TestCase):
    def test_partial_refresh_retains_exact_person_and_team_photo(self):
        old={'staff':[{'name':'PEREZ, JUAN','team':'LOCAL FS','photo':'portrait'}]}
        fresh={'staff':[{'name':'PEREZ, JUAN','team':'LOCAL FS','photo':''}]}
        self.assertEqual(merge_saved_players(fresh,old)['staff'][0]['photo'],'portrait')

    def test_identical_opponent_name_never_inherits_club_portrait(self):
        old={'staff':[{'name':'PEREZ, JUAN','team':'LOCAL FS','photo':'portrait'}]}
        fresh={'staff':[{'name':'PEREZ, JUAN','team':'VISITANTE FS','photo':''}]}
        self.assertEqual(merge_saved_players(fresh,old)['staff'][0]['photo'],'')

    def test_new_photo_wins_and_removed_staff_stays_removed(self):
        old={'staff':[{'name':'PEREZ, JUAN','team':'LOCAL FS','photo':'old'}]}
        fresh={'staff':[{'name':'PEREZ, JUAN','team':'LOCAL FS','photo':'new'}]}
        self.assertEqual(merge_saved_players(fresh,old)['staff'][0]['photo'],'new')
        self.assertEqual(merge_saved_players({'staff':[]},old)['staff'],[])

class PreviewRosterRetention(unittest.TestCase):
    def test_new_preview_keeps_verified_stats_for_the_same_player(self):
        import json,tempfile
        from pathlib import Path
        from unittest.mock import patch
        import official_rfaf
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'data/actas').mkdir(parents=True)
            matches=[]
            for number,player,stats in [(1,'7',[{'title':'Goles','rows':[['Total','2']]}]),(2,'7',[])]:
                matches.append({'round':number,'home':'CLUB','away':'RIVAL','acta_url':'https://www.rfaf.es/?CodActa='+str(number)})
                data={'preview':number==2,'blocks':[{'text':'CLUB'},{'text':'Titulares'},{'kind':'table','rows':[['5','PEREZ, JUAN']]}],'players':[{'name':'PEREZ, JUAN','id':'player','profile_url':'https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?jugador='+player,'stats':stats,'profile_updated_at':'verified-time'}]}
                (root/'data/actas'/(str(number)+'.json')).write_text(json.dumps(data))
            with patch.object(official_rfaf,'ROOT',root):
                rows=official_rfaf.report_roster(matches,'CLUB')
            self.assertEqual(rows[0]['stats'][0]['title'],'Goles');self.assertEqual(rows[0]['acta_id'],'2')
            data['players'][0]['profile_url']='https://www.rfaf.es/pnfg/NPcd/NFG_EstadisticasJugador?jugador=8'
            (root/'data/actas/2.json').write_text(json.dumps(data))
            with patch.object(official_rfaf,'ROOT',root):self.assertEqual(official_rfaf.report_roster(matches,'CLUB')[0]['stats'],[])

if __name__=='__main__':unittest.main()
