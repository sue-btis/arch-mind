import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_SVG_CHARS,
  extendConcept,
  loadConcept,
  loadConceptDetail,
  loadConcepts,
  loadIllustration,
  saveConcept,
  setupStore,
  validateSvg,
  withoutIllustrationLink,
  writeConceptAtomic,
  type Concept,
} from "../src/index.ts";

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const wrap = (inner: string, attrs = "") => `<svg ${NS} viewBox="0 0 10 10"${attrs}>${inner}</svg>`;
const VALID = wrap(
  '<title>Sealed envelope</title><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><clipPath id="c"><rect width="5" height="5"/></clipPath></defs><g transform="translate(1 1)"><rect x="1" y="1" width="8" height="6" rx="1" fill="url(#g)" stroke="#333" stroke-width="0.5" clip-path="url(#c)"/><path d="M1 1 L5 5 L9 1"/><circle cx="5" cy="5" r="1"/><use href="#c"/><use xlink:href="#c" xmlns:xlink="http://www.w3.org/1999/xlink"/><text x="1" y="9" font-size="2">a &amp; b</text></g>',
);

const BAD: [string, string][] = [
  ["a script element", wrap("<script>alert(1)</script>")],
  ["a foreignObject", wrap('<foreignObject width="5" height="5"><div>x</div></foreignObject>')],
  ["a foreignObject holding only allowed children", wrap('<foreignObject width="5" height="5"><rect width="1" height="1"/></foreignObject>')],
  ["an onload handler", wrap("", ' onload="alert(1)"')],
  ["an onclick handler on a child", wrap('<rect width="1" height="1" onclick="x()"/>')],
  ["an uppercase handler name", wrap('<rect width="1" height="1" OnMouseOver="x()"/>')],
  ["a DOCTYPE", `<!DOCTYPE svg SYSTEM "x.dtd">${wrap("")}`],
  ["an entity declaration", `<!DOCTYPE svg [<!ENTITY a "b">]>${wrap("&a;")}`],
  ["an undeclared entity reference", wrap("<text>&a;</text>")],
  ["a bare ENTITY declaration", `<!ENTITY a "b">${wrap("")}`],
  ["a processing instruction", `<?xml-stylesheet href="a.css"?>${wrap("")}`],
  ["an xml declaration that is not first", ` ${wrap("")}<?xml version="1.0"?>`],
  ["CDATA", wrap("<style><![CDATA[a{}]]></style>")],
  ["a javascript: href", wrap('<use href="javascript:alert(1)"/>')],
  ["a javascript: href spelled with a character reference", wrap('<use href="&#106;avascript:alert(1)"/>')],
  ["a javascript: URL in a presentation attribute", wrap('<rect width="1" height="1" fill="javascript:alert(1)"/>')],
  ["a javascript: URL spelled with a character reference in a presentation attribute", wrap('<rect width="1" height="1" fill="&#106;avascript:alert(1)"/>')],
  ["a data: URL in a presentation attribute", wrap('<rect width="1" height="1" fill="data:image/png;base64,AA"/>')],
  ["an @import in an inline style", wrap(`<rect width="1" height="1" style="@import 'x.css'"/>`)],
  ["a data: href", wrap('<use href="data:image/svg+xml;base64,AAAA"/>')],
  ["an external href", wrap('<use href="https://example.com/a.svg#x"/>')],
  ["a relative non-fragment xlink:href", wrap('<use xlink:href="other.svg#x" xmlns:xlink="http://www.w3.org/1999/xlink"/>')],
  ["an image element", wrap('<image href="#a" width="1" height="1"/>')],
  ["an anchor element", wrap('<a href="#a"><rect width="1" height="1"/></a>')],
  ["an animate element", wrap('<animate attributeName="x"/>')],
  ["an external url() in an attribute", wrap('<rect width="1" height="1" fill="url(https://example.com/a.svg#x)"/>')],
  ["a url() in an inline style", wrap('<rect width="1" height="1" style="fill:url(data:image/png;base64,AA)"/>')],
  ["a style with @import", wrap('<style>@import "https://example.com/a.css";</style>')],
  ["a style with an external url()", wrap("<style>rect{fill:url(https://example.com/a.png)}</style>")],
  ["an unknown attribute", wrap('<rect width="1" height="1" data-x="1"/>')],
  ["an unclosed element", `<svg ${NS}><g></svg>`],
  ["an element left open at the end", `<svg ${NS}><g>`],
  ["a root that is an allowed element but not svg", `<g ${NS}></g>`],
  ["a duplicate attribute", wrap('<rect width="1" width="2"/>')],
  ["stray text after the root", `${wrap("")}x`],
  ["a second root", `${wrap("")}${wrap("")}`],
  ["an unquoted attribute", wrap("<rect width=1/>")],
  ["a root that is not svg", '<html xmlns="http://www.w3.org/2000/svg"></html>'],
  ["a missing svg namespace", '<svg viewBox="0 0 1 1"></svg>'],
  ["empty text", ""],
  ["more than 200,000 characters", wrap(`<desc>${"a".repeat(MAX_SVG_CHARS)}</desc>`)],
  ["a character reference to U+0000 in text", wrap("<desc>&#0;</desc>")],
  ["a character reference to a control character in an attribute", wrap('<rect id="a&#1;"/>')],
  ["a character reference to U+FFFE", wrap("<desc>&#xFFFE;</desc>")],
  ["a character reference to a surrogate", wrap('<rect id="a&#xD800;"/>')],
  ["a character reference above U+10FFFF in a presentation attribute", wrap('<rect fill="&#x110000;"/>')],
  ["a decimal character reference far above U+10FFFF", wrap('<rect id="a&#99999999;"/>')],
  ["a character reference above U+10FFFF in text", wrap("<desc>&#x110000;</desc>")],
  ["a raw U+FFFF", wrap(`<desc>a${String.fromCharCode(0xffff)}b</desc>`)],
  ["a raw U+FFFE", wrap(`<desc>a${String.fromCharCode(0xfffe)}b</desc>`)],
  ["a non-breaking space before the root", `\u00a0${wrap("")}`],
  ["a non-breaking space after the root", `${wrap("")}\u00a0`],
  ["a non-breaking space between attributes", `<svg ${NS}\u00a0viewBox="0 0 1 1"/>`],
  ["a comment ending in ---", wrap("<!-- a --->")],
  ["a comment containing --", wrap("<!-- a -- b -->")],
  ["a comment that is never closed", wrap("<!-- never closed")],
  ["an xml declaration without a version", `<?xml ?>${wrap("")}`],
  ["an xml declaration with an unknown pseudo-attribute", `<?xml foo="bar"?>${wrap("")}`],
  ["an xml declaration with encoding before version", `<?xml encoding="UTF-8" version="1.0"?>${wrap("")}`],
  ["an xml declaration with a standalone value other than yes or no", `<?xml version="1.0" standalone="maybe"?>${wrap("")}`],
  ["a raw U+001F in text", wrap("<desc>a\u001Fb</desc>")],
  ["a character reference to U+001F", wrap("<desc>&#31;</desc>")],
  ["an xml declaration with version 1.", `<?xml version="1."?>${wrap("")}`],
  ["an xml declaration with no space before version", `<?xmlversion="1.0"?>${wrap("")}`],
  ["an xml declaration with no space before encoding", `<?xml version="1.0"encoding="UTF-8"?>${wrap("")}`],
  ["an xml declaration with a space inside the encoding name", `<?xml version="1.0" encoding="UTF 8"?>${wrap("")}`],
  ["an xml declaration after a leading space", ` <?xml version="1.0"?>${wrap("")}`],
  ["an xml declaration after a leading newline", `\n<?xml version="1.0"?>${wrap("")}`],
  ["a non-breaking space before = in an attribute", `<svg ${NS} viewBox\u00a0="0 0 1 1"/>`],
  ["a < inside an attribute value", wrap('<rect id="a<b"/>')],
  ["an undeclared entity inside an attribute value", wrap('<rect id="a&b;"/>')],
];

describe("SVG allowlist validator (TST-029, AC-034)", () => {
  it("accepts a valid illustration, with or without an XML declaration", () => {
    expect(validateSvg(VALID)).toEqual([]);
    expect(validateSvg(`<?xml version="1.0" encoding="UTF-8"?>\n${VALID}\n`)).toEqual([]);
  });

  it("accepts exactly 200,000 characters", () => {
    const pad = MAX_SVG_CHARS - wrap("<desc></desc>").length;
    expect(validateSvg(wrap(`<desc>${"a".repeat(pad)}</desc>`))).toEqual([]);
  });

  it.each(BAD)("rejects %s with a reason", (_name, svg) => {
    expect(validateSvg(svg).length).toBeGreaterThan(0);
  });

  it("labels the reason for an event handler and for empty text", () => {
    expect(validateSvg(wrap("", ' onload="alert(1)"')).join(" ")).toMatch(/event handler/);
    expect(validateSvg("").join(" ")).toMatch(/empty/);
  });

  it("names every failing rule, not just the first", () => {
    const reasons = validateSvg(wrap('<script/><rect onclick="x" width="1" height="1"/>')).join("\n");
    expect(reasons).toMatch(/script/);
    expect(reasons).toMatch(/onclick/);
  });
});

const BS = String.fromCharCode(92);
const EXT = "http://example.com/x";
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"';

const FETCHING: [string, string][] = [
  ["a style element", wrap("<style>rect{fill:red}</style>")],
  ["an escaped @import in a style element", wrap(`<style>@${BS}69mport "${EXT}";</style>`)],
  ["an @import split by a comment", wrap(`<style>@im<!-- -->port "${EXT}";</style>`)],
  ["an @import split by an element", wrap(`<style>@im<g/>port "${EXT}";</style>`)],
  ["a url( split by a comment", wrap(`<style>rect{fill:u<!-- -->rl(${EXT})}</style>`)],
  ["an unterminated url( in a style element", wrap(`<style>svg{background-image:url(${EXT}</style>`)],
  ["an escaped url( in a style element", wrap(`<style>svg{background-image:u${BS}72l(${EXT})}</style>`)],
  ["image-set in a style element", wrap(`<style>svg{background:image-set("${EXT}" 1x)}</style>`)],
  ["an escaped url( in @font-face", wrap(`<style>@font-face{font-family:a;src:${BS}75rl(${EXT})}</style>`)],
  ["an unterminated url( in a presentation attribute", wrap(`<rect fill="url(${EXT}"/>`)],
  ["an escaped url( in a style attribute", wrap(`<rect style="fill:u${BS}72l(${EXT})"/>`)],
  ["an escaped url( with a trailing space in a style attribute", wrap(`<rect style="fill:${BS}75 rl(${EXT})"/>`)],
  ["a url( spelled with a character reference", wrap(`<rect style="fill:url&#40;${EXT})"/>`)],
  ["image-set in a style attribute", wrap(`<rect style="background:image-set(&quot;${EXT}&quot; 1x)"/>`)],
  ["a string url in a presentation attribute", wrap(`<rect fill="image-set('${EXT}' 1x)"/>`)],
  ["expression( in a style attribute", wrap('<rect style="width:expression(alert(1))"/>')],
  ["a comment in a style attribute", wrap('<rect style="fill:/**/red"/>')],
  ["a property outside the allowlist", wrap('<rect style="background-image:none"/>')],
  ["!important", wrap('<rect style="fill:red !important"/>')],
  ["a mask pointing outside", wrap(`<rect mask="url(${EXT}#m)"/>`)],
  ["a backslash in a presentation attribute", wrap(`<rect fill="r${BS}65d"/>`)],
  ["a function other than rgb and hsl", wrap('<rect fill="image-set(a)"/>')],
    ["a quoted string outside font-family", wrap('<rect fill="&apos;red&apos;"/>')],
    ["a filter attribute", wrap('<rect filter="url(#f)"/>')],
  ["an external url() after an rgb() color in a style attribute", wrap(`<rect style="fill:rgb(1,2,3) url(${EXT})"/>`)],
  ["an external url() after an hsl() color in a presentation attribute", wrap(`<rect fill="hsl(1,2%,3%) url(${EXT})"/>`)],
  ["a url() nested inside rgb()", wrap(`<rect fill="rgb(url(${EXT}))"/>`)],
  ["a hex color of 2 digits", wrap('<rect fill="#12"/>')],
  ["a hex color of 5 digits", wrap('<rect fill="#12345"/>')],
  ["a hex color of 7 digits", wrap('<rect fill="#1234567"/>')],
  ["a hex color with non-hex letters", wrap('<rect fill="#xyz"/>')],
  ["a backslash inside a quoted font name", wrap(`<text font-family="&apos;a${BS}62&apos;">x</text>`)],
  ["a url( inside a quoted font name", wrap(`<text style="font-family:&apos;url(${EXT})&apos;">x</text>`)],
];

describe("SVG allowlist validator hardening (TST-029, F-1, F-2, F-5)", () => {
  it.each(FETCHING)("rejects %s", (_name, svg) => {
    expect(validateSvg(svg).length).toBeGreaterThan(0);
  });

  it("accepts inline styles made of colors, numbers, lengths, keywords and local url()", () => {
    const svg = wrap(
      '<linearGradient id="g"/><rect width="1" height="1" style="fill:url(#g); stroke:#a1b2c3;stroke-width:0.5px;opacity:.5;fill-rule:evenodd"/><rect width="1" height="1" fill="rgb(1, 2, 3)" stroke="hsla(10,50%,50%,0.5)"/><text font-family="Inter, \'Open Sans\', sans-serif" font-size="12">a</text>',
    );
    expect(validateSvg(svg)).toEqual([]);
  });

  it("resolves character references before reading the CSS value", () => {
    expect(validateSvg(wrap('<rect fill="&#x23;fff" style="stroke:&#x23;000"/>'))).toEqual([]);
  });

  it("rejects an unbound prefix on an attribute, on the root and on an element", () => {
    expect(validateSvg(wrap('<rect id="a"/><use xlink:href="#a"/>')).join(" ")).toMatch(/prefix "xlink" is not bound/);
    expect(validateSvg(wrap(`<use xlink:href="#a" ${XLINK}/>`))).toEqual([]);
    expect(validateSvg(wrap(`<g ${XLINK}><use xlink:href="#a"/></g><use xlink:href="#a"/>`)).join(" ")).toMatch(/not bound/);
    expect(validateSvg(wrap(`<g ${XLINK}><use xlink:href="#a"/></g>`))).toEqual([]);
    expect(validateSvg(wrap("<svg:rect/>")).length).toBeGreaterThan(0);
    expect(validateSvg(wrap('<rect xml:space="preserve"/>'))).toEqual([]);
  });

  it("rejects ]]> in text", () => {
    expect(validateSvg(wrap("<desc>a ]]> b</desc>")).join(" ")).toMatch(/\]\]>/);
    expect(validateSvg(wrap("<desc>a ]]&gt; b</desc>"))).toEqual([]);
  });

  it("rejects a control character", () => {
    expect(validateSvg(wrap(`<desc>a${String.fromCharCode(1)}b</desc>`)).join(" ")).toMatch(/control character/);
  });

  it("strips blanks before looking for a scheme in attributes that are not CSS", () => {
    expect(validateSvg(wrap('<g class="java&#x09;script:x"/>')).join(" ")).toMatch(/javascript:/);
    expect(validateSvg(wrap('<g class="da ta:x"/>')).join(" ")).toMatch(/data:/);
  });

  it("rejects expression( and a non-local url() in attributes that are not CSS", () => {
    expect(validateSvg(wrap('<g transform="expression(x)"/>')).join(" ")).toMatch(/CSS expression/);
    expect(validateSvg(wrap('<g transform="@import x"/>')).join(" ")).toMatch(/@import/);
    expect(validateSvg(wrap(`<g transform="url(${EXT})"/>`)).join(" ")).toMatch(/url\(\)/);
  });

  it("rejects a lone surrogate, which a UTF-8 file cannot hold", () => {
    expect(validateSvg(wrap(`<desc>a${String.fromCharCode(0xd800)}b</desc>`)).join(" ")).toMatch(/XML does not allow/);
  });

  it("accepts a leading byte order mark but not one inside the document", () => {
    expect(validateSvg(`\uFEFF${wrap("")}`)).toEqual([]);
    expect(validateSvg(`\uFEFF\uFEFF${wrap("")}`).join(" ")).toMatch(/text outside/);
  });

  it("accepts colors of 3, 4, 6 and 8 hex digits", () => {
    expect(validateSvg(wrap('<rect fill="#abc" stroke="#abcd"/><rect fill="#aabbcc" stroke="#aabbccdd"/>'))).toEqual([]);
  });

  it("accepts a full xml declaration, character references to XML characters and a comment with inner dashes", () => {
    const declaration = `<?xml version='1.0' encoding="UTF-8" standalone="no"?>`;
    expect(validateSvg(`${declaration}\n${wrap("<desc>&#9;&#x1F600;&#xD7FF;&#xE000;</desc><!-- a - b -->")}\n`)).toEqual([]);
  });

  it("names the reason for an unclosed comment, a comment with -- and an out-of-range reference", () => {
    expect(validateSvg(wrap("<!-- never closed")).join(" ")).toMatch(/comment is not closed/);
    expect(validateSvg(wrap("<!-- a -- b -->")).join(" ")).toMatch(/comment contains --/);
    expect(validateSvg(wrap('<rect id="a<b"/>')).join(" ")).toMatch(/contains "<"/);
    expect(validateSvg(wrap('<rect id="a&b;"/>')).join(" ")).toMatch(/undeclared entity/);
    expect(validateSvg(wrap('<rect fill="&#x110000;"/>')).join(" ")).toMatch(/invalid character reference/);
  });

  it("accepts CRLF line endings, a raw carriage return in text and a tab or CRLF after the root", () => {
    const crlf = `<?xml version="1.0"?>\r\n<svg ${NS} viewBox="0 0 10 10">\r\n<desc>a\rb\r\nc</desc>\r\n<g\r\n/>\r\n</svg>\r\n`;
    expect(validateSvg(crlf)).toEqual([]);
    expect(validateSvg(`${wrap("")}\t`)).toEqual([]);
    expect(validateSvg(`${wrap("")}\t\r\n`)).toEqual([]);
  });

  it("accepts U+FFFD, U+10000 and U+10FFFF raw and as character references", () => {
    expect(validateSvg(wrap("<desc>\uFFFD\u{10000}\u{10FFFF}</desc>"))).toEqual([]);
    expect(validateSvg(wrap("<desc>&#xFFFD;&#x10000;&#x10FFFF;</desc>"))).toEqual([]);
    expect(validateSvg(wrap('<rect id="a&#xFFFD;&#x10000;&#x10FFFF;"/>'))).toEqual([]);
  });

  it("rejects a nested svg element", () => {
    expect(validateSvg(wrap(`<svg ${NS}/>`)).join(" ")).toMatch(/nested svg/);
  });

  it("rejects an xmlns:xlink or xmlns that is not the expected namespace", () => {
    expect(validateSvg(wrap("", ' xmlns:xlink="http://www.w3.org/2000/svg"')).join(" ")).toMatch(/XLink namespace/);
    expect(validateSvg(wrap('<g xmlns="http://www.w3.org/1999/xhtml"/>')).join(" ")).toMatch(/xmlns must be/);
  });
});

const emptyConcept = (): Concept => ({
  id: "x",
  title: "X",
  layer: "client",
  domains: ["web"],
  concerns: ["security"],
  seeI: { statement: "s", elaboration: "e", example: "x", illustration: "i" },
  relations: [],
  episodes: [],
  recall: [{ id: "q1", question: "q?", confirmed: "2026-11-01" }],
});

describe("illustration on save, extend and load (TST-029, AC-034, AC-036, AC-038)", () => {
  let dir: string;
  let store: string;
  const base = {
    id: "envelope",
    title: "Envelope",
    layer: "network",
    domains: ["web"],
    concerns: ["security"],
    seeI: { statement: "s", elaboration: "e", example: "x", illustration: "A sealed envelope." },
    relations: [],
    recall: [{ question: "q?" }],
  };
  const files = async () => ({
    concepts: await readdir(join(store, "concepts")),
    illustrations: await readdir(join(store, "illustrations")).catch(() => []),
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arch-mind-illustration-"));
    store = join(dir, "store");
    await setupStore(store, join(dir, "home", ".arch-mind", "config.json"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it.each([...BAD, ...FETCHING])("save_concept rejects %s as invalid_illustration and writes nothing", async (_name, svg) => {
    const outcome = await saveConcept(store, { ...base, illustration: svg });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.every((e) => e.rule === "invalid_illustration" && e.path === "/illustration")).toBe(true);
    expect(await files()).toEqual({ concepts: [], illustrations: [] });
  });

  it("saves a valid illustration: the file first, then one relative image link in the Illustration part", async () => {
    const outcome = await saveConcept(store, { ...base, illustration: VALID, pictogram: "shield" });
    expect(outcome.ok).toBe(true);
    expect(await files()).toEqual({ concepts: ["envelope.md"], illustrations: ["envelope.svg"] });
    expect(await readFile(join(store, "illustrations", "envelope.svg"), "utf8")).toBe(VALID);
    const text = await readFile(join(store, "concepts", "envelope.md"), "utf8");
    expect(text).toContain("pictogram: shield");
    expect(text).toContain("A sealed envelope.\n\n![Illustration of Envelope](../illustrations/envelope.svg)");
    const { concepts, problems } = await loadConcepts(store);
    expect(problems).toEqual([]);
    expect(concepts[0]).toMatchObject({ pictogram: "shield", hasIllustration: true });
    expect(await loadIllustration(store, "envelope")).toEqual({ ok: true, svg: VALID });
  });

  it("rejects an unknown pictogram, a caller-sent link and a mistyped field", async () => {
    const outcome = await saveConcept(store, {
      ...base,
      pictogram: "no-such-picture",
      seeI: { ...base.seeI, illustration: "See ![x](../illustrations/envelope.svg)" },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.errors.map((e) => `${e.rule}@${e.path}`).sort()).toEqual(["invalid_shape@/seeI/illustration", "unknown_pictogram@/pictogram"]);
    const typed = await saveConcept(store, { ...base, illustration: 5 });
    expect(typed).toMatchObject({ ok: false, errors: [{ rule: "invalid_shape", path: "/illustration" }] });
    expect(await files()).toEqual({ concepts: [], illustrations: [] });
  });

  describe("extend_concept", () => {
    beforeEach(async () => {
      await saveConcept(store, base);
    });

    it("adds a pictogram and an illustration to a concept that has none, changing nothing else", async () => {
      const before = (await loadConcept(store, "envelope")) as { concept: Concept };
      const outcome = await extendConcept(store, { id: "envelope", pictogram: "shield", illustration: VALID });
      expect(outcome).toMatchObject({ ok: true, illustrationFile: join(store, "illustrations", "envelope.svg") });
      const after = (await loadConcept(store, "envelope")) as { concept: Concept };
      expect(after.concept).toEqual({
        ...before.concept,
        pictogram: "shield",
        seeI: { ...before.concept.seeI, illustration: "A sealed envelope.\n\n![Illustration of Envelope](../illustrations/envelope.svg)" },
      });
      expect(await loadIllustration(store, "envelope")).toEqual({ ok: true, svg: VALID });
    });

    it("accepts an illustration for a concept whose pictogram id is unknown and has no link", async () => {
      await writeConceptAtomic(store, { ...emptyConcept(), id: "odd", pictogram: "no-such-picture" });
      expect((await extendConcept(store, { id: "odd", illustration: VALID })).ok).toBe(true);
    });

    it("answers already_present for a second pictogram or illustration, a broken link included, and writes nothing", async () => {
      await extendConcept(store, { id: "envelope", pictogram: "shield", illustration: VALID });
      const outcome = await extendConcept(store, { id: "envelope", pictogram: "server", illustration: VALID });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.errors.map((e) => `${e.rule}@${e.path}`).sort()).toEqual(["already_present@/illustration", "already_present@/pictogram"]);

      await rm(join(store, "illustrations", "envelope.svg"));
      const mdBefore = await readFile(join(store, "concepts", "envelope.md"), "utf8");
      const broken = await extendConcept(store, { id: "envelope", illustration: VALID });
      expect(broken).toMatchObject({ ok: false, errors: [{ rule: "already_present", path: "/illustration" }] });
      expect(await readFile(join(store, "concepts", "envelope.md"), "utf8")).toBe(mdBefore);
      expect(await readdir(join(store, "illustrations"))).toEqual([]);
    });

    it("rejects unknown_pictogram and invalid_illustration without writing, and accepts a lone pictogram", async () => {
      const mdBefore = await readFile(join(store, "concepts", "envelope.md"), "utf8");
      const bad = await extendConcept(store, { id: "envelope", pictogram: "nope", illustration: wrap("<script/>") });
      expect(bad.ok).toBe(false);
      if (bad.ok) return;
      expect(bad.errors.map((e) => `${e.rule}@${e.path}`).sort()).toEqual(["invalid_illustration@/illustration", "unknown_pictogram@/pictogram"]);
      expect(await readFile(join(store, "concepts", "envelope.md"), "utf8")).toBe(mdBefore);
      expect(await readdir(join(store, "illustrations")).catch(() => [])).toEqual([]);
      expect((await extendConcept(store, { id: "envelope", pictogram: "shield" })).ok).toBe(true);
    });
  });

  describe("load rules", () => {
    const link = (target = "../illustrations/hand.svg") => `A drawing.\n\n![Illustration of Hand](${target})`;
    const hand = (illustration: string): Concept => ({ ...emptyConcept(), id: "hand", title: "Hand", seeI: { ...emptyConcept().seeI, illustration } });
    const loaded = async () => {
      const { concepts, problems } = await loadConcepts(store);
      return { concept: concepts.find((c) => c.id === "hand")!, problems: problems.filter((p) => p.file === "hand.md") };
    };
    const putSvg = async (svg: string) => {
      await mkdir(join(store, "illustrations"), { recursive: true });
      await writeFile(join(store, "illustrations", "hand.svg"), svg);
    };

    it("derives hasIllustration true only for exactly one link to a valid SVG", async () => {
      await putSvg(VALID);
      await writeConceptAtomic(store, hand(link()));
      expect(await loaded()).toMatchObject({ concept: { hasIllustration: true }, problems: [] });
      const detail = await loadConceptDetail(store, "hand");
      expect(detail.ok && detail.concept.hasIllustration).toBe(true);
    });

    it("accepts the link form without the leading ../", async () => {
      await putSvg(VALID);
      await writeConceptAtomic(store, hand(link("illustrations/hand.svg")));
      expect((await loaded()).concept.hasIllustration).toBe(true);
    });

    it("loads a concept with two links without its illustration and lists the file", async () => {
      await putSvg(VALID);
      await writeConceptAtomic(store, hand(`${link()}\n\n![again](../illustrations/hand.svg)`));
      const { concept, problems } = await loaded();
      expect(concept.hasIllustration).toBe(false);
      expect(problems).toEqual([{ file: "hand.md", reason: expect.stringMatching(/2 illustration links/) }]);
      expect(await loadIllustration(store, "hand")).toEqual({ ok: false });
    });

    it("loads a concept whose link points to a missing SVG without its illustration and lists the file", async () => {
      await writeConceptAtomic(store, hand(link()));
      const { concept, problems } = await loaded();
      expect(concept.hasIllustration).toBe(false);
      expect(problems).toEqual([{ file: "hand.md", reason: expect.stringMatching(/missing/) }]);
    });

    it("loads a concept whose link points elsewhere without its illustration and lists the file", async () => {
      await writeConceptAtomic(store, hand(link("https://example.com/a.svg")));
      const { concept, problems } = await loaded();
      expect(concept.hasIllustration).toBe(false);
      expect(problems).toEqual([{ file: "hand.md", reason: expect.stringMatching(/illustrations\/hand\.svg/) }]);
    });

    it.each(BAD)("loads a concept whose SVG has %s without its illustration and lists the file", async (_name, svg) => {
      await putSvg(svg);
      await writeConceptAtomic(store, hand(link()));
      const { concept, problems } = await loaded();
      expect(concept.hasIllustration).toBe(false);
      expect(problems).toEqual([{ file: "hand.md", reason: expect.stringMatching(/not a valid SVG/) }]);
      expect(await loadIllustration(store, "hand")).toEqual({ ok: false });
    });

    it("notices an SVG that changes or disappears even when the concept file is untouched", async () => {
      await putSvg(VALID);
      await writeConceptAtomic(store, hand(link()));
      expect((await loaded()).concept.hasIllustration).toBe(true);
      await putSvg(wrap('<script>alert(1)</script><rect width="1" height="1"/>'));
      expect((await loaded()).concept.hasIllustration).toBe(false);
      await putSvg(VALID);
      expect((await loaded()).concept.hasIllustration).toBe(true);
      await rm(join(store, "illustrations", "hand.svg"));
      const gone = await loaded();
      expect(gone.concept.hasIllustration).toBe(false);
      expect(gone.problems).toHaveLength(1);
    });

    it("strips the link for the HTTP payload and keeps the text", () => {
      const concept = hand(link());
      expect(withoutIllustrationLink(concept).seeI.illustration).toBe("A drawing.");
      expect(concept.seeI.illustration).toContain("![");
    });
  });
});

describe("illustration writer order (TST-031, AC-037)", () => {
  let dir: string;
  let store: string;
  const input = {
    id: "envelope",
    title: "Envelope",
    layer: "network",
    domains: ["web"],
    concerns: ["security"],
    seeI: { statement: "s", elaboration: "e", example: "x", illustration: "A sealed envelope." },
    relations: [],
    recall: [{ question: "q?" }],
    illustration: VALID,
  };
  const killed = new Error("killed");
  const kill = () => {
    throw killed;
  };
  const exists = (path: string) => readFile(path).then(() => true, () => false);
  const svgFile = () => join(store, "illustrations", "envelope.svg");
  const conceptFile = () => join(store, "concepts", "envelope.md");

  async function noConceptPointsToAMissingFile() {
    const { concepts, problems } = await loadConcepts(store);
    expect(problems).toEqual([]);
    for (const c of concepts) {
      if (c.seeI.illustration.includes("![")) expect(await exists(join(store, "illustrations", `${c.id}.svg`))).toBe(true);
    }
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "arch-mind-order-"));
    store = join(dir, "store");
    await setupStore(store, join(dir, "home", ".arch-mind", "config.json"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("writes the SVG before the concept file", async () => {
    const seen: string[] = [];
    await saveConcept(store, input, {
      afterIllustration: async () => void seen.push(`svg=${await exists(svgFile())} concept=${await exists(conceptFile())}`),
      beforeRename: async () => void seen.push(`svg=${await exists(svgFile())} concept=${await exists(conceptFile())}`),
    });
    expect(seen).toEqual(["svg=true concept=false", "svg=true concept=false"]);
  });

  it.each([
    ["between the SVG and the concept file", { afterIllustration: kill }],
    ["after the concept temp file and before its rename", { beforeRename: kill }],
  ])("a save killed %s leaves an orphan SVG and no concept, and a retry overwrites the orphan", async (_name, hook) => {
    await expect(saveConcept(store, input, hook)).rejects.toBe(killed);
    expect(await exists(svgFile())).toBe(true);
    expect(await exists(conceptFile())).toBe(false);
    expect((await readdir(join(store, "concepts"))).filter((n) => n.endsWith(".tmp"))).toEqual([]);
    await noConceptPointsToAMissingFile();
    expect((await saveConcept(store, input)).ok).toBe(true);
    await noConceptPointsToAMissingFile();
  });

  it("an extend killed between the two writes leaves the stored concept without a link", async () => {
    await saveConcept(store, { ...input, illustration: undefined });
    const before = await readFile(conceptFile(), "utf8");
    await expect(extendConcept(store, { id: "envelope", illustration: VALID }, { afterIllustration: kill })).rejects.toBe(killed);
    expect(await readFile(conceptFile(), "utf8")).toBe(before);
    expect(await exists(svgFile())).toBe(true);
    await noConceptPointsToAMissingFile();
  });
});
