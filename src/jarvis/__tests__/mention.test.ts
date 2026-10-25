import { describe, expect, it } from "vitest";
import {
  appMatches,
  atQuery,
  mentions,
  stillMentioned,
  workTarget,
  type AppChoice,
} from "../mention";

const app = (name: string, deviceId = "pc"): AppChoice => ({
  deviceId,
  deviceName: deviceId,
  name,
});

describe("the @ app picker", () => {
  it("opens at an @ that starts a word, never inside an e-mail address", () => {
    expect(atQuery("@", 1)).toEqual({ start: 0, query: "" });
    expect(atQuery("use @Exc", 8)).toEqual({ start: 4, query: "Exc" });
    expect(atQuery("use @Microsoft Wo", 17)).toEqual({ start: 4, query: "Microsoft Wo" });
    expect(atQuery("mail priya@example.com", 22)).toBeNull();
    expect(atQuery("@ Excel", 7)).toBeNull();
    expect(atQuery("@Excel\nmore", 11)).toBeNull();
  });

  it("matches a name or any word of it, name first, in any script", () => {
    const apps = [app("Microsoft Word"), app("WordPad"), app("Excel"), app("मेरा ऐप")];
    expect(appMatches(apps, "word").map((a) => a.name)).toEqual(["WordPad", "Microsoft Word"]);
    expect(appMatches(apps, "मेरा").map((a) => a.name)).toEqual(["मेरा ऐप"]);
    expect(appMatches(apps, "zzz")).toEqual([]);
    expect(appMatches(apps, "")).toHaveLength(4);
  });

  it("keeps the same name on two computers apart", () => {
    const both = appMatches([app("Word", "laptop"), app("Word", "desktop")], "Wo");
    expect(both.map((a) => a.deviceId).sort()).toEqual(["desktop", "laptop"]);
  });

  it("forgets a chosen app once its mention is edited away", () => {
    const chosen = [app("Excel", "laptop")];
    expect(stillMentioned("make a chart in @Excel please", chosen)).toEqual(chosen);
    expect(stillMentioned("make a chart in @Excellent", chosen)).toEqual([]);
    expect(stillMentioned("make a chart", chosen)).toEqual([]);
  });

  it("finds a later mention behind an earlier longer one, and never inside an e-mail (audit F07)", () => {
    const word = [app("Word")];
    expect(stillMentioned("@Wordpress and @Word", word)).toEqual(word);
    expect(stillMentioned("mail@Word.example", word)).toEqual([]);
    expect(stillMentioned("x@Word", word)).toEqual([]);
    expect(mentions("(@word) please", "Word")).toBe(true);
  });

  it("aims the work at the chosen app's computer, and asks rather than guess", () => {
    const catalog = [app("Word", "pc-a"), app("Word", "pc-b"), app("Paint", "pc-a")];
    // Chosen on PC B in the picker: PC B, whatever the default computer is.
    expect(workTarget("open @Word", [app("Word", "pc-b")], catalog)).toEqual({ deviceId: "pc-b" });
    // Typed by hand, on one computer only: that one.
    expect(workTarget("draw in @Paint", [], catalog)).toEqual({ deviceId: "pc-a" });
    // Typed by hand, on two computers: the person chooses.
    expect(workTarget("open @Word", [], catalog)).toHaveProperty("ambiguous");
    // Apps on two different computers in one message: the person chooses.
    expect(workTarget("@Word then @Paint", [app("Word", "pc-b")], catalog)).toHaveProperty(
      "ambiguous",
    );
    expect(workTarget("no app here", [], catalog)).toBeNull();
  });
});
