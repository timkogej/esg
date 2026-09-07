import * as React from 'react';
import { cn } from '@/lib/utils';

const ListRow = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'group flex min-h-16 items-center gap-4 border-b px-4 py-3 last:border-b-0 md:px-5',
        className,
      )}
      {...props}
    />
  ),
);
ListRow.displayName = 'ListRow';

export { ListRow };
