import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

/** Standard loading block — never a blank screen while data loads. */
export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
        {label}
      </div>
    </div>
  );
}

/** Standard error block with explicit retry — errors are never swallowed. */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive/70" />
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
        {onRetry && (
          <Button className="mt-4 gap-1.5" variant="outline" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </div>
    </div>
  );
}

/** Standard empty block. */
export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
