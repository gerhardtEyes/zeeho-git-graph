import { CommitDetails } from "@/webview/components/commit/CommitDetails";
import { CommitTable } from "@/webview/components/commit/CommitTable";
import { Button } from "@/webview/components/ui/Button";
import { Loading } from "@/webview/components/ui/Loading";
import { loadMoreCommits } from "@/webview/lib/actions";
import {
  commitHead,
  commitDetails,
  commitList,
  expandedCommit,
  headBranch,
  maxCommits,
  moreCommitsAvailable
} from "@/webview/lib/stores";
import { NoCommitsPage } from "@/webview/pages/NoCommitsPage";

export function GraphView() {
  const commits = commitList.value;

  if (commits === undefined) {
    return <Loading />;
  }

  if (commits.length === 0 && commitHead.value === null) {
    return <NoCommitsPage />;
  }

  const loadingMore = commits.length < maxCommits.value;

  return (
    <main class="relative flex min-h-0 grow flex-col overflow-hidden">
      <div class="git-graph-scroll-region min-h-0 grow overflow-auto">
        <CommitTable commits={commits} head={commitHead.value} headBranch={headBranch.value} />
        {moreCommitsAvailable.value &&
          (loadingMore ? (
            <Loading />
          ) : (
            <div class="flex justify-center py-4">
              <Button onClick={loadMoreCommits}>{window.l10n.loadMore}</Button>
            </div>
          ))}
      </div>
      {expandedCommit.value !== null && <CommitDetails details={commitDetails.value} />}
    </main>
  );
}
