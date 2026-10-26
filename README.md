# First Flight: Aviation Careers & XR Training (v1.0.0)

A Progressive Web App built on Three.js and WebXR, published by PenGame Publishing, LLC.

* `lab.html` is **the app**: a title screen, five training stations, settings, VR and offline play.
* `ar.html` is the **AR aircraft explorer** (`xr/ar/`, models in `xr/models/parts.js`): nine labelled 3D models with exploded views, WebXR AR on Android and Quest, and AR Quick Look on iPhone/iPad.
* `index.html` is the **Aviation Careers & New-Hire Learning Hub** website, with the 3D lab embedded and the **Aviation Maintenance Center** (`maintenance-data.js`, `maintenance.js`): maintenance careers, the A&P pathway, tutorials and technician tools.

## Run it
* Upload the folder to any static HTTPS host. Leave out `store/`, `reference/` and `tools/`.
* To test locally, run `npx serve .` (or `python3 -m http.server`) and open `http://localhost:3000/lab.html`. Opening the HTML files straight from disk won't work.
* VR needs HTTPS and a WebXR browser, such as the Meta Quest Browser.
* After you change any file, run `python3 tools/build_sw.py .` to refresh the offline cache.

## Folders
* `xr/`: the engine and stations (`core.js`, `post.js` for post-processing, `shell.js` for menus, `audio.js`, `settings.js`, `stations/`, `models/`).
* `vendor/`: three.js r180 (MIT) and WebXR controller models (MIT), so the app needs no CDN and works offline.
* `xr/assets/`: Poly Haven HDR lighting (CC0) and original procedural textures.
* `assets/renders/`: stills rendered by the engine.
* `icons/`, `manifest.webmanifest`, `sw.js`: everything that makes it installable.
* `privacy.html`, `terms.html`: store-ready policies. Replace `[support email]` with your support address.
* `store/`: listing text, store art, trailer and the publishing guide (`store/BUILD.md`).
* `tools/`: texture generator, service-worker builder, and the still and trailer capture scripts.
* `reference/`: your original inspiration screenshots, with the price removed. Keep these out of the app and the store listing; they show another company's product.
