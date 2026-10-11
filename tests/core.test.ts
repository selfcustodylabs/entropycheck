import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync, entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import BIP32Factory from 'bip32';
import * as ecc from '@bitcoinerlab/secp256k1';
import * as bitcoin from 'bitcoinjs-lib';
import { analyzeMnemonic, validateMnemonicStructure, validationFindings, assessSource, normalizeMnemonic, WORD_COUNTS } from '../src/core/analysis.ts';
import { assessPhrase, findPatterns } from '../src/core/risk.ts';
import { generatePhrase } from '../src/core/generation.ts';
import { modelCandidateSearch, formatDuration } from '../src/core/crack-time.ts';
import { modelStrength, scientific, readableYears, SECONDS_PER_YEAR } from '../src/core/strength.ts';
import { deriveAddresses, validateOptions, accountPath, ADDRESS_TYPES, type DerivationOptions } from '../src/core/derivation.ts';

const vectors: string[][] = JSON.parse(readFileSync(new URL('./fixtures/bip39-english.json', import.meta.url), 'utf8'));
const phrase = vectors[0][1];
const defaults: DerivationOptions = { network: 'mainnet', addressType: 'native', account: 0, change: 0, startIndex: 0, count: 2 };
bitcoin.initEccLib(ecc);
const independentBip32 = BIP32Factory(ecc);

test('all 24 Trezor English vectors: entropy, mnemonic, PBKDF2 seed and BIP32 root', () => {
  for (const [entropy, mnemonic, expectedSeed, expectedRoot] of vectors) {
    const analysis = analyzeMnemonic(mnemonic);
    assert.equal(analysis.valid, true);
    assert.equal(analysis.entropyHex, entropy);
    assert.equal(analysis.encodedEntropyBits, entropy.length * 4);
    assert.equal(analysis.checksumBits, entropy.length / 8);
    assert.equal(analysis.knownPublic, true);
    assert.equal(entropyToMnemonic(Buffer.from(entropy, 'hex'), wordlist), mnemonic);
    const seed = mnemonicToSeedSync(mnemonic, 'TREZOR');
    assert.equal(Buffer.from(seed).toString('hex'), expectedSeed);
    const root = HDKey.fromMasterSeed(seed);
    assert.equal(root.privateExtendedKey, expectedRoot);
    root.wipePrivateData(); seed.fill(0);
  }
});

test('BIP32 official vectors 1–4 including leading zero preservation', () => {
  const reference = readFileSync(new URL('./fixtures/bip32.txt', import.meta.url), 'utf8');
  let checked = 0;
  for (let number = 1; number <= 4; number++) {
    const section = reference.split(`===Test vector ${number}===`)[1].split('===Test vector')[0];
    const seed = section.match(/Seed \(hex\): ([a-f0-9]+)/)![1];
    const root = HDKey.fromMasterSeed(Buffer.from(seed, 'hex'));
    for (const match of section.matchAll(/\* Chain ([^\n]+)\n\*\* ext pub: ([^\n]+)\n\*\* ext prv: ([^\n]+)/g)) {
      const path = match[1].replaceAll('<sub>H</sub>', "'");
      const child = path === 'm' ? root : root.derive(path);
      assert.equal(child.publicExtendedKey, match[2]);
      assert.equal(child.privateExtendedKey, match[3]);
      if (child !== root) child.wipePrivateData();
      checked++;
    }
    root.wipePrivateData();
  }
  assert.equal(checked, 17);
});

test('all five lengths generate and validate; provider bytes are cleared', () => {
  for (const count of WORD_COUNTS) {
    let buffer: Uint8Array | undefined;
    const provider = { getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      buffer = array as Uint8Array; buffer.forEach((_, i) => { buffer![i] = (i * 7 + 42) & 255; }); return array;
    } };
    const generated = generatePhrase(count, provider);
    assert.equal(analyzeMnemonic(generated).valid, true);
    assert.equal(analyzeMnemonic(generated).encodedEntropyBits, count / 3 * 32);
    assert.equal(generated.split(' ').length, count);
    assert.ok(buffer!.every(byte => byte === 0));
  }
  assert.throws(() => generatePhrase(13), /12, 15/);
  assert.throws(() => generatePhrase(12, {} as Crypto), /unavailable/);
  let captured: Uint8Array | undefined;
  assert.throws(() => generatePhrase(12, { getRandomValues(array) { captured = array as unknown as Uint8Array; captured.fill(42); throw new Error('RNG failure'); } }), /RNG failure/);
  assert.ok(captured!.every(byte => byte === 0));
});

test('validation separates length, membership, checksum and repetition', () => {
  assert.equal(normalizeMnemonic('  ABANDON\n\tabout  '), 'abandon about');
  assert.equal(analyzeMnemonic(`  ${phrase.toUpperCase().replaceAll(' ', '\n')}  `).valid, true);
  assert.equal(analyzeMnemonic(phrase).repeatedWordCount, 10);
  const short = analyzeMnemonic('abandon about');
  assert.equal(short.validWords, true); assert.equal(short.validLength, false); assert.equal(short.checksumValid, null);
  const invalidWord = analyzeMnemonic(phrase.replace('about', '<script>'));
  assert.deepEqual(invalidWord.invalidPositions, [12]); assert.equal(invalidWord.validLength, true); assert.equal(invalidWord.checksumValid, null);
  const checksum = analyzeMnemonic(Array(12).fill('abandon').join(' '));
  assert.equal(checksum.validWords, true); assert.equal(checksum.checksumValid, false); assert.equal(checksum.encodedEntropyBits, null);
  assert.equal(analyzeMnemonic('').validWords, false);
});

test('source assessments do not certify unknown or human-chosen randomness', () => {
  assert.equal(assessSource('unknown', false).title, 'Origin unverified');
  assert.equal(assessSource('human', false).title, 'Human-chosen · strength unknown');
  assert.equal(assessSource('wallet', true).kind, 'public');
  assert.match(assessSource('browser', false).detail, /Self-reported/);
  assert.match(assessSource('browser', false, true).detail, /cannot certify/);
});

test('strength model uses exact integers and the specified rational mean', () => {
  const expected = ['5.39 × 10¹⁸', '2.32 × 10²⁸', '9.95 × 10³⁷', '4.27 × 10⁴⁷', '1.83 × 10⁵⁷'];
  for (const [index, count] of WORD_COUNTS.entries()) {
    const model = modelStrength(count / 3 * 32, 10 ** 12);
    assert.equal(model.averageSecondsNumerator, model.possibilities + 1n);
    assert.equal(model.averageSecondsDenominator, 2_000_000_000_000n);
    assert.equal(scientific(model.averageYears), expected[index]);
    assert.equal(model.oneGuessProbability * Number(model.possibilities), 1);
    const slower = modelStrength(model.bits, 10 ** 6);
    assert.equal(slower.averageSecondsDenominator * 1_000_000n, model.averageSecondsDenominator);
    assert.ok(Math.abs(slower.averageYears / model.averageYears - 1_000_000) < 1e-8);
  }
  assert.equal(modelStrength(128, 10 ** 12).possibilities.toString(), '340282366920938463463374607431768211456');
  assert.equal(scientific(modelStrength(128, 10 ** 12).possibilities), '3.40 × 10³⁸');
  assert.throws(() => modelStrength(132, 1)); assert.throws(() => modelStrength(128, 0));
});

test('published BIP49 testnet, BIP84 mainnet receiving/change and BIP86 Taproot vectors', async () => {
  const nested = await deriveAddresses(phrase, '', { ...defaults, network: 'testnet', addressType: 'nested', count: 1 });
  assert.equal(nested[0].address, '2Mww8dCYPUpKHofjgcXcBCEGmniw9CoaiD2');
  const native = await deriveAddresses(phrase, '', defaults);
  assert.equal(native[0].address, 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  assert.equal(native[1].address, 'bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g');
  assert.equal((await deriveAddresses(phrase, '', { ...defaults, change: 1, count: 1 }))[0].address, 'bc1q8c6fshw2dlwun7ekn9qwf37cu2rn755upcp6el');
  const taproot = await deriveAddresses(phrase, '', { ...defaults, addressType: 'taproot', count: 1 });
  assert.equal(taproot[0].address, 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr');
});

test('independent bitcoinjs/bip32 implementation matches all networks, types and branches', async () => {
  const pass = ' independent passphrase é ';
  const seed = pbkdf2Sync(phrase.normalize('NFKD'), `mnemonic${pass.normalize('NFKD')}`, 2048, 64, 'sha512');
  for (const network of ['mainnet', 'testnet'] as const) {
    const net = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    const root = independentBip32.fromSeed(seed, net);
    for (const addressType of Object.keys(ADDRESS_TYPES) as (keyof typeof ADDRESS_TYPES)[]) {
      for (const change of [0, 1]) {
        const options = { ...defaults, network, addressType, change, account: 2, startIndex: 7 };
        const rows = await deriveAddresses(phrase, pass, options);
        for (const row of rows) {
          const expectedPath = `m/${ADDRESS_TYPES[addressType].purpose}'/${network === 'mainnet' ? 0 : 1}'/2'/${change}/${row.index}`;
          assert.equal(row.path, expectedPath);
          const pubkey = root.derivePath(expectedPath).publicKey;
          const expected = addressType === 'legacy' ? bitcoin.payments.p2pkh({ pubkey, network: net }) : addressType === 'nested' ? bitcoin.payments.p2sh({ redeem: bitcoin.payments.p2wpkh({ pubkey, network: net }), network: net }) : addressType === 'native' ? bitcoin.payments.p2wpkh({ pubkey, network: net }) : bitcoin.payments.p2tr({ internalPubkey: pubkey.slice(1), network: net });
          assert.equal(row.address, expected.address);
          assert.ok(bitcoin.address.toOutputScript(row.address, net).length > 0);
        }
      }
    }
  }
  seed.fill(0);
});

test('passphrase preserves spaces and case while applying NFKD', async () => {
  const first = async (pass: string) => (await deriveAddresses(phrase, pass, { ...defaults, count: 1 }))[0].address;
  const empty = await first('');
  assert.notEqual(await first(' '), empty);
  assert.notEqual(await first('Test'), await first('test'));
  assert.equal(await first('é'), await first('e\u0301'));
  assert.notEqual(await first(' pass '), await first('pass'));
});

test('invalid inputs, ranges, empty selection and cancellation fail closed', async () => {
  for (const override of [{ account: -1 }, { startIndex: 0.5 }, { account: 2 ** 31 }, { count: 101 }, { count: 0 }, { count: Number.NaN }, { change: 2 }, { startIndex: 2 ** 31 - 1, count: 2 }]) assert.throws(() => validateOptions({ ...defaults, ...override }));
  assert.throws(() => validateOptions({ ...defaults, network: 'other' as 'mainnet' }));
  assert.throws(() => validateOptions({ ...defaults, addressType: 'constructor' as 'native' }));
  assert.equal(accountPath({ ...defaults, account: 2 ** 31 - 1 }), "m/84'/0'/2147483647'");
  const last = await deriveAddresses(phrase, '', { ...defaults, startIndex: 2 ** 31 - 1, count: 1 });
  assert.ok(last[0].path.endsWith('/2147483647'));
  await assert.rejects(() => deriveAddresses('invalid', '', defaults), /valid English BIP39/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => deriveAddresses(phrase, '', defaults, controller.signal), { name: 'AbortError' });
});

test('distributed artifact checksum matches source manifest', () => {
  const artifact = readFileSync(new URL('../entropycheck.html', import.meta.url));
  const expected = readFileSync(new URL('../SHA256SUMS', import.meta.url), 'utf8').split(' ')[0];
  assert.equal(createHash('sha256').update(artifact).digest('hex'), expected);
});

test('raw binary preserves width and matches independently hashed checksum and word indices', () => {
  for (const count of WORD_COUNTS) {
    const bytes = createHash('sha256').update(`public binary fixture ${count}`).digest().subarray(0, count / 3 * 4);
    bytes[0] = 0;
    const analysis = analyzeMnemonic(entropyToMnemonic(bytes, wordlist));
    const binary = [...bytes].map(b => b.toString(2).padStart(8, '0')).join('');
    const checksum = createHash('sha256').update(bytes).digest()[0].toString(2).padStart(8, '0').slice(0, count / 3);
    assert.equal(analysis.entropyBinary, binary);
    assert.equal(analysis.checksumBinary, checksum);
    assert.equal(analysis.mnemonicBinary, binary + checksum);
    assert.deepEqual((binary + checksum).match(/.{11}/g)!.map(bits => wordlist[parseInt(bits, 2)]), analysis.normalized.split(' '));
  }
  const invalid = analyzeMnemonic('abandon '.repeat(12));
  for (const key of ['entropyBinary', 'checksumBinary', 'mnemonicBinary'] as const) assert.equal(invalid[key], null);
});

test('public and constant phrases override all generation claims at every length', () => {
  for (const count of WORD_COUNTS) for (const byte of [0, 255]) {
    const analysis = analyzeMnemonic(entropyToMnemonic(new Uint8Array(count / 3 * 4).fill(byte), wordlist));
    for (const source of ['unknown', 'wallet', 'browser', 'physical', 'human', 'public'] as const) {
      const risk = assessPhrase(analysis, source, true);
      assert.equal(risk.kind, 'unsafe'); assert.equal(risk.candidates, 1n);
      assert.equal(risk.quantity, '1 known candidate');
      assert.match(risk.interpretation, /not a measurement of the original generator/);
    }
  }
  for (const [, mnemonic] of vectors) assert.equal(assessPhrase(analyzeMnemonic(mnemonic), 'wallet').kind, 'unsafe');
});

test('recognized constructions expose bounded candidate families, not measured entropy', () => {
  for (const size of [16, 20, 24, 28, 32]) {
    for (let period = 1; period <= 4; period++) {
      const bytes = Uint8Array.from({ length: size }, (_, i) => [0xaa, 0x55, 0xc3, 0x3c][i % period]);
      const risk = assessPhrase(analyzeMnemonic(entropyToMnemonic(bytes, wordlist)), 'browser', true);
      assert.equal(risk.kind, 'weak'); assert.equal(risk.familyBits, period * 8);
      assert.equal(risk.candidates, 1n << BigInt(period * 8));
      assert.match(risk.interpretation, /not measured source entropy/);
    }
    for (const step of [1, -1]) {
      const bytes = Uint8Array.from({ length: size }, (_, i) => (250 + step * i + 256) % 256);
      assert.equal(assessPhrase(analyzeMnemonic(entropyToMnemonic(bytes, wordlist)), 'wallet').familyBits, 9);
    }
    for (const atStart of [true, false]) for (let count = 1; count <= 4; count++) {
      const bytes = new Uint8Array(size); bytes.set([42, 72, 98, 125].slice(0, count), atStart ? 0 : size - count);
      const patterns = findPatterns(bytes, ['distinct', 'words']);
      assert.ok(patterns.some(p => p.code === (atStart ? 'zero-suffix' : 'zero-prefix') && p.familyBits === count * 8));
    }
  }
  for (const count of WORD_COUNTS) {
    // Independently construct a valid repeated-prefix phrase via 11-bit word indices.
    const bits = wordlist.indexOf('zebra').toString(2).padStart(11, '0').repeat(count - 1).padEnd(count / 3 * 32, '0');
    const bytes = Uint8Array.from(bits.match(/.{8}/g)!.map(part => parseInt(part, 2)));
    const analysis = analyzeMnemonic(entropyToMnemonic(bytes, wordlist));
    assert.ok(analysis.patterns.some(p => p.code === 'repeated-prefix-words' && p.familyBits === 22 - count / 3));
    assert.equal(assessPhrase(analysis, 'unknown').kind, 'weak');
  }
});

test('ordinary duplicate words and unrecognized outputs never receive an effective-entropy claim', () => {
  // Fixed public test construction; find a fixture with an ordinary duplicate word.
  let analysis = analyzeMnemonic('');
  for (let i = 0; i < 1000; i++) {
    analysis = analyzeMnemonic(entropyToMnemonic(createHash('sha256').update(`public duplicate fixture ${i}`).digest(), wordlist));
    if (analysis.repeatedWordCount && !analysis.patterns.length) break;
  }
  assert.ok(analysis.repeatedWordCount); assert.equal(analysis.patterns.length, 0);
  for (const source of ['unknown', 'wallet', 'browser', 'physical', 'human'] as const) {
    const risk = assessPhrase(analysis, source, true);
    assert.equal(risk.candidates, null); assert.equal(risk.familyBits, null);
    assert.equal(risk.quantity, source === 'human' ? 'Unknown' : '256 bits if securely random');
    if (source !== 'human') assert.match(risk.interpretation, /Actual source entropy remains unknown/);
    assert.equal(risk.kind, source === 'human' ? 'caution' : 'unverified');
  }
  assert.equal(assessPhrase(analysis, 'public').kind, 'unsafe');
  assert.equal(assessPhrase(analyzeMnemonic(''), 'unknown').kind, 'empty');
  assert.equal(assessPhrase(analyzeMnemonic('not valid'), 'unknown').kind, 'invalid');
});

test('live structure validation separates errors without computing a strength report', () => {
  for (const count of WORD_COUNTS) {
    const mnemonic = entropyToMnemonic(new Uint8Array(count / 3 * 4).fill(42), wordlist);
    const result = validateMnemonicStructure(`  ${mnemonic.toUpperCase()}\n`);
    assert.equal(result.valid, true); assert.equal(result.normalizationChanged, true);
    assert.equal('entropyHex' in result, false); assert.equal('patterns' in result, false);
  }
  assert.match(validationFindings(validateMnemonicStructure('abandon '.repeat(13) + 'art '.repeat(11) + 'buddy')).join(' '), /found 25/);
  assert.match(validationFindings(validateMnemonicStructure(phrase.replace('about', 'notaword'))).join(' '), /positions 12/);
  assert.match(validationFindings(validateMnemonicStructure('abandon '.repeat(12))).join(' '), /checksum does not match/);
});

test('two and three word runs include all boundaries and final entropy choices', () => {
  const example = 'abandon '.repeat(12) + 'art '.repeat(11) + 'buddy';
  const analysis = analyzeMnemonic(example);
  assert.equal(analysis.valid, true);
  const risk = assessPhrase(analysis, 'wallet');
  assert.equal(risk.kind, 'weak'); assert.equal(risk.familyBits, 30);
  assert.equal(risk.candidates, 737837056n);
  assert.match(risk.explanation, /2 runs of identical words/);
  // Independent enumeration of all boundary choices, for every supported length.
  for (const count of WORD_COUNTS) for (const runs of [2, 3]) {
    let boundaries = 0;
    for (let a = 1; a < count - 1; a++) {
      if (runs === 2) boundaries++;
      else for (let b = a + 1; b < count - 1; b++) boundaries++;
    }
    for (const firstRun of [1, Math.floor(count / 2), count - runs]) {
      const prefix = [...Array(firstRun).fill('abandon'), ...Array(count - 1 - firstRun - (runs === 3 ? 1 : 0)).fill('art'), ...(runs === 3 ? ['zoo'] : [])];
      const bits = prefix.map(word => wordlist.indexOf(word).toString(2).padStart(11, '0')).join('').padEnd(count / 3 * 32, '0');
      const bytes = Uint8Array.from(bits.match(/.{8}/g)!.map(part => parseInt(part, 2)));
      const tested = analyzeMnemonic(entropyToMnemonic(bytes, wordlist));
      const pattern = tested.patterns.find(p => p.code === 'word-runs')!;
      assert.ok(pattern);
      const finalEntropyChoices = BigInt(2 ** (11 - count / 3));
      assert.equal(pattern.candidates, BigInt(boundaries) * 2048n * 2047n ** BigInt(runs - 1) * finalEntropyChoices);
      assert.ok((1n << BigInt(pattern.familyBits)) >= pattern.candidates!);
    }
  }
});

test('conditional cracking times preserve formulas, units, and rate scaling', () => {
  const count = 737837056n;
  const model = modelCandidateSearch(count, 1e6);
  assert.equal(model.averageNumerator, 737837057n);
  assert.equal(model.averageDenominator, 2000000n);
  assert.equal(model.averageSeconds, 368.9185285);
  assert.equal(model.fullSearchSeconds, 737.837056);
  assert.equal(formatDuration(model.averageSeconds), '6.15 minutes');
  assert.equal(formatDuration(model.fullSearchSeconds), '12.3 minutes');
  for (const rate of [1e6, 1e9, 1e12]) {
    const result = modelCandidateSearch(count, rate);
    assert.equal(result.averageNumerator, model.averageNumerator);
    assert.equal(result.averageDenominator, BigInt(2 * rate));
    const known = modelCandidateSearch(1n, rate);
    assert.equal(known.averageSeconds, 1 / rate);
    assert.equal(known.fullSearchSeconds, 1 / rate);
  }
  for (const [seconds, expected] of [[1e-12, '0.001 nanoseconds'], [1e-6, '1 microsecond'], [0.001, '1 millisecond'], [1, '1 second'], [60, '1 minute'], [3600, '1 hour'], [86400, '1 day'], [31557600, '1 year']] as const) assert.equal(formatDuration(seconds), expected);
  assert.throws(() => modelCandidateSearch(0n, 1e6));
  assert.throws(() => modelCandidateSearch(1n, 0));
  assert.throws(() => modelCandidateSearch(1n, 0.5));
  assert.throws(() => formatDuration(Number.NaN));
});

test('random-search perspective preserves conditional years, centuries and success probabilities', () => {
  for (const bits of [128, 160, 192, 224, 256]) for (const rate of [1e6, 1e9, 1e12]) {
    const model = modelStrength(bits, rate);
    const independent = modelCandidateSearch(2n ** BigInt(bits), rate);
    assert.equal(model.averageYears, independent.averageSeconds / SECONDS_PER_YEAR);
    assert.equal(model.fullSearchYears, independent.fullSearchSeconds / SECONDS_PER_YEAR);
    assert.equal(model.averageCenturies, model.averageYears / 100);
    assert.equal(model.centurySuccessProbability, (rate * 100 * SECONDS_PER_YEAR) / 2 ** bits);
    assert.ok(model.averageCenturies > 1e12);
    assert.ok(model.centurySuccessProbability > 0 && model.centurySuccessProbability < 1e-16);
  }
  const example = modelStrength(128, 1e12);
  assert.equal(readableYears(example.averageYears), '5.39 quintillion years');
  assert.equal(scientific(example.averageCenturies), '5.39 × 10¹⁶');
  assert.equal(scientific(1 / example.centurySuccessProbability), '1.08 × 10¹⁷');
  assert.equal(readableYears(modelStrength(256, 1e12).averageYears), '1.83 × 10⁵⁷ years');
  assert.throws(() => readableYears(Infinity));
});
