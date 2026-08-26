import { afterEach, describe, expect, it, vi } from "vitest";
import * as vscode from "vscode";

import { openWorkingTreeFile } from "@/extension/openFile";

const activeTabGroup = vscode.window.tabGroups.activeTabGroup as {
  activeTab: vscode.Tab | undefined;
};

afterEach(() => {
  activeTabGroup.activeTab = undefined;
  vi.restoreAllMocks();
});

describe("openWorkingTreeFile", () => {
  it("closes the matching diff and opens the real file", async () => {
    const diff = new vscode.TabInputTextDiff(
      vscode.Uri.file("/repo/src/file.ts"),
      vscode.Uri.file("/repo/src/file.ts")
    );
    const tab = { input: diff } as vscode.Tab;
    activeTabGroup.activeTab = tab;
    const close = vi.spyOn(vscode.window.tabGroups, "close");
    const execute = vi.spyOn(vscode.commands, "executeCommand");

    await expect(openWorkingTreeFile("/repo", "src/file.ts", "src/file.ts")).resolves.toBe(true);
    expect(close).toHaveBeenCalledWith(tab);
    expect(execute).toHaveBeenCalledWith(
      "vscode.open",
      expect.objectContaining({ path: "/repo/src/file.ts" }),
      { preview: true }
    );
  });

  it("falls back to the old path of a renamed file", async () => {
    vi.spyOn(vscode.workspace.fs, "stat")
      .mockRejectedValueOnce(new Error("missing new path"))
      .mockResolvedValueOnce({} as vscode.FileStat);
    const execute = vi.spyOn(vscode.commands, "executeCommand");

    await expect(openWorkingTreeFile("/repo", "old.ts", "new.ts")).resolves.toBe(true);
    expect(execute).toHaveBeenCalledWith(
      "vscode.open",
      expect.objectContaining({ path: "/repo/old.ts" }),
      { preview: true }
    );
  });

  it("does not close an unrelated diff", async () => {
    const diff = new vscode.TabInputTextDiff(
      vscode.Uri.file("/repo/other.ts"),
      vscode.Uri.file("/repo/other.ts")
    );
    activeTabGroup.activeTab = { input: diff } as vscode.Tab;
    const close = vi.spyOn(vscode.window.tabGroups, "close");

    await expect(openWorkingTreeFile("/repo", "src/file.ts", "src/file.ts")).resolves.toBe(true);
    expect(close).not.toHaveBeenCalled();
  });

  it("keeps the diff open when the working-tree file no longer exists", async () => {
    vi.spyOn(vscode.workspace.fs, "stat").mockRejectedValue(new Error("missing"));
    const diff = new vscode.TabInputTextDiff(
      vscode.Uri.file("/repo/deleted.ts"),
      vscode.Uri.file("/repo/deleted.ts")
    );
    activeTabGroup.activeTab = { input: diff } as vscode.Tab;
    const close = vi.spyOn(vscode.window.tabGroups, "close");
    const execute = vi.spyOn(vscode.commands, "executeCommand");

    await expect(openWorkingTreeFile("/repo", "deleted.ts", "deleted.ts")).resolves.toBe(false);
    expect(close).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
