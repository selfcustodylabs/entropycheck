import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const artifact = new URL('../../seedinspect.html', import.meta.url).href;
const example = `${'abandon '.repeat(11)}about`;

async function openReportDetails(page: Page) {
  if (!await page.locator('#report-details').evaluate(node => (node as HTMLDetailsElement).open)) {
    await page.locator('#report-details > summary').click();
  }
}

async function pasteText(page: Page, selector: string, content: string) {
  // Use a temporary clipboard source rather than another application input.
  await page.evaluate(content => {
    const source = document.createElement('textarea');
    source.id = 'clipboard-fixture';
    source.value = content;
    document.body.append(source);
    source.focus();
    source.select();
  }, content);
  await page.keyboard.press('ControlOrMeta+c');
  await page.locator('#clipboard-fixture').evaluate(node => node.remove());
  await page.locator(selector).focus();
  await page.locator(selector).press('ControlOrMeta+a');
  await page.locator(selector).press('ControlOrMeta+v');
}

test('reports appear only after successful analysis and hide on edits, invalid input or clear', async ({ page }) => {
  await page.goto(artifact);
  const reports = ['assessment', 'technical-details', 'understand', 'addresses'];
  for (const id of reports) await expect(page.locator(`#${id}`)).toBeHidden();
  await expect(page.locator('#results-placeholder')).toBeVisible();
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  for (const id of reports) await expect(page.locator(`#${id}`)).toBeHidden();
  await page.locator('#analyze-button').click();
  for (const id of reports) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator('#results-placeholder')).toBeHidden();
  await expect(page.locator('#understand details')).toHaveCount(1);
  await expect(page.locator('#report-details')).not.toHaveAttribute('open', '');
  await page.locator('#mnemonic').fill('invalid');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#mnemonic')).toBeFocused();
  await expect(page.locator('#input-validation')).toContainText('Invalid BIP39');
  for (const id of reports) await expect(page.locator(`#${id}`)).toBeHidden();
  await page.locator('#tab-generate').click();
  await page.locator('#generate').click();
  for (const id of reports) await expect(page.locator(`#${id}`)).toBeVisible();
  await page.locator('#clear-all').click();
  for (const id of reports) await expect(page.locator(`#${id}`)).toBeHidden();
  await page.locator('#tab-binary').click();
  await page.locator('#entropy-input').fill('0'.repeat(128));
  for (const id of reports) await expect(page.locator(`#${id}`)).toBeHidden();
  await page.locator('#import-entropy').click();
  for (const id of reports) await expect(page.locator(`#${id}`)).toBeVisible();
});

test('binary keyboard entry blocks other characters and preserves editing shortcuts', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-binary').click();
  const bits = page.locator('#entropy-input');
  await bits.pressSequentially('012abc345 6789!');
  await bits.press('Enter');
  await expect(bits).toHaveValue('01');
  await bits.press('ArrowLeft');
  await bits.press('Backspace');
  await expect(bits).toHaveValue('1');
  await bits.press('ControlOrMeta+a');
  await bits.press('0');
  await expect(bits).toHaveValue('0');
  await bits.press('Home');
  await bits.press('Delete');
  await expect(bits).toHaveValue('');
  await bits.press('Tab');
  await expect(bits).not.toBeFocused();
  // Exercise the fallback for input methods that cannot cancel beforeinput.
  await bits.fill('0011');
  await bits.evaluate(node => {
    const field = node as HTMLTextAreaElement;
    field.value = '0011x';
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(bits).toHaveValue('0011');
  await expect(page.locator('#entropy-input-feedback')).toContainText('Nothing was inserted');
});

test('binary paste removes formatting and rejects mixed characters without changing the draft', async ({ page }) => {
  await page.goto(artifact);
  const bits = page.locator('#entropy-input');
  for (const [pasted, expected] of [['00000001 \n'.repeat(16), '00000001'.repeat(16)], ['01x01', '00000001'.repeat(16)]]) {
    await page.locator('#tab-binary').click();
    await pasteText(page, '#entropy-input', pasted);
    await expect(bits).toHaveValue(expected);
  }
  await expect(page.locator('#entropy-input-feedback')).toContainText('Nothing was inserted');
  await expect(page.locator('#import-entropy')).toBeEnabled();
});


test('input tabs support arrow keys, preserve drafts and reports, and reset with Clear All', async ({ page }) => {
  await page.goto(artifact);
  const selected = page.getByRole('tab', { selected: true });
  await expect(selected).toHaveText('Generate new seed');
  await page.locator('#tab-phrase').click();
  await expect(page.getByRole('tabpanel')).toHaveCount(1);
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  await page.locator('#tab-phrase').focus();
  await page.keyboard.press('ArrowRight');
  await expect(selected).toHaveText('Import binary entropy');
  await expect(selected).toBeFocused();
  await expect(page.locator('#mnemonic')).toBeHidden();
  await page.locator('#entropy-input').fill('01'.repeat(64));
  await page.locator('#tab-binary').focus();
  await page.keyboard.press('ArrowRight');
  await expect(selected).toHaveText('Generate new seed');
  await expect(page.locator('#panel-binary')).toBeHidden();
  await expect(page.locator('#mnemonic')).toHaveValue(example);
  await expect(page.locator('#address-rows tr')).toHaveCount(0);
  await expect(page.locator('#assessment')).toBeHidden();
  await page.keyboard.press('End');
  await expect(selected).toHaveText('Import binary entropy');
  await expect(page.locator('#entropy-input')).toHaveValue('01'.repeat(64));
  await page.keyboard.press('Home');
  await expect(selected).toHaveText('Generate new seed');
  await page.keyboard.press('ArrowLeft');
  await expect(selected).toHaveText('Import binary entropy');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').focus();
  await expect(selected).toHaveText('Import seed phrase');
  await expect(page.locator('#mnemonic')).toBeEditable();
  await expect(page.locator('#mnemonic')).toBeFocused();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  await expect(page.locator('#risk-title')).toHaveText('Unsafe: all-zero phrase');
  await page.locator('#clear-all').click();
  await expect(page.locator('#entropy-input')).toHaveValue('');
  await expect(page.locator('#mnemonic')).toHaveValue('');
  await expect(page.locator('#simple-analogy')).toBeHidden();
});

test('simple analogies distinguish known answers, patterns and invalid input', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await expect(page.locator('#simple-analogy')).toBeVisible();
  await expect(page.locator('#analogy-title')).toHaveText('The answer is already known');
  await expect(page.locator('#analogy-coins')).toBeHidden();
  await page.locator('#mnemonic').fill('abandon '.repeat(12) + 'art '.repeat(11) + 'buddy');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#analogy-title')).toHaveText('A smaller list to try');
  await expect(page.locator('#analogy-coins')).toBeHidden();
  await page.locator('#mnemonic').fill('invalid');
  await page.locator('#analyze-button').click();
  await expect(page.locator('#simple-analogy')).toBeHidden();
});

test('raw binary entropy imports offline at every length without browser randomness', async ({ page, context }) => {
  await context.setOffline(true);
  await page.addInitScript(() => Object.defineProperty(window, 'crypto', { value: undefined, configurable: true }));
  await page.goto(artifact);
  await expect(page.locator('#generate')).toBeDisabled();
  for (const bits of [128, 160, 192, 224, 256]) {
    await page.locator('#tab-binary').click();
    await page.locator('#entropy-input').fill('00000001 '.repeat(bits / 8));
    await expect(page.locator('#entropy-validation')).toContainText(`${bits} bits → ${bits / 32 * 3} words`);
    await page.locator('#import-entropy').click();
    await expect(page.locator('#binary-result')).toBeVisible();
    await expect(page.locator('#tab-binary')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#word-counter')).toHaveText(`${bits / 32 * 3} words`);
    await expect(page.locator('#raw-binary')).toHaveText('00000001'.repeat(bits / 8));
    await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
    await expect(page.locator('#source')).toHaveCount(0);
    await expect(page.locator('#entropy-input')).toHaveValue('00000001'.repeat(bits / 8));
    await expect(page.locator('#binary-result')).toBeFocused();
  }
});

test('entropy import validates drafts, replaces secrets and clears old derived results', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-generate').click();
  await page.locator('#generate').click();
  await page.locator('#passphrase').fill('old test passphrase');
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  const previous = await page.locator('#generated-phrase').innerText();
  await page.locator('#tab-binary').click();
  for (const invalid of ['0'.repeat(127), '0'.repeat(132)]) {
    await page.locator('#entropy-input').fill(invalid);
    await expect(page.locator('#import-entropy')).toBeDisabled();
    await expect(page.locator('#entropy-input')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#generated-phrase')).toHaveText(previous);
  }
  await page.locator('#entropy-input').fill('00000000\n'.repeat(16));
  await expect(page.locator('#entropy-input')).toHaveAttribute('aria-invalid', 'false');
  await page.locator('#import-entropy').click();
  await expect(page.locator('#binary-phrase')).toHaveText(example);
  await expect(page.locator('#mnemonic')).toHaveValue('');
  await expect(page.locator('#passphrase')).toHaveValue('');
  await expect(page.locator('#address-rows tr')).toHaveCount(0);
  await expect(page.locator('#risk-title')).toHaveText('Unsafe: all-zero phrase');
  await expect(page.locator('#source')).toHaveCount(0);
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows')).toContainText('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon about');
  await expect(page.locator('#derive')).toBeDisabled();
  await expect(page.locator('#raw-binary')).toHaveText('No valid phrase loaded.');
});

test('entropy input works on mobile with keyboard and Clear All removes draft bits', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(artifact);
  await page.locator('#tab-binary').focus();
  await page.keyboard.press('Enter');
  await page.locator('#entropy-input').fill('1'.repeat(256));
  await expect(page.locator('.dice-help')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#import-entropy').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#word-counter')).toHaveText('24 words');
  await page.locator('#tab-binary').click();
  await page.locator('#entropy-input').fill('0'.repeat(128));
  await page.locator('#clear-all').click();
  await expect(page.locator('#entropy-input')).toHaveValue('');
  await expect(page.locator('#import-entropy')).toBeDisabled();
  await expect(page.locator('#entropy-input')).toHaveAttribute('aria-invalid', 'false');
  await expect(page.locator('#tab-generate')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#mnemonic')).toHaveValue('');
});

for (const location of [artifact, 'http://127.0.0.1:4173']) {
  test(`offline guidance remains available without a connection banner at ${location.startsWith('file:') ? 'local file' : 'hosted demo'}`, async ({ page }) => {
    await page.goto(location);
    await expect(page.locator('#usage-notice')).toHaveCount(0);
    await expect(page.locator('#offline')).toBeVisible();
    await expect(page.locator('#environment')).toContainText('COMPUTES IN YOUR BROWSER');
    if (location.startsWith('file:')) await expect(page.locator('.site-header .download-link')).toHaveAttribute('href', artifact);
  });
}

test('phrase actions distinguish pending input from completed generation', async ({ page }) => {
  await page.goto(artifact);
  await expect(page.locator('#analyze-button')).toBeDisabled();
  await page.locator('#tab-generate').click();
  await expect(page.locator('#generate')).toHaveAccessibleName('Generate');
  await page.locator('#generate').click();
  await expect(page.locator('#generated-result')).toBeVisible();
  await page.locator('#tab-phrase').click();
  await expect(page.locator('#analyze-button')).toHaveAccessibleName('Analyze phrase');
  await expect(page.locator('#analyze-button')).toBeDisabled();
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await expect(page.locator('#analyze-button')).toHaveAccessibleName('Analyze phrase');
  await expect(page.locator('#phrase-quantity')).toHaveText('Not analyzed');
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#phrase-quantity')).toHaveText('1 known candidate');
  await expect(page.locator('#simple-analogy')).toBeVisible();
  await page.locator('#clear-all').click();
  await expect(page.locator('#analyze-button')).toBeDisabled();
});

test('entropy details show zero-based word indices offline and discard them after edits', async ({ page, context }) => {
  await context.setOffline(true);
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await page.locator('#technical-details > summary').click();
  const words = page.locator('#word-indices li');
  await expect(words).toHaveCount(12);
  await expect(words.first()).toContainText('Word 1abandon');
  await expect(words.first()).toContainText('BIP39 index 0');
  await expect(words.first()).toContainText('GitHub line 1');
  await expect(words.first().locator('code')).toHaveText('00000000000');
  await expect(words.last()).toContainText('BIP39 index 3');
  await expect(words.last()).toContainText('GitHub line 4');
  await expect(page.locator('.index-guide')).toContainText('index 1477 → line 1478');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  }
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon about');
  await expect(words).toHaveCount(0);
  await expect(page.locator('#raw-binary')).toHaveText('No valid phrase loaded.');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await expect(words).toHaveCount(12);
  await page.locator('#clear-all').click();
  await expect(words).toHaveCount(0);
  await expect(page.locator('#technical-details')).not.toHaveAttribute('open', '');
});

test('address type cards support keyboard selection and invalidate outdated addresses', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  await page.locator('[data-address-type="taproot"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#address-type')).toHaveValue('taproot');
  await expect(page.locator('[data-address-type="taproot"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-address-type="native"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#address-rows tr')).toHaveCount(0);
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows')).toContainText("m/86'/0'/0'/0/0");
  await page.locator('#address-type').selectOption('legacy');
  await expect(page.locator('[data-address-type="legacy"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#address-rows tr')).toHaveCount(0);
  await page.locator('#clear-all').click();
  await expect(page.locator('[data-address-type="native"]')).toHaveAttribute('aria-pressed', 'true');
});

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
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
  await expect(page.locator('#source-title')).toContainText('Public phrase');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(20);
  await expect(page.locator('#address-rows')).toContainText('bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  await page.locator('#tab-generate').click();
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
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await page.locator('#address-type').selectOption('taproot');
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  const online = await page.locator('#address-rows').innerText();
  const local = await context.newPage();
  await local.goto(artifact);
  await local.locator('#tab-phrase').click();
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
    await page.locator('#tab-generate').click();
    await page.locator('#generate-length').selectOption(String(count));
    await page.locator('#tab-generate').click();
    await page.locator('#generate').click();
    await expect(page.locator('#word-counter')).toHaveText(`${count} words`);
    await expect(page.locator('#entropy-bits')).toHaveText(`${bits} bits`);
    await expect(page.locator('#coin-analogy')).toContainText(`${bits} fair coin flips`);
  }
  const generatedPhrase = await page.locator('#generated-phrase').innerText();
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(`${generatedPhrase} `);
  await expect(page.locator('#risk-title')).toHaveText('Changes not analyzed');
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#source-title')).toHaveText('Origin unverified');
  await expect(page.locator('#normalization')).toContainText('normalized');
});

test('invalid phrase blocks derivation and preserves independent validation findings', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon about');
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#check-length')).toContainText('unsupported');
  await expect(page.locator('#check-words')).toHaveText('All words recognized');
  await expect(page.locator('#derive')).toBeDisabled();
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon '.repeat(12));
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#check-checksum')).toHaveText('Does not match');
  await expect(page.locator('#entropy-bits')).toHaveText('N/A bits');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example.replace('about', '<script>alert(1)</script>'));
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#mnemonic')).toHaveValue('abandon '.repeat(12));
  await expect(page.locator('#check-checksum')).toHaveText('Does not match');
  await expect(page.locator('#derive')).toBeDisabled();
});

test('phrase, passphrase, and path changes immediately clear addresses; pending work cannot restore them', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
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
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
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
  await expect(page.locator('#tab-generate')).toBeFocused();
});

test('generation fails closed if secure browser randomness is unavailable', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'crypto', { value: undefined, configurable: true }));
  await page.goto(artifact);
  await expect(page.locator('#generate')).toBeDisabled();
  await expect(page.locator('#generation-error')).toContainText('unavailable');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
});

test('mobile layout fits viewport and core controls work with keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(artifact);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip-link')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('model and input bounds remain explicit', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await expect(page.locator('#average-years')).toHaveText('5.39 × 10¹⁸');
  await expect(page.locator('#average-years')).toBeHidden();
  await openReportDetails(page);
  await page.locator('input[name="model-words"][value="24"]').check();
  await expect(page.locator('#average-years')).toHaveText('1.83 × 10⁵⁷');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await page.locator('#account').fill('');
  await page.locator('#derive').click();
  await expect(page.locator('#derivation-status')).toContainText('whole numbers');
  await expect(page.locator('#address-results')).toBeHidden();
});

test('24-word zero example has a phrase-specific unsafe result and exact binary', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(`${'abandon '.repeat(23)}art`);
  await expect(page.locator('#risk-title')).toHaveText('Changes not analyzed');
  await expect(page.locator('#derive')).toBeDisabled();
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#analysis-feedback')).toHaveCount(0);
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
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#analysis-feedback')).toHaveCount(0);
  await openReportDetails(page);
  await expect(page.locator('#average-years')).toBeVisible();
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(`${'abandon '.repeat(23)}art `);
  await expect(page.locator('#average-years')).toBeHidden();
  await expect(page.locator('#phrase-quantity')).toHaveText('Not analyzed');
  await expect(page.locator('#raw-binary')).toHaveText('No valid phrase loaded.');
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#risk-title')).toHaveText('Unsafe: all-zero phrase');
  await page.locator('#clear-all').click();
  for (const id of ['raw-entropy', 'raw-binary', 'checksum-binary', 'mnemonic-binary']) await expect(page.locator(`#${id}`)).toHaveText('No valid phrase loaded.');
  await expect(page.locator('#pattern-findings li')).toHaveCount(0);
  await expect(page.locator('#analysis-feedback')).toHaveCount(0);
});

test('a broken RNG cannot produce a reassuring generation assessment', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'getRandomValues', { value: (bytes: Uint8Array) => { bytes.fill(0); return bytes; } });
  });
  await page.goto(artifact);
  await page.locator('#tab-generate').click();
  await page.locator('#generate-length').selectOption('24');
  await page.locator('#tab-generate').click();
  await page.locator('#generate').click();
  await expect(page.locator('#risk-title')).toHaveText('Unsafe: all-zero phrase');
  await expect(page.locator('#phrase-quantity')).toHaveText('1 known candidate');
  await expect(page.locator('#generated-result')).toBeVisible();
  await expect(page.locator('#average-years')).toBeHidden();
});

test('input box validates length, words and checksum immediately before Analyze', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon about');
  await expect(page.locator('#mnemonic')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#phrase-input #input-validation')).toContainText('found 2');
  await expect(page.locator('#derive')).toBeDisabled();
  await expect(page.locator('#analysis-feedback')).toHaveCount(0);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example.replace('about', 'notaword'));
  await expect(page.locator('#input-validation')).toContainText('positions 12');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon '.repeat(12));
  await expect(page.locator('#input-validation')).toContainText('checksum does not match');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon '.repeat(13) + 'art '.repeat(11) + 'buddy');
  await expect(page.locator('#input-validation')).toContainText('found 25');
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#crack-time')).toHaveText('Not applicable to invalid input');
  await expect(page.locator('#crack-controls')).toBeHidden();
  await page.locator('#tab-phrase').click();
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
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon '.repeat(12) + 'art '.repeat(11) + 'buddy');
  await expect(page.locator('#input-validation')).toContainText('Structure valid');
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#risk-title')).toContainText('Unsafe');
  await expect(page.locator('#risk-explanation')).toContainText('2 runs of identical words');
  await expect(page.locator('#phrase-quantity')).toHaveText('≤ 737,837,056 candidates');
  await expect(page.locator('#crack-time')).toHaveText('Up to 6.15 minutes');
  await expect(page.locator('#crack-maximum')).toContainText('≤ 12.3 minutes');
  await expect(page.locator('#average-years')).toBeHidden();
  await openReportDetails(page);
  await page.locator('#crack-rate').selectOption('1000000000');
  await expect(page.locator('#crack-time')).toHaveText('Up to 369 milliseconds');
  await page.locator('#passphrase').fill('test passphrase');
  await expect(page.locator('#crack-passphrase')).toContainText('assume the attacker already knows it');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon about');
  await expect(page.locator('#crack-time')).toHaveText('Analyze a phrase first');
  await expect(page.locator('#crack-controls')).toBeHidden();
  await expect(page.locator('#crack-maximum')).toBeEmpty();
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
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
  await page.locator('#tab-generate').click();
  await page.locator('#generate').click();
  await expect(page.locator('#phrase-quantity')).toHaveText('128 bits if securely random');
  await expect(page.locator('#phrase-interpretation')).toContainText('Actual source entropy remains unknown');
  await expect(page.locator('#crack-basis')).toHaveText('Assuming secure random generation');
  await expect(page.locator('#crack-controls')).toBeHidden();
  await openReportDetails(page);
  await page.locator('#crack-rate').selectOption('1000000000000');
  await expect(page.locator('#crack-time')).toHaveText('About 5.39 quintillion years');
  await expect(page.locator('#crack-maximum')).toContainText('10.8 quintillion years');
  await expect(page.locator('#crack-centuries')).toContainText('5.39 × 10¹⁶ centuries');
  await expect(page.locator('#crack-century-chance')).toContainText('1 in 1.08 × 10¹⁷');
  await expect(page.locator('#analogy-title')).toHaveText('Guess 128 coin flips');
  await expect(page.locator('#analogy-condition')).toContainText('only if the phrase was generated uniformly at random');
  await expect(page.locator('#crack-lottery')).toContainText('3.40 × 10³⁸ equally likely tickets');
  await expect(page.locator('#random-perspective')).toBeVisible();
  await expect(page.locator('#understand details')).toHaveCount(1);
  await page.locator('#report-details > summary').click();
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

test('random-search assumptions survive all lengths, input tabs, and report transitions offline', async ({ page, context }) => {
  await context.setOffline(true);
  await page.addInitScript(() => {
    const bytes = [37, 194, 16, 133, 75, 228, 60, 169, 4, 218, 121, 44, 87, 178, 98, 11, 95, 203, 7, 166, 72, 189, 49, 110, 211, 66, 17, 158, 241, 103, 6, 127];
    Object.defineProperty(crypto, 'getRandomValues', { value: (array: Uint8Array) => { array.set(bytes.slice(0, array.length)); return array; } });
  });
  await page.goto(artifact);
  const expected = ['5.39 quintillion', '2.32 × 10²⁸', '9.95 × 10³⁷', '4.27 × 10⁴⁷', '1.83 × 10⁵⁷'];
  for (const [index, count] of [12, 15, 18, 21, 24].entries()) {
    await page.locator('#tab-generate').click();
    await page.locator('#generate-length').selectOption(String(count));
    await page.locator('#tab-generate').click();
    await page.locator('#generate').click();
    await openReportDetails(page);
    await page.locator('#crack-rate').selectOption('1000000000000');
    await expect(page.locator('#crack-time')).toHaveText(`About ${expected[index]} years`);
    await expect(page.locator('#phrase-quantity')).toHaveText(`${count / 3 * 32} bits if securely random`);
  }
  const generatedPhrase = await page.locator('#generated-phrase').innerText();
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(`${generatedPhrase} `);
  await expect(page.locator('#random-perspective')).toBeHidden();
  await expect(page.locator('#simple-analogy')).toBeHidden();
  await expect(page.locator('#crack-century-chance')).toBeEmpty();
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#source-title')).toHaveText('Origin unverified');
  await expect(page.locator('#crack-time')).toContainText('years');
  await expect(page.locator('#phrase-interpretation')).toContainText('Actual source entropy remains unknown');
  await page.locator('#passphrase').fill('public test passphrase');
  await expect(page.locator('#crack-passphrase')).toContainText('assume the attacker already knows it');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#crack-basis')).toBeVisible();
  await expect(page.locator('#crack-basis')).toHaveText('Assuming secure random generation');
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill('abandon '.repeat(12) + 'art '.repeat(11) + 'buddy');
  await page.locator('#tab-phrase').click();
  await page.locator('#analyze-button').click();
  await expect(page.locator('#crack-time')).toContainText('6.15 minutes');
  await expect(page.locator('#crack-basis')).toHaveText('Conditional estimate');
  await expect(page.locator('#crack-centuries')).toBeEmpty();
  await expect(page.locator('#random-perspective')).toBeHidden();
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await expect(page.locator('#crack-time')).toHaveText('One known phrase to try');
  await expect(page.locator('#random-perspective')).toBeHidden();
  await page.locator('#clear-all').click();
  await expect(page.locator('#crack-time')).toHaveText('Analyze a phrase first');
  await expect(page.locator('#crack-formula')).toBeEmpty();
});


test('phrase drafts never appear in the generation or binary tabs', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  await page.locator('#mnemonic').fill(example);
  for (const mode of ['generate', 'binary']) {
    await page.locator(`#tab-${mode}`).click();
    await expect(page.locator('#mnemonic')).toBeHidden();
    await expect(page.locator('#generated-result')).toBeHidden();
    await expect(page.getByRole('tabpanel')).not.toContainText(example);
  }
  await page.locator('#tab-phrase').click();
  await expect(page.locator('#mnemonic')).toHaveValue(example);
});

test('generated phrases copy exactly and remain independent from phrase drafts', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#generate').click();
  const phrase = await page.locator('#generated-phrase').innerText();
  await expect(page.locator('#generated-phrase')).toHaveText(phrase);
  await expect(page.locator('#panel-generate textarea')).toHaveCount(0);
  await page.locator('#copy-phrase').click();
  await expect(page.locator('#phrase-copy-feedback')).toHaveText('Copied to clipboard.');
  await page.locator('#tab-phrase').click();
  await expect(page.locator('#mnemonic')).toHaveValue('');
  await page.locator('#mnemonic').focus();
  await page.locator('#mnemonic').press('ControlOrMeta+a');
  await page.locator('#mnemonic').press('ControlOrMeta+v');
  await expect(page.locator('#mnemonic')).toHaveValue(phrase);
  await page.locator('#mnemonic').fill('abandon about');
  await page.locator('#tab-generate').click();
  await expect(page.locator('#generated-result')).toBeVisible();
  await expect(page.locator('#generated-phrase')).toHaveText(phrase);
  await page.locator('#generate').click();
  await page.locator('#tab-phrase').click();
  await expect(page.locator('#mnemonic')).toHaveValue('abandon about');
  await page.locator('#clear-all').click();
  await expect(page.locator('#generated-phrase')).toBeEmpty();
  await expect(page.locator('#phrase-copy-feedback')).toBeEmpty();
});

test('phrase input accepts letters and whitespace, rejects mixed pastes and mobile edits', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#tab-phrase').click();
  const phrase = page.locator('#mnemonic');
  await phrase.pressSequentially('Abandon 123!@#$ about');
  await expect(phrase).toHaveValue('Abandon  about');
  await phrase.press('ControlOrMeta+a');
  await phrase.press('Backspace');
  await expect(phrase).toHaveValue('');
  await pasteText(page, '#mnemonic', `  ${example.toUpperCase()}\n`);
  await expect(phrase).toHaveValue(`  ${example.toUpperCase()}\n`);
  for (const invalid of ['abandon1 about', 'abandon-about', 'abandon 🪙 about']) {
    await pasteText(page, '#mnemonic', invalid);
    await expect(phrase).toHaveValue(`  ${example.toUpperCase()}\n`);
    await expect(page.locator('#phrase-input-feedback')).toContainText('Nothing was inserted');
  }
  await phrase.evaluate(node => {
    const field = node as HTMLTextAreaElement;
    field.value += '123';
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(phrase).toHaveValue(`  ${example.toUpperCase()}\n`);
  await page.locator('#analyze-button').click();
  await expect(page.locator('#validity')).toHaveText('Valid BIP39 structure');
});

test('navigation stays visible and stable, with unavailable links explained before analysis', async ({ page }) => {
  await page.goto(artifact);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link')).toHaveCount(3);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const before = await nav.boundingBox();
    for (const id of ['nav-understand', 'nav-addresses']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator(`#${id}`)).toHaveAttribute('aria-disabled', 'true');
      await expect(page.locator(`#${id}`)).toHaveAttribute('title', 'Available after analyzing a valid phrase');
    }
    await page.locator('#nav-understand').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#navigation-status')).toContainText('Analyze a valid phrase');
    expect(new URL(page.url()).hash).toBe('');
    await page.locator('#generate').click();
    await expect(page.locator('#nav-understand')).toHaveAttribute('aria-disabled', 'false');
    await expect(page.locator('#nav-addresses')).toHaveAttribute('aria-disabled', 'false');
    const after = await nav.boundingBox();
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
    await page.locator('#nav-understand').click();
    await expect(page).toHaveURL(/#understand$/);
    await page.locator('#clear-all').click();
    await page.evaluate(() => history.replaceState(null, '', location.pathname));
  }
});

test('all workspaces preserve their own secrets, reports and addresses; binary edits clear only binary results', async ({ page }) => {
  await page.goto(artifact);
  await page.locator('#generate').click();
  const generated = await page.locator('#generated-phrase').innerText();
  await page.locator('#passphrase').fill('generated passphrase');
  await page.locator('#address-type').selectOption('taproot');
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  const generatedAddress = await page.locator('#address-rows').innerText();

  await page.locator('#tab-phrase').click();
  await expect(page.locator('#mnemonic')).toHaveValue('');
  await page.locator('#mnemonic').fill(example);
  await page.locator('#analyze-button').click();
  await page.locator('#passphrase').fill('imported passphrase');
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  const importedAddress = await page.locator('#address-rows').innerText();
  expect(importedAddress).not.toEqual(generatedAddress);

  await page.locator('#tab-binary').click();
  await page.locator('#entropy-input').fill('1'.repeat(256));
  await page.locator('#import-entropy').click();
  const binaryPhrase = await page.locator('#binary-phrase').innerText();
  await expect(page.locator('#tab-binary')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#binary-result')).toBeFocused();
  await expect(page.locator('#assessment-context')).toHaveText('Imported binary entropy');
  await page.locator('#passphrase').fill('binary passphrase');
  await page.locator('#address-count').fill('1');
  await page.locator('#derive').click();
  await expect(page.locator('#address-rows tr')).toHaveCount(1);
  const binaryAddress = await page.locator('#address-rows').innerText();

  for (const [mode, secret, address, type] of [
    ['generate', 'generated passphrase', generatedAddress, 'taproot'],
    ['phrase', 'imported passphrase', importedAddress, 'native'],
    ['binary', 'binary passphrase', binaryAddress, 'native'],
  ]) {
    await page.locator(`#tab-${mode}`).click();
    await expect(page.locator('#passphrase')).toHaveValue(secret);
    await expect(page.locator('#passphrase')).toHaveAttribute('type', 'password');
    await expect(page.locator('#address-type')).toHaveValue(type);
    await expect(page.locator('#address-rows')).toHaveText(address, { useInnerText: true });
  }
  await expect(page.locator('#binary-phrase')).toHaveText(binaryPhrase);
  await expect(page.locator('#entropy-input')).toHaveValue('1'.repeat(256));
  await page.locator('#entropy-input').fill('0'.repeat(128));
  await expect(page.locator('#binary-result')).toBeHidden();
  await expect(page.locator('#binary-phrase')).toBeEmpty();
  await expect(page.locator('#assessment')).toBeHidden();
  await expect(page.locator('#address-rows tr')).toHaveCount(0);
  await page.locator('#import-entropy').click();
  await expect(page.locator('#passphrase')).toHaveValue('');
  await expect(page.locator('#binary-phrase')).toHaveText(example);
  await page.locator('#tab-generate').click();
  await expect(page.locator('#generated-phrase')).toHaveText(generated);
  await expect(page.locator('#address-rows')).toHaveText(generatedAddress, { useInnerText: true });
  await page.locator('#clear-all').click();
  for (const mode of ['generate', 'phrase', 'binary']) {
    await page.locator(`#tab-${mode}`).click();
    await expect(page.locator('#assessment')).toBeHidden();
    await expect(page.locator('#passphrase')).toHaveValue('');
    await expect(page.locator('#address-rows tr')).toHaveCount(0);
  }
  await expect(page.locator('#generated-phrase')).toBeEmpty();
  await expect(page.locator('#binary-phrase')).toBeEmpty();
  await expect(page.locator('#mnemonic')).toHaveValue('');
});

test('binary phrase and all entropy encodings copy exactly, preserving leading zeros offline', async ({ page, context }) => {
  await context.setOffline(true);
  await page.goto(artifact);
  await page.locator('#tab-binary').click();
  await page.locator('#entropy-input').fill('0'.repeat(128));
  await page.locator('#import-entropy').click();
  await page.locator('#technical-details > summary').click();
  await page.evaluate(() => {
    const target = document.createElement('textarea');
    target.id = 'clipboard-target';
    document.body.append(target);
  });
  for (const [button, expected] of [
    ['copy-binary-phrase', example],
    ['copy-raw-entropy', '0'.repeat(32)],
    ['copy-raw-binary', '0'.repeat(128)],
    ['copy-checksum-binary', '0011'],
    ['copy-mnemonic-binary', '0'.repeat(128) + '0011'],
  ]) {
    const copy = page.locator(`#${button}`);
    await expect(copy).toHaveAccessibleName(/^Copy /);
    await copy.click();
    await expect(page.locator('#copy-status')).toHaveText('Copied to clipboard.');
    await page.locator('#clipboard-target').fill('');
    await page.locator('#clipboard-target').press('ControlOrMeta+v');
    await expect(page.locator('#clipboard-target')).toHaveValue(expected);
  }
  await page.locator('#clipboard-target').evaluate(node => node.remove());
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.assessment-art')).toBeVisible();
    await expect(page.locator('.assessment-limits')).toContainText('not measured security');
  }
});
