import {
  decideFullscreenAction,
  resolvePseudoFullscreenAfterNativeDenial,
  resolvePseudoFullscreenAfterNativeSuccess,
  type FullscreenEntryAttempt,
} from "./fullscreen-controller.js";

const FULLSCREEN_BUTTON_SELECTOR =
  "[data-rre-control='fullscreen-main'], [data-rre-control='fullscreen-recovery']";
const PSEUDO_FULLSCREEN_ATTRIBUTE = "data-rre-pseudo-fullscreen";
const FULLSCREEN_BRIDGE_ATTRIBUTE = "data-rre-fullscreen-bridge";
const FULLSCREEN_DENIED_ATTRIBUTE = "data-rre-fullscreen-denied";
const FULLSCREEN_DENIED_REASON_ATTRIBUTE = "data-rre-fullscreen-denied-reason";
const FULLSCREEN_DENIED_ATTEMPT_ATTRIBUTE = "data-rre-fullscreen-denied-attempt";

let lastFullscreenActionAt: number | null = null;
let fullscreenTransitionInProgress = false;

document.documentElement.setAttribute(FULLSCREEN_BRIDGE_ATTRIBUTE, "1");

const reportFullscreenDenied = (
  error: unknown,
  attempt: FullscreenEntryAttempt,
): void => {
  const reason = error instanceof Error ? error.message : String(error);
  document.documentElement.setAttribute(FULLSCREEN_DENIED_REASON_ATTRIBUTE, reason);
  document.documentElement.setAttribute(FULLSCREEN_DENIED_ATTEMPT_ATTRIBUTE, attempt);
  if (resolvePseudoFullscreenAfterNativeDenial(attempt)) {
    document.documentElement.setAttribute(PSEUDO_FULLSCREEN_ATTRIBUTE, "true");
  } else {
    document.documentElement.removeAttribute(PSEUDO_FULLSCREEN_ATTRIBUTE);
  }
  document.documentElement.setAttribute(FULLSCREEN_DENIED_ATTRIBUTE, String(Date.now()));
};

const handleFullscreenGesture = (event: PointerEvent | MouseEvent): void => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const button = target.closest(FULLSCREEN_BUTTON_SELECTOR);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  const now = Date.now();
  const pseudoFullscreenActive =
    document.documentElement.getAttribute(PSEUDO_FULLSCREEN_ATTRIBUTE) === "true";
  const decision = decideFullscreenAction({
    realFullscreenActive: Boolean(document.fullscreenElement),
    pseudoFullscreenActive,
    lastActionAt: lastFullscreenActionAt,
    now,
    transitionInProgress: fullscreenTransitionInProgress,
  });
  if (decision === "ignore-duplicate") {
    return;
  }

  lastFullscreenActionAt = now;
  fullscreenTransitionInProgress = true;
  if (decision === "clear-pseudo-and-enter") {
    document.documentElement.removeAttribute(PSEUDO_FULLSCREEN_ATTRIBUTE);
  }

  const entryAttempt: FullscreenEntryAttempt = decision === "clear-pseudo-and-enter"
    ? "retry-after-pseudo"
    : "normal";

  const enteringFullscreen = decision !== "exit";
  const action = enteringFullscreen
    ? document.documentElement.requestFullscreen()
    : document.exitFullscreen();

  action
    .then(() => {
      const keepPseudoFullscreen = resolvePseudoFullscreenAfterNativeSuccess(
        Boolean(document.fullscreenElement),
        document.documentElement.getAttribute(PSEUDO_FULLSCREEN_ATTRIBUTE) === "true",
      );
      if (!keepPseudoFullscreen) {
        document.documentElement.removeAttribute(PSEUDO_FULLSCREEN_ATTRIBUTE);
      }
    })
    .catch((error: unknown) => reportFullscreenDenied(error, entryAttempt))
    .finally(() => {
      fullscreenTransitionInProgress = false;
    });
};

document.addEventListener("pointerup", handleFullscreenGesture, true);
document.addEventListener("click", handleFullscreenGesture, true);
