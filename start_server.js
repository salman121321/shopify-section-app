import { spawn } from "child_process";

// Ensure HOST is set to 0.0.0.0 for Docker/Railway support
process.env.HOST = "0.0.0.0";

const port = process.env.PORT || 3000;
console.log(`[Start Script] Starting server on 0.0.0.0:${port}`);

// Determine the correct command for the current OS
const cmd = process.platform === "win32" ? "remix-serve.cmd" : "remix-serve";

const child = spawn(cmd, ["./build/server/index.js"], {
  stdio: "inherit",
  env: { ...process.env, HOST: "0.0.0.0" }
});

child.on("error", (err) => {
  console.error("[Start Script] Failed to start remix-serve:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  console.log(`[Start Script] Server exited with code ${code}`);
  process.exit(code);
});
