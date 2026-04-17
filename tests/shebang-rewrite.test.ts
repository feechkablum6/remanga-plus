import { test } from "node:test";
import assert from "node:assert/strict";

import { rewriteShebangInterpreter } from "../native-host/shebang.js";

test("replaces the shebang interpreter while preserving the rest of the file", () => {
  const source = "#!/usr/bin/env node\nconsole.log(1);\n";
  const result = rewriteShebangInterpreter(source, "/abs/node");
  assert.equal(result, "#!/abs/node\nconsole.log(1);\n");
});

test("keeps the file untouched when there is no shebang", () => {
  const source = "console.log(1);\n";
  const result = rewriteShebangInterpreter(source, "/abs/node");
  assert.equal(result, source);
});

test("handles a shebang-only file with no trailing newline", () => {
  const source = "#!/usr/bin/env node";
  const result = rewriteShebangInterpreter(source, "/abs/node");
  assert.equal(result, "#!/abs/node");
});
