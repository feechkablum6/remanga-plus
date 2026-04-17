import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveChromeHostDirs } from "../native-host/chrome-host-dirs.js";

const FAKE_HOME = "/Users/fake";

test("returns no directories when no Chrome channel is installed", () => {
  assert.deepEqual(
    resolveChromeHostDirs(FAKE_HOME, () => false),
    [],
  );
});

test("returns stable Chrome NativeMessagingHosts when only stable exists", () => {
  const installed = new Set([
    `${FAKE_HOME}/Library/Application Support/Google/Chrome`,
  ]);
  assert.deepEqual(
    resolveChromeHostDirs(FAKE_HOME, (p) => installed.has(p)),
    [`${FAKE_HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts`],
  );
});

test("returns both stable and Dev channel directories when both exist", () => {
  const installed = new Set([
    `${FAKE_HOME}/Library/Application Support/Google/Chrome`,
    `${FAKE_HOME}/Library/Application Support/Google/Chrome Dev`,
  ]);
  assert.deepEqual(
    resolveChromeHostDirs(FAKE_HOME, (p) => installed.has(p)),
    [
      `${FAKE_HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts`,
      `${FAKE_HOME}/Library/Application Support/Google/Chrome Dev/NativeMessagingHosts`,
    ],
  );
});

test("covers Beta and Canary channels alongside stable and Dev", () => {
  const installed = new Set([
    `${FAKE_HOME}/Library/Application Support/Google/Chrome`,
    `${FAKE_HOME}/Library/Application Support/Google/Chrome Beta`,
    `${FAKE_HOME}/Library/Application Support/Google/Chrome Canary`,
    `${FAKE_HOME}/Library/Application Support/Google/Chrome Dev`,
  ]);
  const result = resolveChromeHostDirs(FAKE_HOME, (p) => installed.has(p));
  assert.deepEqual(result.map((p) => p.split("Google/")[1]), [
    "Chrome/NativeMessagingHosts",
    "Chrome Beta/NativeMessagingHosts",
    "Chrome Dev/NativeMessagingHosts",
    "Chrome Canary/NativeMessagingHosts",
  ]);
});
