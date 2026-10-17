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

if __name__=='__main__':unittest.main()
