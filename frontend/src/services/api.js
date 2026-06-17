const API_BASE = '/api'

export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    let detail = `Request failed: ${response.status}`
    let candidates
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') {
        detail = body.detail
      } else if (body.detail?.message) {
        detail = body.detail.message
      } else if (body.message) {
        detail = body.message
      }
      if (body.detail?.candidates) {
        candidates = body.detail.candidates
      }
    } catch {
      // Keep default detail when the body is not JSON.
    }
    const error = new Error(detail)
    error.status = response.status
    if (candidates) {
      error.candidates = candidates
    }
    throw error
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export const api = {
  getPRBoard: () => request('/pr-board'),
  getDotsLeaderboard: ({ sex } = {}) => {
    const params = sex ? `?sex=${encodeURIComponent(sex)}` : ''
    return request(`/dots-leaderboard${params}`)
  },
  getHealth: () => request('/health'),
}
