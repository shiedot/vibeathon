
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string): ActionResult<never> {
  return { ok: false, error };
}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message);
  }
}
