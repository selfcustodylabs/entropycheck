import { SECONDS_PER_YEAR, scientific } from './strength.ts';

/** Conditional search of the selected candidate family, never an entropy estimate. */
export function modelCandidateSearch(candidates: bigint, rate: number) {
  if (candidates < 1n || candidates > (1n << 256n)) throw new Error('Candidate count must be between 1 and 2^256.');
  if (!Number.isSafeInteger(rate) || rate <= 0) throw new Error('The checking rate must be a positive safe integer.');
  return {
    averageNumerator: candidates + 1n,
    averageDenominator: 2n * BigInt(rate),
    averageSeconds: Number(candidates + 1n) / (2 * rate),
    fullSearchSeconds: Number(candidates) / rate,
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Duration must be positive and finite.');
  const units: [number, string][] = [[SECONDS_PER_YEAR, 'year'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second'], [0.001, 'millisecond'], [0.000001, 'microsecond'], [0.000000001, 'nanosecond']];
  const [scale, name] = units.find(([scale]) => seconds >= scale) ?? units[units.length - 1];
  const amount = seconds / scale;
  const rounded = Number(amount.toPrecision(3));
  const display = amount >= 1e6 || amount < 0.001 ? scientific(amount) : String(rounded);
  return `${display} ${name}${rounded === 1 ? '' : 's'}`;
}
