import type { WritingPrompt } from "@/data/writing";

export type WritingReviewItem = {
  id: string;
  kind: "clarity" | "specificity" | "structure" | "repetition" | "wordiness" | "grammar" | "prompt_alignment" | "voice";
  excerpt?: string;
  message: string;
  question?: string;
};

export const writingWordCount = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;

const excerpt = (value: string, max = 150) => value.length <= max ? value : value.slice(0, max - 1).trimEnd() + "…";

export function reviewWriting(content: string, prompt: WritingPrompt): WritingReviewItem[] {
  const items: WritingReviewItem[] = [];
  const sentences = content.match(/[^.!?\n]+[.!?]?/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
  const paragraphs = content.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const words = writingWordCount(content);
  if (prompt.wordLimit && words > prompt.wordLimit) {
    items.push({ id: "limit", kind: "wordiness", message: "This draft is " + (words - prompt.wordLimit) + " words over the verified limit.", question: "Which setup or repeated point can you remove without losing meaning?" });
  }
  for (const [index, sentence] of sentences.entries()) {
    const count = writingWordCount(sentence);
    if (count > 40) items.push({ id: "long-" + index, kind: "clarity", excerpt: excerpt(sentence), message: "This sentence is " + count + " words and may be difficult to follow.", question: "Could one idea end earlier and the next begin in a new sentence?" });
  }
  const genericPatterns = [
    /ever since i was young/i,
    /this taught me the importance of/i,
    /i learned that anything is possible/i,
    /outside (?:of )?my comfort zone/i,
    /make the world a better place/i,
  ];
  for (const [index, pattern] of genericPatterns.entries()) {
    const match = content.match(pattern);
    if (match) items.push({ id: "generic-" + index, kind: "voice", excerpt: match[0], message: "This phrase appears often in application writing, so it may sound less like the rest of your draft.", question: "What specific detail or phrasing would sound more natural to you?" });
  }
  const abstract = sentences.find((sentence) => /\b(leadership|passion|impact|community|resilience|growth)\b/i.test(sentence) && !/\d/.test(sentence));
  if (abstract) items.push({ id: "specificity", kind: "specificity", excerpt: excerpt(abstract), message: "This sentence names an idea without showing the reader a concrete moment.", question: "What interaction, choice, object, place, or line of dialogue could show this?" });
  const normalizedWords = content.toLowerCase().match(/[a-z']{5,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const word of normalizedWords) counts.set(word, (counts.get(word) ?? 0) + 1);
  const repeated = [...counts.entries()].filter(([word, count]) => count >= 4 && !["about", "after", "because", "could", "their", "there", "these", "thing", "through", "where", "which", "would"].includes(word)).sort((a, b) => b[1] - a[1])[0];
  if (repeated) items.push({ id: "repeat-" + repeated[0], kind: "repetition", excerpt: repeated[0], message: "You use this word " + repeated[1] + " times. Some repetition may be intentional.", question: "Does each use add something new?" });
  if (paragraphs.length > 1 && paragraphs.slice(1).some((paragraph) => /^(also|additionally|furthermore|moreover),?/i.test(paragraph))) {
    items.push({ id: "transition", kind: "structure", message: "One paragraph opens with a formal transition that may feel different from the surrounding voice.", question: "Could the next scene or idea create the connection on its own?" });
  }
  if (/ {2,}|\t/.test(content)) items.push({ id: "spacing", kind: "grammar", message: "This draft contains uneven spacing. Copying plain text will normalize it." });
  if (words > 80 && prompt.type === "why_us" && !new RegExp(prompt.institutionName?.split(" ")[0] ?? "$^", "i").test(content)) {
    items.push({ id: "alignment", kind: "prompt_alignment", message: "This response does not yet name the institution or a specific part of it.", question: "Which part of your own research belongs in this answer?" });
  }
  return items.slice(0, 8);
}

export function cuttingSuggestions(content: string): WritingReviewItem[] {
  const suggestions: WritingReviewItem[] = [];
  const phrases: Array<[RegExp, string]> = [
    [/\bin order to\b/gi, "Consider whether “to” carries the same meaning."],
    [/\bdue to the fact that\b/gi, "Consider whether “because” is clearer."],
    [/\bat this point in time\b/gi, "Consider whether “now” is enough."],
    [/\bit is important to note that\b/gi, "The sentence may work without this setup."],
    [/\bi personally\b/gi, "“I” may already make this personal."],
  ];
  for (const [index, [pattern, message]] of phrases.entries()) {
    const match = content.match(pattern);
    if (match) suggestions.push({ id: "cut-" + index, kind: "wordiness", excerpt: match[0], message });
  }
  return suggestions;
}
