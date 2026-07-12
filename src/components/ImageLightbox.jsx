import { useEffect } from 'react'

// A dead-simple full-screen image preview. Click the scrim (or ✕, or Escape) to
// close; clicking the image itself doesn't. Used to blow up a small box-art
// thumbnail so you can judge whether a BGG cover is the right one before saving.
export default function ImageLightbox({ src, alt = '', onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!src) return null
  return (
    <div className="scrim lightbox" onClick={onClose}>
      <button type="button" className="lightbox-x" aria-label="Close" onClick={onClose}>✕</button>
      <img className="lightbox-img" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
