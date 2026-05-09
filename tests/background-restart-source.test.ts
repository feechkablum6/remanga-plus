import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const backgroundSource = readFileSync(
  path.resolve(process.cwd(), "src/background.ts"),
  "utf8",
);
const parserServerSource = readFileSync(
  path.resolve(process.cwd(), "src/parser-server.ts"),
  "utf8",
);

test("parser-server.ts exports RESTART_PARSER_SERVER_MESSAGE_TYPE", () => {
  assert.match(
    parserServerSource,
    /export\s+const\s+RESTART_PARSER_SERVER_MESSAGE_TYPE\s*=\s*"rre:restart-parser-server"/,
  );
});

test("background.ts handles RESTART_PARSER_SERVER_MESSAGE_TYPE", () => {
  assert.match(
    backgroundSource,
    /RESTART_PARSER_SERVER_MESSAGE_TYPE/,
  );
  assert.match(
    backgroundSource,
    /readyUntil\s*=\s*0/,
  );
});
