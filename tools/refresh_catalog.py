"""Fetch only the intentionally public sports catalog from the club service."""
import json, urllib.request
from pathlib import Path
from team_imports import validate_catalog
with urllib.request.urlopen('https://cdmenciana-avisos.djyuanyo.workers.dev/public/config/club-teams.json',timeout=25) as response:
    value=json.loads(response.read(100000))
validate_catalog(value)
Path('data/club-teams.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
