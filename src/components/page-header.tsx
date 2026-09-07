export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-7 md:mb-8">
      <h1 className="text-[1.75rem] font-semibold leading-[1.2] tracking-[-0.025em] md:text-[2rem]">
        {title}
      </h1>
      {subtitle && <p className="mt-1.5 max-w-2xl text-[0.9375rem] leading-6 text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
