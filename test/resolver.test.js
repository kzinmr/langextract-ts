import { describe, it, expect } from "vitest";
import { Resolver } from "../src/resolver";
import { FormatHandler } from "../src/formatHandler";
import { RegexTokenizer } from "../src/core/tokenizer";
const handler = new FormatHandler({ useFences: false });
const resolver = new Resolver({ formatHandler: handler });
describe("Resolver", () => {
    it("resolves structured output into extractions", () => {
        const json = JSON.stringify({
            extractions: [{ person: "Jane Doe", drug: "Aspirin" }],
        });
        const extractions = resolver.resolve(json);
        expect(extractions.length).toBe(2);
        expect(extractions[0].extractionClass).toBe("person");
    });
    it("aligns extractions to source text", () => {
        const text = "Patient Jane Doe received Aspirin.";
        const json = JSON.stringify({
            extractions: [{ person: "Jane Doe", drug: "Aspirin" }],
        });
        const extractions = resolver.resolve(json);
        const aligned = resolver.align(extractions, text, 0, 0, {
            tokenizerInst: new RegexTokenizer(),
        });
        const person = aligned.find((e) => e.extractionClass === "person");
        const drug = aligned.find((e) => e.extractionClass === "drug");
        expect(person?.alignmentStatus).toBe("match_exact");
        expect(drug?.alignmentStatus).toBe("match_exact");
    });
});
//# sourceMappingURL=resolver.test.js.map