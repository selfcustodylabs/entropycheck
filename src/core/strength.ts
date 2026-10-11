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
  };
}

export function scientific(value: number | bigint, digits = 2): string {
  const [mantissa, exponent] = Number(value).toExponential(digits).split('e');
  const superscripts: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return `${mantissa} × 10${String(Number(exponent)).split('').map(c => superscripts[c]).join('')}`;
}
