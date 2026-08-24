import * as vscode from "vscode";

import { findGitRepos } from "@/backend/queries/repoSearch";
import { getGitVersion } from "@/backend/utils/git";
import { config } from "@/config";
import { EXTENSION_NAME } from "@/extension/constant/const";
import { initExtension } from "@/extension/initExtension";
import { logger } from "@/extension/utils/logger";
import { StatusBarItem } from "@/statusBarItem";

export async function activate(ctx: vscode.ExtensionContext) {
  logger.init(ctx);
  logger.log(`Starting ${EXTENSION_NAME} ...`);

  const gitPath = config.gitPath();
  const gitVersion = await getGitVersion(gitPath);
  if (gitVersion) {
    logger.log(`Using git (version: ${gitVersion})`);
  } else {
    logger.log("Failed to detect git version");
  }

  const statusBarItem = new StatusBarItem(ctx, config);
  statusBarItem.refresh();

  const paths = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
  logger.log(`Searching workspace for new repos (${paths.length} folder(s)) ...`);
  const repoDirs = await findGitRepos(paths, gitPath, config.maxDepthOfRepoSearch());

  if (repoDirs.length > 0) {
    logger.log(`Found ${repoDirs.length} repo(s)`);
  } else {
    logger.log("No repos found");
  }

  initExtension(ctx, repoDirs, statusBarItem);
  logger.log(`Started ${EXTENSION_NAME} - Ready to use!`);
}

export function deactivate() {}
