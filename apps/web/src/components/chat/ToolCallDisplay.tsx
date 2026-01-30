import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ToolCallDisplayProps {
  sessionId: string;
}

export function ToolCallDisplay({ sessionId }: ToolCallDisplayProps) {
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());
  const toolCalls = useChatStore((state) => state.toolCalls);

  const sessionToolCalls = Array.from(toolCalls.values()).filter(
    (call) => call.status !== 'pending'
  );

  if (sessionToolCalls.length === 0) {
    return null;
  }

  const toggleExpand = (toolCallId: string) => {
    setExpandedCalls((prev) => {
      const next = new Set(prev);
      if (next.has(toolCallId)) {
        next.delete(toolCallId);
      } else {
        next.add(toolCallId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2 p-4 border-t bg-muted/30">
      <div className="text-xs font-medium text-muted-foreground mb-2">Tool Calls</div>
      {sessionToolCalls.map((toolCall) => {
        const isExpanded = expandedCalls.has(toolCall.toolCallId);

        return (
          <Card key={toolCall.toolCallId} className="text-sm">
            <CardHeader className="p-3 cursor-pointer" onClick={() => toggleExpand(toolCall.toolCallId)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-sm font-medium">
                    {toolCall.toolName}
                  </CardTitle>
                </div>
                <Badge
                  variant={
                    toolCall.status === 'completed'
                      ? 'default'
                      : toolCall.status === 'failed'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="flex items-center gap-1"
                >
                  {toolCall.status === 'running' && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {toolCall.status === 'completed' && (
                    <CheckCircle className="h-3 w-3" />
                  )}
                  {toolCall.status === 'failed' && <XCircle className="h-3 w-3" />}
                  {toolCall.status}
                </Badge>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="p-3 pt-0 space-y-2">
                {/* Parameters */}
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Parameters:
                  </div>
                  <SyntaxHighlighter
                    language="json"
                    style={oneDark as any}
                    customStyle={{ margin: 0, borderRadius: '4px', fontSize: '11px' }}
                  >
                    {JSON.stringify(toolCall.params, null, 2)}
                  </SyntaxHighlighter>
                </div>

                {/* Result */}
                {toolCall.result && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Result:
                    </div>
                    <pre className="text-xs bg-secondary p-2 rounded overflow-auto max-h-40">
                      {toolCall.result}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {toolCall.error && (
                  <div>
                    <div className="text-xs font-medium text-destructive mb-1">
                      Error:
                    </div>
                    <pre className="text-xs bg-destructive/10 text-destructive p-2 rounded overflow-auto max-h-40">
                      {toolCall.error}
                    </pre>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
