EntropyCheck v1.0.0 is the first downloadable release, with the standalone HTML, SHA256SUMS, and third-party license notices.

The page now shows a live browser connection warning, including for local files, with direct links to the offline download and guide. Online use is for test phrases only; the offline label cannot prove an air gap.

Phrase entry has explicit Analyze phrase and orange Generate & analyze actions. Completed checks change the first action to Analyze again. The explanation leads with three short cards about structure, randomness, and secrecy; analogies and extra comparisons expand on demand. Entropy details have a warm orange highlight, and the footer credits selfcustodylabs.com.

The source commit and release tag are SSH-signed as selfcustodylabs. SHA256SUMS provides the HTML integrity hash, not a detached signature.

EntropyCheck provides English BIP39 analysis and generation, phrase-specific public/pattern warnings, exact binary inspection, conditional entropy explanations, and Bitcoin mainnet/testnet address derivation for BIP44, BIP49, BIP84, and BIP86.

The interface now separates phrase entry, assessment, and full-width entropy details, with more readable text, mobile navigation, and keyboard-accessible address-type cards. Entropy details display every word's zero-based BIP39 index, 11-bit encoding, and GitHub line number (index + 1). These secret representations clear immediately when the phrase changes or Clear All is pressed.

The phrase-strength section now leads with a plain-language result, groups the search time and speed control in one card, and presents centuries and 100-year odds as compact comparisons. Assumptions and formulas are collapsed by default so beginners can understand the result before exploring technical detail.

Input errors now appear live inside the phrase box. Repeated word runs are detected, and a visible Time to crack section models recognized families with explicit checking-rate and passphrase assumptions. Page copy uses no em dashes.

For valid phrases without a detected weakness, the main report now includes a clearly conditional random-generation estimate with years, centuries, 100-year success odds, and coin-flip/lottery analogies. Actual source entropy remains unverified. Weak/public findings take precedence; human-chosen phrases keep their unknown-time warning.

The assessment leads with concrete weaknesses rather than ideal phrase-length figures. Analyze explicitly runs the checks; edits invalidate prior findings. The separate ideal-randomness calculator is collapsed by default and never certifies the entered phrase.

Download `entropycheck.html` and `SHA256SUMS`. Verify the checksum against a trusted source, then open the HTML directly on a trusted, disconnected computer. The file contains all required code, styles, wordlists, and educational content; no server or installation is needed.

The hosted demo is for disposable test phrases. Phrase validity does not establish randomness or secrecy. The application has not received an independent security audit. See the repository's README, SECURITY.md, and research notes for the model, verification steps, and limitations.

This release's workflow verifies standard test vectors, cross-implementation address results, numerical models, reproducible output, and Chromium/Firefox offline behavior before publication.
