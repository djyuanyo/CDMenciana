"""Update current club player totals without fetching historical match pages."""
import json,time
from sync_fixtures import ROOT
from official_rfaf import TEAMS
from team_imports import load_teams
from rfaf_browser import PublicBrowserReader
from rfaf_http import PublicHTTPReader
from player_stats import refresh_stats

def sync():
    end=time.monotonic()+300
    with PublicBrowserReader() as browser:
        reader=PublicHTTPReader(browser)
        for team in load_teams() or TEAMS.values():
            if time.monotonic()>end:break
            try:refresh_stats(team,reader.get,ROOT,budget=min(75,max(0,end-time.monotonic())))
            except (OSError,ValueError,RuntimeError) as error:print(f"::warning::Estadísticas {team['key']} pendientes: {error}",flush=True)
if __name__=='__main__':sync()
