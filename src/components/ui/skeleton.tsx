import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-[pulse_1.8s_ease-in-out_infinite] rounded-lg bg-muted motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

export { Skeleton };
