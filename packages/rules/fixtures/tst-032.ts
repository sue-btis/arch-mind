import type { Concept, Layer, Relation } from "../src/model.ts";

// The 13 concepts and 15 relations of the DQ-005 discovery probe (TST-032 chain),
// each with a complete SEE-I and one recall question. Relation sources are the
// probe's own and keep its "(not fetched)" / "(unverified)" marks.

const CONFIRMED = "2026-10-30";

const PICTOGRAM_OF: Record<string, string> = {
  "host-prefix": "cookie-house",
  "secure-attr": "cookie-lock",
  "secure-context": "locked-window",
  "webkit-policy": "policy-sheet",
  uir: "lock-upgrade",
  lighthouse: "lighthouse",
  https: "secure-pipe",
  "tls-cert": "certificate",
  "self-signed": "signed-document",
  mkcert: "certificate-authority",
  hsts: "shield",
  "next-start": "terminal-play",
  csp: "header-filter",
};

function concept(
  id: string,
  title: string,
  layer: Layer,
  seeI: [statement: string, elaboration: string, example: string, illustration: string],
  question: string,
  relations: Relation[] = [],
): Concept {
  const [statement, elaboration, example, illustration] = seeI;
  return {
    id,
    title,
    layer,
    ...(PICTOGRAM_OF[id] ? { pictogram: PICTOGRAM_OF[id] } : {}),
    domains: ["web"],
    concerns: ["security"],
    seeI: { statement, elaboration, example, illustration },
    relations,
    episodes: [],
    recall: [{ id: "q1", question, confirmed: CONFIRMED }],
  };
}

export const tst032Concepts: Concept[] = [
  concept(
    "host-prefix",
    "__Host- cookie prefix",
    "client",
    [
      "A cookie named with the __Host- prefix is accepted by the browser only if it is Secure, has Path=/ and sets no Domain.",
      "The prefix lets the browser enforce, at the moment the cookie is stored, the properties that bind it to one host. A server cannot weaken them: a cookie that lacks one is dropped instead of stored.",
      "Set-Cookie: __Host-session=abc; Secure; Path=/ is stored. The same cookie with Domain=example.com is dropped.",
      "A name tag that is only valid if the badge also carries a seal, a fixed location and no list of other buildings.",
    ],
    "Which three properties must a cookie have for the browser to accept the __Host- prefix?",
    [
      {
        type: "requires",
        to: "secure-attr",
        source: "draft-ietf-httpbis-rfc6265bis §4.1.3.2 (also Path=/, no Domain)",
        explanation: "A __Host- cookie is only stored when it carries the Secure attribute.",
      },
    ],
  ),
  concept(
    "secure-attr",
    "Secure cookie attribute",
    "client",
    [
      "The Secure attribute tells the browser to send a cookie only over a connection it considers secure.",
      "It limits where the cookie travels, not who can read it once stored. What counts as secure is decided by the user agent, which is why the same cookie behaves differently on localhost in different browsers.",
      "A cookie with Secure is sent to https://app.example but not to http://app.example.",
      "A letter marked 'deliver only inside a locked mailbox'.",
    ],
    "What does the Secure attribute restrict: where the cookie is sent, or who can read it?",
    [
      {
        type: "sent only over",
        to: "secure-context",
        source: "Hypothesis: the draft says \"secure\" as defined by the user agent",
        explanation: "The browser decides whether the current page is secure before sending the cookie.",
      },
    ],
  ),
  concept(
    "secure-context",
    "Secure context",
    "client",
    [
      "A secure context is a page the browser trusts enough to expose powerful features to, normally one served over HTTPS.",
      "Browsers also treat some local origins as secure for development. Features such as service workers and Secure cookies depend on this decision, so it can differ between browser engines.",
      "A page at https://example.com is a secure context; http://example.com is not.",
      "A room with a locked door where sensitive tools are kept, and a rule about which hallways count as locked.",
    ],
    "Why can the same localhost page be a secure context in one browser and not in another?",
    [
      {
        type: "satisfied by",
        to: "https",
        source: "W3C Secure Contexts (not fetched)",
        explanation: "Serving the page over HTTPS is the usual way to make it a secure context.",
      },
    ],
  ),
  concept(
    "webkit-policy",
    "WebKit cookie policy",
    "client",
    [
      "WebKit applies its own rules about Secure cookies and localhost that differ from other engines.",
      "Observed in the TST-032 episode: a Secure cookie set over http://localhost was rejected in WebKit, so a login that worked in another browser failed there.",
      "Safari refuses a Secure cookie set by a page loaded over http://localhost.",
      "Two border guards applying slightly different lists of friendly towns.",
    ],
    "What happened to a Secure cookie set over http://localhost in WebKit during the TST-032 episode?",
    [
      {
        type: "rejects over http://localhost",
        to: "secure-attr",
        source: "Episode TST-032",
        explanation: "WebKit refused to store a Secure cookie when the page was plain HTTP on localhost.",
      },
      {
        type: "does not treat localhost as",
        to: "secure-context",
        source: "Episode TST-032 (unverified)",
        explanation: "The behavior suggests WebKit does not treat http://localhost as a secure context.",
      },
    ],
  ),
  concept(
    "uir",
    "upgrade-insecure-requests",
    "client",
    [
      "upgrade-insecure-requests is a CSP directive that makes the browser rewrite http:// subresource requests to https:// before sending them.",
      "It helps a site migrating to HTTPS, but on a development server that only speaks HTTP the upgraded requests fail, because nothing answers on HTTPS.",
      "With the directive, a request for http://localhost:3000/app.js becomes https://localhost:3000/app.js and fails if the server has no certificate.",
      "A receptionist who rewrites every visitor's address to the secure entrance even when only the side door exists.",
    ],
    "What happens to an http:// subresource when upgrade-insecure-requests is in force?",
    [
      {
        type: "upgrades requests to",
        to: "https",
        source: "W3C Upgrade Insecure Requests §3.1",
        explanation: "Each insecure request is rewritten to use HTTPS.",
      },
      {
        type: "breaks over http",
        to: "lighthouse",
        source: "Episode TST-032",
        explanation: "A Lighthouse run against an HTTP-only server fails because its requests are upgraded.",
      },
    ],
  ),
  concept(
    "lighthouse",
    "Lighthouse run",
    "client",
    [
      "A Lighthouse run loads a page in a controlled browser and reports performance and best-practice audits.",
      "When the page ships a CSP with upgrade-insecure-requests and the server is HTTP-only, the run cannot load the page's resources, so the audit result is not meaningful.",
      "Running Lighthouse against `next start` on http://localhost:3000 with the CSP header failed in the TST-032 episode.",
      "An inspector who arrives by the front door, which the building has bricked up.",
    ],
    "Why did a Lighthouse run fail against the production-mode local server in TST-032?",
    [
      {
        type: "can ignore errors of",
        to: "self-signed",
        source: "Episode TST-032",
        explanation: "Lighthouse can be told to proceed past certificate errors, which makes a self-signed certificate workable.",
      },
    ],
  ),
  concept(
    "https",
    "HTTPS",
    "network",
    [
      "HTTPS is HTTP carried inside a TLS connection, so the client can verify the server and the traffic is encrypted.",
      "It depends on a certificate the client trusts. Without one, the client either refuses to connect or the user must override the warning.",
      "https://example.com presents a certificate for example.com signed by an authority the browser trusts.",
      "A sealed courier envelope whose seal the receiver can verify against a known registry.",
    ],
    "What does an HTTPS client need from the server before it trusts the connection?",
    [
      {
        type: "requires",
        to: "tls-cert",
        source: "RFC 9110 / RFC 2818 (not fetched)",
        explanation: "The server proves its identity to the client with a TLS certificate.",
      },
    ],
  ),
  concept(
    "tls-cert",
    "TLS certificate",
    "network",
    [
      "A TLS certificate binds a public key to a host name and is signed by an authority the client trusts.",
      "The client checks the signature chain, the host name and the validity dates. A certificate signed by an unknown authority fails the first check.",
      "A certificate for localhost issued by a local certificate authority installed in the browser's trust store.",
      "A passport: it names the holder and carries the stamp of an authority that border control recognizes.",
    ],
    "Which three things does a client check on a TLS certificate?",
  ),
  concept(
    "self-signed",
    "Self-signed certificate",
    "network",
    [
      "A self-signed certificate is signed by its own key instead of by a trusted authority.",
      "Clients have no reason to trust it, so browsers warn and tools fail unless told to ignore the error. It gives encryption without verified identity.",
      "openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem creates one.",
      "A passport you printed for yourself.",
    ],
    "What does a self-signed certificate give you, and what does it not?",
    [
      {
        type: "is a",
        to: "tls-cert",
        source: "RFC 5280 (not fetched)",
        explanation: "It is a TLS certificate whose issuer is the certificate's own subject.",
      },
    ],
  ),
  concept(
    "mkcert",
    "mkcert local CA",
    "network",
    [
      "mkcert creates a local certificate authority, installs it in the system trust store and issues certificates from it.",
      "Browsers on that machine then trust the certificates without warnings, which makes HTTPS on localhost behave like production for development.",
      "mkcert localhost 127.0.0.1 writes a certificate and key that the local browsers accept.",
      "Opening your own passport office and telling the local border guards to recognize its stamp.",
    ],
    "What does mkcert install on the machine so browsers trust its certificates?",
    [
      {
        type: "issues from a local CA",
        to: "tls-cert",
        source: "Episode TST-032 options (unverified)",
        explanation: "mkcert signs the certificate with a CA that only this machine trusts.",
      },
    ],
  ),
  concept(
    "hsts",
    "HSTS",
    "network",
    [
      "HTTP Strict Transport Security is a response header that tells the browser to use HTTPS only for a host, for a stated time.",
      "After the first HTTPS visit the browser upgrades every request to that host itself, and refuses to proceed past certificate errors.",
      "Strict-Transport-Security: max-age=31536000; includeSubDomains",
      "A standing instruction to the receptionist: for this company, always use the secure entrance for a year.",
    ],
    "What does the browser do after it has seen a Strict-Transport-Security header for a host?",
    [
      {
        type: "forces",
        to: "https",
        source: "RFC 6797 (not fetched)",
        explanation: "The browser uses HTTPS for the host without being asked each time.",
      },
      {
        type: "complements",
        to: "uir",
        source: "W3C Upgrade Insecure Requests §1.1, §6.1",
        explanation: "HSTS upgrades navigations and upgrade-insecure-requests upgrades subresources, so sites often use both.",
      },
    ],
  ),
  concept(
    "next-start",
    "next start (prod mode)",
    "server",
    [
      "next start runs a built Next.js application in production mode, with production headers and no development helpers.",
      "Behaviors that differ from next dev, such as the CSP header an application sets only in production, appear here, which makes it the right place to test them.",
      "pnpm build && pnpm start serves the app on http://localhost:3000 with the production CSP.",
      "The dress rehearsal on the real stage with the real lighting.",
    ],
    "Why test the CSP header against next start instead of next dev?",
    [
      {
        type: "sends",
        to: "csp",
        source: "Episode TST-032",
        explanation: "In production mode the application attaches its CSP header to responses.",
      },
    ],
  ),
  concept(
    "csp",
    "CSP response header",
    "server",
    [
      "A Content-Security-Policy response header lists the sources a page may load resources from and the behaviors it allows.",
      "Directives such as script-src narrow what runs; upgrade-insecure-requests changes how requests are sent. The browser enforces the policy for that response.",
      "Content-Security-Policy: default-src 'self'; upgrade-insecure-requests",
      "A guest list on the door that also says which entrance visitors must use.",
    ],
    "Which part of a CSP header caused http requests to be rewritten in TST-032?",
    [
      {
        type: "contains",
        to: "uir",
        source: "Episode TST-032",
        explanation: "The production CSP included the upgrade-insecure-requests directive.",
      },
    ],
  ),
];

export const tst032RelationCount = tst032Concepts.reduce((n, c) => n + c.relations.length, 0);

// A hub related to 13 server concepts: elk ranks the spokes together in one row, so the plates are far wider than the board.
export const overWideConcepts: Concept[] = [
  concept(
    "wide-hub",
    "Wide hub",
    "client",
    ["Statement.", "Elaboration.", "Example.", "Illustration."],
    "What is this?",
    Array.from({ length: 13 }, (_, i) => ({
      type: "uses",
      to: `wide-${i + 1}`,
      source: "Fixture",
      explanation: "The hub uses each spoke.",
    })),
  ),
  ...Array.from({ length: 13 }, (_, i) =>
    concept(`wide-${i + 1}`, `Wide spoke ${i + 1}`, "server", ["Statement.", "Elaboration.", "Example.", "Illustration."], "What is this?"),
  ),
];
