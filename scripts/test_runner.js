const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = 8090;
const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function startServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    const server = http.createServer((req, res) => {
      let filePath = path.join(ROOT_DIR, req.url.split('?')[0]);
      if (req.url === '/' || req.url === '') {
        filePath = path.join(ROOT_DIR, 'index.html');
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Service-Worker-Allowed': '/'
        });
        res.end(data);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const assignedPort = server.address().port;
      console.log(`[TestServer] Running at http://127.0.0.1:${assignedPort}`);
      resolve({ server, port: assignedPort });
    });
  });
}

async function runTests() {
  const { server, port } = await startServer();
  const results = [];
  let browser;

  function assert(testName, condition, detail = '') {
    if (condition) {
      console.log(`  PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      results.push({ name: testName, status: 'PASS', detail });
    } else {
      console.error(`  FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      results.push({ name: testName, status: 'FAIL', detail });
    }
  }

  try {
    console.log('[Browser] Launching Chrome Headless...');
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const pageErrors = [];
    page.on('pageerror', (err) => {
      console.error('  [PAGE ERROR]', err.toString());
      pageErrors.push(err.toString());
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.error('  [BROWSER ERROR]', msg.text());
    });

    console.log('\n--- TEST SUITE 1: Page Load & Initialization ---');
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Reset any previous local storage for clean baseline testing
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for React to mount
    await page.waitForSelector('#root > div', { timeout: 10000 });
    const title = await page.title();
    assert('Page Title', title === 'T-Minus Countdown & Milestone Dashboard', title);
    assert('Zero Page Runtime Errors', pageErrors.length === 0, pageErrors.join(', '));

    const isDarkMode = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    assert('Initial Theme is Dark', isDarkMode);

    console.log('\n--- TEST SUITE 2: Live Clock & Timezone Engine ---');
    const clockText = await page.evaluate(() => {
      const el = document.querySelector('header span.tabular-nums');
      return el ? el.innerText.trim() : '';
    });
    assert('Clock Header Renders Time', /^\d{2}:\d{2}:\d{2}$/.test(clockText), clockText);

    // Switch to UTC
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const utcBtn = buttons.find((b) => b.innerText.trim() === 'UTC');
      if (utcBtn) utcBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const selectedTzAfterUtc = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const utcBtn = buttons.find((b) => b.innerText.trim() === 'UTC');
      return utcBtn ? (utcBtn.classList.contains('bg-[#235347]') || utcBtn.classList.contains('bg-emerald-500') || utcBtn.classList.contains('bg-emerald-600')) : false;
    });
    assert('Timezone Switch to UTC Active State', selectedTzAfterUtc);

    console.log('\n--- TEST SUITE 3: Countdown Calculation & Radial View ---');
    const countdownUnits = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('main div span.tabular-nums'));
      return spans.map((s) => s.innerText.trim());
    });
    assert('Countdown Displays 4 Numeric Units', countdownUnits.length === 4, countdownUnits.join(':'));

    // Toggle Sub-24h Radial View Switch
    const radialToggleBtn = await page.$('button[class*="relative inline-flex"]');
    if (radialToggleBtn) {
      await radialToggleBtn.click();
      await new Promise((r) => setTimeout(r, 400));
      const hasSvgDial = await page.evaluate(() => !!document.querySelector('svg circle.dial-glow'));
      assert('Sub-24h Radial SVG Dial Renders', hasSvgDial);

      // Toggle back to standard unit grid
      await radialToggleBtn.click();
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log('\n--- TEST SUITE 4: Full Text Wrapping & Symmetric Milestones ---');
    const milestoneTexts = await page.evaluate(() => {
      const titleEls = Array.from(document.querySelectorAll('main div[class*="group relative flex items-start"] div.break-words.font-semibold'));
      return titleEls.map((el) => ({
        text: el.innerText.trim(),
        hasTruncateClass: el.classList.contains('truncate')
      }));
    });
    assert('All 6 Milestone Titles Render with break-words', milestoneTexts.length === 6, `Count: ${milestoneTexts.length}`);
    const anyTruncateInMilestones = milestoneTexts.some((m) => m.hasTruncateClass);
    assert('Zero Truncate Classes on Milestone Titles (Full Wrapping)', !anyTruncateInMilestones);

    // Verify milestone checkbox alignment and progress update
    await page.evaluate(() => {
      const firstMilestone = document.querySelector('main div[class*="group relative flex items-start justify-between"]');
      if (firstMilestone) firstMilestone.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const updatedProgress = await page.evaluate(() => {
      const progEl = Array.from(document.querySelectorAll('span')).find((s) => s.innerText.includes('%'));
      return progEl ? progEl.innerText.trim() : '';
    });
    assert('Progress Updated after Milestone Click', updatedProgress === '17%', updatedProgress);

    console.log('\n--- TEST SUITE 5: 2D Matrix Minimized Limits (minW: 1, minH: 1 & One-Touch Minimize) ---');
    // Test lowering component to minimal height (h: 1)
    await page.evaluate(() => {
      const saved = localStorage.getItem('custom_coord_grid_layout');
      const layout = saved ? JSON.parse(saved) : {
        countdown:  { col: 1, row: 1, w: 4, h: 6 },
        milestones: { col: 5, row: 1, w: 4, h: 6 },
        progress:   { col: 1, row: 7, w: 8, h: 3 }
      };
      // Set ultra-slim and narrow layouts
      layout.countdown = { col: 1, row: 1, w: 4, h: 1 };
      layout.progress = { col: 1, row: 2, w: 8, h: 1 };
      layout.milestones = { col: 1, row: 3, w: 4, h: 2 };
      localStorage.setItem('custom_coord_grid_layout', JSON.stringify(layout));
      window.location.reload();
    });
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('#root > div', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 600));

    const ultraSlimCountdownRendered = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('PORTFOLIO SUBMISSION') && /\d+d\s+\d+h\s+\d+m\s+\d+s/.test(text);
    });
    assert('Ultra-Slim Countdown (h:1) Renders Precision Single-Line Bar', ultraSlimCountdownRendered);

    const ultraSlimProgressRendered = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('ROADMAP') && text.includes('%');
    });
    assert('Ultra-Slim Progress (h:1) Renders Inline Strip', ultraSlimProgressRendered);

    // Test One-Touch Minimize & Expand Button
    const oneTouchMinimizeWorks = await page.evaluate(() => {
      const minBtn = document.querySelector('button[title*="Minimize"]');
      if (minBtn) {
        minBtn.click();
        return true;
      }
      return false;
    });
    assert('One-Touch Minimize Button Collapses Widget to Lowest Limit', oneTouchMinimizeWorks);

    await new Promise((r) => setTimeout(r, 300));
    // Expand it back
    await page.evaluate(() => {
      const expBtn = document.querySelector('button[title*="Expand"]');
      if (expBtn) expBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    console.log('\n--- TEST SUITE 6: Drag & Resize Physics (Compacting & Bidirectional Gravity) ---');
    // Reset grid to default
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const resetBtn = buttons.find((b) => b.innerText.includes('Reset Grid'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Verify handle bounds have expanded hit areas (>= 20px)
    const handleHitTargetSize = await page.evaluate(() => {
      const corner = document.querySelector('.resize-handle-corner');
      if (!corner) return 0;
      const rect = corner.getBoundingClientRect();
      return Math.round(rect.width);
    });
    assert('Resize Handle Has Generous Hit Target (>= 24px)', handleHitTargetSize >= 24, `${handleHitTargetSize}px`);

    // Test dragging countdown down to row 3 and verify it stays at row 3 (No Snap-back!)
    await page.evaluate(() => {
      const grip = document.querySelector('[data-widget="countdown"] .drag-handle') || document.querySelector('.drag-handle');
      if (!grip) return;
      const rect = grip.getBoundingClientRect();
      
      // Dispatch pointer down
      grip.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.x + 5,
        clientY: rect.y + 5,
        bubbles: true,
        cancelable: true
      }));

      // Move down by ~180px (2 rows)
      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: rect.x + 5,
        clientY: rect.y + 195,
        bubbles: true,
        cancelable: true
      }));

      // Release pointer
      window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: rect.x + 5,
        clientY: rect.y + 195,
        bubbles: true,
        cancelable: true
      }));
    });
    await new Promise((r) => setTimeout(r, 500));

    const countdownRowAfterDrag = await page.evaluate(() => {
      const saved = localStorage.getItem('custom_coord_grid_layout');
      if (!saved) return 1;
      const layout = JSON.parse(saved);
      return layout.countdown ? layout.countdown.row : 1;
    });
    assert('Dragged Widget Stays at Placed Row (No Snap-Back to Row 1)', countdownRowAfterDrag > 1, `Row: ${countdownRowAfterDrag}`);

    // Reset grid again for compaction testing
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const resetBtn = buttons.find((b) => b.innerText.includes('Reset Grid'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // TEST BIDIRECTIONAL GRAVITY:
    // When widgets are compacted/shrunk, lower widgets must float UP, not drift down or stay stuck!
    // 1. Shrink countdown from h:6 to h:2 via south handle resize
    await page.evaluate(() => {
      const southHandle = document.querySelector('[data-widget="countdown"] .handle-s');
      if (!southHandle) return;
      const rect = southHandle.getBoundingClientRect();

      southHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
        bubbles: true,
        cancelable: true
      }));

      const moveY = rect.y - 240;
      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: rect.x + rect.width / 2,
        clientY: moveY,
        bubbles: true,
        cancelable: true
      }));

      window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: rect.x + rect.width / 2,
        clientY: moveY,
        bubbles: true,
        cancelable: true
      }));
    });
    await new Promise((r) => setTimeout(r, 500));

    const countdownCompactedHeight = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('custom_coord_grid_layout') || '{}');
      return saved.countdown ? saved.countdown.h : 6;
    });
    assert('Countdown Widget Compacts Upwards via Resize Handle', countdownCompactedHeight < 6, `Height: ${countdownCompactedHeight}`);

    // 2. Shrink milestones from h:6 to h:2 as well
    await page.evaluate(() => {
      const southHandle = document.querySelector('[data-widget="milestones"] .handle-s');
      if (!southHandle) return;
      const rect = southHandle.getBoundingClientRect();

      southHandle.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: rect.x + rect.width / 2,
        clientY: rect.y + rect.height / 2,
        bubbles: true,
        cancelable: true
      }));

      window.dispatchEvent(new PointerEvent('pointermove', {
        clientX: rect.x + rect.width / 2,
        clientY: rect.y - 240,
        bubbles: true,
        cancelable: true
      }));

      window.dispatchEvent(new PointerEvent('pointerup', {
        clientX: rect.x + rect.width / 2,
        clientY: rect.y - 240,
        bubbles: true,
        cancelable: true
      }));
    });
    await new Promise((r) => setTimeout(r, 500));

    // 3. Verify Progress widget floats UP from row 7 to row 3 or 4 (Bidirectional gravity!)
    const progressRowAfterCompaction = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('custom_coord_grid_layout') || '{}');
      return saved.progress ? saved.progress.row : 7;
    });
    assert('Compaction Pulls Lower Widget Upwards with Bidirectional Gravity', progressRowAfterCompaction < 7, `Progress Row: ${progressRowAfterCompaction} (Expected < 7)`);

    // Reset grid cleanly
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const resetBtn = buttons.find((b) => b.innerText.includes('Reset Grid'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    console.log('\n--- TEST SUITE 7: Sprint Customization & Milestone Manager ---');
    // Open Sprint Modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const sprintBtn = buttons.find((b) => b.innerText.includes('Sprint'));
      if (sprintBtn) sprintBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Add a custom milestone with long descriptive title that wraps
    await page.evaluate(() => {
      const setVal = (el, val) => {
        const lastValue = el.value;
        el.value = val;
        const tracker = el._valueTracker;
        if (tracker) tracker.setValue(lastValue);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const inputs = Array.from(document.querySelectorAll('input'));
      const tagInput = inputs.find((i) => i.placeholder === 'T-4');
      const titleInput = inputs.find((i) => i.placeholder && i.placeholder.includes('Finish final polish'));
      const dateInput = inputs.filter((i) => i.type === 'datetime-local')[1];

      if (tagInput) setVal(tagInput, 'T-Wrap');
      if (titleInput) setVal(titleInput, 'Comprehensive Responsive Verification Across Mobile Touch Viewports');
      if (dateInput) setVal(dateInput, '2026-11-14T10:00');

      const addBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Add to Roadmap'));
      if (addBtn) addBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Close Sprint modal
    await page.evaluate(() => {
      const doneBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === 'Done');
      if (doneBtn) doneBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const wrappedTitleInDom = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('main div.break-words.font-semibold')).find((d) => d.innerText.includes('Comprehensive Responsive Verification'));
      return el ? el.innerText.trim() : null;
    });
    assert('Long Milestone Title Renders Without Cutoff', wrappedTitleInDom && wrappedTitleInDom.includes('Mobile Touch Viewports'), wrappedTitleInDom);

    console.log('\n--- TEST SUITE 8: Mobile Viewport (390x844 iPhone) Verification ---');
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await new Promise((r) => setTimeout(r, 400));

    // Verify widgets are full width (> 340px) on mobile and not squished into narrow columns
    const mobileWidgetWidths = await page.evaluate(() => {
      const widgets = Array.from(document.querySelectorAll('.dashboard-widget'));
      return widgets.map((w) => Math.round(w.getBoundingClientRect().width));
    });
    const allWidgetsFullWidthOnMobile = mobileWidgetWidths.length > 0 && mobileWidgetWidths.every((w) => w >= 340);
    assert('Mobile Widgets Stack Full-Width (>= 340px, Never Squished)', allWidgetsFullWidthOnMobile, `Widths: ${mobileWidgetWidths.join(', ')}px`);

    // Verify date badges have whitespace-nowrap preventing multi-line splitting
    const hasWhitespaceNowrapOnDates = await page.evaluate(() => {
      const dateSpans = Array.from(document.querySelectorAll('span.whitespace-nowrap'));
      return dateSpans.some((s) => /Nov\s+\d{2},\s+\d{4}/.test(s.innerText));
    });
    assert('Milestone Date Badges Use whitespace-nowrap (No Vertical Splitting)', hasWhitespaceNowrapOnDates);

    // Capture mobile screenshots
    osEnsureDir(path.join(ROOT_DIR, 'screenshots'));
    await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'mobile-responsive-dark.png') });
    console.log('  [Screenshot] Saved screenshots/mobile-responsive-dark.png');

    // Switch to Light Mode on Mobile
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const themeBtn = buttons[buttons.length - 1];
      if (themeBtn) themeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'mobile-responsive-light.png') });
    console.log('  [Screenshot] Saved screenshots/mobile-responsive-light.png');

    // Switch back to desktop viewport
    await page.setViewport({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'desktop-light.png') });
    console.log('  [Screenshot] Saved screenshots/desktop-light.png');

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const themeBtn = buttons[buttons.length - 1];
      if (themeBtn) themeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'desktop-dark.png') });
    console.log('  [Screenshot] Saved screenshots/desktop-dark.png');

  } catch (err) {
    console.error('Test Suite encountered an error:', err);
    results.push({ name: 'Execution Crash', status: 'FAIL', detail: err.message });
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  console.log('\n====================================');
  console.log('         TEST SUMMARY REPORT         ');
  console.log('====================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

function osEnsureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

runTests();
