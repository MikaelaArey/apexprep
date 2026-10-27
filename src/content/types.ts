// Content model. Questions are authored as YAML in /content and compiled by
// scripts/build-content.mjs into src/content/generated/*.json (the packs).

export type Exam = 'LSAT' | 'MCAT';
export type SectionId = 'LR' | 'RC' | 'CP' | 'CARS' | 'BB' | 'PS';
export type OptionId = 'A' | 'B' | 'C' | 'D' | 'E';
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface AnswerOption {
  id: OptionId;
  text: string;
  correct: boolean;
  /** Trap tag for wrong answers (see taxonomy.json `traps`); null for the right answer. */
  trap: string | null;
  /** One or two sentences: why this choice is right or wrong. */
  why: string;
}

export interface ExplanationStep {
  label: string;
  body: string;
}

export interface DataTable {
  caption?: string;
  columns: string[];
  rows: string[][];
}

export interface Item {
  id: string;
  version: number;
  exam: Exam;
  section: SectionId;
  /** Set when the question belongs to a passage set. */
  passageId: string | null;
  position: number | null;
  /** Question type (LSAT) or topic (MCAT); keys of taxonomy.json `types`. */
  type: string;
  /** LSAT question family, MCAT discipline or CARS skill; keys of taxonomy.json `families`. */
  family: string;
  knowledgePoints: string[];
  /** AAMC content category and Scientific Inquiry & Reasoning Skill (MCAT only). */
  outline?: { category?: string; sirs?: number };
  difficulty: Difficulty;
  targetSec: number;
  stimulus?: string;
  prompt: string;
  table?: DataTable;
  options: AnswerOption[];
  tldr: string;
  steps: ExplanationStep[];
  takeaway: string;
  /** Questions that test the same idea, used for re-tests after a miss. */
  siblings: string[];
  status: 'draft' | 'review' | 'live';
}

export interface Passage {
  id: string;
  exam: Exam;
  section: SectionId;
  title: string;
  domain: string;
  paragraphs: string[];
  table?: DataTable;
  /** Mini-passages are the short, phone-sized format (150–250 words). */
  mini: boolean;
  itemIds: string[];
}

export interface KnowledgePoint {
  id: string;
  exam: Exam;
  section: SectionId;
  title: string;
  /** Concept card prompt and answer, used in spaced review. */
  front: string;
  back: string;
}

export interface ContentPack {
  exam: Exam;
  version: string;
  generatedAt: string;
  items: Item[];
  passages: Passage[];
  knowledgePoints: KnowledgePoint[];
}
