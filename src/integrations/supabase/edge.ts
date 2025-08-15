import { supabase } from './client';

export async function invokeEdge<T = any>(name: string, body: Record<string, any>) {
  console.log(`[invokeEdge] Calling ${name} with body:`, body);
  try {
    const { data, error } = await supabase.functions.invoke(name, {
      body,
    });
    console.log(`[invokeEdge] ${name} response:`, { data, error });
    if (error) return { error } as { error: any };
    return { data: data as T } as { data: T };
  } catch (e) {
    console.error(`[invokeEdge] Exception calling ${name}:`, e);
    return { error: e } as { error: any };
  }
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
