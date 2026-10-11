# Research and design decisions

Review date: **2026-10-11**. This review examined primary specifications, project documentation, and selected APIs. It was not an audit of these projects. Repository HEAD revisions recorded during implementation are in [research-versions.json](research-versions.json); linked hosted documentation can change independently of those revisions.

## Comparable tools

| Project | Relevant findings | Decision |
| --- | --- | --- |
| [Ian Coleman BIP39](https://github.com/iancoleman/bip39) | Browser mnemonic conversion, generation, derivation, and a downloadable standalone HTML assembled from source; MIT. | Adopt the single-file distribution approach. Build a narrower Bitcoin-only interface with original code. |
| [BitcoinQnA SeedTool](https://github.com/BitcoinQnA/seedtool) | Educational seed exploration, entropy inputs, address verification, single-file downloads, documented release verification; GPL-3.0. | Learn from its educational/offline workflow. Include no GPL code. Keep physical-entropy input, BIP85, and recovery outside v1. |
| [SeedPicker](https://github.com/merland/seedpicker) | Step-by-step physical selection and a last-word calculator. It distinguishes random selection from memorable choices. | Explain source assumptions; never silently repair a checksum or encourage choosing words by taste. |
| [SeedSigner](https://github.com/SeedSigner/seedsigner) | An air-gapped, stateless hardware workflow and reproducible builds. | Adopt ephemeral session handling and reproducibility, while explaining that a general-purpose browser lacks the same hardware boundary. |
| [Krux mnemonic generation](https://selfcustody.github.io/krux/getting-started/usage/generating-a-mnemonic/) | Physical/camera entropy methods and explicit caveats that statistical indicators are not absolute cryptographic entropy measurements. | Do not apply Shannon-frequency scores to a single phrase. No physical or camera generation in v1. |
| [Sparrow quick start](https://sparrowwallet.com/docs/quick-start.html) | Distinct script types, passphrases, derivation paths, and resulting addresses. | Make path and network visible beside each address. Do not infer an original wallet's path from words. |
| [Trezor python-mnemonic](https://github.com/trezor/python-mnemonic) | The BIP39 reference implementation and multilingual public vectors. | Vendor the 24 English vectors, pin their source revision, and use them for known-public detection and cryptographic tests. |
| [BTCRecover](https://btcrecover.readthedocs.io/en/latest/) | Recovery of partially remembered seeds/passphrases and wallet-specific path handling. | Explain that knowledge of some words radically changes the search problem. Avoid presenting whole-space numbers as recovery benchmarks. |
| [Coinb.in](https://github.com/OutCast3k/coinbin) | Browser Bitcoin utilities with offline address/transaction capabilities. | Confirms a static browser delivery is viable; transaction operations and network broadcasting are intentionally excluded. |

## Standards as the source of truth

- [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki): allowed entropy lengths, wordlist, checksum, NFKD, and PBKDF2-HMAC-SHA512 with 2,048 iterations and a 64-byte output. Its purpose is encoding generated randomness, not making user-composed sentences unpredictable.
- [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki): hierarchical key derivation, hardened indices, and leading-zero test vectors.
- [BIP44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki), [BIP49](https://github.com/bitcoin/bips/blob/master/bip-0049.mediawiki), [BIP84](https://github.com/bitcoin/bips/blob/master/bip-0084.mediawiki), [BIP86](https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki): legacy, nested SegWit, native SegWit, and single-key Taproot conventions.
- [BIP173](https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki) and [BIP350](https://github.com/bitcoin/bips/blob/master/bip-0350.mediawiki): Bech32 for witness v0 and Bech32m for witness v1, including Taproot.
- [NIST SP 800-22](https://csrc.nist.gov/pubs/sp/800/22/r1/upd1/final): statistical tests alone cannot certify a generator suitable for cryptography. A phrase-level inspection is even less evidence of generator quality.
- [Web Cryptography specification](https://w3c.github.io/webcrypto/#Crypto-method-getRandomValues): `getRandomValues` supplies cryptographically strong pseudorandom bytes. No weak fallback is acceptable.
- [MDN navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine): connectivity heuristics are unreliable. We display delivery context, not an air-gap claim.
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages): static hosting fits a forkable project with no backend.

## Why encoded length is not a safety score

A checksum-valid phrase can arise from a secure generator, a predictable algorithm, a public example, or deliberate human choices. There is no phrase-only procedure that distinguishes all of these. Length describes capacity; source quality and secrecy determine whether the conditional search model is relevant.

The application reports structure, encoded length, and source context separately. Ordinary repeated words do not subtract from an entropy score. The revised interface leads with known public exposure and a limited set of simple constructions, then keeps the ideal-randomness model collapsed. The phrase itself cannot establish source entropy. See [revised assessment plan](revised-assessment-plan.md).

### Enumerable constructions: calculations, not statistical scores

These are original application checks derived from BIP39's reversible encoding, not claims that NIST endorses phrase pattern scoring. For a fixed supported length:

- An all-zero or all-one encoding is one publicly reproducible phrase. Bundled public vectors likewise supply exact candidates. “0 bits of secrecy” concerns these known words, not the original generation distribution or any independent passphrase.
- Repeating a block of `p` bytes, for `p` from 1 through 4, yields at most `2^(8p)` candidates, including an incomplete final repetition.
- Incrementing or decrementing each byte modulo 256 gives at most `256 × 2 = 512` candidates.
- Allowing only `k` leading or trailing bytes to vary, with all other bytes zero, gives `2^(8k)` candidates. We detect `k` from 1 through 4.
- For `w` words with every word before the last identical, there are `2^11` choices for the repeated word, and `11 − w/3` remaining entropy bits in the final word. This gives `2^(22 − w/3)` valid phrases. Occasional duplicate words are outside this rule.

- For two or three constant runs before the last word, allow every split of the `w − 1` prefix words into `r` nonempty runs: `C(w − 2, r − 1)` possibilities. Choose the first run word from 2,048 words and each later word from 2,047 choices distinct from its predecessor. Include all final entropy suffixes. Thus `N = 2048 × 2047^(r − 1) × C(w − 2, r − 1) × 2^(11 − w/3)`. For 24 words and two runs, `N = 737,837,056`. This does not assume the actual words or the split position are known. Adjacent words may repeat across nonadjacent runs, so a three-run ABA pattern is included.

The smallest matched family supplies the displayed upper bound; technical details list all matches. These sets are not a distribution of the original generator. The tool therefore never calls these bounds “measured entropy” or converts them into unconditional cracking times. The explicit Time to crack section instead applies a hypothetical checking rate to the detected family: conditional average `(N + 1)/(2R)` and full search `N/R`, requiring a known verification target and fixed/known passphrase. Rates are not benchmarks; average position is a model assumption. At 10^6 checks/s the two-run example takes about 6.15 minutes on average and 12.3 minutes for the whole family. Unsupported constructions get no time estimate. With no match, source entropy is unknown. A checksum-valid phrase with balanced zero/one frequencies can still be trivially enumerable, such as a repeated `aa55` byte block. These checks also miss sophisticated predictable constructions, including arbitrary weak PRNG outputs.

### Milk Sad: an actual failure mode

The [original Milk Sad disclosure](https://milksad.info/disclosure.html) describes Libbitcoin Explorer's use of an MT19937 generator with a 32-bit initial state. Requesting a 256-bit output expanded a small set of possible starting values rather than adding randomness. At most about 4.29 billion starting states could produce those outputs. The generated words could still pass BIP39 checks.

Our inference: a trustworthy assessment must describe how a phrase was generated, while acknowledging that a self-reported source is not verification. We do not implement a vulnerability scanner or claim to detect every affected phrase.

## Numerical model

For `ENT` uniformly random bits, `N = 2^ENT`. A single guess succeeds with probability `1/N`. A uniformly placed target in an exhaustive search without repeats takes `(N + 1)/2` checks on average. Divide by the hypothetical complete-check rate `R`, then by 31,557,600 seconds per year.

| Words | ENT | Checksum | Possibilities, approximately | Average years at 10¹² complete checks/s |
| --- | ---: | ---: | ---: | ---: |
| 12 | 128 | 4 | 3.40 × 10³⁸ | 5.39 × 10¹⁸ |
| 15 | 160 | 5 | 1.46 × 10⁴⁸ | 2.32 × 10²⁸ |
| 18 | 192 | 6 | 6.28 × 10⁵⁷ | 9.95 × 10³⁷ |
| 21 | 224 | 7 | 2.70 × 10⁶⁷ | 4.27 × 10⁴⁷ |
| 24 | 256 | 8 | 1.16 × 10⁷⁷ | 1.83 × 10⁵⁷ |

Exact integer totals and a rational mean are retained using BigInt. Scientific notation and years are rounded for display. The UI assumes a fixed/known passphrase and a known verification target. Rates are illustrative, not measured hardware speeds; mining hashes are not BIP39 candidate checks. Whole-space numbers do not model other attacks on Bitcoin keys, theft, partial recovery, or malware.

Coin-flip analogy: guessing the exact ordered outcomes of `ENT` independent fair flips has probability `1/2^ENT`. Lottery analogy: one winner among `2^ENT` equally likely tickets. Both analogies use the same assumptions as the mathematical model, without uncertain physical comparisons.

## Library selection

Runtime dependencies: [@scure/bip39 2.4.0](https://github.com/paulmillr/scure-bip39), [@scure/bip32 2.4.0](https://github.com/paulmillr/scure-bip32), and [@scure/btc-signer 2.4.1](https://github.com/paulmillr/scure-btc-signer). These provide browser-compatible implementations and allow bundling only required functionality without a WASM runtime or remote loading. Only payment/address helpers from btc-signer are imported, never its optional network clients.

The projects document audit histories, but reviews of older versions do not establish that every current line—or this application—has been independently audited. All versions and transitive dependency integrity hashes are locked. Their actual licenses are collected from the installed production bundle graph and embedded in the offline file.

Independent verification uses bitcoinjs-lib 7.0.2, bip32 5.0.1, @bitcoinerlab/secp256k1 2.0.0, and Node's PBKDF2. Some low-level cryptographic dependencies overlap, so cross-implementation comparisons supplement published vectors rather than establish complete independence at every primitive.
