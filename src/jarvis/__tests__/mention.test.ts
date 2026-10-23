import { describe, expect, it } from "vitest";
import { appMatches, atQuery, stillMentioned, type AppChoice } from "../mention";

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
});
