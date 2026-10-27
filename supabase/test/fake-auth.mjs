// A tiny stand-in for Supabase's API gateway, for local tests only:
//   /auth/v1/*  minimal GoTrue (anonymous sign-up, email codes, refresh, user, logout)
//   /rest/v1/*  proxied to PostgREST on :54330
// Users are written to auth.users in the local Postgres with psql.
import { Buffer } from 'node:buffer';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';

const SECRET = process.env.JWT_SECRET ?? 'apexprep-local-test-secret-0123456789abcdef';
const PSQL = '/opt/homebrew/opt/postgresql@17/bin/psql';
const EMAIL_CODE = '123456';
const sessions = new Map(); // refresh token -> user

const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
export function sign(payload) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64(payload);
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function sql(query) {
  return execFileSync(PSQL, ['-h', 'localhost', '-p', '54329', '-U', 'postgres', '-At', '-c', query], { encoding: 'utf8' }).trim();
}

function userJson(u) {
  const provider = u.is_anonymous ? 'anonymous' : 'email';
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email ?? '',
    is_anonymous: u.is_anonymous,
    app_metadata: { provider, providers: [provider] },
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = sign({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email ?? '', is_anonymous: u.is_anonymous, iat: now, exp: now + 3600 });
  const refresh_token = randomUUID();
  sessions.set(refresh_token, u);
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token, user: userJson(u) };
}

function userFromAuth(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    if (!claims.sub) return null;
    const row = sql(`select id, coalesce(email,''), is_anonymous from auth.users where id = '${claims.sub}'`);
    if (!row) return null;
    const [id, email, anon] = row.split('|');
    return { id, email: email || null, is_anonymous: anon === 't' };
  } catch {
    return null;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const raw = await readBody(req);
  const json = () => (raw.length ? JSON.parse(raw.toString()) : {});

  if (url.pathname === '/health') return send(res, 200, { ok: true });

  if (url.pathname.startsWith('/rest/v1/')) {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers['content-length'];
    // Like the real gateway: a non-JWT key means the anonymous role.
    if (!/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(headers.authorization ?? '')) delete headers.authorization;
    const upstream = await fetch(`http://localhost:54330${url.pathname.slice('/rest/v1'.length)}${url.search}`, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw,
    });
    const out = Buffer.from(await upstream.arrayBuffer());
    const h = {};
    upstream.headers.forEach((v, k) => {
      if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) h[k] = v;
    });
    res.writeHead(upstream.status, h);
    return res.end(out);
  }

  if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
    const body = json();
    if (body.email) return send(res, 400, { msg: 'only anonymous sign-ups in this stand-in' });
    const id = randomUUID();
    sql(`insert into auth.users (id, is_anonymous) values ('${id}', true)`);
    return send(res, 200, session({ id, email: null, is_anonymous: true }));
  }

  if (url.pathname === '/auth/v1/otp' && req.method === 'POST') return send(res, 200, {});

  if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
    const { email, token } = json();
    if (token !== EMAIL_CODE) return send(res, 403, { code: 'otp_expired', msg: 'Token has expired or is invalid' });
    const clean = String(email).toLowerCase().replace(/'/g, '');
    let id = sql(`select id from auth.users where email = '${clean}'`);
    if (!id) {
      id = randomUUID();
      sql(`insert into auth.users (id, email, is_anonymous) values ('${id}', '${clean}', false)`);
    }
    return send(res, 200, session({ id, email: clean, is_anonymous: false }));
  }

  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    const u = sessions.get(json().refresh_token);
    return u ? send(res, 200, session(u)) : send(res, 400, { msg: 'Invalid Refresh Token' });
  }

  if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
    const u = userFromAuth(req);
    return u ? send(res, 200, userJson(u)) : send(res, 401, { msg: 'invalid JWT' });
  }

  if (url.pathname === '/auth/v1/logout') {
    res.writeHead(204);
    return res.end();
  }

  send(res, 404, { msg: `not implemented in the stand-in: ${req.method} ${url.pathname}` });
}).listen(54321, () => console.log('fake auth + rest proxy on :54321'));
