"""Update recent actas from all verified calendars, newest played matches first."""
import json
from sync_fixtures import ROOT
from rfaf_browser import PublicBrowserReader
from rfaf_http import PublicHTTPReader
from team_imports import load_teams
from official_rfaf import TEAMS
from match_report import sync_recent_reports

def sync():
    matches=[]
    for team in load_teams() or TEAMS.values():
        try:
            snapshot=json.loads((ROOT/'data'/team['filename']).read_text())
            matches.extend(snapshot.get('round_matches',snapshot.get('matches',[])))
        except (OSError,ValueError) as error:
            print(f"::warning::{team['label']}: calendario no disponible ({error})",flush=True)
    with PublicBrowserReader() as browser:
        reader=PublicHTTPReader(browser)
        sync_recent_reports(matches,reader.get,ROOT)
if __name__=='__main__':sync()
