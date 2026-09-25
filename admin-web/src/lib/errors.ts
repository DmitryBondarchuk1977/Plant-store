/** Достаёт читаемый текст из любой ошибки, включая ошибки Supabase/PostgREST. */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    const parts = [o.message, o.details, o.hint, o.code]
      .filter((x) => typeof x === 'string' && x.length > 0)
    if (parts.length) return parts.join(' · ')
    try {
      return JSON.stringify(o)
    } catch {
      return String(e)
    }
  }
  return String(e)
}
