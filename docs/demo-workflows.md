# Howzzat — End-to-end demo workflows

Companion outline for the live demo deck. Use the web page for sharing with coaches and parents; this file is a quick reference.

## View live (recommended)

**Production:** [https://app.howzzat.uk/demo](https://app.howzzat.uk/demo)

**Local dev** (port 3005):

```bash
pnpm --filter @howzzat/web dev
# open http://localhost:3005/demo
```

**Navigation:** ← → arrow keys, Space / Enter (next), click or tap left/right halves of the slide. On phones, swipe ← → or use the progress dots.

## Source & export

Slide markup lives in the app at `/demo` (`apps/web/src/components/demo/`). The file `docs/demo-presentation.html` is kept as an offline reference.

**Export PDF:** open `/demo` → Print → Save as PDF (or ⌘P).

- **Layout:** Landscape
- **Background graphics:** Must be enabled or the navy slide background prints white
  - Chrome / Edge: More settings → **Background graphics**
  - Safari: Show Details → **Print backgrounds**
  - Firefox: **Print backgrounds** under Options

---

## 1. Sign in

Open Howzzat and choose how to sign in:

| Method | What to do |
|--------|------------|
| Google | Tap **Continue with Google** |
| Email code | Enter email → **Send code** → enter the code from your inbox |
| Password | Register once or sign in with email + password |

After sign-in you land on your **dashboard**.

---

## 2. Organisation & tournament setup

1. **Create organisation** — club name and public URL slug
2. **Add teams** — set age group (e.g. U9)
3. **Create tournament** — pick rules template (e.g. U9 softball London)
4. **Register teams** — add club sides to the tournament

---

## 3. Match scheduling (no invites required)

On the tournament dashboard → **Schedule match**:

- Enter **home** and **away** team names
- Unknown opponents are created automatically — no roster or invite step required
- Optional venue and date
- Tap **Score match** to open the scorer right away

---

## 4. Tournament wallet

| Action | What to do |
|--------|------------|
| View balance | Tournament dashboard → **Tournament wallet** |
| Top up | **Manage wallet** — choose £10, £20, or £50 |
| Redeem coupon | Wallet page — enter your club code |
| Post-match charge | Automatic when you **finalize** — **20p per player** in confirmed lineup (both teams) |

Billing uses the squad confirmed at toss/lineup. Clubs on a free trial are not charged until the trial ends.

---

## 5. Live scoring flow

On the scorer screen:

1. **Claim scorer** (if another manager holds the lock — exclusive)
2. **Toss** — winner + bat or bowl
3. **Lineups** — pick from roster or quick-add opponent names
4. **Score** — tap runs, wides, no-balls, wickets
5. **Finalize** — completes match; triggers wallet charge

U9 pairs rules: 4 overs, 4 players/side, 200 start, −5 per wicket.

### No-ball with extra runs

1. Tap **No-ball**
2. Choose extra runs (off the bat, or byes)
3. Confirm — penalty and runs added automatically

### Wicket types

1. Tap **Wicket**
2. Select dismissal (bowled, caught, run out, stumped, hit wicket, LBW, …)
3. Pick fielder if needed (caught, run out, stumped)
4. Confirm — scorecard and commentary update live

---

## 6. Scoring lock

- One manager holds exclusive scoring rights per match
- Others see “Scoring locked” with the scorer’s name
- Claim from the scorer screen when unlocked
- Works on phone, tablet, or laptop

---

## 7. Parents & spectators

Share the match link — **no sign-in** required.

| View | What parents see |
|------|------------------|
| Scorecard | Live score, who's batting, chase, result |
| Commentary | Friendly over summaries — updates in real time |
| Detail | Optional ball-by-ball for coaches |

Parents can follow from the boundary, in the car, or at home.

---

## 8. Tournament insights hub

Share your club's tournament page with parents.

Tabs: **Overview** · **Fixtures** · **Leaders** · **Players**

- Season standings and next/live fixture
- **Leaderboards** — top run scorers and wicket takers
- **Player cards** — runs, strike rate, net score, wickets per child

---

## 9. Manager invites (optional)

Tournament dashboard → **Manager invites**:

- Enter email → **Send invite** → **Copy invite link**
- Pending list with **Remove**
- Accept by signing in with Google or email
- Not required for scheduling or scoring

---

## Suggested demo order (~15 min)

1. Open Howzzat → sign in (Google or email code)
2. Walk scorer: toss → lineups → score a no-ball and a wicket
3. Open match link on a second device — show live scorecard and commentary
4. Dashboard: schedule by team names → wallet top-up or coupon
5. Tournament hub — leaderboards and player cards
6. Optional: manager invite create + remove
