import { useEffect, useState } from 'react'
import { subscribeSession, subscribeVotes, submitVote } from '../lib/catalog.js'
import { tally, constraintPills } from '../lib/night.js'
import { VoteFlow, RevealResults, Avatar } from './gameNightBits.jsx'

export default function Join({ code, uid }) {
  const [session, setSession] = useState(undefined)   // undefined = loading, null = not found
  const [votes, setVotes] = useState([])
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const u1 = subscribeSession(code, setSession)
    const u2 = subscribeVotes(code, setVotes)
    return () => { u1(); u2() }
  }, [code])

  const myVote = votes.find((v) => v.id === uid)
  const revealed = session?.phase === 'revealed'

  async function submit(vote) {
    await submitVote(code, uid, vote)
    setEditing(false)
  }

  let body
  if (session === undefined) {
    body = <div className="soon">Finding table <b>{code}</b>…</div>
  } else if (session === null) {
    body = (
      <div className="empty">
        <h3>Table “{code}” not found</h3>
        <p>Double-check the link, or ask the host to share it again.</p>
      </div>
    )
  } else if (revealed) {
    body = (
      <>
        <RevealResults results={tally(session.ballot, votes)} voterNames={votes.map((v) => v.name)} />
        <p className="footnote">The host closed voting. See you at the table!</p>
      </>
    )
  } else if (myVote && !editing) {
    body = (
      <>
        <div className="panel waiting">
          <Avatar color={myVote.color} size={44} />
          <h3>Thanks, {myVote.name} — your vote’s in.</h3>
          <p>When everyone’s voted, the host reveals tonight’s pick. <b>This screen updates on
            its own</b> — keep it open and the winner shows up right here.</p>
          <div className="join-tally">{votes.length} vote{votes.length === 1 ? '' : 's'} in so far</div>
          <button className="btn ghost" onClick={() => setEditing(true)}>Change my vote</button>
        </div>
        <div className="panel">
          <div className="eyebrow">While you wait</div>
          <h3 className="stat-h">On the table tonight</h3>
          <p className="hint" style={{ marginTop: 0 }}>The {session.ballot.length} games in the running:</p>
          <div className="ballot">
            {session.ballot.map((g) => {
              const c = g.cover || { c1: '#3a3a3a', c2: '#222' }
              return (
                <div className="bcard readonly" key={g.id}>
                  <span className="strip" style={{ background: `linear-gradient(90deg, ${c.c1}, ${c.c2})` }} />
                  <span className="bin">
                    <span className="bn">{g.name}</span>
                    <span className="bmeta tnum">
                      {g.time ? `${g.time}m` : ''}{g.players ? ` · ${g.players}` : ''} · {g.kind}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </>
    )
  } else {
    body = (
      <>
        <div className="constraint-summary" style={{ marginBottom: 4 }}>
          {constraintPills(session.constraints || {}).map((t) => <span className="cpill" key={t}>{t}</span>)}
        </div>
        <VoteFlow ballot={session.ballot} existingVote={editing ? myVote : undefined} onSubmit={submit} />
      </>
    )
  }

  return (
    <section className="tab">
      <div className="eyebrow">Game Time · Table {code}</div>
      <h2 className="big">Cast your vote</h2>
      {body}
    </section>
  )
}
