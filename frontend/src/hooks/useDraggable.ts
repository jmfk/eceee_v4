import { useState, useEffect, RefObject } from 'react';

interface UseDraggableProps {
  elementRef: RefObject<HTMLElement | HTMLDivElement | null>;
  onDrag: (deltaX: number, deltaY: number) => void;
}

export const useDraggable = ({ elementRef, onDrag }: UseDraggableProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      onDrag(deltaX, deltaY);
      setStartPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startPos, onDrag]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only handle left click
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  return {
    isDragging,
    handleMouseDown,
  };
};
