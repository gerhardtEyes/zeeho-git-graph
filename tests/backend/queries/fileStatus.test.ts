import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { fileHasChanges } from "@/backend/queries/fileStatus";

import { makeRepo } from "@tests/backend/helpers";

describe("fileHasChanges", () => {
  it("returns false for a clean tracked file", async () => {
    const repo = makeRepo();

    await expect(fileHasChanges({ gitPath: "git", relativePath: "f", repo })).resolves.toBe(false);
  });

  it("detects tracked and untracked changes", async () => {
    const repo = makeRepo();
    fs.writeFileSync(path.join(repo, "f"), "changed\n");
    fs.writeFileSync(path.join(repo, "new file.txt"), "new\n");

    await expect(fileHasChanges({ gitPath: "git", relativePath: "f", repo })).resolves.toBe(true);
    await expect(
      fileHasChanges({ gitPath: "git", relativePath: "new file.txt", repo })
    ).resolves.toBe(true);
  });

  it("supports cancellation", async () => {
    const repo = makeRepo();
    const controller = new AbortController();
    controller.abort();

    await expect(
      fileHasChanges({
        gitPath: "git",
        relativePath: "f",
        repo,
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
