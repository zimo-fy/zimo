import { useCallback, useLayoutEffect, useRef, useState } from "react";

const STICKY_THRESHOLD_PX = 96;

export function useConversationAutoScroll({
  conversationId,
  forceVersion,
}: {
  conversationId: string;
  forceVersion: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isStickyRef = useRef(true);
  const lastScrollHeightRef = useRef(0);
  const lastClientHeightRef = useRef(0);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const scrollImmediately = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight - viewport.clientHeight;
    lastScrollHeightRef.current = viewport.scrollHeight;
    lastClientHeightRef.current = viewport.clientHeight;
  }, []);

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    isStickyRef.current = true;
    setIsAtBottom(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    viewport.scrollTo({
      top: viewport.scrollHeight - viewport.clientHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // Growth can dispatch a scroll event before ResizeObserver restores the bottom position.
    if (
      isStickyRef.current &&
      (viewport.scrollHeight > lastScrollHeightRef.current ||
        viewport.clientHeight < lastClientHeightRef.current)
    )
      return;
    const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = distance <= STICKY_THRESHOLD_PX;
    isStickyRef.current = isNearBottom;
    setIsAtBottom(isNearBottom);
  }, []);

  useLayoutEffect(() => {
    isStickyRef.current = true;
    scrollImmediately();
  }, [conversationId, forceVersion, scrollImmediately]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (
        viewport.scrollHeight === lastScrollHeightRef.current &&
        viewport.clientHeight === lastClientHeightRef.current
      )
        return;
      if (isStickyRef.current) scrollImmediately();
      lastScrollHeightRef.current = viewport.scrollHeight;
      lastClientHeightRef.current = viewport.clientHeight;
    });
    observer.observe(content);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [scrollImmediately]);

  return { viewportRef, contentRef, isAtBottom, handleScroll, scrollToBottom };
}
