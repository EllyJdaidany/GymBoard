import { request } from './api'

export const adminApi = {
  getStats: () => request('/admin/stats'),
  getMembers: (filter = 'all') =>
    request(`/admin/members?filter=${encodeURIComponent(filter)}`),
  createMember: (payload) =>
    request('/admin/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAttentionMembers: () => request('/admin/attention-members'),
  getMemberCandidates: (memberId) => request(`/admin/members/${memberId}/candidates`),
  lookupOplProfile: (query) =>
    request(`/admin/opl-profiles/lookup?q=${encodeURIComponent(query)}`),
  resolveMember: (memberId, username) =>
    request(`/admin/members/${memberId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  unlinkMember: (memberId) =>
    request(`/admin/members/${memberId}/unlink`, { method: 'POST' }),
  retryMember: (memberId) =>
    request(`/admin/members/${memberId}/retry`, { method: 'POST' }),
  syncAll: () => request('/admin/sync-all', { method: 'POST' }),
  getSyncLog: (limit = 100) => request(`/admin/sync-log?limit=${limit}`),
  upsertGymPrs: (payload) =>
    request('/admin/gym-prs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getGymPrs: () => request('/admin/gym-prs'),
  getGymPr: (memberId) => request(`/admin/gym-prs/${memberId}`),
}
