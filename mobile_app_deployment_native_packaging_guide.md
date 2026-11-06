# Mobile App Deployment & Native Packaging Guide

> **Note for Previous Documentation (`COUNTDOWN_DASHBOARD_DOCS.md` / `CALENDAR_SYNC_INTEGRATION_GUIDE.md`):**  
> Append this guide as a dedicated chapter (**"Chapter 7: Mobile App & Store Distribution Architecture"**) to the previous documentation. It complements the Web & Zero-Backend Calendar architectures by detailing how to package the standalone web dashboard directly into native iOS and Android apps without rewriting the frontend.

---

## 1. Architectural Strategy Comparison

| Approach | Setup Time | App Store / Play Store | Native Hardware Access | Recommended For |
| :--- | :--- | :--- | :--- | :--- |
| **PWA (Progressive Web App)** | ~5 minutes | No (Direct from Browser) | Limited (Service Workers, Storage) | Instant testing, fast distribution, zero app store fees. |
| **Capacitor (Ionic)** | ~20 minutes | **Yes** (IPA / AAB packages) | **Full** (Haptics, Device Calendar, Push Notifications) | **Strongly Recommended**: Wraps existing `index.html` code as-is. |
| **React Native / Expo** | Rebuild required | **Yes** (Native SwiftUI / Kotlin) | Full + iOS 16 Lock Screen WidgetKit | Deep OS home screen widgets and Dynamic Island integration. |

---

## 2. Option 1: PWA (Instant Installable App — Zero Store Approval)

A Progressive Web App enables users to install the dashboard onto their phone home screen directly from Safari (iOS) or Chrome (Android) without the browser URL bar.

### Step 1: Create `manifest.json`
Place this file in the root web directory alongside `index.html`:

```json
{
  "name": "T-Minus Countdown & Milestone Dashboard",
  "short_name": "T-Minus",
  "description": "10-Day backward sprint countdown with interactive matrix widgets.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#051F20",
  "theme_color": "#051F20",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### Step 2: Register Service Worker in `index.html`
Add this snippet directly before the closing `</body>` tag:

```html
<link rel="manifest" href="/manifest.json" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />

<script>
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("Service worker registration failed:", err);
      });
    });
  }
</script>
```

### Step 3: Add `sw.js` (Offline Cache)
Create `sw.js` in your root folder:

```javascript
const CACHE_NAME = "t-minus-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
```

---

## 3. Option 2: Capacitor Native Wrapper (Recommended for App Stores)

Capacitor creates native Xcode (iOS) and Android Studio (Android) container projects that bundle your web files directly. You write standard JavaScript, while Capacitor compiles to an actual `.ipa` (iOS) or `.aab`/`.apk` (Android).

### Step 1: Project Setup

```bash
# 1. Initialize npm in your project folder (if not done already)
npm init -y

# 2. Install Capacitor Core and CLI
npm install @capacitor/core
npm install -D @capacitor/cli

# 3. Initialize your app details
npx cap init "T-Minus Countdown" "com.yourname.tminus" --web-dir "."
```

### Step 2: Add Native Platforms

```bash
# Install platform runtimes
npm install @capacitor/ios @capacitor/android

# Add iOS and Android project wrappers
npx cap add ios
npx cap add android
```

### Step 3: Add Native Device Plugins

Enhance the mobile experience with real physical haptics and local notification reminders:

```bash
# Haptic tactile vibrations on dragging/resizing
npm install @capacitor/haptics

# Local push notifications when a milestone is approaching
npm install @capacitor/local-notifications
```

#### Calling Native Plugins from React:

```javascript
// Add haptic feedback on widget snap or milestone check
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";

// Trigger a light tactile bump on drag release
const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // Falls back gracefully on desktop web
  }
};

// Schedule native mobile notifications for T-Minus milestones
const scheduleMilestoneNotification = async (milestone) => {
  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [
        {
          title: `Milestone Reminder: ${milestone.tag}`,
          body: `${milestone.title} is due today!`,
          id: Date.now(),
          schedule: { at: new Date(milestone.isoDate) }
        }
      ]
    });
  } catch (e) {
    console.warn("Notifications not supported in browser environment.");
  }
};
```

### Step 4: Sync & Build Native Apps

Whenever you modify your HTML or code:

```bash
# Sync web code into the native iOS and Android folders
npx cap sync
```

#### Launching in iOS Xcode:
```bash
npx cap open ios
```
* Opens Xcode automatically.
* Select your target iPhone simulator or plug in a physical iPhone.
* Under **Signing & Capabilities**, select your Apple Developer Team.
* Hit **Run** (Command + R) to launch the app natively on your iPhone.
* Select **Product > Archive** to publish to TestFlight or the **Apple App Store**.

#### Launching in Android Studio:
```bash
npx cap open android
```
* Opens Android Studio automatically.
* Click **Run 'app'** (Shift + F10) to test on an Android emulator or plugged-in phone.
* Go to **Build > Generate Signed Bundle / APK** to create an `.aab` file ready for the **Google Play Console**.

---

## 4. Option 3: React Native / Expo (For True iOS Lock Screen & Home Screen Widgets)

If your goal is to build an **actual iOS Home Screen Widget** (that sits next to system icons without opening the app) or an **iOS 16 Lock Screen Widget**:

1. Web apps and web wrappers (PWA/Capacitor) cannot render native system widgets. Apple requires **WidgetKit** written in Swift, and Android requires **AppWidgetProvider**.
2. To build system widgets:
   - Use **Expo (React Native)** with an Expo config plugin like `@bittingz/expo-widgets` or `react-native-widgetkit`.
   - The countdown logic and milestones can be shared via a common state store, while the mini widget UI is rendered natively using SwiftUI.

---

## 5. Summary Recommendation

* **For immediate testing right now**: Add `manifest.json` and deploy to Vercel/Netlify. Open Safari on iPhone, tap "Share", and select **"Add to Home Screen"** (PWA).
* **For publishing to the Apple App Store & Google Play Store**: Use **Capacitor**. It uses your exact `index.html` code, requires no rewrite, and provides native haptics and notifications.