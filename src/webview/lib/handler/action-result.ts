import type { ActionResponse } from "@/backend/types";
import type { LocalizedStrings } from "@/extension/l10n/webviewL10n";
import { closeDialog, openErrorDialog, refresh } from "@/webview/lib/actions";
import { actionResult } from "@/webview/lib/stores";

const ERROR_KEY: Record<ActionResponse["command"], keyof LocalizedStrings> = {
  addTag: "unableToAddTag",
  checkoutBranch: "unableToCheckoutBranch",
  checkoutCommit: "unableToCheckoutCommit",
  cherrypickCommit: "unableToCherryPick",
  commitChanges: "unableToCommitChanges",
  createBranch: "unableToCreateBranch",
  deleteBranch: "unableToDeleteBranch",
  deleteTag: "unableToDeleteTag",
  mergeBranch: "unableToMergeBranch",
  mergeCommit: "unableToMergeCommit",
  pullCurrentBranch: "unableToPullCurrentBranch",
  pushCurrentBranch: "unableToPushCurrentBranch",
  pushTag: "unableToPushTag",
  rebaseBranch: "unableToRebaseBranch",
  renameBranch: "unableToRenameBranch",
  resetToCommit: "unableToReset",
  revertCommit: "unableToRevert",
  stageAll: "unableToStageChanges",
  stageFiles: "unableToStageChanges",
  unstageAll: "unableToUnstageChanges",
  unstageFiles: "unableToUnstageChanges"
};

/** Every git command answers the same way, so one handler serves them all. */
export function handleActionResult(msg: ActionResponse) {
  actionResult.value = msg;
  // A failed merge, pull, or rebase may still leave conflicts in the index and
  // working tree. Always refresh before reporting the result.
  refresh();
  if (msg.status === null) {
    closeDialog();
    return;
  }

  openErrorDialog(window.l10n[ERROR_KEY[msg.command]], msg.status);
}
