import * as fs from "node:fs";
import * as path from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { blameFile } from "@/backend/queries/fileBlame";

import { git, makeRepo } from "@tests/backend/helpers";

let repo: string;

beforeAll(() => {
  repo = makeRepo();
  fs.writeFileSync(path.join(repo, "tracked.txt"), "first line\n");
  git(["add", "tracked.txt"], repo);
  git(["commit", "-m", "add tracked file"], repo);
});

afterEach(() => {
  fs.rmSync(path.join(repo, "space name.txt"), { force: true });
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("blameFile", () => {
  it("parses committed lines and uncommitted lines using --line-porcelain", async () => {
    fs.writeFileSync(path.join(repo, "tracked.txt"), "first line\nsecond line\n");
    const lines = await blameFile({
      repo,
      relativePath: "tracked.txt",
      contents: "first line\nsecond line\n",
      gitPath: "git"
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      line: 1,
      author: "T",
      authorTime: expect.any(Number),
      committerTime: expect.any(Number),
      summary: expect.any(String),
      isUncommitted: false
    });
    expect(lines[1]).toMatchObject({
      line: 2,
      isUncommitted: true,
      commit: "0000000000000000000000000000000000000000",
      author: "External file (--contents)"
    });
  });

  it("supports CRLF content and spaced file paths", async () => {
    const spacedPath = "space name.txt";
    fs.writeFileSync(path.join(repo, spacedPath), "line one\r\n");
    git(["add", spacedPath], repo);
    git(["commit", "-m", "add spaced file"], repo);

    const lines = await blameFile({
      repo,
      relativePath: spacedPath,
      contents: "line one\r\n",
      gitPath: "git"
    });
    expect(lines).toHaveLength(1);
    expect(lines[0].line).toBe(1);
  });

  it("returns uncommitted lines when path does not exist in HEAD", async () => {
    const lines = await blameFile({
      repo,
      relativePath: "missing.txt",
      contents: "new file line\nanother line\n",
      gitPath: "git"
    });
    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.commit === "0000000000000000000000000000000000000000")).toBe(
      true
    );
    expect(lines.every((line) => line.isUncommitted)).toBe(true);
  });

  it("handles AbortSignal cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      blameFile({
        repo,
        relativePath: "tracked.txt",
        contents: "first line\n",
        gitPath: "git",
        signal: controller.signal
      })
    ).rejects.toThrow("Operation was aborted");
  });

  it("throws when output exceeds maxOutputBytes", async () => {
    await expect(
      blameFile({
        repo,
        relativePath: "tracked.txt",
        contents: "line one\nline two\nline three\n",
        gitPath: "git",
        maxOutputBytes: 10
      })
    ).rejects.toThrow("Git output exceeded maximum bytes");
  });
});
