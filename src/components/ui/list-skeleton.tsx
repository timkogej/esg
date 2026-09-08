import { ListRow } from '@/components/ui/list-row';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ListSkeletonProps {
  label: string;
  rows?: number;
  header?: boolean;
  contained?: boolean;
  className?: string;
}

export function ListSkeleton({
  label,
  rows = 3,
  header = false,
  contained = true,
  className,
}: ListSkeletonProps) {
  const content = (
    <div aria-label={label} aria-busy="true" role="status">
      {header && (
        <div className="border-b border-border/70 bg-secondary/15 px-4 py-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-2 h-3 w-56 max-w-full" />
        </div>
      )}
      {Array.from({ length: rows }, (_, index) => (
        <ListRow key={index} className="min-h-14 gap-3 px-4 py-2.5">
          <Skeleton className="h-8 w-8 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-20 shrink-0" />
        </ListRow>
      ))}
    </div>
  );

  if (!contained) return content;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[0.875rem] bg-card ring-1 ring-border/70',
        className,
      )}
    >
      {content}
    </div>
  );
}
