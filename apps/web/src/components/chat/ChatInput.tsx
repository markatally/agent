import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Send, GripHorizontal, Plus, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

const MIN_INPUT_HEIGHT = 80;
const MAX_INPUT_HEIGHT = 400;
const DEFAULT_INPUT_HEIGHT = 120;
const STORAGE_KEY = 'chat-input-height';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;      // Completely disables input (invalid session, sending)
  sendDisabled?: boolean;  // Only disables send button (streaming)
  onSkillsClick?: () => void; // Handler for Skills menu item
}

export function ChatInput({ onSend, disabled, sendDisabled, onSkillsClick }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [height, setHeight] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Math.min(Math.max(parseInt(stored, 10), MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT) : DEFAULT_INPUT_HEIGHT;
  });
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Save height to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(height));
  }, [height]);

  const canSend = !disabled && !sendDisabled && message.trim();

  const handleSend = () => {
    if (!canSend) return;

    onSend(message.trim());
    setMessage('');
  };

  // IME composition handlers
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    setIsComposing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // IMPORTANT: Do not submit when IME composition is active
    // This allows Enter to confirm IME text (e.g., Chinese characters) instead of submitting
    // Check both nativeEvent.isComposing and our state for maximum compatibility
    const nativeEvent = e.nativeEvent as any;
    const isIMEActive = nativeEvent.isComposing || isComposing;

    // Send on Ctrl/Cmd + Enter (always works, even during IME)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
      return;
    }
    
    // Regular Enter: only submit if IME is NOT active and Shift is NOT pressed
    if (e.key === 'Enter' && !e.shiftKey && !isIMEActive) {
      e.preventDefault();
      handleSend();
    }
    // If IME is active or Shift is pressed, allow default behavior (new line or IME confirmation)
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  // Resize handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  }, [height]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    // Dragging up increases height, dragging down decreases it
    const deltaY = startYRef.current - e.clientY;
    const newHeight = startHeightRef.current + deltaY;
    
    if (newHeight >= MIN_INPUT_HEIGHT && newHeight <= MAX_INPUT_HEIGHT) {
      setHeight(newHeight);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div 
      ref={containerRef}
      className="relative border-t bg-background flex-shrink-0"
      style={{ height: `${height}px` }}
    >
      {/* Resize handle at top edge */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute top-0 left-0 right-0 h-2 cursor-row-resize flex items-center justify-center group hover:bg-primary/10 transition-colors z-10',
          isResizing && 'bg-primary/20'
        )}
      >
        <div className={cn(
          'w-12 h-1 rounded-full bg-border opacity-0 group-hover:opacity-100 transition-opacity',
          isResizing && 'opacity-100 bg-primary/50'
        )}>
          <GripHorizontal className="w-full h-full text-muted-foreground" />
        </div>
      </div>

      {/* Centered container with max width */}
      <div className="flex flex-col h-full">
        <div className="max-w-2xl mx-auto w-full px-4 flex flex-col h-full pt-3">
          <div className="flex gap-2 items-end flex-1">
            {/* Plus button with dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={disabled}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onClick={() => onSkillsClick?.()}
                  disabled={disabled}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Skills
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Textarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              disabled={disabled}
              className="flex-1 h-full resize-none"
            />
            <Button
              onClick={handleSend}
              disabled={!canSend}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex-shrink-0">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
