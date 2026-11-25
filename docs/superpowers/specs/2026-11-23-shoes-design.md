# RA-8 Shoes Collection — Design

Date: 2026-11-23 · Branch: `feature/shoes` (stacked on `feature/run-type`, RA-39) · Jira: RA-8
Mockups (gitignored): `.superpowers/brainstorm/277-1795469311/content/` (`shoe-alert.html`, `add-and-pick.html`)

## Goal

Track each pair of shoes and how far it has run, so the user knows when to replace it. Shoes are picked per run; each run type can have a default shoe that new runs of that type get automatically.

## Scope

In: brand/model catalogue (own Supabase tables, 21 brands, 284 models), brand logos, shoe colour, add/edit/retire shoes, past-runs assignment, shoe per run, default shoe per run type, distance meter, 90% and 100% alerts, shoe stats page.

Out (later): shoe photos (user photo and catalogue images), adding user-typed models to the shared catalogue, filtering runs by shoe (ticket says no), km/mi (RA-6; km only, like the rest of the app).

## Data

### Per user (synced through the outbox, works offline)

`shoes` — new table, cloud + SQLite (same column names):

| column | type | notes |
|---|---|---|
| `id` | uuid | PK, made on the phone (`Crypto.randomUUID()`), like `run_types` |
| `user_id` | uuid | cloud only, `auth.uid()` default, RLS own rows |
| `brand` | text not null | catalogue name or typed by the user |
| `model` | text not null | catalogue name or typed |
| `name` | text null | user's own label ("Pegasus 42 race pair"); display falls back to `model` |
| `color` | text null | one of the colour keys below; shown as a dot; display name without `name` becomes "Pegasus · Orange" |
| `in_use_from` | date not null | default today |
| `limit_km` | double not null | prefilled from the catalogue's recommended km, editable |
| `extra_km` | double not null default 0 | distance not covered by assigned runs (see Past runs) |
| `retired` | boolean not null default false | |
| `alert_level` | int not null default 0 | highest alert already popped up: 0, 90 or 100 |
| `card_dismissed` | int not null default 0 | highest level whose Dashboard card was dismissed: 0, 90 or 100 |
| `updated_at` | timestamptz | sync |

`runs.shoe_id` — new nullable column (one shoe per run).
`run_types.default_shoe_id` — new nullable column. A type has at most one default by construction.

SQLite goes to **v9**: one block adding the `shoes` table and the two columns, checking real columns like v8 does (`hasColumn`). `supabase/schema.sql` updated, one migration `supabase/migrations/2026-11-24-shoes.sql` + the generated seed `2026-11-24-shoe-catalogue.sql` (Bar runs both in the SQL Editor **before** opening the new code). `queries.ts` column lists and `merge.ts` (`rowToRun` / `runToRow`) get the new fields; shoes get their own row ↔ object mapping.

### Catalogue (shared, read-only for the app)

- `shoe_brands (id, name unique, sort int)`
- `shoe_models (id, brand_id → shoe_brands, name, recommended_km int, unique (brand_id, name))`
- RLS: `select` for `authenticated`; no insert/update/delete policies (written only from the SQL Editor).
- Model names carry **no version numbers** ("Pegasus", not "Pegasus 41"), so the list doesn't age every year.
- Seeded by the same migration with the starter list (Appendix), which Bar reviews first.
- Logos: public Storage bucket `brand-logos`, file name = brand name in lowercase with non-letters as `-` (`nike.png`, `new-balance.png`, `inov-8.png`, `la-sportiva.png`). The PNGs live in `assets/brand-logos/` (256×256, original colours, trimmed and centred on white; from the brands' Wikipedia/Commons logos, 2026-11-25) and are uploaded to the bucket by hand; the app shows them on a white circle. The name is derived, so a shoe needs no catalogue lookup to show its logo, and a typed brand that matches gets it too. Image fails to load → the brand's initials in a circle. React Native's `Image` loads the URL — no native package, no new dev build.
- The app fetches the catalogue only when Add shoe opens (`src/api/shoes.ts`; only `src/api/` imports Supabase). Offline or on error: brand and model are typed by hand. The catalogue is not stored in SQLite.

### Computed, never stored

- **Shoe distance** = sum of `distanceKm` of the shoe's runs (the same run values the screens show, edits applied) + `extra_km`.
- **Percent** = distance / `limit_km`. **Level** = 100 if ≥ 100%, 90 if ≥ 90%, else 0.
- Stats: run count, average pace (total time / total distance of its runs), last used (latest run date).

All pure, in `src/shoes/` (self-check `node src/shoes/shoes.check.ts`).

**Shoe colours** (for several pairs of the same model): `black, white, grey, red, orange, yellow, green, blue, purple, pink, multi` — fixed list of swatches in `src/shoes/`, hex values in `tokens.ts`; `multi` draws a split dot.

## Screens

- **Settings → My Shoes** (new row, `app/shoes/index.tsx`): active shoes — logo (or initials) with the colour dot, display name, brand + model, "default: Easy, Long Run", meter `312 / 700 km` (JetBrains Mono); meter and a `92%` tag turn orange (`iconOrange`) from 90%. "+" opens Add shoe. "Retired (n) ›" at the bottom opens the retired list (same rows, no meter colour).
- **Add / Edit shoe** (`app/shoes/edit.tsx`):
  - Brand: list with logos, last item **"Other…"** → text field.
  - Model: that brand's models, last item **"Other…"** → text field. A typed brand has no list: model is typed directly.
  - Colour (optional): a row of swatches, tap again to clear.
  - Name (optional), In use from (Today default, date picker), Limit km (prefilled with the model's recommended km, hint "Recommended for Pegasus: 700 km"; a model typed with "Other…" gets 700 km, hint "Typical for running shoes: 700 km"). The prefill is always editable, lower or higher; picking another model refills it only if the user hasn't typed their own number. Edit shows the saved limit.
  - Edit: same form, plus Retire / Un-retire at the bottom. Editing the limit so the level drops lowers `alert_level` / `card_dismissed` to the new level (so alerts can fire again later).
- **Past runs** (`app/shoes/past-runs.tsx`): after saving a **new** shoe whose `in_use_from` is before today and there are runs since that date **with no shoe**. Lists them all ticked; the user unticks. Below: "Distance on this shoe: 312 km — from 7 runs", editable. Done → assigns the ticked runs and stores `extra_km = typed − sum(ticked runs)` (never below 0). Skipped if no such runs.
- **Shoe page** (`app/shoes/[id].tsx`): meter, total distance, runs, average pace, last used, default for which types, Edit.
- **Default for which runs?** (`app/shoes/defaults.tsx`, Bar 2026-11-24): checklist of run types, ticked = new runs of that type get this shoe (only future runs; past runs never change). A type defaulting to another shoe shows "now: X" / "replaces X". Shown after adding a shoe (before the past-runs step) and after changing the shoe on a run (that run's type pre-ticked). Skip changes nothing. Edit shoe has a "Default for" row (lists the types) that opens the same checklist to add/remove defaults later.
- **Run Detail:** "Shoe" row under "Type" → picker of active shoes + "No shoe". Picking a different shoe opens the checklist above.
- **Delete** (Edit screen, or swipe a row left in My Shoes → red Delete, hidden until swiped like iOS Music; swiping past half the row stretches the red and asks to delete on release; Bar 2026-11-24): for a shoe added by mistake. Confirm → its runs and type defaults lose it, the row is removed (outbox `delete` op; cloud FKs `on delete set null`). Retire is still the way to keep history. Known limit: no tombstone, so a second signed-in device keeps the deleted shoe until it logs out/in (single-phone use is fine).
- **Dashboard:** orange card for each active shoe whose level > `card_dismissed`: "**Fresh Foam 1080** is at 92% · 644 / 700 km — time to get a new pair" (at 100%: "has reached its limit"), ✕ dismiss (sets `card_dismissed` = level), "Retire" link.
- **Pop-ups:** when an active shoe's level rises above `alert_level`:
  - 90%: "[shoe] is at 92% of its limit (644 / 700 km). Time to get a new pair." — OK.
  - 100%: "[shoe] has reached its limit (702 / 700 km)." — **Retire** / **Close**.
  - Then `alert_level` = level. One pop-up per level per shoe (synced, so not repeated on another phone).

## Rules

1. **Default fills empty shoes only.** `setType(ids, typeId)` (Dashboard card, Run Detail, bulk Set type) also sets `shoe_id` = the type's default shoe on runs that have no shoe, if that default is active. It never replaces an existing shoe.
2. Changing the shoe on one run never changes the default.
3. **Retire** clears `default_shoe_id` on every type that points to the shoe; its runs keep it; it leaves the picker and the default prompt; no alerts for retired shoes. Un-retire brings it back (defaults are not restored).
4. **Alert check** (`checkShoeAlerts()` in the shoe store) runs after anything that can raise a shoe's distance: setting a shoe on a run, `setType` (default fill), the past-runs step, saving a shoe (extra km / limit). It shows at most one pop-up (the highest new level of the first shoe found) and records it.
5. All writes go through `writeChange(...)` then `syncNow()`, like runs and profiles.

## Error handling

- Catalogue fetch fails / offline → Add shoe shows the typed brand + model fields directly with a one-line note ("Catalogue unavailable — type brand and model").
- Logo URL fails → initials.
- A migration missing in the cloud would mark pushes `failed` for good (known outbox behaviour) → the migration must run before the new build opens (stated in the plan and handoff).

## Testing

- `node src/shoes/shoes.check.ts`: distance (runs + extra, edits applied), percent/level edges (89.9 / 90 / 100), alert decisions (pop-up and card vs `alert_level` / `card_dismissed`, retired → none, limit raised → levels lowered), default fill (empty shoe filled, existing shoe kept, retired default ignored, no default → none), past-runs `extra_km` (never negative).
- `node src/db/sync.check.ts`: round-trip cases for `shoes` rows and `runs.shoe_id` / `run_types.default_shoe_id`.
- tsc clean; existing checks still pass.
- Device test (Bar): add a catalogue shoe and an "Other…" shoe; past runs + edited distance; pick on Run Detail + default prompt; set type on a new run → default shoe filled; 90% pop-up + card (lower a limit to trigger), 100% pop-up → Retire; retired list; offline add; second account sees none of the first account's shoes.

## Appendix — starter catalogue (for Bar's review)

Sources (2026-11-23): brand sites where they allowed reading (Nike, Saucony, Puma, Topo Athletic); the others blocked automated reads (403 / 404 / empty pages), so their lists come from RunRepeat's per-brand catalogues (`runrepeat.com/catalog/<brand>-running-shoes`). Karhu could not be read anywhere (rate limit / 404) — its list is from general knowledge. Review catalogues include some older families that may no longer be sold; harmless in a picker.

**Recommended km by kind of shoe** (typical lifespans, not brand figures — most brands publish none; editable per shoe): max-cushion **750** · daily / stability **700** · trail **650** · tempo **550** · race (carbon plate) **400**. Each model is stored with the km of its kind.

| Brand | 750 max-cushion | 700 daily / stability | 650 trail | 550 tempo | 400 race |
|---|---|---|---|---|---|
| Nike | Vomero, Vomero Plus, Vomero Premium | Pegasus, Pegasus Plus, Pegasus Premium, Winflo, Free RN, Structure, Structure Plus | Pegasus Trail, Kiger, Wildhorse, ACG Zegama, Ultrafly | Zoom Fly, Streakfly | Vaporfly, Alphafly |
| Adidas | Ultraboost | Supernova Rise, Supernova Prima, Supernova Solution, Adizero Boston, Adizero SL, Hyperboost | Terrex Agravic Speed Ultra, Terrex Agravic SL, Adizero EVO SL ATR | Adizero EVO SL, Adizero Adios | Adizero Adios Pro, Adizero Adios Pro Evo, Adizero Prime X, Adizero Takumi Sen |
| ASICS | Gel-Nimbus, Superblast, Megablast | Gel-Cumulus, Novablast, Gel-Pulse, Gel-Kayano, GT-2000, Noosa Tri | Gel-Trabuco | Magic Speed, Sonicblast | Metaspeed Sky, Metaspeed Edge, Metaspeed Ray |
| Brooks | Glycerin, Glycerin Max, Ghost Max | Ghost, Ghost Amp, Launch, Revel, Revel Max, Trace, Glycerin GTS, Adrenaline GTS, Addiction GTS, Beast GTS, Hyperion GTS | Cascadia, Cascadia Elite, Caldera, Catamount, Ghost Trail | Hyperion, Hyperion Tempo, Hyperion Max | Hyperion Elite |
| Hoka | Bondi, Gaviota, Skyward X, Stinson | Clifton, Skyflow, Arahi | Speedgoat, Tecton X, Rocket X Trail, Mafate, Mafate Speed, Challenger, Torrent, Zinal | Mach, Mach X, Rincon, Clifton Pro | Rocket X, Cielo X1, Carbon X |
| New Balance | Fresh Foam X 1080, Fresh Foam X More | Fresh Foam X 880, Fresh Foam X 860, Fresh Foam 680, Fresh Foam X Evoz, Fresh Foam X Balos, Fresh Foam X Vongo, Fresh Foam Roav, Fresh Foam X Kaiha Road, FuelCell Propel, DynaSoft Nitrel | Fresh Foam X Hierro, Fresh Foam X More Trail, Fresh Foam Arishi, Fresh Foam X Garoe, FuelCell Rebel Trail, FuelCell SuperComp Trail, Minimus Trail, MT10, 510, Tektrel | FuelCell Rebel, Fresh Foam X Tempo, FuelCell SuperComp Trainer, FuelCell SuperComp Pacer | FuelCell SuperComp Elite, SuperComp Rebel |
| Saucony | Triumph, Endorphin Azura, Paramount Max | Ride, Echelon, Axon, Guide, Hurricane, Tempus | Peregrine, Xodus, Ride TR, Guide TR, Endorphin Trail | Endorphin Speed, Kinvara | Endorphin Pro, Endorphin Elite |
| On | Cloudmonster, Cloudboom Max, Cloudultra | Cloudsurfer, Cloudrunner, Cloudstratus, Cloudflyer, Cloudeclipse, Cloudswift, Cloudgo | Cloudsurfer Trail, Cloudvista | Cloudflow, Cloudboom Echo | Cloudmonster Hyper, Cloudboom Strike |
| Mizuno | Wave Sky, Neo Zen | Wave Rider, Wave Inspire, Wave Horizon, Neo Vista | Wave Daichi, Wave Mujin | Wave Rebellion Flash | Wave Rebellion Pro |
| Puma | MagMax Nitro, Magnify Nitro | Velocity Nitro, ForeverRun Nitro, Deviate Pure Nitro | Voyage Nitro, Fast-Trac Nitro, Deviate Nitro Elite Trail | Deviate Nitro | Deviate Nitro Elite, Fast-R Nitro Elite, Fast-FWD Nitro Elite |
| Altra | Torin, Paradigm | Experience Flow, Experience Form, FWD Via, Escalante, Provision | Lone Peak, Olympus, Timp, Experience Wild, Mont Blanc Carbon, Superior, Outroad | Escalante Racer, Vanish Pulse, Rivera | Vanish Carbon |
| Salomon | Ultra Glide, Ultra Flow | Aero Glide | Aero Glide GRVL, Sense Ride, Genesis, Speedcross, Thundercross, Pulsar Trail, Spectur | Aero Blaze | S/Lab Phantasm, S/Lab Genesis, S/Lab Spectur, S/Lab Ultra Glide, S/Lab Ultra, S/Lab Pulsar |
| Under Armour | Infinite | HOVR Sonic, HOVR Phantom, Surge, Charged Assert, Charged Pursuit, Machina | | Velociti | Infinite Elite, Infinite Pro, Velociti Elite |
| Reebok | | Floatride Energy, FloatZig, Zig Dynamica, Lite | | | |
| Skechers | GOrun Max Road, Max Cushioning Elite | GOrun Ride | | Aero Burst, Aero Tempo | Aero Elite, Aero Razor |
| Topo Athletic | Aura, Atmos | Phantom, Ultrafly, Fli-Lyte, Cyclone | Ultraventure, Terraventure, Trailventure, MTN Racer, Pursuit, Vista, Connect, Traverse | Specter, ST, Magnifly | Specter Elite |
| Karhu | | Ikoni, Fusion, Synchron | Ikoni Trail | Mestari | |
| Inov-8 | | Roadfly | Trailfly, Trailfly Max, Trailfly Zero, Trailfly Speed, Trailtalon, Roclite, Parkclaw, Mudtalon | | |
| Diadora | | Nucleo, Cellula, Atomo, Frequenza | | Mythos | Gara |
| Merrell | | | Agility Peak, Nova, Trail Glove, MTL SpeedArc Peak, Morphlite, Antora | | |
| La Sportiva | | | Prodigio, Prodigio Pro, Prodigio Max, Mutant | | |

21 brands, 284 models. Brand order in the picker = table order (`shoe_brands.sort`); models alphabetical; "Other…" last in both.
