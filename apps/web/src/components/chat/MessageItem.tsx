import { useMemo } from 'react';
import { Bot, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '../ui/code-block';
import type { Message } from '@mark/shared';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { Components } from 'react-markdown';
import { useChatStore } from '../../stores/chatStore';
import { InteractiveTable } from './InteractiveTable';
import { parseContentWithTables } from '../../lib/tableParser';
import { Button } from '../ui/button';
import { triggerDownload, triggerDownloadByFilename } from '../../lib/download';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

/**
 * Table block marker pattern used to embed table references in message content.
 * Format: <!--TABLE:tableId-->
 */
const TABLE_BLOCK_PATTERN = /<!--TABLE:([a-zA-Z0-9_-]+)-->/g;

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Custom markdown components for ReactMarkdown
 * Includes styled table components for clean table rendering
 */
const markdownComponents: Components = {
  // Code blocks with syntax highlighting
  code(props) {
    const { children, className, node, ...rest } = props;
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    const isBlock = /\n/.test(codeString);

    if (match) {
      return (
        <CodeBlock
          language={match[1]}
          code={codeString}
        />
      );
    }

    if (isBlock && !className) {
      return (
        <CodeBlock
          language="text"
          code={codeString}
        />
      );
    }

    return (
      <code
        className={cn('rounded bg-muted px-1.5 py-0.5 text-sm font-mono', className)}
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre({ children }) {
    return <pre className="not-prose">{children}</pre>;
  },

  // Table components with responsive styling
  table({ children, ...props }) {
    return (
      <div className="not-prose my-4 w-full overflow-x-auto rounded-lg border border-border">
        <table
          className="w-full border-collapse text-sm"
          {...props}
        >
          {children}
        </table>
      </div>
    );
  },

  thead({ children, ...props }) {
    return (
      <thead
        className="bg-muted/50 border-b border-border dark:bg-muted/30"
        {...props}
      >
        {children}
      </thead>
    );
  },

  tbody({ children, ...props }) {
    return (
      <tbody className="divide-y divide-border" {...props}>
        {children}
      </tbody>
    );
  },

  tr({ children, ...props }) {
    return (
      <tr
        className="transition-colors hover:bg-muted/30"
        {...props}
      >
        {children}
      </tr>
    );
  },

  th({ children, style, ...props }) {
    // Handle text alignment from markdown
    const alignClass = style?.textAlign === 'center'
      ? 'text-center'
      : style?.textAlign === 'right'
        ? 'text-right'
        : 'text-left';

    return (
      <th
        className={cn(
          'px-4 py-3 font-medium text-foreground dark:text-muted-foreground dark:font-semibold whitespace-nowrap text-xs uppercase tracking-wider',
          alignClass
        )}
        {...props}
      >
        {children}
      </th>
    );
  },

  td({ children, style, ...props }) {
    // Handle text alignment from markdown
    const alignClass = style?.textAlign === 'center'
      ? 'text-center'
      : style?.textAlign === 'right'
        ? 'text-right'
        : 'text-left';

    return (
      <td
        className={cn(
          'px-4 py-3 text-muted-foreground',
          alignClass
        )}
        {...props}
      >
        {children}
      </td>
    );
  },
};

/**
 * Renders a Table IR block from the chat store.
 * Handles both streaming (incomplete) and completed tables.
 */
function TableBlockRenderer({ tableId }: { tableId: string }) {
  const streamingTables = useChatStore((state) => state.streamingTables);
  const completedTables = useChatStore((state) => state.completedTables);

  const completedTable = completedTables.get(tableId);
  const streamingTable = streamingTables.get(tableId);

  if (completedTable) {
    // Table is complete - render with sorting enabled
    return <InteractiveTable table={completedTable.table} isStreaming={false} />;
  }

  if (streamingTable) {
    // Table is still streaming - render placeholder with schema
    // Create a partial TableIR with empty data for the streaming state
    const partialTable = {
      schema: streamingTable.schema,
      data: [],
      caption: streamingTable.caption,
    };
    return <InteractiveTable table={partialTable} isStreaming={true} />;
  }

  // Table not found - render placeholder
  return (
    <div className="not-prose my-4 p-4 rounded-lg border border-border bg-muted/20 text-sm text-muted-foreground">
      Loading table...
    </div>
  );
}

/**
 * Parses message content and returns an array of content segments.
 * Each segment is either a text block or a table block reference.
 */
function parseMessageContent(content: string): Array<{ type: 'text' | 'table'; value: string }> {
  const segments: Array<{ type: 'text' | 'table'; value: string }> = [];
  let lastIndex = 0;

  // Reset regex state
  TABLE_BLOCK_PATTERN.lastIndex = 0;

  let match;
  while ((match = TABLE_BLOCK_PATTERN.exec(content)) !== null) {
    // Add text before the table marker
    if (match.index > lastIndex) {
      const textSegment = content.slice(lastIndex, match.index).trim();
      if (textSegment) {
        segments.push({ type: 'text', value: textSegment });
      }
    }

    // Add the table reference
    segments.push({ type: 'table', value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last table marker
  if (lastIndex < content.length) {
    const textSegment = content.slice(lastIndex).trim();
    if (textSegment) {
      segments.push({ type: 'text', value: textSegment });
    }
  }

  // If no table markers found, return the entire content as text
  if (segments.length === 0 && content.trim()) {
    segments.push({ type: 'text', value: content });
  }

  return segments;
}

export function MessageItem({ message, isStreaming }: MessageItemProps) {
  const isUser = message.role === 'user';
  const toolCalls = useChatStore((state) => state.toolCalls);
  const pptArtifacts = useMemo(() => {
    const artifacts: Array<{
      name: string;
      fileId?: string;
      size?: number;
      mimeType?: string;
    }> = [];
    const dedupe = new Set<string>();

    for (const toolCall of toolCalls.values()) {
      if (toolCall.sessionId !== message.sessionId || toolCall.messageId !== message.id) continue;
      const callArtifacts = Array.isArray(toolCall.result?.artifacts) ? toolCall.result?.artifacts : [];
      for (const artifact of callArtifacts) {
        if (!artifact?.name) continue;
        const isPresentation =
          artifact.name.toLowerCase().endsWith('.pptx') ||
          artifact.mimeType?.includes('presentation');
        if (!isPresentation) continue;
        const key = `${artifact.fileId || ''}:${artifact.name}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        artifacts.push({
          name: artifact.name,
          fileId: artifact.fileId,
          size: artifact.size,
          mimeType: artifact.mimeType,
        });
      }
    }

    return artifacts;
  }, [toolCalls, message.sessionId, message.id]);

  // First check for explicit TABLE markers (from backend Table IR events)
  const explicitTableSegments = parseMessageContent(message.content);
  const hasExplicitTableBlocks = explicitTableSegments.some((s) => s.type === 'table');

  // If no explicit markers, parse markdown tables and convert to Table IR
  // Only do this for non-streaming, completed messages
  const parsedContent = useMemo(() => {
    if (hasExplicitTableBlocks || isStreaming) {
      return null; // Use explicit markers or skip during streaming
    }
    return parseContentWithTables(message.content);
  }, [message.content, hasExplicitTableBlocks, isStreaming]);

  const hasMarkdownTables = parsedContent?.hasTables ?? false;

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="flex w-fit max-w-[80%] flex-col items-end gap-1">
          <div className="rounded-2xl bg-muted/60 px-4 py-2.5 text-sm text-foreground dark:bg-[#2F2F2F] dark:text-[#ECECF1]">
            {message.content}
          </div>
          <div className="flex items-center justify-end gap-1 pr-1">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(message.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 p-4" data-testid="assistant-message">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Assistant</span>
          {isStreaming ? (
            <span
              className="text-xs text-muted-foreground"
              aria-label="Streaming"
            >
              ●
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.createdAt), {
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Message content - render segments */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {hasExplicitTableBlocks ? (
            explicitTableSegments.map((segment, index) =>
              segment.type === 'table' ? (
                <TableBlockRenderer key={`table-${segment.value}-${index}`} tableId={segment.value} />
              ) : (
                <ReactMarkdown
                  key={`text-${index}`}
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {segment.value}
                </ReactMarkdown>
              )
            )
          ) : hasMarkdownTables && parsedContent ? (
            parsedContent.segments.map((segment, index) =>
              segment.type === 'table' ? (
                <InteractiveTable
                  key={`md-table-${index}`}
                  table={segment.table}
                  isStreaming={isStreaming}
                />
              ) : (
                <ReactMarkdown
                  key={`text-${index}`}
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {segment.content}
                </ReactMarkdown>
              )
            )
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {!isStreaming && pptArtifacts.length > 0 ? (
          <div className="not-prose space-y-2">
            {pptArtifacts.map((artifact) => (
              <div
                key={artifact.fileId || artifact.name}
                className="flex flex-col gap-2 rounded-xl border bg-muted/10 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Presentation ready
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="truncate text-foreground">{artifact.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(artifact.size)}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      if (artifact.fileId) {
                        await triggerDownload(message.sessionId, artifact.fileId, artifact.name);
                        return;
                      }
                      await triggerDownloadByFilename(message.sessionId, artifact.name);
                    }}
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
