import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const artifact = new URL('../../entropycheck.html', import.meta.url).href;
const example = `${'abandon '.repeat(11)}about`;

test('file works with networking blocked, no storage writes or runtime requests', async ({ page, context }) => {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await context.setOffline(true);
  await context.route('**/*', route => /^https?:/.test(route.request().url()) ? route.abort() : route.continue());
  await page.addInitScript(() => {
    const fail = () => { throw new Error('Unexpected persistence or network call'); };
    Storage.prototype.setItem = fail;
    Storage.prototype.removeItem = fail;
    window.fetch = fail;
    XMLHttpRequest.prototype.open = fail;
    if (window.indexedDB) window.indexedDB.open = fail;
  });
  await page.goto(artifact);
  await expect(page.locator('#environment')).toContainText('LOCAL FILE');
  await page.locator('#load-example').click();
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
  await expect(page.locator('#source-title')).toContainText('Public phrase');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(20);
  await expect(page.locator('#address-rows')).toContainText('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  await page.locator('#generate').click();
  await expect(page.locator('#source-title')).toHaveText('Browser randomness requested');
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
  expect(requests).toEqual([]); expect(errors).toEqual([]);
});

test('hosted and local artifacts are identical and derive the same results', async ({ page, context, request }) => {
  const response = await request.get('http://127.0.0.1:4173');
  const { readFile } = await import('node:fs/promises');
  expect(await response.body()).toEqual(await readFile(fileURLToPath(artifact)));
  await page.goto('http://127.0.0.1:4173');
  await expect(page.locator('#environment')).toContainText('HOSTED DEMO');
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await page.locator('#address-type').selectOption('taproot');
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  const online = await page.locator('#address-rows').innerText();
  const local = await context.newPage();
  await local.goto(artifact);
  await local.locator('#mnemonic').fill(example);
  await local.locator('#analyze-button').click();
  await local.locator('#address-type').selectOption('taproot');
  await local.locator('#address-count').fill('1');
  await local.locator('#derive').click();
  await expect(local.locator('#address-rows')).toHaveText(online, { useInnerText: true });
});

test('all word lengths generate, model updates, and edits lose generation provenance', async ({ page }) => {
  await page.goto(artifact);
  for (const [count, bits] of [[12, 128], [15, 160], [18, 192], [21, 224], [24, 256]]) {
    await page.locator('#generate-length').selectOption(String(count));
    await page.locator('#generate').click();
    await expect(page.locator('#word-counter')).toHaveText(`${count} words`);
    await expect(page.locator('#entropy-bits')).toHaveText(`${bits} bits`);
    await expect(page.locator('#coin-analogy')).toContainText(`${bits} independent`);
  }
  await page.locator('#mnemonic').fill(`${await page.locator('#mnemonic').inputValue()} `);
  await expect(page.locator('#risk-title')).toHaveText('Changes not analyzed');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#source-title')).toHaveText('Source reported · not verified');
  await expect(page.locator('#normalization')).toContainText('normalized');
});

test('invalid phrase blocks derivation and preserves independent validation findings', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#mnemonic').fill('abandon about');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#check-length')).toContainText('unsupported');
  await expect(page.locator('#check-words')).toHaveText('All words recognized');
  await expect(page.locator('#derive')).toBeDisabled();
  await page.locator('#mnemonic').fill('abandon '.repeat(12));
  await page.locator('#analyze-button').click();
  await expect(page.locator('#check-checksum')).toHaveText('Does not match');
  await expect(page.locator('#entropy-bits')).toHaveText('N/A bits');
  await page.locator('#mnemonic').fill(example.replace('about', '<script>alert(1)</script>'));
  await page.locator('#analyze-button').click();
  await expect(page.locator('#validation-detail')).toContainText('positions 12');
  await expect(page.locator('#derive')).toBeDisabled();
});

test('phrase, passphrase, and path changes immediately clear addresses; pending work cannot restore them', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#load-example').click();
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  await page.locator('#passphrase').fill('Test');
  await expect(page.locator('#address-results')).toBeHidden();
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  await page.locator('#network').selectOption('testnet');
  await expect(page.locator('#address-results')).toBeHidden();
  await page.locator('#address-count').fill('100');
  await page.evaluate(() => {
    (document.getElementById('derive') as HTMLButtonElement).click();
    const field = document.getElementById('mnemonic') as HTMLTextAreaElement;
    field.value = 'invalid'; field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#derive')).toBeDisabled();
  await expect(page.locator('#address-rows tr')).toHaveCount(0);
  await expect(page.locator('#derivation-status')).toHaveText('Enter a valid phrase above to derive addresses.');
});

test('Clear All removes entered and derived secrets and resets controls', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#load-example').click();
  await page.locator('#passphrase').fill('sensitive-example');
  await page.locator('#show-passphrase').click();
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(20);
  await page.locator('#clear-all').click();
  await expect(page.locator('#mnemonic')).toHaveValue('');
  await expect(page.locator('#passphrase')).toHaveValue('');
  await expect(page.locator('#passphrase')).toHaveAttribute('type', 'password');
  await expect(page.locator('#raw-entropy')).toHaveText('No valid phrase loaded.');
  await expect(page.locator('#address-rows tr')).toHaveCount(0);
  await expect(page.locator('#mnemonic')).toBeFocused();
});

test('generation fails closed if secure browser randomness is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'crypto', { value: undefined, configurable: true }));
  await page.goto(artifact);
  await expect(page.locator('#generate')).toBeDisabled();
  await expect(page.locator('#generation-error')).toContainText('unavailable');
  await page.locator('#load-example').click();
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
});

test('mobile layout fits viewport and core controls work with keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(artifact);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.locator('#load-example').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('model and input bounds remain explicit', async ({ page }) => {
  await page.goto(artifact);
  await expect(page.locator('#average-years')).toHaveText('5.39 × 10¹⁸');
  await expect(page.locator('#average-years')).toBeHidden();
  await page.locator('#ideal-model > summary').click();
  await page.locator('input[name="model-words"][value="24"]').check();
  await expect(page.locator('#average-years')).toHaveText('1.83 × 10⁵⁷');
  await page.locator('#load-example').click();
  await page.locator('#account').fill('');
  await page.locator('#derive').click();
  await expect(page.locator('#derivation-status')).toContainText('whole numbers');
  await expect(page.locator('#address-results')).toBeHidden();
});

test('24-word zero example has a phrase-specific unsafe result and exact binary', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#mnemonic').fill(`${'abandon '.repeat(23)}art`);
  await expect(page.locator('#risk-title')).toHaveText('Changes not analyzed');
  await expect(page.locator('#derive')).toBeDisabled();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#analysis-feedback')).toContainText('check 1');
  await expect(page.locator('#assessment')).toBeFocused();
  await expect(page.locator('#risk-title')).toHaveText('Unsafe: all-zero phrase');
  await expect(page.locator('#risk-explanation')).toContainText('All 256');
  await expect(page.locator('#phrase-quantity')).toHaveText('1 known candidate');
  await expect(page.locator('#phrase-interpretation')).toContainText('0 bits of secrecy');
  await expect(page.locator('#entropy-bits')).toHaveText('256 bits');
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
  await expect(page.locator('#average-years')).toBeHidden();
  await page.locator('#technical-details > summary').click();
  await expect(page.locator('#raw-binary')).toHaveText('0'.repeat(256));
  await expect(page.locator('#checksum-binary')).toHaveText('01100110');
  await expect(page.locator('#mnemonic-binary')).toHaveText('0'.repeat(256) + '01100110');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#analysis-feedback')).toContainText('check 2');
  await page.locator('#ideal-model > summary').click();
  await expect(page.locator('#average-years')).toBeVisible();
  await page.locator('#source').selectOption('wallet');
  await expect(page.locator('#average-years')).toBeHidden();
  await expect(page.locator('#phrase-quantity')).toHaveText('Not analyzed');
  await expect(page.locator('#raw-binary')).toHaveText('No valid phrase loaded.');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#risk-title')).toHaveText('Unsafe: all-zero phrase');
  await page.locator('#clear-all').click();
  for (const id of ['raw-entropy', 'raw-binary', 'checksum-binary', 'mnemonic-binary']) await expect(page.locator(`#${id}`)).toHaveText('No valid phrase loaded.');
  await expect(page.locator('#pattern-findings li')).toHaveCount(0);
  await expect(page.locator('#analysis-feedback')).toBeEmpty();
});

test('a broken RNG cannot produce a reassuring generation assessment', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'getRandomValues', { value: (bytes: Uint8Array) => { bytes.fill(0); return bytes; } });
  });
  await page.goto(artifact);
  await page.locator('#generate-length').selectOption('24');
  await page.locator('#generate').click();
  await expect(page.locator('#risk-title')).toHaveText('Unsafe: all-zero phrase');
  await expect(page.locator('#phrase-quantity')).toHaveText('1 known candidate');
  await expect(page.locator('#analysis-feedback')).toContainText('Generated and analyzed');
  await expect(page.locator('#average-years')).toBeHidden();
});

test('input box validates length, words and checksum immediately before Analyze', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#mnemonic').fill('abandon about');
  await expect(page.locator('#mnemonic')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#phrase-input #input-validation')).toContainText('found 2');
  await expect(page.locator('#derive')).toBeDisabled();
  await expect(page.locator('#analysis-feedback')).not.toContainText('complete');
  await page.locator('#mnemonic').fill(example.replace('about', 'notaword'));
  await expect(page.locator('#input-validation')).toContainText('positions 12');
  await page.locator('#mnemonic').fill('abandon '.repeat(12));
  await expect(page.locator('#input-validation')).toContainText('checksum does not match');
  await page.locator('#mnemonic').fill('abandon '.repeat(13) + 'art '.repeat(11) + 'buddy');
  await expect(page.locator('#input-validation')).toContainText('found 25');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#crack-time')).toHaveText('Not applicable to invalid input');
  await expect(page.locator('#crack-controls')).toBeHidden();
  await page.locator('#mnemonic').fill(` ${example.toUpperCase()} `);
  await expect(page.locator('#mnemonic')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#input-validation')).toContainText('Structure valid');
  await expect(page.locator('#normalization')).toContainText('normalized');
  await expect(page.locator('#derive')).toBeDisabled();
  await page.locator('#clear-all').click();
  await expect(page.locator('#mnemonic')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#input-validation')).toHaveText('Enter a phrase to check its structure.');
});

test('repeated word runs are weak with a visible conditional time, not a 256-bit claim', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#mnemonic').fill('abandon '.repeat(12) + 'art '.repeat(11) + 'buddy');
  await expect(page.locator('#input-validation')).toContainText('Structure valid');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#risk-title')).toContainText('Unsafe');
  await expect(page.locator('#risk-explanation')).toContainText('2 runs of identical words');
  await expect(page.locator('#phrase-quantity')).toHaveText('≤ 737,837,056 candidates');
  await expect(page.locator('#crack-time')).toHaveText('Up to 6.15 minutes');
  await expect(page.locator('#crack-maximum')).toContainText('≤ 12.3 minutes');
  await expect(page.locator('#average-years')).toBeHidden();
  await page.locator('#crack-rate').selectOption('1000000000');
  await expect(page.locator('#crack-time')).toHaveText('Up to 369 milliseconds');
  await page.locator('#passphrase').fill('test passphrase');
  await expect(page.locator('#crack-passphrase')).toContainText('assume the attacker already knows it');
  await page.locator('#mnemonic').fill('abandon about');
  await expect(page.locator('#crack-time')).toHaveText('Analyze a phrase first');
  await expect(page.locator('#crack-controls')).toBeHidden();
  await expect(page.locator('#crack-maximum')).toBeEmpty();
  await page.locator('#load-example').click();
  await expect(page.locator('#crack-time')).toHaveText('One known phrase to try');
  await page.locator('#clear-all').click();
  await expect(page.locator('#crack-rate')).toHaveValue('1000000');
  await expect(page.locator('#crack-formula')).toBeEmpty();
});

test('unrecognized generated output has an explicitly conditional random-search report and no em dashes', async ({ page }) => {
  await page.addInitScript(() => {
    const bytes = [37, 194, 16, 133, 75, 228, 60, 169, 4, 218, 121, 44, 87, 178, 98, 11];
    Object.defineProperty(crypto, 'getRandomValues', { value: (array: Uint8Array) => { array.set(bytes); return array; } });
  });
  await page.goto(artifact);
  await page.locator('#generate').click();
  await expect(page.locator('#phrase-quantity')).toHaveText('128 bits if securely random');
  await expect(page.locator('#phrase-interpretation')).toContainText('Actual source entropy remains unknown');
  await expect(page.locator('#crack-basis')).toHaveText('Assuming secure random generation');
  await expect(page.locator('#crack-controls')).toBeVisible();
  await page.locator('#crack-rate').selectOption('1000000000000');
  await expect(page.locator('#crack-time')).toHaveText('About 5.39 quintillion years');
  await expect(page.locator('#crack-maximum')).toContainText('10.8 quintillion years');
  await expect(page.locator('#crack-centuries')).toContainText('5.39 × 10¹⁶ centuries');
  await expect(page.locator('#crack-century-chance')).toContainText('1 in 1.08 × 10¹⁷');
  await expect(page.locator('#phrase-analogy')).toContainText('128 fair coin flips');
  await expect(page.locator('#crack-lottery')).toContainText('3.40 × 10³⁸ equally likely tickets');
  await expect(page.locator('#random-perspective')).toBeVisible();
  await expect(page.locator('#crack-guide')).not.toHaveAttribute('open', '');
  await expect(page.locator('#crack-math')).not.toHaveAttribute('open', '');
  await expect(page.locator('#average-years')).toBeHidden();
  // Include collapsed educational content and license notices; omit JS/CSS comments.
  const copy = await page.locator('body').evaluate(body => {
    const clone = body.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script,style').forEach(node => node.remove());
    return clone.textContent;
  });
  expect(copy).not.toContain('\u2014');
  expect(await page.title()).not.toContain('\u2014');
});

test('random-search assumptions survive all lengths, contexts, and report transitions offline', async ({ page, context }) => {
  await context.setOffline(true);
  await page.addInitScript(() => {
    const bytes = [37, 194, 16, 133, 75, 228, 60, 169, 4, 218, 121, 44, 87, 178, 98, 11, 95, 203, 7, 166, 72, 189, 49, 110, 211, 66, 17, 158, 241, 103, 6, 127];
    Object.defineProperty(crypto, 'getRandomValues', { value: (array: Uint8Array) => { array.set(bytes.slice(0, array.length)); return array; } });
  });
  await page.goto(artifact);
  const expected = ['5.39 quintillion', '2.32 × 10²⁸', '9.95 × 10³⁷', '4.27 × 10⁴⁷', '1.83 × 10⁵⁷'];
  for (const [index, count] of [12, 15, 18, 21, 24].entries()) {
    await page.locator('#generate-length').selectOption(String(count));
    await page.locator('#generate').click();
    await page.locator('#crack-rate').selectOption('1000000000000');
    await expect(page.locator('#crack-time')).toHaveText(`About ${expected[index]} years`);
    await expect(page.locator('#phrase-quantity')).toHaveText(`${count / 3 * 32} bits if securely random`);
  }
  for (const source of ['unknown', 'wallet', 'physical', 'browser']) {
    await page.locator('#source').selectOption(source);
    await expect(page.locator('#random-perspective')).toBeHidden();
    await expect(page.locator('#crack-century-chance')).toBeEmpty();
    await page.locator('#analyze-button').click();
    await expect(page.locator('#crack-time')).toContainText('years');
    await expect(page.locator('#phrase-interpretation')).toContainText('Actual source entropy remains unknown');
  }
  await page.locator('#passphrase').fill('public test passphrase');
  await expect(page.locator('#crack-passphrase')).toContainText('assume the attacker already knows it');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#crack-basis')).toBeVisible();
  await expect(page.locator('#crack-basis')).toHaveText('Assuming secure random generation');
  await page.locator('#source').selectOption('human');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#crack-detail')).toContainText('Human choices do not justify a uniform-random estimate');
  await expect(page.locator('#random-perspective')).toBeHidden();
  await expect(page.locator('#phrase-quantity')).toHaveText('Unknown');
  await page.locator('#source').selectOption('unknown');
  await page.locator('#mnemonic').fill('abandon '.repeat(12) + 'art '.repeat(11) + 'buddy');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#crack-time')).toContainText('microseconds');
  await expect(page.locator('#crack-basis')).toHaveText('Conditional estimate');
  await expect(page.locator('#crack-centuries')).toBeEmpty();
  await expect(page.locator('#random-perspective')).toBeHidden();
  await page.locator('#load-example').click();
  await expect(page.locator('#crack-time')).toHaveText('One known phrase to try');
  await expect(page.locator('#random-perspective')).toBeHidden();
  await page.locator('#clear-all').click();
  await expect(page.locator('#crack-time')).toHaveText('Analyze a phrase first');
  await expect(page.locator('#crack-formula')).toBeEmpty();
});
