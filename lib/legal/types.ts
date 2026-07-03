import type { LegalProject, ProjectSnapshot, SnapshotChange } from '~/db/schema';

export type Relevance = 'LOW' | 'MEDIUM' | 'HIGH';

// Serialized versions for API responses (Date -> string)
export type SerializedLegalProject = Omit<LegalProject, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
};

export type SerializedProjectSnapshot = Omit<ProjectSnapshot, 'fetchedAt'> & {
  fetchedAt: string
};

export type ProjectWithSnapshot = LegalProject & {
  latestSnapshot: ProjectSnapshot | null
  hasRecentChanges: boolean
};

export type SerializedProjectWithSnapshot = SerializedLegalProject & {
  latestSnapshot: SerializedProjectSnapshot | null
  hasRecentChanges: boolean
};

export type PollResult = {
  boletin: string
  title: string
  relevance: Relevance
  snapshot: ProjectSnapshot
  changes: SnapshotChange[] | null
};

export type PollSummary = {
  total: number
  polled: number
  withChanges: number
  errors: string[]
  results: PollResult[]
};

export type ScrapedData = {
  boletin: string
  stage: string | null
  chamberCurrent: string | null
  lastAction: string | null
  lastActionDate: string | null
  urgency: string | null
  commission: string | null
  sourceUrl: string
};
