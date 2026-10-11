import { analyzeMnemonic, validateMnemonicStructure, validationFindings, assessSource, isWordCount, type GenerationSource, type MnemonicValidation } from './core/analysis.ts';
import { modelCandidateSearch, formatDuration } from './core/crack-time.ts';
import { assessPhrase } from './core/risk.ts';
import { modelStrength, scientific, readableYears } from './core/strength.ts';
import { generatePhrase } from './core/generation.ts';
import { deriveAddresses, accountPath, ADDRESS_TYPES, type AddressType, type AddressResult, type DerivationOptions } from './core/derivation.ts';
import publicPhrases from './public-phrases.json' with { type: 'json' };

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error('Required interface element is unavailable.');
  return result as T;
}
const input = element<HTMLTextAreaElement>('mnemonic');
const source = element<HTMLSelectElement>('source');
const passphrase = element<HTMLInputElement>('passphrase');
const deriveButton = element<HTMLButtonElement>('derive');
let analysis = analyzeMnemonic('');
let generatedHere = false;
let analysisRuns = 0;
let addressResults: AddressResult[] = [];
let activeDerivation: AbortController | undefined;

function text(id: string, value: string) { element(id).textContent = value; }
function value(id: string) { return element<HTMLInputElement | HTMLSelectElement>(id).value; }
function setValue(id: string, next: string) { element<HTMLInputElement | HTMLSelectElement>(id).value = next; }

function invalidateAddresses() {
  activeDerivation?.abort();
  activeDerivation = undefined;
  addressResults = [];
  element('address-results').hidden = true;
  element('address-rows').replaceChildren();
  element('derivation-status').dataset.error = 'false';
  text('derivation-status', analysis.valid ? 'Ready. Derive addresses for the current phrase and settings.' : 'Enter a valid phrase above to derive addresses.');
  deriveButton.disabled = !analysis.valid;
  deriveButton.textContent = 'Derive addresses →';
}

function renderSource() {
  const assessment = assessSource(source.value as GenerationSource, analysis.knownPublic, generatedHere);
  element('source-assessment').dataset.kind = assessment.kind;
  text('source-title', assessment.title);
  text('source-detail', assessment.detail);
}

function renderAssessment() {
  const risk = assessPhrase(analysis, source.value as GenerationSource, generatedHere);
  element('risk-summary').dataset.kind = risk.kind;
  element('phrase-perspective').dataset.kind = risk.kind;
  text('risk-title', risk.title);
  text('risk-explanation', risk.explanation);
  text('phrase-quantity', risk.quantity);
  text('phrase-quantity-label', risk.quantityLabel);
  text('phrase-interpretation', risk.interpretation);
  text('phrase-analogy', risk.analogy);
  renderCrackTime();
  element<HTMLDetailsElement>('ideal-model').open = false;
  invalidateAddresses();
  text('word-counter', `${analysis.wordCount} ${analysis.wordCount === 1 ? 'word' : 'words'}`);
  text('normalization', analysis.normalizationChanged ? 'Analysis uses lowercase words and single spaces. Capitalization and extra whitespace are normalized; words are never replaced.' : '');
  const hasInput = analysis.wordCount > 0;
  text('validity', !hasInput ? 'Waiting for a phrase' : analysis.valid ? 'Valid BIP39 structure' : 'Not valid English BIP39');
  const findings = validationFindings(analysis);
  text('validation-detail', !hasInput ? 'Enter words to check their length, wordlist, and checksum.' : analysis.valid ? 'Word count, English wordlist, and checksum pass. This establishes structure, not randomness or secrecy.' : findings.join(' '));
  for (const [id, amount] of [['entropy-bits', analysis.encodedEntropyBits], ['checksum-bits', hasInput ? analysis.checksumBits : null]] as const) {
    const small = document.createElement('small'); small.textContent = ' bits';
    element(id).replaceChildren(document.createTextNode(amount === null ? 'N/A' : String(amount)), small);
  }
  text('check-length', !hasInput ? 'Waiting' : analysis.validLength ? `${analysis.wordCount} · supported` : `${analysis.wordCount} · unsupported`);
  text('check-words', !hasInput ? 'Waiting' : analysis.validWords ? 'All words recognized' : `Invalid positions: ${analysis.invalidPositions.join(', ')}`);
  text('check-checksum', analysis.checksumValid === null ? 'Not checked' : analysis.checksumValid ? 'Matches' : 'Does not match');
  for (const [id, content] of [['raw-entropy', analysis.entropyHex], ['raw-binary', analysis.entropyBinary], ['checksum-binary', analysis.checksumBinary], ['mnemonic-binary', analysis.mnemonicBinary]]) {
    text(id!, content ?? 'No valid phrase loaded.');
  }
  element('word-indices-empty').hidden = analysis.valid;
  element('assessment-next').hidden = !analysis.valid;
  element('word-indices').replaceChildren(...analysis.wordIndices.map(item => {
    const card = document.createElement('li');
    const heading = document.createElement('div'); heading.className = 'word-index-heading';
    const position = document.createElement('span'); position.className = 'word-position';
    position.textContent = `Word ${item.position}`;
    const word = document.createElement('strong'); word.textContent = item.word;
    heading.append(position, word);
    const index = document.createElement('p'); index.className = 'word-index-number';
    index.append('BIP39 index ', Object.assign(document.createElement('strong'), { textContent: String(item.index) }));
    const binary = document.createElement('code'); binary.textContent = item.binary;
    binary.setAttribute('aria-label', `11-bit binary: ${item.binary}`);
    const line = document.createElement('span'); line.className = 'word-github-line'; line.textContent = `GitHub line ${item.githubLine}`;
    card.append(heading, index, binary, line);
    return card;
  }));
  text('repetition', analysis.repeatedWordCount ? 'Repeated words are allowed in BIP39. Ordinary repetition does not measure unpredictability; extreme constructions are checked separately.' : '');
  element('pattern-findings').replaceChildren(...analysis.patterns.map(pattern => {
    const item = document.createElement('li'); item.textContent = `${pattern.title}: ${pattern.explanation}`; return item;
  }));
  renderSource();
  if (analysis.valid && isWordCount(analysis.wordCount)) {
    const radio = document.querySelector<HTMLInputElement>(`input[name="model-words"][value="${analysis.wordCount}"]`);
    if (radio) radio.checked = true;
    renderModel();
  }
}

function analyze(reason = 'Analysis complete') {
  analysis = analyzeMnemonic(input.value);
  renderAssessment();
  renderInputValidation(analysis, true);
  analysisRuns++;
  text('analysis-feedback', `${reason} · check ${analysisRuns}. ${analysis.valid ? 'Structure valid; review the phrase assessment.' : 'Review the validation findings.'}`);
}

function markPending() {
  analysis = analyzeMnemonic('');
  renderAssessment();
  const live = validateMnemonicStructure(input.value);
  renderInputValidation(live);
  const count = live.wordCount;
  text('word-counter', `${count} ${count === 1 ? 'word' : 'words'}`);
  if (count) {
    text('risk-title', 'Changes not analyzed');
    text('risk-explanation', 'Click Analyze phrase to check the current words and generation context.');
    text('validity', 'Analysis required');
    text('source-title', 'Context awaiting analysis');
    text('source-detail', 'The selected source will be considered when you analyze this phrase.');
  }
  text('analysis-feedback', count ? 'Phrase or context changed. Click Analyze phrase.' : '');
}

function renderInputValidation(result: MnemonicValidation, completed = false) {
  const hasInput = result.wordCount > 0;
  const invalid = hasInput && !result.valid;
  input.setAttribute('aria-invalid', String(invalid));
  element('phrase-input').dataset.state = invalid ? 'invalid' : hasInput ? 'valid' : 'empty';
  text('input-validation', !hasInput ? 'Enter a phrase to check its structure.' : invalid
    ? `Invalid BIP39 phrase. ${validationFindings(result).join(' ')}`
    : completed ? 'Structure valid. Review the security assessment.' : 'Structure valid. Click Analyze phrase for the security assessment.');
  text('normalization', result.normalizationChanged ? 'Validation uses lowercase words and single spaces. Capitalization and extra whitespace are normalized; words are never replaced.' : '');
}

function renderCrackTime() {
  const risk = assessPhrase(analysis, source.value as GenerationSource, generatedHere);
  const randomModel = risk.kind === 'unverified';
  const available = risk.candidates !== null || randomModel;
  element('crack-controls').hidden = !available;
  element('crack-math').hidden = !available;
  element('random-perspective').hidden = !randomModel;
  element<HTMLDetailsElement>('crack-math').open = false;
  text('crack-formula', ''); text('crack-maximum', ''); text('crack-passphrase', '');
  text('crack-centuries', ''); text('crack-century-chance', ''); text('crack-lottery', '');
  text('crack-basis', randomModel ? 'Assuming secure random generation' : 'Conditional estimate');
  text('crack-assumptions', randomModel
    ? 'This estimate applies only if every phrase of this length was equally likely, the words stayed secret, and the attacker has no partial knowledge. It also assumes a known verification target and a fixed or known passphrase. It is a hypothetical exhaustive search, not a measured cracking time or a prediction of wallet compromise.'
    : available ? 'This estimate searches the recognized candidate family. It assumes the attacker targets that construction, has a known verification target, and knows any BIP39 passphrase. It is not a hardware benchmark or a prediction of wallet compromise.'
    : 'Estimates need a stated generation or attack model, a known verification target, and a fixed or known passphrase. They are not hardware benchmarks or predictions of wallet compromise.');
  if (!available) {
    text('crack-time', !analysis.wordCount ? 'Analyze a phrase first' : !analysis.valid ? 'Not applicable to invalid input' : 'Cannot estimate from these words');
    text('crack-detail', !analysis.wordCount ? 'Run the assessment to see the applicable search model and its assumptions.' : !analysis.valid ? 'Fix the word count, wordlist, or checksum errors first. Invalid BIP39 input has no applicable phrase-search estimate.' : 'You reported human-chosen words. Human choices do not justify a uniform-random estimate, even when no supported pattern is detected. Actual strength and cracking time are unknown. The separate ideal-randomness comparison below explains what secure random generation would provide.');
    return;
  }
  const rate = Number(value('crack-rate'));
  text('crack-passphrase', passphrase.value ? 'A passphrase is entered. These figures assume the attacker already knows it; its strength is not evaluated.' : 'Assumes an empty or attacker-known BIP39 passphrase. A secret passphrase is not evaluated.');
  if (randomModel) {
    const model = modelStrength(analysis.encodedEntropyBits!, rate);
    text('crack-time', `About ${readableYears(model.averageYears)}`);
    text('crack-detail', `If the phrase was generated securely at random, exhaustive guessing at ${rate.toLocaleString('en-US')} checks per second is beyond any human timescale.`);
    text('crack-maximum', `Full-space search at this rate: ≈ ${readableYears(model.fullSearchYears)}. The average is not a minimum; a guess can succeed earlier.`);
    text('crack-centuries', `${scientific(model.averageCenturies)} centuries on average.`);
    text('crack-century-chance', `About 1 in ${scientific(1 / model.centurySuccessProbability)} at the selected speed.`);
    text('crack-lottery', `Picture one winning ticket hidden among ${scientific(model.possibilities)} equally likely tickets. More words help only when they encode more securely generated randomness.`);
    text('crack-formula', `N = 2^${model.bits} = ${model.possibilities}; R = ${rate}. Average = (N + 1) / (2R) = ${model.averageSecondsNumerator} / ${model.averageSecondsDenominator} seconds. Full space = N / R. One year = 31,557,600 seconds; century success probability = min(1, R × 100 × 31,557,600 / N).`);
    return;
  }
  const candidates = risk.candidates!;
  const model = modelCandidateSearch(candidates, rate);
  text('crack-time', candidates === 1n ? 'One known phrase to try' : `Up to ${formatDuration(model.averageSeconds)}`);
  text('crack-detail', candidates === 1n
    ? 'These exact words are already public or otherwise known, so an attacker does not need to search the full BIP39 space.'
    : `The detected pattern reduces the search to at most ${candidates.toLocaleString('en-US')} candidates at the selected checking speed.`);
  text('crack-maximum', candidates === 1n ? '' : `Full-family search at this rate: ≤ ${formatDuration(model.fullSearchSeconds)}. An attacker may find it earlier or use a simpler guess.`);
  text('crack-formula', `N ≤ ${candidates}; R = ${rate}. Average = (N + 1) / (2R) ≤ ${model.averageNumerator} / ${model.averageDenominator} seconds. Full family = N / R.`);
}

function renderModel() {
  const count = Number(document.querySelector<HTMLInputElement>('input[name="model-words"]:checked')?.value ?? 12);
  const model = modelStrength(count / 3 * 32, Number(value('check-rate')));
  text('possibilities', scientific(model.possibilities));
  text('average-years', scientific(model.averageYears));
  text('model-bits', `${model.bits} random bits · ${count / 3} additional checksum bits`);
  text('exact-possibilities', model.possibilities.toString());
  text('one-guess', `1 / ${model.possibilities} ≈ ${scientific(model.oneGuessProbability)}`);
  text('exact-time', `${model.averageSecondsNumerator} / ${model.averageSecondsDenominator} seconds ≈ ${scientific(model.averageYears)} years`);
  text('coin-analogy', `Imagine guessing the exact outcome of ${model.bits} independent, fair coin flips. All of them, in order. That’s the chance of one correct guess.`);
  text('lottery-analogy', `A lottery with one winner among approximately ${scientific(model.possibilities)} equally likely tickets. Each extra random bit doubles the number of tickets.`);
}

async function copyText(content: string) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(content);
    else throw new Error('Use selection fallback.');
    text('copy-status', 'Copied to clipboard.');
  } catch {
    const temporary = document.createElement('textarea');
    temporary.value = content;
    temporary.className = 'sr-only';
    temporary.setAttribute('aria-label', 'Text to copy');
    document.body.append(temporary);
    temporary.select();
    const copied = document.execCommand('copy');
    temporary.remove();
    text('copy-status', copied ? 'Copied to clipboard.' : 'Clipboard unavailable. Select and copy the displayed text manually.');
  }
}

function getOptions(): DerivationOptions {
  const numeric = (id: string) => value(id).trim() === '' ? Number.NaN : Number(value(id));
  return { network: value('network') as DerivationOptions['network'], addressType: value('address-type') as AddressType, account: numeric('account'), change: numeric('branch'), startIndex: numeric('start-index'), count: numeric('address-count') };
}

async function derive() {
  invalidateAddresses();
  const controller = new AbortController();
  activeDerivation = controller;
  deriveButton.disabled = true;
  deriveButton.textContent = 'Deriving…';
  text('derivation-status', 'Computing locally…');
  try {
    const options = getOptions();
    const results = await deriveAddresses(input.value, passphrase.value, options, controller.signal);
    if (activeDerivation !== controller || controller.signal.aborted) return;
    addressResults = results;
    const rows = document.createDocumentFragment();
    for (const result of results) {
      const row = document.createElement('tr');
      for (const item of [String(result.index), result.path, result.address]) {
        const cell = document.createElement('td'); cell.textContent = item; row.append(cell);
      }
      const action = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'text-button'; button.textContent = 'Copy';
      button.setAttribute('aria-label', `Copy address and path at index ${result.index}`);
      button.addEventListener('click', () => { void copyText(`${result.path}\t${result.address}`); });
      action.append(button); row.append(action); rows.append(row);
    }
    element('address-rows').replaceChildren(rows);
    element('address-results').hidden = false;
    text('results-title', `${results.length} ${options.network} ${ADDRESS_TYPES[options.addressType].name} addresses`);
    text('derivation-status', `${accountPath(options)}/${options.change}/… · ${options.change === 0 ? 'Receiving' : 'Change'} · No balances are checked.`);
  } catch (error) {
    if (controller.signal.aborted || activeDerivation !== controller) return;
    element('derivation-status').dataset.error = 'true';
    text('derivation-status', error instanceof Error ? error.message : 'Address derivation failed.');
  } finally {
    if (activeDerivation === controller) {
      activeDerivation = undefined;
      deriveButton.disabled = !analysis.valid;
      deriveButton.textContent = 'Derive addresses →';
    }
  }
}

function clearAll() {
  input.value = ''; passphrase.value = ''; source.value = 'unknown'; generatedHere = false;
  passphrase.type = 'password';
  element('show-passphrase').setAttribute('aria-pressed', 'false'); text('show-passphrase', 'Show');
  for (const [id, val] of Object.entries({ 'generate-length': '12', 'example-length': '12', network: 'mainnet', 'address-type': 'native', account: '0', branch: '0', 'start-index': '0', 'address-count': '20', 'check-rate': '1000000000000', 'crack-rate': '1000000' })) setValue(id, val);
  document.querySelector<HTMLInputElement>('input[name="model-words"][value="12"]')!.checked = true;
  document.querySelectorAll<HTMLDetailsElement>('details').forEach(details => { details.open = false; });
  text('generation-error', typeof globalThis.crypto?.getRandomValues === 'function' ? '' : 'Secure browser randomness is unavailable. Generation is disabled. Analysis of test phrases remains available.'); text('copy-status', '');
  analysisRuns = 0; markPending(); renderModel(); renderAddressSelection();
}

function renderAddressSelection() {
  document.querySelectorAll<HTMLButtonElement>('[data-address-type]').forEach(button => {
    const selected = button.dataset.addressType === value('address-type');
    button.classList.toggle('selected-reference', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

document.querySelectorAll<HTMLButtonElement>('[data-address-type]').forEach(button => {
  button.addEventListener('click', () => {
    setValue('address-type', button.dataset.addressType!);
    renderAddressSelection();
    invalidateAddresses();
  });
});
element('address-type').addEventListener('change', renderAddressSelection);

input.addEventListener('input', () => { generatedHere = false; markPending(); });
source.addEventListener('change', markPending);
element('analyze-button').addEventListener('click', () => { analyze(); element('assessment').focus(); element('assessment').scrollIntoView({ block: 'nearest' }); });
element('clear-all').addEventListener('click', () => { clearAll(); input.focus(); });
element('generate').addEventListener('click', () => {
  try {
    const phrase = generatePhrase(Number(value('generate-length')));
    // A passphrase from a previous phrase must not be carried into a newly generated one.
    passphrase.value = ''; input.value = phrase; source.value = 'browser'; generatedHere = true;
    text('generation-error', ''); analyze('Generated and analyzed');
  } catch (error) { text('generation-error', error instanceof Error ? error.message : 'Secure generation failed.'); }
});
element('load-example').addEventListener('click', () => {
  input.value = publicPhrases.find(phrase => phrase.split(' ').length === Number(value('example-length')))!;
  passphrase.value = ''; source.value = 'public'; generatedHere = false; text('generation-error', ''); analyze('Public example loaded and analyzed');
});
for (const id of ['network', 'address-type', 'account', 'branch', 'start-index', 'address-count', 'passphrase']) {
  element(id).addEventListener('input', invalidateAddresses);
  element(id).addEventListener('change', invalidateAddresses);
}
element('compare-lengths').addEventListener('change', renderModel);
element('check-rate').addEventListener('change', renderModel);
element('crack-rate').addEventListener('change', renderCrackTime);
passphrase.addEventListener('input', renderCrackTime);
passphrase.addEventListener('change', renderCrackTime);
element('derive').addEventListener('click', () => { void derive(); });
element('copy-all').addEventListener('click', () => { void copyText(addressResults.map(item => `${item.path}\t${item.address}`).join('\n')); });
element('show-passphrase').addEventListener('click', () => {
  const show = passphrase.type === 'password';
  passphrase.type = show ? 'text' : 'password';
  element('show-passphrase').setAttribute('aria-pressed', String(show));
  text('show-passphrase', show ? 'Hide' : 'Show');
});
if (location.protocol === 'file:') {
  text('environment', 'LOCAL FILE · CONNECTION NOT VERIFIED');
  text('notice-title', 'You’re using a local copy.');
  text('notice-copy', 'Verify the file and use a trusted, disconnected device before handling real recovery phrases. This page cannot establish an air gap or protect against device compromise.');
  document.querySelectorAll<HTMLAnchorElement>('.download-link').forEach(link => { link.href = location.href.split('#')[0]; });
} else text('environment', 'HOSTED DEMO · FOR TEST PHRASES');
clearAll();
if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  element<HTMLButtonElement>('generate').disabled = true;
  text('generation-error', 'Secure browser randomness is unavailable. Generation is disabled. Analysis of test phrases remains available.');
}
window.addEventListener('pagehide', clearAll);
