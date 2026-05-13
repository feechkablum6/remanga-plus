export const CONTROL_ATTRIBUTE = "data-rre-control";
export const HIDDEN_ATTRIBUTE = "data-rre-hidden";

export const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export const queryAllWithSelf = <T extends Element>(
  root: ParentNode,
  selector: string,
): T[] => {
  const nodes = Array.from(root.querySelectorAll<T>(selector));
  if (root instanceof Element && root.matches(selector)) {
    nodes.unshift(root as T);
  }
  return nodes;
};

export const markHidden = (node: HTMLElement | null, hidden: boolean): void => {
  if (!node) {
    return;
  }

  if (hidden) {
    node.setAttribute(HIDDEN_ATTRIBUTE, "true");
  } else {
    node.removeAttribute(HIDDEN_ATTRIBUTE);
  }
};
