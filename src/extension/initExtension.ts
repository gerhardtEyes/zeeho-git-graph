import * as path from "node:path";

import * as vscode from "vscode";

import { AvatarManager } from "@/avatarManager";
import { GitClient, gitClientFactory } from "@/backend/gitClient";
import { findGitRepos } from "@/backend/queries/repoSearch";
import { config } from "@/config";
import { DiffDocProvider } from "@/diffDocProvider";
import { registerAutoDiffController } from "@/extension/autoDiffController";
import { COMMANDS, EXTENSION_NAMESPACE, GIT_GRAPH_VIEW_ID } from "@/extension/constant/const";
import { registerInlineBlameController } from "@/extension/inlineBlameController";
import { createMaxDepthTracker } from "@/extension/maxDepthTracker";
import { createRepoManager, RepoManager } from "@/extension/repoManager";
import { logger } from "@/extension/utils/logger";
import { GitGraphViewProvider } from "@/extension/webviewViewProvider";
import { ExtensionState } from "@/extensionState";
import { StatusBarItem } from "@/statusBarItem";

export type InitExtension = typeof initExtension;

async function toggleBooleanSetting(key: string, current: boolean) {
  const configuration = vscode.workspace.getConfiguration(EXTENSION_NAMESPACE);
  const inspected = configuration.inspect<boolean>(key);
  const target =
    inspected?.workspaceFolderValue !== undefined
      ? vscode.ConfigurationTarget.WorkspaceFolder
      : inspected?.workspaceValue !== undefined
        ? vscode.ConfigurationTarget.Workspace
        : vscode.ConfigurationTarget.Global;
  await configuration.update(key, !current, target);
}

function registerViewCommand(
  ctx: vscode.ExtensionContext,
  repoManager: RepoManager,
  extensionState: ExtensionState,
  avatarManager: AvatarManager,
  gitClient: GitClient
) {
  const provider = new GitGraphViewProvider({
    config,
    gitClient,
    repoManager,
    extensionState,
    avatarManager,
    extensionPath: ctx.extensionPath
  });

  ctx.subscriptions.push(
    provider,
    vscode.window.registerWebviewViewProvider(GIT_GRAPH_VIEW_ID, provider, {
      webviewOptions: { retainContextWhenHidden: true }
    }),
    vscode.commands.registerCommand(COMMANDS.view, () =>
      vscode.commands.executeCommand(`${GIT_GRAPH_VIEW_ID}.focus`)
    )
  );
}

export function initExtension(
  ctx: vscode.ExtensionContext,
  repos: string[],
  statusBarItem: StatusBarItem
) {
  try {
    logger.log(`Initializing extension with ${repos.length} repo(s)`);

    const extensionState = new ExtensionState(ctx);
    const avatarManager = new AvatarManager(config.gitPath, extensionState);

    ctx.subscriptions.push(
      vscode.commands.registerCommand(COMMANDS.clearAvatarCache, () => {
        avatarManager.clearCache();
      })
    );

    const gitClient = gitClientFactory(extensionState.getLastActiveRepo() ?? "", config.gitPath());
    ctx.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(
        DiffDocProvider.scheme,
        new DiffDocProvider(gitClient.getInstance)
      )
    );

    const maxDepth = createMaxDepthTracker(config.maxDepthOfRepoSearch());
    const repoManager = createRepoManager(extensionState, statusBarItem, config);
    repoManager.setRepos(repos);
    repoManager.sendRepos();
    registerViewCommand(ctx, repoManager, extensionState, avatarManager, gitClient);
    const getRepoPaths = () => Object.keys(repoManager.getRepos());
    ctx.subscriptions.push(
      registerInlineBlameController({ config, getRepoPaths }),
      registerAutoDiffController({ config, getRepoPaths }),
      vscode.commands.registerCommand(COMMANDS.toggleInlineBlame, () =>
        toggleBooleanSetting("inlineBlame.enabled", config.inlineBlameEnabled())
      ),
      vscode.commands.registerCommand(COMMANDS.toggleAutoOpenDirtyFileDiff, () =>
        toggleBooleanSetting("autoOpenDirtyFileDiff", config.autoOpenDirtyFileDiff())
      )
    );

    const gitWatcher = vscode.workspace.createFileSystemWatcher("**/.git");
    ctx.subscriptions.push(
      gitWatcher,
      gitWatcher.onDidCreate((uri) => {
        const repoPath = path.dirname(uri.fsPath);
        if (repoManager.addRepo(repoPath)) {
          repoManager.sendRepos();
        }
      }),
      gitWatcher.onDidDelete((uri) => {
        const repoPath = path.dirname(uri.fsPath);
        if (repoManager.removeReposWithinFolder(repoPath)) {
          repoManager.sendRepos();
        }
      }),
      vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
        if (e.added.length > 0) {
          const paths = e.added.map((f) => f.uri.fsPath);
          const repoDirs = await findGitRepos(
            paths,
            config.gitPath(),
            config.maxDepthOfRepoSearch()
          );
          for (const repo of repoDirs) {
            repoManager.addRepo(repo);
          }
          if (repoDirs.length > 0) {
            repoManager.sendRepos();
          }
        }
        if (e.removed.length > 0) {
          let changes = false;
          for (const folder of e.removed) {
            if (repoManager.removeReposWithinFolder(folder.uri.fsPath)) {
              changes = true;
            }
          }
          if (changes) {
            repoManager.sendRepos();
          }
        }
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(`${EXTENSION_NAMESPACE}.showStatusBarItem`)) {
          statusBarItem.refresh();
        } else if (e.affectsConfiguration("git.path")) {
          gitClient.setGitPath(config.gitPath());
        } else if (e.affectsConfiguration(`${EXTENSION_NAMESPACE}.maxDepthOfRepoSearch`)) {
          if (maxDepth.increased(config.maxDepthOfRepoSearch())) {
            const paths = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
            void findGitRepos(paths, config.gitPath(), config.maxDepthOfRepoSearch()).then(
              (repoDirs) => {
                if (repoDirs.length > 0) {
                  repoManager.setRepos(repoDirs);
                  repoManager.sendRepos();
                }
              }
            );
          }
        }
      })
    );
  } catch (err) {
    logger.log(`Error during initialization: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}
