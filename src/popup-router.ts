export type PopupScreen = "main" | "site" | "reader" | "premium-free";

export type PopupRouter = {
  current: () => PopupScreen;
  navigate: (screen: PopupScreen) => void;
  back: () => void;
  subscribe: (listener: (screen: PopupScreen) => void) => () => void;
};

export const createPopupRouter = (): PopupRouter => {
  let current: PopupScreen = "main";
  const listeners = new Set<(screen: PopupScreen) => void>();

  const notify = (screen: PopupScreen): void => {
    for (const listener of listeners) {
      listener(screen);
    }
  };

  return {
    current: () => current,
    navigate: (screen) => {
      if (screen === current) return;
      current = screen;
      notify(screen);
    },
    back: () => {
      if (current === "main") return;
      current = "main";
      notify("main");
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
