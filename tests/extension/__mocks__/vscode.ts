export const workspace = {
  getConfiguration: () => ({ get: (_key: string, def: unknown) => def }),
  fs: {
    stat: () => Promise.resolve({})
  },
  workspaceFolders: undefined,
  createFileSystemWatcher: () => ({
    onDidCreate: () => ({ dispose: () => {} }),
    dispose: () => {}
  }),
  onDidChangeWorkspaceFolders: () => ({ dispose: () => {} }),
  onDidChangeConfiguration: () => ({ dispose: () => {} })
};

export const commands = {
  executeCommand: () => Promise.resolve(undefined),
  registerCommand: () => ({ dispose: () => {} })
};

export const window = {
  showErrorMessage: () => Promise.resolve(undefined),
  tabGroups: {
    activeTabGroup: { activeTab: undefined as unknown },
    close: () => Promise.resolve(true)
  }
};

export const Uri = {
  file: (value: string) => ({ path: value.replace(/\\/g, "/"), fsPath: value }),
  joinPath: (base: { path: string; fsPath: string }, ...parts: string[]) => {
    const path = [base.path.replace(/\/$/, ""), ...parts].join("/");
    return { path, fsPath: path };
  }
};

export class TabInputTextDiff {
  constructor(
    public original: { path: string },
    public modified: { path: string }
  ) {}
}
