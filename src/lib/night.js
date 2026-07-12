// Game Night — the pure voting-engine logic (no Firestore, no React).
// Session persistence lives in catalog.js; this file is the rules from CLAUDE.md:
// eligibility gate → smart shortlist → ranked Borda vote → freshness nudge → tiebreak.
import { playedDaysAgo, FALLBACK_COVER } from './catalog.js'
import { focusOf, FOCUS_LABELS } from './focus.js'

// Days-since for a ballot snapshot (never-played sorts as "dustiest").
const dust = (g) => { const d = playedDaysAgo(g); return d == null ? 1e9 : d }

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5)

// Only the fields a voter's device needs — frozen onto the session so the ballot
// can't shift under people mid-vote and joiners need just one read.
function snapshot(g) {
  return {
    id: g.id, name: g.name, kind: g.kind, time: g.time || null,
    players: g.players || '', loc: g.loc || 'either', focus: focusOf(g),
    cover: g.cover || FALLBACK_COVER, image: g.image || null, bggImage: g.bggImage || null,
    plays: g.plays || 0, last: g.last ?? null, lastPlayed: g.lastPlayed ?? null,
    // BGG extras (present once synced/backfilled) — for the read-only info popup.
    description: g.description || '', weight: g.weight ?? null, minAge: g.minAge ?? null,
    bestPlayers: g.bestPlayers ?? null, recommendedPlayers: g.recommendedPlayers || [],
  }
}

// Does a game seat exactly `n` players? Lenient when a bound is missing.
// Shared with the Shelf's player-count filter.
export function seatsPlayers(g, n) {
  const min = g.minPlayers, max = g.maxPlayers
  if (min != null && n < min) return false
  if (max != null && n > max) return false
  return true
}

// BGG "suggested players" poll tokens look like "4" or "6+". Does one cover n?
function countMatches(token, n) {
  const s = String(token).trim()
  if (s.endsWith('+')) return n >= parseInt(s, 10)
  return parseInt(s, 10) === n
}

// Community-preferred player counts, from BGG's poll (populated by auto-fill /
// backfill). Each returns null when the game has no BGG data yet, so callers can
// tell "no, doesn't fit n" apart from "we don't know". Shared by the Shelf's
// best-fit filter and Game Night's shortlist.
export function playsBestAt(g, n) {
  if (g.bestPlayers == null || g.bestPlayers === '') return null
  return countMatches(g.bestPlayers, n)
}
export function playsWellAt(g, n) {
  const rec = g.recommendedPlayers
  if (!Array.isArray(rec) || rec.length === 0) return null
  return rec.some((t) => countMatches(t, n))
}

// ---- Soft-preference signals (nudge the shortlist, never gate) ----------------
//
// Effort / brain-burn, graded on YOUR shelf's curve. BGG's absolute 1–5 weight
// buries a light-leaning family collection at the bottom (that's why the old
// absolute Complexity filter got pulled), so instead we split the collection's own
// weights into terciles: light / medium / heavy *relative to what you actually own*.
export function effortThresholds(games = []) {
  const ws = games.map((g) => g.weight).filter((w) => typeof w === 'number' && w > 0).sort((a, b) => a - b)
  if (ws.length < 3) return null
  return { t1: ws[Math.floor(ws.length / 3)], t2: ws[Math.floor((ws.length * 2) / 3)] }
}
export function effortBucketOf(g, th) {
  const w = g.weight
  if (th == null || typeof w !== 'number' || w <= 0) return null
  return w < th.t1 ? 'light' : w < th.t2 ? 'medium' : 'heavy'
}

// Vibe / energy, auto-derived from BGG categories + mechanics (+ our own kind) so
// nobody has to hand-tag it. Loud/social signals push "lively", thinky/quiet ones
// push "calm"; a tie (or no BGG data) returns null = no opinion.
const VIBE_LIVELY = new Set(['party game', 'humor', 'trivia', 'bluffing', 'word game', 'music',
  'real-time', 'deduction', 'acting', 'betting and bluffing', 'player elimination', 'voting',
  'push your luck', 'memory', 'simultaneous action selection', 'party'])
const VIBE_CALM = new Set(['abstract strategy', 'puzzle', 'economic', 'territory building',
  'city building', 'farming', 'wargame', 'tile placement', 'worker placement',
  'route/network building', 'area majority / influence', 'pattern building', 'grid coverage',
  'deck / bag / pool building', 'auction/bidding', 'strategy', 'abstract', 'dominoes'])
export function vibeOf(g) {
  let score = 0
  const bump = (tag) => {
    const t = String(tag || '').toLowerCase().trim()
    if (VIBE_LIVELY.has(t)) score += 1
    if (VIBE_CALM.has(t)) score -= 1
  }
  ;(g.categories || []).forEach(bump)
  ;(g.mechanics || []).forEach(bump)
  bump(g.kind)
  return score > 0 ? 'lively' : score < 0 ? 'calm' : null
}

// Sleeper hit: the world loves it (BGG rating ≥ 7) but it's gone dusty on your
// shelf (≥30d / never). Boosted in the lottery and badged on the ballot.
export function isSleeper(g) {
  return typeof g.rating === 'number' && g.rating >= 7 && dust(g) >= 30
}

// Hard "rule things out" gate → the set eligible tonight.
export function eligible(games, c = {}) {
  return games.filter((g) => {
    if (c.maxTime && g.time > c.maxTime) return false
    if (c.loc === 'couch' && g.loc === 'table') return false
    if (c.loc === 'table' && g.loc === 'couch') return false
    // Focus is a target tier: "what focus are we after?" → games AT that tier
    // (Background / Casual / Focused), so each pick is a distinct mood.
    if (c.focus && focusOf(g) !== c.focus) return false
    if (c.players && !seatsPlayers(g, c.players)) return false
    if (c.kind && g.kind !== c.kind) return false
    // "Best at N" — community-poll gate; unknown (no BGG data) doesn't qualify.
    if (c.bestAtN && c.players && playsBestAt(g, c.players) !== true) return false
    return true
  })
}

// Per-game lottery weight: base 1 (everyone gets a real shot) plus soft nudges.
// Higher weight = more likely to land on the ballot, but nothing is ever forced or
// forbidden — that's what keeps it fair AND smart. `th` = collection effort terciles;
// `c` = the host's constraints (hard gates already applied; here we read soft prefs).
function ballotWeight(g, c, th) {
  let w = 1
  const d = dust(g)
  // Anti-rut freshness: dusty games rise, just-played ones sink (but stay reachable).
  if (d >= 30) w += 1.2
  else if (d >= 14) w += 0.5
  else if (d <= 3) w -= 0.6
  // BGG quality — surface games the wider world actually rates highly.
  if (typeof g.rating === 'number') {
    if (g.rating >= 7.5) w += 0.7
    else if (g.rating >= 7) w += 0.4
    else if (g.rating >= 6) w += 0.15
  }
  if (isSleeper(g)) w += 1.0 // loved-but-dusty gets an extra push
  // Community best-at-this-count, when a player count is set.
  if (c.players) {
    if (playsBestAt(g, c.players) === true) w += 0.8
    else if (playsWellAt(g, c.players) === true) w += 0.3
  }
  // Soft preferences: matches lean in, mismatches lean out — never excluded.
  if (c.effort) { const b = effortBucketOf(g, th); if (b) w += b === c.effort ? 0.9 : -0.5 }
  if (c.vibe) { const v = vibeOf(g); if (v) w += v === c.vibe ? 0.8 : -0.5 }
  if (c.setup && g.setup) w += g.setup === c.setup ? 0.5 : -0.3
  return Math.max(0.05, w)
}

// Smart shortlist: ~8 games drawn by a WEIGHTED LOTTERY over the eligible set —
// favorites, dusty ones, well-rated ones and preference-matches all get heavier
// odds, but every eligible game has a real chance and ties break randomly (no more
// alphabetical collapse when play history is sparse). Already-picked kinds get
// diminishing odds so the ballot stays varied. Display order is shuffled to kill
// primacy bias. Returns frozen snapshots, tagged with sleeper/effort/vibe.
export function buildBallot(games, c = {}, size = 8) {
  const elig = eligible(games, c)
  const th = effortThresholds(games)
  const pool = elig.map((g) => ({ g, w: ballotWeight(g, c, th) }))
  const picked = []
  const kindCount = {}
  while (picked.length < size && pool.length) {
    // Effective weight: each already-picked game of the same kind shrinks the odds.
    const eff = pool.map((p) => p.w * Math.pow(0.45, kindCount[p.g.kind] || 0))
    const total = eff.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    let idx = 0
    while (idx < eff.length - 1 && (r -= eff[idx]) > 0) idx++
    const [chosen] = pool.splice(idx, 1)
    picked.push(chosen.g)
    kindCount[chosen.g.kind] = (kindCount[chosen.g.kind] || 0) + 1
  }
  return shuffle(picked).map((g) => ({
    ...snapshot(g), sleeper: isSleeper(g), effort: effortBucketOf(g, th), vibe: vibeOf(g),
  }))
}

// Ranked-approval tally: Borda 3/2/1 across voters + the freshness nudge.
// `votes` is an array of { ranking: [gameId, gameId, gameId] }.
// Only games somebody actually voted for make the results — the freshness nudge
// reorders the voted set, it can never crown a game with zero votes.
export function tally(ballot = [], votes = []) {
  const base = {}
  ballot.forEach((g) => { base[g.id] = 0 })
  votes.forEach((v) => (v.ranking || []).forEach((id, i) => {
    if (base[id] != null) base[id] += [3, 2, 1][i] || 0
  }))
  const results = ballot.filter((g) => base[g.id] > 0).map((g) => {
    const d = playedDaysAgo(g)
    let fresh = 0, label = ''
    if (d == null || d >= 30) { fresh = 1.5; label = 'Dusty-shelf boost' }
    else if (d >= 14) { fresh = 0.5; label = 'A while ago' }
    else if (d <= 3) { fresh = -1; label = 'Just played' }
    return { id: g.id, game: g, base: base[g.id], fresh, score: Math.max(0, base[g.id] + fresh), label }
  })
  results.sort((a, b) => b.score - a.score || dust(b.game) - dust(a.game))
  return results
}

// Tiebreak helper: Captain of the Night rotates weekly among the people who voted.
// `weekOffset` lets callers preview future rotations (e.g. "next up: …").
export function captainFor(names = [], weekOffset = 0) {
  if (!names.length) return null
  const sorted = [...names].sort()
  const week = Math.floor(Date.now() / (7 * 86400000)) + weekOffset
  return sorted[week % sorted.length]
}

const CODE_WORDS = ['OWL', 'FOX', 'ELK', 'CROW', 'MOTH', 'LYNX', 'WREN', 'HARE', 'STAG', 'DOVE']
export function makeRoomCode() {
  return CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)] + '-' +
    (100 + Math.floor(Math.random() * 899))
}

export function joinUrl(code) {
  const origin = typeof location !== 'undefined' ? location.origin : ''
  return `${origin}/#/join/${code}`
}

const EFFORT_PILL = { light: '🪶 Chill', medium: '⚖️ Medium', heavy: '🧠 Big strategy' }
const VIBE_PILL = { calm: '🌙 Calm', lively: '🎉 Lively' }
const SETUP_PILL = { instant: '⚡ Instant setup', quick: '🎲 Quick setup', involved: '🧩 Involved setup' }

export function constraintPills(c = {}) {
  return [
    c.players ? `👥 ${c.players}${c.players >= 8 ? '+' : ''} playing` : '👥 Any # playing',
    c.bestAtN && c.players ? `★ Best at ${c.players}` : null,
    c.maxTime ? `⏱ Under ${c.maxTime}m` : '⏱ Any length',
    c.loc === 'couch' ? '🛋 Couch' : c.loc === 'table' ? '🪑 Table' : '🛋🪑 Either',
    c.focus ? `🎯 ${FOCUS_LABELS[c.focus]}` : '🎯 Any focus',
    c.kind ? `🎲 ${c.kind}` : null,
    // Soft preferences only show up as a pill when the host actually set them.
    EFFORT_PILL[c.effort], VIBE_PILL[c.vibe], SETUP_PILL[c.setup],
  ].filter(Boolean)
}
