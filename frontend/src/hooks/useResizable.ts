import { useState, useEffect, RefObject } from 'react';

interface UseResizableProps {
  elementRef: RefObject<HTMLElement | HTMLDivElement | null>;
  onResize: (width: number, height: number) => void;
  minWidth?: number;
  minHeight?: number;
}

export const useResizable = ({
  elementRef,
  onResize,
  minWidth = 300,
  minHeight = 200,
}: UseResizableProps) => {
  const [isResizing, setIsResizing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !elementRef.current) return;

      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;

      const newWidth = Math.max(startSize.width + deltaX, minWidth);
      const newHeight = Math.max(startSize.height + deltaY, minHeight);

      onResize(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startPos, startSize, onResize, elementRef, minWidth, minHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!elementRef.current) return;
    
    e.preventDefault();
    setIsResizing(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartSize({
      width: elementRef.current.offsetWidth,
      height: elementRef.current.offsetHeight,
    });
  };

  return {
    isResizing,
    handleMouseDown,
  };
};