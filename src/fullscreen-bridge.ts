const FULLSCREEN_BUTTON_SELECTOR =
  "[data-rre-control='fullscreen-main'], [data-rre-control='fullscreen-recovery']";

document.addEventListener(
  "click",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const button = target.closest(FULLSCREEN_BUTTON_SELECTOR);
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const handledAt = Number(button.dataset.rreFullscreenHandledAt ?? "0");
    if (Number.isFinite(handledAt) && Date.now() - handledAt < 700) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const action = document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();

    action.catch(() => {});
  },
  true,
);
