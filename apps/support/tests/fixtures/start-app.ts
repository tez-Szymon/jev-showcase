import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const mode = process.argv[2];
const port = mode === "jev" ? "3102" : "3101";
const folder = mkdtempSync(join(tmpdir(), `jev-e2e-${mode}-`));
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_PATH: join(folder, "demo.sqlite"),
      JEV_ENABLED: mode === "jev" ? "true" : "false",
      TYPESAFE_API_KEY: mode === "jev" ? "test-key" : "",
      TYPESAFE_BASE_URL: "http://127.0.0.1:3199",
    },
  },
);
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  child.kill("SIGTERM");
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", (code) => {
  rmSync(folder, { recursive: true, force: true });
  process.exit(code ?? 0);
});
