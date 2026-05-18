// -----------------------------------------------------------------------------
// carrot-code — i18n tests (T035a)
//
// Coverage: the t() lookup returns the EN string by default; setLocale()
// switches catalogs; getActiveCatalog() round-trips; and the I18nKey
// type forces a fake catalog to cover every key (compile-time, not
// runtime — so we test the runtime parts).
// -----------------------------------------------------------------------------

import { afterEach, describe, expect, it } from "vitest";

import { EN, getActiveCatalog, setLocale, t, type I18nCatalog } from "../../src/i18n/index.js";

describe("i18n", () => {
  afterEach(() => {
    // Reset to the default catalog so test ordering doesn't matter.
    setLocale(EN);
  });

  it("returns the EN string by default", () => {
    expect(t("hud.carrots")).toBe(EN["hud.carrots"]);
    expect(t("outcome.playAgain")).toBe(EN["outcome.playAgain"]);
  });

  it("setLocale() switches the active catalog", () => {
    const fake: I18nCatalog = Object.freeze({
      ...EN,
      "hud.carrots": "Zanahorias",
      "hud.lives": "Vidas",
      "outcome.levelComplete": "¡Nivel completo!",
      "outcome.playAgain": "Jugar otra vez",
    });
    setLocale(fake);
    expect(t("hud.carrots")).toBe("Zanahorias");
    expect(t("outcome.playAgain")).toBe("Jugar otra vez");
    // Untranslated keys (those not overridden in `fake` above) still come
    // from the underlying spread of EN.
    expect(t("dev.bootStub")).toBe(EN["dev.bootStub"]);
  });

  it("getActiveCatalog() returns the currently-active catalog reference", () => {
    expect(getActiveCatalog()).toBe(EN);
    const fake: I18nCatalog = Object.freeze({ ...EN });
    setLocale(fake);
    expect(getActiveCatalog()).toBe(fake);
  });
});
