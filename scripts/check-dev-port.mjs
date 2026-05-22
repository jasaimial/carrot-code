// =============================================================================
// scripts/check-dev-port.mjs
//
// `predev` guard: runs automatically before `npm run dev` and refuses to
// proceed if port 5173 is already in use. Surfaces zombie dev servers from
// previous sessions instead of letting Vite silently shift to 5174/5175
// while the browser keeps hitting :5173 + the zombie's stale state.
//
// Background: 2026-05-22 the maintainer wasted ~30 minutes on a
// phantom "local dev broken" bug that turned out to be a 4-day-old
// zombie `npm run dev` process from a previous session squatting on
// port 5173 with the old PWA-in-dev service worker still registered.
// New `npm run dev` invocations shifted to 5175 (Vite default
// strictPort:false), but the browser kept hitting :5173 and getting
// served by the zombie. Diagnosis was painful because everything
// LOOKED fine - dev server running, gates green, code on disk
// correct. The zombie was just invisible from the foreground.
//
// strictPort:true (committed at the same time) is the primary fix;
// this script is the friendly secondary surface that explains what
// to do when strictPort fires.
//
// Zero npm dependencies. Uses only Node built-ins (net).
// =============================================================================

import net from "node:net";

const PORT = 5173;
const TIMEOUT_MS = 500;

const sock = net.connect(PORT, "127.0.0.1");
sock.setTimeout(TIMEOUT_MS);

sock.on("connect", () => {
  process.stderr.write("\n");
  process.stderr.write(
    `\x1b[31m\u2717\x1b[0m Port ${PORT.toString()} is already in use \u2014 ` +
      "likely a zombie 'npm run dev' from a previous session.\n",
  );
  process.stderr.write("\n");
  process.stderr.write("  Find the owning PID (Windows / PowerShell):\n");
  process.stderr.write(
    `    Get-NetTCPConnection -State Listen -LocalPort ${PORT.toString()} | Select OwningProcess\n`,
  );
  process.stderr.write("\n");
  process.stderr.write("  Or kill all dev-port zombies in one shot:\n");
  process.stderr.write("    npm run kill-dev\n");
  process.stderr.write("\n");
  process.stderr.write(
    "  Then retry `npm run dev`. See docs/learning/HANDOVER.md \u00a7 " +
      "Troubleshooting local dev for more.\n",
  );
  process.stderr.write("\n");
  sock.destroy();
  process.exit(1);
});

sock.on("error", () => {
  // ECONNREFUSED = port is free. This is the happy path. Exit cleanly
  // so `npm run dev` proceeds.
  process.exit(0);
});

sock.on("timeout", () => {
  // Timeout means no listener responded in 500ms. Treat as free.
  sock.destroy();
  process.exit(0);
});
