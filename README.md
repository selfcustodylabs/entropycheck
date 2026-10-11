# EntropyCheck

**Identify known seed-phrase weaknesses, understand the limits of entropy checks, and derive Bitcoin addresses — entirely in your browser.**

[Public test demo](https://selfcustodylabs.github.io/entropycheck/) · [Download offline HTML](https://github.com/selfcustodylabs/entropycheck/releases/latest/download/entropycheck.html) · [Research](docs/research.md) · [Security model](SECURITY.md)

The public demo is for public examples and disposable test phrases. Handle real recovery phrases only in a verified offline copy on a trusted, disconnected computer. Local computation alone does not protect against a compromised website, browser extension, operating system, or device.

## What it does

- Validates English BIP39 word count, word membership, and checksum live inside the input box, before Analyze is pressed.
- Supports 12, 15, 18, 21, and 24 words, with browser CSPRNG generation.
- Reports encoded entropy length and generation-source context separately. It does **not** claim to measure actual randomness from one phrase or assign a safety percentage.
- Leads with a phrase-specific assessment: public/constant phrases, recognized simple constructions, or actual randomness unverified. Source claims never override concrete weaknesses.
- Shows raw hexadecimal entropy, full-width binary entropy, checksum bits, and complete mnemonic binary.
- Shows conditional **Time to crack** estimates for detected candidate families, with adjustable hypothetical checking rates, average and full-family times, and explicit passphrase assumptions. For valid phrases with no detected weakness, shows a separate full-space estimate labeled “assuming secure random generation.”
- Shows conditional years, centuries, 100-year success odds, and coin-flip/lottery analogies in the main report. A collapsed calculator also compares other phrase lengths.
- Derives mainnet and testnet single-signature addresses: BIP44 legacy, BIP49 nested SegWit, BIP84 native SegWit, and BIP86 Taproot.
- Supports a BIP39 passphrase, accounts, receiving/change branches, and bounded address ranges.
- Contains no analytics, wallet balance requests, persistent session storage, remote fonts, runtime dependencies, or service workers.

The phrase alone cannot identify your wallet's derivation path or validate a passphrase. Every passphrase produces a wallet. Check derived addresses against an independently known address when verifying wallet settings.

## Reading the assessment

Paste or edit the phrase to see immediate word-count, wordlist, and checksum feedback in the input box. Click **Analyze phrase** for the security assessment. Editing the words or generation context clears the old report and addresses until you analyze again. Generation and public-example buttons analyze immediately; every run provides visible completion feedback.

The 24-word phrase `abandon` repeated 23 times followed by `art` is structurally valid, but encodes 256 zero bits. EntropyCheck calls it **Unsafe: all-zero phrase** and shows **1 known candidate**, not the ideal 2^256 search space. Zero secrecy in publicly known words does not mean we measured the original generator's entropy. A separate BIP39 passphrase is not evaluated.

The tool also recognizes repeated 1–4 byte blocks, upward/downward byte sequences, short values padded with zeros, and prefixes formed from one, two, or three constant word runs. It reports the size of that particular candidate family. These are limited pattern checks, not a statistical entropy estimator or exhaustive weak-seed database. Ordinary duplicate words do not imply weakness. An ordinary-looking output of a compromised generator can escape every check.

For example, the checksum-valid 24-word phrase with 12 `abandon` words, 11 `art` words, then `buddy` belongs to the two-run family. Counting all word choices, split positions, and final entropy choices gives 737,837,056 candidates. At an illustrative one million complete checks per second, the average is about 6.15 minutes and the full family about 12.3 minutes. These figures assume the attacker targets this family, has a known verification target, and knows the passphrase. They are not measured hardware performance, actual source entropy, or a wallet-compromise prediction. A version with an extra word is invalid and receives no crack-time estimate.

When no weakness is recognized, actual source entropy remains unknown, but the main report now explains the potential strength **if securely random**. For 12 words at one trillion complete checks per second, the average exhaustive phrase search is about 5.39 quintillion years, or 5.39 × 10¹⁶ centuries. After 100 years of checking, the modeled success probability is about 1 in 1.08 × 10¹⁷. These figures assume uniform generation, secrecy, no partial knowledge, and a known target and passphrase; they are not a measured property of the input or overall wallet security. Recognized weak/public phrases take precedence, and reported human choices do not receive this random-generation estimate in the main report. See the [revised assessment plan](docs/revised-assessment-plan.md) for the report contract and test requirements.

## Use offline

1. Download `entropycheck.html` and `SHA256SUMS` from the same release. The repository also contains the current standalone file.
2. Verify the download against a checksum from a trusted source:

   ```sh
   sha256sum --check SHA256SUMS
   ```

   On macOS: `shasum -a 256 entropycheck.html`. On Windows PowerShell: `Get-FileHash .\entropycheck.html -Algorithm SHA256`. Compare the full result with `SHA256SUMS`.
3. Transfer the verified file to your trusted, disconnected computer and double-click it. No Node.js, web server, or network access is required.
4. Use **Clear all**, then close the browser when finished. The application cannot guarantee erasure of browser/OS memory, clipboard history, or browser crash data.

A hash establishes integrity relative to the checksum you trust; an attacker replacing both files can supply a matching hash. These initial releases do not claim a maintainer signing identity. You can also reproduce the file from source. The interface labels local-file execution without claiming that the device is air-gapped.

## Develop and reproduce

Requirements: **Node.js 24.21.0**, npm **11.19.0** (bundled with that Node version), and the committed lockfile. Use the version in `.nvmrc`.

```sh
nvm install
nvm use
npm ci --ignore-scripts
npm run check
npm run build
npm exec playwright install chromium firefox
npm run test:browser
npm run serve
```

On Linux CI, install browser system libraries with `npm exec playwright install --with-deps chromium firefox`. Development preview: `http://127.0.0.1:4173`.

`npm run check` typechecks the code, runs cryptographic/model tests, and independently rebuilds in memory to compare the distributed HTML, license notices, and checksums byte-for-byte. `npm run build` regenerates the tracked artifacts and creates `dist/` for Pages. Commit changes to source, lockfile, `entropycheck.html`, `SHA256SUMS`, and `THIRD_PARTY_NOTICES.txt` together.

The build has no time-dependent fields or machine-specific paths. The Pages `index.html` and offline `entropycheck.html` contain identical bytes. The content-security policy authorizes only the exact bundled script/style hashes and blocks network connections.

## Fork and publish

1. Fork the repository. Update the project links in this README and the footer of `src/index.html` for your GitHub owner/repository, then rebuild the artifact.
2. Enable Actions in the fork, then choose **Settings → Pages → Source → GitHub Actions**.
3. Push to `main`, or run the **Verify and publish Pages** workflow manually. Pages deployment runs only after typechecking, core tests, reproducibility verification, and both browser suites pass. Pull requests run verification without publication.
4. For a release, update the displayed version and package version together, rebuild artifacts, then push a `v*` tag. The release workflow verifies the tagged source and publishes the HTML, checksums, and license notices. It does not overwrite an existing release.

Runtime behavior and deployment workflows are independent of the owner/repository. HTML downloads use a relative path, so a project site hosted under any repository name works. Footer project/checksum links point to this project's canonical repository until you update them for your fork.

## Verification

- All 24 English Trezor BIP39 vectors, including expected PBKDF2 seeds and BIP32 roots.
- BIP32 reference vectors 1–4, including leading zeros.
- Published BIP49, BIP84, and BIP86 addresses.
- Additional cross-checks against **bitcoinjs-lib + bip32**, with Node's PBKDF2 implementation, across every supported network/type/branch.
- All lengths, invalid input, source assessment, bounded pattern families, binary/checksum encoding, normalization, passphrase case/spaces, generation failures, derivation boundaries, cancellation, and exact numerical models.
- Chromium and Firefox: offline file operation, no automatic HTTP requests/storage writes, hosted/offline parity, stale-result removal, Clear All, keyboard and mobile behavior, explicit Analyze feedback, model isolation, and unsafe output from a simulated broken RNG.

Only public fixtures are used in tests. Never put real recovery material in tests, screenshots, issue reports, or commits. This application has not received an independent security audit; a dependency's audit does not audit this application.

## Project layout

`src/core/` contains the testable analysis, generation, strength, and derivation modules. `src/app.ts` coordinates the UI; `scripts/build.mjs` bundles the standalone artifact. Research citations and recorded revisions are in `docs/`; public standards fixtures are in `tests/fixtures/`.

No backend or public network API is provided. Multisig construction, arbitrary derivation paths, private-key exports, transaction signing, balances, recovery searches, and physical-entropy generation are outside v1.

## License

Original application code is [MIT](LICENSE). Bundled dependencies retain their licenses in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and inside the offline file. See [fixture notices](tests/fixtures/README.md) for reference data attribution. SeedTool's GPL source is not included.
