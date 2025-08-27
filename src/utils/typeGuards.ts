export const isApiResponse = <T>(response: unknown): response is { data: T; error?: string } => {
  return typeof response === 'object' && response !== null && 'data' in response;
};

export const isErrorResponse = (response: unknown): response is { error: string } => {
  return typeof response === 'object' && response !== null && 'error' in response;
};

export const isDatabaseRecord = (data: unknown): data is Record<string, any> => {
  return typeof data === 'object' && data !== null;
};

export const isRunner = (data: unknown): data is { id: number; name: string; pace: number; van: number } => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    'pace' in data &&
    'van' in data &&
    typeof (data as any).id === 'number' &&
    typeof (data as any).name === 'string' &&
    typeof (data as any).pace === 'number' &&
    typeof (data as any).van === 'number'
  );
};

export const isLeg = (data: unknown): data is { id: number; distance: number; actualStart?: number; actualFinish?: number } => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'distance' in data &&
    typeof (data as any).id === 'number' &&
    typeof (data as any).distance === 'number'
  );
};

export const isArray = <T>(data: unknown, itemGuard?: (item: unknown) => item is T): data is T[] => {
  if (!Array.isArray(data)) return false;
  if (itemGuard) {
    return data.every(itemGuard);
  }
  return true;
};
