# Publishing First Flight

First Flight is a Progressive Web App (PWA) built on WebXR. You host it once over HTTPS, then wrap that same site for each store.

## 1. Host the app (required for every store)
1. Upload everything in the project folder to a static host with HTTPS, such as Netlify, Cloudflare Pages, GitHub Pages or AWS S3 + CloudFront. You can leave out `store/` and `reference/`.
2. Open `https://[your-domain]/lab.html` in Chrome or the Meta Quest Browser and check:
   - the title screen loads;
   - **Install app** appears in the browser menu (this confirms the manifest and service worker work);
   - **Enter VR** works in a headset.
3. The app runs offline after the first visit. After any file change, run `python3 tools/build_sw.py .` from the project folder so returning players get the update.

## 2. Meta Horizon Store (Quest)
Meta packages PWAs with its fork of Bubblewrap ([Meta docs](https://developers.meta.com/horizon/documentation/web/pwa-packaging/)).

```bash
npm install --global @meta-quest/bubblewrap-cli
mkdir first-flight-quest && cd first-flight-quest
bubblewrap init --manifest=https://[your-domain]/manifest.webmanifest --metaquest
#   App mode: immersive (WebXR)        Package ID: com.pengamepublishing.firstflight
bubblewrap build                       # creates app-release-signed.apk
keytool -list -v -keystore android.keystore -alias android   # copy the SHA-256 fingerprint
```
- Upload `/.well-known/assetlinks.json` to your domain using the package ID and SHA-256 fingerprint. Bubblewrap prints the file contents.
- Test with `adb install app-release-signed.apk` on a Quest in Developer Mode.
- Create the app in the [Meta Horizon developer dashboard](https://developer.oculus.com/documentation/web/pwa-submit-app), upload the APK, then add the listing text and art from `store/`.
- Back up `android.keystore` and its passwords. You need the same key for every update.

## 3. SideQuest
- **APK listing:** upload the same signed APK from step 2 using SideQuest's developer portal ([submission guide](https://sidequestvr.atlassian.net/wiki/x/AgAD)). Reuse the art and text in `store/`.
- **WebXR listing:** SideQuest also curates WebXR experiences that launch by URL (`sdq.st/webxr`). Ask SideQuest to list `https://[your-domain]/lab.html`.

## 4. Google Play, Microsoft Store and the web
- Use [PWABuilder](https://www.pwabuilder.com) with `https://[your-domain]/lab.html` to create Android (Trusted Web Activity) and Windows (MSIX) packages. Use the same package ID.
- On the open web, link players straight to `lab.html` (the app) or `index.html` (the careers hub). You can also publish to itch.io as an HTML5 game by uploading a zip of the folder.

## 5. Apple App Store
Safari on iPhone and iPad doesn't support WebXR VR. The 3D app works there in touch mode, so an iOS build would be a non-VR version. You can wrap it with PWABuilder's iOS template or Capacitor. Apple may require more native features before it accepts a web-wrapper app.

## Re-rendering the trailer and screenshots
`tools/trailer.mjs` drives the real engine frame by frame with Playwright. On a machine with a GPU, set the viewport to 1920×1080 or 2560×1440 and run:
```bash
node tools/trailer.mjs
ffmpeg -framerate 30 -i frames/f%05d.jpg -i soundtrack.wav -c:v libx264 -pix_fmt yuv420p -crf 17 -c:a aac -shortest trailer.mp4
```
