import { useEffect, useRef, useState } from 'react';

// Reveals elements marked `.reveal` as they scroll into view, including ones added
// later via DOM mutations (e.g. after data loads).
export function useReveal() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const shown = new WeakSet();

    // No IntersectionObserver support: reveal everything immediately.
    if (!('IntersectionObserver' in window)) {
      const showAll = () => Array.from(root.querySelectorAll('.reveal')).forEach((el) => el.classList.add('shown'));
      showAll();
      const mo = new MutationObserver(showAll);
      mo.observe(root, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    // Reveal once (12% visibility) then stop watching that element.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('shown');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    // Attach the observer to each `.reveal` element exactly once.
    const observeAll = () => {
      Array.from(root.querySelectorAll('.reveal')).forEach((el) => {
        if (!shown.has(el)) {
          shown.add(el);
          io.observe(el);
        }
      });
    };

    // Watch for newly added `.reveal` elements under the root.
    const mo = new MutationObserver(observeAll);
    mo.observe(root, { childList: true, subtree: true });
    observeAll();

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return rootRef;
}

// Animates a number from 0 up to `value` over `duration` ms using an easing curve.
export function CountUp({ value, duration = 1200 }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let start;
    let raf;
    const target = Number(value || 0);
    const step = (t) => {
      if (start === undefined) start = t;
      const p = Math.min((t - start) / duration, 1);
      // Cubic ease-out so the count slows down as it approaches the target.
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span>{n}</span>;
}
