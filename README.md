# angkyria.github.io
My personal site — a short introduction, what I race, and where to find me. Live at https://angkyria.github.io

About field: Personal site — angkyria.github.io. Static HTML, no build step.

```
index.html               home
cv.html                  curriculum vitae
angelos-kyriacou-cv.pdf  cv.html printed to PDF
my_repos.html            a few repositories
uses.html                bike, sensors, tools, equipment, software (fill in as you go)
404.html                 not-found page (served by GitHub Pages)
css/styles.css           the only stylesheet, including the Hack @font-face rules
fonts/                   Hack webfont, latin subset (woff2 + woff)
me.jpg                   portrait
og.jpg                   1200×630 link-preview card
favicon.svg              icon
apple-touch-icon.png     180×180 icon for iOS home screens
robots.txt               crawler rules + sitemap pointer
sitemap.xml              the pages, plus the Karoo extension sites
```

After editing cv.html, regenerate the PDF: open cv.html in Chrome, Print → Save as PDF, A4, margins Default, and save over `angelos-kyriacou-cv.pdf`. The print styles in `css/styles.css` handle the layout.

The racing section and the hero's data fields carry dated facts (2026 results, cup standings). Check them when the season changes, along with the "Updated" note under the race calendar. `og.jpg` repeats the hero's data fields, so it needs remaking when they change.

The training chart in the racing section is static SVG made from Strava moving time (5 Jan – 27 Sep 2026); its numbers are also in the table under it. It needs regenerating to cover later weeks.

Visits are counted with GoatCounter (no cookies, no personal data): the snippet at the end of each page sends to `angkyria.goatcounter.com`. That code must be registered at goatcounter.com; if it is taken, change it in all five pages.
