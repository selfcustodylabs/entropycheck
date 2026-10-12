# EntropyCheck

**Identify known seed-phrase weaknesses, understand the limits of entropy checks, and derive Bitcoin addresses — entirely in your browser.**

[Public test demo](https://selfcustodylabs.github.io/entropycheck/) · [Download offline HTML](https://github.com/selfcustodylabs/entropycheck/releases/latest/download/entropycheck.html) · [Research](docs/research.md) · [Security model](SECURITY.md)

The public demo is for public examples and disposable test phrases. Handle real recovery phrases only in a verified offline copy on a trusted, disconnected computer. Local computation alone does not protect against a compromised website, browser extension, operating system, or device.

## What it does

- Validates English BIP39 word count, word membership, and checksum live inside the input box, before Analyze is pressed.
- Supports 12, 15, 18, 21, and 24 words, with browser CSPRNG generation.
- Imports raw binary entropy (128, 160, 192, 224, or 256 bits), preserving leading zeros and adding the BIP39 checksum automatically.
- Reports encoded entropy length and observed in-session generation separately, without asking you to report a source. It does **not** claim to measure actual randomness from one phrase or assign a safety percentage.
- Leads with a phrase-specific assessment: public/constant phrases, recognized simple constructions, or actual randomness unverified. Source claims never override concrete weaknesses.
- Shows raw hexadecimal entropy, full-width binary entropy, checksum bits, and complete mnemonic binary.
- Maps each seed word to its zero-based BIP39 index (0–2047), 11-bit binary representation, and corresponding GitHub line (index + 1) in expandable entropy details. Phrase order is labeled separately.
- Shows the phrase result, a simple analogy, and a conditional guessing-time estimate. One expandable area contains checking speeds, assumptions, exact odds, formulas, and comparisons with other phrase lengths.
- Derives mainnet and testnet single-signature addresses: BIP44 legacy, BIP49 nested SegWit, BIP84 native SegWit, and BIP86 Taproot.
- Supports a BIP39 passphrase, accounts, receiving/change branches, and bounded address ranges.
- Contains no analytics, wallet balance requests, persistent session storage, remote fonts, runtime dependencies, or service workers.

The phrase alone cannot identify your wallet's derivation path or validate a passphrase. Every passphrase produces a wallet. Check derived addresses against an independently known address when verifying wallet settings.

## Reading the assessment

Use the **Generate new seed**, **Import seed phrase**, or **Import binary entropy** tabs to choose how to start. **Generate new seed** is the default on first visit and after **Clear all**. Each tab keeps its own input, analyzed phrase, passphrase, address settings, and derived addresses in memory. Switching tabs restores that tab’s report; generation or import does not overwrite another tab. Generated and binary-imported words appear as selectable text with copy buttons in their own tabs. Phrase entry accepts English letters and whitespace; numbers and special characters are rejected without altering the words. Editing a phrase shows immediate word-count, wordlist, and checksum feedback. Click **Analyze phrase** for its assessment, or **Generate** to create and analyze a test phrase in one step.

All three navigation links remain visible from the start. **Understand** and **Addresses** become available when the selected tab has a valid analyzed phrase; unavailable links explain this prerequisite. Assessment and address sections show only the selected tab’s results. Editing an input clears that tab’s outdated report and addresses. **Clear all** resets all three tabs.

**What we can tell you** leads with the finding and an illustrated report header. It separates structural validity and encoded bit length from the limits of security assessment. Expand **Why this result?** for the reasoning or **Generation source & check limits** for provenance and limitations. Entropy details include individual copy buttons for hexadecimal entropy, raw binary entropy, checksum bits, and full mnemonic binary. Copying preserves every leading zero.

To use your own bits, choose **Import binary entropy**, paste `0` and `1` digits, and click **Import & analyze**. The resulting words appear directly below the input in the same tab, with a copy button. Typing accepts only `0` and `1`, with normal editing and clipboard shortcuts. Pasted spaces and line breaks are removed. A paste containing any other character is rejected in full, preserving the existing draft. Unsupported bit lengths cannot be imported. Supply entropy only, without checksum bits: 128/160/192/224/256 bits produce 12/15/18/21/24 words. Import preserves the input bits, adds the checksum, and clears that tab’s previous passphrase and addresses. Editing bits removes the previous binary result until you import again. **Clear all** also removes draft bits.

For a simple dice method, record one bit per independent roll of a fair six-sided die: 1–3 → `0`, 4–6 → `1`. Collect exactly the required number of bits, keeping every outcome in order. This assumes fair, independent rolls; conversion does not remove bias or establish randomness. The page cannot verify the origin of imported bits. Binary entropy reveals the same secret as the recovery words.

The 24-word phrase `abandon` repeated 23 times followed by `art` is structurally valid, but encodes 256 zero bits. EntropyCheck calls it **Unsafe: all-zero phrase** and shows **1 known candidate**, not the ideal 2^256 search space. Zero secrecy in publicly known words does not mean we measured the original generator's entropy. A separate BIP39 passphrase is not evaluated.

The tool also recognizes repeated 1–4 byte blocks, upward/downward byte sequences, short values padded with zeros, and prefixes formed from one, two, or three constant word runs. It reports the size of that particular candidate family. These are limited pattern checks, not a statistical entropy estimator or exhaustive weak-seed database. Ordinary duplicate words do not imply weakness. An ordinary-looking output of a compromised generator can escape every check.

For example, the checksum-valid 24-word phrase with 12 `abandon` words, 11 `art` words, then `buddy` belongs to the two-run family. Counting all word choices, split positions, and final entropy choices gives 737,837,056 candidates. At an illustrative one million complete checks per second, the average is about 6.15 minutes and the full family about 12.3 minutes. These figures assume the attacker targets this family, has a known verification target, and knows the passphrase. They are not measured hardware performance, actual source entropy, or a wallet-compromise prediction. A version with an extra word is invalid and receives no crack-time estimate.

When no weakness is recognized, actual source entropy remains unknown, but the main report now explains the potential strength **if securely random**. For 12 words at one trillion complete checks per second, the average exhaustive phrase search is about 5.39 quintillion years, or 5.39 × 10¹⁶ centuries. After 100 years of checking, the modeled success probability is about 1 in 1.08 × 10¹⁷. These figures assume uniform generation, secrecy, no partial knowledge, and a known target and passphrase; they are not a measured property of the input or overall wallet security. Recognized weak/public phrases take precedence. The visible analogy reduces the random model to guessing every fair coin flip in order; known or patterned phrases receive their own simpler explanation. Exact odds and scale stay expandable. Human choices do not justify the uniform-random assumption, even if their words pass every check. See the [revised assessment plan](docs/revised-assessment-plan.md) for the report contract and test requirements.

## Use offline

1. Download `entropycheck.html` and `SHA256SUMS` from the same release. The repository also contains the current standalone file.
2. Verify the download against a checksum from a trusted source:

   ```sh
   sha256sum --check SHA256SUMS
   ```

   On macOS: `shasum -a 256 entropycheck.html`. On Windows PowerShell: `Get-FileHash .\entropycheck.html -Algorithm SHA256`. Compare the full result with `SHA256SUMS`.
3. Transfer the verified file to your trusted, disconnected computer and double-click it. No Node.js, web server, or network access is required.
4. Use **Clear all**, then close the browser when finished. The application cannot guarantee erasure of browser/OS memory, clipboard history, or browser crash data.

A hash establishes integrity relative to the checksum you trust; an attacker replacing both files can supply a matching hash. Release source commits and tags are SSH-signed as `selfcustodylabs`; the downloadable checksum is not a detached signature. You can also reproduce the file from source.

The page shows the browser’s online/offline report and updates it when the connection status changes, without making network probes. When online, including when opened as a local file, it warns against real seed phrases and links to the offline download and guide. A browser reporting offline does not prove an air gap or a trustworthy device.

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
4. For a release, update the displayed version and package version together, rebuild artifacts, then push a `v*` tag. The release workflow verifies the tagged source and publishes the HTML, checksums, and license notices. An existing mutable release is updated with the verified artifacts when its tag is explicitly replaced.

Runtime behavior and deployment workflows are independent of the owner/repository. HTML downloads use a relative path, so a project site hosted under any repository name works. Footer project/checksum links point to this project's canonical repository until you update them for your fork.

## Verification

- All 24 English Trezor BIP39 vectors, including expected PBKDF2 seeds and BIP32 roots.
- BIP32 reference vectors 1–4, including leading zeros.
- Published BIP49, BIP84, and BIP86 addresses.
- Additional cross-checks against **bitcoinjs-lib + bip32**, with Node's PBKDF2 implementation, across every supported network/type/branch.
- All lengths, invalid input, source assessment, bounded pattern families, binary/checksum encoding, normalization, passphrase case/spaces, generation failures, derivation boundaries, cancellation, and exact numerical models.
- Chromium and Firefox: offline file operation, no automatic HTTP requests/storage writes, hosted/offline parity, stale-result removal, Clear All, keyboard and mobile behavior, independent tab state, exact clipboard output, stable navigation, model isolation, and unsafe output from a simulated broken RNG.

Only public fixtures are used in tests. Never put real recovery material in tests, screenshots, issue reports, or commits. This application has not received an independent security audit; a dependency's audit does not audit this application.

## Project layout

`src/core/` contains the testable analysis, generation, strength, and derivation modules. `src/app.ts` coordinates the UI; `scripts/build.mjs` bundles the standalone artifact. Research citations and recorded revisions are in `docs/`; public standards fixtures are in `tests/fixtures/`.

No backend or public network API is provided. Multisig construction, arbitrary derivation paths, private-key exports, transaction signing, balances, recovery searches, and direct conversion of dice-roll sequences are outside v1. Physical entropy can be imported as binary bits.

## License

Original application code is [MIT](LICENSE). Bundled dependencies retain their licenses in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and inside the offline file. See [fixture notices](tests/fixtures/README.md) for reference data attribution. SeedTool's GPL source is not included.
