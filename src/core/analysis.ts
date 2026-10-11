import { mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import publicPhrases from '../public-phrases.json' with { type: 'json' };
import { findPatterns, type PatternFinding } from './risk.ts';

export const WORD_COUNTS = [12, 15, 18, 21, 24] as const;
export type WordCount = typeof WORD_COUNTS[number];
export type GenerationSource = 'unknown' | 'wallet' | 'browser' | 'physical' | 'human' | 'public';
const words = new Set(wordlist);
const known = new Set(publicPhrases);

export function normalizeMnemonic(input: string): string {
  return input.normalize('NFKD').toLowerCase().trim().replace(/\s+/gu, ' ');
}

export function isWordCount(count: number): count is WordCount {
  return (WORD_COUNTS as readonly number[]).includes(count);
}

export function analyzeMnemonic(input: string) {
  const normalized = normalizeMnemonic(input);
  const tokens = normalized ? normalized.split(' ') : [];
  const validLength = isWordCount(tokens.length);
  const invalidPositions = tokens.flatMap((word, index) => words.has(word) ? [] : [index + 1]);
  const validWords = tokens.length > 0 && invalidPositions.length === 0;
  const checksumValid = validLength && validWords ? validateMnemonic(normalized, wordlist) : null;
  const valid = checksumValid === true;
  let entropyHex: string | null = null;
  let entropyBinary: string | null = null;
  let checksumBinary: string | null = null;
  let mnemonicBinary: string | null = null;
  let patterns: PatternFinding[] = [];
  if (valid) {
    const entropy = mnemonicToEntropy(normalized, wordlist);
    try {
      entropyHex = Array.from(entropy, byte => byte.toString(16).padStart(2, '0')).join('');
      entropyBinary = Array.from(entropy, byte => byte.toString(2).padStart(8, '0')).join('');
      mnemonicBinary = tokens.map(word => wordlist.indexOf(word).toString(2).padStart(11, '0')).join('');
      checksumBinary = mnemonicBinary.slice(entropyBinary.length);
      patterns = findPatterns(entropy, tokens);
    }
    finally { entropy.fill(0); }
  }
  return {
    normalized, normalizationChanged: input !== normalized,
    wordCount: tokens.length, validLength, validWords, invalidPositions, checksumValid, valid,
    encodedEntropyBits: valid ? tokens.length / 3 * 32 : null,
    checksumBits: validLength ? tokens.length / 3 : null,
    entropyHex, entropyBinary, checksumBinary, mnemonicBinary, patterns,
    repeatedWordCount: tokens.length - new Set(tokens).size,
    knownPublic: known.has(normalized),
  };
}
export type MnemonicAnalysis = ReturnType<typeof analyzeMnemonic>;

export function assessSource(source: GenerationSource, knownPublic: boolean, generatedHere = false) {
  if (knownPublic || source === 'public') return {
    kind: 'public', title: 'Public phrase · never use for funds',
    detail: 'These words are publicly known or reported as public. A valid checksum does not make them secret. A passphrase does not restore secrecy to the words.',
  };
  if (source === 'human') return {
    kind: 'caution', title: 'Human-chosen · strength unknown',
    detail: 'Self-reported source. Memorable choices can be predictable even when the checksum is valid. Their effective entropy cannot be measured from this phrase. The random-search model below does not assess this phrase.',
  };
  if (source === 'unknown') return {
    kind: 'neutral', title: 'Origin unverified',
    detail: 'The words cannot reveal whether their source was random, biased, predictable, or exposed. Not recognizing a public example does not establish secrecy.',
  };
  if (source === 'browser' && generatedHere) return {
    kind: 'neutral', title: 'Browser randomness requested',
    detail: 'Generated in this session using crypto.getRandomValues. Strength depends on the browser, operating system, device, and secrecy. This tool cannot certify those conditions.',
  };
  const descriptions = {
    wallet: 'Self-reported wallet generation. The theoretical strength assumes a correctly implemented cryptographic random generator and a secret phrase.',
    browser: 'Self-reported browser generation. The theoretical strength assumes a correctly implemented cryptographic random generator and a secret phrase.',
    physical: 'Self-reported physical randomness. Strength depends on independent, unbiased outcomes, enough observations, and a correct conversion. This phrase cannot verify those conditions.',
  };
  return { kind: 'neutral', title: 'Source reported · not verified', detail: descriptions[source] };
}
