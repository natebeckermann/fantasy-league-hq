# Fantasy League HQ

Dynasty fantasy football league headquarters for Sleeper league `1321261643883094016`.

The site is a static front-end MVP designed for Vercel. It pulls league details, users, rosters, standings, matchups, transactions, drafts, and traded picks from Sleeper's public API in the browser.

Planned production integrations include authorized dynasty values, retrospective rookie-draft grading, 2027 prospect/news tracking, sportsbook odds display, LeagueSafe dues status, historical league snapshots, and an opt-in Tuesday league newsletter.

## Local development

Run any static web server in the project directory, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deployment

No build step is required for this MVP. Deploy the repository as a static site on Vercel.
