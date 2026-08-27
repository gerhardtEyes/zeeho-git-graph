// @vitest-environment jsdom

import { h, render } from "preact";
import { act } from "preact/test-utils";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { GitFileChange } from "@/backend/types";
import type { GitGraphViewState } from "@/types";
import type { WorkingTreeChanges as WorkingTreeChangesType } from "@/webview/components/commit/WorkingTreeChanges";

let WorkingTreeChanges: typeof WorkingTreeChangesType;
let actionRequest: typeof import("@/webview/lib/stores").actionRequest;
let changedFilesTypeFilter: typeof import("@/webview/lib/stores").changedFilesTypeFilter;
let changedFilesViewMode: typeof import("@/webview/lib/stores").changedFilesViewMode;
let contextMenu: typeof import("@/webview/lib/stores").contextMenu;
let selectedRepo: typeof import("@/webview/lib/stores").selectedRepo;

const modified: GitFileChange = {
  oldFilePath: "src/changed.cs",
  newFilePath: "src/changed.cs",
  type: "M",
  additions: 2,
  deletions: 1
};

class TestDataTransfer {
  private readonly values = new Map<string, string>();
  effectAllowed = "none";
  dropEffect = "none";

  get types() {
    return [...this.values.keys()];
  }

  setData(type: string, value: string) {
    this.values.set(type, value);
  }

  getData(type: string) {
    return this.values.get(type) ?? "";
  }
}

function dragEvent(type: string, transfer: TestDataTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "dataTransfer", { value: transfer });
  return event;
}

beforeAll(async () => {
  (globalThis as typeof globalThis & { viewState: GitGraphViewState }).viewState = {
    autoCenterCommitDetailsView: true,
    dateFormat: "Relative",
    fetchAvatars: false,
    graphColours: [],
    graphStyle: "rounded",
    initialLoadCommits: 300,
    lastActiveRepo: null,
    loadMoreCommits: 100,
    locale: "en",
    repos: { "/repo": { columnWidths: null } },
    showCurrentBranchByDefault: false
  };
  globalThis.acquireVsCodeApi = () => ({
    postMessage: () => {},
    getState: () => undefined,
    setState: () => {}
  });
  Object.defineProperty(window, "l10n", {
    configurable: true,
    value: new Proxy(
      {},
      {
        get: (_target, key) =>
          key === "changedFiles"
            ? "Changes ({0})"
            : key === "stagedChanges"
              ? "Staged Changes ({0})"
              : key === "unstagedChanges"
                ? "Unstaged Changes ({0})"
                : key === "filteredFileCount"
                  ? "{0}/{1}"
                  : String(key)
      }
    ) as typeof window.l10n
  });

  ({ WorkingTreeChanges } = await import("@/webview/components/commit/WorkingTreeChanges"));
  ({ actionRequest, changedFilesTypeFilter, changedFilesViewMode, contextMenu, selectedRepo } =
    await import("@/webview/lib/stores"));
});

beforeEach(() => {
  actionRequest.value = null;
  changedFilesTypeFilter.value = "*";
  changedFilesViewMode.value = "flat";
  contextMenu.value = null;
  selectedRepo.value = "/repo";
  document.body.replaceChildren();
});

describe("WorkingTreeChanges", () => {
  it("stages all unstaged files from the compact section action", () => {
    const container = document.createElement("div");
    document.body.append(container);
    act(() =>
      render(h(WorkingTreeChanges, { stagedFiles: [], unstagedFiles: [modified] }), container)
    );

    const stageAll = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "stageAll"
    );
    expect(stageAll).toBeDefined();
    act(() => stageAll!.click());

    expect(actionRequest.value?.action).toEqual({ command: "stageAll", repo: "/repo" });
  });

  it("stages a dragged file when it is dropped on the index pane", () => {
    const container = document.createElement("div");
    document.body.append(container);
    act(() =>
      render(h(WorkingTreeChanges, { stagedFiles: [], unstagedFiles: [modified] }), container)
    );

    const file = container.querySelector<HTMLButtonElement>('button[title^="src/changed.cs"]');
    const indexPane = container.querySelector("section");
    expect(file).not.toBeNull();
    expect(indexPane).not.toBeNull();

    const transfer = new TestDataTransfer();
    act(() => {
      file!.dispatchEvent(dragEvent("dragstart", transfer));
    });
    act(() => {
      indexPane!.dispatchEvent(dragEvent("drop", transfer));
    });

    expect(actionRequest.value?.action).toEqual({
      command: "stageFiles",
      paths: ["src/changed.cs"],
      repo: "/repo"
    });
  });

  it("offers staging from the file context menu", () => {
    const container = document.createElement("div");
    document.body.append(container);
    act(() =>
      render(h(WorkingTreeChanges, { stagedFiles: [], unstagedFiles: [modified] }), container)
    );

    const file = container.querySelector<HTMLButtonElement>('button[title^="src/changed.cs"]');
    expect(file).not.toBeNull();
    act(() => {
      file!.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 })
      );
    });

    const entry = contextMenu.value?.entries[0];
    expect(entry).not.toBeNull();
    act(() => {
      if (entry) {
        entry.onClick();
      }
    });
    expect(actionRequest.value?.action).toEqual({
      command: "stageFiles",
      paths: ["src/changed.cs"],
      repo: "/repo"
    });
  });

  it("filters both working-copy panes to C# with one click", () => {
    const typescript = {
      ...modified,
      oldFilePath: "src/changed.ts",
      newFilePath: "src/changed.ts"
    };
    const container = document.createElement("div");
    document.body.append(container);
    act(() =>
      render(
        h(WorkingTreeChanges, {
          stagedFiles: [typescript],
          unstagedFiles: [modified, typescript]
        }),
        container
      )
    );

    const csharpFilter = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "CS"
    );
    expect(csharpFilter).toBeDefined();
    act(() => csharpFilter!.click());

    expect(container.querySelector('button[title^="src/changed.cs"]')).not.toBeNull();
    expect(container.querySelector('button[title^="src/changed.ts"]')).toBeNull();
    expect(container.textContent).toContain("1/2");
  });

  it("keeps staging interactions available in tree view", () => {
    const container = document.createElement("div");
    document.body.append(container);
    act(() =>
      render(h(WorkingTreeChanges, { stagedFiles: [], unstagedFiles: [modified] }), container)
    );

    const treeView = container.querySelector<HTMLButtonElement>('button[title="switchToTreeView"]');
    expect(treeView).not.toBeNull();
    act(() => treeView!.click());

    const folder = [
      ...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded="true"]')
    ].find((button) => button.textContent?.includes("src"));
    const file = container.querySelector<HTMLButtonElement>('button[title^="changed.cs"]');
    expect(folder).toBeDefined();
    expect(file).not.toBeNull();

    act(() => {
      file!.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, clientX: 20, clientY: 30 })
      );
    });
    expect(contextMenu.value?.entries[0]).not.toBeNull();
  });
});
