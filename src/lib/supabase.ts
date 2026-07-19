const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function db<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!url() || !key()) throw new Error('SUPABASE_NOT_CONFIGURED');
  const response = await fetch(`${url()}/rest/v1/${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      apikey: key()!,
      authorization: `Bearer ${key()}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
      ...init.headers,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`SUPABASE_${response.status}_${detail}`);
  }
  return (response.status === 204 ? null : await response.json()) as T;
}
