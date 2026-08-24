import * as path from "node:path";

import * as vscode from "vscode";

import { fileHasChanges } from "@/backend/queries/fileStatus";
import { Config } from "@/config";
import { encodeDiffDocUri } from "@/diffDocProvider";
import { EXTENSION_NAMESPACE } from "@/extension/constant/const";

import { findEditorGitContext } from "./editorGitContext";
import { logger } from "./utils/logger";

type AutoDiffControllerOptions = {
  config: Config;
  getRepoPaths: () => string[];
};

export function registerAutoDiffController(options: AutoDiffControllerOptions): vscode.Disposable {
  const { config, getRepoPaths } = options;
  const openedWhileDirty = new Set<string>();
  const subscriptions: vscode.Disposable[] = [];
  let request: AbortController | undefined;
  let generation = 0;

  async function inspect(editor: vscode.TextEditor | undefined, allowOpen: boolean) {
    const currentGeneration = ++generation;
    request?.abort();
    request = undefined;
    if (!config.autoOpenDirtyFileDiff() || editor?.document.uri.scheme !== "file") {
      return;
    }

    const document = editor.document;
    const key = document.uri.toString();
    const context = findEditorGitContext(document.uri.fsPath, getRepoPaths());
    if (context === null) {
      openedWhileDirty.delete(key);
      return;
    }

    const controller = new AbortController();
    request = controller;
    try {
      const changed =
        document.isDirty ||
        (await fileHasChanges({
          gitPath: config.gitPath(),
          relativePath: context.relativePath,
          repo: context.repo,
          signal: controller.signal
        }));
      if (controller.signal.aborted || currentGeneration !== generation) {
        return;
      }
      if (!changed) {
        openedWhileDirty.delete(key);
        return;
      }
      if (!allowOpen || openedWhileDirty.has(key)) {
        return;
      }

      openedWhileDirty.add(key);
      const title = vscode.l10n.t("{0} (HEAD ↔ Working Tree)", path.basename(document.uri.fsPath));
      await vscode.commands.executeCommand(
        "vscode.diff",
        encodeDiffDocUri(context.repo, context.relativePath, "HEAD"),
        document.uri,
        title,
        {
          preview: true,
          preserveFocus: false,
          viewColumn: editor.viewColumn
        }
      );
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        logger.log(`Unable to inspect file changes: ${error.message}`);
      }
    } finally {
      if (request === controller) {
        request = undefined;
      }
    }
  }

  subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => void inspect(editor, true)),
    vscode.workspace.onDidSaveTextDocument((document) => {
      const editor = vscode.window.activeTextEditor;
      if (editor?.document === document) {
        void inspect(editor, false);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`${EXTENSION_NAMESPACE}.autoOpenDirtyFileDiff`)) {
        openedWhileDirty.clear();
        void inspect(vscode.window.activeTextEditor, true);
      }
    })
  );

  void inspect(vscode.window.activeTextEditor, true);
  return {
    dispose() {
      generation++;
      request?.abort();
      openedWhileDirty.clear();
      for (const subscription of subscriptions) {
        subscription.dispose();
      }
    }
  };
}
