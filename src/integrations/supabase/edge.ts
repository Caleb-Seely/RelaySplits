import { supabase } from './client';

export async function invokeEdge<T = any>(name: string, body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke(name, {
    body,
  });
  if (error) return { error } as { error: any };
  return { data: data as T } as { data: T };
}

// Ensure we always have a stable deviceId for Edge Functions
export function getDeviceId(): string {
  const key = 'relay_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
