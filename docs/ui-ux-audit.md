# UI and UX review for 1.0.0

Reviewed the three input workflows, “What we can tell you,” navigation, entropy exports, and their empty, pending, valid, and unsafe states. This is an interface review, not an independent security audit.

| Finding | Resolution |
| --- | --- |
| Tabs shared a phrase and binary import changed tabs unexpectedly. | Each tab retains its own input, analyzed phrase, passphrase, address settings, and derived results. Binary words appear below the binary input. |
| Public examples, replacement notes, editing shortcuts, and completion counters distracted from the primary action. | Removed the requested controls and notices. Input validation remains beside its field; analyzed results identify the active workflow. |
| Navigation items appeared only after analysis, changing the available destinations without explanation. | All three items remain visible. Results links expose their availability accessibly and explain the prerequisite before analysis. Navigation dimensions stay stable. |
| The assessment mixed findings, structural validity, capacity, provenance, and limitations into a dense reading path. | The finding comes first. Structure and capacity form a separate group. A visible limitations panel explains what cannot be established. Reasoning and source details are expandable. |
| Illustration and hierarchy did not help orient the reader. | Added a self-contained SVG report illustration, contextual heading, consistent spacing, and restrained warning colors. No remote image request is needed. |
| Binary and hexadecimal values required manual selection. | Added labeled, keyboard-accessible copy buttons for all four encodings; leading zeros and checksum widths are preserved exactly. |
| New results could become stale after edits or mix with another tab’s addresses. | Editing invalidates the active tab’s result. Switching tabs cancels unfinished derivation and restores the destination’s state. Clear all resets every workspace. |

## Verification

- Reviewed desktop generation and binary results, plus the stacked 320px mobile assessment.
- Browser coverage includes 320, 390, 768, and 1440px layouts, keyboard tab navigation, focus after binary import, stable navigation dimensions, and accessible copy names.
- Chromium and Firefox coverage checks independent phrases, passphrases, address settings and results; retained binary input; exact clipboard output for every representation; and Clear all across all three tabs.
- Existing checks cover public/weak phrases, simulated broken randomness, invalid inputs, offline operation, no runtime requests or persistent storage, and hosted/offline artifact parity.
- Type checking, cryptographic/model tests, and reproducible HTML/checksum verification use the pinned Node.js 24.21.0 runtime.

The assessment still cannot establish a phrase’s randomness or secrecy. Findings retain their original cryptographic meaning; this revision changes presentation and workflow state.
