// src/components/AutoScrollText.tsx
import type { ReactNode } from "react";
import { useRef, useCallback, useEffect, useState } from "react";
import { styled } from "styled-components";

const ScrollContainer = styled.div`
  overflow: hidden;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  position: relative;
`;

const ScrollContent = styled.span<{ $offset: number }>`
  display: inline-block;
  will-change: transform;
  transform: translateX(${({ $offset }) => $offset}px);
  transition: transform 0.3s ease-out;
`;

interface AutoScrollTextProps {
  children: ReactNode;
}

export const AutoScrollText = ({ children }: AutoScrollTextProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const overflowWidthRef = useRef(0);
  const hasOverflowRef = useRef(false);
  const [offset, setOffset] = useState(0);

  const checkOverflow = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const overflow = Math.max(0, content.scrollWidth - container.clientWidth);
    overflowWidthRef.current = overflow;
    hasOverflowRef.current = overflow > 0;
  }, []);

  useEffect(() => {
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [checkOverflow, children]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hasOverflowRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // 鼠标在最左：ratio=0, offset=0（显示文字开头）
    // 鼠标在最右：ratio=1, offset=-overflowWidth（显示文字末尾）
    const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
    setOffset(-(overflowWidthRef.current * ratio));
  }, []);

  return (
    <ScrollContainer
      ref={containerRef}
      onMouseMove={handleMouseMove}
    >
      <ScrollContent ref={contentRef} $offset={offset}>
        {children}
      </ScrollContent>
    </ScrollContainer>
  );
};
