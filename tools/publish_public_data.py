"""Publish snapshots on the current head without overwriting newer admin edits."""
import os, subprocess, tempfile, sys

def git(*args, env=None, input=None, check=True):
    return subprocess.run(['git',*args],input=input,text=True,capture_output=True,env=env,check=check)

def blob(ref,path):
    result=git('rev-parse',f'{ref}:{path}',check=False)
    return result.stdout.strip() if result.returncode==0 else None

def main():
    base=git('rev-parse','HEAD').stdout.strip()
    changed=set(git('diff','--name-only',base,'--','data/','server/static/','android/app/src/main/assets/').stdout.splitlines())
    changed.update(git('ls-files','--others','--exclude-standard','--','data/','server/static/','android/app/src/main/assets/').stdout.splitlines())
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
