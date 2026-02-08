/**
 * Journal reflection questions organized by category.
 * These are display-only prompts for the freeform journal entry's
 * "Questions to ask myself" accordion.
 *
 * Spot Check and Nightly Review questions are now handled as guided prompts
 * in journalCategories.ts — they have their own structured form UI.
 */

export interface QuestionCategory {
  id: string;
  title: string;
  questions: string[];
}

export const JOURNAL_QUESTION_CATEGORIES: QuestionCategory[] = [
  {
    id: "control",
    title: "Control & Powerlessness",
    questions: [
      "Where am I trying to control what I can't control?",
      "What am I afraid will happen if I let go?",
      "What would change if I accepted powerlessness here?",
      "If this situation never changes, what needs to change in me?",
    ],
  },
  {
    id: "my_part",
    title: "My Part",
    questions: [
      "What's my part in this?",
      "How am I making this about me when it's not?",
      "What am I getting out of staying in this pattern?",
      "Am I responding or reacting?",
    ],
  },
  {
    id: "fear_resentment",
    title: "Fear & Resentment",
    questions: [
      "What am I really afraid of here?",
      "Where is my fear hiding in this resentment?",
      "What's the cost of holding onto this?",
    ],
  },
  {
    id: "acceptance_growth",
    title: "Acceptance & Growth",
    questions: [
      "What do I need to accept that I'm refusing to accept?",
      'What does "detachment with love" look like right now?',
      "What would it look like to trust the process here?",
      "What is this situation teaching me?",
    ],
  },
];
