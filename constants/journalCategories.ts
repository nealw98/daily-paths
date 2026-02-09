/**
 * Journal entry types and their configuration.
 * Each entry type has a different editor and set of guided prompts.
 */

export type EntryType =
  | "journal"
  | "gratitude"
  | "spot_check"
  | "nightly_review";
export type EditorType = "text" | "items" | "guided";
export type SvgIconName = "feather" | "seedling" | "softExhale" | "moonOnWater";

export interface GuidedPrompt {
  /** Key in structured_content JSON */
  id: string;
  /** Display label shown above the textarea */
  question: string;
  /** Placeholder text inside the textarea */
  placeholder: string;
  /** Optional hint text shown below the textarea */
  hint?: string;
}

export interface JournalCategory {
  id: EntryType;
  label: string;
  emoji: string;
  icon: string; // Ionicons name
  color: string;
  bgColor: string;
  editorType: EditorType;
  svgIcon: SvgIconName;
  description: string;
  introText?: string;
  guidedPrompts?: GuidedPrompt[];
}

/**
 * Type-specific accent colors for borders, badges, and number circles.
 */
export const ENTRY_TYPE_COLORS = {
  journal: "#2C5F5D",
  gratitude: "#8B6E4E",
  spot_check: "#B8604A",
  nightly_review: "#5B6E8A",
} as const;

/**
 * Tinted background colors (~6-7% opacity) for badges and cards.
 */
export const ENTRY_TYPE_BG_COLORS = {
  journal: "rgba(44, 95, 93, 0.06)",
  gratitude: "rgba(139, 110, 78, 0.07)",
  spot_check: "rgba(184, 96, 74, 0.06)",
  nightly_review: "rgba(91, 110, 138, 0.07)",
} as const;

/**
 * All journal entry types and their configuration.
 */
export const JOURNAL_CATEGORIES: JournalCategory[] = [
  {
    id: "journal",
    label: "Journal",
    emoji: "✏️",
    icon: "create-outline",
    color: ENTRY_TYPE_COLORS.journal,
    bgColor: ENTRY_TYPE_BG_COLORS.journal,
    editorType: "text",
    svgIcon: "feather",
    description: "Write freely about what's on your mind",
  },
  {
    id: "gratitude",
    label: "Gratitude",
    emoji: "✨",
    icon: "heart-outline",
    color: ENTRY_TYPE_COLORS.gratitude,
    bgColor: ENTRY_TYPE_BG_COLORS.gratitude,
    editorType: "items",
    svgIcon: "seedling",
    description: "Count your blessings today",
    introText: "What are you grateful for today?",
  },
  {
    id: "spot_check",
    label: "Spot Check",
    emoji: "⚡",
    icon: "pulse-outline",
    color: ENTRY_TYPE_COLORS.spot_check,
    bgColor: ENTRY_TYPE_BG_COLORS.spot_check,
    editorType: "guided",
    svgIcon: "softExhale",
    description: "Work through what's happening right now",
    introText: "Pause. Breathe. Work through what's happening.",
    guidedPrompts: [
      {
        id: "what_happened",
        question: "What happened?",
        placeholder: "Just the facts — what triggered this?",
      },
      {
        id: "feeling",
        question: "What am I feeling?",
        placeholder: "Name the feelings — fear, anger, hurt...",
        hint: "Where is my fear hiding in this?",
      },
      {
        id: "control",
        question: "Where am I trying to control this?",
        placeholder: "What am I afraid will happen if I let go?",
      },
      {
        id: "my_part",
        question: "What's my part?",
        placeholder: "Am I responding or reacting?",
      },
      {
        id: "next_right_thing",
        question: "What's the next right thing?",
        placeholder: "One small step I can take right now...",
      },
    ],
  },
  {
    id: "nightly_review",
    label: "Nightly Review",
    emoji: "🌙",
    icon: "moon-outline",
    color: ENTRY_TYPE_COLORS.nightly_review,
    bgColor: ENTRY_TYPE_BG_COLORS.nightly_review,
    editorType: "guided",
    svgIcon: "moonOnWater",
    description: "Reflect on your day",
    introText:
      "Take a quiet moment to review your day with honesty and compassion.",
    guidedPrompts: [
      {
        id: "serenity",
        question: "What disturbed my serenity today?",
        placeholder: "What situations or people unsettled me?",
      },
      {
        id: "selfish_dishonest_afraid",
        question: "Where was I selfish, dishonest, or afraid?",
        placeholder: "Be gentle but honest with yourself...",
      },
      {
        id: "amends",
        question: "Do I owe anyone an amend?",
        placeholder: "Is there something I need to make right?",
        hint: "This can wait until tomorrow — just note it here.",
      },
      {
        id: "did_well",
        question: "What did I do well today?",
        placeholder: "Where did I show up for my recovery?",
      },
      {
        id: "grateful",
        question: "What am I grateful for tonight?",
        placeholder: "End the day with gratitude...",
      },
    ],
  },
];

/**
 * Get a category config by its entry type ID.
 */
export function getCategoryById(
  id: EntryType | string | null
): JournalCategory | undefined {
  if (!id) return undefined;
  return JOURNAL_CATEGORIES.find((c) => c.id === id);
}

/**
 * Get the display label for an entry type. Returns "Journal" for plain/unknown entries.
 */
export function getCategoryLabel(id: EntryType | string | null): string {
  const cat = getCategoryById(id);
  return cat ? cat.label : "Journal";
}

/**
 * Get the color for an entry type.
 */
export function getCategoryColor(id: EntryType | string | null): string {
  if (!id || !(id in ENTRY_TYPE_COLORS)) return ENTRY_TYPE_COLORS.journal;
  return ENTRY_TYPE_COLORS[id as EntryType];
}

/**
 * Get the tinted background color for an entry type.
 */
export function getCategoryBgColor(id: EntryType | string | null): string {
  if (!id || !(id in ENTRY_TYPE_BG_COLORS))
    return ENTRY_TYPE_BG_COLORS.journal;
  return ENTRY_TYPE_BG_COLORS[id as EntryType];
}
