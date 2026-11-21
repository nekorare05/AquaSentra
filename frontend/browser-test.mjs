import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('../backend/.env', 'utf8')
    .split(/\r?\n/)
    .filter(s => s.includes('=') && !s.startsWith('#'))
    .map(s => {
      const i = s.indexOf('=');
      return [s.slice(0, i), s.slice(i + 1).replace(/^['"]|['"]$/g, '')];
    })
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const checks = [];

function check(name, ok) {
  if (!ok) throw new Error(name);
  checks.push(name);
  console.log('PASS', name);
}

try {
  // ==========================================
  // Part 1: Main AquaSentra Web Application
  // ==========================================
  console.log('\n--- TESTING MAIN AQUASENTRA WEB DASHBOARD (Port 4173) ---');
  await page.goto('http://127.0.0.1:4173');
  await page.getByLabel('User ID').fill(env.BOOTSTRAP_VIEWER_ID);
  await page.getByLabel('Access token').fill(env.BOOTSTRAP_VIEWER_TOKEN);
  await page.getByRole('button', { name: 'Connect to dashboard' }).click();

  // Overview Page & Integrated Section
  await page.getByRole('heading', { name: 'Detection & virtual isolation' }).waitFor();
  check('Login and integrated detection panel', true);
  check('No obsolete pending-stage labels', !/Stage 3.*pending|Disabled.*Stage 5/.test(await page.locator('body').innerText()));

  // AI Explanations
  await page.getByRole('button', { name: 'Explain current state' }).click();
  await page.getByText('Mock explanation (template, not an LLM):', { exact: false }).waitFor();
  check('Mock explanation visible', true);

  await page.getByRole('button', { name: 'Demonstrate AI fallback' }).click();
  await page.getByText('Explanation service unavailable.', { exact: false }).waitFor();
  check('AI fallback visible', true);

  // Administrator Controls (Blocked for viewer)
  await page.getByText('Administrator simulation controls', { exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Restore virtual supply' }).click();
  await page.getByText('forbidden', { exact: true }).waitFor();
  check('Viewer blocked from control in browser', true);

  await page.screenshot({ path: '../docs/dashboard-desktop.png', fullPage: true });

  // Verification: Embedded 3D Explorer removed from main navigation
  const navText = await page.locator('nav').innerText();
  check('No embedded 3D explorer in main navigation', !navText.includes('3D device explorer') && !navText.includes('Hardware twin'));

  // Verification: External link to Standalone 3D Lab exists
  const labLink = page.locator('a[href*="4174"]');
  check('External link to Standalone 3D Lab present in sidebar', await labLink.isVisible());

  // Page 2: Reading history
  await page.getByRole('button', { name: 'Reading history', exact: true }).click();
  check('History renders stored measurements', await page.locator('tbody tr').count() > 0);

  // Page 3: Alerts & events
  await page.getByRole('button', { name: 'Alerts & events', exact: true }).click();
  check('Alerts page renders summary counters', await page.locator('.alert-summary').isVisible());

  // Page 4: Detection
  await page.getByRole('button', { name: 'Detection', exact: true }).click();
  check('Detection page renders XGBoost inference info', await page.getByText('XGBoost Machine Learning Model').isVisible());

  // Page 5: Valve Control
  await page.getByRole('button', { name: 'Valve Control', exact: true }).click();
  check('Valve Control page renders virtual valve state', await page.getByText('Virtual Valve State').isVisible());

  // Page 6: Parameters
  await page.getByRole('button', { name: 'Parameters', exact: true }).click();
  check('Provisional parameter register renders', await page.getByText('Reference parameters', { exact: true }).isVisible());

  // Return to Overview
  await page.getByRole('button', { name: 'Overview', exact: true }).click();

  // Mobile layout responsiveness test
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '../docs/dashboard-mobile.png', fullPage: true });
  check('Mobile layout fits viewport', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  check('Credentials absent from localStorage', await page.evaluate(() => localStorage.length === 0));

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.reload();
  await page.getByLabel('Access token').waitFor();
  check('Reload clears authenticated session', true);

  // ==========================================
  // Part 2: Standalone AquaSentra 3D Lab
  // ==========================================
  console.log('\n--- TESTING STANDALONE AQUASENTRA 3D LAB (Port 4174) ---');
  await page.goto('http://127.0.0.1:4174');

  // Complete Device Page
  await page.waitForSelector('.complete-device-layout');
  check('3D Lab Complete Device page loads', true);
  check('3D assembly viewport renders', await page.locator('.assembly-viewport').isVisible());
  check('Component inspector side panel renders', await page.locator('.assembly-inspector-panel').isVisible());

  // Wiring Netlist Docs modal in Complete Device
  await page.getByRole('button', { name: 'Wiring Netlist Docs' }).click();
  await page.waitForSelector('.wiring-modal-content');
  check('Proposed Wiring Netlist reference modal opens', true);
  await page.locator('.modal-header .icon-button').click();

  // Page 2: IoT Operation Simulation
  await page.getByRole('button', { name: '2. IoT Operation Simulation' }).click();
  await page.waitForSelector('.simulation-page-layout');
  check('IoT Operation Simulation page loads', true);
  check('All 10 simulation step dots rendered', (await page.locator('.step-dot').count()) === 10);
  check('Operational scenario chips rendered', (await page.locator('.scenario-chip').count()) >= 5);

  // Test Stepper controls
  await page.getByRole('button', { name: 'Next' }).click();
  check('Simulation stepper advances to Step 2', await page.getByText('STEP 2 OF 10').isVisible());

  // Page 3: Component Library
  await page.getByRole('button', { name: '3. Component Library' }).click();
  await page.waitForSelector('.component-library-container');
  check('Component Library page loads', true);
  const compButtons = await page.locator('.component-nav-button').count();
  check('Component Library lists 9 individual components', compButtons === 9);

  // Inspect individual components (e.g., PH-4502C, Turbidity, Solenoid Valve)
  await page.getByRole('button', { name: /PH-4502C/ }).click();
  check('PH-4502C component details render', await page.getByText('0.00 – 14.00 pH').isVisible());

  await page.getByRole('button', { name: /12V NC Solenoid/ }).click();
  check('12V Normally Closed Valve details render', await page.getByText('Normally Closed').first().isVisible());

  // Return to Dashboard link
  const backBtn = page.locator('a.back-dashboard-btn');
  check('Link to Main Dashboard present in 3D Lab header', await backBtn.isVisible());

  await page.screenshot({ path: '../docs/3d-lab-desktop.png', fullPage: true });

  check('No browser runtime errors', errors.length === 0);

  writeFileSync(
    '../docs/stage7-browser-results.json',
    JSON.stringify({ passed: checks.length, checks, errors }, null, 2)
  );
  console.log(`\nALL ${checks.length} BROWSER CHECKS PASSED SUCCESSFULLY!`);
} finally {
  await browser.close();
}
