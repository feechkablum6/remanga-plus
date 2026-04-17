export const rewriteShebangInterpreter = (
  contents: string,
  interpreterPath: string,
): string => {
  if (!contents.startsWith("#!")) {
    return contents;
  }
  const newlineIndex = contents.indexOf("\n");
  const tail = newlineIndex === -1 ? "" : contents.slice(newlineIndex);
  return `#!${interpreterPath}${tail}`;
};
