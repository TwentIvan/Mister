import { describe, it, expect } from "vitest";
import { extractNumbers } from "../usePushToTalkNumber";

describe("extractNumbers — parlato italiano al tavolo", () => {
  it("cifre esplicite", () => {
    expect(extractNumbers("40")).toEqual([40]);
    expect(extractNumbers("offro 125")).toEqual([125]);
  });
  it("parole semplici e decine", () => {
    expect(extractNumbers("quaranta")).toEqual([40]);
    expect(extractNumbers("dai quarantacinque")).toEqual([45]);
    expect(extractNumbers("ventuno")).toEqual([21]);
    expect(extractNumbers("ventotto")).toEqual([28]);
  });
  it("centinaia composte", () => {
    expect(extractNumbers("cento")).toEqual([100]);
    expect(extractNumbers("centoventicinque")).toEqual([125]);
    expect(extractNumbers("duecentodieci")).toEqual([210]);
  });
  it("il rumore non produce numeri", () => {
    expect(extractNumbers("ma dai non ci credo che lo prendi")).toEqual([]);
  });
  it("due numeri nella finestra → entrambi candidati", () => {
    expect(extractNumbers("quaranta no cinquanta")).toEqual([40, 50]);
  });
})
