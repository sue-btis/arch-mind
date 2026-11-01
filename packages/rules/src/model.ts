export const LAYERS = ["client", "network", "server", "data"] as const;
export type Layer = (typeof LAYERS)[number];

export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const SEE_I_PARTS = ["statement", "elaboration", "example", "illustration"] as const;
export type SeeIPart = (typeof SEE_I_PARTS)[number];
export type SeeI = Record<SeeIPart, string>;

export interface Relation {
  type: string;
  to: string;
  source: string;
  explanation: string;
}

export interface Episode {
  project: string;
  situation: string;
  date?: string;
}

export interface Recall {
  id: string;
  question: string;
  confirmed: string;
}

export interface Concept {
  id: string;
  title: string;
  layer: Layer;
  domains: string[];
  concerns: string[];
  seeI: SeeI;
  relations: Relation[];
  episodes: Episode[];
  recall: Recall[];
}

export interface Facets {
  domains: string[];
  concerns: string[];
  leitnerIntervalsDays: number[];
}

export type RejectionRule =
  | "missing_source"
  | "missing_target"
  | "duplicate_id"
  | "duplicate_relation"
  | "unknown_concept"
  | "unknown_facet"
  | "incomplete_see_i"
  | "no_recall"
  | "nothing_to_add"
  | "invalid_shape";

export interface RuleError {
  path: string;
  rule: RejectionRule;
  message: string;
}

export interface FileProblem {
  file: string;
  reason: string;
}

export interface ReviewLine {
  question: string;
  at: string;
  result: "right" | "wrong";
}

export interface QuestionState {
  question: string;
  conceptId: string;
  text: string;
  box: number;
  due: string;
}
