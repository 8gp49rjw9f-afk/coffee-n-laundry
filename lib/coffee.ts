/* Fixed vocabularies. Kept apart from the database readers so client
   components can import them without pulling in next/headers. */

export const AMBIENCE = [
  { key: "cosy", label: "Cosy", emoji: "🕯️" },
  { key: "minimal", label: "Minimal", emoji: "◻️" },
  { key: "lively", label: "Lively", emoji: "🎶" },
  { key: "quiet", label: "Quiet", emoji: "🤫" },
  { key: "work-friendly", label: "Work-friendly", emoji: "💻" },
  { key: "outdoor-seating", label: "Outdoor seating", emoji: "🌤️" },
] as const;

export const AMBIENCE_LABEL: Record<string, string> = Object.fromEntries(
  AMBIENCE.map((a) => [a.key, a.label])
);

export const AMBIENCE_EMOJI: Record<string, string> = Object.fromEntries(
  AMBIENCE.map((a) => [a.key, a.emoji])
);

/* Three values, not four: "2nd/3rd wave" means nothing to someone
   who just wants a decent espresso. */
export const COFFEE_KINDS = [
  { key: "regular", label: "Regular" },
  { key: "barista", label: "Specialty / Barista" },
  { key: "both", label: "Both" },
] as const;

/*
 * What a coffee shop serves besides coffee. Four choices, deliberately
 * coarse: the point is to answer "can I eat something here?", not to
 * reproduce a menu that changes every week.
 */
export const FOOD = [
  { key: "full_meals", label: "Full meals", emoji: "🍽️" },
  { key: "vegan", label: "Vegan", emoji: "🌱" },
  { key: "sandwich", label: "Sandwich", emoji: "🥪" },
  { key: "pastries", label: "Pastries", emoji: "🥐" },
] as const;

export const FOOD_LABEL: Record<string, string> = Object.fromEntries(
  FOOD.map((f) => [f.key, f.label])
);

export const FOOD_EMOJI: Record<string, string> = Object.fromEntries(
  FOOD.map((f) => [f.key, f.emoji])
);
