import type { GitCommitDetails } from "@/backend/types";
import { abbrevCommit } from "@/backend/utils/string";
import { ChangedFileList } from "@/webview/components/commit/FileTree";
import { WorkingTreeChanges } from "@/webview/components/commit/WorkingTreeChanges";
import { Icon } from "@/webview/components/ui/Icons";
import { Loading } from "@/webview/components/ui/Loading";
import { UNCOMMITTED_CHANGES } from "@/webview/constants";
import { closeCommitDetails } from "@/webview/lib/actions";
import { getCommitDate } from "@/webview/utils/date";
import { format } from "@/webview/utils/format";

function Summary({ details }: { details: GitCommitDetails }) {
  if (details.hash === UNCOMMITTED_CHANGES) {
    return (
      <div class="git-graph-details-summary min-w-0 grow select-text">
        <div class="truncate font-semibold">
          {format(window.l10n.uncommittedChanges, details.fileChanges.length)}
        </div>
      </div>
    );
  }

  const subject = details.body.split(/\r?\n/, 1)[0] || abbrevCommit(details.hash);
  const date = getCommitDate(details.date);

  return (
    <div class="git-graph-details-summary min-w-0 grow select-text">
      <div class="truncate font-semibold" title={details.body}>
        {subject}
      </div>
      <div class="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
        <span class="truncate" title={`${details.author} <${details.email}>`}>
          {details.author}
        </span>
        <span aria-hidden="true">•</span>
        <span class="shrink-0" title={date.title}>
          {date.value}
        </span>
        <code class="ml-auto shrink-0" title={details.hash}>
          {abbrevCommit(details.hash)}
        </code>
      </div>
    </div>
  );
}

/** Commit details in a fixed pane below the independently scrolling graph. */
export function CommitDetails({ details }: { details: GitCommitDetails | null }) {
  const fileCount = details?.fileChanges.length ?? 0;

  return (
    <section
      class={`git-graph-details-pane relative flex shrink-0 flex-col overflow-hidden border-t border-line bg-editor text-ui leading-4.5 whitespace-normal ${
        details?.hash === UNCOMMITTED_CHANGES ? "git-graph-working-tree-pane" : ""
      }`}
    >
      <div class="flex min-h-12 shrink-0 items-center gap-2 border-b border-line-soft bg-btn px-2 py-1.5 pr-9">
        {details === null ? <span>{window.l10n.loading}</span> : <Summary details={details} />}
      </div>
      {details === null ? (
        <Loading />
      ) : details.hash === UNCOMMITTED_CHANGES ? (
        <WorkingTreeChanges
          stagedFiles={details.stagedFileChanges ?? []}
          unstagedFiles={details.unstagedFileChanges ?? details.fileChanges}
        />
      ) : (
        <>
          <div class="shrink-0 px-2 py-1 text-xs font-semibold text-muted uppercase">
            {format(window.l10n.changedFiles, fileCount)}
          </div>
          <div class="git-graph-details-files min-h-0 grow overflow-auto border-t border-line-soft">
            <ChangedFileList files={details.fileChanges} commitHash={details.hash} />
          </div>
        </>
      )}
      <button
        type="button"
        class="absolute top-1.5 right-1.5 cursor-pointer opacity-60 hover:opacity-100"
        title={window.l10n.close}
        aria-label={window.l10n.close}
        onClick={closeCommitDetails}
      >
        <Icon class="size-5" viewBox="0 0 12 16">
          <path d="M7.48 8l3.75 3.75-1.48 1.48L6 9.48l-3.75 3.75-1.48-1.48L4.52 8 .77 4.25l1.48-1.48L6 6.52l3.75-3.75 1.48 1.48L7.48 8z" />
        </Icon>
      </button>
    </section>
  );
}
