import type { SimpleGit } from "simple-git";

import type { ActionPayload } from "@/backend/types";

function requirePaths(paths: string[]) {
  const unique = [...new Set(paths.filter((path) => path !== ""))];
  if (unique.length === 0) {
    throw new Error("No files were selected.");
  }
  return unique;
}

/** Stage every selected path, including deletions and both sides of renames. */
export async function stageFiles(
  git: SimpleGit,
  input: ActionPayload<"stageFiles">
): Promise<void> {
  await git.raw(["add", "-A", "--", ...requirePaths(input.paths)]);
}

/** Move selected index entries back to the working tree without discarding data. */
export async function unstageFiles(
  git: SimpleGit,
  input: ActionPayload<"unstageFiles">
): Promise<void> {
  await git.raw(["reset", "--", ...requirePaths(input.paths)]);
}

export async function stageAll(git: SimpleGit): Promise<void> {
  await git.raw(["add", "-A", "--", "."]);
}

export async function unstageAll(git: SimpleGit): Promise<void> {
  await git.raw(["reset"]);
}

export async function commitChanges(
  git: SimpleGit,
  input: ActionPayload<"commitChanges">
): Promise<void> {
  const message = input.message.trim();
  if (message === "") {
    throw new Error("A commit message is required.");
  }
  await git.commit(message);
}

export async function pushCurrentBranch(git: SimpleGit): Promise<void> {
  await git.push();
}

export async function pullCurrentBranch(
  git: SimpleGit,
  input: ActionPayload<"pullCurrentBranch">
): Promise<void> {
  const strategy =
    input.strategy === "ff-only"
      ? ["--ff-only"]
      : input.strategy === "rebase"
        ? ["--rebase"]
        : ["--no-rebase"];
  await git.raw(["pull", ...strategy]);
}

export async function rebaseBranch(
  git: SimpleGit,
  input: ActionPayload<"rebaseBranch">
): Promise<void> {
  await git.rebase([input.branchName]);
}
