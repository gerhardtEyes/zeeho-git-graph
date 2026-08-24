const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function runNode(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function packageBin(packageName) {
  const packagePath = require.resolve(`${packageName}/package.json`, { paths: [root] });
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const bin =
    typeof packageJson.bin === "string"
      ? packageJson.bin
      : (packageJson.bin[packageName] ?? Object.values(packageJson.bin)[0]);
  return path.resolve(path.dirname(packagePath), bin);
}

fs.rmSync(path.join(root, "out"), { recursive: true, force: true });
runNode(path.join(root, "scripts/check-release.js"));

const tsc = packageBin("typescript");
for (const project of [".", "src", "src/webview", "tests", "tests/webview", "tests-ext"]) {
  runNode(tsc, ["-p", project, "--noEmit"]);
}

runNode(packageBin("oxlint"));
runNode(path.join(root, "esbuild.js"), ["--production"]);
