# Regué

The plants of one home, each with an NFC tag stuck to its pot. Tap the phone on the pot and
its page opens: how many days until it needs water, a vase that drains as the days go by, and
two big buttons for the thumb, **Regué** (watered) and **Rocié** (misted). One tap logs it; for
six seconds the same button undoes it.

**Live:** https://plantas.marioconti.com.ar/

## What is in it

- **The plant page** (`#/g/<garden>/p/<plant>`, the address on the tag). The vase is the
  signature: the water left is the time left, it hangs one block under its base for every day
  late, and watering fills it while the big number counts up. Below it are the last waterings,
  quick actions (fed, photo, note, repotted, pruned, turned, treated, cleaned), three weeks of
  the diary, progress over 90 days (real rhythm against the planned one, on-time share,
  streak, a photo timeline), the care guide of its species and the full journal.
- **The garden**, by urgency: late, today, next. A mini vase per plant.
- **The diary**, written as tablature. Every plant is a string, every column a day, every
  entry a square of its colour; a late watering is a red run up to today's yellow column.
- **The care guide**: 36 common houseplants, balcony herbs included. Each has light, water
  (warm and cold months), humidity, temperature, feeding season, toxicity for cats, dogs and
  people, precautions, what not to do and symptoms with their cause and fix. Every entry cites
  its sources (ASPCA, NC State Extension, RHS and others). Watering intervals are estimates
  and say so; the finger test is the rule. The photo of each species comes from Wikimedia
  Commons with author and licence.
- **Access**: private by default, see below.
- **The brand manual** (`#/marca`), drawn with the real components and tokens.

## When is it due

```
next = day of the latest entry of that type + the interval for today's season
```

Computed on read, never stored, in calendar days of the phone's time zone. Each plant has a
warm and a cold watering interval; the garden says which months are cold (May to September in
Buenos Aires). A watering never logged counts as due today; a mist or feed schedule never
logged does not push the plant up the list. `src/lib/care.ts`, tested in `care.test.ts`.

## Who gets in

There are no accounts and no emails. Two secrets do two different jobs:

| | What it is | Where it lives | What it opens |
|---|---|---|---|
| **Garden key** | 128 random bits | in every link and on every tag, after the `#` | says which garden; nothing on its own while the garden is private |
| **Pass** | another random token | on one phone, saved once from a link | says who: "Mario", "Juan", "Laura (January)" |

A pass has a role and may expire: **owner** (everything, including passes and access),
**member** (logs, adds and edits plants) or **guest** (logs only). Owners make passes in
*Ajustes* and send the link `#/g/<garden>/pase/<token>`; the token is shown once and only its
SHA-256 is stored. Revoking one takes effect at that phone's next request, and the last owner
pass cannot be revoked.

**The switch.** An owner can open the garden for a while (a day, a week, until closed): anyone
holding a tag link can then read and log, signed as "Visita". It closes by itself on the date.
That is for whoever waters the plants while the house is away and should not need a pass.

Every journal entry is signed with the name of the pass that wrote it.

> If every owner loses their pass (a phone wiped, site data cleared), make a new one from the
> Supabase SQL editor: insert a row in `plants_passes` with `role = 'owner'` and
> `token_hash = plants_hash('<a new long random token>')`, then open
> `#/g/<garden>/pase/<that token>`.

## How it is built

- **React 19 + TypeScript + Vite**, hash routes, no UI library. Icons are Phosphor (MIT) as
  inline paths. Fonts: Bricolage Grotesque, Instrument Serif, IBM Plex Mono.
- **Data**: Supabase (project shared with El Anotador and Súper, tables prefixed `plants_`).
  The tables are closed to the publishable key; everything goes through Postgres functions
  that check the garden key, the pass and the role. `supabase/schema.sql`, safe to re-run.
- **Local first**: the last copy is kept on the phone, so a tag opens the plant at once; every
  change is queued and sent in order, with an id made on the phone so a retry lands once.
- **Photos** are shrunk on the phone (1600 px, WebP) and stored in a public bucket under the
  garden key.
- **Deploy**: GitHub Actions builds, tests and publishes to Pages on every push to `main`. A
  second workflow pings the database twice a week so the free project never pauses.
- **Domain**: `plantas.marioconti.com.ar`, a `CNAME` to `marioconti.github.io` in Cloudflare
  (DNS only, grey cloud) plus the custom domain set in the repository's Pages settings. The
  tags hold this address, so it must not change; `SITE_URL` and Vite's `base: '/'` follow it.

```sh
npm install
npm run dev          # http://localhost:5173/
npm test             # due dates, seasons, urgency, regularity
npm run build
node tools/qa.mjs    # screenshots of every screen at 320, 390 and 1280 against a fake garden
```

## Writing a tag

1. Install **NFC Tools** (wakdev), free on iPhone and Android.
2. In *Ajustes → Links de los tags*, copy the plant's link.
3. In NFC Tools, write a record of type **URL** with that link to the tag.
4. Hold the tag to the top edge of an iPhone, or the middle of the back of an Android phone,
   with the screen unlocked. The plant's page opens.

Do not make the tag read-only: it cannot be undone, and the link may need to change some day.
A plant can be set up before its tag: a link to an unknown plant offers to create it.

## Installing it on the home screen

Not required, everything works in the browser. To have it one tap away:

- **iPhone (Safari)**: Share → *Add to Home Screen*.
- **Android (Chrome)**: menu ⋮ → *Add to Home screen*.

On iPhone the home-screen copy and Safari keep separate storage: open your pass link once in
each.

## Care data

`src/data/species.json` is curated by hand, not scraped. Fields that no source confirmed are
`null` and listed in `unverified`, and the page says so. `tools/species-photos.mjs` refreshes
the photo credits after adding species.
