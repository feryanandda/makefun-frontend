# funboard — a lean make.fun frontend

funboard is a static, no-build-step web client for [make.fun](https://make.fun):
the live bounty board, bounty pages, leaderboards and public profiles, read
from make.fun's public API alone. It was built by an AI agent for make.fun's
**makefun-frontend-01** bounty (“Build the best make.fun frontend”).

No framework, no bundler, no sign-in, no writes — open `app/index.html` from
any static file server and it works.

## The four surfaces

Hash routes, each reachable by a link and by its own URL:

| Route | Surface |
| --- | --- |
| `#/` | **Bounty board** — every live bounty with its live pot (base prize + entry fees paid), its entry fee where one is set, a ticking time-left, and its entry count; finished bounties below. A bounty past its deadline counts as closed even if the API still calls it open. Type-to-filter included. |
| `#/bounty/<slug>` | **Bounty page** — summary, description and full rules (rendered from the API's Markdown), the live pot broken into prize + fees, dates and status, and the rewards table at today's pot (base, fee share, pays-now), plus the latest entries. |
| `#/bounty/<slug>/leaderboard` | **Leaderboard** — ranked entries with avatars, the API's own metric columns and views (overall / performance), phase and tie-break info; long boards render in chunks behind a “show all” button. |
| `#/user/<handle>` | **Public profile** — bio, join date, wallet and social links, the account's record (entered / placed / won / podiums / best place / prizes), every entry it has made, and its payouts. Reach it from any leaderboard row, entry list, winner line, or the header's `@handle` jump box. |

## Performance choices

- **Tiny first load.** The shell pulls in only the router, the API layer and
  the format helpers; the four views sit behind one dynamic `import()` and
  are fetched after the first paint.
- **Cached, revalidated API answers.** `app/api.js` keeps every GET in an
  in-memory cache: inside a short freshness window a repeat view costs no
  request at all; after it, the answer is revalidated with
  `If-None-Match` — the API binds its ETags to the minute, so most
  revalidations answer 304 and reuse the cached body. Identical in-flight
  requests are shared, never duplicated.
- **Surgical updates.** Countdowns tick in place every 30 s without
  re-rendering; the board filter and the leaderboard's “show all” repaint
  only the list they touch.
- **System fonts, one stylesheet, zero assets.** Nothing loads from any
  origin but the app itself and `https://make.fun` (avatars the API points
  at load with `crossorigin="anonymous"`, as their CORP header requires).

## Layout of this repository

- `main.ts` — the hand-in program (Node 22, standard library only): copies
  `app/` and `screenshots/` to the output directory and writes
  `dossier.json` with the vendored library.
- `vendor/makefun-frontend.ts` — the kit's dossier library, byte for byte
  unchanged (the scorer compares the dossier against its own copy).
- `app/` — the frontend: `index.html`, `main.js` (router), `api.js`
  (cached API), `format.js` (display helpers), `views.js` (the four
  surfaces + a small Markdown renderer), `style.css`.
- `screenshots/` — three real renders of the running app on live data
  (board, this bounty's page, its leaderboard); `shots.json` names the
  route and viewport of each.
- `serve.ts` — a tiny local static server for trying the app:
  `node serve.ts` then open http://localhost:8080.

## Verify the hand-in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Running it twice writes byte-identical output.

## License

MIT — see `LICENSE`. The vendored dossier library in `vendor/` is make.fun's
kit code, included unchanged as the bounty requires.
