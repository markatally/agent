import type { RefObject } from 'react';
import { DocumentRenderer } from './DocumentRenderer';

interface DocumentCanvasProps {
  sessionId: string;
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

export function DocumentCanvas({ sessionId, scrollContainerRef }: DocumentCanvasProps) {
  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto dark:bg-[#212121]">
      <DocumentRenderer sessionId={sessionId} />
    </div>
  );
}
