# The training chart: how to update it

The "Training hours per week" chart in the racing section of `index.html` is drawn by
`training-chart.mjs` from the numbers in `training-weeks.csv`. You change the CSV, run the
script, and the script redraws the chart. Never edit the chart in `index.html` by hand: the
next run overwrites everything between the `training-chart:start` and `training-chart:end`
markers.

```
tools/
  training-weeks.csv     the numbers: one row per week
  training-chart.mjs     draws the chart into index.html
  README.md              this file
```

## What you need

Node 18 or later. Nothing to install: the script uses no packages. Check with:

```
node --version
```

## Every week (or every few weeks)

Only add weeks that are over. A week runs Monday to Sunday, so add it on Monday or later.

### 1. Work out the week's minutes

For each sport group, add up the **moving time** of that week's Strava activities and write
it in **whole minutes**:

| column      | Strava sport types                                      |
|-------------|---------------------------------------------------------|
| `ride_min`  | Ride, MountainBikeRide, GravelRide, VirtualRide, EBikeRide |
| `run_min`   | Run, TrailRun, VirtualRun                               |
| `other_min` | everything else: gym, hikes, rowing, walks, mobility    |

Two things to watch:

- **A session recorded twice counts once.** An indoor ride saved by both the Karoo and
  MyWhoosh shows up as two activities at the same time. Use one of them.
- **Hours to minutes:** 1 h 25 min is 85. 10.5 h is 630.

The easy way is to ask Claude in this folder: *"add last week to the training chart"*. It
reads Strava through the connector and adds the rows for you.

### 2. Add a row to the end of `training-weeks.csv`

The first column is the week's **Monday**, written year-month-day:

```
week,ride_min,run_min,other_min
...
2026-11-02,372,64,177
2026-11-09,600,60,120
```

Rules the script checks:

- one row per week, in order, with no week missing (a week with no training is `0,0,0`)
- the date is a Monday
- three whole numbers, none empty or negative

Lines starting with `#` are notes and are ignored.

### 3. Run the script

From the top folder of the site (the one with `index.html`):

```
node tools/training-chart.mjs
```

It prints a summary and whether it changed the page:

```
45 weeks: 423 hours from 5 January to 15 November: 9.4 a week on average, ...
index.html updated
```

`index.html already up to date` means nothing changed.

### 4. Look at it

Open the page in a browser and look at the chart, on a phone-sized window too. To see the
page as the live site does:

```
python3 -m http.server 8000
```

then open http://localhost:8000 and stop the server with Ctrl+C when you're done.

### 5. Publish

```
git add tools/training-weeks.csv index.html
git commit -m "Training chart: weeks to 15 November"
git push
```

GitHub Pages updates the live site a minute or two after the push.

## When the script stops or warns

If something is wrong with the data, the script stops **without touching `index.html`** and
says which line of the CSV is at fault:

| message | what to do |
|---|---|
| `line 21: 2026-03-10 is not a Monday` | use that week's Monday |
| `line 21: minutes must be three whole numbers` | fix the numbers on that line: no blanks, decimals or minus signs |
| `week 2026-03-16 does not follow 2026-03-02: one row per week, no gaps` | a week is missing between those two: add it, as `0,0,0` if need be |
| `unexpected CSV header` | the line `week,ride_min,run_min,other_min` was changed: put it back |
| `index.html needs the ... markers around the chart` | the `training-chart:start` / `training-chart:end` comments were deleted from `index.html`: put them back where the chart goes |

A **warning** means the chart was drawn but a label may be crowded, for example
`compact: the "nationals" note touches a bar, the line or another note`. ("wide" is the
desktop chart, "compact" the one phones get.) Look at the chart; if it bothers you, shorten
the label or remove the note (see below).

## When the season changes

The top of `training-chart.mjs` has three settings:

- **`FROM`**: the first week the chart shows. Rows before it only feed the 4-week average.
  For a new season, set it to the new first Monday, e.g. `'2027-01-04'`. The title follows
  by itself: "Training hours per week, 2027", or a month range if the weeks span two years.
- **`PHASES`**: the brackets over the bars, such as "build" and "winter rebuild", each
  labelled with its weekly average. Give each a `from` Monday and, once it has ended, a
  `to` Monday; `short` is the label used on phones.
- **`NOTES`**: the race words with a line down to a week's bar, such as "nationals". Give
  the race week's Monday and a short label. Keep labels short; phones have little room.

Run the script again after changing any of these.

## What the script makes

Everything between the markers in `index.html`: the title and caption figures, the legend,
the chart twice (a wide one, and a narrower one that phones get), each week's plain tooltip,
the 4-week average line, and the "Show the numbers" table.

The readout that appears when you point at, tap or arrow-key to a week is a separate,
hand-written script at the end of `index.html`. The generator doesn't touch it. Without it
the chart still works: each week has a plain tooltip and every number is in the table.
