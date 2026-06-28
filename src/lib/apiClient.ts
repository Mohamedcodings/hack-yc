const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function apiPath(path: string) {
  return `${apiBaseUrl}${path}`
}

// Drop-in fetch that attaches the active auth bearer token (Supabase/Clerk) when present.
export async function authFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  return fetch(apiPath(path), { ...init, headers })
}
