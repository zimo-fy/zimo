import { cn } from "@zimo/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type CatalogCategoryFilterProps = Readonly<{
  ariaLabel: string;
  categories: readonly string[];
  selected: string;
  onSelect(category: string): void;
}>;

export function CatalogCategoryFilter({
  ariaLabel,
  categories,
  selected,
  onSelect,
}: CatalogCategoryFilterProps) {
  const rail = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ canGoBack: false, canGoForward: false });

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => {
      const maxScroll = Math.max(0, element.scrollWidth - element.clientWidth);
      setScrollState({
        canGoBack: element.scrollLeft > 2,
        canGoForward: element.scrollLeft < maxScroll - 2,
      });
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [categories]);

  function move(direction: -1 | 1): void {
    const element = rail.current;
    if (!element) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollBy({
      left: direction * Math.max(180, element.clientWidth * 0.65),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <div className="relative mt-3" aria-label={ariaLabel}>
      {scrollState.canGoBack && <ScrollButton direction="back" onClick={() => move(-1)} />}
      <div ref={rail} className="scrollbar-hidden flex gap-1.5 overflow-x-auto py-0.5">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={cn(
              "shrink-0 rounded-md border px-2 py-1 text-[13px] font-normal leading-4 tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-800",
              selected === category
                ? "border-neutral-900 bg-neutral-900 text-white shadow-sm"
                : "border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-800",
            )}
            aria-pressed={selected === category}
            onClick={() => onSelect(category)}
          >
            {category}
          </button>
        ))}
      </div>
      {scrollState.canGoForward && <ScrollButton direction="forward" onClick={() => move(1)} />}
    </div>
  );
}

function ScrollButton({ direction, onClick }: { direction: "back" | "forward"; onClick(): void }) {
  const back = direction === "back";
  const Icon = back ? ChevronLeft : ChevronRight;
  return (
    <div
      className={`absolute inset-y-0 z-10 flex items-center ${
        back
          ? "left-0 bg-gradient-to-r from-white via-white to-transparent pr-5"
          : "right-0 bg-gradient-to-l from-white via-white to-transparent pl-5"
      }`}
    >
      <button
        type="button"
        className="grid size-7 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:border-neutral-300 hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-800"
        aria-label={back ? "向前查看更多分类" : "向后查看更多分类"}
        onClick={onClick}
      >
        <Icon size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
