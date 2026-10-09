"""CDMenciana API and web interface. Deploy behind an HTTPS reverse proxy."""
import argparse, getpass, hashlib, hmac, json, mimetypes, os, re, secrets, sqlite3, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path

ROOT = Path(__file__).parent
DB = os.environ.get('CDM_DATABASE', str(ROOT / 'club.sqlite3'))
ORIGIN = os.environ.get('CDM_ORIGIN', 'http://localhost:8080').rstrip('/')
SECURE = ORIGIN.startswith('https://')

def db():
    c = sqlite3.connect(DB, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    return c

def initialize():
    with db() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 0, member INTEGER NOT NULL DEFAULT 0, player INTEGER NOT NULL DEFAULT 0, admin INTEGER NOT NULL DEFAULT 0, number TEXT NOT NULL DEFAULT '', paid INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS content(id INTEGER PRIMARY KEY, kind TEXT NOT NULL, audience TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, date TEXT NOT NULL, created INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS attendance(event_id INTEGER REFERENCES content(id) ON DELETE CASCADE, user_id INTEGER REFERENCES users(id), answer TEXT NOT NULL, PRIMARY KEY(event_id,user_id));
        CREATE TABLE IF NOT EXISTS attempts(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS firebase_users(project TEXT NOT NULL, uid TEXT NOT NULL, user_id INTEGER UNIQUE NOT NULL REFERENCES users(id), PRIMARY KEY(project,uid));
        ''')

def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return salt + ':' + digest

def public_user(u):
    return {k: u[k] for k in ('id','name','email','active','member','player','admin','number','paid')}

class ApiError(Exception):
    def __init__(self, status, message): self.status, self.message = status, message

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass # Never log credentials or member data.
    def respond(self, status, payload, cookie=None, mime='application/json; charset=utf-8'):
        raw = payload if isinstance(payload,bytes) else (json.dumps(payload, ensure_ascii=False).encode() if mime.startswith('application/json') else payload)
        self.send_response(status)
        for k,v in {'Content-Type':mime,'Content-Length':str(len(raw)),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://stars.rfaf.es https://rfaf.filesnovanet.es https://cdmenciana.es https://cms.cdmenciana.es; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"}.items(): self.send_header(k,v)
        if cookie: self.send_header('Set-Cookie',cookie)
        self.end_headers(); self.wfile.write(raw)
    def user(self,c):
        try:
            cookies=SimpleCookie(self.headers.get('Cookie','')); token=cookies['cdm'].value
        except Exception: return None
        return c.execute('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',(hashlib.sha256(token.encode()).hexdigest(),time.time())).fetchone()
    def require(self,u,role=None):
        if not u: raise ApiError(401,'Inicia sesión para continuar.')
        if not u['active']: raise ApiError(403,'Tu cuenta está pendiente de aprobación o suspendida.')
        if role and not (u[role] or u['admin']): raise ApiError(403,'No tienes acceso a esta zona.')
    def do_GET(self): self.dispatch(False)
    def do_POST(self): self.dispatch(True)
    def dispatch(self,post):
        try:
            path=self.path.split('?')[0]
            if not path.startswith('/api/'):
                if post: raise ApiError(405,'Método no permitido.')
                files={'/':'index.html','/admin':'index.html','/fixtures.json':'fixtures.json','/fixtures-filial.json':'fixtures-filial.json','/fixtures-infantil.json':'fixtures-infantil.json','/news.json':'news.json','/fixtures.js':'fixtures.js','/ui.js':'ui.js','/appearance.js':'appearance.js','/roster-snapshot.js':'roster-snapshot.js','/rfaf_extract.js':'rfaf_extract.js','/club-access.js':'club-access.js','/news-reader.js':'news-reader.js','/auth.js':'auth.js','/auth.css':'auth.css','/app.js':'app.js','/style.css':'style.css','/theme.css':'theme.css','/crest.png':'crest.png'}
                if re.fullmatch(r'/crests/[a-f0-9]{16}\.(png|jpg)',path):files[path]=path[1:]
                if re.fullmatch(r'/players/[a-f0-9]{16}\.webp',path):files[path]=path[1:]
                if re.fullmatch(r'/actas/[0-9]+\.json',path):files[path]=path[1:]
                if path not in files: raise ApiError(404,'No encontrado.')
                file=ROOT/'static'/files[path]
                if not file.exists(): raise ApiError(404,'No encontrado.')
                return self.respond(200,file.read_bytes(),mime=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
            data={}
            if post:
                # JSON + custom header prevents browser CSRF even without an Origin header.
                if self.headers.get('X-CDM-Request')!='1' or self.headers.get('Content-Type','').split(';')[0]!='application/json': raise ApiError(403,'Solicitud no válida.')
                if self.headers.get('Origin') not in (None,ORIGIN): raise ApiError(403,'Origen no permitido.')
                size=int(self.headers.get('Content-Length','0'))
                if size<1 or size>65536: raise ApiError(400,'Tamaño no permitido.')
                data=json.loads(self.rfile.read(size))
                if not isinstance(data,dict): raise ApiError(400,'Datos no válidos.')
            with db() as c:
                u=self.user(c)
                if path=='/api/me' and not post: return self.respond(200,{'user':public_user(u) if u else None})
                if path in ('/api/register','/api/login','/api/firebase') and post:
                    # Persistent, bounded per-IP rolling rate limit, including failed attempts.
                    key=self.client_address[0]
                    if os.environ.get('CDM_TRUST_PROXY')=='1':
                        key=self.headers.get('X-Forwarded-For',key).split(',')[-1].strip()
                    now=int(time.time())
                    c.execute('DELETE FROM attempts WHERE expires<?',(now,))
                    c.execute('INSERT INTO attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',(key,now+600)); c.commit()
                    if c.execute('SELECT count FROM attempts WHERE key=?',(key,)).fetchone()[0]>20: raise ApiError(429,'Demasiados intentos. Espera diez minutos.')
                    if path=='/api/firebase':
                        from firebase_auth import verify_identity
                        try:identity=verify_identity(data.get('token'))
                        except RuntimeError as error:raise ApiError(503,str(error))
                        except ValueError as error:raise ApiError(401,str(error))
                        if identity['expires']<=now:raise ApiError(401,'Sesión caducada. Vuelve a iniciar sesión.')
                        c.execute('BEGIN IMMEDIATE')
                        row=c.execute('SELECT u.* FROM users u JOIN firebase_users f ON f.user_id=u.id WHERE f.project=? AND f.uid=?',(identity['project'],identity['uid'])).fetchone()
                        if not row:
                            if c.execute('SELECT id FROM users WHERE email=?',(identity['email'],)).fetchone():
                                raise ApiError(409,'Ya existe una cuenta del club con ese correo. Contacta con el club para vincularla.')
                            cursor=c.execute('INSERT INTO users(name,email,password) VALUES(?,?,?)',(identity['name'],identity['email'],password_hash(secrets.token_urlsafe(48))))
                            c.execute('INSERT INTO firebase_users(project,uid,user_id) VALUES(?,?,?)',(identity['project'],identity['uid'],cursor.lastrowid))
                            row=c.execute('SELECT * FROM users WHERE id=?',(cursor.lastrowid,)).fetchone()
                        if identity['project']=='barpro-pos-menciana' and identity['email']=='juanjocarrillo7@gmail.com':
                            c.execute('UPDATE users SET active=1,admin=1 WHERE id=?',(row['id'],))
                            row=c.execute('SELECT * FROM users WHERE id=?',(row['id'],)).fetchone()
                        token=secrets.token_urlsafe(32)
                        # Only the verified, explicitly designated owner bootstraps administration.
                        expiry=min(identity['expires'],now+3600)
                        c.execute('DELETE FROM sessions WHERE expires<?',(now,))
                        c.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),row['id'],expiry))
                        return self.respond(200,{'user':public_user(row)},cookie=f'cdm={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={expiry-now}'+('; Secure' if SECURE else ''))
                    email=str(data.get('email','')).strip().lower(); pw=str(data.get('password',''))
                    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254 or not 10<=len(pw)<=128: raise ApiError(400,'Usa un correo válido y una contraseña de 10 a 128 caracteres.')
                    if path=='/api/register':
                        name=str(data.get('name','')).strip()
                        if not 2<=len(name)<=100: raise ApiError(400,'Indica tu nombre (2–100 caracteres).')
                        try: c.execute('INSERT INTO users(name,email,password) VALUES(?,?,?)',(name,email,password_hash(pw)))
                        except sqlite3.IntegrityError: raise ApiError(409,'No se puede registrar ese correo. Prueba a iniciar sesión.')
                        return self.respond(201,{'message':'Registro completado. El club debe aprobar tu cuenta.'})
                    row=c.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
                    saved=row['password'] if row else password_hash('dummy-password')
                    valid=hmac.compare_digest(saved,password_hash(pw,saved.split(':')[0]))
                    if not row or not valid: raise ApiError(401,'Correo o contraseña incorrectos.')
                    token=secrets.token_urlsafe(32)
                    c.execute('DELETE FROM sessions WHERE expires<?',(now,))
                    c.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),row['id'],now+86400))
                    return self.respond(200,{'user':public_user(row)},f'cdm={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400'+('; Secure' if SECURE else ''))
                if path=='/api/logout' and post:
                    cookie=SimpleCookie(self.headers.get('Cookie',''))
                    if 'cdm' in cookie: c.execute('DELETE FROM sessions WHERE token=?',(hashlib.sha256(cookie['cdm'].value.encode()).hexdigest(),))
                    return self.respond(200,{'message':'Sesión cerrada.'},'cdm=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+('; Secure' if SECURE else ''))
                if path=='/api/content' and not post:
                    audiences=['public']
                    if u and u['active']:
                        if u['admin']: audiences+=['member','player']
                        else: audiences += [r for r in ('member','player') if u[r]]
                    rows=c.execute('SELECT * FROM content WHERE audience IN ('+','.join('?'*len(audiences))+') ORDER BY date DESC,id DESC',audiences).fetchall()
                    items=[dict(r) for r in rows]
                    for item in items:
                        item['answer']=None
                        if u and item['kind']=='event':
                            answer=c.execute('SELECT answer FROM attendance WHERE event_id=? AND user_id=?',(item['id'],u['id'])).fetchone()
                            if answer: item['answer']=answer[0]
                    return self.respond(200,{'items':items})
                if path=='/api/attendance' and post:
                    self.require(u,'player'); event=int(data.get('event_id',0)); answer=data.get('answer')
                    if answer not in ('yes','no','maybe'): raise ApiError(400,'Respuesta no válida.')
                    row=c.execute("SELECT * FROM content WHERE id=? AND kind='event' AND audience='player'",(event,)).fetchone()
                    if not row: raise ApiError(404,'Convocatoria no encontrada.')
                    c.execute('INSERT INTO attendance VALUES(?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET answer=excluded.answer',(event,u['id'],answer))
                    return self.respond(200,{'message':'Asistencia actualizada.'})
                if path.startswith('/api/admin/'):
                    self.require(u,'admin')
                    if path=='/api/admin/users' and not post: return self.respond(200,{'users':[public_user(r) for r in c.execute('SELECT * FROM users ORDER BY name')]})
                    if path=='/api/admin/user' and post:
                        uid=int(data.get('id',0)); target=c.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
                        if not target: raise ApiError(404,'Usuario no encontrado.')
                        if target['admin']: raise ApiError(400,'Gestiona administradores desde el servidor.')
                        values=[]
                        for field in ('active','member','player','paid'):
                            value=data.get(field)
                            if type(value) is not int or value not in (0,1): raise ApiError(400,'Estado no válido.')
                            values.append(value)
                        number=str(data.get('number','')).strip()
                        if len(number)>30: raise ApiError(400,'Número demasiado largo.')
                        c.execute('UPDATE users SET active=?,member=?,player=?,paid=?,number=? WHERE id=?',(*values,number,uid))
                        if not values[0]: c.execute('DELETE FROM sessions WHERE user_id=?',(uid,))
                        return self.respond(200,{'message':'Usuario actualizado.'})
                    if path=='/api/admin/content' and post:
                        kind=data.get('kind'); audience=data.get('audience'); title=str(data.get('title','')).strip(); body=str(data.get('body','')).strip(); date=str(data.get('date','')).strip()
                        if kind not in ('news','match','standings','roster','event') or audience not in ('public','member','player') or not 1<=len(title)<=200 or len(body)>10000 or len(date)>30: raise ApiError(400,'Contenido no válido.')
                        if kind=='event' and audience!='player': raise ApiError(400,'Las convocatorias se destinan a jugadores.')
                        c.execute('INSERT INTO content(kind,audience,title,body,date,created) VALUES(?,?,?,?,?,?)',(kind,audience,title,body,date,int(time.time())))
                        return self.respond(201,{'message':'Contenido publicado.'})
                    if path=='/api/admin/delete' and post:
                        c.execute('DELETE FROM content WHERE id=?',(int(data.get('id',0)),)); return self.respond(200,{'message':'Contenido eliminado.'})
                    if path=='/api/admin/attendance' and not post:
                        rows=c.execute('SELECT c.title,u.name,a.answer FROM attendance a JOIN users u ON u.id=a.user_id JOIN content c ON c.id=a.event_id ORDER BY c.id DESC,u.name').fetchall()
                        return self.respond(200,{'attendance':[dict(r) for r in rows]})
                raise ApiError(404,'No encontrado.')
        except ApiError as e: self.respond(e.status,{'error':e.message})
        except (ValueError,TypeError,json.JSONDecodeError): self.respond(400,{'error':'Datos no válidos.'})
        except Exception: self.respond(500,{'error':'Error del servidor.'})

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--create-admin',action='store_true'); parser.add_argument('--reset-password',action='store_true'); args=parser.parse_args(); initialize()
    if args.create_admin or args.reset_password:
        email=input('Correo: ').strip().lower(); pw=getpass.getpass('Contraseña (mínimo 10 caracteres): ')
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or not 10<=len(pw)<=128: raise SystemExit('Correo o contraseña no válidos.')
        with db() as c:
            if args.create_admin: c.execute('INSERT INTO users(name,email,password,active,admin) VALUES(?,?,?,1,1)',(input('Nombre: ').strip(),email,password_hash(pw)))
            else:
                result=c.execute('UPDATE users SET password=? WHERE email=?',(password_hash(pw),email))
                if not result.rowcount: raise SystemExit('Usuario no encontrado.')
                c.execute('DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=?)',(email,))
        print('Cuenta actualizada.'); return
    ThreadingHTTPServer((os.environ.get('CDM_BIND','127.0.0.1'),int(os.environ.get('PORT','8080'))),Handler).serve_forever()
if __name__=='__main__': main()
