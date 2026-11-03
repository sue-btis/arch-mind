export interface Pictogram {
  id: string;
  meaning: string;
}

export const LAYER_PICTOGRAM_IDS = ["client", "network", "server", "data"] as const;

export const PICTOGRAMS: readonly Pictogram[] = [
  { id: "client", meaning: "A browser window: what runs on the user's device." },
  { id: "network", meaning: "A router with radio waves: the path between client and server." },
  { id: "server", meaning: "A rack of servers: code that answers requests." },
  { id: "data", meaning: "A stack of disks: stored data." },
  { id: "cookie-house", meaning: "A cookie under a roof: a cookie bound to one host." },
  { id: "cookie-lock", meaning: "A cookie with a padlock: a cookie sent only over secure connections." },
  { id: "locked-window", meaning: "A browser window with a padlock: a page the browser treats as secure." },
  { id: "lock-upgrade", meaning: "An open lock and an arrow to a closed one: requests upgraded to a secure channel." },
  { id: "lighthouse", meaning: "A lighthouse: an audit that inspects a page from outside." },
  { id: "policy-sheet", meaning: "A rules sheet beside a compass: a browser engine's own policy." },
  { id: "shield", meaning: "A shield marked S: a rule that enforces secure transport." },
  { id: "secure-pipe", meaning: "A pipe with a padlock: an encrypted connection." },
  { id: "certificate", meaning: "A certificate with a seal: an identity vouched for by an authority." },
  { id: "certificate-authority", meaning: "A seal press: an authority that issues certificates." },
  { id: "signed-document", meaning: "A page signed by its own author: a document vouched for by its signer." },
  { id: "header-filter", meaning: "A header sheet with a funnel: a response header that filters what may load." },
  { id: "terminal-play", meaning: "A terminal with a play button: a server running in production mode." },
  { id: "database", meaning: "A cylinder with a table card: a database that keeps records between requests." },
  { id: "message-queue", meaning: "A belt carrying envelopes toward an arrow: messages waiting their turn to be handled." },
  { id: "background-worker", meaning: "A turning gear: a process that does work outside the request that asked for it." },
  { id: "mutex-lock", meaning: "A padlock with a keyhole: a lock that only one holder can take at a time." },
  { id: "encryption-key", meaning: "A key lying flat: the secret that locks and unlocks encrypted data." },
  { id: "cache", meaning: "A chip with a bolt: a fast copy of data kept close to where it is used." },
  { id: "plugin-module", meaning: "A block hovering over a socket: a module that plugs into a host without changing it." },
  { id: "tenant-building", meaning: "A tall building beside a smaller one: separate tenants sharing one system." },
  { id: "rate-gauge", meaning: "A dial with a needle: a limit on how many requests arrive per period." },
  { id: "gateway", meaning: "A wall with an arched opening: the single entry point that every request passes through." },
];

const IDS: ReadonlySet<string> = new Set(PICTOGRAMS.map((p) => p.id));

export const isPictogramId = (id: string): boolean => IDS.has(id);
