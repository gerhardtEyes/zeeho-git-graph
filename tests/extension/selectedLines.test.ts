import { describe, expect, it } from "vitest";

import { getSelectedLineNumbers, TextSelection } from "@/extension/selectedLines";

function selection(
  startLine: number,
  endLine = startLine,
  endCharacter = 0,
  isEmpty = startLine === endLine && endCharacter === 0
): TextSelection {
  return {
    start: { line: startLine },
    end: { character: endCharacter, line: endLine },
    isEmpty
  };
}

describe("getSelectedLineNumbers", () => {
  it("supports multiple cursors and removes duplicate lines", () => {
    expect(
      getSelectedLineNumbers([selection(5), selection(2), selection(5), selection(8)], 10)
    ).toEqual([2, 5, 8]);
  });

  it("includes every line touched by a multi-line selection", () => {
    expect(getSelectedLineNumbers([selection(2, 5, 4, false)], 10)).toEqual([2, 3, 4, 5]);
  });

  it("excludes an ending line when the selection ends at column zero", () => {
    expect(getSelectedLineNumbers([selection(2, 5, 0, false)], 10)).toEqual([2, 3, 4]);
  });

  it("merges overlapping selections and clamps them to the document", () => {
    expect(
      getSelectedLineNumbers([selection(1, 4, 3, false), selection(3, 20, 2, false)], 6)
    ).toEqual([1, 2, 3, 4, 5]);
  });
});
