/**
 * Official ABFM Blueprint Clinical Content Areas / Types of Care
 * Defined in the ABFM In-Training Examination & Board Certification Handbook.
 */

export const CANONICAL_CARE_DIMENSIONS = [
  'Acute Care and Diagnosis',
  'Chronic Care Management',
  'Emergent and Urgent Care',
  'Preventive Care',
  'Foundations of Care',
] as const;

export type CareDimension = typeof CANONICAL_CARE_DIMENSIONS[number];

export interface CareDimensionMeta {
  label: CareDimension;
  blueprintWeight: string; // approximate exam share
  color: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  description: string;
}

export const CARE_DIMENSION_META: Record<CareDimension, CareDimensionMeta> = {
  'Acute Care and Diagnosis': {
    label: 'Acute Care and Diagnosis',
    blueprintWeight: '~35–40%',
    color: '#0284c7', // sky-600
    badgeBg: 'bg-sky-50 dark:bg-sky-950/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
    badgeBorder: 'border-sky-200 dark:border-sky-800',
    description: 'Acute symptom presentations, differential diagnosis, and initial outpatient management.',
  },
  'Chronic Care Management': {
    label: 'Chronic Care Management',
    blueprintWeight: '~20–25%',
    color: '#8b5cf6', // purple-500
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40',
    badgeText: 'text-purple-700 dark:text-purple-300',
    badgeBorder: 'border-purple-200 dark:border-purple-800',
    description: 'Long-term disease management, medication titration, guidelines, and monitoring.',
  },
  'Emergent and Urgent Care': {
    label: 'Emergent and Urgent Care',
    blueprintWeight: '~18–20%',
    color: '#ef4444', // red-500
    badgeBg: 'bg-red-50 dark:bg-red-950/40',
    badgeText: 'text-red-700 dark:text-red-300',
    badgeBorder: 'border-red-200 dark:border-red-800',
    description: 'Immediate stabilization, emergency department workups, acute trauma, and critical care.',
  },
  'Preventive Care': {
    label: 'Preventive Care',
    blueprintWeight: '~15%',
    color: '#10b981', // emerald-500
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-200 dark:border-emerald-800',
    description: 'USPSTF screening recommendations, immunizations, wellness visits, and lifestyle counseling.',
  },
  'Foundations of Care': {
    label: 'Foundations of Care',
    blueprintWeight: '~5–10%',
    color: '#f59e0b', // amber-500
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeBorder: 'border-amber-200 dark:border-amber-800',
    description: 'Medical ethics, health equity, biostatistics, epidemiology, healthcare systems, and billing.',
  },
};

export function getCareDimensionMeta(dim?: string | null): CareDimensionMeta | null {
  if (!dim) return null;
  const match = CANONICAL_CARE_DIMENSIONS.find(
    c => c.toLowerCase() === dim.toLowerCase()
  );
  return match ? CARE_DIMENSION_META[match] : null;
}
