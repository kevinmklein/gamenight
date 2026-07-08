# Game Shelf — Claude Code Context

## Project
A cozy, fun family web app that catalogs the Klein family board-game collection, helps
everyone pick "what do we play tonight?" fairly, and tracks who played what. Built to make
recurring **Thursday Game Night** (or any night) easier and less rut-prone.

**Status:** Phase 1 (design prototype). Not yet scaffolded as a real app.
**Owner:** Kevin (Dad) — *novice web dev*: knows basic git/CLI/Netlify flow but needs
explicit, step-by-step CLI reminders. Never assume tooling knowledge.

## The Family (default profiles)
| Profile | Who | Notes |
|---|---|---|
| Kevin | Dad | Likes strategy: Catan, Carcassonne |
| Stacey | Mom | |
| Sara | Twin, 13 | Family win leader in sample data |
| Sophia | Twin, 13 | Invents wacky Uno variants |

Guests/extended family can add a lightweight profile on the fly (part of the fun).

## The Three Features
1. **The Shelf** — visual, searchable library. Games shown as boxes on wooden shelves.
   Filter by hard constraints: play time, couch-vs-table, attention (background/half-watch
   vs all-in). ✅ Prototype look is approved.
2. **Game Night** — the heart. A *voting engine* that finds the game the whole table
   agrees on, with anti-rut logic + fair tiebreaks. (Being actively redesigned — see below.)
3. **Stats** — log each night (game, players, winner, duration); show aggregate + per-person
   stats. Scope for v0.1 = **log + core stats** (games played, total time, wins per person,
   most-played, Dusty Shelf).

## Locked Decisions (Phase 0 scoping)
- **Aesthetic: Cozy tabletop** — felt green (`--felt #2f4a3a`), walnut wood, brass accent
  (`--brass #c6902f`), warm parchment. Display type = warm serif (Iowan/Georgia stack);
  body = system-ui; tabular-nums for data. Both light + dark themes ("Daylight"/"Evening").
  Vibrant and playful, NOT utilitarian / no generic "AI fonts".
- **Voting model: everyone on their own phone, async (not strictly real-time).**
  User story: "Everyone grab your phones and put in your votes."
  - A **host** starts a night and *sets the table* (constraints).
  - Host gets a **QR code + shareable link** (drop into the family iMessage thread).
  - Others open it, pick who they are (or **add a new player**), and submit their top-3
    whenever. No device-passing.
- **Adding players happens on the Game Night join screen** ("Who are you?" → ＋ Add a
  player). That's the primary place guests get profiles.
- **Stats depth: log + core stats** (not streaks/head-to-head yet).

## The Voting Engine (rules to preserve)
1. **Set the Table** — host picks hard constraints (max time, couch/table, focus level).
   Produces the "Eligible Tonight" set. Non-negotiable gate.
2. **Smart shortlist / ballot** — ~8 games, *deliberately mixed*: some crowd favorites,
   some dusty/unplayed, variety of kinds. Prevents the ballot itself from being all
   short/familiar games (counters the kids' short-game bias at the source).
3. **Ranked approval vote** — each player picks **top 3, ranked**. Borda points **3 / 2 / 1**.
   Approval-style (pick a few, not one) rewards consensus over polarizing first-choices.
4. **Freshness nudge (anti-rut)** — dusty games (≥30d) get **+1.5**, (14–29d) **+0.5**,
   just-played (≤3d) **−1**. Rotates the group out of ruts without anyone arguing for it.
5. **Tiebreak** — if top two are within ~0.75:
   - **Captain of the Night** — a role that **rotates each week**; the Captain's pick breaks
     ties. Everyone gets turns.
   - **Dusty Shelf rule** — otherwise the longer-unplayed game wins.
   - **Wildcard token** (planned) — each person occasionally gets a token to force a pick.

## Filter / Tag Taxonomy (every game has these fields)
| Axis | Values | Source |
|---|---|---|
| Play time | <15 / 15–30 / 30–60 / 60+ min | BGG (auto) |
| Time-to-table (setup) | instant / quick / involved | family tag |
| Location | couch / table / either | family tag |
| Attention | background (half-watch) / semi / focus | family tag |
| Players | min–max, best-at | BGG (auto) |
| Complexity | 1–5 weight | BGG (auto) |
| Vibe | chill / silly / competitive / strategic | family tag |
| Type | card / board / dice / dominoes / party | BGG + tag |

First four are the hard "rule things out" constraints; rest are soft preferences.

## Planned Tech Stack (Phase 2+)
- **React + Vite**, deployed on **Netlify** (same flow Kevin knows from doyerfan).
- **Firestore** for data. Passwordless **avatar picker** ("Who are you?") — trusted family
  device, no real auth for v0.1.
- **Game Night rooms** via Firestore live listeners: host writes a `session` doc, phones
  read/write it. Short room code + QR link to join.
- **Intake:** BoardGameGeek XML API v2 — *search* endpoint (name → matches w/ year for
  disambiguation) then *thing* endpoint (box art, players, time, weight, categories).
  Auto-fills objective data; user adds the 3 subjective tags (couch/table, attention, setup).
  Goal: add a game in ~15s from just the name. Kevin will supply a list of ~100 games.

## Firestore Data Model (sketch)
- `games` — one doc per game (BGG data + family tags)
- `players` — family + guest profiles
- `sessions` — one per game night: date, participants, ballot, votes, winner, duration
- `plays` — feeds stats (can start as a view over `sessions`)

## Deploy Workflow (once scaffolded)
Work on `main`. This repo is **its own git repo** (rooted at
`/Users/kevin/Desktop/Projects/gamenight`), **no remote yet** — deliberately isolated from
the accidental home-folder repo at `/Users/kevin/.git` (doyerfan remote). When deploying:
scaffold Vite → first commit → create NEW GitHub repo `gamenight` → add remote → connect
Netlify. **Never push without Kevin explicitly asking.** Give exact CLI commands every time.

## Current Prototype
Single-file clickable prototype (cozy tabletop, all 3 tabs) lives in scratch/artifact form
during Phase 1. Shelf tab approved. Game Night being reworked to the own-phone + QR model.
