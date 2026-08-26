import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import { describe, expect, it } from "vitest";

import {
  commitChanges,
  pullCurrentBranch,
  pushCurrentBranch,
  rebaseBranch,
  stageAll,
  stageFiles,
  unstageAll,
  unstageFiles
} from "@/backend/actions/workingTree";

import { git, makeRepo } from "@tests/backend/helpers";

function output(args: string[], cwd: string) {
  return cp.execFileSync("git", args, { cwd }).toString().trim();
}

describe("working-tree actions", () => {
  it("stages and unstages selected paths without discarding their contents", async () => {
    const repo = makeRepo();
    try {
      fs.writeFileSync(path.join(repo, "f"), "changed");
      fs.writeFileSync(path.join(repo, "new.txt"), "new");
      const client = simpleGit(repo);

      await stageFiles(client, { paths: ["f", "new.txt"] });
      expect(output(["diff", "--cached", "--name-only"], repo).split("\n")).toEqual([
        "f",
        "new.txt"
      ]);

      await unstageFiles(client, { paths: ["f"] });
      expect(output(["diff", "--cached", "--name-only"], repo)).toBe("new.txt");
      expect(fs.readFileSync(path.join(repo, "f"), "utf8")).toBe("changed");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("stages all, commits, and can unstage all", async () => {
    const repo = makeRepo();
    try {
      fs.writeFileSync(path.join(repo, "one.txt"), "one");
      fs.writeFileSync(path.join(repo, "two.txt"), "two");
      const client = simpleGit(repo);

      await stageAll(client);
      await unstageAll(client);
      expect(output(["diff", "--cached", "--name-only"], repo)).toBe("");

      await stageAll(client);
      await commitChanges(client, { message: "  add two files  " });
      expect(output(["log", "-1", "--pretty=%s"], repo)).toBe("add two files");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("rejects empty commit messages and empty file selections", async () => {
    const repo = makeRepo();
    try {
      const client = simpleGit(repo);
      await expect(commitChanges(client, { message: "   " })).rejects.toThrow("commit message");
      await expect(stageFiles(client, { paths: [] })).rejects.toThrow("No files");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("rebases the current branch onto the selected branch", async () => {
    const repo = makeRepo();
    try {
      git(["checkout", "-b", "feature"], repo);
      fs.writeFileSync(path.join(repo, "feature.txt"), "feature");
      git(["add", "."], repo);
      git(["commit", "-m", "feature"], repo);
      git(["checkout", "main"], repo);
      fs.writeFileSync(path.join(repo, "main.txt"), "main");
      git(["add", "."], repo);
      git(["commit", "-m", "main"], repo);
      const main = output(["rev-parse", "HEAD"], repo);
      git(["checkout", "feature"], repo);

      await rebaseBranch(simpleGit(repo), { branchName: "main" });

      expect(output(["rev-parse", "HEAD^"], repo)).toBe(main);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("pushes and pulls the configured upstream", async () => {
    const repo = makeRepo();
    const remote = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-remote-"));
    const peer = fs.mkdtempSync(path.join(os.tmpdir(), "ngg-peer-"));
    try {
      git(["init", "--bare"], remote);
      git(["remote", "add", "origin", remote], repo);
      git(["push", "-u", "origin", "main"], repo);

      fs.writeFileSync(path.join(repo, "pushed.txt"), "pushed");
      git(["add", "."], repo);
      git(["commit", "-m", "pushed"], repo);
      await pushCurrentBranch(simpleGit(repo));
      expect(
        output(["--git-dir", remote, "log", "-1", "--pretty=%s", "refs/heads/main"], repo)
      ).toBe("pushed");

      git(["clone", "-b", "main", remote, peer], repo);
      git(["config", "user.email", "t@t.com"], peer);
      git(["config", "user.name", "T"], peer);
      fs.writeFileSync(path.join(peer, "pulled.txt"), "pulled");
      git(["add", "."], peer);
      git(["commit", "-m", "pulled"], peer);
      git(["push"], peer);

      await pullCurrentBranch(simpleGit(repo), { strategy: "ff-only" });
      expect(fs.readFileSync(path.join(repo, "pulled.txt"), "utf8")).toBe("pulled");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
      fs.rmSync(remote, { recursive: true, force: true });
      fs.rmSync(peer, { recursive: true, force: true });
    }
  });
});
