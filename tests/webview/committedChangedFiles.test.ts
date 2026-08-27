// @vitest-environment jsdom

import { h, render } from "preact";
import { act } from "preact/test-utils";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { GitCommitDetails } from "@/backend/types";
import type { GitGraphViewState } from "@/types";
import type { CommitDetails as CommitDetailsType } from "@/webview/components/commit/CommitDetails";

let CommitDetails: typeof CommitDetailsType;
let changedFilesTypeFilter: typeof import("@/webview/lib/stores").changedFilesTypeFilter;
let changedFilesViewMode: typeof import("@/webview/lib/stores").changedFilesViewMode;

const details: GitCommitDetails = {
  hash: "1234567890abcdef",
  parents: [],
  author: "Zeeho",
  email: "zeeho@example.com",
  date: 1_700_000_000_000,
  committer: "Zeeho",
  body: "Add file presentation controls",
  fileChanges: [
    {
      oldFilePath: "src/game/Player.cs",
      newFilePath: "src/game/Player.cs",
      type: "M",
      additions: 2,
      deletions: 1
    },
    {
      oldFilePath: "web/main.ts",
      newFilePath: "web/main.ts",
      type: "M",
      additions: 1,
      deletions: 0
    }
  ]
};

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
            : key === "filteredFileCount"
              ? "{0}/{1}"
              : String(key)
      }
    ) as typeof window.l10n
  });

  ({ CommitDetails } = await import("@/webview/components/commit/CommitDetails"));
  ({ changedFilesTypeFilter, changedFilesViewMode } = await import("@/webview/lib/stores"));
});

beforeEach(() => {
  changedFilesTypeFilter.value = "*";
  changedFilesViewMode.value = "flat";
  document.body.replaceChildren();
});

describe("committed changed files", () => {
  it("switches a historical commit between flat and tree views", () => {
    const container = document.createElement("div");
    document.body.append(container);
    act(() => render(h(CommitDetails, { details }), container));

    expect(container.querySelector('button[title^="src/game/Player.cs"]')).not.toBeNull();
    const treeView = container.querySelector<HTMLButtonElement>('button[title="switchToTreeView"]');
    act(() => treeView!.click());

    expect(container.querySelector('button[title^="Player.cs"]')).not.toBeNull();
    expect(
      [...container.querySelectorAll<HTMLButtonElement>('button[aria-expanded="true"]')].some(
        (button) => button.textContent?.includes("src")
      )
    ).toBe(true);
  });

  it("applies the one-click C# filter to a historical commit", () => {
    const container = document.createElement("div");
    document.body.append(container);
    act(() => render(h(CommitDetails, { details }), container));

    const csharpFilter = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "CS"
    );
    act(() => csharpFilter!.click());

    expect(container.querySelector('button[title^="src/game/Player.cs"]')).not.toBeNull();
    expect(container.querySelector('button[title^="web/main.ts"]')).toBeNull();
    expect(container.textContent).toContain("1/2");
  });
});
