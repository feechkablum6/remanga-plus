export const FULLSCREEN_GESTURE_DEDUP_MS = 300;

export type FullscreenDecision =
  | "enter"
  | "exit"
  | "clear-pseudo-and-enter"
  | "ignore-duplicate";

export type FullscreenDecisionState = {
  realFullscreenActive: boolean;
  pseudoFullscreenActive: boolean;
  lastActionAt: number | null;
  now: number;
  transitionInProgress: boolean;
};

export type FullscreenEntryAttempt = "normal" | "retry-after-pseudo";

export const decideFullscreenAction = ({
  realFullscreenActive,
  pseudoFullscreenActive,
  lastActionAt,
  now,
  transitionInProgress,
}: FullscreenDecisionState): FullscreenDecision => {
  const elapsedSinceLastAction = lastActionAt === null ? null : now - lastActionAt;
  const isDuplicateGesture =
    elapsedSinceLastAction !== null &&
    elapsedSinceLastAction >= 0 &&
    elapsedSinceLastAction < FULLSCREEN_GESTURE_DEDUP_MS;

  if (transitionInProgress || isDuplicateGesture) {
    return "ignore-duplicate";
  }

  if (realFullscreenActive) {
    return "exit";
  }

  return pseudoFullscreenActive ? "clear-pseudo-and-enter" : "enter";
};

export const resolvePseudoFullscreenAfterNativeSuccess = (
  realFullscreenActive: boolean,
  pseudoFullscreenActive: boolean,
): boolean => (realFullscreenActive ? false : pseudoFullscreenActive);

export const resolvePseudoFullscreenAfterNativeDenial = (
  attempt: FullscreenEntryAttempt,
): boolean => attempt === "normal";

export const shouldClearPseudoFullscreenOnChange = (
  realFullscreenActive: boolean,
  pseudoFullscreenActive: boolean,
): boolean => realFullscreenActive && pseudoFullscreenActive;

