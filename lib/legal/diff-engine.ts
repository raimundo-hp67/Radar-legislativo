import type { ProjectSnapshot, SnapshotChange } from '~/db/schema';
import type { ScrapedData } from './types';

/**
 * Fields to compare between snapshots
 */
const COMPARABLE_FIELDS: (keyof ScrapedData)[] = [
  'stage',
  'chamberCurrent',
  'lastAction',
  'lastActionDate',
  'urgency',
  'commission',
];

/**
 * Human-readable field names for display
 */
export const FIELD_LABELS: Record<string, string> = {
  stage: 'Estado/Etapa',
  chamberCurrent: 'Cámara',
  lastAction: 'Último Trámite',
  lastActionDate: 'Fecha Último Trámite',
  urgency: 'Urgencia',
  commission: 'Comisión',
};

/**
 * Compare two snapshots and return the list of changes
 */
export function diffSnapshots(
  previous: ProjectSnapshot | null,
  current: ScrapedData,
): SnapshotChange[] {
  // If no previous snapshot exists, this is the first capture - no changes to report
  if (!previous) {
    return [];
  }

  const changes: SnapshotChange[] = [];

  for (const field of COMPARABLE_FIELDS) {
    const prevValue = normalizeValue(previous[field as keyof ProjectSnapshot]);
    const currValue = normalizeValue(current[field]);

    if (prevValue !== currValue) {
      changes.push({
        field,
        from: prevValue,
        to: currValue,
      });
    }
  }

  return changes;
}

/**
 * Normalize a value for comparison
 * - Convert undefined/null to null
 * - Trim strings
 * - Convert empty strings to null
 */
function normalizeValue(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }

  return String(value);
}

/**
 * Check if the changes include significant updates
 * Stage and chamber changes are considered significant
 */
export function hasSignificantChanges(changes: SnapshotChange[]): boolean {
  const significantFields = ['stage', 'chamberCurrent', 'urgency'];
  return changes.some((change) => significantFields.includes(change.field));
}

/**
 * Format changes for display
 */
export function formatChanges(changes: SnapshotChange[]): string[] {
  return changes.map((change) => {
    const label = FIELD_LABELS[change.field] || change.field;
    const from = change.from ?? '∅';
    const to = change.to ?? '∅';
    return `${label}: ${from} → ${to}`;
  });
}

/**
 * Check if a snapshot was captured within the last N days
 */
export function isRecentSnapshot(snapshot: ProjectSnapshot, days: number = 7): boolean {
  const snapshotDate = new Date(snapshot.fetchedAt);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return snapshotDate >= cutoffDate;
}

/**
 * Check if a snapshot has recent changes (within the last N days)
 */
export function hasRecentChanges(snapshot: ProjectSnapshot, days: number = 7): boolean {
  if (!snapshot.changesDetected || snapshot.changesDetected.length === 0) {
    return false;
  }
  return isRecentSnapshot(snapshot, days);
}
