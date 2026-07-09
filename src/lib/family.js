// The family roster + stable player colors — the single source of truth, shared
// by Game Night's voting UI and the Stats tab. Guests get a color hashed from
// their name so it stays consistent across screens.
export const FAMILY = ['Kevin', 'Stacey', 'Sara', 'Sophia']

const PLAYER_COLOR = { Kevin: '#3f6d8f', Stacey: '#a06a4f', Sara: '#4b7a52', Sophia: '#8a6db0' }
const GUEST_COLORS = ['#c08a3e', '#3f8f8a', '#a06a4f', '#6a7a3f', '#7a5a9a', '#c26a6a']

export function colorFor(name = '') {
  if (PLAYER_COLOR[name]) return PLAYER_COLOR[name]
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return GUEST_COLORS[h % GUEST_COLORS.length]
}
