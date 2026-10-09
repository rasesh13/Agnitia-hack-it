# SURYA 3D Digital Twin Simulator & Mobile Operations Guide

> **Building, Running, and Demonstrating the Standalone Three.js 3D Simulator and Capacitor Android Operations App**

---

## 1. 3D Campus Digital Twin Simulator (`simulator/`)

The 3D simulator is a standalone WebGL application built with **React 19, `@react-three/fiber`, and Three.js**. It provides an interactive spatial digital twin visualization of campus buildings, rooftop solar installations, helical wind turbines, and hazard drills.

### 1.1 What It Demonstrates
- **Spatial Campus Microgrid Geometry**: 3D geometric models of Prestige University (Indore), VIT Bhopal, IIT Jodhpur, MNIT Jaipur, and other regional institutions.
- **Dynamic Physics & Lighting**: Sun orientation and sky color dynamically reflect time-of-day and simulated cloud cover (`simulator/src/weather.js`).
- **Active Asset Telemetry Overlays**: Floating 3D badges showing active wattage on rooftop solar arrays, battery enclosures, and academic blocks.
- **Engineering Calculation Engine**: Computes localized irradiance, panel tilt efficiencies, and aerodynamic wind turbine spin speeds (`simulator/src/engineeringEngine.js`).
- **Interactive Hazard Scenarios**: Simulates battery thermal excursions, inverter line trips, and emergency load-shedding responses (`simulator/src/useHazardSimulation.js`).

### 1.2 Development & Local Run
To run the simulator independently:

```bash
cd simulator
npm ci
npm run dev
# Accessible at http://127.0.0.1:5173/#prestige-university
```

To run its internal energy model tests:
```bash
npm test
# Executes node test runner covering weather normalization and energy algorithms.
```

### 1.3 Embedding into the Main Operations Web Console
The main React console embeds the 3D simulator inside the **Digital Twin** tab via an iframe pointing to `/simulator/index.html`.
- To build the simulator bundle into the frontend static tree:
  ```bash
  npm --prefix frontend run build:simulator
  # Compiles simulator into frontend/public/simulator/
  ```
- *Note: The production Docker image (`frontend/Dockerfile`) automatically compiles this in Stage 0.*

---

## 2. SURYA Ops Mobile Application (`mobile/`)

SURYA Ops is a companion native Android application built with **React, TypeScript, and Capacitor 8**. It enables plant operators to monitor microgrid health and manage emergency controls from anywhere on site without needing a desktop workstation.

### 2.1 What It Demonstrates
- **Live KPI Status**: Refreshed every 10 seconds showing clean energy fraction, net grid flow, battery SoC, and active generation.
- **On-Device Intelligent Alert Rules (`mobile/src/lib/alerts.ts`)**: Evaluates real-time battery thermal limits, high grid import, stale telemetry, and critical threshold breaches directly on the device.
- **Background Push Notifications (`@capacitor/background-runner`)**: Runs every 15 minutes via Android WorkManager while the app is completely closed, notifying operators of critical grid excursions or BESS emergencies.
- **Remote Plant Control**: Allows operators to trigger an on-demand optimization cycle (`force-cycle`) and engage/release Emergency Stop with press-and-hold confirmation.
- **Sample Data Fallback**: Includes an offline demo mode for presentations without network access.

### 2.2 Local Development & Browser Preview
```bash
cd mobile
npm install
npm run dev
# Browser preview available at http://127.0.0.1:5190
```

### 2.3 Connecting Mobile App to Backend
1. Start the SURYA FastAPI backend binding to all network interfaces:
   ```bash
   CORS_ORIGINS="https://localhost,http://localhost" uvicorn backend.main:app --host 0.0.0.0 --port 8010
   ```
2. Connect your Android phone to the same local Wi-Fi network as your host PC.
3. On the mobile sign-in screen, enter `http://<YOUR_PC_IP>:8010` as the API Server URL.

### 2.4 Building the Android APK
Building the installable APK requires the Android SDK (API 36) and JDK 21:

```bash
cd mobile
npm run build
npx cap sync android
cd android

# Build release APK (Windows: gradlew.bat assembleRelease)
./gradlew assembleRelease
```

The compiled APK binary is output to:
`mobile/android/app/build/outputs/apk/release/app-release.apk`
