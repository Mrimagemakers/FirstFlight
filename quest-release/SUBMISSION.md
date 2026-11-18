# First Flight — Meta Horizon Store working draft

## Listing copy

Explore aviation careers through hands-on activities in flight, ramp and cargo operations, and cabin safety.

Publisher: PenGame Publishing. Proposed Android package: `com.pengamepublishing.firstflight`. Check for an existing dashboard record or signing identity before assigning this identifier.

## Headset acceptance and capture

Launch directly into the lab. Complete a ramp activity, switch to flight, and verify cockpit text at normal seated distance. Capture actual headset footage. Record the build, Quest model, controller type, observed frame rate and any comfort issues. Test system-menu suspend/resume, controller reconnection, loss of network and relaunch. Verify all interactions without a keyboard. Set supported headsets and comfort rating from device results.

## Build and distribution

After merging and verifying the published manifest, run:

```sh
bubblewrap init --manifest=https://mrimagemakers.github.io/FirstFlight/manifest.webmanifest --metaquest
bubblewrap build
```

Verify the start URL opens lab.html. Select immersive mode only if the installed package starts an immersive WebXR session. Confirm the release signing certificate and configure Digital Asset Links at the host root, https://mrimagemakers.github.io/.well-known/assetlinks.json, preserving entries for other packages. Keep signing credentials outside Git. Sideload the signed APK and run the acceptance checks. Capture original gameplay for the listing. Confirm asset and audio licenses, privacy disclosures, target ages, content rating and data use before upload. For a Game Pass release, verify the first-level boundary and decide the approved Horizon purchase and entitlement flow before advertising paid levels. Website Stripe integration alone does not establish Quest billing support.

Upload the tested package to an internal release channel before store review. Signing, headset results, dashboard declarations and submission are pending.

[Meta packaging guide](https://developers.meta.com/vr/documentation/web/pwa-overview/) · [Meta submission](https://developers.meta.com/vr/resources/publish-submit/)
