import { LAYERS, type Concept, type Layer } from "@arch-mind/rules/model";

export const NO_DOMAIN = "No domain";

export const groupOf = (c: Concept) => c.domains[0] ?? NO_DOMAIN;
export const groupId = (layer: Layer, domain: string) => `group:${layer}:${domain}`;
export const groupIdOf = (c: Concept) => groupId(c.layer, groupOf(c));

// Domains may contain ":", so only the first two separators belong to the id.
export function parseGroupId(id: string): { layer: Layer; domain: string } {
  const [, layer, ...domain] = id.split(":");
  return { layer: layer as Layer, domain: domain.join(":") };
}

export interface ConceptGroup {
  id: string;
  layer: Layer;
  domain: string;
  members: Concept[];
}

// One group per (layer, first-listed domain), in plate order and then in the order the domains first appear.
export function groupConcepts(concepts: Concept[]): ConceptGroup[] {
  const groups = new Map<string, ConceptGroup>();
  for (const layer of LAYERS) {
    for (const c of concepts.filter((x) => x.layer === layer)) {
      const id = groupIdOf(c);
      const group = groups.get(id) ?? { id, layer, domain: groupOf(c), members: [] };
      group.members.push(c);
      groups.set(id, group);
    }
  }
  return [...groups.values()];
}
