'use client';

import { useTranslations } from 'next-intl';
import { Archive, Check, Circle, CircleAlert, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DocumentStatus } from '@/lib/supabase/types';

export function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const t = useTranslations('docStatus');
  const isProcessing = status === 'extracting';
  const Icon = isProcessing
    ? Loader2
    : status === 'extracted' || status === 'classified'
      ? Check
      : status === 'failed'
        ? CircleAlert
        : status === 'archived'
          ? Archive
          : Circle;
  const variant = status === 'failed' ? 'destructive' : status === 'extracted' ? 'success' : 'muted';

  return (
    <Badge variant={variant} className="gap-1.5 whitespace-nowrap">
      <Icon aria-hidden="true" className={isProcessing ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
      {t(status)}
    </Badge>
  );
}
