# Throw a Plate at the Wall!!! – website

Website for **Throw a Plate at the Wall!!!**, the physics smashing game for iPhone (code name "ThrowAPlate",
local app repo `~/Developer/ThrowAPlate`). Plain HTML and CSS, English and German. Nothing to install and nothing to build.

Live at **https://makohippo.com/ThrowAPlate/** (repo `MathCatsMathCats/ThrowAPlate`, GitHub Pages
from `main`, root folder).

| Page | English | German |
|---|---|---|
| Home, with the playable mini-smash | `index.html` | `de/index.html` |
| Support (the App Store "Support URL") | `support/index.html` | `de/support/index.html` |
| Privacy (this website + a summary of the app) | `privacy/index.html` | `de/privacy/index.html` |
| Impressum | – | `impressum/index.html` |
| Page not found | `404.html` (both languages) | |

- Look: the app's own colors and type (design "A · Smash Blue", plus the live receipt from design "C").
  Headings use the system's rounded font (`ui-rounded`), which is SF Rounded on iPhone, iPad and Mac, like the app.
  Other systems fall back to their own sans-serif.
- `assets/smash.js` is the mini game: a small pseudo-3D room in a canvas, flick-to-throw, pieces cut from each object
  with Voronoi cells, floor physics, cracks, a wine splat, a sticky gummy bear, and sounds synthesized with Web Audio.
  The four objects and prices come from the game's catalog. `assets/home.js` paints the room, runs the tray, HUD and
  receipt, and holds the words for both languages (it picks them from `<html lang>`).
- Nothing is loaded from other servers, there are no cookies and nothing is saved in the browser.
- `design-options/` holds the three designs that were compared. It's ignored by git and never published.

## Editing text

Open a page and search for `EDIT`. Each numbered comment marks text you can change. Change only the words between
`>` and `<`, keep English and German in step, then commit and push. The change is live in about a minute.

## When the app is live on the App Store

On both home pages (`index.html`, `de/index.html`):

1. **EDIT 2**: replace the "Coming soon" line with the App Store link (the comment has the code).
2. **EDIT 8**: change the closing line and link "App Store".
3. **LINK EDIT** near the top: add the App Store ID for Safari's app banner.

## App Store Connect

- **Support URL:** `https://makohippo.com/ThrowAPlate/support/` (German: `…/de/support/`)
- **Marketing URL:** `https://makohippo.com/ThrowAPlate/`. AdMob looks for `app-ads.txt` at the root of
  that domain, `https://makohippo.com/app-ads.txt`, which lives in the `MathCatsMathCats.github.io` repo.
- **Privacy Policy URL:** stays `https://mathcatsmathcats.github.io/ThrowAPlate-privacy/privacy-policy.html` (it redirects to makohippo.com), because
  that address is built into the app (Settings → Privacy policy). Its source is `Docs/privacy-site` in the app repo.

## Screenshots

`assets/img/shots/{en,de}` are the captioned App Store screenshots from the app repo
(`Docs/AppStore/screenshots`, made by `Tools/StoreArt/compose.py`), resized to 480 px wide WebP.
The link-preview images `assets/img/og-{en,de}.jpg` (1200 × 630) are built from the same screenshots.

## The domain

The site is served at `https://makohippo.com/ThrowAPlate/`: the custom domain `makohippo.com` is set on the root
repo `MathCatsMathCats.github.io` (DNS at Cloudflare, "DNS only"). Every project site inherits it, and the old
github.io addresses redirect there. Don't set a custom domain on this repository.

`404.html` has a fixed `<base href="/ThrowAPlate/">`, so its links work at any depth.
