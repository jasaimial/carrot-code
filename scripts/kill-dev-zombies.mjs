// =============================================================================
// scripts/kill-dev-zombies.mjs
//
// `npm run kill-dev` — targeted kill of node processes listening on the
// dev/preview ports. Conservative: ONLY kills processes holding those
// specific ports; leaves the IDE's node processes (TypeScript server,
// language servers, etc.) alone.
//
// Windows-focused (the maintainer's environment) but emits a clear
// no-op message on Mac/Linux so cross-platform users aren't confused.
//
// Zero npm dependencies. Uses only Node built-ins (child_process,
// process). Calls out to PowerShell for the port-to-PID lookup since
// Node has no portable equivalent; lsof is the Unix counterpart.
//
// Background: see scripts/check-dev-port.mjs header for the
// 2026-05-22 zombie-process incident.
// =============================================================================

import { execSync } from "node:child_process";

const PORTS = [5173, 4173, 5174, 5175, 5176, 5177];

if (process.platform !== "win32") {
  console.log(
    "kill-dev: this script targets Windows. On Mac/Linux, find + kill " +
      "manually:\n  lsof -ti:5173,4173,5174,5175 | xargs kill -9",
  );
  process.exit(0);
}

const killed = [];
const failed = [];

for (const port of PORTS) {
  let pids;
  try {
    // -NoProfile to avoid loading the user's PowerShell profile (faster
    // + avoids surprises). ErrorAction SilentlyContinue because most
    // dev ports are not in use most of the time.
    const cmd =
      `Get-NetTCPConnection -State Listen -LocalPort ${String(port)} ` +
      `-ErrorAction SilentlyContinue | ForEach-Object { $_.OwningProcess }`;
    const stdout = execSync(`powershell -NoProfile -Command "${cmd}"`, {
      encoding: "utf8",
    }).trim();
    if (stdout === "") {
      continue;
    }
    pids = stdout.split(/\s+/).filter((s) => s.length > 0);
  } catch {
    // No listener on this port; nothing to do.
    continue;
  }

  for (const pid of pids) {
    try {
      execSync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`, {
        stdio: "ignore",
      });
      killed.push({ port, pid });
    } catch (err) {
      failed.push({ port, pid, message: err instanceof Error ? err.message : String(err) });
    }
  }
}

if (killed.length === 0 && failed.length === 0) {
  console.log("\x1b[32m\u2713\x1b[0m No dev-port zombies found. You're clean.");
} else {
  if (killed.length > 0) {
    console.log(`\x1b[32m\u2713\x1b[0m Killed ${String(killed.length)} zombie process(es):`);
    for (const k of killed) {
      console.log(`    port ${String(k.port)} \u2192 PID ${k.pid}`);
    }
  }
  if (failed.length > 0) {
    console.log(`\x1b[33m!\x1b[0m Failed to kill ${String(failed.length)} process(es):`);
    for (const f of failed) {
      console.log(`    port ${String(f.port)} PID ${f.pid}: ${f.message}`);
    }
  }
}
