'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { DocumentStatus } from '@/lib/supabase/types';

export function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const t = useTranslations('docStatus');
  // 'extracted' is a terminal success state → accent; 'failed' → destructive tint.
  const variant =
    status === 'extracted' ? 'accent' : status === 'failed' ? 'outline' : 'muted';
  return (
    <Badge
      variant={variant}
      className={status === 'failed' ? 'border-destructive/40 text-destructive' : undefined}
    >
      {t(status)}
    </Badge>
  );
}
