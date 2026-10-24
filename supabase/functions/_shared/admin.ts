/**
 * Minimal, dependency-free service-role helpers for maintenance functions.
 * Plain fetch keeps cold starts fast and avoids downloading packages at boot.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Maintenance functions may only be called with the service-role key (by a
 * scheduled job or an operator). The platform gateway has already verified
 * the JWT signature; here we additionally require the service_role claim.
 */
export function requireServiceRole(req: Request): Response | null {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return new Response('Forbidden', { status: 403 });
  if (token === SERVICE_KEY) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role === 'service_role') return null;
  } catch {
    // fall through
  }
  return new Response('Forbidden', { status: 403 });
}

async function call(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

export const rpc = <T>(fn: string, args: Record<string, unknown> = {}) =>
  call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }) as Promise<T>;

export const select = <T>(table: string, query: string) => call(`/rest/v1/${table}?${query}`) as Promise<T>;

export const deleteAuthUser = (id: string) => call(`/auth/v1/admin/users/${id}`, { method: 'DELETE' });

/** Lists every object path under a folder (recursively, paginated). */
export async function listAll(bucket: string, folder: string): Promise<string[]> {
  const paths: string[] = [];
  const queue = [folder];
  while (queue.length) {
    const prefix = queue.shift()!;
    for (let offset = 0; ; offset += 100) {
      const items = (await call(`/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        body: JSON.stringify({ prefix, limit: 100, offset }),
      })) as { name: string; id: string | null }[];
      for (const item of items) {
        const full = `${prefix}/${item.name}`;
        if (item.id === null) queue.push(full);
        else paths.push(full);
      }
      if (items.length < 100) break;
    }
  }
  return paths;
}

export async function removeAll(bucket: string, paths: string[]) {
  for (let i = 0; i < paths.length; i += 100) {
    await call(`/storage/v1/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: paths.slice(i, i + 100) }) });
  }
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
