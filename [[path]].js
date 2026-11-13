/* Faith Hope Love Sunday School - backend (Cloudflare Pages Functions + D1)
 *
 * Replaces Firebase Authentication + Firestore. Same rules as the old firestore.rules, enforced here.
 *   Bindings:  DB (D1 database), AUTH_SECRET (secret, 32+ random characters), PBKDF2_ITER (optional)
 *   Routes:    GET  /api/health
 *              POST /api/auth/signin | signup | create | password | refresh
 *              GET|PUT|DELETE /api/doc/<collection>/<id>      GET /api/doc/<collection>  (list)
 */

const enc = new TextEncoder();
const MAX_BODY = 1900000;                       // bytes; a D1 row may hold at most 2 MB
const ADMIN_EMAIL = 'admin@staff.sunday-school.app';
const ACCESS_TTL = 3600, REFRESH_TTL = 30 * 86400;
const COLS = new Set(['kv', 'staff', 'meta', 'pub', 'regcfg', 'reg']);

const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const fail = (s, code) => J({ error: { message: code } }, s);
const isStr = (v, n) => typeof v === 'string' && v.length <= n;

/* ---------- base64url, tokens, passwords ---------- */
const b64u = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = t => { t = t.replace(/-/g, '+').replace(/_/g, '/'); while (t.length % 4) t += '='; return Uint8Array.from(atob(t), c => c.charCodeAt(0)); };
const hmacKey = (env, use) => crypto.subtle.importKey('raw', enc.encode(env.AUTH_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, [use]);

async function mint(env, uid, type, ttl) {
  const p = b64u(enc.encode(JSON.stringify({ u: uid, t: type, e: Math.floor(Date.now() / 1000) + ttl })));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(env, 'sign'), enc.encode(p)));
  return p + '.' + b64u(sig);
}
async function verify(env, tok, type) {
  try {
    const [p, s] = String(tok || '').split('.');
    if (!p || !s) return null;
    if (!(await crypto.subtle.verify('HMAC', await hmacKey(env, 'verify'), unb64u(s), enc.encode(p)))) return null;
    const d = JSON.parse(new TextDecoder().decode(unb64u(p)));
    return d.t === type && d.e > Date.now() / 1000 && typeof d.u === 'string' ? d.u : null;
  } catch (e) { return null; }
}
async function tokens(env, uid) {
  return { idToken: await mint(env, uid, 'a', ACCESS_TTL), refreshToken: await mint(env, uid, 'r', REFRESH_TTL), localId: uid, expiresIn: String(ACCESS_TTL) };
}

async function derive(pw, salt, iter) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 256));
}
async function hashPw(env, pw) {
  const iter = Math.min(100000, Number(env.PBKDF2_ITER) || 100000), salt = crypto.getRandomValues(new Uint8Array(16));  // 100000 is the Workers maximum
  return `pbkdf2$${iter}$${b64u(salt)}$${b64u(await derive(pw, salt, iter))}`;
}
async function checkPw(pw, stored) {
  const [alg, iter, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2') return false;
  const a = await derive(pw, unb64u(salt), Number(iter)), b = unb64u(hash);
  let d = a.length ^ b.length; for (let i = 0; i < a.length; i++) d |= a[i] ^ (b[i] || 0);
  return d === 0;
}

/* ---------- database helpers ---------- */
const rawDoc = (env, col, id) => env.DB.prepare('SELECT data FROM docs WHERE col = ?1 AND id = ?2').bind(col, id).first();
async function getDoc(env, col, id) {
  const r = await rawDoc(env, col, id); if (!r) return null;
  try { return JSON.parse(r.data); } catch (e) { return null; }
}
const now = () => Math.floor(Date.now() / 1000);
async function strikes(env, k, win) { const r = await env.DB.prepare('SELECT COUNT(*) AS c FROM throttle WHERE k = ?1 AND t > ?2').bind(k, now() - win).first(); return r ? r.c : 0; }
async function strike(env, k) {
  await env.DB.batch([env.DB.prepare('INSERT INTO throttle (k, t) VALUES (?1, ?2)').bind(k, now()), env.DB.prepare('DELETE FROM throttle WHERE t < ?1').bind(now() - 3600)]);
}
const clearStrikes = (env, k) => env.DB.prepare('DELETE FROM throttle WHERE k = ?1').bind(k).run();

/* ---------- request context: who is calling ---------- */
async function context(env, request) {
  const h = request.headers.get('Authorization') || '';
  const uid = h.startsWith('Bearer ') ? await verify(env, h.slice(7), 'a') : null;
  let me; // the caller's staff record, only if active
  return {
    uid,
    ip: request.headers.get('CF-Connecting-IP') || 'unknown',
    async me() {
      if (me !== undefined) return me;
      const d = uid ? await getDoc(env, 'staff', uid) : null;
      me = d && d.active === true ? d : null; return me;
    }
  };
}

/* ---------- rules (a port of the old firestore.rules) ---------- */
const REG_KEYS = ['tok', 'at', 'name', 'christian', 'gender', 'age', 'cls', 'guardian', 'phone', 'phone2', 'address', 'confessor', 'notes', 'known', 'photo'];
const REG_MAX = { tok: 64, at: 40, name: 120, christian: 120, gender: 1, age: 3, cls: 20, guardian: 120, phone: 40, phone2: 40, address: 200, confessor: 120, notes: 800, known: 3, photo: 200000 };

function validBody(col, b) {
  const only = keys => Object.keys(b).every(k => keys.includes(k));
  switch (col) {
    case 'kv': return only(['v']) && typeof b.v === 'string';
    case 'meta': return only(['by']) && isStr(b.by, 128) && b.by.length > 0;
    case 'staff': return only(['role', 'active', 'username', 'dept']) && typeof b.active === 'boolean' && /^[a-z_]{1,30}$/.test(b.role || '')
      && isStr(b.username, 80) && (b.dept === undefined || isStr(b.dept, 30));
    case 'pub': return only(['ws', 'wi', 'wk', 'iv', 'ct']) && ['ws', 'wi', 'wk', 'iv', 'ct'].every(k => typeof b[k] === 'string');
    case 'regcfg': return only(['open', 'tok']) && typeof b.open === 'boolean' && isStr(b.tok, 64);
    case 'reg':
      return only(REG_KEYS) && ['tok', 'at', 'name', 'gender'].every(k => k in b)
        && Object.keys(b).every(k => isStr(b[k], REG_MAX[k])) && b.name.length >= 2;
  }
  return false;
}

async function allowed(env, op, col, id, A, body, old) {
  const me = await A.me(), uid = A.uid;
  const sup = !!me && me.role === 'super', head = !!me && me.role === 'head';
  const hr = sup || (head && me.dept === 'hr') || (!!me && me.role === 'hr_staff');
  switch (col) {
    case 'meta':       // one-time setup marker; readable by anyone; only the very first signed-in person can create it
      return op === 'get' || (op === 'create' && id === 'setup' && !!uid && body.by === uid);
    case 'staff': {
      const manageable = d => !!d && !!me && typeof d.dept === 'string' && d.dept === me.dept && d.role !== 'super' && d.role !== 'head';
      if (op === 'get') return !!uid && (uid === id || sup || head);
      if (op === 'list') return sup || head;
      if (op === 'create') {
        if (sup || (head && manageable(body))) return true;
        if (!!uid && uid === id && body.role === 'super') { const s = await getDoc(env, 'meta', 'setup'); return !!s && s.by === uid; }
        return false;
      }
      if (op === 'update') return sup || (head && manageable(old) && manageable(body));
      if (op === 'delete') return sup || (head && manageable(old));
      return false;
    }
    case 'kv': {       // school data; the public website may read only settings, the gallery and the login map
      const pub = id === 'settings' || id === 'authmap' || id.startsWith('gal_');
      if (op === 'get') return pub || !!me;
      if (op === 'list') return false;
      return sup || (!!me && id !== 'users' && id !== 'settings' && id !== 'authmap' && !id.startsWith('gal_') && !id.startsWith('users_'))
        || (head && (id === 'settings' || id === 'authmap' || id === 'users_' + me.dept));
    }
    case 'pub':        // encrypted student-portal records: fetch by secret id only, never list
      return op === 'get' || (op !== 'list' && !!me);
    case 'regcfg':
      return hr;
    case 'reg':
      if (op === 'create') {   // ANYONE with the secret link, while it is open
        const cfg = await getDoc(env, 'regcfg', 'main');
        return !!cfg && cfg.open === true && typeof body.tok === 'string' && body.tok === cfg.tok;
      }
      return hr;
  }
  return false;
}

/* ---------- document routes ---------- */
async function docRoute(request, env, parts, url) {
  const col = parts[1], id = parts[2];
  if (!COLS.has(col)) return fail(404, 'NOT_FOUND');
  const A = await context(env, request), m = request.method;

  if (id === undefined) {                                            // list
    if (m !== 'GET') return fail(405, 'METHOD_NOT_ALLOWED');
    if (!(await allowed(env, 'list', col, '', A))) return fail(403, 'PERMISSION_DENIED');
    const size = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25)), after = url.searchParams.get('pageToken') || '';
    const rows = (await env.DB.prepare('SELECT id, data FROM docs WHERE col = ?1 AND id > ?2 ORDER BY id LIMIT ?3').bind(col, after, size + 1).all()).results || [];
    const page = rows.slice(0, size).map(r => { let d = {}; try { d = JSON.parse(r.data); } catch (e) {} return Object.assign(d, { _id: r.id }); });
    return J({ docs: page, next: rows.length > size ? page[page.length - 1]._id : '' });
  }
  if (!id || id.length > 300) return fail(400, 'BAD_ID');

  if (m === 'GET') {
    if (!(await allowed(env, 'get', col, id, A))) return fail(403, 'PERMISSION_DENIED');
    const r = await rawDoc(env, col, id); if (!r) return fail(404, 'NOT_FOUND');
    if (col === 'kv') return J({ v: r.data });
    return new Response(r.data, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }

  if (m === 'PUT') {
    const text = await request.text();
    if (enc.encode(text).length > MAX_BODY) return fail(413, 'TOO_LARGE');
    let body; try { body = JSON.parse(text); } catch (e) { return fail(400, 'BAD_JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'BAD_JSON');
    const existing = await rawDoc(env, col, id);
    let old = null; if (existing && col !== 'kv') { try { old = JSON.parse(existing.data); } catch (e) {} }
    const op = existing ? 'update' : 'create';
    if (!(await allowed(env, op, col, id, A, body, old))) return fail(403, 'PERMISSION_DENIED');
    if (!validBody(col, body)) return fail(400, 'INVALID_DATA');
    if (col === 'reg' && op === 'create') {                           // public endpoint: slow down floods
      if (await strikes(env, 'r:' + A.ip, 600) >= 10) return fail(429, 'TOO_MANY_REQUESTS');
      await strike(env, 'r:' + A.ip);
    }
    const data = col === 'kv' ? body.v : JSON.stringify(body);
    if (op === 'create') {
      try { await env.DB.prepare('INSERT INTO docs (col, id, data, updated) VALUES (?1, ?2, ?3, ?4)').bind(col, id, data, now()).run(); }
      catch (e) { return fail(409, 'ALREADY_EXISTS'); }               // insert-only keeps the setup marker and public submissions safe from races
    } else {
      await env.DB.prepare('UPDATE docs SET data = ?3, updated = ?4 WHERE col = ?1 AND id = ?2').bind(col, id, data, now()).run();
    }
    return J({ ok: true });
  }

  if (m === 'DELETE') {
    const existing = await rawDoc(env, col, id);
    let old = null; if (existing && col !== 'kv') { try { old = JSON.parse(existing.data); } catch (e) {} }
    if (!(await allowed(env, 'delete', col, id, A, {}, old))) return fail(403, 'PERMISSION_DENIED');
    const st = [env.DB.prepare('DELETE FROM docs WHERE col = ?1 AND id = ?2').bind(col, id)];
    if (col === 'staff') st.push(env.DB.prepare('DELETE FROM accounts WHERE uid = ?1').bind(id));   // removing a staff member also removes their login
    await env.DB.batch(st);
    return J({ ok: true });
  }
  return fail(405, 'METHOD_NOT_ALLOWED');
}

/* ---------- sign-in routes ---------- */
async function authRoute(request, env, parts) {
  const act = parts[1];
  if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED');
  const text = await request.text(); if (text.length > 4000) return fail(413, 'TOO_LARGE');
  let b; try { b = JSON.parse(text || '{}'); } catch (e) { return fail(400, 'BAD_JSON'); }
  if (!b || typeof b !== 'object') return fail(400, 'BAD_JSON');
  const A = await context(env, request);
  const email = isStr(b.email, 200) ? b.email.trim().toLowerCase() : '';
  const pw = isStr(b.password, 200) ? b.password : '';

  if (act === 'signin') {
    if (!email || !pw) return fail(400, 'INVALID_LOGIN_CREDENTIALS');
    if (await strikes(env, 'e:' + email, 900) >= 10 || await strikes(env, 'i:' + A.ip, 900) >= 40) return fail(429, 'TOO_MANY_ATTEMPTS_TRY_LATER');
    const row = await env.DB.prepare('SELECT uid, pw FROM accounts WHERE email = ?1').bind(email).first();
    if (!row || !(await checkPw(pw, row.pw))) { await strike(env, 'e:' + email); await strike(env, 'i:' + A.ip); return fail(400, 'INVALID_LOGIN_CREDENTIALS'); }
    await clearStrikes(env, 'e:' + email);
    return J(await tokens(env, row.uid));
  }

  if (act === 'signup') {                       // first-time setup only: creates the super admin login while setup has not been completed
    if (await getDoc(env, 'meta', 'setup')) return fail(400, 'OPERATION_NOT_ALLOWED');
    if (email !== ADMIN_EMAIL) return fail(400, 'OPERATION_NOT_ALLOWED');
    if (pw.length < 6) return fail(400, 'WEAK_PASSWORD');
    const uid = b64u(crypto.getRandomValues(new Uint8Array(15)));
    await env.DB.batch([                        // an unfinished earlier attempt is simply replaced
      env.DB.prepare('DELETE FROM accounts WHERE email = ?1').bind(email),
      env.DB.prepare('INSERT INTO accounts (uid, email, pw, created) VALUES (?1, ?2, ?3, ?4)').bind(uid, email, await hashPw(env, pw), now())
    ]);
    return J(await tokens(env, uid));
  }

  if (act === 'create') {                       // the super admin or a department head makes a login for a new staff member
    const me = await A.me();
    if (!me || (me.role !== 'super' && me.role !== 'head')) return fail(403, 'PERMISSION_DENIED');
    if (!/^[a-z0-9._-]+(\.r\d+)?@staff\.sunday-school\.app$/.test(email)) return fail(400, 'INVALID_EMAIL');
    if (pw.length < 6) return fail(400, 'WEAK_PASSWORD');
    const uid = b64u(crypto.getRandomValues(new Uint8Array(15)));
    try { await env.DB.prepare('INSERT INTO accounts (uid, email, pw, created) VALUES (?1, ?2, ?3, ?4)').bind(uid, email, await hashPw(env, pw), now()).run(); }
    catch (e) { return fail(400, 'EMAIL_EXISTS'); }
    return J({ localId: uid });
  }

  if (act === 'password') {                     // a signed-in person changes their own password
    if (!A.uid) return fail(403, 'PERMISSION_DENIED');
    if (pw.length < 6) return fail(400, 'WEAK_PASSWORD');
    const r = await env.DB.prepare('UPDATE accounts SET pw = ?2 WHERE uid = ?1').bind(A.uid, await hashPw(env, pw)).run();
    if (!r.meta || !r.meta.changes) return fail(403, 'PERMISSION_DENIED');
    return J(await tokens(env, A.uid));
  }

  if (act === 'refresh') {
    const uid = await verify(env, b.refreshToken, 'r');
    if (!uid || !(await env.DB.prepare('SELECT 1 AS x FROM accounts WHERE uid = ?1').bind(uid).first())) return fail(400, 'INVALID_REFRESH_TOKEN');
    const t = await tokens(env, uid); t.refreshToken = b.refreshToken; return J(t);
  }
  return fail(404, 'NOT_FOUND');
}

/* ---------- entry point ---------- */
export async function onRequest({ request, env }) {
  try {
    const url = new URL(request.url);
    let parts; try { parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent); } catch (e) { return fail(400, 'BAD_PATH'); }
    if (parts[0] === 'health') {
      let db = false; try { await env.DB.prepare('SELECT 1 FROM docs LIMIT 1').first(); db = true; } catch (e) {}
      return J({ ok: db && !!env.AUTH_SECRET && env.AUTH_SECRET.length >= 16, database: db, secret: !!env.AUTH_SECRET && env.AUTH_SECRET.length >= 16 });
    }
    if (!env.DB) return fail(500, 'DATABASE_NOT_BOUND');
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 16) return fail(500, 'SERVER_NOT_CONFIGURED');
    if (parts[0] === 'auth') return await authRoute(request, env, parts);
    if (parts[0] === 'doc') return await docRoute(request, env, parts, url);
    return fail(404, 'NOT_FOUND');
  } catch (e) {
    console.error(e && e.stack || e);
    return fail(500, 'SERVER_ERROR');
  }
}
