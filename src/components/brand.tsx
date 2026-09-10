import Image from 'next/image';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/config';

export function Brand({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex w-36 select-none items-center', className)}
      role="img"
      aria-label={APP_NAME}
    >
      <Image
        src="/brand/evipace-logo-horizontal.svg"
        alt=""
        aria-hidden="true"
        width={1347}
        height={320}
        priority
        draggable={false}
        className="block h-auto w-full dark:hidden"
      />
      <Image
        src="/brand/evipace-logo-horizontal-white.svg"
        alt=""
        aria-hidden="true"
        width={1347}
        height={320}
        priority
        draggable={false}
        className="hidden h-auto w-full dark:block"
      />
    </span>
  );
}
