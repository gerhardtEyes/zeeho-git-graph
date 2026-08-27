import type { GitFileChange } from "@/backend/types";
import { changedFilesTypeFilter, changedFilesViewMode } from "@/webview/lib/stores";
import { ALL_FILE_TYPES, fileTypeOptions, NO_FILE_EXTENSION } from "@/webview/utils/fileFilter";
import { format } from "@/webview/utils/format";

function typeLabel(extension: string) {
  if (extension === NO_FILE_EXTENSION) {
    return window.l10n.noFileExtension;
  }
  return extension === ".cs" ? "CS (.cs)" : extension.toLocaleUpperCase();
}

export function ChangedFilesToolbar({
  files,
  visibleCount,
  label
}: {
  files: ReadonlyArray<GitFileChange>;
  visibleCount: number;
  label: string;
}) {
  const mode = changedFilesViewMode.value;
  const filter = changedFilesTypeFilter.value;
  const options = fileTypeOptions(files);
  if (filter !== ALL_FILE_TYPES && !options.includes(filter)) {
    options.unshift(filter);
  }

  const count =
    filter === ALL_FILE_TYPES
      ? String(files.length)
      : format(window.l10n.filteredFileCount, visibleCount, files.length);

  return (
    <div class="flex min-h-7 shrink-0 flex-wrap items-center gap-1 border-b border-line-soft bg-btn px-2 py-0.5 text-xs">
      <span class="mr-auto min-w-14 truncate font-semibold text-muted uppercase">
        {format(label, count)}
      </span>
      <button
        type="button"
        class="shrink-0 cursor-pointer rounded-sm border border-line-soft px-1.5 py-0.5 text-[11px] hover:bg-btn-hover"
        title={mode === "flat" ? window.l10n.switchToTreeView : window.l10n.switchToFlatView}
        aria-pressed={mode === "tree"}
        onClick={() => {
          changedFilesViewMode.value = mode === "flat" ? "tree" : "flat";
        }}
      >
        {mode === "flat" ? window.l10n.flatView : window.l10n.treeView}
      </button>
      <button
        type="button"
        class={`shrink-0 cursor-pointer rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold ${
          filter === ".cs"
            ? "border-focus bg-row-selected text-file-modified"
            : "border-line-soft hover:bg-btn-hover"
        }`}
        title={window.l10n.showOnlyCSharpFiles}
        aria-pressed={filter === ".cs"}
        onClick={() => {
          changedFilesTypeFilter.value = filter === ".cs" ? ALL_FILE_TYPES : ".cs";
        }}
      >
        CS
      </button>
      <select
        class="max-w-24 min-w-0 cursor-pointer rounded-sm border border-line-soft bg-input px-1 py-0.5 text-[11px] text-input-fg outline-none focus:border-focus"
        aria-label={window.l10n.filterByFileType}
        title={window.l10n.filterByFileType}
        value={filter}
        onChange={(event) => {
          changedFilesTypeFilter.value = event.currentTarget.value;
        }}
      >
        <option value={ALL_FILE_TYPES}>{window.l10n.allFileTypes}</option>
        {options.map((extension) => (
          <option key={extension || "no-extension"} value={extension}>
            {typeLabel(extension)}
          </option>
        ))}
      </select>
    </div>
  );
}
