/* Git Data Model Types */

export type GitRef = {
  hash: string;
  name: string;
  type: "head" | "tag" | "remote";
};

export type GitRefData = {
  head: string | null;
  refs: GitRef[];
};

export type GitCommitNode = {
  hash: string;
  parentHashes: string[];
  author: string;
  email: string;
  date: number;
  message: string;
  refs: GitRef[];
};

export type GitLogEntry = {
  hash: string;
  parentHashes: string[];
  author: string;
  email: string;
  date: number;
  message: string;
};

export type GitFileChange = {
  oldFilePath: string;
  newFilePath: string;
  type: GitFileChangeType;
  additions: number | null;
  deletions: number | null;
};

export type GitCommitDetails = {
  hash: string;
  parents: string[];
  author: string;
  email: string;
  date: number;
  committer: string;
  body: string;
  fileChanges: GitFileChange[];
  /** Index changes, present only for the synthetic uncommitted-changes row. */
  stagedFileChanges?: GitFileChange[];
  /** Working-tree and untracked changes, present only for the synthetic row. */
  unstagedFileChanges?: GitFileChange[];
};

export type GitFileChangeType = "A" | "M" | "D" | "R" | "U";
export type GitDiffScope = "commit" | "working" | "staged" | "unstaged";
export type DateType = "Author Date" | "Commit Date";
export type GitResetMode = "soft" | "mixed" | "hard";
export type GitPullStrategy = "ff-only" | "merge" | "rebase";
