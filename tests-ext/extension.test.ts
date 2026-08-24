import * as assert from "node:assert";

import * as vscode from "vscode";

async function openView() {
  await vscode.commands.executeCommand("zeeho-git-graph.view");
  await new Promise((r) => setTimeout(r, 300));
}

suite("GitGraphView", () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension("TanZiHao.zeeho-git-graph");
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
});
