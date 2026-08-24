import * as vscode from "vscode";

import { AvatarManager } from "@/avatarManager";
import { buildExtensionUri } from "@/backend/utils/path";
import { Config } from "@/config";
import { ExtensionState } from "@/extensionState";
import { RepoFileWatcher } from "@/repoFileWatcher";
import { GitRepoSet } from "@/types";

import { registerMessageHandlers } from "./messageHandler";
import { RepoManager } from "./repoManager";
import { WebviewBridge, webviewBridgeFactory } from "./webviewBridge";
import { buildWebviewHtml } from "./webviewHtml";

type GitGraphViewProviderOptions = {
  config: Config;
  extensionPath: string;
  extensionState: ExtensionState;
  avatarManager: AvatarManager;
  repoManager: RepoManager;
  gitClient: import("@/backend/gitClient").GitClient;
};

export class GitGraphViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private viewDisposables: vscode.Disposable[] = [];
  private repoFileWatcher: RepoFileWatcher | undefined;

  constructor(private readonly opts: GitGraphViewProviderOptions) {}

  public resolveWebviewView(
    view: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.disposeResolvedView();
    this.view = view;

    const { config, extensionPath, extensionState, avatarManager, repoManager, gitClient } =
      this.opts;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        buildExtensionUri(extensionPath, "media"),
        buildExtensionUri(extensionPath, "out")
      ]
    };

    let bridge!: WebviewBridge;
    const repoFileWatcher = new RepoFileWatcher(() => {
      if (this.view === view && view.visible) {
        void bridge.post({ command: "refresh" });
      }
    });
    this.repoFileWatcher = repoFileWatcher;

    bridge = webviewBridgeFactory(view.webview, repoFileWatcher);
    avatarManager.registerBridge((message) => {
      if (this.view === view) {
        void bridge.post(message);
      }
    });

    const { onViewShown } = registerMessageHandlers(bridge, {
      config,
      gitClient,
      repoManager,
      extensionState,
      avatarManager,
      repoFileWatcher
    });

    const result = buildWebviewHtml({
      webview: view.webview,
      config,
      extensionPath,
      extensionState,
      repoManager
    });
    view.webview.html = result.html;

    view.onDidDispose(() => this.disposeResolvedView(view), null, this.viewDisposables);
    view.onDidChangeVisibility(
      () => {
        if (this.view !== view) {
          return;
        }
        if (view.visible) {
          onViewShown();
          void bridge.post({
            command: "loadRepos",
            repos: repoManager.getRepos(),
            lastActiveRepo: extensionState.getLastActiveRepo()
          });
          void bridge.post({ command: "refresh" });
        } else {
          repoFileWatcher.stop();
        }
      },
      null,
      this.viewDisposables
    );

    repoManager.registerViewCallback((repos: GitRepoSet) => {
      if (this.view !== view || !view.visible) {
        return;
      }
      void bridge.post({
        command: "loadRepos",
        repos,
        lastActiveRepo: extensionState.getLastActiveRepo()
      });
    });
  }

  public dispose() {
    this.disposeResolvedView();
  }

  private disposeResolvedView(expectedView?: vscode.WebviewView) {
    if (expectedView !== undefined && this.view !== expectedView) {
      return;
    }

    this.view = undefined;
    this.opts.avatarManager.deregisterBridge();
    this.repoFileWatcher?.stop();
    this.repoFileWatcher = undefined;
    this.opts.repoManager.deregisterViewCallback();
    while (this.viewDisposables.length > 0) {
      this.viewDisposables.pop()?.dispose();
    }
  }
}
