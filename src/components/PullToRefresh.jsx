import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 64
const MAX_PULL = 100

// Wraps content pinned to the top of the page so a downward drag (only while
// already scrolled to the top) reloads the app — the simplest way to force
// Firestore's realtime listeners to reconnect, and the gesture families expect
// from every other app. No native pull-to-refresh exists in standalone/PWA mode,
// so this is the only way to get it there.
export default function PullToRefresh({ children }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullRef = useRef(0)
  const startY = useRef(null)
  const dragging = useRef(false)

  useEffect(() => {
    const atTop = () => (document.scrollingElement || document.documentElement).scrollTop <= 0
    const setPullBoth = (v) => { pullRef.current = v; setPull(v) }

    function onStart(e) {
      if (refreshing || !atTop()) return
      startY.current = e.touches[0].clientY
      dragging.current = true
    }
    function onMove(e) {
      if (!dragging.current || startY.current == null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || !atTop()) { dragging.current = false; setPullBoth(0); return }
      if (e.cancelable) e.preventDefault()
      setPullBoth(Math.min(MAX_PULL, dy * 0.5))
    }
    function onEnd() {
      if (!dragging.current) return
      dragging.current = false
      startY.current = null
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true)
        setPullBoth(THRESHOLD)
        window.location.reload()
      } else {
        setPullBoth(0)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [refreshing])

  return (
    <div className="ptr">
      <div className="ptr-indicator" style={{ height: pull, opacity: Math.min(1, pull / THRESHOLD) }}>
        {refreshing ? '↻ Refreshing…' : pull >= THRESHOLD ? '↑ Release to refresh' : '↓ Pull to refresh'}
      </div>
      <div style={pull ? { transform: `translateY(${pull}px)` } : undefined}>
        {children}
      </div>
    </div>
  )
}
