"""Update only recent actas from the latest verified calendars."""
import json
from sync_fixtures import ROOT
from rfaf_browser import PublicBrowserReader
from rfaf_http import PublicHTTPReader
from team_imports import load_teams
from official_rfaf import TEAMS
from match_report import sync_recent_reports

def sync():
    with PublicBrowserReader() as browser:
        reader=PublicHTTPReader(browser)
        for team in load_teams() or TEAMS.values():
            try:
                snapshot=json.loads((ROOT/'data'/team['filename']).read_text())
                sync_recent_reports(snapshot.get('round_matches',snapshot.get('matches',[])),reader.get,ROOT)
            except (OSError,ValueError) as error:
                print(f"::warning::{team['label']}: se conserva la última acta válida ({error})",flush=True)
if __name__=='__main__':sync()
