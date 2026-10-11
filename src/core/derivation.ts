import { mnemonicToSeed } from '@scure/bip39';
import { HDKey, HARDENED_OFFSET } from '@scure/bip32';
import { p2pkh, p2sh, p2wpkh, p2tr, NETWORK, TEST_NETWORK } from '@scure/btc-signer';
import { analyzeMnemonic } from './analysis.ts';

export const ADDRESS_TYPES = {
  legacy: { purpose: 44, name: 'Legacy', script: 'P2PKH', prefix: '1…' },
  nested: { purpose: 49, name: 'Nested SegWit', script: 'P2SH-P2WPKH', prefix: '3…' },
  native: { purpose: 84, name: 'Native SegWit', script: 'P2WPKH', prefix: 'bc1q…' },
  taproot: { purpose: 86, name: 'Taproot', script: 'P2TR', prefix: 'bc1p…' },
} as const;
export type AddressType = keyof typeof ADDRESS_TYPES;
export interface DerivationOptions {
  network: 'mainnet' | 'testnet';
  addressType: AddressType;
  account: number;
  change: number;
  startIndex: number;
  count: number;
}
export interface AddressResult {
  network: DerivationOptions['network'];
  addressType: AddressType;
  path: string;
  index: number;
  address: string;
}
const MAX_INDEX = 0x7fffffff;

export function validateOptions(options: DerivationOptions): void {
  if (options.network !== 'mainnet' && options.network !== 'testnet') throw new Error('Choose Bitcoin mainnet or testnet.');
  if (!Object.hasOwn(ADDRESS_TYPES, options.addressType)) throw new Error('Choose a supported Bitcoin address type.');
  for (const key of ['account', 'startIndex'] as const) {
    if (!Number.isSafeInteger(options[key]) || options[key] < 0 || options[key] > MAX_INDEX) throw new Error('Account and starting index must be whole numbers from 0 to 2147483647.');
  }
  if (options.change !== 0 && options.change !== 1) throw new Error('Choose receiving or change addresses.');
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 100) throw new Error('Request between 1 and 100 addresses.');
  if (options.startIndex + options.count - 1 > MAX_INDEX) throw new Error('The requested address range exceeds index 2147483647.');
}

export function accountPath(options: DerivationOptions): string {
  validateOptions(options);
  return `m/${ADDRESS_TYPES[options.addressType].purpose}'/${options.network === 'mainnet' ? 0 : 1}'/${options.account}'`;
}

export async function deriveAddresses(input: string, passphrase: string, options: DerivationOptions, signal?: AbortSignal): Promise<AddressResult[]> {
  validateOptions(options);
  const analysis = analyzeMnemonic(input);
  if (!analysis.valid) throw new Error('A valid English BIP39 phrase is required to derive addresses.');
  signal?.throwIfAborted();
  const seed = await mnemonicToSeed(analysis.normalized, passphrase.normalize('NFKD'));
  let current: HDKey | undefined;
  try {
    signal?.throwIfAborted();
    current = HDKey.fromMasterSeed(seed);
    const hardened = HARDENED_OFFSET;
    for (const index of [ADDRESS_TYPES[options.addressType].purpose + hardened, (options.network === 'mainnet' ? 0 : 1) + hardened, options.account + hardened, options.change]) {
      const next: HDKey = current.deriveChild(index);
      if (next.index !== index) { next.wipePrivateData(); throw new Error('A requested BIP32 child is invalid. Choose another account or branch.'); }
      current.wipePrivateData();
      current = next;
    }
    const network = options.network === 'mainnet' ? NETWORK : TEST_NETWORK;
    const base = `${accountPath(options)}/${options.change}`;
    const results: AddressResult[] = [];
    for (let index = options.startIndex; index < options.startIndex + options.count; index++) {
      signal?.throwIfAborted();
      const child = current.deriveChild(index);
      try {
        if (child.index !== index) throw new Error('A requested BIP32 child is invalid. Choose another starting index.');
        const publicKey = child.publicKey;
        if (!publicKey) throw new Error('Public key derivation failed.');
        const payments = {
          legacy: () => p2pkh(publicKey, network),
          nested: () => p2sh(p2wpkh(publicKey, network), network),
          native: () => p2wpkh(publicKey, network),
          taproot: () => p2tr(publicKey.slice(1), undefined, network),
        };
        const address = payments[options.addressType]().address;
        if (!address) throw new Error('Address encoding failed.');
        results.push({ network: options.network, addressType: options.addressType, path: `${base}/${index}`, index, address });
      } finally { child.wipePrivateData(); }
      if ((index - options.startIndex + 1) % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    signal?.throwIfAborted();
    return results;
  } finally {
    current?.wipePrivateData();
    seed.fill(0);
  }
}
