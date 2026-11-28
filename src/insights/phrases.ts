// Insight wording (RA-45, option A): Findings → sentences from a fixed phrase table. No AI, no network.
// Daily edition: the phrasing choice is seeded by date + insight, so the text is stable all day and changes tomorrow.
// Voice: fact + what it usually means; never a verdict, never advice; health stays careful (nothing medical).
// These lists are the only words that can appear. Option B (an LLM) would replace word() and keep BANNED as its output check.
// Pure — `node src/insights/phrases.check.ts`.
import type { Direction, Finding, InsightKey } from './rules.ts'

type ByDir = Partial<Record<Direction, string[]>>
export interface Entry {
  label: string        // eyebrow: `${label} · ${values.period}`
  subject?: string[]   // headline = subject + change + time …
  change?: ByDir
  time?: ByDir
  whole?: ByDir        // … or a whole sentence (number-first variants)
  meaning?: ByDir      // what it usually means (left out where it adds nothing)
  guideline?: string   // fixed text about people in general; source in a comment
}
export interface Worded { eyebrow: string; headline: string; meaning?: string; guideline?: string }

/** Whole words never allowed in insight text (also the output check for a future LLM). */
export const BANNED = ['should', 'need', 'needs', 'must', 'good', 'bad', 'great', 'poor', 'risk', 'warning', 'danger',
  'injury', 'illness', 'sick', 'healthy', 'unhealthy', 'recommend', 'try'] as const

const WEEK = ['this week', 'over the last 7 days', 'in the past week']
const WEEK_STEADY = ['this week', 'over the last 7 days', 'again this week']
const LOAD_TIME = ['your 4-week average', 'the 4 weeks before', 'your recent weekly average']
const same = (xs: string[]): ByDir => ({ up: xs, down: xs, steady: xs })

export const PHRASES: Record<InsightKey, Entry> = {
  // ─── running ───────────────────────────────────────────────────────────────
  efficiency: {   // down = pace number down = quicker
    label: 'EFFICIENCY',
    subject: ['Your easy pace', 'Pace on your Z2 runs', 'Your pace at Z2 heart rate', 'Your Z2 pace'],
    change: {
      down: ['is {delta} quicker', 'is {delta} faster', 'comes in {delta} quicker'],
      up: ['is {delta} slower', 'comes in {delta} slower'],
      steady: ['has held at {to}', 'has stayed around {to}', 'has been steady at {to}'],
    },
    time: {
      down: ['than 3 months ago', 'than in {then}', 'than it was in {then}'],
      up: ['than 3 months ago', 'than in {then}', 'than it was in {then}'],
      steady: ['since {then}', 'over the last 3 months', 'for 3 months now'],
    },
    whole: {
      down: ['{delta} quicker at the same heart rate than in {then}', 'Same heart rate, {delta} quicker than in {then}', 'Your Z2 runs are {delta} quicker than 3 months ago'],
      up: ['{delta} slower at the same heart rate than in {then}', 'Same heart rate, {delta} slower than in {then}'],
      steady: ['Same heart rate, same pace as in {then}: {to}', 'Z2 pace steady at {to} for 3 months'],
    },
    meaning: {
      down: ['This usually means your aerobic base is growing.', 'Running quicker at the same effort is a common sign of aerobic fitness building up.'],
      up: ['Heat, hills, tiredness or a break in training often show up this way.', 'Pace at the same heart rate often drifts in hot weather or after time off.'],
    },
  },
  z2Share: {
    label: 'Z2 SHARE',
    subject: ['Z2 running', 'Your time in Z2', 'Running in Z2'],
    change: {
      up: ['made up {to} of your running', 'rose to {to}', 'climbed to {to}', 'reached {to}'],
      down: ['made up {to} of your running', 'fell to {to}', 'dropped to {to}', 'slipped to {to}'],
      steady: ['made up {to} of your running', 'held at {to}', 'stayed near {to}'],
    },
    time: {
      up: ['in the last 30 days, up from {from}', 'over the past month, up from {from}', 'this month, from {from} before'],
      down: ['in the last 30 days, down from {from}', 'over the past month, down from {from}', 'this month, from {from} before'],
      steady: ['in the last 30 days, like the month before', 'over the past month', 'again this month'],
    },
    whole: {
      up: ['{to} of your running was in Z2, up from {from}', 'Z2 is up {delta}, to {to} of your running'],
      down: ['{to} of your running was in Z2, down from {from}', 'Z2 is down {delta}, to {to} of your running'],
      steady: ['{to} of your running was in Z2, about the same as the month before'],
    },
    meaning: {
      up: ['More easy running usually means more aerobic base work.', 'A bigger share of easy running is typical of base-building blocks.'],
      down: ['More of your running was at higher heart rates.', 'Harder sessions, races or heat often lower the Z2 share.'],
    },
    // Polarised / "80/20" endurance training convention (Seiler); a training convention, not a health guideline.
    guideline: 'Many endurance training plans keep about 80% of running easy.',
  },
  load: {
    label: 'LOAD',
    subject: ["This week's training load", 'Your load for the last 7 days', 'Your 7-day load'],
    change: {
      up: ['is {pct} above', 'runs {pct} over', 'sits {pct} higher than'],
      down: ['is {pct} below', 'runs {pct} under', 'sits {pct} lower than'],
      steady: ['is in line with', 'matches', 'is close to'],
    },
    time: same(LOAD_TIME),
    whole: {
      up: ['{pct} more load this week than your 4-week average', 'A heavier week: load {pct} above your 4-week average'],
      down: ['{pct} less load this week than your 4-week average', 'A lighter week: load {pct} below your 4-week average'],
      steady: ['A typical week: load close to your 4-week average', 'Load right at your 4-week average this week'],
    },
    meaning: {
      up: ['Load is running time weighted by heart-rate zone, so longer or harder weeks both raise it.', 'Heavier weeks like this are common when mileage or intensity steps up.'],
      down: ['Lighter weeks often come with rest, travel or an easier block.'],
    },
  },
  longest: {
    label: 'LONGEST RUN',
    subject: ['Your longest run in 30 days', 'Your longest recent run', 'Your longest run of the last 30 days'],
    change: { record: ['was {km}', 'came to {km}', 'reached {km}'], steady: ['was {km}', 'came to {km}'] },
    time: {
      record: ['on {day}, your longest since {since}', ', the longest since {since}', 'on {day}: your longest since {since}'],
      steady: ['', ', on {day}'],
    },
    whole: {
      record: ['{km} on {day}, your longest since {since}', 'Longest run since {since}: {km} on {day}', 'A new longest run since {since}: {km}'],
      steady: ['{km} on {day} was your longest run in 30 days', 'Longest run in 30 days: {km}'],
    },
    meaning: { record: ['A new longest run often marks a step up in endurance.', 'Longer runs are a common way endurance builds over a season.'] },
  },
  streak: {
    label: 'CONSISTENCY',
    whole: {
      streak: ['{target} every week for {weeks} weeks', '{weeks} weeks in a row with {target}', '{weeks} straight weeks of {target}',
        "You've run {weeks} weeks in a row with {target}", 'Week {weeks} in a row with {target}'],
      steady: ['Your usual week: {perWeek}', 'About {perWeek} a week over the last 8 weeks', 'Your running week has been about {perWeek} lately'],
    },
    meaning: { streak: ['Regular weeks are how fitness usually builds.', 'Consistency over weeks tends to matter more than any single run.'] },
  },
  hrMax: {
    label: 'HIGHEST HR',
    subject: ['Your highest heart rate this month', 'Your top heart rate in {month}', "This month's highest heart rate"],
    change: same(['is {now}', 'reached {now}', 'hit {now}']),
    time: {
      up: [', up from {prev} in the 3 months before', ', above the {prev} of the 3 months before', ', {delta} over the 3 months before'],
      down: [', down from {prev} in the 3 months before', ', below the {prev} of the 3 months before', ', {delta} under the 3 months before'],
      steady: [', close to the {prev} of the 3 months before', ', about the same as the 3 months before'],
    },
    meaning: {
      up: ['The highest heart rate in a month mostly reflects your hardest effort that month.'],
      down: ['Months without races or hard sessions usually show a lower top heart rate.'],
    },
  },
  // ─── health ────────────────────────────────────────────────────────────────
  restingHr: {
    label: 'RESTING HR',
    subject: ['Your resting HR', 'Resting heart rate', 'Your heart rate at rest'],
    change: {
      up: ['is {delta} above your normal', 'is up {delta}', 'averaged {now}, up from {normal}'],
      down: ['is {delta} below your normal', 'is down {delta}', 'averaged {now}, down from {normal}'],
      steady: ['is right at your normal of {normal}', 'has held near {normal}', 'is close to your usual {normal}'],
    },
    time: { up: WEEK, down: WEEK, steady: WEEK_STEADY },
    whole: {
      up: ['{now} resting HR this week, against a normal of {normal}', 'Resting HR up {delta} on your normal this week'],
      down: ['{now} resting HR this week, below your normal of {normal}', 'Resting HR down {delta} on your normal this week'],
      steady: ['Resting HR steady at {now} this week'],
    },
    meaning: {
      up: ['Resting HR often rises with short sleep, stress, heat or a hard training block.', 'A higher resting HR for a few days is common after hard weeks or short nights.'],
      down: ['Resting HR often drifts lower as aerobic fitness builds.', 'A lower resting HR is common after rest days and steady training.'],
    },
  },
  hrv: {
    label: 'HRV',
    subject: ['Your HRV', 'Heart rate variability', 'Your heart rate variability'],
    change: {
      up: ['is {pct} above your normal', 'is up {pct}', 'averaged {now}, up from {normal}'],
      down: ['is {pct} below your normal', 'is down {pct}', 'averaged {now}, down from {normal}'],
      steady: ['is close to your normal of {normal}', 'has held near {normal}', 'is right at your usual {normal}'],
    },
    time: { up: WEEK, down: WEEK, steady: WEEK_STEADY },
    whole: {
      up: ['HRV {pct} above your normal this week'],
      down: ['HRV {pct} below your normal this week', 'HRV averaged {now} this week, under your normal of {normal}'],
      steady: ['HRV steady at {now} this week'],
    },
    meaning: {
      up: ['Higher HRV than usual is often seen after rest and easy days.'],
      down: ['HRV often dips after hard sessions, short sleep, stress or alcohol.', 'A lower HRV for a few days is common after hard training or short nights.'],
      steady: ['HRV moves a lot from day to day; the weekly average is the steadier view.'],
    },
  },
  sleep: {
    label: 'SLEEP',
    subject: ['Your sleep', 'Sleep', 'Your time asleep'],
    change: {
      down: ['averaged {now} h a night, {delta} less than usual', 'came to {now} h a night, {delta} under your normal', 'was {delta} shorter than usual, at {now} h a night'],
      up: ['averaged {now} h a night, {delta} more than usual', 'came to {now} h a night, {delta} over your normal', 'was {delta} longer than usual, at {now} h a night'],
      steady: ['averaged {now} h a night, close to your normal', 'held near your usual {normal} h', 'came to {now} h a night, as usual'],
    },
    time: same(['this week', 'over the last 7 nights', 'in the past week']),
    whole: {
      down: ['{delta} less sleep a night than usual this week', 'You slept {now} h a night this week, {delta} less than usual'],
      up: ['{delta} more sleep a night than usual this week', 'You slept {now} h a night this week, {delta} more than usual'],
      steady: ['You slept about {now} h a night this week, close to your normal'],
    },
    meaning: {
      down: ['Shorter nights often show up in resting HR and HRV a day or two later.'],
      up: ['Longer nights are common in easier weeks or after a hard block.'],
    },
    // CDC / American Academy of Sleep Medicine: adults 18–60, 7 or more hours per night.
    guideline: 'Adults are generally advised to get 7 or more hours of sleep a night.',
  },
  steps: {
    label: 'STEPS',
    subject: ['Your daily steps', 'Your average steps', 'Your step count'],
    change: {
      up: ['averaged {now}, up {pct}', 'rose {pct} to {now} a day', 'climbed to {now} a day'],
      down: ['averaged {now}, down {pct}', 'fell {pct} to {now} a day', 'dropped to {now} a day'],
      steady: ['averaged {now}', 'held near {now} a day', 'stayed around {now} a day'],
    },
    time: {
      up: ['this month', 'over the last 30 days', 'in the past month'],
      down: ['this month', 'over the last 30 days', 'in the past month'],
      steady: ['this month, like the month before', 'over the last 30 days', 'again this month'],
    },
    whole: {
      record: ['Your most active month since {since}: {now} steps a day', '{now} steps a day, your highest 30 days since {since}', 'The most steps since {since}: {now} a day'],
      recordLow: ['Your quietest month since {since}: {now} steps a day', '{now} steps a day, your lowest 30 days since {since}', 'The fewest steps since {since}: {now} a day'],
    },
    meaning: {
      up: ['Steps include your runs, so running weeks raise this too.'],
      down: ['Fewer steps often come with less running, travel or desk-heavy weeks.'],
      record: ['Steps include your runs, so running weeks raise this too.'],
    },
  },
  vo2max: {
    label: 'VO2MAX',
    subject: ['Your VO2max', 'Cardio fitness (VO2max)', 'Your VO2max estimate'],
    change: {
      up: ['rose from {from} to {to}', 'went up {delta} to {to}', 'climbed to {to}'],
      down: ['fell from {from} to {to}', 'went down {delta} to {to}', 'dropped to {to}'],
      steady: ['has held at {to}', 'has stayed near {to}', 'has been steady at {to}'],
    },
    time: same(['over 3 months', 'in the last 3 months', 'since {since}']),
    meaning: {
      up: ['Apple Watch estimates VO2max from outdoor walks and runs; a rise usually means cardio fitness is building.'],
      down: ['VO2max estimates move with training volume, heat and how many outdoor runs Apple Watch saw.'],
    },
  },
  stepsRunDays: {
    label: 'STEPS ON RUNNING DAYS',
    whole: {
      up: ['You take {delta} more steps on days you run', '{delta} more steps on running days than on other days', 'Running days: {run} steps. Other days: {rest} steps'],
      down: ['You take {delta} fewer steps on days you run', '{delta} fewer steps on running days than on other days', 'Running days: {run} steps. Other days: {rest} steps'],
      steady: ['About the same steps on running and other days: {run} vs {rest}', 'Running days and other days come out close: {run} vs {rest} steps', 'Similar step counts with or without a run: {run} vs {rest}'],
    },
    meaning: {
      up: ['Most of the difference is the run itself.', 'The run itself accounts for most of the gap.'],
      down: ['Other days are more active than running days, outside the run.'],
    },
  },
  sleepBeforeSlow: {   // a link in the data, never a cause
    label: 'SLEEP BEFORE SLOW RUNS',
    whole: {
      down: ['On nights before slower runs you slept {delta} less', 'Slower runs came after nights {delta} shorter than usual', 'Nights before your slower runs: {slow} h. Before the others: {other} h'],
      up: ['On nights before slower runs you slept {delta} more', 'Slower runs came after nights {delta} longer than usual', 'Nights before your slower runs: {slow} h. Before the others: {other} h'],
      steady: ['You sleep about the same before slow and quick runs', 'Sleep before slower runs: {slow} h, close to {other} h before the others', 'Slow or quick, the night before looks the same: about {other} h'],
    },
    meaning: { down: ['This shows a link in your data, not a cause.'], up: ['This shows a link in your data, not a cause.'] },
  },
  // ─── merged cards (rank.ts) ────────────────────────────────────────────────
  restingHrSleep: {
    label: 'RESTING HR + SLEEP',
    whole: {
      up: ['Resting HR is up {a.delta} on a week you slept {b.delta} less a night', 'A week of {b.now} h nights, and resting HR {a.delta} above your normal',
        'Shorter nights and a higher resting HR this week: {b.delta} less sleep, {a.delta} more'],
    },
    meaning: { up: ['The two often move together after short nights.', 'Sleep and resting HR tend to move together.'] },
  },
  loadHrv: {
    label: 'LOAD + HRV',
    whole: {
      up: ['Load is {a.pct} above your average on a week HRV is {b.pct} below normal', 'A heavier week ({a.pct} more load) and HRV {b.pct} under your normal',
        'More load, lower HRV: {a.pct} up, {b.pct} down this week'],
    },
    meaning: { up: ['HRV often dips during harder training weeks.'] },
  },
}

// ─── engine ──────────────────────────────────────────────────────────────────

/** djb2: a small stable string hash (same input → same number on every device). */
export function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0
  return h
}
const fill = (t: string, v: Record<string, string>) => t.replace(/\{([\w.]+)\}/g, (m, k: string) => v[k] ?? m)
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/ ([,:])/g, '$1').trim()
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
export const opening = (h: string) => h.toLowerCase().split(' ').slice(0, 2).join(' ')

/** Every headline template for one insight + direction, shuffled by seed: 2 slot sentences, then 1 whole sentence, repeating. */
export function candidates(e: Entry, d: Direction, seed: string): string[] {
  const mix = (xs: string[]) => [...xs].sort((a, b) => hash(seed + a) - hash(seed + b))
  const combos = mix((e.subject ?? []).flatMap(s => (e.change?.[d] ?? []).flatMap(c => (e.time?.[d] ?? ['']).map(t => `${s} ${c} ${t}`))))
  const whole = mix(e.whole?.[d] ?? [])
  const out: string[] = []
  while (combos.length || whole.length) { out.push(...combos.splice(0, 2)); if (whole.length) out.push(whole.shift()!) }
  return out
}

/** Word one finding for `date`. `used` = openings already taken today (wordAll); `force` = a template (tests). */
export function word(f: Finding, date: string, used: Set<string> = new Set(), force?: string): Worded {
  const e = PHRASES[f.key], seed = date + f.key
  const opts = (force ? [force] : candidates(e, f.direction, seed)).map(t => cap(tidy(fill(t, f.values))))
  const headline = opts.find(h => !used.has(opening(h))) ?? opts[0] ?? ''
  used.add(opening(headline))
  const ms = e.meaning?.[f.direction] ?? []
  return {
    eyebrow: `${e.label} · ${f.values.period ?? ''}`,
    headline,
    meaning: ms.length ? fill(ms[hash(seed + 'm') % ms.length], f.values) : undefined,
    guideline: e.guideline,
  }
}

/** Word a whole feed in order, so no two cards open the same way. */
export function wordAll(fs: Finding[], date: string): Map<InsightKey, Worded> {
  const used = new Set<string>(), out = new Map<InsightKey, Worded>()
  for (const f of fs) out.set(f.key, word(f, date, used))
  return out
}
