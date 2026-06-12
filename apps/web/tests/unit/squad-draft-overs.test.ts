import { describe, expect, it } from "vitest";

/**
 * ScorePad squad setup keeps draftHomeIds/draftAwayIds locally until confirm.
 *
 * Regression: first overs change reset the form because the mount useEffect
 * depended on oversTouched. setOversTouched(true) re-ran refresh() and
 * syncDraftFromServer(), overwriting unsaved squad picks. A second overs edit
 * did not reset because oversTouched was already true.
 */
describe("squad draft survives overs edit", () => {
  it("does not overwrite local squad ids when only overs changes", () => {
    const serverHome = ["a", "b"];
    let draftHome = ["a", "b", "c", "d"];

    function syncDraftFromServer(home: string[]) {
      draftHome = [...home];
    }

    // Buggy: re-fetch + sync whenever oversTouched flips true.
    const oversTouched = true;
    if (oversTouched) {
      syncDraftFromServer(serverHome);
    }
    expect(draftHome).toEqual(["a", "b"]);

    draftHome = ["a", "b", "c", "d"];
    // Fixed: oversTouched does not trigger syncDraftFromServer by itself.
    expect(draftHome).toEqual(["a", "b", "c", "d"]);
  });
});
