import taxonomy from './taxonomy.json';
import type { Exam, SectionId } from './types';

export interface ExamInfo {
  name: string;
  full: string;
  sections: SectionId[];
  score: { min: number; max: number; default: number };
  optionCount: number;
}

export interface SectionInfo {
  exam: Exam;
  short: string;
  name: string;
  weight: number;
  targetSec: number;
}

export const EXAMS = taxonomy.exams as Record<Exam, ExamInfo>;
export const SECTIONS = taxonomy.sections as Record<SectionId, SectionInfo>;
export const TRAPS = taxonomy.traps as Record<string, { name: string; desc: string }>;
export const MISS_REASONS = taxonomy.missReasons as Record<string, string>;

const TYPES = taxonomy.types as Record<string, { name: string; section: SectionId }>;
const FAMILIES = taxonomy.families as Record<string, string>;

export function typeName(type: string): string {
  return TYPES[type]?.name ?? type;
}

export function familyName(family: string): string {
  return FAMILIES[family] ?? family;
}

export function typesForSection(section: SectionId): string[] {
  return Object.keys(TYPES).filter((t) => TYPES[t].section === section);
}

export function sectionName(section: SectionId): string {
  return SECTIONS[section].name;
}

export function otherExam(exam: Exam): Exam {
  return exam === 'LSAT' ? 'MCAT' : 'LSAT';
}
