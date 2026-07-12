// Focus — "how much attention does a good game of this demand tonight?" on a
// 5-point distraction ladder. This is NOT complexity: a silent word race (Boggle)
// is light on rules but genuinely heads-down, while a heavy game with lots of
// downtime you can half-watch. So focus is derived from BGG mechanics/categories
// (attention continuity) as much as from weight (cognitive load).
//
// Derivation is programmatic-by-default: every game gets a `derivedFocus` from its
// BGG data, so all 50 are "populated" with no migration. A hand-picked `focus`
// field (1–5) on the doc pins/overrides it — that's the escape hatch for the games
// the heuristic gets wrong (set it in the Add/Edit form). `focusOf` resolves both.

export const FOCUS_LABELS = {
  1: '🍿 TV on',
  2: '📱 Phone OK',
  3: '📵 Screens off',
  4: '🤔 Locked in',
  5: '🧠 All-in',
}
// Longer gloss for detail cards.
export const FOCUS_BLURB = {
  1: '🍿 TV on — a show can be on',
  2: '📱 Phone OK — glance between turns',
  3: '📵 Screens off — present & social',
  4: '🤔 Locked in — watching the board',
  5: '🧠 All-in — the whole event',
}
export function focusLabel(level) { return FOCUS_LABELS[level] || null }
export function focusBlurb(level) { return FOCUS_BLURB[level] || null }

const has = (arr, kw) => (arr || []).some((x) => String(x).toLowerCase().includes(kw))

// Best-guess focus (1–5) from a game's BGG data. Weight sets the strategic-depth
// backbone (but this collection is weight-compressed, so it only lifts the heavies);
// mechanics add the attention that weight misses (real-time = can't look away,
// memory = must track); party/roll-and-move let attention wander back down.
export function derivedFocus(g) {
  const mech = g.mechanics || [], cats = g.categories || []
  const w = (typeof g.weight === 'number' && g.weight > 0) ? g.weight : null
  let depth
  if (w != null) depth = w >= 3 ? 5 : w >= 2 ? 4 : w >= 1.6 ? 3.5 : w >= 1.35 ? 3 : w >= 1.15 ? 2 : 1.5
  else depth = (has(cats, 'party') || has(cats, 'children')) ? 1.5
    : (has(cats, 'abstract') || has(cats, 'economic')) ? 3.5 : 2.5
  let attn = 0
  if (has(cats, 'real-time') || has(mech, 'real-time') || has(mech, 'speed') || has(cats, 'dexterity')) attn += 2
  if (has(mech, 'memory')) attn += 1
  if (has(mech, 'deduction') || has(cats, 'deduction')) attn += 0.7
  if (has(mech, 'betting and bluffing')) attn += 0.6
  if (has(mech, 'simultaneous action selection')) attn += 0.4
  let easy = 0
  if (has(cats, 'party')) easy += 1
  if (has(cats, 'children')) easy += 0.6
  if (has(mech, 'spin and move')) easy += 1
  if (has(mech, 'player judge')) easy += 0.8
  if (has(cats, 'trivia')) easy += 0.3
  let s = depth + attn - easy
  if (g.time && g.time <= 20) s -= 0.3
  if (g.time && g.time >= 90) s += 0.4
  return Math.max(1, Math.min(5, Math.round(s)))
}

// The focus a game actually uses: a hand-pinned `focus` (1–5) wins; otherwise derive.
export function focusOf(g) {
  const pinned = g?.focus
  if (Number.isInteger(pinned) && pinned >= 1 && pinned <= 5) return pinned
  return derivedFocus(g || {})
}
