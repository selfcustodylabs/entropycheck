SeedInspect v1.0.0 includes the latest interface improvements and raw binary entropy import. Download the standalone HTML, SHA256SUMS, and third-party license notices together.

- Independent generation, phrase-import, and binary-import tabs preserve their own inputs, reports, passphrases, address settings, and derived addresses. Clear all resets every tab.
- Binary import stays in its tab and displays selectable recovery words with a copy button. All five entropy lengths are supported, with leading zeros preserved and checksums added automatically.
- Removed the public-example loader, cross-tab editing shortcut, redundant replacement notes, dice disclosure, and repeated analysis-completion banners.
- All three navigation items remain visible, with accessible availability states until the selected tab has valid results.
- Redesigned “What we can tell you” with an offline illustration, clearer finding hierarchy, separate structure and capacity information, explicit assessment limits, and expandable reasoning.
- Added copy buttons for hexadecimal entropy, raw binary, checksum bits, and complete mnemonic binary.
- Bitcoin address derivation for BIP44, BIP49, BIP84, and BIP86 remains entirely local. Phrase entry validates English letters and whitespace without silently altering recovery words.

The source commit and release tag are SSH-signed as selfcustodylabs. SHA256SUMS provides the HTML integrity hash, not a detached signature. Verify the checksum against a trusted source before opening the file on a trusted, disconnected computer.

The hosted demo is for disposable test phrases. Phrase validity does not establish randomness or secrecy. The application has not received an independent security audit. See README.md, SECURITY.md, and the research notes for assumptions and limitations.

Release checks cover cryptographic vectors, address derivation, numerical models, reproducible output, and offline behavior in Chromium and Firefox.
