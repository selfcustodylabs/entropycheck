import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { isWordCount } from './analysis.ts';

export function validateBinaryEntropy(raw: string) {
  const binary = raw.replace(/\s/g, '');
  const bitCount = binary.length;
  const wordCount = bitCount / 32 * 3;
  const error = /[^01]/.test(binary)
    ? 'Use only 0 and 1, with optional spaces or line breaks.'
    : !isWordCount(wordCount)
      ? `Enter exactly 128, 160, 192, 224, or 256 bits without checksum bits; found ${bitCount}.`
      : null;
  return { binary, bitCount, wordCount: error ? null : wordCount, error };
}

export function importBinaryEntropy(raw: string): string {
  const { binary, error } = validateBinaryEntropy(raw);
  if (error) throw new Error(error);
  const entropy = new Uint8Array(binary.length / 8);
  try {
    for (let i = 0; i < entropy.length; i++) entropy[i] = Number.parseInt(binary.slice(i * 8, i * 8 + 8), 2);
    return entropyToMnemonic(entropy, wordlist);
  } finally { entropy.fill(0); }
}

export function generatePhrase(count: number, provider: Pick<Crypto, 'getRandomValues'> | undefined = globalThis.crypto): string {
  if (!isWordCount(count)) throw new Error('Choose 12, 15, 18, 21, or 24 words.');
  if (typeof provider?.getRandomValues !== 'function') throw new Error('Secure browser randomness is unavailable. Generation is disabled.');
  const entropy = new Uint8Array(count / 3 * 4);
  try {
    provider.getRandomValues(entropy);
    return entropyToMnemonic(entropy, wordlist);
  } finally { entropy.fill(0); }
}
