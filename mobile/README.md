# SURYA Ops (Android)

Companion app for the SURYA platform at Prestige University, Indore. It keeps operators informed without the web console open: live microgrid status, alert notifications, optimizer insights and emergency controls. It deliberately excludes the heavy 3D simulator.

Built with React + TypeScript (Vite) and packaged for Android with Capacitor 8.

## Features

- **Home**: renewable share, generation, solar, wind, grid flow, battery, campus load and assets online, refreshed every 10 s.
- **Alerts with notifications**: the backend streams telemetry but raises no alerts, so the app evaluates rules on-device (`src/lib/alerts.ts`): low/critical battery, battery over-temperature, high grid import, stale telemetry, offline or degraded equipment, degraded or failed optimizer cycles, emergency stop and lost connection. Each condition notifies once when it starts and resolves when it clears.
- **Background checks**: while the app is closed, `public/runners/background.js` runs through `@capacitor/background-runner` about every 15 minutes (Android's WorkManager minimum) and notifies about battery, grid, equipment and emergency-stop alerts.
- **Energy**: every asset with live power, status and a detail sheet.
- **Insights**: savings, CO₂ avoided, latest optimizer cycle and the decision feed.
- **Control**: force an optimization cycle (operator/admin) and engage or release the emergency stop (admin, reason plus press-and-hold).
- **Sample data mode** for demos without a server.

## Connecting to the backend

The phone talks to the SURYA FastAPI backend over the local network. Start the backend so other devices can reach it, and allow the app's origin:

```bash
CORS_ORIGINS="https://localhost,http://localhost" uvicorn backend.main:app --host 0.0.0.0 --port 8010
```

Enter `http://<PC-IP>:8010` as the server address on the sign-in screen. Phone and PC must be on the same network; some campus Wi-Fi networks block device-to-device traffic, in which case use a phone hotspot.

## Development

```bash
npm install
npm run dev            # browser preview at http://127.0.0.1:5190
npx tsc -b             # type-check
```

## Building the APK

Requires the Android SDK (API 36) and JDK 21.

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleRelease   # Windows: gradlew.bat assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

Release signing reads `android/keystore.properties`:

```properties
storeFile=../../keystore/surya-ops.jks
storePassword=...
keyAlias=surya-ops
keyPassword=...
```

The keystore and this file are git-ignored. Keep the keystore safe: Android only installs updates signed with the same key. Without the file the release build is unsigned.

## Icons and splash

Source images are in `assets/` (`icon-only.png`, `splash.png`). After changing them, regenerate with `npx capacitor-assets generate --android`. Then restore the full-bleed adaptive icon foreground and the WebP splash screens, which the generator replaces with a shrunken foreground and large PNGs.
