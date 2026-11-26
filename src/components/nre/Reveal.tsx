import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

/** Scroll-reveal. Content is visible without JS and on first paint; only below-the-fold blocks animate in. */
export function Reveal({ children, as: Tag = "div", delay = 0, className, style }: { children: ReactNode; as?: ElementType; delay?: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.setAttribute("data-reveal", "hidden");
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { el.setAttribute("data-reveal", "shown"); io.disconnect(); } }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={className} style={{ ...style, "--reveal-delay": `${delay}ms` } as CSSProperties}>{children}</Tag>;
}
