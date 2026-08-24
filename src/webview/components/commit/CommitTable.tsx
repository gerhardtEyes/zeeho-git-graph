import { useEffect, useMemo } from "preact/hooks";

import type { GitCommitNode } from "@/backend/types";
import { CommitGraph } from "@/webview/components/commit/CommitGraph";
import { CommitRow } from "@/webview/components/commit/CommitRow";
import type { ColumnResize } from "@/webview/components/commit/useColumnResize";
import { useColumnResize } from "@/webview/components/commit/useColumnResize";
import { TABLE_HEADER_HEIGHT, UNCOMMITTED_CHANGES } from "@/webview/constants";
import { GRAPH_PADDING } from "@/webview/graph/constants";
import { computeGraphLayout } from "@/webview/graph/layout";
import { branchColour } from "@/webview/graph/palette";
import { graphWidth } from "@/webview/graph/utils";
import { toggleCommitDetails } from "@/webview/lib/actions";
import { columnWidths, expandedCommit } from "@/webview/lib/stores";

type CommitTableProps = {
  commits: Array<GitCommitNode>;
  head: string | null;
  headBranch: string | null;
};

const HEADER_CLASS =
  "relative h-8 overflow-hidden border-b border-line px-3 text-left font-semibold" +
  " text-ellipsis whitespace-nowrap";

const HANDLE_CLASS = "git-graph-resize-handle absolute top-0 h-full w-1.5 cursor-col-resize";

const COLUMN_CLASS = [
  "git-graph-column-graph",
  "git-graph-column-description",
  "git-graph-column-date",
  "git-graph-column-author",
  "git-graph-column-commit"
];

/** Distance over which the graph fades out, where the column cuts it off. */
const GRAPH_FADE = 12;

const GRAPH_CLIP =
  `width: var(--visible-graph-column, var(--col-graph)); top: ${TABLE_HEADER_HEIGHT}px;` +
  ` mask-image: linear-gradient(to right, black calc(100% - ${GRAPH_FADE}px), transparent)`;

/** Keep room for the graph, and for the column title when the graph is narrow. */
const MIN_GRAPH_COLUMN = 64;

/**
 * Grip that moves the boundary after column `boundary`. Both columns of a
 * boundary hold one, because a header cuts off what leaves it. The right one
 * draws the line between the two columns, the left one only widens the grip.
 */
function ResizeHandle({
  boundary,
  side,
  resize
}: {
  boundary: number;
  side: "left" | "right";
  resize: ColumnResize;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      tabIndex={side === "left" ? 0 : undefined}
      class={`${HANDLE_CLASS} ${side === "left" ? "left-0 border-l border-line-soft" : "right-0"}`}
      onMouseDown={(event) => resize.startResize(boundary, event)}
      onKeyDown={(event) => resize.nudge(boundary, event)}
    />
  );
}

export function CommitTable({ commits, head, headBranch }: CommitTableProps) {
  const layout = useMemo(() => computeGraphLayout(commits, head), [commits, head]);
  const messages = useMemo(
    () => new Map(commits.map((commit) => [commit.hash, commit.message])),
    [commits]
  );
  const graphColumn = Math.max(graphWidth(layout) + GRAPH_PADDING, MIN_GRAPH_COLUMN);
  const resize = useColumnResize(graphColumn);
  const sized = columnWidths.value !== null;

  const expandedHash = expandedCommit.value;
  const expandedRow = commits.findIndex((commit) => commit.hash === expandedHash);

  useEffect(() => {
    if (expandedHash === null) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      document.getElementById(`git-commit-${expandedHash}`)?.scrollIntoView({
        block: viewState.autoCenterCommitDetailsView ? "center" : "nearest"
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [expandedHash]);

  const titles = [
    window.l10n.graph,
    window.l10n.description,
    window.l10n.date,
    window.l10n.author,
    window.l10n.commit
  ];

  return (
    <div class="git-graph-table relative min-w-0" ref={resize.containerRef}>
      <div class="pointer-events-none absolute left-0 overflow-hidden" style={GRAPH_CLIP}>
        <CommitGraph layout={layout} expansion={null} />
      </div>
      <table
        class={`w-full cursor-default border-collapse text-ui select-none ${
          sized ? "table-fixed" : ""
        }`}
      >
        <colgroup>
          <col
            class={COLUMN_CLASS[0]}
            style="width: var(--visible-graph-column, var(--col-graph))"
          />
          <col />
          <col class={COLUMN_CLASS[2]} style="width: var(--col-date)" />
          <col class={COLUMN_CLASS[3]} style="width: var(--col-author)" />
          <col class={COLUMN_CLASS[4]} style="width: var(--col-commit)" />
        </colgroup>
        <thead>
          <tr ref={resize.headRef} class={resize.resizing ? "cursor-col-resize" : ""}>
            {titles.map((title, index) => (
              <th key={title} class={`${HEADER_CLASS} ${COLUMN_CLASS[index]}`}>
                {index > 0 && <ResizeHandle boundary={index - 1} side="left" resize={resize} />}
                {title}
                {index < titles.length - 1 && (
                  <ResizeHandle boundary={index} side="right" resize={resize} />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {commits.map((commit, index) => (
            <CommitRow
              key={commit.hash}
              commit={commit}
              isHead={commit.hash === head}
              headBranch={headBranch}
              messages={messages}
              colour={branchColour(layout.vertices[index].colour)}
              expanded={index === expandedRow}
              onSelect={
                commit.hash === UNCOMMITTED_CHANGES
                  ? undefined
                  : () => toggleCommitDetails(commit.hash)
              }
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
