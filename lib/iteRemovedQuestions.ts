// Official question deletions from the ABFM In-Training Examination Handbooks (Section IV: Scoring by Hand)

export interface RemovedQuestionInfo {
  year: '2023' | '2024' | '2025';
  itemNumber: number;
  reason: 'Content Delete' | 'Psychometric Delete';
  description?: string;
}

export const REMOVED_BY_ABFM_MAP: Record<string, RemovedQuestionInfo> = {
  // --- 2023 ITE Deletions (Scored out of 198) ---
  'a82e9999-85ef-4ea5-8d44-ea252fba9f74': {
    year: '2023',
    itemNumber: 67,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  'f606765e-a8f5-497f-8994-00aa32ef06d1': {
    year: '2023',
    itemNumber: 129,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },

  // --- 2024 ITE Deletions (Scored out of 194) ---
  '60f0975c-3c48-43aa-b0f2-0b92811941d2': {
    year: '2024',
    itemNumber: 6,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '87477317-8997-4ca2-8b36-17e6037849ee': {
    year: '2024',
    itemNumber: 35,
    reason: 'Psychometric Delete',
    description: 'Removed by ABFM due to psychometric misbehavior/drift'
  },
  '585bcff3-65a5-4d8e-bb38-c5ab3668daab': {
    year: '2024',
    itemNumber: 64,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  'fde31d16-381c-40a3-b2e1-34b021ecb13a': {
    year: '2024',
    itemNumber: 163,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '29bf1842-c4cc-4a29-b1bd-a295b9f2f2d2': {
    year: '2024',
    itemNumber: 167,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '146ea04a-0223-4fba-9ff9-c1ef2a5af7fd': {
    year: '2024',
    itemNumber: 191,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },

  // --- 2025 ITE Deletions (Scored out of 191) ---
  '217cf443-9565-4db7-8f98-8ce7018bcb95': {
    year: '2025',
    itemNumber: 23,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '3b2363fa-fa9d-4b23-8f84-4f5e5aacb5a2': {
    year: '2025',
    itemNumber: 25,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '8fa56a09-67cd-4f22-b23d-a398591302b7': {
    year: '2025',
    itemNumber: 36,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '103f9daa-d1b4-4c9e-97f0-d6307428cd17': {
    year: '2025',
    itemNumber: 55,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '4a924e71-f7dc-44f2-ba44-77e0c6799a09': {
    year: '2025',
    itemNumber: 59,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '9a0240b2-34c1-4fb9-ae8e-a1f941c23daa': {
    year: '2025',
    itemNumber: 129,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  '0f5e2823-dcad-4a65-9412-e2886d47e724': {
    year: '2025',
    itemNumber: 142,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  },
  'c7d488f5-6be4-4452-9272-68e0177fb6e2': {
    year: '2025',
    itemNumber: 171,
    reason: 'Content Delete',
    description: 'Removed by ABFM after post-exam content review'
  }
};

export const REMOVED_BY_ABFM_IDS = new Set<string>(Object.keys(REMOVED_BY_ABFM_MAP));

export function isQuestionRemovedByAbfm(id?: string | null): boolean {
  if (!id) return false;
  return REMOVED_BY_ABFM_IDS.has(id);
}
