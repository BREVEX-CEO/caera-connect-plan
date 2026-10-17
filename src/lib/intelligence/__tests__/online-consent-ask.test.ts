import { afterEach, describe, expect, it } from "vitest";
import { askOnlineConsent, setOnlineConsentAsk } from "../online-consent-ask";

describe("asking for online consent (PLAN Phase 08 V16)", () => {
  afterEach(() => setOnlineConsentAsk(null));

  it("two requests asking together share one question and both get its answer", async () => {
    let shown = 0;
    let answer!: (agreed: boolean) => void;
    setOnlineConsentAsk(() => {
      shown += 1;
      return new Promise<boolean>((resolve) => (answer = resolve));
    });
    const chat = askOnlineConsent();
    const jarvis = askOnlineConsent();
    expect(shown).toBe(1);
    answer(true);
    expect(await Promise.all([chat, jarvis])).toEqual([true, true]);
  });

  it("asks again once the last question was answered", async () => {
    let shown = 0;
    setOnlineConsentAsk(() => {
      shown += 1;
      return Promise.resolve(false);
    });
    expect(await askOnlineConsent()).toBe(false);
    expect(await askOnlineConsent()).toBe(false);
    expect(shown).toBe(2);
  });

  it("with no dialog on the page, nothing may be sent", async () => {
    expect(await askOnlineConsent()).toBe(false);
  });
});
