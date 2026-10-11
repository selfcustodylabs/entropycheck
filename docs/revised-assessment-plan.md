# Revised phrase-specific assessment

This replaces the original assumption that an always-visible ideal search-space model is an adequate lead explanation. A long, checksum-valid phrase can be public or belong to a very small, readily enumerable construction. The actual phrase assessment must come first.

## Report contract

1. Validate the English BIP39 structure independently of security.
2. Decode the entropy and preserve its exact binary width, including leading zeros. Show raw hexadecimal, raw entropy binary, checksum binary, and the complete word-encoding binary separately.
3. Identify all-zero/all-one entropy, bundled public vectors, repeated blocks of 1–4 bytes, ascending/descending byte sequences, zero-padded short integers, and prefixes consisting of one, two, or three constant word runs. Ordinary repeated words do not lower a score.
4. Lead with the strongest evidence, independently of a claimed source. Public/deterministic examples are unsafe even if the source selector says wallet-generated or the browser just produced them. Show one known candidate and zero secrecy in the publicly known words, not a claim that the original generator's entropy was measured.
5. For a recognized small construction, display a conservative upper bound on that specific family and its base-2 size. This is an enumerable attack family, not a measurement of generator entropy or an unconditional cracking-time prediction. If several patterns match, use the smallest family for the numerical illustration and show the findings.
6. With no concrete match, actual source entropy remains unknown. In-session CSPRNG generation provides conditional source context, not a safety certificate. Human choice receives a caution. A nonmatch does not establish secrecy or rule out a predictable generator.

## Interface and data flow

- Typing validates word count, English membership, and checksum immediately inside the input box with a visible error and aria-invalid state. It marks the separate security report as needing analysis. Clear previous risk conclusions, decoded secrets, and address results immediately.
- Analyze explicitly computes the report, increments visible completion feedback, focuses/scrolls to the result, and enables derivation only for valid input. Source changes also require reanalysis. Generated phrases and loaded examples are analyzed immediately and identified as such.
- Put the phrase-specific risk headline above structural validity. Relabel encoded length as BIP39 capacity, not measured security.
- Replace the default huge time/possibility cards with phrase-specific evidence and its limitations. Keep the generic calculator collapsed behind an explicit “ideal randomness” disclosure; close it when the input/report changes. For a valid phrase without a recognized weakness, the main report also explains potential strength if securely random, without claiming measured entropy. Keep this conditional model out of the main weak/public/human-chosen reports.
- Time to crack is visible in the phrase-specific report. For recognized families, offer hypothetical complete-check rates, a conditional average (N + 1)/(2R), and full-family time N/R. State known-target, selected-family, and known-passphrase assumptions next to the result. For otherwise unverified phrases, label the full-space model “Assuming secure random generation” beside its result and show years, centuries, 100-year success probability, coin flips, and lottery odds. It assumes no partial knowledge and secret, uniformly generated words. Public phrases require no phrase search; human choices have unknown time; invalid input is not applicable.
- Raw binary is the complete entropy bit string without dropping leading zeros; checksum and full mnemonic bit string are independently labeled. These are sensitive representations and clear with the session.
- Explain that these assessments concern the words. An independent BIP39 passphrase is not evaluated; do not infer that a wallet's passphrase has been cracked or that a public phrase becomes private again.

## Acceptance

- The supplied 24-word abandon…art phrase is checksum-valid but prominently unsafe: 256 zero entropy bits, one known phrase candidate, and zero secrecy in those publicly known words. The 2^256 illustration is hidden by default.
- Cover all-zero and all-one encodings at every BIP39 length, non-obvious public examples, balanced-but-repetitive bytes, short zero-padded values, sequential bytes, and extreme repeated-word constructions.
- Unknown imports never receive an effective-entropy value. Generated phrases with injected broken RNG output are still flagged, without silently rerolling them. Normal duplicate words are not treated as proof of weakness.
- Verify binary widths, checksum concatenation against independent SHA-256, explicit Analyze behavior, stale-result clearing, model isolation, transitions between conditional random and targeted-family estimates, source precedence, and Clear All in Chromium and Firefox.
- Repository and canonical URLs target selfcustodylabs/entropycheck. Publication depends on the authenticated account having write access.
