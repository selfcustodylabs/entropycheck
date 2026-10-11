import type { GenerationSource, MnemonicAnalysis } from './analysis.ts';

export interface PatternFinding {
  code: string;
  title: string;
  explanation: string;
  familyBits: number;
  candidates?: bigint;
}

export function patternCandidates(pattern: PatternFinding): bigint {
  return pattern.candidates ?? (1n << BigInt(pattern.familyBits));
}

/** Enumerates small constructions, not a statistical estimator of source entropy. */
export function findPatterns(bytes: Uint8Array, tokens: string[]): PatternFinding[] {
  const findings: PatternFinding[] = [];
  const supportedLength = [12, 15, 18, 21, 24].includes(tokens.length);
  for (let period = 1; period <= 4; period++) {
    if (bytes.every((byte, index) => byte === bytes[index % period])) {
      findings.push({ code: 'repeated-block', title: `A ${period}-byte block repeats`, familyBits: period * 8,
        explanation: `Every entropy byte follows a repeating ${period}-byte block. An attacker can enumerate at most 2^${period * 8} such blocks for this phrase length. This describes a small candidate family, not a measurement of the generator.` });
      break;
    }
  }
  if ([1, -1].some(step => bytes.every((byte, index) => byte === (bytes[0] + step * index + 256) % 256))) {
    findings.push({ code: 'byte-sequence', title: 'The bytes form a counting sequence', familyBits: 9,
      explanation: 'The bytes count upward or downward modulo 256. There are only 256 starting bytes and two directions: at most 512 candidates for this construction at this length.' });
  }
  for (const code of ['zero-prefix', 'zero-suffix'] as const) {
    let first = -1;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[code === 'zero-prefix' ? i : bytes.length - 1 - i] !== 0) { first = i; break; }
    }
    const variableBytes = first < 0 ? 0 : bytes.length - first;
    if (variableBytes >= 1 && variableBytes <= 4) findings.push({ code, title: 'Almost all entropy bytes are zero', familyBits: variableBytes * 8,
      explanation: `All but ${variableBytes} ${code === 'zero-prefix' ? 'trailing' : 'leading'} byte(s) are zero. Enumerating every value in those positions takes at most 2^${variableBytes * 8} candidates at this length.` });
  }
  if (supportedLength && tokens.slice(0, -1).every(word => word === tokens[0])) {
    const familyBits = 22 - tokens.length / 3;
    findings.push({ code: 'repeated-prefix-words', title: 'Every word before the last is identical', familyBits,
      explanation: `This extreme construction has only 2^${familyBits} valid phrases at this length: 2,048 choices for the repeated word and the remaining entropy choices in the final word. Occasional repeated words do not imply this weakness.` });
  }
  const prefix = tokens.slice(0, -1);
  const runs = prefix.reduce((count, word, index) => count + Number(index === 0 || word !== prefix[index - 1]), 0);
  if (supportedLength && (runs === 2 || runs === 3)) {
    // Enumerate all word choices, all positive run lengths, and every final entropy suffix.
    // Requiring adjacent run words to differ gives 2048 * 2047^(runs - 1) choices.
    const boundaries = runs === 2 ? tokens.length - 2 : (tokens.length - 2) * (tokens.length - 3) / 2;
    const candidates = 2048n * 2047n ** BigInt(runs - 1) * BigInt(boundaries) * (1n << BigInt(11 - tokens.length / 3));
    const familyBits = (candidates - 1n).toString(2).length;
    findings.push({ code: 'word-runs', title: `The first ${prefix.length} words form just ${runs} constant runs`, candidates, familyBits,
      explanation: `Before the checksum-bearing last word, the phrase consists of only ${runs} runs of identical words. Trying all word choices, run lengths, and valid final words at this length gives ${candidates.toLocaleString('en-US')} candidates. This is an enumerable construction, not ordinary occasional repetition.` });
  }
  return findings.sort((a, b) => patternCandidates(a) < patternCandidates(b) ? -1 : patternCandidates(a) > patternCandidates(b) ? 1 : 0);
}

export interface PhraseRisk {
  kind: 'empty' | 'invalid' | 'unsafe' | 'weak' | 'caution' | 'unverified';
  title: string;
  explanation: string;
  quantity: string;
  quantityLabel: string;
  interpretation: string;
  analogy: string;
  candidates: bigint | null;
  familyBits: number | null;
}

export function assessPhrase(analysis: MnemonicAnalysis, source: GenerationSource, generatedHere = false): PhraseRisk {
  const base = { candidates: null, familyBits: null, quantity: 'Unknown', quantityLabel: 'Actual randomness', interpretation: 'The words alone cannot prove how randomly they were chosen.', analogy: 'The number of dials on a lock does not tell you how its combination was chosen.' };
  if (!analysis.wordCount) return { ...base, kind: 'empty', title: 'Analyze a phrase to see its risk', explanation: 'The result will distinguish BIP39 capacity from concrete weaknesses and unverified randomness.', quantity: 'Not analyzed' };
  if (!analysis.valid) return { ...base, kind: 'invalid', title: 'Not valid English BIP39', explanation: 'Correct the input from its original source. No phrase-strength conclusion is available for this invalid input.', quantity: 'Not assessed' };
  const zero = analysis.entropyBinary?.split('').every(bit => bit === '0');
  const ones = analysis.entropyBinary?.split('').every(bit => bit === '1');
  if (zero || ones || analysis.knownPublic || source === 'public') {
    const title = zero ? 'Unsafe: all-zero phrase' : ones ? 'Unsafe: all-one phrase' : analysis.knownPublic ? 'Unsafe: public test phrase' : 'Unsafe: reported public phrase';
    const why = zero ? `All ${analysis.encodedEntropyBits} decoded entropy bits are zero. This public, deterministic construction reproduces these exact words.` : ones ? `All ${analysis.encodedEntropyBits} decoded entropy bits are one. This public, deterministic construction reproduces these exact words.` : analysis.knownPublic ? 'These exact words match a bundled, publicly documented BIP39 test vector.' : 'You reported that these words are public.';
    return { kind: 'unsafe', title, explanation: `${why} Do not use this phrase for funds. Its valid ${analysis.wordCount}-word format does not provide ${analysis.encodedEntropyBits} bits of secrecy.`,
      quantity: '1 known candidate', quantityLabel: 'An attacker can try these exact words',
      interpretation: '0 bits of secrecy in these known words; not a measurement of the original generator. An attacker can try them directly. Do not use this phrase for funds.',
      analogy: 'It’s like a lock with its combination printed beside it. Adding more dials does not make a public combination secret.', candidates: 1n, familyBits: 0 };
  }
  const pattern = analysis.patterns[0];
  if (pattern) return { kind: 'weak', title: 'Unsafe: a simple construction is recognizable', explanation: `${pattern.title}. Do not rely on this phrase to protect funds. ${pattern.explanation}`,
    quantity: `≤ ${patternCandidates(pattern).toLocaleString('en-US')} candidates`, quantityLabel: 'Within the recognized construction at this length',
    interpretation: 'A recognizable pattern makes this phrase easier to guess. This count is a candidate bound, not measured source entropy. Other attacks may be easier.',
    analogy: 'A lock may have many dials, but using a few repeated groups lets an attacker test a much smaller set of combinations.', candidates: patternCandidates(pattern), familyBits: pattern.familyBits };
  if (source === 'human') return { ...base, kind: 'caution', title: 'Human-chosen: strength is not established', explanation: 'Human choices can be predictable even when no simple pattern is detected. This tool cannot assign effective entropy to this phrase. Do not substitute hand-picked words for secure random generation.' };
  return { ...base, kind: 'unverified', title: generatedHere && source === 'browser' ? 'No recognized weakness found · not a safety certificate' : 'Actual randomness is unverified',
    quantity: `${analysis.encodedEntropyBits} bits if securely random`, quantityLabel: 'Conditional strength',
    interpretation: 'No recognized weakness found. This strength assumes secure random generation and secret words. Actual source entropy remains unknown.',
    analogy: `Think of guessing ${analysis.encodedEntropyBits} fair coin flips, all in the correct order. That is the chance of getting this phrase in one random guess.`,
    explanation: generatedHere && source === 'browser' ? `The browser requested ${analysis.encodedEntropyBits} bits from its cryptographic RNG in this session. That is nominal capacity, not measured entropy. A compromised or predictable generator can still produce ordinary-looking words.` : 'No bundled public example or supported simple construction was recognized. This does not prove secrecy or random generation; a predictable generator can produce ordinary-looking words.' };
}
