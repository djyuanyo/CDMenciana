"""Fetch only the intentionally public sports catalog from the club service."""
import json, urllib.request, urllib.error
from pathlib import Path
from team_imports import validate_catalog
request=urllib.request.Request('https://cdmenciana-avisos.djyuanyo.workers.dev/public/config/club-teams.json',headers={'User-Agent':'CDMenciana-public-data','Accept':'application/json'})
try:
    with urllib.request.urlopen(request,timeout=25) as response:value=json.loads(response.read(100000))
except urllib.error.HTTPError as error:
    detail=json.loads(error.read(2000)).get('error','Servicio no disponible')
    raise RuntimeError(f'Catálogo público: HTTP {error.code}: {detail}') from None
validate_catalog(value)
Path('data/club-teams.json').write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
