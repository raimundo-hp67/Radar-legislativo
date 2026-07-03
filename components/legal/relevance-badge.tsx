import { Badge } from '~/components/ui/badge';
import { cn } from '~/lib/utils';

type Relevance = 'LOW' | 'MEDIUM' | 'HIGH';

const relevanceConfig: Record<Relevance, { label: string, className: string }> = {
  LOW: {
    label: 'Baja',
    className: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  MEDIUM: {
    label: 'Media',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
  },
  HIGH: {
    label: 'Alta',
    className: 'bg-rose-50 text-rose-700 border-rose-200 font-semibold dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800',
  },
};

type RelevanceBadgeProps = {
  relevance: string
  className?: string
};

export function RelevanceBadge({ relevance, className }: RelevanceBadgeProps) {
  const config = relevanceConfig[relevance as Relevance] || relevanceConfig.LOW;

  return (
    <Badge variant="outline" className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full border', config.className, className)}>
      {config.label}
    </Badge>
  );
}
