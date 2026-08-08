# Chronodrom

iOS running tracker. Reads workouts from Apple HealthKit, lets you classify and compare runs.

---

## Running the app

### Prerequisites

- Node.js installed
- **Expo Go** installed on your iPhone (free, App Store)
- iPhone and Windows PC on the **same Wi-Fi network**

---

### Expo Go — UI development (no build needed)

Use this for all screen/UI work. Works instantly from Windows, no Mac required.

```bash
# Install dependencies (first time, or after pulling new changes)
npm install

# Start the dev server
npx expo start
```

A QR code appears in the terminal. Open the **camera app** on your iPhone and scan it — it opens directly in Expo Go with live reload.

> **Note:** HealthKit does not work in Expo Go. Use mock data for all UI development (see `src/mockData.ts`).

---

### EAS dev build — HealthKit development

Required once you need real HealthKit data. Builds a dev `.ipa` and installs it on your iPhone. After that, live reload still works over Wi-Fi — you only need to rebuild if native dependencies change.

```bash
# One-time: install EAS CLI globally
npm install -g eas-cli

# One-time: log in to your Expo account
eas login

# Build the dev client and install on iPhone (takes ~10 min, runs in the cloud)
eas build --profile development --platform ios
```

EAS emails you a link to download the `.ipa` when done. Install it via the Expo dashboard or QR code it provides.

---

### EAS production build — TestFlight / App Store

```bash
eas build --profile production --platform ios
```

Submit to TestFlight after the build completes via the Expo dashboard or `eas submit`.

---

## CI

GitHub Actions runs a TypeScript check on every push to `main` and every pull request. See `.github/workflows/ci.yml`.
