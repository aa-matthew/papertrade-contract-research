// Reconstructed from Dependency_e9918171 runtime; NOT original source.
export const WAD = 10n ** 18n;
export function mintQuote(lp, h, basis, threshold, rate, scale) {
  if (basis === 0n) return [0n, 0n];
  const end = lp + basis;
  const flatBasis = lp < threshold ? (end < threshold ? basis : threshold - lp) : 0n;
  const tailBasis = basis - flatBasis;
  let minted = flatBasis * rate / WAD;
  if (tailBasis > 0n) {
    const q0 = scale * WAD / (scale + h);
    const q1 = scale * WAD / (scale + h + tailBasis);
    minted += (((rate * q0 / WAD) * q1 / WAD) * tailBasis / WAD);
  }
  return [minted, tailBasis];
}
