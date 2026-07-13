APP ICON — how to use your own PNG
==================================

The app currently uses assets/icon.svg (a recreation of the red D20 + flourish ring).
That works on Android and desktop, but iPhone home-screen icons need a PNG.

To use your exact artwork, drop these two files into this folder (assets/):

    assets/icon-512.png   — 512 x 512 px  (required)
    assets/icon-192.png   — 192 x 192 px  (recommended; used for the iOS home-screen icon)

If you only make one, make icon-512.png and copy/rename it to icon-192.png too.

That's it — no code change needed. They're already wired up:
  - manifest.webmanifest lists icon-192.png / icon-512.png (with icon.svg as fallback)
  - index.html apple-touch-icon points at icon-192.png

Optional (nice-to-have): once the PNGs exist, add them to PRECACHE_URLS in sw.js so the
icon is available offline:
    'assets/icon-192.png',
    'assets/icon-512.png',

Then bump scriptVersion in index.html so the change reaches users.

Making the PNGs from your image: any image editor or a free online resizer (e.g. search
"resize image to 512x512 png") works — export as PNG at those exact pixel sizes.
