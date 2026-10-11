export const CHECK_RATES = [1_000_000, 1_000_000_000, 1_000_000_000_000] as const;
export const SECONDS_PER_YEAR = 31_557_600;

export function modelStrength(bits: number, rate: number) {
  if (![128, 160, 192, 224, 256].includes(bits)) throw new Error('Choose a supported BIP39 entropy length.');
  if (!Number.isSafeInteger(rate) || rate <= 0) throw new Error('The checking rate must be a positive safe integer.');
  const possibilities = 1n << BigInt(bits);
  const averageSecondsNumerator = possibilities + 1n;
  const averageSecondsDenominator = 2n * BigInt(rate);
  return {
    bits, rate, possibilities,
    averageSecondsNumerator, averageSecondsDenominator,
    oneGuessProbability: 1 / Number(possibilities),
    averageYears: Number(averageSecondsNumerator) / Number(averageSecondsDenominator) / SECONDS_PER_YEAR,
    fullSearchYears: Number(possibilities) / rate / SECONDS_PER_YEAR,
    averageCenturies: Number(averageSecondsNumerator) / Number(averageSecondsDenominator) / SECONDS_PER_YEAR / 100,
    // Distinct guesses in one century, divided by the uniform candidate space.
    centurySuccessProbability: Math.min(1, Number(BigInt(rate) * BigInt(SECONDS_PER_YEAR) * 100n) / Number(possibilities)),
  };
}

/** Short-scale English names where they make a large time easier to read. */
export function readableYears(years: number): string {
  if (!Number.isFinite(years) || years <= 0) throw new Error('Years must be positive and finite.');
  const scales: [number, string][] = [[1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
  const scale = scales.find(([size]) => years >= size);
  if (years >= 1e21) return `${scientific(years)} years`;
  return scale ? `${Number((years / scale[0]).toPrecision(3))} ${scale[1]} years` : `${Number(years.toPrecision(3))} years`;
}

export function scientific(value: number | bigint, digits = 2): string {
  const [mantissa, exponent] = Number(value).toExponential(digits).split('e');
  const superscripts: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return `${mantissa} × 10${String(Number(exponent)).split('').map(c => superscripts[c]).join('')}`;
}
