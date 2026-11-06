const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = 8090;
const ROOT_DIR = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Simple static HTTP server for accurate MIME types and service worker scope
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

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[TestServer] Running at http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

async function runTests() {
  const server = await startServer();
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
    page.on('pageerror', (err) => pageErrors.push(err.toString()));

    console.log('\n--- TEST SUITE 1: Page Load & Initialization ---');
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2' });

    // Wait for React to mount
    await page.waitForSelector('#root > div', { timeout: 8000 });
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
      return utcBtn ? utcBtn.classList.contains('bg-[#235347]') : false;
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
    } else {
      assert('Sub-24h Radial Switch Found', false);
    }

    console.log('\n--- TEST SUITE 4: Milestone Roadmap & Checklist Persistence ---');
    const initialMilestoneCount = await page.evaluate(() => {
      return document.querySelectorAll('main div[class*="group relative flex items-center justify-between"]').length;
    });
    assert('All 6 Initial Milestones Rendered', initialMilestoneCount === 6, `Count: ${initialMilestoneCount}`);

    // Check initial progress is 0%
    const initialProgress = await page.evaluate(() => {
      const progEl = Array.from(document.querySelectorAll('span')).find((s) => s.innerText.includes('%'));
      return progEl ? progEl.innerText.trim() : '';
    });
    assert('Initial Progress at 0%', initialProgress === '0%', initialProgress);

    // Click first milestone to check it
    await page.evaluate(() => {
      const firstMilestone = document.querySelector('main div[class*="group relative flex items-center justify-between"]');
      if (firstMilestone) firstMilestone.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const updatedProgress = await page.evaluate(() => {
      const progEl = Array.from(document.querySelectorAll('span')).find((s) => s.innerText.includes('%'));
      return progEl ? progEl.innerText.trim() : '';
    });
    assert('Progress Updated after Milestone Click', updatedProgress === '17%', updatedProgress);

    // Verify localStorage has cached milestone completion
    const cachedStorage = await page.evaluate(() => localStorage.getItem('milestones_cache'));
    assert('Milestones State Persisted to localStorage', cachedStorage && cachedStorage.includes('m1'), cachedStorage);

    console.log('\n--- TEST SUITE 5: 2D Matrix Grid Mode & Collision Compaction ---');
    // Toggle Grid Mode
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const gridBtn = buttons.find((b) => b.innerText.includes('Grid Mode'));
      if (gridBtn) gridBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const hasJiggle = await page.evaluate(() => {
      const el = document.querySelector('.widget-jiggle');
      return !!el;
    });
    assert('Grid Mode Activates Widget Jiggle & Edit Badges', hasJiggle);

    // Test Reset Grid
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const resetBtn = buttons.find((b) => b.innerText.includes('Reset Grid'));
      if (resetBtn) resetBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const toastVisible = await page.evaluate(() => {
      const toast = Array.from(document.querySelectorAll('div')).find((d) => d.innerText.includes('Layout reset'));
      return !!toast;
    });
    assert('Reset Grid Shows Confirmation Toast', toastVisible);

    // Turn off grid mode
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const lockBtn = buttons.find((b) => b.innerText.includes('Lock Grid'));
      if (lockBtn) lockBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    console.log('\n--- TEST SUITE 6: Sprint Customization & Milestone Manager ---');
    // Open Sprint Modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const sprintBtn = buttons.find((b) => b.innerText.includes('Sprint'));
      if (sprintBtn) sprintBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const sprintModalOpen = await page.evaluate(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find((el) => el.innerText.includes('Sprint & Milestone Settings'));
      return !!h3;
    });
    assert('Sprint Configuration Modal Opens', sprintModalOpen);

    // Add a custom milestone using React native input value setter
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
      // There are two datetime-local inputs in the modal: target deadline (with value) and new milestone (empty)
      const dateInput = inputs.filter((i) => i.type === 'datetime-local')[1];

      if (tagInput) setVal(tagInput, 'T-Bonus');
      if (titleInput) setVal(titleInput, 'Automated Verification Pass');
      if (dateInput) setVal(dateInput, '2026-11-14T10:00');

      const addBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Add to Roadmap'));
      if (addBtn) addBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    const customMilestoneAdded = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('span')).filter((s) => s.innerText.includes('T-Bonus'));
      return items.length > 0;
    });
    assert('New Custom Milestone Added to State', customMilestoneAdded);

    // Close Sprint modal
    await page.evaluate(() => {
      const doneBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === 'Done');
      if (doneBtn) doneBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const totalMilestonesInMain = await page.evaluate(() => {
      return document.querySelectorAll('main div[class*="group relative flex items-center justify-between"]').length;
    });
    assert('Roadmap Renders 7 Milestones after Addition', totalMilestonesInMain === 7, `Total: ${totalMilestonesInMain}`);

    console.log('\n--- TEST SUITE 7: Multi-Calendar Sync & .ICS Generation ---');
    // Open Calendar Sync Modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const syncBtn = buttons.find((b) => b.innerText.includes('Sync'));
      if (syncBtn) syncBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const calendarModalOpen = await page.evaluate(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find((el) => el.innerText.includes('Add Milestones to Calendar'));
      return !!h3;
    });
    assert('Calendar Sync Modal Opens', calendarModalOpen);

    const gcalLinksCount = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="calendar.google.com"]'));
      return links.length;
    });
    assert('Google Calendar +GCal Intent Links Available', gcalLinksCount >= 6, `Count: ${gcalLinksCount}`);

    // Close sync modal
    await page.evaluate(() => {
      const closeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === 'Close');
      if (closeBtn) closeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    console.log('\n--- TEST SUITE 8: Tactile Theming (Dark & Light Mode) ---');
    // Click theme toggle to switch to Light Mode
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const themeBtn = buttons[buttons.length - 1];
      if (themeBtn) themeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const isLightMode = await page.evaluate(() => document.documentElement.classList.contains('light'));
    assert('Theme Toggles to Light Mode (Neumorphic tactile)', isLightMode);

    // Save screenshot in Light Mode
    osEnsureDir(path.join(ROOT_DIR, 'screenshots'));
    await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'dashboard-light-mode.png') });
    console.log('  [Screenshot] Saved screenshots/dashboard-light-mode.png');

    // Click theme toggle to switch back to Dark Mode
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const themeBtn = buttons[buttons.length - 1];
      if (themeBtn) themeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    const isBackDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    assert('Theme Toggles back to Dark Mode (Apple frosted glass)', isBackDark);

    // Save screenshot in Dark Mode
    await page.screenshot({ path: path.join(ROOT_DIR, 'screenshots', 'dashboard-dark-mode.png') });
    console.log('  [Screenshot] Saved screenshots/dashboard-dark-mode.png');

    console.log('\n--- TEST SUITE 9: PWA Service Worker & Manifest ---');
    const hasManifestLink = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link ? link.getAttribute('href') : null;
    });
    assert('PWA Manifest Linked Correctly', hasManifestLink === 'manifest.json', hasManifestLink);

    const swSupported = await page.evaluate(() => 'serviceWorker' in navigator);
    assert('Browser Supports Service Worker', swSupported);

    // Check manifest JSON validity
    const manifestContent = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
    assert('Manifest JSON Valid & Has 3 Icons', manifestContent.icons && manifestContent.icons.length === 3);

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
