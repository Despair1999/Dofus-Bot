import { matchCandidates } from "@dofus/core";
export { normalize } from "@dofus/core";
/** Adapt the shared matcher to the desktop's flat result format. Scores are text similarity, not OCR confidence. */
export function matchText<
  T extends { id: number; name: string; nameFr?: string },
>(text: string, candidates: T[]) {
  return matchCandidates(
    text,
    candidates.map((candidate) => ({
      ...candidate,
      aliases: candidate.nameFr ? [candidate.nameFr] : [],
    })),
  ).map(({ candidate: { aliases: _, ...candidate }, score }) => ({
    ...candidate,
    score,
  }));
}
