EntropyCheck v1.0.0 includes the latest interface improvements and raw binary entropy import. Download the standalone HTML, SHA256SUMS, and third-party license notices together.

- Separate tabs for generating a seed, importing a phrase, and importing binary entropy. Draft phrases stay in the phrase tab.
- Generated phrases display as selectable text with a copy icon. Phrase entry accepts English letters and whitespace, rejecting numbers and special characters without changing recovery words.
- Binary import supports all five BIP39 entropy lengths, preserves leading zeros, and adds the checksum automatically.
- Matching illustrations accompany all three input workflows and the estimated guessing effort. Entropy details use a softer background, and offline guidance lives in its dedicated section.
- Reports appear after valid analysis and clear when the phrase changes. They include word indices, binary encoding, conditional guessing estimates, and Bitcoin address derivation for BIP44, BIP49, BIP84, and BIP86.

The source commit and release tag are SSH-signed as selfcustodylabs. SHA256SUMS provides the HTML integrity hash, not a detached signature. Verify the checksum against a trusted source before opening the file on a trusted, disconnected computer.

The hosted demo is for disposable test phrases. Phrase validity does not establish randomness or secrecy. The application has not received an independent security audit. See README.md, SECURITY.md, and the research notes for assumptions and limitations.

Release checks cover cryptographic vectors, address derivation, numerical models, reproducible output, and offline behavior in Chromium and Firefox.
