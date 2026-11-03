export const MAX_SVG_CHARS = 200_000;

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

const ELEMENTS = new Set([
  "svg", "g", "defs", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "linearGradient", "radialGradient", "stop", "use", "clipPath", "mask",
]);

const ATTRIBUTES = new Set([
  "id", "class", "style", "transform", "xmlns", "xmlns:xlink", "xml:space", "version", "viewBox", "preserveAspectRatio",
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "width", "height", "d", "points", "dx", "dy",
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "opacity", "clip-path", "clip-rule", "mask",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "letter-spacing",
  "text-decoration", "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform", "spreadMethod",
  "clipPathUnits", "maskUnits", "maskContentUnits", "href", "xlink:href", "aria-label", "aria-hidden",
]);

const NAME = /^[A-Za-z_][-A-Za-z0-9_.]*(?::[A-Za-z_][-A-Za-z0-9_.]*)?$/;
const FRAGMENT = /^#[A-Za-z_][-A-Za-z0-9_.]*$/;
const REFERENCE = /&(?:#[0-9]+|#x[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g;
// XML 1.0 Char production. With the u flag a lone surrogate is one code point, so it matches the negated class.
const NON_XML_CHARACTER = /[^\t\n\r\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/u;
// XML whitespace is only space, tab, carriage return and line feed; JS trim() also strips U+00A0, U+FEFF and others.
const isXmlBlank = (text: string) => /^[ \t\r\n]*$/.test(text);
const XML_DECLARATION =
  /^<\?xml[ \t\r\n]+version[ \t\r\n]*=[ \t\r\n]*(?:"1\.[0-9]+"|'1\.[0-9]+')(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(?:"[A-Za-z][A-Za-z0-9._-]*"|'[A-Za-z][A-Za-z0-9._-]*'))?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(?:"(?:yes|no)"|'(?:yes|no)'))?[ \t\r\n]*\?>$/;
const withoutBlanks = (text: string) => [...text].filter((c) => c.charCodeAt(0) > 32).join("").toLowerCase();

const referencedCode = (ref: string) => (ref.startsWith("&#x") ? parseInt(ref.slice(3, -1), 16) : parseInt(ref.slice(2, -1), 10));

function decode(raw: string): string {
  return raw.replace(REFERENCE, (ref) => {
    if (ref.startsWith("&#")) return String.fromCodePoint(referencedCode(ref));
    return { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" }[ref] ?? ref;
  });
}

// Only the five predefined entities and numeric references to XML characters exist: a DOCTYPE is rejected, so no other
// entity can be declared. Checking before decode() keeps String.fromCodePoint from ever seeing an out-of-range value.
const hasInvalidReference = (raw: string) =>
  /&/.test(raw.replace(REFERENCE, "")) ||
  [...raw.matchAll(REFERENCE)].some(([ref]) => {
    if (!ref.startsWith("&#")) return false;
    const code = referencedCode(ref);
    return code > 0x10ffff || NON_XML_CHARACTER.test(String.fromCodePoint(code));
  });

// Attributes whose value the browser parses as a CSS declaration value. They and the `style` attribute are held to the
// same grammar, so a fetching form (url() to a target, image-set(), @import, escapes) has no token to hide in.
const CSS_ATTRIBUTES = new Set([
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "opacity", "clip-path", "clip-rule", "mask",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline", "letter-spacing",
  "text-decoration", "stop-color", "stop-opacity",
]);

const CSS_VALUE_TOKENS = [
  /\s+|,/y,
  /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})(?![\w-])/iy,
  /(?:rgba?|hsla?)\([0-9a-z.%\s,/+-]*\)/iy,
  /url\(\s*(["']?)#[A-Za-z_][-A-Za-z0-9_.]*\1\s*\)/y,
  /[+-]?(?:\d+\.?\d*|\.\d+)(?:%|[a-z]+)?(?![\w.%-])/iy,
  /-?[a-z][a-z0-9-]*(?![\w(-])/iy,
];
const CSS_FONT_NAME = /(["'])[A-Za-z0-9 _-]*\1/y;

function cssValueProblems(attr: string, property: string, value: string): string[] {
  const tokens = property === "font-family" ? [...CSS_VALUE_TOKENS, CSS_FONT_NAME] : CSS_VALUE_TOKENS;
  for (let i = 0; i < value.length; ) {
    const next = tokens.map((re) => ((re.lastIndex = i), re.exec(value))).find((m) => m !== null && m[0].length > 0);
    if (!next) return [`attribute "${attr}" has a CSS value outside colors, numbers, lengths, keywords and url(#fragment)`];
    i += next[0].length;
  }
  return [];
}

function styleProblems(value: string): string[] {
  const problems: string[] = [];
  for (const declaration of value.split(";")) {
    if (declaration.trim() === "") continue;
    const colon = declaration.indexOf(":");
    const property = declaration.slice(0, colon).trim().toLowerCase();
    if (colon === -1 || !CSS_ATTRIBUTES.has(property)) {
      problems.push(`the style attribute declares "${declaration.trim()}", which is not an allowed property`);
    } else {
      problems.push(...cssValueProblems("style", property, declaration.slice(colon + 1)));
    }
  }
  return problems;
}

// Values of attributes that are not CSS (paths, transforms, hrefs, labels): defense in depth against schemes and code.
function valueProblems(attr: string, rawValue: string): string[] {
  const problems: string[] = [];
  const value = decode(rawValue);
  const compact = withoutBlanks(value);
  if (compact.includes("javascript:")) problems.push(`attribute "${attr}" holds a javascript: URL`);
  if (compact.includes("data:")) problems.push(`attribute "${attr}" holds a data: URL`);
  if (compact.includes("@import")) problems.push(`attribute "${attr}" holds an @import`);
  if (compact.includes("expression(")) problems.push(`attribute "${attr}" holds a CSS expression`);
  for (const m of value.matchAll(/url\(\s*([^)]*)\)/gi)) {
    const target = (m[1] ?? "").trim().replace(/^["']|["']$/g, "").trim();
    if (!FRAGMENT.test(target)) problems.push(`attribute "${attr}" has a url() that is not a local fragment`);
  }
  if ((attr === "href" || attr === "xlink:href") && !FRAGMENT.test(value.trim())) {
    problems.push(`attribute "${attr}" must be a local fragment such as "#id"`);
  }
  return problems;
}

interface Tag {
  name: string;
  attrs: [string, string][];
  closing: boolean;
  selfClosing: boolean;
  end: number;
}

// Hand-written on purpose (no XML parser is a dependency): it accepts only the plain tag shapes the allowlist needs and
// reports anything else as malformed, so an unusual construct is rejected rather than interpreted.
function readTag(text: string, start: number): Tag | string {
  const at = (re: RegExp, from: number) => {
    re.lastIndex = from;
    return re.exec(text);
  };
  let i = start + 1;
  const closing = text[i] === "/";
  if (closing) i++;
  const nameMatch = at(/[A-Za-z][A-Za-z0-9]*/y, i);
  if (!nameMatch) return "a tag has no valid element name";
  const name = nameMatch[0];
  i += name.length;
  const attrs: [string, string][] = [];
  const seen = new Set<string>();
  for (;;) {
    const space = at(/[ \t\r\n]*/y, i)![0];
    i += space.length;
    if (text.startsWith("/>", i)) return { name, attrs, closing, selfClosing: true, end: i + 2 };
    if (text[i] === ">") return { name, attrs, closing, selfClosing: false, end: i + 1 };
    if (closing || space.length === 0) return `element "${name}" is not well-formed`;
    const attr = at(/[^\s=/>"'<]+/y, i);
    if (!attr || !NAME.test(attr[0])) return `element "${name}" has a malformed attribute name`;
    i += attr[0].length;
    const eq = at(/[ \t\r\n]*=[ \t\r\n]*/y, i);
    if (!eq) return `attribute "${attr[0]}" on "${name}" has no value`;
    i += eq[0].length;
    const quote = text[i];
    if (quote !== '"' && quote !== "'") return `attribute "${attr[0]}" on "${name}" is not quoted`;
    const close = text.indexOf(quote, i + 1);
    if (close === -1) return `attribute "${attr[0]}" on "${name}" is not closed`;
    const value = text.slice(i + 1, close);
    if (value.includes("<")) return `attribute "${attr[0]}" on "${name}" contains "<"`;
    if (hasInvalidReference(value)) return `attribute "${attr[0]}" on "${name}" has an undeclared entity or an invalid character reference`;
    if (seen.has(attr[0])) return `element "${name}" repeats attribute "${attr[0]}"`;
    seen.add(attr[0]);
    attrs.push([attr[0], value]);
    i = close + 1;
  }
}

export function validateSvg(source: string): string[] {
  // A UTF-8 byte order mark is an encoding signature the browser consumes, not text outside the root.
  const text = source.startsWith("﻿") ? source.slice(1) : source;
  const reasons = new Set<string>();
  const fail = (reason: string) => {
    reasons.add(reason);
    return [...reasons];
  };
  if (isXmlBlank(text)) return fail("the SVG is empty");
  if (text.length > MAX_SVG_CHARS) return fail(`the SVG has ${text.length} characters; the limit is ${MAX_SVG_CHARS}`);
  if (NON_XML_CHARACTER.test(text)) return fail("the SVG contains a control character or another character XML does not allow");

  const stack: string[] = [];
  const scopes: Set<string>[] = [];
  let rootClosed = false;
  let rootSeen = false;
  let i = 0;
  let first = true;
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    const chunk = text.slice(i, lt === -1 ? text.length : lt);
    const inElement = stack.length > 0;
    if (!isXmlBlank(chunk) && !inElement) fail("the SVG has text outside its root element");
    if (hasInvalidReference(chunk)) fail("the SVG uses an entity reference other than &amp; &lt; &gt; &quot; &apos; or a numeric one to an XML character");
    if (chunk.includes("]]>")) fail("the SVG has ]]> in its text");
    if (lt === -1) break;
    i = lt;

    if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end === -1) return fail("a comment is not closed");
      const comment = text.slice(i + 4, end);
      if (comment.includes("--") || comment.endsWith("-")) fail("a comment contains -- or ends with -");
      i = end + 3;
      first = false;
      continue;
    }
    if (text.startsWith("<![CDATA[", i)) {
      fail("CDATA sections are not allowed");
      return [...reasons];
    }
    if (/^<!doctype/i.test(text.slice(i, i + 9))) {
      fail("a DOCTYPE is not allowed");
      return [...reasons];
    }
    if (text.startsWith("<!", i)) {
      fail("declarations such as ENTITY are not allowed");
      return [...reasons];
    }
    if (text.startsWith("<?", i)) {
      const end = text.indexOf("?>", i + 2);
      const isXmlDeclaration = first && i === 0 && end !== -1 && XML_DECLARATION.test(text.slice(i, end + 2));
      if (!isXmlDeclaration) {
        fail("processing instructions are not allowed (only a leading XML declaration)");
        return [...reasons];
      }
      i = end + 2;
      first = false;
      continue;
    }
    first = false;

    const tag = readTag(text, i);
    if (typeof tag === "string") {
      fail(tag);
      return [...reasons];
    }
    i = tag.end;
    const { name } = tag;

    if (tag.closing) {
      scopes.pop();
      if (stack.pop() !== name) {
        fail(`closing tag "${name}" does not match an open element`);
        return [...reasons];
      }
      if (stack.length === 0) rootClosed = true;
      continue;
    }

    if (!ELEMENTS.has(name)) fail(`element "${name}" is not allowed`);
    if (stack.length === 0) {
      if (rootSeen || rootClosed) fail("the SVG has more than one root element");
      rootSeen = true;
      if (name !== "svg") fail('the root element must be "svg"');
      else if (!tag.attrs.some(([a, v]) => a === "xmlns" && v === SVG_NS)) fail(`the root svg needs xmlns="${SVG_NS}"`);
    } else if (name === "svg") {
      fail("a nested svg element is not allowed");
    }
    const declared = new Set(tag.attrs.filter(([a]) => a.startsWith("xmlns:")).map(([a]) => a.slice(6)));
    const bound = (prefix: string) => prefix === "xml" || declared.has(prefix) || scopes.some((s) => s.has(prefix));
    for (const [attr, value] of tag.attrs) {
      if (/^on/i.test(attr)) fail(`event handler attribute "${attr}" is not allowed`);
      else if (!ATTRIBUTES.has(attr)) fail(`attribute "${attr}" is not allowed`);
      else if (attr === "xmlns:xlink" && value !== XLINK_NS) fail('xmlns:xlink must be the XLink namespace');
      else if (attr === "xmlns" && value !== SVG_NS) fail("xmlns must be the SVG namespace");
      else {
        const decoded = decode(value);
        const problems = CSS_ATTRIBUTES.has(attr)
          ? cssValueProblems(attr, attr, decoded)
          : attr === "style"
            ? styleProblems(decoded)
            : valueProblems(attr, value);
        for (const r of problems) fail(r);
      }
      const prefix = attr.split(":")[0];
      if (attr.includes(":") && prefix !== "xmlns" && !bound(prefix!)) fail(`prefix "${prefix}" is not bound to a namespace`);
    }
    if (!tag.selfClosing) {
      stack.push(name);
      scopes.push(declared);
    }
    else if (stack.length === 0) rootClosed = true;
  }
  if (stack.length > 0) fail(`element "${stack.at(-1)}" is not closed`);
  if (!rootSeen) fail("the SVG has no root element");
  return [...reasons];
}
