import { createHmac, timingSafeEqual } from 'node:crypto';
import { sql, runMigrations } from '../src/db/neon.js';
import bcrypt from 'bcryptjs';
import { adaptHandler } from './http.js';

// ── Helpers ──

const SESSION_COOKIE = 'jappy_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const TOKEN_VERSION = 'v2';

interface TokenUser {
  id: number;
  username: string;
  email: string;
  role: string;
  createdAt: number;
}

interface TokenPayload {
  user: TokenUser;
  exp: number;
}

function sendResponse(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_MAX_AGE}; HttpOnly; SameSite=Lax`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

function getCookieToken(req: Request): string | null {
  const cookie = req.headers.get('Cookie');
  if (!cookie) return null;

  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
}

function getToken(req: Request): string | null {
  const header = req.headers.get('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return getCookieToken(req);
}

function tokenSecret(): string {
  return process.env.SESSION_SECRET || 'jappy-dev-session-secret';
}

function sign(value: string): string {
  return createHmac('sha256', tokenSecret()).update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createSignedToken(user: TokenUser, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ user, exp: now + SESSION_MAX_AGE * 1000 } satisfies TokenPayload)).toString('base64url');
  return `${TOKEN_VERSION}.${payload}.${sign(payload)}`;
}

function readSignedToken(token: string): TokenPayload | null {
  const [version, payload, signature] = token.split('.');
  if (version !== TOKEN_VERSION || !payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.user?.id || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function publicUser(user: { id: number; username: string; email: string; role: string; created_at: number }): TokenUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: Number(user.created_at),
  };
}

export async function verifyToken(req: Request): Promise<{ userId: number; role: string } | null> {
  const token = getToken(req);
  if (!token) return null;

  const signed = readSignedToken(token);
  if (signed) return { userId: signed.user.id, role: signed.user.role };

  const rows = await sql`
    SELECT s.user_id, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at >= ${Date.now()}
    LIMIT 1
  `;
  if (rows.length === 0) return null;

  const session = rows[0] as { user_id: number; role: string };
  return { userId: session.user_id, role: session.role };
}

// ── Handler ──

async function authHandler(req: Request): Promise<Response> {
  if (process.env.NODE_ENV !== 'production') {
    await runMigrations();
  }

  const url = new URL(req.url || '', 'http://localhost');
  const path = url.searchParams.get('path') ?? url.pathname.replace(/\/api\/auth\/?/, '');

  // ── POST /api/auth?path=admin-login ── (admin-only login)
  if (req.method === 'POST' && path === 'admin-login') {
    try {
      const body = await req.json();
      const { email, password } = body;

      if (!email || !password) {
        return sendResponse({ error: 'Email and password required' }, 400);
      }

      const rows = await sql`SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = ${email.trim()}`;
      if (rows.length === 0) {
        return sendResponse({ error: 'Invalid email or password' }, 401);
      }

      const user = rows[0] as { id: number; username: string; email: string; password_hash: string; role: string; created_at: number };

      // Only allow admin role
      if (user.role !== 'admin') {
        return sendResponse({ error: 'Invalid email or password' }, 401);
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return sendResponse({ error: 'Invalid email or password' }, 401);
      }

      const responseUser = publicUser(user);
      const token = createSignedToken(responseUser);

      return sendResponse({
        user: responseUser,
        token,
      }, 200, { 'Set-Cookie': sessionCookie(token) });
    } catch (err) {
      console.error('Admin login error:', err);
      return sendResponse({ error: 'Login failed' }, 500);
    }
  }

  // ── POST /api/auth?path=register ──
  if (req.method === 'POST' && path === 'register') {
    try {
      const body = await req.json();
      const { username, email, password, role } = body;

      if (!username || !email || !password || !role) {
        return sendResponse({ error: 'Missing required fields: username, email, password, role' }, 400);
      }

      if (typeof username !== 'string' || username.trim().length < 2) {
        return sendResponse({ error: 'Username must be at least 2 characters' }, 400);
      }

      if (typeof email !== 'string' || !email.includes('@')) {
        return sendResponse({ error: 'Invalid email address' }, 400);
      }

      if (typeof password !== 'string' || password.length < 4) {
        return sendResponse({ error: 'Password must be at least 4 characters' }, 400);
      }

      // Only student registration is allowed through the public endpoint
      if (role !== 'student') {
        return sendResponse({ error: 'Only student accounts can be registered here' }, 400);
      }

      // Check if username or email already exists
      const existing = await sql`SELECT id FROM users WHERE username = ${username.trim()} OR email = ${email.trim()}`;
      if (existing.length > 0) {
        return sendResponse({ error: 'Username or email already taken' }, 409);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const now = Date.now();

      const userRows = await sql`
        INSERT INTO users (username, email, password_hash, role, created_at)
        VALUES (${username.trim()}, ${email.trim()}, ${passwordHash}, ${role}, ${now})
        RETURNING id, username, email, role, created_at
      `;
      const user = userRows[0] as { id: number; username: string; email: string; role: string; created_at: number };
      const responseUser = publicUser(user);
      const token = createSignedToken(responseUser, now);

      return sendResponse({
        user: responseUser,
        token,
      }, 201, { 'Set-Cookie': sessionCookie(token) });
    } catch (err) {
      console.error('Register error:', err);
      return sendResponse({ error: 'Registration failed' }, 500);
    }
  }

  // ── POST /api/auth?path=login ──
  if (req.method === 'POST' && path === 'login') {
    try {
      const body = await req.json();
      const { email, password } = body;

      if (!email || !password) {
        return sendResponse({ error: 'Email and password required' }, 400);
      }

      const rows = await sql`SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = ${email.trim()}`;
      if (rows.length === 0) {
        return sendResponse({ error: 'Invalid email or password' }, 401);
      }

      const user = rows[0] as { id: number; username: string; email: string; password_hash: string; role: string; created_at: number };

      // Block admin login through the normal student login endpoint
      if (user.role === 'admin') {
        return sendResponse({ error: 'Invalid email or password' }, 401);
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return sendResponse({ error: 'Invalid email or password' }, 401);
      }

      const responseUser = publicUser(user);
      const token = createSignedToken(responseUser);

      return sendResponse({
        user: responseUser,
        token,
      }, 200, { 'Set-Cookie': sessionCookie(token) });
    } catch (err) {
      console.error('Login error:', err);
      return sendResponse({ error: 'Login failed' }, 500);
    }
  }

  // ── POST /api/auth?path=logout ──
  if (req.method === 'POST' && path === 'logout') {
    return sendResponse({ success: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }

  // ── GET /api/auth?path=me ──
  if (req.method === 'GET' && path === 'me') {
    try {
      const token = getToken(req);
      if (!token) {
        return sendResponse({ error: 'Not authenticated' }, 401);
      }

      const signed = readSignedToken(token);
      if (signed) {
        return sendResponse({ user: signed.user });
      }

      const rows = await sql`
        SELECT u.id, u.username, u.email, u.role, u.created_at
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ${token} AND s.expires_at >= ${Date.now()}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return sendResponse({ error: 'Not authenticated' }, 401);
      }

      const user = rows[0] as { id: number; username: string; email: string; role: string; created_at: number };
      return sendResponse({ user: publicUser(user) });
    } catch (err) {
      console.error('Me error:', err);
      return sendResponse({ error: 'Failed to get user' }, 500);
    }
  }

  return sendResponse({ error: 'Not found' }, 404);
}

export default adaptHandler(authHandler);