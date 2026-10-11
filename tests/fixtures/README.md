# Public reference fixtures

These fixtures contain publicly documented test material only. Never substitute private recovery material.

- `bip39-english.json`: English vectors from [Trezor python-mnemonic](https://github.com/trezor/python-mnemonic), MIT. Original source URL, revision, and SHA-256 of the complete original multilingual file are recorded in `docs/research-versions.json`. The derived English subset is committed here; `src/public-phrases.json` contains the corresponding mnemonic strings for recognition and learning examples.
- `bip32.txt`: [BIP32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) specification at the recorded bitcoin/bips revision, authored by Pieter Wuille. Its retained text states its 2-clause BSD license. Tests extract vectors 1–4 directly, including leading-zero cases.
- BIP49, BIP84, and BIP86 expected addresses in `tests/core.test.ts` are public standards test vectors, respectively public domain, CC0, and BSD-2-Clause. See their source links in `docs/research.md`.

The exact upstream license is retained in [TREZOR_LICENSE](TREZOR_LICENSE) and embedded in the standalone artifact.
