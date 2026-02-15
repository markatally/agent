import { useState, useRef, KeyboardEvent } from 'react';
import { ArrowUp, Mic, Plus, Square } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;      // Completely disables input (invalid session, sending)
  sendDisabled?: boolean;  // Only disables send button (streaming)
  onStop?: () => void;
  onOpenSkills?: () => void;
  onVoiceInput?: () => void;
}

export function ChatInput({ onSend, disabled, sendDisabled, onStop, onOpenSkills, onVoiceInput }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="w-full bg-background/90 pb-2 backdrop-blur dark:bg-[#212121]">
      <div className="mx-auto w-full max-w-[var(--chat-content-max-width,1400px)] px-4 pt-4 md:px-6">
        {/* Container: light = bordered card, dark = dark pill with white text (see index.css .dark .chat-input-pill) */}
        <div
          data-chat-input-pill
          className="chat-input-pill flex items-center gap-2.5 rounded-[28px] border border-border bg-white px-3 py-2 shadow-sm transition-colors duration-200 focus-within:border-muted-foreground/50 dark:border-white/10 dark:bg-[#1E1E1E] dark:shadow-none dark:focus-within:border-white/20"
        >
          {/* Plus / attach button */}
          <button
            type="button"
            data-chat-input-icon
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground dark:text-[#C5C5D2] dark:hover:bg-white/10 dark:hover:text-[#ECECF1]"
            aria-label="Attach"
            data-testid="settings-button"
            onClick={onOpenSkills}
          >
            <Plus className="h-[18px] w-[18px] stroke-[1.8]" />
          </button>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Ask anything"
            disabled={disabled}
            data-testid="chat-input"
            className="min-h-[32px] max-h-48 flex-1 resize-none border-0 bg-transparent px-2 py-1 text-base leading-6 text-foreground placeholder:text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:text-[#ECECF1] dark:placeholder:text-[#8E8EA0]"
          />

          {/* Right-side actions */}
          {sendDisabled && onStop ? (
            <Button
              onClick={onStop}
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-[#676767] dark:text-[#ECECF1] dark:hover:bg-[#7A7A7A]"
              aria-label="Stop response"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              {/* Mic button */}
              <button
                type="button"
                data-chat-input-icon
                aria-label="Voice input"
                onClick={onVoiceInput}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground dark:text-[#C5C5D2] dark:hover:bg-white/10 dark:hover:text-[#ECECF1]"
              >
                <Mic className="h-[18px] w-[18px] stroke-[1.8]" />
              </button>

              {/* Send button: white circle when active, muted when disabled */}
              <Button
                onClick={handleSend}
                disabled={!canSend}
                size="icon"
                className="h-8 w-8 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-100 dark:bg-white dark:text-black dark:hover:bg-[#E0E0E0] dark:disabled:bg-[#676767] dark:disabled:text-[#929292]"
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              </Button>
            </>
          )}
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground dark:text-[#8E8EA0]">
          Mark Agent may make mistakes. Check important info.
        </div>
      </div>
    </div>
  );
}
