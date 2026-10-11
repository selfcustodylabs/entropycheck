import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { isWordCount } from './analysis.ts';

export function generatePhrase(count: number, provider: Pick<Crypto, 'getRandomValues'> | undefined = globalThis.crypto): string {
  if (!isWordCount(count)) throw new Error('Choose 12, 15, 18, 21, or 24 words.');
  if (typeof provider?.getRandomValues !== 'function') throw new Error('Secure browser randomness is unavailable. Generation is disabled.');
  const entropy = new Uint8Array(count / 3 * 4);
  try {
    provider.getRandomValues(entropy);
    return entropyToMnemonic(entropy, wordlist);
  } finally { entropy.fill(0); }
}
