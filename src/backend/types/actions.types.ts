import type { GitPullStrategy, GitResetMode } from "./git.types";

export type GitCommandStatus = string | null;

type ActionPayloads = {
  addTag: { tagName: string; commitHash: string; lightweight: boolean; message: string };
  checkoutBranch: { branchName: string; remoteBranch: string | null };
  checkoutCommit: { commitHash: string };
  cherrypickCommit: { commitHash: string; parentIndex: number };
  createBranch: { commitHash: string; branchName: string };
  deleteBranch: { branchName: string; forceDelete: boolean };
  deleteTag: { tagName: string };
  mergeBranch: { branchName: string; createNewCommit: boolean };
  mergeCommit: { commitHash: string; createNewCommit: boolean };
  commitChanges: { message: string };
  pullCurrentBranch: { strategy: GitPullStrategy };
  pushCurrentBranch: Record<never, never>;
  pushTag: { tagName: string };
  rebaseBranch: { branchName: string };
  renameBranch: { oldName: string; newName: string };
  resetToCommit: { commitHash: string; resetMode: GitResetMode };
  revertCommit: { commitHash: string; parentIndex: number };
  stageAll: Record<never, never>;
  stageFiles: { paths: string[] };
  unstageAll: Record<never, never>;
  unstageFiles: { paths: string[] };
};

export type ActionRequest = {
  [K in keyof ActionPayloads]: { command: K; repo: string } & ActionPayloads[K];
}[keyof ActionPayloads];

export type ActionResponse = {
  [K in keyof ActionPayloads]: { command: K; status: GitCommandStatus };
}[keyof ActionPayloads];

export type ActionPayload<T extends keyof ActionPayloads> = ActionPayloads[T];
