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
];

const IDS: ReadonlySet<string> = new Set(PICTOGRAMS.map((p) => p.id));

export const isPictogramId = (id: string): boolean => IDS.has(id);
