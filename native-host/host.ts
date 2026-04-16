#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDirectory, "..", "..");
const parserServerDirectory = path.resolve(repositoryRoot, "parser-server");
const parserServerEntrypoint = path.resolve(
  repositoryRoot,
  "parser-server/dist/index.js",
);
const parserServerHost = "127.0.0.1";
const portRange = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009];
const launchTimeoutMs = 15_000;
const pollIntervalMs = 250;
const probeTimeoutMs = 1500;

type NativeHostRequest = {
  type?: string;
};

type NativeHostResponse =
  | {
      status: "ready";
      port: number;
    }
  | {
      status: "failed";
      detail: string;
    };

const delay = (timeMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, timeMs);
  });

const readNativeMessage = async (): Promise<NativeHostRequest> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let expectedLength: number | null = null;

    process.stdin.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const buffer = Buffer.concat(chunks);

      if (expectedLength === null && buffer.length >= 4) {
        expectedLength = buffer.readUInt32LE(0);
      }

      if (expectedLength === null || buffer.length < expectedLength + 4) {
        return;
      }

      try {
        const body = buffer.subarray(4, expectedLength + 4).toString("utf8");
        resolve(JSON.parse(body) as NativeHostRequest);
      } catch (error) {
        reject(error);
      }
    });

    process.stdin.once("error", reject);
    process.stdin.once("end", () => {
      reject(new Error("No native host message received."));
    });
  });

const writeNativeMessage = (payload: NativeHostResponse): void => {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(encoded.length, 0);
  process.stdout.write(header);
  process.stdout.write(encoded);
};

const isParserServerHealthy = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(
      `http://${parserServerHost}:${port}/health`,
      { method: "GET", signal: AbortSignal.timeout(probeTimeoutMs) },
    );
    if (!response.ok) {
      return false;
    }
    const body: unknown = await response.json();
    return (
      body !== null &&
      typeof body === "object" &&
      "status" in body &&
      (body as { status: unknown }).status === "ok"
    );
  } catch {
    return false;
  }
};

type PortProbeResult = "parser" | "free" | "occupied";

const probePort = async (port: number): Promise<PortProbeResult> => {
  try {
    const response = await fetch(
      `http://${parserServerHost}:${port}/health`,
      { method: "GET", signal: AbortSignal.timeout(probeTimeoutMs) },
    );
    if (!response.ok) {
      return "occupied";
    }
    try {
      const body: unknown = await response.json();
      return body !== null &&
        typeof body === "object" &&
        "status" in body &&
        (body as { status: unknown }).status === "ok"
        ? "parser"
        : "occupied";
    } catch {
      return "occupied";
    }
  } catch (error) {
    return error instanceof TypeError ? "free" : "occupied";
  }
};

const findAvailablePort = async (): Promise<{
  port: number;
  parserRunning: boolean;
} | null> => {
  for (const port of portRange) {
    const result = await probePort(port);
    if (result === "parser") {
      return { port, parserRunning: true };
    }
    if (result === "free") {
      return { port, parserRunning: false };
    }
  }
  return null;
};

const waitForParserServer = async (port: number): Promise<boolean> => {
  const deadline = Date.now() + launchTimeoutMs;

  while (Date.now() < deadline) {
    if (await isParserServerHealthy(port)) {
      return true;
    }

    await delay(pollIntervalMs);
  }

  return false;
};

const ensureParserServerBuild = async (): Promise<void> => {
  await access(parserServerEntrypoint);
};

const launchParserServer = (port: number): void => {
  const child = spawn(process.execPath, [parserServerEntrypoint], {
    cwd: parserServerDirectory,
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      HOST: parserServerHost,
      PORT: String(port),
    },
  });

  child.unref();
};

const handleEnsureParserServer = async (): Promise<NativeHostResponse> => {
  const available = await findAvailablePort();
  if (!available) {
    return {
      status: "failed",
      detail: `All ports ${portRange[0]}-${portRange[portRange.length - 1]} are occupied.`,
    };
  }

  if (available.parserRunning) {
    return { status: "ready", port: available.port };
  }

  try {
    await ensureParserServerBuild();
  } catch {
    return {
      status: "failed",
      detail: `Missing parser-server build at ${parserServerEntrypoint}. Run npm --prefix parser-server run build.`,
    };
  }

  launchParserServer(available.port);

  if (await waitForParserServer(available.port)) {
    return { status: "ready", port: available.port };
  }

  return {
    status: "failed",
    detail: "Parser-server did not become healthy after launch.",
  };
};

const main = async (): Promise<void> => {
  const message = await readNativeMessage();
  if (message.type !== "ensure-parser-server") {
    writeNativeMessage({
      status: "failed",
      detail: "Unsupported native host request.",
    });
    return;
  }

  writeNativeMessage(await handleEnsureParserServer());
};

void main().catch((error) => {
  writeNativeMessage({
    status: "failed",
    detail: error instanceof Error ? error.message : String(error),
  });
});
