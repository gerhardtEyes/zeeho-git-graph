import * as vscode from "vscode";

function repoFileUri(repo: string, filePath: string) {
  return vscode.Uri.joinPath(vscode.Uri.file(repo), ...filePath.split("/"));
}

async function existingRepoFileUri(repo: string, filePath: string) {
  const candidate = repoFileUri(repo, filePath);
  try {
    await vscode.workspace.fs.stat(candidate);
    return candidate;
  } catch {
    return null;
  }
}

function matchesFilePath(uri: vscode.Uri, filePath: string) {
  const normalizedPath = "/" + filePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return uri.path.replace(/\\/g, "/").endsWith(normalizedPath);
}

function activeDiffMatches(oldFilePath: string, newFilePath: string) {
  const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (!(activeTab?.input instanceof vscode.TabInputTextDiff)) {
    return false;
  }

  return [activeTab.input.original, activeTab.input.modified].some(
    (uri) => matchesFilePath(uri, oldFilePath) || matchesFilePath(uri, newFilePath)
  );
}

/** Close this file's active diff, then open the real file from the working tree. */
export async function openWorkingTreeFile(repo: string, oldFilePath: string, newFilePath: string) {
  try {
    const newFile = await existingRepoFileUri(repo, newFilePath);
    // Renamed files can have only one of the two paths in the working tree.
    const target =
      newFile ??
      (oldFilePath === newFilePath ? null : await existingRepoFileUri(repo, oldFilePath));

    if (target === null) {
      return false;
    }

    const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (activeTab !== undefined && activeDiffMatches(oldFilePath, newFilePath)) {
      await vscode.window.tabGroups.close(activeTab);
    }

    await vscode.commands.executeCommand("vscode.open", target, { preview: true });
    return true;
  } catch {
    return false;
  }
}
