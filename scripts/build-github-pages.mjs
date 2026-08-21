import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const clientDir = resolve(root, "dist/client");
const siteDir = resolve(root, "site");

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function waitForProductionServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:3000/");
      if (response.ok) return response.text();
    } catch {
      // The production server is still starting.
    }
    await sleep(250);
  }
  throw new Error("The vinext production server did not become ready.");
}

const server = spawn("npm", ["run", "start"], {
  cwd: root,
  stdio: "ignore",
  env: { ...process.env, WRANGLER_LOG_PATH: ".wrangler/pages.log" },
});

try {
  const renderedHtml = await waitForProductionServer();
  if (!renderedHtml.includes("The Pocket Pilots")) {
    throw new Error("The rendered page did not contain the Pocket Pilots content.");
  }

  await rm(siteDir, { recursive: true, force: true });
  await mkdir(siteDir, { recursive: true });
  await cp(clientDir, siteDir, { recursive: true });

  const staticHtml = renderedHtml
    .replaceAll('href="/_next/', 'href="./_next/')
    .replaceAll('src="/_next/', 'src="./_next/')
    .replaceAll('href="/favicon.svg', 'href="./favicon.svg');

  await writeFile(resolve(siteDir, "index.html"), staticHtml);
  await writeFile(resolve(siteDir, "404.html"), staticHtml);
  await writeFile(resolve(siteDir, ".nojekyll"), "");
  await writeFile(resolve(siteDir, "build-info.txt"), "GitHub Pages static export\n");

  const indexSize = (await readFile(resolve(siteDir, "index.html"))).byteLength;
  console.log(`GitHub Pages site created at ${siteDir} (${indexSize} byte index.html).`);
} finally {
  server.kill("SIGTERM");
}
