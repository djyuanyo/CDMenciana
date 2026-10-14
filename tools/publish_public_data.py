"""Publish snapshots on the current head without overwriting newer admin edits."""
import json, os, subprocess, tempfile, sys, re

def public_path(path):
    return bool(re.fullmatch(r"data/(?:fixtures(?:-[a-z0-9_]+)?\.json|rfaf-player-profiles(?:-[a-z0-9_]+)?\.json|news\.json|videos\.json|club-teams\.json|roster-snapshot\.json|actas/[0-9]+\.json)",path))

def git(*args, env=None, input=None, check=True):
    return subprocess.run(['git',*args],input=input,text=True,capture_output=True,env=env,check=check)

def blob(ref,path):
    result=git('rev-parse',f'{ref}:{path}',check=False)
    return result.stdout.strip() if result.returncode==0 else None

def without_timestamps(value):
    # Sync runs stamp every file; a new stamp alone is not new club data.
    if isinstance(value,dict):return {k:without_timestamps(v) for k,v in value.items() if not k.endswith('updated_at')}
    if isinstance(value,list):return [without_timestamps(v) for v in value]
    return value

def only_timestamps_changed(ref,path):
    if not path.endswith('.json') or not os.path.isfile(path):return False
    old=git('show',f'{ref}:{path}',check=False)
    if old.returncode!=0:return False
    try:
        with open(path,encoding='utf-8') as file:new=json.load(file)
        return without_timestamps(json.loads(old.stdout))==without_timestamps(new)
    except ValueError:return False

def main():
    base=git('rev-parse','HEAD').stdout.strip()
    changed=set(git('diff','--name-only',base,'--','data/').stdout.splitlines())
    changed.update(git('ls-files','--others','--exclude-standard','--','data/').stdout.splitlines())
    changed={p for p in changed if public_path(p) and not only_timestamps_changed(base,p)}
    if not changed:return
    updates={p:git('hash-object','-w',p).stdout.strip() if os.path.isfile(p) else None for p in changed}
    for attempt in range(3):
        git('fetch','origin','main')
        head=git('rev-parse','origin/main').stdout.strip()
        conflicts={p for p in changed if blob(base,p)!=blob(head,p)}
        if '--imports' in sys.argv and (blob(base,'data/club-teams.json')!=blob(head,'data/club-teams.json') or any(p.startswith('data/team-imports/') for p in conflicts)):
            print('::warning::A newer administrator request exists; retaining it for the next import run.')
            return
        accepted={p:v for p,v in updates.items() if p not in conflicts}
        if not accepted:return
        with tempfile.TemporaryDirectory() as folder:
            env={**os.environ,'GIT_INDEX_FILE':folder+'/index'}
            git('read-tree',head,env=env)
            records=''.join(('100644 '+sha+'\t'+p+'\n') if sha else ('0 '+'0'*40+'\t'+p+'\n') for p,sha in sorted(accepted.items()))
            git('update-index','--index-info',env=env,input=records)
            tree=git('write-tree',env=env).stdout.strip()
            if tree==git('rev-parse',head+'^{tree}').stdout.strip():return
            commit=git('commit-tree',tree,'-p',head,env=env,input='Publish verified club sports data\n').stdout.strip()
            result=git('push','origin',commit+':refs/heads/main',check=False)
            if result.returncode==0:
                print('Verified public data published without replacing newer edits.');return
    raise RuntimeError('Main changed during publication; requests are retained for the next run.')

if __name__=='__main__':main()
