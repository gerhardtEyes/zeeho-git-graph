import * as assert from "node:assert";
import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { simpleGit } from "simple-git";
import * as vscode from "vscode";

import {
  DiffDocProvider,
  EMPTY_DIFF_REVISION,
  encodeDiffDocUri,
  INDEX_DIFF_REVISION
} from "@/diffDocProvider";
import { openWorkingTreeFile } from "@/extension/openFile";

async function openView() {
  await vscode.commands.executeCommand("zeeho-git-graph.view");
  await new Promise((r) => setTimeout(r, 300));
}

suite("GitGraphView", () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension("Tamzeeho.zeeho-git-graph");
    await ext?.activate();
  });

  setup(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await new Promise((r) => setTimeout(r, 200));
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  });

  test("contributes a focus command for the sidebar view", async () => {
    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes("zeeho-git-graph.view.focus"));
  });

  test("registers inline blame and automatic diff toggle commands", async () => {
    const commands = await vscode.commands.getCommands(true);

    assert.ok(commands.includes("zeeho-git-graph.toggleInlineBlame"));
    assert.ok(commands.includes("zeeho-git-graph.toggleAutoOpenDirtyFileDiff"));
  });

  test("toggle commands update their settings", async () => {
    const configuration = vscode.workspace.getConfiguration("zeeho-git-graph");
    const inlineBefore = configuration.get<boolean>("inlineBlame.enabled", true);
    const autoDiffBefore = configuration.get<boolean>("autoOpenDirtyFileDiff", false);

    try {
      await vscode.commands.executeCommand("zeeho-git-graph.toggleInlineBlame");
      await vscode.commands.executeCommand("zeeho-git-graph.toggleAutoOpenDirtyFileDiff");

      const updated = vscode.workspace.getConfiguration("zeeho-git-graph");
      assert.strictEqual(updated.get("inlineBlame.enabled"), !inlineBefore);
      assert.strictEqual(updated.get("autoOpenDirtyFileDiff"), !autoDiffBefore);
    } finally {
      await configuration.update(
        "inlineBlame.enabled",
        inlineBefore,
        vscode.ConfigurationTarget.Global
      );
      await configuration.update(
        "autoOpenDirtyFileDiff",
        autoDiffBefore,
        vscode.ConfigurationTarget.Global
      );
    }
  });

  test("view command opens the sidebar without an editor tab", async () => {
    const tabsBefore = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;

    await openView();

    const tabsAfter = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;

    assert.strictEqual(tabsAfter, tabsBefore, "Sidebar view should not open an editor tab");
  });

  test("running view command again reuses the sidebar view", async () => {
    await openView();
    const tabsBefore = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;

    await openView();

    const tabsAfter = vscode.window.tabGroups.all.flatMap((g) => g.tabs).length;
    assert.strictEqual(tabsAfter, tabsBefore, "Second invocation should not open a new tab");
  });

  test("opens a real file after closing its matching diff", async () => {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspace, "Extension-host test workspace should exist");
    const file = vscode.Uri.joinPath(workspace.uri, "README.md");

    await vscode.commands.executeCommand("vscode.diff", file, file, "Temporary comparison", {
      preview: true
    });
    assert.ok(
      vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof vscode.TabInputTextDiff,
      "The test should start with a diff tab"
    );

    const opened = await openWorkingTreeFile(workspace.uri.fsPath, "README.md", "README.md");
    assert.strictEqual(opened, true);
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    assert.ok(input instanceof vscode.TabInputText, "The real file should replace the diff tab");
    assert.strictEqual(input.uri.fsPath, file.fsPath);
  });

  test("serves current index content and an explicit empty diff document", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "zeeho-index-diff-"));
    const run = (args: string[]) => cp.execFileSync("git", args, { cwd: repo, stdio: "pipe" });
    try {
      run(["init", "-b", "main"]);
      run(["config", "user.email", "test@example.com"]);
      run(["config", "user.name", "Test"]);
      fs.writeFileSync(path.join(repo, "sample.txt"), "original\n");
      run(["add", "."]);
      run(["commit", "-m", "initial"]);
      fs.writeFileSync(path.join(repo, "sample.txt"), "staged content\n");
      run(["add", "sample.txt"]);
      fs.writeFileSync(path.join(repo, "sample.txt"), "working content\n");

      const client = simpleGit(repo);
      const provider = new DiffDocProvider(() => client);
      try {
        const index = await provider.provideTextDocumentContent(
          encodeDiffDocUri(repo, "sample.txt", INDEX_DIFF_REVISION, "test-index")
        );
        const empty = await provider.provideTextDocumentContent(
          encodeDiffDocUri(repo, "sample.txt", EMPTY_DIFF_REVISION, "test-empty")
        );

        assert.strictEqual(index, "staged content\n");
        assert.strictEqual(empty, "");
      } finally {
        provider.dispose();
      }
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
