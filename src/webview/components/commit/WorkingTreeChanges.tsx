import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { GitFileChange, GitPullStrategy } from "@/backend/types";
import { FileEntry } from "@/webview/components/commit/FileTree";
import { Button } from "@/webview/components/ui/Button";
import {
  openContextMenu,
  openFormDialog,
  openRunningDialog,
  runAction
} from "@/webview/lib/actions";
import { actionResult, branchList, headBranch } from "@/webview/lib/stores";
import type { ContextMenuEntry } from "@/webview/types";
import { format } from "@/webview/utils/format";

const DRAG_MIME = "application/x-zeeho-git-files";
type ChangeArea = "staged" | "unstaged";

function fileKey(file: GitFileChange) {
  return `${file.oldFilePath}\0${file.newFilePath}`;
}

function pathsFor(files: GitFileChange[]) {
  return [
    ...new Set(files.flatMap((file) => [file.oldFilePath, file.newFilePath]).filter(Boolean))
  ];
}

function selectedFiles(
  files: GitFileChange[],
  selection: ReadonlySet<string>,
  fallback: GitFileChange
) {
  if (!selection.has(fileKey(fallback))) {
    return [fallback];
  }
  return files.filter((file) => selection.has(fileKey(file)));
}

function runFileAction(area: ChangeArea, files: GitFileChange[]) {
  const paths = pathsFor(files);
  if (area === "unstaged") {
    runAction({ command: "stageFiles", paths });
  } else {
    runAction({ command: "unstageFiles", paths });
  }
}

function fileMenu(area: ChangeArea, files: GitFileChange[]): Array<ContextMenuEntry> {
  return [
    {
      title:
        area === "unstaged"
          ? window.l10n.stageSelected.replace("{0}", String(files.length))
          : window.l10n.unstageSelected.replace("{0}", String(files.length)),
      onClick: () => runFileAction(area, files)
    }
  ];
}

function ChangeSection({
  area,
  files,
  selection,
  onSelectionChange
}: {
  area: ChangeArea;
  files: GitFileChange[];
  selection: ReadonlySet<string>;
  onSelectionChange: (selection: ReadonlySet<string>) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const lastSelected = useRef<string | null>(null);
  const staged = area === "staged";

  useEffect(() => {
    const available = new Set(files.map(fileKey));
    const next = new Set([...selection].filter((key) => available.has(key)));
    if (next.size !== selection.size) {
      onSelectionChange(next);
    }
  }, [files, onSelectionChange, selection]);

  function choose(file: GitFileChange, event: MouseEvent) {
    const key = fileKey(file);
    if (event.shiftKey && lastSelected.current !== null) {
      const start = files.findIndex((candidate) => fileKey(candidate) === lastSelected.current);
      const end = files.findIndex((candidate) => fileKey(candidate) === key);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        onSelectionChange(new Set(files.slice(from, to + 1).map(fileKey)));
        return;
      }
    }

    lastSelected.current = key;
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selection);
      if (!next.delete(key)) {
        next.add(key);
      }
      onSelectionChange(next);
      return;
    }
    onSelectionChange(new Set([key]));
  }

  function startDrag(file: GitFileChange, event: DragEvent) {
    const dragged = selectedFiles(files, selection, file);
    if (!selection.has(fileKey(file))) {
      onSelectionChange(new Set([fileKey(file)]));
    }
    event.dataTransfer?.setData(DRAG_MIME, JSON.stringify({ area, paths: pathsFor(dragged) }));
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    try {
      const data = JSON.parse(event.dataTransfer?.getData(DRAG_MIME) ?? "") as {
        area?: ChangeArea;
        paths?: unknown;
      };
      if (
        data.area === area ||
        !Array.isArray(data.paths) ||
        !data.paths.every((path) => typeof path === "string")
      ) {
        return;
      }
      runAction({ command: staged ? "stageFiles" : "unstageFiles", paths: data.paths });
    } catch {
      // Ignore external drags and malformed data.
    }
  }

  return (
    <section
      class={`flex min-h-20 min-w-0 flex-1 flex-col overflow-hidden border border-line-soft ${
        dragOver ? "outline-1 outline-focus -outline-offset-1" : ""
      }`}
      onDragEnter={(event) => {
        if (event.dataTransfer?.types.includes(DRAG_MIME)) {
          setDragOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragOver(false);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer?.types.includes(DRAG_MIME)) {
          event.preventDefault();
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
          }
        }
      }}
      onDrop={drop}
    >
      <header class="flex min-h-7 shrink-0 items-center gap-2 bg-btn px-2 py-0.5 text-xs font-semibold">
        <span class="min-w-0 grow truncate">
          {format(staged ? window.l10n.stagedChanges : window.l10n.unstagedChanges, files.length)}
        </span>
        <button
          type="button"
          class="shrink-0 cursor-pointer rounded-sm px-1.5 py-0.5 text-[11px] text-fg hover:bg-btn-hover disabled:cursor-not-allowed disabled:opacity-40"
          disabled={files.length === 0}
          onClick={() => {
            if (staged) {
              runAction({ command: "unstageAll" });
            } else {
              runAction({ command: "stageAll" });
            }
          }}
        >
          {staged ? window.l10n.unstageAll : window.l10n.stageAll}
        </button>
      </header>
      <div class="git-graph-details-files min-h-0 grow overflow-auto border-t border-line-soft">
        {files.length === 0 ? (
          <div class="flex h-full min-h-12 items-center justify-center px-3 text-center text-xs text-muted">
            {staged ? window.l10n.dropFilesToStage : window.l10n.noUnstagedChanges}
          </div>
        ) : (
          <ul class="list-none px-1.5 py-1">
            {files.map((file) => {
              const key = fileKey(file);
              return (
                <li key={key} class="rounded px-1 py-0.5 hover:bg-btn-hover">
                  <FileEntry
                    name={file.newFilePath}
                    file={file}
                    commitHash="*"
                    scope={area}
                    fullPath
                    selected={selection.has(key)}
                    draggable
                    onSelect={(event) => choose(file, event)}
                    onDragStart={(event) => startDrag(file, event)}
                    onContextMenu={(event) => {
                      const chosen = selectedFiles(files, selection, file);
                      if (!selection.has(key)) {
                        onSelectionChange(new Set([key]));
                      }
                      openContextMenu(event, `working:${area}:${key}`, fileMenu(area, chosen));
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function confirmPush() {
  openFormDialog({
    message: window.l10n.dialogPushCurrentBranchConfirm,
    inputs: [],
    action: window.l10n.push,
    source: null,
    onSubmit: () => {
      runAction({ command: "pushCurrentBranch" });
      openRunningDialog(window.l10n.pushingCurrentBranch);
    }
  });
}

function confirmPull() {
  openFormDialog({
    message: window.l10n.dialogPullCurrentBranchConfirm,
    inputs: [
      {
        kind: "select",
        label: window.l10n.pullStrategy,
        value: "ff-only",
        options: [
          { label: window.l10n.pullFastForwardOnly, value: "ff-only" },
          { label: window.l10n.pullMerge, value: "merge" },
          { label: window.l10n.pullRebase, value: "rebase" }
        ]
      }
    ],
    action: window.l10n.pull,
    source: null,
    onSubmit: ([strategy]) => {
      runAction({ command: "pullCurrentBranch", strategy: strategy as GitPullStrategy });
      openRunningDialog(window.l10n.pullingCurrentBranch);
    }
  });
}

function GitOperations() {
  const targets = useMemo(
    () => (branchList.value ?? []).filter((branch) => branch !== headBranch.value),
    [branchList.value, headBranch.value]
  );
  const targetOptions = targets.map((branch) => ({ label: branch, value: branch }));
  const compactButton = "rounded-sm px-2 py-0.5 text-xs font-normal";

  function confirmMerge() {
    if (targetOptions.length === 0) {
      return;
    }
    openFormDialog({
      message: window.l10n.dialogMergeSelectedBranchConfirm,
      inputs: [
        {
          kind: "select",
          label: window.l10n.branch,
          value: targetOptions[0].value,
          options: targetOptions
        },
        { kind: "checkbox", label: window.l10n.dialogMergeNoFastForward, value: false }
      ],
      action: window.l10n.mergeShort,
      source: null,
      onSubmit: ([branchName, createNewCommit]) => {
        runAction({ command: "mergeBranch", branchName, createNewCommit });
        openRunningDialog(window.l10n.mergingBranch);
      }
    });
  }

  function confirmRebase() {
    if (targetOptions.length === 0) {
      return;
    }
    openFormDialog({
      message: window.l10n.dialogRebaseSelectedBranchConfirm,
      inputs: [
        {
          kind: "select",
          label: window.l10n.branch,
          value: targetOptions[0].value,
          options: targetOptions
        }
      ],
      action: window.l10n.rebase,
      source: null,
      onSubmit: ([branchName]) => {
        runAction({ command: "rebaseBranch", branchName });
        openRunningDialog(window.l10n.rebasingBranch);
      }
    });
  }

  return (
    <div class="flex shrink-0 flex-wrap gap-1 border-b border-line-soft px-2 py-1">
      <Button class={compactButton} onClick={confirmPull}>
        {window.l10n.pull}
      </Button>
      <Button class={compactButton} onClick={confirmPush}>
        {window.l10n.push}
      </Button>
      <Button class={compactButton} disabled={targets.length === 0} onClick={confirmMerge}>
        {window.l10n.mergeShort}
      </Button>
      <Button class={compactButton} disabled={targets.length === 0} onClick={confirmRebase}>
        {window.l10n.rebase}
      </Button>
    </div>
  );
}

export function WorkingTreeChanges({
  stagedFiles,
  unstagedFiles
}: {
  stagedFiles: GitFileChange[];
  unstagedFiles: GitFileChange[];
}) {
  const [stagedSelection, setStagedSelection] = useState<ReadonlySet<string>>(() => new Set());
  const [unstagedSelection, setUnstagedSelection] = useState<ReadonlySet<string>>(() => new Set());
  const [message, setMessage] = useState("");
  const completedAction = actionResult.value;

  useEffect(() => {
    if (completedAction?.command === "commitChanges" && completedAction.status === null) {
      setMessage("");
    }
  }, [completedAction]);

  function commit() {
    const trimmed = message.trim();
    if (trimmed === "" || stagedFiles.length === 0) {
      return;
    }
    runAction({ command: "commitChanges", message: trimmed });
    openRunningDialog(window.l10n.committingChanges);
  }

  return (
    <div class="flex h-full min-h-0 w-full min-w-0 grow flex-col overflow-hidden">
      <GitOperations />
      <div class="flex min-h-0 grow flex-col gap-1.5 overflow-hidden p-1.5">
        <ChangeSection
          area="staged"
          files={stagedFiles}
          selection={stagedSelection}
          onSelectionChange={setStagedSelection}
        />
        <ChangeSection
          area="unstaged"
          files={unstagedFiles}
          selection={unstagedSelection}
          onSelectionChange={setUnstagedSelection}
        />
      </div>
      <div class="flex shrink-0 items-end gap-1.5 border-t border-line-soft bg-btn p-1.5">
        <textarea
          class="min-h-12 min-w-0 grow resize-y rounded-sm bg-input px-2 py-1 text-xs text-input-fg outline-1 outline-line focus:outline-focus"
          rows={2}
          value={message}
          placeholder={window.l10n.commitMessagePlaceholder}
          onInput={(event) => setMessage(event.currentTarget.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
        />
        <Button
          class="shrink-0 rounded-sm px-2 py-1 text-xs"
          disabled={message.trim() === "" || stagedFiles.length === 0}
          title={window.l10n.commitShortcut}
          onClick={commit}
        >
          {window.l10n.commitChanges}
        </Button>
      </div>
    </div>
  );
}
