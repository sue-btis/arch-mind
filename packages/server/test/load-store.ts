import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { addDays, writeConceptAtomic, type Concept } from "@arch-mind/rules";
import { tst032Concepts } from "@arch-mind/rules/fixtures";

export const LOAD = { concepts: 300, questionsPerConcept: 2, reviewsPerQuestion: 12 };

const noon = (daysAgo: number, today: string) => {
  const [y, m, d] = addDays(today, -daysAgo).split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12).toISOString();
};

export async function writeLoadStore(store: string, today: string): Promise<{ questions: number; reviewLines: number }> {
  const template = tst032Concepts[0]!;
  const questions: string[] = [];
  const idOf = (i: number) => `load-${String(i % LOAD.concepts).padStart(3, "0")}`;
  for (let i = 0; i < LOAD.concepts; i++) {
    const id = idOf(i);
    const concept: Concept = {
      ...template,
      id,
      title: `Load concept ${i}`,
      relations: Array.from({ length: (i % 3) + 1 }, (_, r) => ({
        type: r % 2 === 0 ? "contains" : "sends",
        to: idOf(i + r + 1),
        source: `https://example.org/specs/${i}/section-${r + 1}`,
        explanation: `Load concept ${i} relates to load concept ${i + r + 1} because the generated store needs files of realistic size.`,
      })),
      episodes: [{ project: "arch-mind", situation: `Generated situation ${i}: the concept came up while checking the load profile of the store.`, date: addDays(today, -(i % 300)) }],
      recall: Array.from({ length: LOAD.questionsPerConcept }, (_, q) => ({
        id: `q${q + 1}`,
        question: `Question ${q + 1} of load concept ${i}?`,
        confirmed: addDays(today, -365),
      })),
    };
    await writeConceptAtomic(store, concept);
    questions.push(...concept.recall.map((q) => `${id}#${q.id}`));
  }

  // Chronological, spread over the last year, with a few wrong answers so boxes reset along the way.
  const lines: string[] = [];
  for (let j = 0; j < LOAD.reviewsPerQuestion; j++) {
    questions.forEach((question, k) => {
      const result = (j + k) % 5 === 0 ? "wrong" : "right";
      lines.push(JSON.stringify({ question, at: noon(360 - 30 * j - (k % 25), today), result }));
    });
  }
  await writeFile(join(store, "reviews.jsonl"), `${lines.join("\n")}\n`);
  return { questions: questions.length, reviewLines: lines.length };
}
