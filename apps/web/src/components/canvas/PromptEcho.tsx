interface PromptEchoProps {
  content: string;
}

export function PromptEcho({ content }: PromptEchoProps) {
  return (
    <div className="rounded-2xl bg-muted/80 px-4 py-2.5 text-sm font-normal text-foreground">
      {content}
    </div>
  );
}
