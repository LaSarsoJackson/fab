# ARCE website images

The website reuses photographs and illustrations from the existing ARCE project.
It adds screenshots of the current tools for the guides. No stock or generated
photographs were added.

| Website asset | Existing ARCE source |
| --- | --- |
| `cemetery-banner.jpg` | `https://www.albany.edu/arce/images/banner.jpg` |
| `stoneman.jpg` | `https://www.albany.edu/arce/images/Stoneman21d.jpg` |
| `arthur.jpg` | `https://www.albany.edu/arce/images/Arthur18a.jpg` |
| `corning.jpg` | `https://www.albany.edu/arce/images/Corning38c.jpg` |
| `soldiers.jpg` | `https://www.albany.edu/arce/images/Soldier30a.jpg` |
| `history-logos.jpg` | `https://www.albany.edu/arce/images/BothLogos.jpg` |

The banner matches the university-hosted file byte for byte. It stays in the
same ARCE project and serves the same purpose as the existing banner. The Arthur
card uses ARCE's portrait rather than the earlier statue photograph. The archive's
portraits and logos retain their existing project use. The public pages do not
identify a photographer or provide an independent image license; this inventory
records their project provenance, not a new rights clearance.

Raleway is the original site's font. The local copy is accompanied by its SIL
Open Font License in `arce/assets/fonts/Raleway-OFL.txt`.

Guide images are captured by `scripts/capture-arce-guides.mjs` in a disposable,
logged-out browser at desktop and phone widths. All three guides show the current
app without requesting location access. `arce/guide-shots.json` records the control
rectangles used by the thin outlines. Refresh both images and
rectangles together after app UI changes.
