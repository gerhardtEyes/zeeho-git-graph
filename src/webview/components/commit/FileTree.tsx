import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { GitDiffScope, GitFileChange } from "@/backend/types";
import { Icon } from "@/webview/components/ui/Icons";
import { openFile, viewDiff } from "@/webview/lib/actions";
import { isCSharpFile, splitFilePath } from "@/webview/utils/filePresentation";
import type { FileTreeNode } from "@/webview/utils/fileTree";
import { buildFileTree } from "@/webview/utils/fileTree";

const ICON_CLASS = "mr-2 size-3.25 shrink-0 fill-fg opacity-60";
const ENTRY_CLASS = "flex w-full items-center overflow-hidden text-left whitespace-nowrap";
const SINGLE_CLICK_DELAY = 250;

const FILE_COLOUR: Record<GitFileChange["type"], string> = {
  A: "text-file-added",
  D: "text-file-deleted",
  M: "text-file-modified",
  R: "text-file-renamed",
  U: "text-file-deleted"
};

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <Icon class={ICON_CLASS} viewBox="0 0 30 30">
        <path d="M 5 4 C 3.895 4 3 4.895 3 6 L 3 9 L 3 11 L 22 11 L 27 11 L 27 8 C 27 6.895 26.105 6 25 6 L 12.199219 6 L 11.582031 4.9707031 C 11.221031 4.3687031 10.570187 4 9.8671875 4 L 5 4 z M 2.5019531 13 C 1.4929531 13 0.77040625 13.977406 1.0664062 14.941406 L 4.0351562 24.587891 C 4.2941563 25.426891 5.0692656 26 5.9472656 26 L 15 26 L 24.052734 26 C 24.930734 26 25.705844 25.426891 25.964844 24.587891 L 28.933594 14.941406 C 29.229594 13.977406 28.507047 13 27.498047 13 L 15 13 L 2.5019531 13 z" />
      </Icon>
    );
  }

  return (
    <Icon class={ICON_CLASS} viewBox="0 0 30 30">
      <path d="M 4 3 C 2.895 3 2 3.895 2 5 L 2 8 L 13 8 L 28 8 L 28 7 C 28 5.895 27.105 5 26 5 L 11.199219 5 L 10.582031 3.9707031 C 10.221031 3.3687031 9.5701875 3 8.8671875 3 L 4 3 z M 3 10 C 2.448 10 2 10.448 2 11 L 2 23 C 2 24.105 2.895 25 4 25 L 26 25 C 27.105 25 28 24.105 28 23 L 28 11 C 28 10.448 27.552 10 27 10 L 3 10 z" />
    </Icon>
  );
}

function FileIcon({ filePath }: { filePath: string }) {
  if (isCSharpFile(filePath)) {
    return (
      <span
        class="mr-2 flex h-3.5 w-4.5 shrink-0 items-center justify-center rounded-xs border border-file-modified/60 bg-file-modified/15 text-[8px] leading-none font-bold tracking-tight text-file-modified"
        aria-hidden="true"
      >
        CS
      </span>
    );
  }

  return (
    <Icon class={ICON_CLASS} viewBox="0 0 30 30">
      <path d="M24.707,8.793l-6.5-6.5C18.019,2.105,17.765,2,17.5,2H7C5.895,2,5,2.895,5,4v22c0,1.105,0.895,2,2,2h16c1.105,0,2-0.895,2-2 V9.5C25,9.235,24.895,8.981,24.707,8.793z M18,10c-0.552,0-1-0.448-1-1V3.904L23.096,10H18z" />
    </Icon>
  );
}

/** Lines added and removed, which git only counts for a text file. */
function FileAddDel({ file }: { file: GitFileChange }) {
  if (file.additions === null || file.deletions === null) {
    return null;
  }

  const additions = file.additions;
  const deletions = file.deletions;

  return (
    <span class="git-file-add-del ml-2 shrink-0 text-fg">
      (
      <span
        class="cursor-help px-0.75 text-git-added"
        title={(additions === 1
          ? window.l10n.tooltipAddition
          : window.l10n.tooltipAdditions
        ).replace("{0}", String(additions))}
      >
        +{additions}
      </span>
      |
      <span
        class="cursor-help px-0.75 text-git-deleted"
        title={(deletions === 1
          ? window.l10n.tooltipDeletion
          : window.l10n.tooltipDeletions
        ).replace("{0}", String(deletions))}
      >
        -{deletions}
      </span>
      )
    </span>
  );
}

export function FileEntry({
  name,
  file,
  commitHash,
  fullPath = false,
  scope = commitHash === "*" ? "working" : "commit",
  selected = false,
  draggable = false,
  onSelect,
  onContextMenu,
  onDragStart
}: {
  name: string;
  file: GitFileChange;
  commitHash: string;
  fullPath?: boolean;
  scope?: GitDiffScope;
  selected?: boolean;
  draggable?: boolean;
  onSelect?: (event: MouseEvent) => void;
  onContextMenu?: (event: MouseEvent) => void;
  onDragStart?: (event: DragEvent) => void;
}) {
  const binary = file.type !== "U" && (file.additions === null || file.deletions === null);
  const showAddDel = file.type !== "A" && file.type !== "D";
  const pathParts = splitFilePath(name);
  const pendingClick = useRef<number | null>(null);

  function cancelPendingClick() {
    if (pendingClick.current !== null) {
      window.clearTimeout(pendingClick.current);
      pendingClick.current = null;
    }
  }

  useEffect(() => cancelPendingClick, []);

  return (
    <button
      type="button"
      class={`${ENTRY_CLASS} ${fullPath ? "text-fg" : FILE_COLOUR[file.type]} ${
        fullPath ? "items-start py-0.5 whitespace-normal" : ""
      } cursor-pointer rounded-sm ${selected ? "bg-row-selected" : ""}`}
      aria-selected={selected}
      draggable={draggable}
      title={`${name}\n${
        binary
          ? `${window.l10n.tooltipBinaryFile}\n${window.l10n.tooltipOpenFile}`
          : window.l10n.tooltipFileInteraction
      }`}
      onClick={(event) => {
        onSelect?.(event);
        if (binary || event.detail > 1) {
          return;
        }
        cancelPendingClick();
        pendingClick.current = window.setTimeout(() => {
          pendingClick.current = null;
          viewDiff(commitHash, file, scope);
        }, SINGLE_CLICK_DELAY);
      }}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDblClick={(event) => {
        event.preventDefault();
        cancelPendingClick();
        openFile(file);
      }}
    >
      <FileIcon filePath={name} />
      {fullPath ? (
        <span class="min-w-0 grow break-all leading-4 whitespace-normal">
          <span class="text-fg">{pathParts.directory}</span>
          <span class={FILE_COLOUR[file.type]}>{pathParts.fileName}</span>
        </span>
      ) : (
        <span class="truncate">{name}</span>
      )}
      {fullPath && (
        <span class={`ml-2 shrink-0 font-mono font-semibold ${FILE_COLOUR[file.type]}`}>
          {file.type}
        </span>
      )}
      {!fullPath && file.type === "R" && (
        <span
          class="ml-2 cursor-help text-fg"
          title={window.l10n.tooltipRenamedTo
            .replace("{0}", file.oldFilePath)
            .replace("{1}", file.newFilePath)}
        >
          R
        </span>
      )}
      {showAddDel && <FileAddDel file={file} />}
    </button>
  );
}

/** Compact flat list used by the narrow commit-details pane. */
export function ChangedFileList({
  files,
  commitHash,
  viewMode = "flat"
}: {
  files: Array<GitFileChange>;
  commitHash: string;
  viewMode?: "flat" | "tree";
}) {
  return (
    <ChangedFileCollection
      files={files}
      viewMode={viewMode}
      commitHash={commitHash}
      renderFile={(file, name, fullPath) => (
        <FileEntry name={name} file={file} commitHash={commitHash} fullPath={fullPath} />
      )}
    />
  );
}

export type ChangedFileRenderer = (
  file: GitFileChange,
  name: string,
  fullPath: boolean
) => ComponentChildren;

type TreeProps = {
  nodes: Array<FileTreeNode>;
  commitHash: string;
  closed: ReadonlySet<string>;
  onToggle: (path: string) => void;
  renderFile?: ChangedFileRenderer;
  root?: boolean;
};

function Tree({ nodes, commitHash, closed, onToggle, renderFile, root = false }: TreeProps) {
  return (
    <ul class={`list-none ${root ? "pl-2.5" : "pl-7.5"}`}>
      {nodes.map((node) => {
        if (node.type === "file") {
          return (
            <li key={node.file.newFilePath} class="mt-1 overflow-hidden">
              {renderFile === undefined ? (
                <FileEntry name={node.name} file={node.file} commitHash={commitHash} />
              ) : (
                renderFile(node.file, node.name, false)
              )}
            </li>
          );
        }

        const open = !closed.has(node.path);

        return (
          <li key={node.path} class="mt-1 overflow-hidden">
            <button
              type="button"
              class={`${ENTRY_CLASS} cursor-pointer`}
              aria-expanded={open}
              onClick={() => onToggle(node.path)}
            >
              <FolderIcon open={open} />
              <span class="truncate">{node.name}</span>
            </button>
            {open && (
              <Tree
                nodes={node.children}
                commitHash={commitHash}
                closed={closed}
                onToggle={onToggle}
                renderFile={renderFile}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** A flat or folder-tree presentation with caller-owned file interactions. */
export function ChangedFileCollection({
  files,
  viewMode,
  commitHash,
  renderFile
}: {
  files: Array<GitFileChange>;
  viewMode: "flat" | "tree";
  commitHash: string;
  renderFile: ChangedFileRenderer;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const nodes = useMemo(() => buildFileTree(files), [files]);

  function toggle(path: string) {
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(path)) {
        next.add(path);
      }
      return next;
    });
  }

  if (viewMode === "flat") {
    return (
      <ul class="list-none px-1.5 py-1">
        {files.map((file) => (
          <li
            key={`${file.oldFilePath}-${file.newFilePath}`}
            class="rounded px-1.5 py-0.5 hover:bg-btn-hover"
          >
            {renderFile(file, file.newFilePath, true)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Tree
      nodes={nodes}
      commitHash={commitHash}
      closed={closed}
      onToggle={toggle}
      renderFile={renderFile}
      root
    />
  );
}

/** The files a commit changed, as a folder tree. Folders open by default. */
export function FileTree({
  nodes,
  commitHash
}: {
  nodes: Array<FileTreeNode>;
  commitHash: string;
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());

  function toggle(path: string) {
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(path)) {
        next.add(path);
      }
      return next;
    });
  }

  return <Tree nodes={nodes} commitHash={commitHash} closed={closed} onToggle={toggle} root />;
}
