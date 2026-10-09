import os, subprocess, tempfile, unittest
from pathlib import Path

SCRIPT=Path(__file__).resolve().parents[2]/'tools/publish_public_data.py'
class PublicPublicationTests(unittest.TestCase):
 def test_new_admin_edit_is_preserved_and_independent_snapshot_published(self):
  with tempfile.TemporaryDirectory() as folder:
   root=Path(folder);remote=root/'remote.git';work=root/'work';other=root/'other'
   def git(at,*args):return subprocess.check_output(['git','-C',str(at),*args],stderr=subprocess.DEVNULL,text=True).strip()
   subprocess.run(['git','init','--bare',str(remote)],check=True,capture_output=True)
   subprocess.run(['git','clone',str(remote),str(work)],check=True,capture_output=True)
   for p in [work]:
    git(p,'config','user.name','Test');git(p,'config','user.email','test@example.com')
   git(work,'checkout','-b','main');(work/'data').mkdir();(work/'data/club-teams.json').write_text('original');(work/'data/fixtures.json').write_text('old')
   git(work,'add','.');git(work,'commit','-m','initial');git(work,'push','origin','main')
   subprocess.run(['git','clone','-b','main',str(remote),str(other)],check=True,capture_output=True)
   git(other,'config','user.name','Admin');git(other,'config','user.email','admin@example.com')
   (work/'data/club-teams.json').write_text('stale import');(work/'data/fixtures.json').write_text('new fixture')
   (other/'data/club-teams.json').write_text('admin deletion');git(other,'add','.');git(other,'commit','-m','delete');git(other,'push','origin','main')
   subprocess.run(['python3',str(SCRIPT),'--imports'],cwd=work,check=True,capture_output=True)
   self.assertEqual(git(remote,'show','main:data/fixtures.json'),'old','Import transaction must retain the newer admin request')
   subprocess.run(['python3',str(SCRIPT)],cwd=work,check=True,capture_output=True)
   self.assertEqual(git(remote,'show','main:data/club-teams.json'),'admin deletion')
   self.assertEqual(git(remote,'show','main:data/fixtures.json'),'new fixture')
