import importlib.util, json, tempfile, threading, unittest, urllib.request, urllib.error
from pathlib import Path
spec=importlib.util.spec_from_file_location('club',Path(__file__).resolve().parents[1]/'app.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)

class AccessTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();app.DB=str(Path(cls.tmp.name)/'test.sqlite3');app.initialize()
        with app.db() as c:
            for name,active,member,player,admin in [('pending',0,1,1,0),('member',1,1,0,0),('player',1,0,1,0),('both',1,1,1,0),('admin',1,0,0,1)]:
                c.execute('INSERT INTO users(name,email,password,active,member,player,admin) VALUES(?,?,?,?,?,?,?)',(name,name+'@club.es',app.password_hash('long-password'),active,member,player,admin))
            for audience in ['public','member','player']:c.execute('INSERT INTO content(kind,audience,title,body,date,created) VALUES(?,?,?,?,?,0)',('event' if audience=='player' else 'news',audience,audience,'text','2026-10-05'))
        cls.server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler);cls.url='http://127.0.0.1:'+str(cls.server.server_port);app.ORIGIN=cls.url
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()
    def request(self,path,data=None,cookie='',headers=None):
        h={'Cookie':cookie};h.update({'Content-Type':'application/json','X-CDM-Request':'1'} if data is not None else {});h.update(headers or {})
        req=urllib.request.Request(self.url+'/api/'+path,data=json.dumps(data).encode() if data is not None else None,headers=h)
        try:r=urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:r=e
        return r.status,json.loads(r.read()),r.headers.get('Set-Cookie','')
    def login(self,name):
        status,_,cookie=self.request('login',{'email':name+'@club.es','password':'long-password'});self.assertEqual(status,200);return cookie.split(';')[0]
    def test_role_isolation(self):
        for name,expected in [('pending',{'public'}),('member',{'public','member'}),('player',{'public','player'}),('both',{'public','member','player'})]:
            cookie=self.login(name);status,data,_=self.request('content',cookie=cookie);self.assertEqual(status,200);self.assertEqual({x['audience'] for x in data['items']},expected)
            self.assertEqual(self.request('admin/users',cookie=cookie)[0],403)
    def test_registration_cannot_assign_roles(self):
        data={'name':'New User','email':'new@club.es','password':'long-password','active':1,'admin':1,'member':1,'player':1}
        self.assertEqual(self.request('register',data)[0],201)
        cookie=self.login('new');u=self.request('me',cookie=cookie)[1]['user'];self.assertEqual([u[x] for x in ['active','admin','member','player']],[0,0,0,0])
    def test_attendance_requires_player(self):
        self.assertEqual(self.request('attendance',{'event_id':3,'answer':'yes'},self.login('member'))[0],403)
        self.assertEqual(self.request('attendance',{'event_id':3,'answer':'yes'},self.login('pending'))[0],403)
        self.assertEqual(self.request('attendance',{'event_id':3,'answer':'yes'},self.login('player'))[0],200)
        self.assertEqual(self.request('attendance',{'event_id':1,'answer':'yes'},self.login('both'))[0],404)
    def test_csrf_and_unauthenticated(self):
        self.assertEqual(self.request('admin/users')[0],401)
        self.assertEqual(self.request('register',{},headers={'Origin':'https://attacker.example'})[0],403)
        self.assertEqual(self.request('register',{},headers={'X-CDM-Request':''})[0],403)
    def test_admin_updates_and_suspension(self):
        admin=self.login('admin');member=self.login('member')
        self.assertEqual(self.request('admin/user',{'id':2,'active':0,'member':1,'player':1,'paid':1,'number':'S002'},admin)[0],200)
        self.assertIsNone(self.request('me',cookie=member)[1]['user'])
        self.assertEqual(self.request('admin/user',{'id':5,'active':0,'member':0,'player':0,'paid':0},admin)[0],400)
        self.request('admin/user',{'id':2,'active':1,'member':1,'player':0,'paid':1,'number':'S002'},admin)
if __name__=='__main__':unittest.main()
