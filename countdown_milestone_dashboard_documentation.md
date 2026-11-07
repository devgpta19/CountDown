# T-Minus Countdown & Milestone Dashboard: Technical Documentation & Implementation

## 1. Project Overview & Architecture

The **T-Minus Countdown & Milestone Dashboard** is a zero-backend, client-side, production-grade productivity dashboard built with React 18, Tailwind CSS, and custom pointer-event physics. It combines an adaptive countdown engine, a 2D matrix widget grid system with 8-way directional resizing, and a calendar sync engine.

---

## 2. Multi-User Calendar Sync Architecture (Public Deployments)

When deploying your dashboard to platforms like Vercel, Netlify, or GitHub Pages, other users visiting your site will want to sync the milestones directly into their own personal calendar schedules.

Below are the two strategies available—the recommended zero-backend approach (already running in code) versus full direct Google OAuth integration.

### Method 1: Zero-Backend One-Click Sync (Recommended)

This method is embedded directly in `index.html` and requires **zero servers, no database, and no Google Cloud OAuth verification**. It works instantly for 100% of visitors.

#### How It Works Under the Hood:

1. **Direct Google Calendar Web Intent Link (`+GCal`):**
   When a user clicks `+GCal` next to any milestone, the frontend generates a dynamic URL:
   ```javascript
   const generateGCalUrl = (milestone) => {
     const start = new Date(milestone.isoDate).toISOString().replace(/-|:|\.\d\d\d/g, "");
     const end = new Date(new Date(milestone.isoDate).getTime() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, "");
     const details = encodeURIComponent(`${milestone.desc}\n\nMilestone Tag: ${milestone.tag}\nPortfolio Submission Roadmap`);
     const title = encodeURIComponent(`[${milestone.tag}] ${milestone.title}`);

     return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${start}/${end}`;
   };
   ```
   * Clicking opens Google Calendar in their active browser tab with title, timing, description, and dates pre-populated.
   * The user clicks **"Save"**, and it saves directly to their Google account.

2. **Bulk `.ICS` File Export (All 6 Milestones in 1 Click):**
   When the user clicks the **".ICS"** button, the browser constructs a standard iCalendar MIME blob in memory:
   ```javascript
   const downloadAllIcs = () => {
     let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Portfolio Submission Sprint//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";

     milestones.forEach(m => {
       const start = new Date(m.isoDate).toISOString().replace(/-|:|\.\d\d\d/g, "");
       const end = new Date(new Date(m.isoDate).getTime() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, "");
       ics += `BEGIN:VEVENT\nSUMMARY:[${m.tag}] ${m.title}\nDESCRIPTION:${m.desc}\nDTSTART:${start}\nDTEND:${end}\nSTATUS:CONFIRMED\nEND:VEVENT\n`;
     });

     ics += "END:VCALENDAR";

     const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
     const link = document.createElement("a");
     link.href = URL.createObjectURL(blob);
     link.download = "portfolio-milestones.ics";
     link.click();
   };
   ```
   * **iOS / macOS (Apple Calendar):** Imports all 6 milestones in a single tap into Apple Calendar.
   * **Windows / Android / Outlook:** Opens the standard system calendar dialog to insert the complete sprint timeline.

---

### Method 2: Direct 1-Click "Sync with Google" via Client-Side OAuth (GCP)

If you require an experience where a user clicks **"Connect Google Calendar"**, grants permissions, and your app silently inserts all 6 milestones via REST API calls in the background:

#### Step 1: Set up Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project named `Portfolio Countdown Dashboard`.
3. Go to **APIs & Services > Library**, search for **Google Calendar API**, and click **Enable**.
4. Go to **APIs & Services > Credentials**:
   * Click **Create Credentials > OAuth client ID**.
   * Application type: **Web application**.
   * Add your production domain under **Authorized JavaScript origins** (e.g., `https://your-domain.vercel.app`) as well as `http://localhost:3000` for development.
   * Copy the **Client ID** (`xxxxx.apps.googleusercontent.com`).

#### Step 2: Include the Google Identity Services SDK
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

#### Step 3: Client-Side Token Client & Calendar Batch Insertion
```javascript
const GOOGLE_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function useGoogleCalendarSync() {
  const [tokenClient, setTokenClient] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (window.google) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: CALENDAR_SCOPE,
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            await insertMilestonesToCalendar(tokenResponse.access_token);
          }
        },
      });
      setTokenClient(client);
    }
  }, []);

  const insertMilestonesToCalendar = async (accessToken) => {
    setIsSyncing(true);
    try {
      for (const milestone of INITIAL_MILESTONES) {
        const startTime = new Date(milestone.isoDate).toISOString();
        const endTime = new Date(new Date(milestone.isoDate).getTime() + 3600000).toISOString();

        const eventPayload = {
          summary: `[${milestone.tag}] ${milestone.title}`,
          description: `${milestone.desc}\n\nAutomated milestone from Portfolio Countdown Dashboard.`,
          start: {
            dateTime: startTime,
            timeZone: "Asia/Kolkata",
          },
          end: {
            dateTime: endTime,
            timeZone: "Asia/Kolkata",
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 30 },
              { method: "email", minutes: 1440 }
            ],
          },
        };

        await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        });
      }
      alert("All milestones synced directly to your Google Calendar!");
    } catch (err) {
      console.error("Error inserting calendar events:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerGoogleAuth = () => {
    if (tokenClient) {
      tokenClient.requestAccessToken();
    }
  };

  return { triggerGoogleAuth, isSyncing };
}
```

---

## 3. Design System & Theming Tokens

The project uses the palette extracted from the user specification across both Dark Mode (Apple Frosted Glass) and Light Mode (Tactile Neumorphism):

| Hex Token | Role | Usage |
| :--- | :--- | :--- |
| `#051F20` | Canvas Deep Forest | Dark mode viewport background & active drag borders |
| `#0B2B26` | Dark Forest Slate | Sub-surface panels, secondary headers, track rings |
| `#163832` | Medium Forest Glass | Backdrop glass panels, modal frames, active button fill |
| `#235347` | Forest Sage Accent | Badge chips, primary button states, status indicators |
| `#8EB69B` | Mint Sage Primary | Typography accent, icons, borders, progress gradient |
| `#DAF1DE` | Soft Mint Ivory | High-contrast headings, text highlights, indicator glow |
| `#FF3B30` | Crimson Red | Sub-hour radial urgency track & jiggle badge warnings |

---

## 4. Key Issues Encountered & Engineered Fixes

### A. React DOM Reconciliation Crash (`removeChild` Error)
* **Problem**: Using `lucide.createIcons()` swapped `<i>` tags for `<svg>` tags via direct DOM manipulation. React 18 threw `NotFoundError: Failed to execute 'removeChild' on 'Node'` during state updates.
* **Fix**: Replaced runtime DOM-replacing script icons with a pure, self-contained `<Icon name="..." />` SVG component owned entirely by React.

### B. Narrow Header Wrap on Mobile Screens
* **Problem**: Words like `Fri,`, `Nov`, `06` wrapped into a vertical list on mobile viewports.
* **Fix**: Added `whitespace-nowrap`, switched to `xs:flex-row items-stretch`, and equally distributed the timezone toggle pills using `flex-1 text-center`.

### C. Downward Runaway Escalation (`R:15`, `R:18`)
* **Problem**: Moving a widget triggered a continuous collision loop that iteratively pushed elements down by pixel deltas without upward clearance.
* **Fix**: Introduced a vertical **gravity compaction pass** (`compactLayout`). Elements float up to fill top vacancies, and an 8-row ceiling prevents unbounded downward displacement.

### D. Component Height Expansion on Grab
* **Problem**: Grabbing a component caused its height (`h`) to jump or expand because `handleMove` fired immediately upon pointer down before a movement threshold was met.
* **Fix**: Added a 4px pointer movement threshold gate (`isDraggingActive`) and locked original height (`origH`) during drag calculations.

### E. 8-Way Edge & Corner Resizing
* **Problem**: Standard resize only supported bottom-right scaling.
* **Fix**: Created 8 directional anchors (`nw`, `ne`, `sw`, `se`, `n`, `s`, `e`, `w`) with dynamic coordinate recalculation when scaling from left or top edges.

### F. Mobile Text Truncation (`...`) & Asymmetric Multi-Line Wrapping
* **Problem**: Rigid `truncate` and `line-clamp-1` cut off milestone titles and descriptions with `...` on narrow mobile screens. Unwrapping with standard flex caused uneven vertical centering where checkboxes and tag badges drifted away from the text header.
* **Fix**: Replaced all truncations with `break-words leading-snug`, anchored checkboxes and tag badges (`[T-10]`) to the top line using `items-start pt-0.5`, gave tag chips a fixed `min-w-[36px]` column width, and enforced a `min-h-[58px]` container so all cards remain perfectly symmetric and aligned regardless of title length.

### G. Lower Minimum Limits (`minW: 2, minH: 1`) & Ultra-Compact Views
* **Problem**: High minimum constraints (`minW: 4, minH: 3`) prevented users from minimizing widgets into compact companion cards.
* **Fix**: Lowered constraints down to `minW: 2, minH: 1` across all widgets. Engineered adaptive ultra-slim layouts (`h: 1`) that render horizontal control bars with live timers, inline progress meters, and milestone status strips without overflowing.

### H. Mouse-Up Snap-Back Teleportation & Grid Drift
* **Problem**: On pointer release (`handleEnd`), calling `compactLayout(..., null)` treated the user's placed widget as an unpinned element and forcibly pulled it back up to Row 1. Additionally, `getGridCoordFromPointer` assumed hardcoded 90px cells without accounting for responsive 12px/16px CSS grid gaps.
* **Fix**: Updated `compactLayout(layout, activeTarget)` to preserve the user's chosen placement while only floating other unpinned widgets to fill vacant rows. Revised coordinate math to incorporate dynamic `colGap` and `rowGap` steps for 1:1 pointer tracking. Expanded corner and edge resize touch hit targets to 28px/16px with `touch-action: none`.

---

## 5. Complete Application Source Code (`index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>T-Minus Countdown & Milestone Dashboard</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- React & ReactDOM -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <!-- Babel Standalone -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            forestDeep: '#051F20',
            forestDark: '#0B2B26',
            forestMid: '#163832',
            forestSage: '#235347',
            mintMuted: '#8EB69B',
            mintLight: '#DAF1DE',
            appleRed: '#FF3B30'
          },
          fontFamily: {
            sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Inter', 'sans-serif'],
            mono: ['SF Mono', 'ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace']
          }
        }
      }
    }
  </script>
  <style>
    /* Neumorphic tactile surfaces (Light Mode) */
    .neu-raised {
      background: #E8F4EC;
      box-shadow: 8px 8px 18px #cadbcc, -8px -8px 18px #ffffff;
    }
    .neu-sunken {
      background: #E8F4EC;
      box-shadow: inset 4px 4px 8px #c8d9cb, inset -4px -4px 8px #ffffff;
    }
    .neu-card {
      background: #F4FAF5;
      box-shadow: 6px 6px 16px rgba(142, 182, 155, 0.35), -6px -6px 16px rgba(255, 255, 255, 0.95);
    }
    .neu-btn {
      background: #F4FAF5;
      box-shadow: 4px 4px 10px rgba(142, 182, 155, 0.3), -4px -4px 10px rgba(255, 255, 255, 0.9);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .neu-btn:active {
      box-shadow: inset 2px 2px 5px rgba(142, 182, 155, 0.45), inset -2px -2px 5px rgba(255, 255, 255, 0.95);
      transform: scale(0.98);
    }

    /* Apple glassmorphism styling (Dark Mode) */
    .glass-dark {
      background: rgba(11, 43, 38, 0.75);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(142, 182, 155, 0.16);
      box-shadow: 0 16px 36px 0 rgba(2, 15, 16, 0.65);
    }
    .glass-card {
      background: rgba(22, 56, 50, 0.65);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(142, 182, 155, 0.14);
    }

    .dial-glow {
      filter: drop-shadow(0 0 14px rgba(255, 59, 48, 0.45));
    }

    /* Grid blueprint background */
    .blueprint-grid-dark {
      background-size: 24px 24px;
      background-image: 
        linear-gradient(to right, rgba(142, 182, 155, 0.08) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(142, 182, 155, 0.08) 1px, transparent 1px);
    }
    .blueprint-grid-light {
      background-size: 24px 24px;
      background-image: 
        linear-gradient(to right, rgba(35, 83, 71, 0.08) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(35, 83, 71, 0.08) 1px, transparent 1px);
    }

    .drag-handle {
      cursor: grab;
      touch-action: none;
    }
    .drag-handle:active {
      cursor: grabbing;
    }
    .widget-dragging {
      opacity: 0.92;
      transform: scale(1.02);
      z-index: 40 !important;
      box-shadow: 0 24px 48px -12px rgba(5, 31, 32, 0.8), 0 0 0 2px #8EB69B;
    }

    /* Jiggle Animation */
    @keyframes widgetJiggle {
      0% { transform: rotate(-0.75deg) scale(0.995); }
      50% { transform: rotate(0.85deg) scale(1.005); }
      100% { transform: rotate(-0.75deg) scale(0.995); }
    }
    .widget-jiggle {
      animation: widgetJiggle 0.28s ease-in-out infinite alternate;
    }

    /* 8-Directional Resize Handles */
    .resize-handle-corner {
      position: absolute;
      width: 14px;
      height: 14px;
      z-index: 35;
      touch-action: none;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s, transform 0.15s;
    }
    .resize-handle-edge {
      position: absolute;
      z-index: 34;
      touch-action: none;
      transition: background-color 0.15s;
    }

    .handle-nw { top: -2px; left: -2px; cursor: nwse-resize; }
    .handle-ne { top: -2px; right: -2px; cursor: nesw-resize; }
    .handle-sw { bottom: -2px; left: -2px; cursor: nesw-resize; }
    .handle-se { bottom: -2px; right: -2px; cursor: nwse-resize; }

    .handle-n { top: -3px; left: 16px; right: 16px; height: 8px; cursor: ns-resize; }
    .handle-s { bottom: -3px; left: 16px; right: 16px; height: 8px; cursor: ns-resize; }
    .handle-w { left: -3px; top: 16px; bottom: 16px; width: 8px; cursor: ew-resize; }
    .handle-e { right: -3px; top: 16px; bottom: 16px; width: 8px; cursor: ew-resize; }

    .handle-indicator-corner {
      width: 7px;
      height: 7px;
      border-radius: 2px;
      background: #8EB69B;
      opacity: 0.45;
      transition: all 0.15s ease;
    }
    .handle-indicator-edge {
      border-radius: 9999px;
      background: #8EB69B;
      opacity: 0.2;
      transition: all 0.15s ease;
    }

    .group:hover .handle-indicator-corner,
    .resize-handle-corner:hover .handle-indicator-corner,
    .resize-handle-corner:active .handle-indicator-corner {
      opacity: 1;
      transform: scale(1.3);
      background: #DAF1DE;
      box-shadow: 0 0 8px rgba(218, 241, 222, 0.7);
    }

    .group:hover .handle-indicator-edge,
    .resize-handle-edge:hover .handle-indicator-edge,
    .resize-handle-edge:active .handle-indicator-edge {
      opacity: 0.85;
      background: #8EB69B;
    }

    /* Scrollbars */
    ::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    .dark ::-webkit-scrollbar-thumb, html:not(.light) ::-webkit-scrollbar-thumb {
      background: rgba(142, 182, 155, 0.25);
      border-radius: 9999px;
    }
    .custom-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(142, 182, 155, 0.3) transparent;
    }
  </style>
</head>
<body class="bg-[#051F20] transition-colors duration-500 m-0 p-0 selection:bg-[#235347] selection:text-[#DAF1DE] overflow-x-hidden">
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useMemo, useRef } = React;

    const Icon = ({ name, className = "w-4 h-4" }) => {
      switch (name) {
        case "clock":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          );
        case "calendar":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          );
        case "sun":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
          );
        case "moon":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
          );
        case "check":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          );
        case "check-square":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 11 12 14 22 4"></polyline>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          );
        case "download":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          );
        case "check-circle":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          );
        case "x":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          );
        case "external-link":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          );
        case "grip":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="5" r="1"></circle>
              <circle cx="9" cy="12" r="1"></circle>
              <circle cx="9" cy="19" r="1"></circle>
              <circle cx="15" cy="5" r="1"></circle>
              <circle cx="15" cy="12" r="1"></circle>
              <circle cx="15" cy="19" r="1"></circle>
            </svg>
          );
        case "settings":
          return (
            <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          );
        default:
          return null;
      }
    };

    const TARGET_DEADLINE = new Date("2026-11-16T09:00:00+05:30").getTime();

    const TIMEZONES = [
      { label: "IST", zone: "Asia/Kolkata" },
      { label: "UTC", zone: "UTC" },
      { label: "EST", zone: "America/New_York" },
      { label: "PST", zone: "America/Los_Angeles" }
    ];

    const INITIAL_MILESTONES = [
      { id: "m1", tag: "T-10", dateStr: "Nov 06, 2026", isoDate: "2026-11-06T09:00:00", title: "Audit content and assets", desc: "Collect design projects, artifacts & case studies." },
      { id: "m2", tag: "T-7",  dateStr: "Nov 09, 2026", isoDate: "2026-11-09T09:00:00", title: "Finalize wireframes and copy", desc: "Complete typography, hero flow and project descriptions." },
      { id: "m3", tag: "T-5",  dateStr: "Nov 11, 2026", isoDate: "2026-11-11T09:00:00", title: "Complete core page build", desc: "Build out hero section, project gallery and contact card." },
      { id: "m4", tag: "T-3",  dateStr: "Nov 13, 2026", isoDate: "2026-11-13T09:00:00", title: "Finish responsiveness and testing", desc: "Audit mobile viewports, touch targets, and light/dark styling." },
      { id: "m5", tag: "T-1",  dateStr: "Nov 15, 2026", isoDate: "2026-11-15T09:00:00", title: "Proofread and freeze code", desc: "Final spellcheck, clean metadata, and freeze commits." },
      { id: "m6", tag: "T-0",  dateStr: "Nov 16, 2026", isoDate: "2026-11-16T09:00:00", title: "Submit final portfolio", desc: "Ship the submission link to the reviewers." }
    ];

    function App() {
      const [theme, setTheme] = useState("dark");
      const [selectedTz, setSelectedTz] = useState(TIMEZONES[0].zone);
      const [now, setNow] = useState(Date.now());
      const [forceRadialMode, setForceRadialMode] = useState(false);
      const [completed, setCompleted] = useState(() => {
        try {
          const cached = localStorage.getItem("milestones_cache");
          return cached ? JSON.parse(cached) : {};
        } catch {
          return {};
        }
      });
      const [showCalendarModal, setShowCalendarModal] = useState(false);
      const [toastMsg, setToastMsg] = useState("");
      const [isEditMode, setIsEditMode] = useState(false);

      const DEFAULT_GRID_LAYOUT = {
        countdown:  { col: 1, row: 1, w: 4, h: 4 },
        milestones: { col: 5, row: 1, w: 4, h: 4 },
        progress:   { col: 1, row: 5, w: 8, h: 2 }
      };

      const [gridLayout, setGridLayout] = useState(() => {
        try {
          const saved = localStorage.getItem("custom_coord_grid_layout");
          if (saved) return JSON.parse(saved);
        } catch(e) {}
        return DEFAULT_GRID_LAYOUT;
      });

      const [activeDragId, setActiveDragId] = useState(null);
      const [resizingId, setResizingId] = useState(null);
      const [hoverCoord, setHoverCoord] = useState(null);
      const gridContainerRef = useRef(null);
      const dragStartOffset = useRef({ mouseX: 0, mouseY: 0, origCol: 1, origRow: 1, origW: 4, origH: 4, isDraggingActive: false });
      
      const MIN_CONSTRAINTS = {
        countdown: { minW: 3, minH: 3 },
        milestones: { minW: 4, minH: 3 },
        progress: { minW: 3, minH: 2 }
      };

      const activeDragIdRef = useRef(null);
      const resizingIdRef = useRef(null);
      const gridLayoutRef = useRef(gridLayout);
      useEffect(() => {
        gridLayoutRef.current = gridLayout;
      }, [gridLayout]);

      const saveLayout = (updated) => {
        setGridLayout(updated);
        gridLayoutRef.current = updated;
        try {
          localStorage.setItem("custom_coord_grid_layout", JSON.stringify(updated));
        } catch(e) {}
      };

      // Gravity compaction pass
      const compactLayout = (layout, activeId) => {
        const sortedKeys = Object.keys(layout).sort((a, b) => {
          if (a === activeId) return -1;
          if (b === activeId) return 1;
          return layout[a].row - layout[b].row;
        });

        const compacted = { ...layout };

        sortedKeys.forEach((key) => {
          if (key === activeId) return;

          let targetRow = 1;
          while (true) {
            let collision = false;
            for (const otherKey of Object.keys(compacted)) {
              if (otherKey === key) continue;
              const a = { ...compacted[key], row: targetRow };
              const b = compacted[otherKey];

              const overlapX = !(a.col + a.w <= b.col || a.col >= b.col + b.w);
              const overlapY = !(a.row + a.h <= b.row || a.row >= b.row + b.h);

              if (overlapX && overlapY) {
                collision = true;
                break;
              }
            }

            if (!collision) {
              compacted[key] = { ...compacted[key], row: targetRow };
              break;
            }
            targetRow++;
            if (targetRow > 10) break;
          }
        });

        return compacted;
      };

      const resolveCollisions = (targetId, nextLayout) => {
        const result = { ...nextLayout };
        const keys = Object.keys(result);
        const target = result[targetId];

        target.col = Math.max(1, Math.min(8 - target.w + 1, target.col));
        target.row = Math.max(1, Math.min(8, target.row));

        keys.forEach((otherId) => {
          if (otherId === targetId) return;
          const other = result[otherId];

          const overlapX = !(target.col + target.w <= other.col || target.col >= other.col + other.w);
          const overlapY = !(target.row + target.h <= other.row || target.row >= other.row + other.h);

          if (overlapX && overlapY) {
            result[otherId] = {
              ...other,
              row: target.row + target.h
            };
          }
        });

        return compactLayout(result, targetId);
      };

      const getGridCoordFromPointer = (clientX, clientY) => {
        if (!gridContainerRef.current) return { col: 1, row: 1 };
        const rect = gridContainerRef.current.getBoundingClientRect();
        const cellWidth = Math.max(20, rect.width / 8);
        const cellHeight = 90;

        const rawCol = Math.floor((clientX - rect.left) / cellWidth) + 1;
        const rawRow = Math.floor((clientY - rect.top) / cellHeight) + 1;

        const col = Math.max(1, Math.min(8, rawCol));
        const row = Math.max(1, Math.min(8, rawRow));
        return { col, row };
      };

      const handleStartDrag = (id, e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        const current = gridLayoutRef.current[id] || { col: 1, row: 1, w: 4, h: 4 };
        const coord = getGridCoordFromPointer(clientX, clientY);

        dragStartOffset.current = {
          mouseX: clientX,
          mouseY: clientY,
          grabColOffset: coord.col - current.col,
          grabRowOffset: coord.row - current.row,
          origCol: current.col,
          origRow: current.row,
          origW: current.w,
          origH: current.h,
          isDraggingActive: false
        };

        activeDragIdRef.current = id;
        resizingIdRef.current = null;
        setActiveDragId(id);
        setResizingId(null);
      };

      const handleStartResize = (id, direction, e) => {
        e.preventDefault();
        e.stopPropagation();

        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
        const current = gridLayoutRef.current[id] || { col: 1, row: 1, w: 4, h: 4 };

        dragStartOffset.current = {
          mouseX: clientX,
          mouseY: clientY,
          direction,
          origCol: current.col,
          origRow: current.row,
          origW: current.w,
          origH: current.h,
          isDraggingActive: true
        };

        resizingIdRef.current = { id, direction };
        activeDragIdRef.current = null;
        setResizingId({ id, direction });
        setActiveDragId(null);
      };

      useEffect(() => {
        const handleMove = (e) => {
          const currentDrag = activeDragIdRef.current;
          const currentResize = resizingIdRef.current;

          if (!currentDrag && !currentResize) return;

          const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
          const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

          const deltaX = Math.abs(clientX - dragStartOffset.current.mouseX);
          const deltaY = Math.abs(clientY - dragStartOffset.current.mouseY);
          if (deltaX < 4 && deltaY < 4 && !dragStartOffset.current.isDraggingActive) {
            return;
          }
          dragStartOffset.current.isDraggingActive = true;

          const coords = getGridCoordFromPointer(clientX, clientY);
          setHoverCoord(coords);

          const currentLayout = gridLayoutRef.current;

          if (currentDrag) {
            const item = currentLayout[currentDrag];
            if (!item) return;

            const targetCol = coords.col - (dragStartOffset.current.grabColOffset || 0);
            const targetRow = coords.row - (dragStartOffset.current.grabRowOffset || 0);

            const clampedCol = Math.max(1, Math.min(8 - item.w + 1, targetCol));
            const clampedRow = Math.max(1, Math.min(6, targetRow));

            if (clampedCol !== item.col || clampedRow !== item.row) {
              const updated = {
                ...currentLayout,
                [currentDrag]: { ...item, col: clampedCol, row: clampedRow, h: dragStartOffset.current.origH }
              };
              saveLayout(resolveCollisions(currentDrag, updated));
            }
          } else if (currentResize) {
            const { id, direction } = currentResize;
            const item = currentLayout[id];
            if (!item) return;

            const limits = MIN_CONSTRAINTS[id] || { minW: 3, minH: 2 };
            const { origCol, origRow, origW, origH } = dragStartOffset.current;
            const origRight = origCol + origW - 1;
            const origBottom = origRow + origH - 1;

            let newCol = origCol;
            let newRow = origRow;
            let newW = origW;
            let newH = origH;

            if (direction.includes('e')) {
              newW = Math.max(limits.minW, Math.min(8 - origCol + 1, coords.col - origCol + 1));
            } else if (direction.includes('w')) {
              const candidateCol = Math.max(1, Math.min(origRight - limits.minW + 1, coords.col));
              newCol = candidateCol;
              newW = origRight - candidateCol + 1;
            }

            if (direction.includes('s')) {
              newH = Math.max(limits.minH, Math.min(6, coords.row - origRow + 1));
            } else if (direction.includes('n')) {
              const candidateRow = Math.max(1, Math.min(origBottom - limits.minH + 1, coords.row));
              newRow = candidateRow;
              newH = origBottom - candidateRow + 1;
            }

            if (newCol !== item.col || newRow !== item.row || newW !== item.w || newH !== item.h) {
              const updated = {
                ...currentLayout,
                [id]: { ...item, col: newCol, row: newRow, w: newW, h: newH }
              };
              saveLayout(resolveCollisions(id, updated));
            }
          }
        };

        const handleEnd = () => {
          const finishedDrag = activeDragIdRef.current;
          const finishedResize = resizingIdRef.current;

          if (finishedDrag || finishedResize) {
            const finalClean = compactLayout(gridLayoutRef.current, null);
            saveLayout(finalClean);
          }

          dragStartOffset.current.isDraggingActive = false;
          activeDragIdRef.current = null;
          resizingIdRef.current = null;
          setActiveDragId(null);
          setResizingId(null);
          setHoverCoord(null);
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleEnd);
        window.addEventListener("pointercancel", handleEnd);

        return () => {
          window.removeEventListener("pointermove", handleMove);
          window.removeEventListener("pointerup", handleEnd);
          window.removeEventListener("pointercancel", handleEnd);
        };
      }, []);

      const resetLayout = () => {
        saveLayout(DEFAULT_GRID_LAYOUT);
        showNotification("Layout reset to default positions");
      };

      const cycleWidgetPreset = (id, e) => {
        e.stopPropagation();
        const current = gridLayout[id];
        let nextW = 4;
        let nextH = 4;
        if (current.w <= 2) { nextW = 4; nextH = 4; }
        else if (current.w <= 4) { nextW = 8; nextH = current.h; }
        else { nextW = 4; nextH = 3; }

        const clampedCol = Math.min(8 - nextW + 1, current.col);
        const updated = {
          ...gridLayout,
          [id]: { ...current, col: clampedCol, w: nextW, h: nextH }
        };
        saveLayout(resolveCollisions(id, updated));
      };

      useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
      }, []);

      const showNotification = (msg) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3500);
      };

      const toggleCheck = (id) => {
        const next = { ...completed, [id]: !completed[id] };
        setCompleted(next);
        try {
          localStorage.setItem("milestones_cache", JSON.stringify(next));
        } catch(e) {}
      };

      const currentFormattedTime = useMemo(() => {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: selectedTz,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(now);
      }, [now, selectedTz]);

      const currentFormattedDate = useMemo(() => {
        return new Intl.DateTimeFormat("en-US", {
          timeZone: selectedTz,
          weekday: "short",
          day: "2-digit",
          month: "short"
        }).format(now);
      }, [now, selectedTz]);

      const diffMs = Math.max(0, TARGET_DEADLINE - now);
      const totalSec = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSec / (3600 * 24));
      const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = totalSec % 60;

      const isRadialActive = forceRadialMode || (days === 0 && hours < 24);
      const dialCircumference = 2 * Math.PI * 40;
      const dialOffset = dialCircumference * (1 - ((minutes % 60) * 60 + seconds) / 3600);

      const generateGCalUrl = (m) => {
        const start = new Date(m.isoDate).toISOString().replace(/-|:|\.\d\d\d/g, "");
        const end = new Date(new Date(m.isoDate).getTime() + 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
        const details = encodeURIComponent(`${m.desc}\n\nMilestone Tag: ${m.tag}\nPortfolio Submission Roadmap`);
        const title = encodeURIComponent(`[${m.tag}] ${m.title}`);
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${start}/${end}`;
      };

      const downloadAllIcs = () => {
        let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Portfolio Submission Sprint//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";
        INITIAL_MILESTONES.forEach(m => {
          const start = new Date(m.isoDate).toISOString().replace(/-|:|\.\d\d\d/g, "");
          const end = new Date(new Date(m.isoDate).getTime() + 3600000).toISOString().replace(/-|:|\.\d\d\d/g, "");
          icsContent += `BEGIN:VEVENT\nSUMMARY:[${m.tag}] ${m.title}\nDESCRIPTION:${m.desc}\nDTSTART:${start}\nDTEND:${end}\nSTATUS:CONFIRMED\nEND:VEVENT\n`;
        });
        icsContent += "END:VCALENDAR";

        const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "portfolio-countdown-milestones.ics");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showNotification("All 6 milestones exported as .ics calendar!");
      };

      const completedCount = Object.values(completed).filter(Boolean).length;
      const progressPercent = Math.round((completedCount / INITIAL_MILESTONES.length) * 100);

      const renderWidgetContent = (type) => {
        const currentLayout = gridLayout[type] || { w: 4, h: 4 };
        const isCompact = currentLayout.w <= 3 || currentLayout.h <= 3;

        if (type === "countdown") {
          return (
            <div className={`w-full h-full rounded-2xl sm:rounded-3xl p-4 sm:p-6 transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
              theme === 'dark' ? 'glass-dark' : 'neu-raised'
            }`}>
              <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-[#8EB69B]/10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div 
                    onPointerDown={(e) => handleStartDrag("countdown", e)}
                    className="drag-handle p-1 -ml-1 text-[#8EB69B]/70 hover:text-[#DAF1DE] transition-colors cursor-grab active:cursor-grabbing select-none" 
                    title="Drag across grid coordinates"
                  >
                    <Icon name="grip" className="w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none" />
                  </div>
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#8EB69B] animate-pulse"></span>
                  <h2 className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-[#8EB69B]">
                    {isCompact ? "COUNTDOWN" : "T-MINUS COUNTDOWN"}
                  </h2>
                </div>

                <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#235347]/50 text-[#DAF1DE] border border-[#8EB69B]/30">
                  C:{currentLayout.col} R:{currentLayout.row} [{currentLayout.w}x{currentLayout.h}]
                </span>
              </div>

              {!isCompact && (
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[10px] sm:text-xs text-[#8EB69B] font-medium">Sub-24h Radial View</span>
                  <button
                    onClick={() => setForceRadialMode(!forceRadialMode)}
                    className={`relative inline-flex h-4 sm:h-5 w-8 sm:w-9 items-center rounded-full transition-colors ${
                      isRadialActive ? 'bg-[#FF3B30]' : (theme === 'dark' ? 'bg-[#163832]' : 'bg-[#8EB69B]/50')
                    }`}
                  >
                    <span className={`inline-block h-3 w-3 sm:h-3.5 sm:w-3.5 transform rounded-full bg-[#DAF1DE] transition-transform ${
                      isRadialActive ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              )}

              {isRadialActive ? (
                <div className="flex flex-col items-center justify-center my-2 sm:my-3">
                  <div className={`relative ${isCompact ? 'w-32 h-32' : 'w-44 h-44 sm:w-52 sm:h-52'} flex items-center justify-center`}>
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="44" stroke={theme === 'dark' ? 'rgba(142, 182, 155, 0.18)' : '#8EB69B'} strokeWidth="2" strokeDasharray="1.2 3.8" fill="none" />
                      <circle cx="50" cy="50" r="40" stroke={theme === 'dark' ? '#0B2B26' : '#c4dbca'} strokeWidth="5" fill="none" />
                      <circle cx="50" cy="50" r="40" stroke="#FF3B30" strokeWidth="5" strokeDasharray={dialCircumference} strokeDashoffset={dialOffset} strokeLinecap="round" fill="none" className="dial-glow transition-all duration-1000 ease-linear" />
                    </svg>
                    
                    <div className="absolute flex flex-col items-center text-center">
                      <div className="flex items-baseline font-mono tracking-tight drop-shadow-md">
                        <span className={`${isCompact ? 'text-xl' : 'text-2xl sm:text-4xl'} font-light ${theme === 'dark' ? 'text-[#DAF1DE]' : 'text-[#0B2B26]'}`}>
                          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                        </span>
                        <div className="flex flex-col ml-1 items-start">
                          <span className="text-[10px] sm:text-xs font-light text-red-500 leading-none">{Math.floor(hours)}</span>
                          <span className="text-[7px] sm:text-[8px] uppercase font-mono tracking-wider opacity-60 underline leading-none mt-0.5">min</span>
                        </div>
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-mono tracking-wider text-[#8EB69B] mt-1 uppercase">Final Stretch</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`grid ${isCompact ? 'grid-cols-2 gap-2 my-2' : 'grid-cols-4 gap-2 my-3'}`}>
                  {[
                    { label: "DAYS", val: days },
                    { label: "HOURS", val: hours },
                    { label: "MINS", val: minutes },
                    { label: "SECS", val: seconds }
                  ].map((item) => (
                    <div key={item.label} className={`flex flex-col items-center justify-center ${isCompact ? 'py-1.5' : 'py-2.5 sm:py-3'} rounded-xl border transition-all ${
                      theme === 'dark' ? 'glass-card border-[#8EB69B]/15' : 'neu-card'
                    }`}>
                      <span className={`${isCompact ? 'text-base sm:text-xl' : 'text-xl sm:text-2xl md:text-3xl'} font-bold font-mono tabular-nums tracking-tight text-[#8EB69B]`}>
                        {String(item.val).padStart(2, '0')}
                      </span>
                      <span className="text-[7px] sm:text-[8px] font-mono font-medium tracking-widest text-[#8EB69B]/80 mt-0.5">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className={`p-2 sm:p-2.5 rounded-xl flex items-center justify-between border ${
                theme === 'dark' ? 'bg-[#051F20]/70 border-[#8EB69B]/15' : 'neu-sunken border-transparent'
              }`}>
                <div>
                  <div className="text-[10px] sm:text-xs font-semibold text-[#DAF1DE]">PORTFOLIO SUBMISSION</div>
                  <div className="text-[8px] sm:text-[9px] text-[#8EB69B] font-mono mt-0.5">Nov 16, 2026 • 09:00 AM IST</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] sm:text-xs font-mono font-bold text-[#8EB69B]">
                    {days > 0 ? `${days}d Left` : `${hours}h ${minutes}m`}
                  </span>
                </div>
              </div>
            </div>
          );
        }

        if (type === "progress") {
          return (
            <div className={`w-full h-full p-4 sm:p-5 rounded-2xl sm:rounded-3xl transition-all flex flex-col justify-between ${
              theme === 'dark' ? 'glass-dark' : 'neu-raised'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2 text-xs">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div 
                      onPointerDown={(e) => handleStartDrag("progress", e)}
                      className="drag-handle p-1 -ml-1 text-[#8EB69B]/70 hover:text-[#DAF1DE] transition-colors cursor-grab active:cursor-grabbing select-none" 
                      title="Drag across grid coordinates"
                    >
                      <Icon name="grip" className="w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none" />
                    </div>
                    <span className="font-semibold text-[#8EB69B] uppercase tracking-wider font-mono text-[10px] sm:text-xs">
                      Roadmap Completion
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#235347]/50 text-[#DAF1DE] border border-[#8EB69B]/30">
                      C:{currentLayout.col} R:{currentLayout.row} [{currentLayout.w}x{currentLayout.h}]
                    </span>
                    <span className="font-mono font-bold text-[#8EB69B] text-xs sm:text-sm">{progressPercent}%</span>
                  </div>
                </div>
                <div className={`w-full h-2.5 sm:h-3 rounded-full overflow-hidden ${
                  theme === 'dark' ? 'bg-[#0B2B26]' : 'neu-sunken'
                }`}>
                  <div className="h-full bg-gradient-to-r from-[#163832] via-[#235347] to-[#8EB69B] transition-all duration-500 rounded-full" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
              <div className="flex justify-between items-center mt-2 text-[9px] sm:text-[10px] font-mono text-[#8EB69B] pt-2 border-t border-[#8EB69B]/10">
                <span>{completedCount}/6 Completed</span>
                <span className="font-semibold">{6 - completedCount} Left</span>
              </div>
            </div>
          );
        }

        if (type === "milestones") {
          return (
            <div className={`w-full h-full rounded-2xl sm:rounded-3xl p-4 sm:p-5 transition-all flex flex-col justify-between overflow-hidden ${
              theme === 'dark' ? 'glass-dark' : 'neu-raised'
            }`}>
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 sm:pb-3 border-b border-[#8EB69B]/15 mb-2 sm:mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div 
                      onPointerDown={(e) => handleStartDrag("milestones", e)}
                      className="drag-handle p-1 -ml-1 text-[#8EB69B]/70 hover:text-[#DAF1DE] transition-colors cursor-grab active:cursor-grabbing select-none flex-shrink-0" 
                      title="Drag across grid coordinates"
                    >
                      <Icon name="grip" className="w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none" />
                    </div>
                    <div className="p-1 sm:p-1.5 rounded-xl bg-[#235347]/40 text-[#8EB69B] flex-shrink-0">
                      <Icon name="check-square" className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-bold tracking-tight truncate">T-MINUS ROADMAP</h3>
                      <p className="text-[8px] sm:text-[9px] text-[#8EB69B] truncate">Tap to toggle milestone</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                    <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#235347]/50 text-[#DAF1DE] border border-[#8EB69B]/30 whitespace-nowrap">
                      C:{currentLayout.col} R:{currentLayout.row} [{currentLayout.w}x{currentLayout.h}]
                    </span>
                    <button
                      onClick={downloadAllIcs}
                      className={`px-2 py-1 rounded-xl text-[10px] sm:text-xs font-mono font-medium flex items-center gap-1 transition-all flex-shrink-0 ${
                        theme === 'dark' ? 'glass-card hover:bg-white/10 text-[#DAF1DE]' : 'neu-btn text-[#235347]'
                      }`}
                      title="Export .ics file"
                    >
                      <Icon name="download" className="w-3 h-3" />
                      <span className="whitespace-nowrap">.ICS</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1 custom-scroll min-h-0">
                  {INITIAL_MILESTONES.map((m, idx) => {
                    const isDone = !!completed[m.id];
                    const pillBgDark = [
                      'bg-[#163832]/65',
                      'bg-[#1a423b]/65',
                      'bg-[#235347]/65',
                      'bg-[#2c6356]/65',
                      'bg-[#377567]/65',
                      'bg-[#438a79]/65'
                    ][idx % 6];

                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleCheck(m.id)}
                        className={`group relative flex items-center justify-between p-2 sm:p-2.5 rounded-xl cursor-pointer border transition-all duration-200 flex-shrink-0 ${
                          isDone
                            ? theme === 'dark'
                              ? 'bg-[#0B2B26]/40 border-[#8EB69B]/10 opacity-45'
                              : 'neu-sunken opacity-60'
                            : theme === 'dark'
                            ? `${pillBgDark} backdrop-blur-md border-[#8EB69B]/20 hover:border-[#8EB69B]/50 hover:scale-[1.005]`
                            : 'neu-card hover:scale-[1.005]'
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <button type="button" className="mt-0.5 text-[#8EB69B] focus:outline-none transition-transform active:scale-90 flex-shrink-0">
                            {isDone ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-[#8EB69B] text-[#051F20] flex items-center justify-center font-bold">
                                <Icon name="check" className="w-2.5 h-2.5" />
                              </div>
                            ) : (
                              <div className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                                theme === 'dark' ? 'border-[#8EB69B]/50 group-hover:border-[#DAF1DE]' : 'border-[#8EB69B] group-hover:border-[#235347]'
                              }`} />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className={`text-[10px] sm:text-xs font-semibold truncate transition-all ${
                              isDone ? 'line-through text-[#8EB69B]/60' : (theme === 'dark' ? 'text-[#DAF1DE]' : 'text-[#0B2B26]')
                            }`}>
                              {m.title}
                            </div>
                            {!isCompact && (
                              <div className="text-[8px] sm:text-[9px] text-[#8EB69B] font-sans mt-0.5 line-clamp-1">{m.desc}</div>
                            )}
                            <div className="text-[7px] sm:text-[8px] font-mono text-[#8EB69B]/70 mt-0.5 flex items-center gap-1">
                              <Icon name="calendar" className="w-2.5 h-2.5 flex-shrink-0" />
                              <span>{m.dateStr}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 ml-2 flex-shrink-0">
                          <span className={`text-[7px] sm:text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                            isDone
                              ? 'bg-[#8EB69B]/20 text-[#8EB69B] border border-[#8EB69B]/30'
                              : theme === 'dark'
                              ? 'bg-[#DAF1DE] text-[#051F20] border border-[#DAF1DE]'
                              : 'neu-sunken text-[#235347] font-semibold'
                          }`}>
                            {m.tag}
                          </span>

                          {!isCompact && (
                            <a
                              href={generateGCalUrl(m)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-75 sm:opacity-0 group-hover:opacity-100 transition-opacity text-[7px] sm:text-[8px] font-mono text-[#8EB69B] hover:text-[#DAF1DE] hover:underline flex items-center gap-0.5"
                              title="Add event to Google Calendar"
                            >
                              <span>+GCal</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        }

        return null;
      };

      const isManipulating = !!(activeDragId || resizingId || isEditMode);

      return (
        <div className={`min-h-screen w-full transition-colors duration-500 font-sans flex flex-col items-center px-3 py-4 sm:px-6 sm:py-6 md:p-10 relative select-none ${
          theme === 'dark' ? 'bg-[#051F20] text-[#DAF1DE]' : 'bg-[#E8F4EC] text-[#0B2B26]'
        }`}>
          {/* Top Status Bar */}
          <header className="w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 sm:pb-6 z-20">
            <div className="w-full sm:w-auto flex flex-col xs:flex-row items-stretch sm:items-center gap-2">
              <div className={`w-full xs:w-auto flex-1 px-3 py-2 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-mono font-medium tracking-wide flex items-center justify-center xs:justify-start gap-2 transition-all whitespace-nowrap ${
                theme === 'dark' ? 'glass-card text-[#DAF1DE]' : 'neu-card text-[#163832]'
              }`}>
                <Icon name="clock" className="w-3.5 h-3.5 text-[#8EB69B] flex-shrink-0" />
                <span className="font-semibold whitespace-nowrap">{currentFormattedDate}</span>
                <span className="opacity-30">|</span>
                <span className="tabular-nums font-bold tracking-wider text-[#8EB69B] whitespace-nowrap">{currentFormattedTime}</span>
              </div>

              <div className={`w-full xs:w-auto flex items-center justify-between xs:justify-start gap-1 rounded-xl sm:rounded-2xl p-1 text-[10px] sm:text-xs font-mono transition-all ${
                theme === 'dark' ? 'glass-card' : 'neu-sunken'
              }`}>
                {TIMEZONES.map(tz => (
                  <button
                    key={tz.label}
                    onClick={() => setSelectedTz(tz.zone)}
                    className={`flex-1 xs:flex-none px-2.5 py-1 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl transition-all font-semibold text-center ${
                      selectedTz === tz.zone
                        ? theme === 'dark'
                          ? 'bg-[#235347] text-[#DAF1DE] shadow-md border border-[#8EB69B]/30'
                          : 'bg-[#235347] text-[#DAF1DE] shadow-sm'
                        : 'text-[#8EB69B] hover:text-[#DAF1DE]'
                    }`}
                  >
                    {tz.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full sm:w-auto flex items-center justify-end gap-2">
              <button
                onClick={resetLayout}
                className={`px-2.5 py-1.5 sm:py-2 rounded-xl text-xs font-mono font-medium transition-all ${
                  theme === 'dark' ? 'glass-card text-[#8EB69B] hover:text-[#DAF1DE]' : 'neu-btn text-[#163832]'
                }`}
                title="Reset layout grid"
              >
                Reset Grid
              </button>

              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex-1 sm:flex-none px-3 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs font-mono font-medium flex items-center justify-center gap-1.5 transition-all ${
                  isEditMode
                    ? 'bg-[#FF3B30] text-white shadow-lg shadow-red-500/30'
                    : theme === 'dark'
                    ? 'glass-card text-[#8EB69B] hover:bg-white/10'
                    : 'neu-btn text-[#163832]'
                }`}
                title="Toggle Grid Matrix Coordinate Mode"
              >
                <Icon name="settings" className="w-3.5 h-3.5" />
                <span>{isEditMode ? "Lock Grid" : "Grid Mode"}</span>
              </button>

              <button
                onClick={() => setShowCalendarModal(true)}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                  theme === 'dark' ? 'glass-card text-[#DAF1DE] hover:bg-white/10' : 'neu-btn text-[#163832] hover:text-[#235347]'
                }`}
                title="Add to Google / Apple Calendar"
              >
                <Icon name="calendar" className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8EB69B]" />
                <span className="hidden xs:inline sm:inline">Sync</span>
              </button>

              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all ${
                  theme === 'dark' ? 'glass-card text-[#8EB69B] hover:bg-white/10' : 'neu-btn text-[#163832] hover:text-[#235347]'
                }`}
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Icon name="sun" className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Icon name="moon" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>
            </div>
          </header>

          {/* Blueprint Grid Overlay */}
          {isManipulating && (
            <div className={`fixed inset-0 pointer-events-none z-10 transition-opacity duration-300 ${
              theme === 'dark' ? 'blueprint-grid-dark bg-[#051F20]/50' : 'blueprint-grid-light bg-[#E8F4EC]/50'
            }`}>
              <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-mono tracking-wider bg-[#235347] text-[#DAF1DE] border border-[#8EB69B]/40 shadow-xl flex items-center gap-2 max-w-[90vw] text-center justify-center">
                <span className="w-2 h-2 rounded-full bg-[#8EB69B] animate-ping flex-shrink-0"></span>
                <span>
                  {activeDragId ? `DRAGGING: ${activeDragId.toUpperCase()} • HOVER [C:${hoverCoord?.col || 1}, R:${hoverCoord?.row || 1}]` :
                   resizingId ? `RESIZING: ${resizingId.id.toUpperCase()} (${resizingId.direction.toUpperCase()}) • DRAG TO SCALE` :
                   "GRID COORDINATE MODE • DRAG ANYWHERE OR RESIZE CORNER"}
                </span>
              </div>
            </div>
          )}

          {/* 8-Column Responsive Matrix Canvas */}
          <main 
            ref={gridContainerRef}
            className="w-full max-w-6xl grid grid-cols-8 auto-rows-[minmax(85px,auto)] gap-3 sm:gap-4 relative z-20 min-h-[500px]"
          >
            {Object.keys(gridLayout).map((widgetId) => {
              const item = gridLayout[widgetId];
              const isDragging = activeDragId === widgetId;
              const isResizingThis = resizingId && resizingId.id === widgetId;

              const gridStyle = {
                gridColumn: `${Math.max(1, Math.min(8, item.col))} / span ${Math.max(1, Math.min(8, item.w))}`,
                gridRow: `${Math.max(1, item.row)} / span ${Math.max(1, item.h)}`
              };

              return (
                <div
                  key={widgetId}
                  style={gridStyle}
                  className={`group relative transition-shadow duration-200 flex flex-col ${
                    isEditMode ? 'widget-jiggle' : ''
                  } ${isDragging ? 'widget-dragging ring-2 ring-[#8EB69B]' : ''} ${
                    isResizingThis ? 'ring-2 ring-emerald-400 opacity-95' : ''
                  }`}
                >
                  {isEditMode && (
                    <div className="absolute -top-3 left-3 z-30 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-[#163832] text-[#DAF1DE] border border-[#8EB69B]/40 shadow-md">
                        Col {item.col} • Row {item.row} ({item.w}x{item.h})
                      </span>
                      <button
                        onClick={(e) => cycleWidgetPreset(widgetId, e)}
                        className="px-1.5 py-0.5 rounded-md text-[8px] font-mono bg-[#235347] text-[#DAF1DE] hover:bg-[#0B2B26] border border-[#8EB69B]/30"
                        title="Preset resize"
                      >
                        Auto-Fit
                      </button>
                    </div>
                  )}

                  {renderWidgetContent(widgetId)}

                  {/* 4 Corner Handles */}
                  <div onPointerDown={(e) => handleStartResize(widgetId, 'nw', e)} className="resize-handle-corner handle-nw select-none">
                    <div className="handle-indicator-corner pointer-events-none" />
                  </div>
                  <div onPointerDown={(e) => handleStartResize(widgetId, 'ne', e)} className="resize-handle-corner handle-ne select-none">
                    <div className="handle-indicator-corner pointer-events-none" />
                  </div>
                  <div onPointerDown={(e) => handleStartResize(widgetId, 'sw', e)} className="resize-handle-corner handle-sw select-none">
                    <div className="handle-indicator-corner pointer-events-none" />
                  </div>
                  <div onPointerDown={(e) => handleStartResize(widgetId, 'se', e)} className="resize-handle-corner handle-se select-none">
                    <div className="handle-indicator-corner pointer-events-none" />
                  </div>

                  {/* 4 Edge Handles */}
                  <div onPointerDown={(e) => handleStartResize(widgetId, 'n', e)} className="resize-handle-edge handle-n select-none flex items-center justify-center">
                    <div className="w-8 h-1 handle-indicator-edge pointer-events-none" />
                  </div>
                  <div onPointerDown={(e) => handleStartResize(widgetId, 's', e)} className="resize-handle-edge handle-s select-none flex items-center justify-center">
                    <div className="w-8 h-1 handle-indicator-edge pointer-events-none" />
                  </div>
                  <div onPointerDown={(e) => handleStartResize(widgetId, 'w', e)} className="resize-handle-edge handle-w select-none flex items-center justify-center">
                    <div className="w-1 h-8 handle-indicator-edge pointer-events-none" />
                  </div>
                  <div onPointerDown={(e) => handleStartResize(widgetId, 'e', e)} className="resize-handle-edge handle-e select-none flex items-center justify-center">
                    <div className="w-1 h-8 handle-indicator-edge pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </main>

          {/* Toast Notification */}
          {toastMsg && (
            <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 z-50 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-2xl bg-[#235347] text-[#DAF1DE] border border-[#8EB69B]/40 font-mono text-xs shadow-2xl flex items-center justify-center sm:justify-start gap-2">
              <Icon name="check-circle" className="w-4 h-4 text-[#8EB69B] flex-shrink-0" />
              <span className="truncate">{toastMsg}</span>
            </div>
          )}

          {/* Calendar Sync Modal */}
          {showCalendarModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
              <div className={`w-full max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 border transition-all ${
                theme === 'dark' ? 'glass-dark text-[#DAF1DE] border-[#8EB69B]/20' : 'neu-card text-[#0B2B26]'
              }`}>
                <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#8EB69B]/15">
                  <div className="flex items-center gap-2">
                    <Icon name="calendar" className="w-4 h-4 sm:w-5 sm:h-5 text-[#8EB69B]" />
                    <h3 className="font-bold text-xs sm:text-sm">Add Milestones to Calendar</h3>
                  </div>
                  <button onClick={() => setShowCalendarModal(false)} className="p-1.5 rounded-full hover:bg-white/10 text-[#8EB69B]">
                    <Icon name="x" className="w-4 h-4" />
                  </button>
                </div>

                <div className="py-3 sm:py-4 text-xs space-y-3">
                  <p className="text-[#8EB69B] text-[11px] sm:text-xs">
                    Sync your 10-day backward sprint plan to your calendar. No account linking or backend required:
                  </p>

                  <div className="space-y-2 mt-3">
                    <button
                      onClick={() => {
                        downloadAllIcs();
                        setShowCalendarModal(false);
                      }}
                      className="w-full py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-[#235347] hover:bg-[#163832] text-[#DAF1DE] border border-[#8EB69B]/40 font-medium flex items-center justify-center gap-2 transition-colors text-xs"
                    >
                      <Icon name="download" className="w-3.5 h-3.5" />
                      <span>Download .ICS (Apple & Outlook)</span>
                    </button>

                    <div className="text-[10px] sm:text-[11px] font-mono text-center text-[#8EB69B] my-1.5">— OR ADD INDIVIDUALLY TO GOOGLE CALENDAR —</div>

                    <div className="max-h-40 sm:max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                      {INITIAL_MILESTONES.map((m) => (
                        <a
                          key={m.id}
                          href={generateGCalUrl(m)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border text-[10px] sm:text-[11px] font-mono transition-colors ${
                            theme === 'dark' ? 'hover:bg-white/5 border-[#8EB69B]/15 text-[#DAF1DE]' : 'hover:bg-[#DAF1DE]/40 border-[#8EB69B]/30 text-[#0B2B26]'
                          }`}
                        >
                          <span className="truncate mr-2">{m.tag}: {m.title}</span>
                          <span className="text-[#8EB69B] font-semibold flex items-center gap-1 flex-shrink-0">
                            Add <Icon name="external-link" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <button onClick={() => setShowCalendarModal(false)} className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs font-mono text-[#8EB69B] hover:text-[#DAF1DE]">
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
  </script>
</body>
</html>
```

---

## 6. Deployment Instructions

1. **Standalone Deployment (GitHub Pages, Vercel, Netlify)**:
   * Save the snippet above as `index.html`.
   * Host it statically on any CDN or static hosting platform. No Node.js build step or runtime server is required.
2. **Local Preview**:
   * Double-click `index.html` to open it in any modern browser (Chrome, Safari, Edge, Firefox).

---

## 7. Mobile App & Store Distribution Architecture

### 7.1 Architectural Strategy Comparison

| Approach | Setup Time | App Store / Play Store | Native Hardware Access | Recommended For |
| :--- | :--- | :--- | :--- | :--- |
| **PWA (Progressive Web App)** | ~5 minutes | No (Direct from Browser) | Limited (Service Workers, Storage) | Instant testing, fast distribution, zero app store fees. |
| **Capacitor (Ionic)** | ~20 minutes | **Yes** (IPA / AAB packages) | **Full** (Haptics, Device Calendar, Push Notifications) | **Strongly Recommended**: Wraps existing `index.html` code as-is. |
| **React Native / Expo** | Rebuild required | **Yes** (Native SwiftUI / Kotlin) | Full + iOS 16 Lock Screen WidgetKit | Deep OS home screen widgets and Dynamic Island integration. |

---

### 7.2 Option 1: PWA (Instant Installable App — Zero Store Approval)

A Progressive Web App enables users to install the dashboard onto their phone home screen directly from Safari (iOS) or Chrome (Android) without the browser URL bar.

#### Step 1: Create `manifest.json`
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

#### Step 2: Register Service Worker in `index.html`
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

#### Step 3: Add `sw.js` (Offline Cache)
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

### 7.3 Option 2: Capacitor Native Wrapper (Recommended for App Stores)

Capacitor creates native Xcode (iOS) and Android Studio (Android) container projects that bundle your web files directly. You write standard JavaScript, while Capacitor compiles to an actual `.ipa` (iOS) or `.aab`/`.apk` (Android).

#### Step 1: Project Setup

```bash
# 1. Initialize npm in your project folder (if not done already)
npm init -y

# 2. Install Capacitor Core and CLI
npm install @capacitor/core
npm install -D @capacitor/cli

# 3. Initialize your app details
npx cap init "T-Minus Countdown" "com.yourname.tminus" --web-dir "."
```

#### Step 2: Add Native Platforms

```bash
# Install platform runtimes
npm install @capacitor/ios @capacitor/android

# Add iOS and Android project wrappers
npx cap add ios
npx cap add android
```

#### Step 3: Add Native Device Plugins

Enhance the mobile experience with real physical haptics and local notification reminders:

```bash
# Haptic tactile vibrations on dragging/resizing
npm install @capacitor/haptics

# Local push notifications when a milestone is approaching
npm install @capacitor/local-notifications
```

##### Calling Native Plugins from React:

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

#### Step 4: Sync & Build Native Apps

Whenever you modify your HTML or code:

```bash
# Sync web code into the native iOS and Android folders
npx cap sync
```

##### Launching in iOS Xcode:
```bash
npx cap open ios
```
* Opens Xcode automatically.
* Select your target iPhone simulator or plug in a physical iPhone.
* Under **Signing & Capabilities**, select your Apple Developer Team.
* Hit **Run** (Command + R) to launch the app natively on your iPhone.
* Select **Product > Archive** to publish to TestFlight or the **Apple App Store**.

##### Launching in Android Studio:
```bash
npx cap open android
```
* Opens Android Studio automatically.
* Click **Run 'app'** (Shift + F10) to test on an Android emulator or plugged-in phone.
* Go to **Build > Generate Signed Bundle / APK** to create an `.aab` file ready for the **Google Play Console**.

---

### 7.4 Option 3: React Native / Expo (For True iOS Lock Screen & Home Screen Widgets)

If your goal is to build an **actual iOS Home Screen Widget** (that sits next to system icons without opening the app) or an **iOS 16 Lock Screen Widget**:

1. Web apps and web wrappers (PWA/Capacitor) cannot render native system widgets. Apple requires **WidgetKit** written in Swift, and Android requires **AppWidgetProvider**.
2. To build system widgets:
   - Use **Expo (React Native)** with an Expo config plugin like `@bittingz/expo-widgets` or `react-native-widgetkit`.
   - The countdown logic and milestones can be shared via a common state store, while the mini widget UI is rendered natively using SwiftUI.

---

### 7.5 Summary Recommendation

* **For immediate testing right now**: Add `manifest.json` and deploy to Vercel/Netlify. Open Safari on iPhone, tap "Share", and select **"Add to Home Screen"** (PWA).
* **For publishing to the Apple App Store & Google Play Store**: Use **Capacitor**. It uses your exact `index.html` code, requires no rewrite, and provides native haptics and notifications.

---

## 7. Mobile App & Store Distribution Architecture

### 7.1 Architectural Strategy Comparison

| Approach | Setup Time | App Store / Play Store | Native Hardware Access | Recommended For |
| :--- | :--- | :--- | :--- | :--- |
| **PWA (Progressive Web App)** | ~5 minutes | No (Direct from Browser) | Limited (Service Workers, Storage) | Instant testing, fast distribution, zero app store fees. |
| **Capacitor (Ionic)** | ~20 minutes | **Yes** (IPA / AAB packages) | **Full** (Haptics, Device Calendar, Push Notifications) | **Strongly Recommended**: Wraps existing `index.html` code as-is. |
| **React Native / Expo** | Rebuild required | **Yes** (Native SwiftUI / Kotlin) | Full + iOS 16 Lock Screen WidgetKit | Deep OS home screen widgets and Dynamic Island integration. |

---

### 7.2 Option 1: PWA (Instant Installable App — Zero Store Approval)

A Progressive Web App enables users to install the dashboard onto their phone home screen directly from Safari (iOS) or Chrome (Android) without the browser URL bar.

#### Step 1: Create `manifest.json`
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

#### Step 2: Register Service Worker in `index.html`
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

#### Step 3: Add `sw.js` (Offline Cache)
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

### 7.3 Option 2: Capacitor Native Wrapper (Recommended for App Stores)

Capacitor creates native Xcode (iOS) and Android Studio (Android) container projects that bundle your web files directly. You write standard JavaScript, while Capacitor compiles to an actual `.ipa` (iOS) or `.aab`/`.apk` (Android).

#### Step 1: Project Setup

```bash
# 1. Initialize npm in your project folder (if not done already)
npm init -y

# 2. Install Capacitor Core and CLI
npm install @capacitor/core
npm install -D @capacitor/cli

# 3. Initialize your app details
npx cap init "T-Minus Countdown" "com.yourname.tminus" --web-dir "."
```

#### Step 2: Add Native Platforms

```bash
# Install platform runtimes
npm install @capacitor/ios @capacitor/android

# Add iOS and Android project wrappers
npx cap add ios
npx cap add android
```

#### Step 3: Add Native Device Plugins

Enhance the mobile experience with real physical haptics and local notification reminders:

```bash
# Haptic tactile vibrations on dragging/resizing
npm install @capacitor/haptics

# Local push notifications when a milestone is approaching
npm install @capacitor/local-notifications
```

##### Calling Native Plugins from React:

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

#### Step 4: Sync & Build Native Apps

Whenever you modify your HTML or code:

```bash
# Sync web code into the native iOS and Android folders
npx cap sync
```

##### Launching in iOS Xcode:
```bash
npx cap open ios
```
* Opens Xcode automatically.
* Select your target iPhone simulator or plug in a physical iPhone.
* Under **Signing & Capabilities**, select your Apple Developer Team.
* Hit **Run** (Command + R) to launch the app natively on your iPhone.
* Select **Product > Archive** to publish to TestFlight or the **Apple App Store**.

##### Launching in Android Studio:
```bash
npx cap open android
```
* Opens Android Studio automatically.
* Click **Run 'app'** (Shift + F10) to test on an Android emulator or plugged-in phone.
* Go to **Build > Generate Signed Bundle / APK** to create an `.aab` file ready for the **Google Play Console**.

---

### 7.4 Option 3: React Native / Expo (For True iOS Lock Screen & Home Screen Widgets)

If your goal is to build an **actual iOS Home Screen Widget** (that sits next to system icons without opening the app) or an **iOS 16 Lock Screen Widget**:

1. Web apps and web wrappers (PWA/Capacitor) cannot render native system widgets. Apple requires **WidgetKit** written in Swift, and Android requires **AppWidgetProvider**.
2. To build system widgets:
   - Use **Expo (React Native)** with an Expo config plugin like `@bittingz/expo-widgets` or `react-native-widgetkit`.
   - The countdown logic and milestones can be shared via a common state store, while the mini widget UI is rendered natively using SwiftUI.

---

### 7.5 Summary Recommendation

* **For immediate testing right now**: Add `manifest.json` and deploy to Vercel/Netlify. Open Safari on iPhone, tap "Share", and select **"Add to Home Screen"** (PWA).
* **For publishing to the Apple App Store & Google Play Store**: Use **Capacitor**. It uses your exact `index.html` code, requires no rewrite, and provides native haptics and notifications.


---

## 8. Mobile Viewport Refinement, Stable Drag Physics & Lowest Minimization Limits

### 8.1 Root Cause Analysis of Mobile Squishing

When running on mobile devices (e.g. 360px – 390px viewports like iPhone or modern Android phones), applying an explicit 8-column CSS grid where widgets had fixed coordinate spans (`gridColumn: 1 / span 4` for Countdown and `gridColumn: 5 / span 4` for Milestones) produced columns measuring only ~140px in width. 

This resulted in:
1. **Severe lateral crushing**: Milestone items, tag badges, and calendar icons were forced into a narrow 140px slit, causing words to truncate with ellipses (`Audit ...`, `Finaliz...`, `Compl...`) and dates to split vertically across 3 lines (`Nov \n 06, \n 2026`).
2. **Countdown distortion**: The 4 numeric countdown digit boxes were forced into a cramped 2x2 grid at the bottom, leaving empty space above.
3. **Service worker stale caching**: Browser instances had cached older HTML bundles (`t-minus-v1`) that still carried `truncate` classes on titles.

---

### 8.2 Responsive Fluid Stack Architecture

The layout engine now differentiates between mobile touch screens (`< 640px`) and tablet/desktop workspaces (`>= 640px`):

```css
/* Responsive Dashboard Grid & Widgets */
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-auto-rows: minmax(44px, auto);
  gap: 16px;
}

@media (max-width: 639px) {
  .dashboard-grid {
    display: flex !important;
    flex-direction: column !important;
    gap: 16px !important;
  }
  .dashboard-widget {
    width: 100% !important;
    min-width: 100% !important;
    order: var(--widget-order, 0);
  }
  /* Horizontal resize handles hidden on mobile */
  .handle-w, .handle-e, .handle-nw, .handle-ne, .handle-sw, .handle-se {
    display: none !important;
  }
}
```

* **On Mobile (`< 640px`)**: Widgets automatically occupy 100% width, stacked vertically in priority order (`order: (row * 10) + col`), guaranteeing ample horizontal room for full titles, descriptions, and metadata.
* **On Desktop (`>= 640px`)**: The full 8-column 2D matrix coordinate grid is utilized with 8-way directional resize handles.

---

### 8.3 Lowest Minimization Limits: 44px Base Matrix Row & One-Touch Minimize

To allow widgets to be minimized much lower, the grid row base height was reduced from 85px to **44px** (`minmax(44px, auto)`).
* `MIN_CONSTRAINTS`: Lowered to `{ minW: 1, minH: 1 }` for all widgets.
* At `h: 1`, widgets compress into an ultra-slim single-line 44px bar.
* **One-Touch Minimize Button**: Each widget header features a dedicated minimize/maximize toggle icon (`minimize` / `maximize`). Clicking it immediately collapses the component to its lowest limit (44px bar) or expands it back with zero drag effort required.

---

### 8.4 Monotonic Physics Engine & Collision Stabilization

Previous dragging and resizing behavior suffered from violent oscillations and jitter because `compactLayout` was invoked on every pointer move event.

**Engineered Stabilization**:
1. **Pointer Capture**: `handleStartDrag` and `handleStartResize` invoke `e.target.setPointerCapture(e.pointerId)` so tracking never drops outside window or touch boundaries.
2. **Monotonic Cascade Resolution**: Collisions are resolved purely downwards in a single-direction cascade without running high-frequency vertical compaction during pointer movement.
3. **Lock Active Target on Release**: On `pointerup`, the target widget remains locked exactly where placed, and pointer capture is cleanly released.

---

### 8.5 Symmetric Typography & Non-Breaking Date Metadata

All remaining `truncate` classes on milestone items and card headers have been replaced with responsive wrapping:
* **Milestone Titles**: `text-xs sm:text-sm font-semibold break-words leading-snug`
* **Descriptions**: `text-[10px] sm:text-[11px] text-[#8EB69B] font-sans mt-0.5 break-words leading-relaxed`
* **Date Badge**: `whitespace-nowrap font-mono text-[9px] sm:text-[10px]` ensures `Nov 06, 2026` never splits across lines.
* **Right-Aligned Badges**: Tag pill (`T-10`) and `+GCal` link are symmetrically anchored to the upper right corner.

---

### 8.6 Network-First Service Worker Strategy (`sw.js` v3)

`sw.js` has been updated to cache version `t-minus-v3` with a **Network-First** strategy for HTML document requests:
* When online, navigation requests fetch the latest `index.html` from the server immediately, bypassing stale local caches.
* When offline, it automatically serves the pre-cached PWA offline bundle.
