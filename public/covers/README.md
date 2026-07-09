# Box cover images

Files here are served at `/covers/<name>`. To give a game real box art:

1. Drop the photo in this folder, e.g. `catan.jpg` (jpg/png/webp all fine).
2. On the Shelf, open the game → **Edit** → set **Box image URL** to `/covers/catan.jpg` → Save.

The per-game `image` field is what the shelf box + detail hero read (via
`coverImageFor` in `src/lib/catalog.js`); with no image a game shows its name-hash
gradient box. BoardGameGeek auto-fill will populate `image` for the rest of the shelf later.
