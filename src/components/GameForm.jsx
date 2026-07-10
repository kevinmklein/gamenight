import { useState } from 'react'
import { coverFor } from '../lib/catalog.js'
import { Seg } from './gameNightBits.jsx'

const MAX_DIM = 700

// Resize + compress a chosen photo client-side into a small JPEG data URL —
// keeps it well under Firestore's 1MiB doc limit without needing Firebase
// Storage (a separate product + its own security rules) just for box art.
function resizePhoto(file, maxDim = MAX_DIM, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read-failed'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('decode-failed'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim }
          else { width = Math.round((width * maxDim) / height); height = maxDim }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

const KINDS = ['Card', 'Strategy', 'Party', 'Dice', 'Dominoes', 'Abstract', 'Family', 'Word Game']
const BLANK = {
  name: '', kind: 'Card', time: 20, minP: 2, maxP: 4,
  loc: 'either', att: 'semi', setup: 'quick', image: '',
}

// Map a stored game doc back into the form's field shape (for editing).
function fromGame(g) {
  if (!g) return BLANK
  return {
    name: g.name || '', kind: g.kind || 'Card',
    time: g.time ?? 20, minP: g.minPlayers ?? '', maxP: g.maxPlayers ?? '',
    loc: g.loc || 'either', att: g.att || 'semi', setup: g.setup || 'quick',
    image: g.image || '',
  }
}

// Shared game intake form. `mode` = 'add' | 'edit'.
// `onSubmitCore(core)` receives just the editable fields (+ a name-derived cover);
// the caller decides whether that becomes a new doc or a patch.
export default function GameForm({ mode = 'add', initial, onSubmitCore, onDone, onCancel }) {
  const [f, setF] = useState(() => fromGame(initial))
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState('')
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }))

  const canSave = f.name.trim().length > 0 && !saving && !photoBusy
  const isDataUrl = f.image.startsWith('data:')

  async function handlePhoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoErr('')
    setPhotoBusy(true)
    try {
      set('image')(await resizePhoto(file))
    } catch {
      setPhotoErr('Couldn’t use that photo — try a different one.')
    } finally {
      setPhotoBusy(false)
    }
  }

  function core() {
    const name = f.name.trim()
    const players =
      f.minP && f.maxP ? (Number(f.minP) === Number(f.maxP) ? `${f.minP}` : `${f.minP}–${f.maxP}`) : ''
    return {
      name, kind: f.kind,
      time: Number(f.time) || null,
      minPlayers: Number(f.minP) || null,
      maxPlayers: Number(f.maxP) || null,
      players,
      loc: f.loc, att: f.att, setup: f.setup,
      cover: coverFor(name),
      image: f.image.trim() || null,
    }
  }

  async function submit(again) {
    if (!canSave) return
    setSaving(true)
    const name = f.name.trim()
    await onSubmitCore(core())
    setSaving(false)
    if (mode === 'add' && again) {
      setF(BLANK)
      setToast(`Added “${name}”. Next one?`)
      setTimeout(() => setToast(''), 1800)
    } else {
      onDone?.()
    }
  }

  return (
    <>
      <div className="field">
        <label htmlFor="gf-name">Game name</label>
        <input
          id="gf-name" type="text" placeholder="e.g. Carcassonne"
          value={f.name}
          onChange={(e) => set('name')(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(false) }}
        />
      </div>

      <div className="grid2">
        <div className="field">
          <label htmlFor="gf-kind">Type</label>
          <select id="gf-kind" value={f.kind} onChange={(e) => set('kind')(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="gf-time">Typical play time (minutes)</label>
          <input id="gf-time" type="number" min="1" max="480" value={f.time}
            onChange={(e) => set('time')(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="gf-min">Min players</label>
          <input id="gf-min" type="number" min="1" max="20" value={f.minP}
            onChange={(e) => set('minP')(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="gf-max">Max players</label>
          <input id="gf-max" type="number" min="1" max="20" value={f.maxP}
            onChange={(e) => set('maxP')(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Where do you play it?</label>
        <Seg value={f.loc} onChange={set('loc')} options={[
          ['couch', '🛋 Couch'], ['table', '🪑 Table'], ['either', 'Either'],
        ]} />
      </div>
      <div className="field">
        <label>Attention needed</label>
        <Seg value={f.att} onChange={set('att')} options={[
          ['background', '👀 Half-watch OK'], ['semi', 'Light focus'], ['focus', '🧠 All-in'],
        ]} />
      </div>
      <div className="field">
        <label>Time to set up</label>
        <Seg value={f.setup} onChange={set('setup')} options={[
          ['instant', 'Instant'], ['quick', 'Quick'], ['involved', 'Involved'],
        ]} />
      </div>
      <div className="field">
        <label>Box art (optional)</label>
        <div className="cover-upload">
          {f.image && <img className="cover-thumb" src={f.image} alt="" />}
          <label className="btn ghost file-btn">
            {photoBusy ? 'Processing…' : f.image ? 'Change photo' : '📷 Upload a photo'}
            <input type="file" accept="image/*" onChange={handlePhoto} disabled={photoBusy} hidden />
          </label>
          {f.image && (
            <button type="button" className="btn ghost" onClick={() => set('image')('')}>Remove</button>
          )}
        </div>
        {photoErr && <span className="hint warn">{photoErr}</span>}
        {!isDataUrl && (
          <input type="text" style={{ marginTop: 8 }} placeholder="…or paste an image link"
            value={f.image} onChange={(e) => set('image')(e.target.value)} />
        )}
        <span className="hint">Photos are resized automatically. Real box art auto-fills from BoardGameGeek later.</span>
      </div>

      <div className="actions">
        {mode === 'add' ? (
          <>
            <button className="btn brass" disabled={!canSave} onClick={() => submit(true)}>
              {saving ? 'Saving…' : 'Add & enter another'}
            </button>
            <button className="btn ghost" disabled={!canSave} onClick={() => submit(false)}>
              Add & view shelf
            </button>
          </>
        ) : (
          <>
            <button className="btn brass" disabled={!canSave} onClick={() => submit(false)}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button className="btn ghost" onClick={onCancel}>Cancel</button>
          </>
        )}
        {!f.name.trim() && <span className="hint">Give it a name to save.</span>}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
