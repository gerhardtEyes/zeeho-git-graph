import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { commitDetails } from "@/backend/queries/commitDetails";

import { git, makeRepo } from "@tests/backend/helpers";

let repo: string;
let commitHash: string;

beforeAll(() => {
  repo = makeRepo();
  commitHash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo }).toString().trim();
});

afterAll(() => {
  fs.rmSync(repo, { recursive: true, force: true });
});

describe("commitDetails", () => {
  it("returns commit details with expected fields", async () => {
    const result = await commitDetails(simpleGit(repo), {
      commitHash,
      dateType: "Author Date"
    });
    expect(result).toEqual({
      commitDetails: {
        hash: commitHash,
        parents: expect.any(Array),
        author: expect.any(String),
        email: expect.any(String),
        date: expect.any(Number),
        committer: expect.any(String),
        body: expect.any(String),
        fileChanges: expect.any(Array)
      }
    });
    expect(result.commitDetails!.date).toBeGreaterThan(0);
  });

  it("returns file changes for the initial commit", async () => {
    const result = await commitDetails(simpleGit(repo), { commitHash, dateType: "Author Date" });
    expect(result.commitDetails).not.toBeNull();
    expect(result.commitDetails!.fileChanges.length).toBeGreaterThan(0);
  });

  it("returns commitDetails: null for an invalid commit hash", async () => {
    const result = await commitDetails(simpleGit(repo), {
      commitHash: "deadbeef1234",
      dateType: "Author Date"
    });
    expect(result).toEqual({ commitDetails: null });
  });

  it("includes additions and deletions for a modified file", async () => {
    const repo2 = makeRepo();
    try {
      fs.writeFileSync(path.join(repo2, "f"), "modified content");
      git(["add", "."], repo2);
      git(["commit", "-m", "mod"], repo2);
      const hash = cp.execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo2 }).toString().trim();

      const result = await commitDetails(simpleGit(repo2), {
        commitHash: hash,
        dateType: "Author Date"
      });
      expect(result.commitDetails).not.toBeNull();
      const changed = result.commitDetails!.fileChanges.find((f) => f.newFilePath === "f");
      expect(changed).toBeDefined();
      expect(changed!.additions).toEqual(expect.any(Number));
      expect(changed!.deletions).toEqual(expect.any(Number));
    } finally {
      fs.rmSync(repo2, { recursive: true, force: true });
    }
  });

  it("uses commit date when dateType is Commit Date", async () => {
    const result = await commitDetails(simpleGit(repo), { commitHash, dateType: "Commit Date" });
    expect(result).toEqual({
      commitDetails: {
        hash: commitHash,
        parents: expect.any(Array),
        author: expect.any(String),
        email: expect.any(String),
        date: expect.any(Number),
        committer: expect.any(String),
        body: expect.any(String),
        fileChanges: expect.any(Array)
      }
    });
    expect(result.commitDetails!.date).toBeGreaterThan(0);
  });

  it("body contains the commit message", async () => {
    const result = await commitDetails(simpleGit(repo), { commitHash, dateType: "Author Date" });
    expect(result.commitDetails!.body).toContain("init");
  });

  it("returns tracked, renamed, deleted and untracked working-tree changes", async () => {
    const dirtyRepo = makeRepo();
    try {
      fs.writeFileSync(path.join(dirtyRepo, "deleted.txt"), "delete me\n");
      fs.writeFileSync(path.join(dirtyRepo, "old-name.txt"), "rename me\n");
      git(["add", "."], dirtyRepo);
      git(["commit", "-m", "tracked files"], dirtyRepo);

      fs.writeFileSync(path.join(dirtyRepo, "f"), "x\nmodified\n");
      fs.rmSync(path.join(dirtyRepo, "deleted.txt"));
      git(["mv", "old-name.txt", "new-name.txt"], dirtyRepo);
      fs.writeFileSync(path.join(dirtyRepo, "untracked.cs"), "class NewFile {}\n");

      const result = await commitDetails(simpleGit(dirtyRepo), {
        commitHash: "*",
        dateType: "Author Date"
      });

      expect(result.commitDetails).toMatchObject({
        hash: "*",
        parents: [expect.any(String)],
        author: "",
        email: "",
        committer: "",
        body: ""
      });
      const changes = new Map(
        result.commitDetails!.fileChanges.map((file) => [file.newFilePath, file])
      );
      expect(changes.get("f")).toMatchObject({ type: "M" });
      expect(changes.get("f")!.additions).toEqual(expect.any(Number));
      expect(changes.get("f")!.deletions).toEqual(expect.any(Number));
      expect(changes.get("deleted.txt")).toMatchObject({ type: "D" });
      expect(changes.get("new-name.txt")).toMatchObject({
        oldFilePath: "old-name.txt",
        type: "R"
      });
      expect(changes.get("untracked.cs")).toEqual({
        oldFilePath: "untracked.cs",
        newFilePath: "untracked.cs",
        type: "A",
        additions: 0,
        deletions: 0
      });
      expect(result.commitDetails!.stagedFileChanges).toEqual([
        expect.objectContaining({
          oldFilePath: "old-name.txt",
          newFilePath: "new-name.txt",
          type: "R"
        })
      ]);
      expect(result.commitDetails!.unstagedFileChanges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ newFilePath: "f", type: "M" }),
          expect.objectContaining({ newFilePath: "deleted.txt", type: "D" }),
          expect.objectContaining({ newFilePath: "untracked.cs", type: "A" })
        ])
      );
    } finally {
      fs.rmSync(dirtyRepo, { recursive: true, force: true });
    }
  });

  it("returns an empty working-tree list for a clean repository", async () => {
    const result = await commitDetails(simpleGit(repo), {
      commitHash: "*",
      dateType: "Commit Date"
    });
    expect(result.commitDetails).not.toBeNull();
    expect(result.commitDetails!.fileChanges).toEqual([]);
    expect(result.commitDetails!.stagedFileChanges).toEqual([]);
    expect(result.commitDetails!.unstagedFileChanges).toEqual([]);
  });

  it("lists a partially staged file in both index and working-tree sections", async () => {
    const dirtyRepo = makeRepo();
    try {
      fs.writeFileSync(path.join(dirtyRepo, "f"), "staged\n");
      git(["add", "f"], dirtyRepo);
      fs.appendFileSync(path.join(dirtyRepo, "f"), "unstaged\n");

      const result = await commitDetails(simpleGit(dirtyRepo), {
        commitHash: "*",
        dateType: "Author Date"
      });

      expect(result.commitDetails!.stagedFileChanges).toEqual([
        expect.objectContaining({ newFilePath: "f", type: "M" })
      ]);
      expect(result.commitDetails!.unstagedFileChanges).toEqual([
        expect.objectContaining({ newFilePath: "f", type: "M" })
      ]);
    } finally {
      fs.rmSync(dirtyRepo, { recursive: true, force: true });
    }
  });

  it("keeps merge conflicts visible so they can be resolved and staged", async () => {
    const conflictRepo = makeRepo();
    try {
      git(["checkout", "-b", "conflicting"], conflictRepo);
      fs.writeFileSync(path.join(conflictRepo, "f"), "branch\n");
      git(["add", "f"], conflictRepo);
      git(["commit", "-m", "branch side"], conflictRepo);
      git(["checkout", "main"], conflictRepo);
      fs.writeFileSync(path.join(conflictRepo, "f"), "main\n");
      git(["add", "f"], conflictRepo);
      git(["commit", "-m", "main side"], conflictRepo);
      expect(() => git(["merge", "conflicting"], conflictRepo)).toThrow();

      const result = await commitDetails(simpleGit(conflictRepo), {
        commitHash: "*",
        dateType: "Author Date"
      });

      expect(result.commitDetails!.fileChanges).toEqual([
        expect.objectContaining({ newFilePath: "f" })
      ]);
      expect(result.commitDetails!.unstagedFileChanges).toEqual([
        expect.objectContaining({ newFilePath: "f" })
      ]);
    } finally {
      fs.rmSync(conflictRepo, { recursive: true, force: true });
    }
  });
});
