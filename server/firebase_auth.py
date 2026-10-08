"""Firebase verifies identity; the club database alone grants membership and admin roles."""
import os, re

def verify_identity(token):
    project=os.environ.get('FIREBASE_PROJECT_ID','').strip()
    if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]',project):
        raise RuntimeError('La conexión de cuentas del club todavía no está activada.')
    if not isinstance(token,str) or not 1<=len(token)<=10000:
        raise ValueError('Sesión no válida. Vuelve a iniciar sesión.')
    try:
        import firebase_admin
        from firebase_admin import auth
    except ImportError:
        raise RuntimeError('La conexión de cuentas del club todavía no está activada.') from None
    try:
        app=firebase_admin.get_app('club-auth')
    except ValueError:
        try:app=firebase_admin.initialize_app(options={'projectId':project},name='club-auth')
        except Exception:raise RuntimeError('La conexión de cuentas del club todavía no está activada.') from None
    try:
        claims=auth.verify_id_token(token,app=app,check_revoked=True)
    except Exception:
        raise ValueError('Sesión no válida. Vuelve a iniciar sesión.') from None
    uid=claims.get('uid') or claims.get('sub')
    email=str(claims.get('email','')).strip().lower()
    if claims.get('aud')!=project or claims.get('iss')!='https://securetoken.google.com/'+project or not isinstance(uid,str) or not 1<=len(uid)<=128:
        raise ValueError('Sesión no válida. Vuelve a iniciar sesión.')
    if claims.get('email_verified') is not True or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254:
        raise ValueError('Verifica tu correo para activar tu cuenta del club.')
    return dict(project=project,uid=uid,email=email,name=str(claims.get('name') or email.split('@')[0])[:100],expires=int(claims['exp']))
