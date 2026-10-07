import importlib.util,json,os,sys,tempfile,threading,time,unittest,urllib.request,urllib.error
from pathlib import Path
from unittest.mock import patch,MagicMock

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import firebase_auth
spec=importlib.util.spec_from_file_location('firebase_club',Path(__file__).resolve().parents[1]/'app.py')
app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)

class FirebaseAccessTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();app.DB=str(Path(cls.tmp.name)/'club.sqlite3');app.initialize()
        cls.server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler);cls.url='http://127.0.0.1:'+str(cls.server.server_port);app.ORIGIN=cls.url
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()
    def setUp(self):
        with app.db() as c:
            c.execute('DELETE FROM firebase_users');c.execute('DELETE FROM sessions');c.execute('DELETE FROM users');c.execute('DELETE FROM attempts')
        self.identity=dict(project='club-real',uid='google-and-email-user',name='Club User',email='new@club.test',expires=int(time.time())+1800)
    def call(self,data,cookie=''):
        req=urllib.request.Request(self.url+'/api/firebase',data=json.dumps(data).encode(),headers={'Content-Type':'application/json','X-CDM-Request':'1','Cookie':cookie})
        try:r=urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:r=e
        return r.status,json.loads(r.read()),r.headers.get('Set-Cookie','')
    def sign_in(self,identity=None,data=None):
        with patch('firebase_auth.verify_identity',return_value=identity or self.identity):return self.call(data or {'token':'signed-firebase-token'})
    def test_firebase_registration_cannot_grant_roles(self):
        status,data,cookie=self.sign_in(data={'token':'signed-token','admin':1,'active':1,'member':1,'player':1,'uid':'admin'})
        self.assertEqual(status,200);self.assertEqual([data['user'][k] for k in ['active','member','player','admin']],[0,0,0,0]);self.assertIn('HttpOnly',cookie)
    def test_same_uid_preserves_club_approval(self):
        _,first,_=self.sign_in()
        with app.db() as c:c.execute('UPDATE users SET active=1,member=1,number=? WHERE id=?',('S012',first['user']['id']))
        _,second,_=self.sign_in(dict(self.identity,name='Changed Firebase Name'))
        self.assertEqual(first['user']['id'],second['user']['id']);self.assertEqual(second['user']['member'],1);self.assertEqual(second['user']['number'],'S012')
    def test_email_does_not_silently_link_existing_admin(self):
        with app.db() as c:c.execute('INSERT INTO users(name,email,password,active,admin) VALUES(?,?,?,?,?)',('Admin',self.identity['email'],app.password_hash('legacy-password'),1,1))
        status,_,cookie=self.sign_in();self.assertEqual(status,409);self.assertEqual(cookie,'')
        with app.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM firebase_users').fetchone()[0],0)
    def test_same_uid_in_another_project_has_no_roles(self):
        _,first,_=self.sign_in()
        with app.db() as c:c.execute('UPDATE users SET active=1,admin=1 WHERE id=?',(first['user']['id'],))
        _,second,_=self.sign_in(dict(self.identity,project='another-club',email='other@club.test'))
        self.assertNotEqual(first['user']['id'],second['user']['id']);self.assertEqual(second['user']['admin'],0)
    def test_cookie_does_not_outlive_firebase_token(self):
        expiry=int(time.time())+90;self.sign_in(dict(self.identity,expires=expiry))
        with app.db() as c:self.assertEqual(c.execute('SELECT expires FROM sessions').fetchone()[0],expiry)
        self.assertEqual(self.sign_in(dict(self.identity,expires=int(time.time())-1))[0],401)
    def test_invalid_or_revoked_tokens_fail_closed(self):
        with patch('firebase_auth.verify_identity',side_effect=ValueError('Sesión no válida.')):
            status,_,cookie=self.call({'token':'forged-or-revoked'});self.assertEqual(status,401);self.assertEqual(cookie,'')
        with app.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM users').fetchone()[0],0)
    def test_no_project_is_an_explicit_unconfigured_state(self):
        with patch.dict(os.environ,{'FIREBASE_PROJECT_ID':''}):self.assertEqual(self.call({'token':'x'})[0],503)

class FirebaseVerificationTest(unittest.TestCase):
    def test_admin_verifies_revocation_and_rejects_unverified_or_wrong_project(self):
        firebase=MagicMock();claims=dict(aud='club-real',iss='https://securetoken.google.com/club-real',uid='real-uid',email='user@club.test',email_verified=True,exp=int(time.time())+3600)
        firebase.auth.verify_id_token.return_value=claims
        with patch.dict(sys.modules,{'firebase_admin':firebase}),patch.dict(os.environ,{'FIREBASE_PROJECT_ID':'club-real'}):
            result=firebase_auth.verify_identity('signed-token');self.assertEqual(result['uid'],'real-uid')
            self.assertTrue(firebase.auth.verify_id_token.call_args.kwargs['check_revoked'])
            for changed in [dict(claims,aud='foreign-project'),dict(claims,email_verified=False),dict(claims,iss='https://attacker.test')]:
                firebase.auth.verify_id_token.return_value=changed
                with self.assertRaises(ValueError):firebase_auth.verify_identity('token')

if __name__=='__main__':unittest.main()
