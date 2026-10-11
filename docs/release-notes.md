EntropyCheck provides English BIP39 analysis and generation, phrase-specific public/pattern warnings, exact binary inspection, conditional entropy explanations, and Bitcoin mainnet/testnet address derivation for BIP44, BIP49, BIP84, and BIP86.

The assessment leads with concrete weaknesses rather than ideal phrase-length figures. Analyze explicitly runs the checks; edits invalidate prior findings. The separate ideal-randomness calculator is collapsed by default and never certifies the entered phrase.

Download `entropycheck.html` and `SHA256SUMS`. Verify the checksum against a trusted source, then open the HTML directly on a trusted, disconnected computer. The file contains all required code, styles, wordlists, and educational content; no server or installation is needed.

The hosted demo is for disposable test phrases. Phrase validity does not establish randomness or secrecy. The application has not received an independent security audit. See the repository's README, SECURITY.md, and research notes for the model, verification steps, and limitations.

This release's workflow verifies standard test vectors, cross-implementation address results, numerical models, reproducible output, and Chromium/Firefox offline behavior before publication.
