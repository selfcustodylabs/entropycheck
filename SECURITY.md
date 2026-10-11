# Security model

EntropyCheck is an educational BIP39 inspector and Bitcoin address derivation tool. It has not been independently audited. Report suspected vulnerabilities privately through GitHub's security advisory facility if enabled; otherwise contact the repository maintainer without attaching secret material. Never post a live seed phrase or passphrase.

## What is measured

A valid English BIP39 mnemonic encodes 128, 160, 192, 224, or 256 bits plus a checksum. This is an encoding length, not a measurement of the source's unpredictability. Validity cannot establish secrecy, sound generation, or a secure device. A short list of recognizable public test phrases is not a leak database; a nonmatch proves nothing.

Generation-source context is self-reported, except when the page itself just requested random bytes. Editing that phrase removes the in-session provenance. Even in-session generation cannot certify the browser's random generator. Repeated words are allowed; word diversity is not a cryptographic entropy estimator.

The collapsed ideal-randomness numbers model uniformly random phrases, with a known/fixed passphrase and a target that allows candidate verification. The average of an exhaustive, nonrepeating search is `(N + 1) / (2R)` seconds, where `N = 2^ENT`. Rates are hypothetical complete candidate checks, not mining hashes or benchmarks. The model is not a measure of total Bitcoin wallet security: other cryptographic attacks, compromised devices, backups, and disclosure have different costs. The BIP39 512-bit PBKDF2 output and checksum do not add randomness.

## Phrase-specific findings

Known public phrases and constant all-zero/all-one constructions get an unsafe finding and one known candidate. “0 bits of secrecy” describes the public words, not an estimate of a generator's entropy and not an assessment of an independent passphrase. A recognized repeated block, counting sequence, zero-padded short value, or one-to-three-run word prefix gets a conservative bound on that particular candidate family. The bound does not predict attacker knowledge or search order. The Time to crack section applies a user-selected hypothetical rate to this family only. Its average assumes a uniformly positioned target and no repeated guesses; its full-search time is conditional on a known verification target and fixed/known passphrase. Neither is an actual hardware benchmark or an estimate of unknown-passphrase strength. Unsupported constructions get no time estimate.

These checks are intentionally limited. They do not recognize arbitrary predictable algorithms, all leaked mnemonics, or every weak generator. Absence of a finding never certifies security. Generated output is checked with the same rules; generation-source claims cannot override an unsafe result. The app does not silently reroll a suspicious generated phrase.

## Secret handling

- All computation occurs locally. The app has no network clients, analytics, storage, service workers, or automatic online/offline probes.
- Mnemonics, passphrases, decoded entropy, and intermediate keys exist in browser memory. Raw hexadecimal and binary entropy are equivalent to the phrase and appears only in the expandable technical presentation.
- The application does not export extended/private keys. It explicitly maps address results into public-only fields, never serializing HDKey objects.
- Generation buffers, seed buffers, and owned HDKey private data are cleared on their normal and error paths. JavaScript strings, garbage collection, library intermediates, and operating-system copies prevent a guarantee of erasure.
- Clear All clears fields/results, cancels pending work, and resets context. Page navigation clears application state where browser lifecycle events allow. Clipboard history, undo buffers, swap, crash dumps, and screenshots are outside the application's control.
- Copy actions concern public addresses/paths only and require a click. Browsers without clipboard API support use a temporary selection fallback.
- Phrase input disables autocomplete/spelling/case correction. Browser behavior and extensions may override these preferences. Print styling hides entered secret fields, raw entropy, and derived addresses.

## Environment and distribution

The hosted demo accepts arbitrary test input, as requested, but should not receive real recovery phrases. A malicious replacement of the page can bypass all application safeguards. An offline copy reduces network exposure but cannot protect an already compromised browser, OS, or machine. A `file://` URL is not proof of an air gap. The app intentionally does not depend on `navigator.onLine` or send connectivity probes.

The single-file artifact embeds exact dependency versions and a restrictive hash-based CSP. Build-time checks reject obvious network/persistence API calls; browser tests monitor automatic requests and prohibit storage writes. These are checks, not a formal proof against exfiltration.

SHA-256 checksums detect changes only relative to a trusted checksum. Initial releases are not signed with a separately authenticated maintainer key. Pinned dependencies, npm integrity entries, pinned Action commits, and reproducible builds aid review; they do not eliminate supply-chain risk. Release review should include dependency diffs and the generated artifact, not just a successful test run.

## Deliberate boundaries

English BIP39 only. An invalid English BIP39 result does not establish that a phrase from another wallet scheme is corrupt. Passphrases retain case and spaces, use NFKD normalization, and cannot be checked for correctness without an expected target. A new generated or loaded example phrase clears a previously entered passphrase to avoid accidental carryover.

Derivation is single-signature only: mainnet/testnet, BIP44/49/84/86, fixed standard path layout, indices below `2^31`, at most 100 rows. Changes invalidate old results immediately. No funds, balance queries, signing, recovery scanning, custom paths, or network broadcasting are supported.
