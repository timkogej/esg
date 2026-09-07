/**
 * Ambient glow that radiates upward from the bottom edge of the viewport in the
 * accent color (#D4643F). Present on every page as a subtle background effect.
 * Rendered as a fixed, non-interactive layer behind all content (low z-index),
 * built from a radial-gradient + blur. Opacity is theme-driven (see --glow-opacity)
 * so it stays subtle in light mode and more pronounced in dark mode.
 */
export function AmbientGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[60vh] overflow-hidden"
      style={{ opacity: 'var(--glow-opacity)' }}
    >
      <div
        className="absolute left-1/2 bottom-[-30vh] h-[70vh] w-[120vw] -translate-x-1/2"
        style={{
          background:
            'radial-gradient(ellipse at center, #D4643F 0%, rgba(212,100,63,0.35) 40%, rgba(212,100,63,0) 70%)',
          filter: 'blur(90px)',
        }}
      />
    </div>
  );
}
