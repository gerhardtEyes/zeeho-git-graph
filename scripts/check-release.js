const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireCondition(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function walk(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const files = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name === "out") {
      continue;
    }
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(child));
    } else {
      files.push(child);
    }
  }
  return files;
}

const packageJson = JSON.parse(read("package.json"));
requireCondition(packageJson.name === "zeeho-git-graph", "package name must be zeeho-git-graph");
requireCondition(
  packageJson.displayName === "Zeeho Git Graph",
  "display name must be Zeeho Git Graph"
);
requireCondition(
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageJson.version),
  "package version must be valid semantic version"
);
requireCondition(packageJson.publisher !== "asispts", "upstream publisher must not be used");
requireCondition(
  packageJson.publisher === "Tamzeeho",
  "publisher must be the registered VS Marketplace Publisher ID (Tamzeeho)"
);
requireCondition(
  packageJson.repository?.url === "https://github.com/gerhardtEyes/zeeho-git-graph.git",
  "repository URL must target gerhardtEyes/zeeho-git-graph"
);

const expectedPublisher = process.env.EXPECTED_PUBLISHER;
const publicRelease = process.env.PUBLIC_RELEASE === "true";
if (expectedPublisher) {
  requireCondition(
    packageJson.publisher === expectedPublisher,
    `publisher must match EXPECTED_PUBLISHER (${expectedPublisher})`
  );
} else if (publicRelease) {
  errors.push("EXPECTED_PUBLISHER is required for a public release");
}

const expectedVersion = process.env.EXPECTED_VERSION?.replace(/^v/, "");
if (expectedVersion) {
  requireCondition(
    packageJson.version === expectedVersion,
    `package version must match EXPECTED_VERSION (${expectedVersion})`
  );
}

const license = read("LICENSE");
requireCondition(
  license.includes("Copyright (c) 2019 mhutchie. Fork (c) 2026-present asispts"),
  "upstream copyright notice must be preserved"
);
requireCondition(
  license.includes("Modifications Copyright (c) 2026-present tamzeeho"),
  "tamzeeho modification copyright notice is missing"
);

for (const requiredFile of [
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "RELEASING.md",
  "SECURITY.md"
]) {
  requireCondition(fs.existsSync(path.join(root, requiredFile)), `${requiredFile} is missing`);
}

const identityFiles = [
  "package.json",
  "package.nls.json",
  "package.nls.zh-cn.json",
  "package.nls.zh-tw.json",
  "flake.nix",
  ...walk("l10n"),
  ...walk("src"),
  ...walk("tests"),
  ...walk("tests-ext")
];

for (const relativePath of identityFiles) {
  const contents = read(relativePath);
  if (contents.includes("neo-git-graph")) {
    errors.push(`${relativePath} contains the legacy runtime namespace neo-git-graph`);
  }
  if (/Private-Token|\bglpat-|\bghp_[A-Za-z0-9]/i.test(contents)) {
    errors.push(`${relativePath} contains a credential-like value`);
  }
}

requireCondition(
  read(".vscodeignore").includes("!THIRD_PARTY_NOTICES.md"),
  "THIRD_PARTY_NOTICES.md must be included in the VSIX"
);

if (errors.length > 0) {
  process.stderr.write("Release readiness check failed:\n");
  for (const error of errors) {
    process.stderr.write(`- ${error}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("Release readiness check passed.\n");
}
