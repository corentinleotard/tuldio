import { Card, CardContent } from '@/components/ui/card';

interface RichCardSkeletonProps {
  lineCount: number;
  hasClientName?: boolean;
}

export function RichCardSkeleton({ lineCount, hasClientName }: RichCardSkeletonProps) {
  return (
    <Card className="mt-2 max-w-[88%] rounded-2xl">
      <CardContent className="p-4 animate-pulse">
        {/* Header: number + badge */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-5 w-20 rounded-full bg-muted" />
        </div>

        {/* Client name */}
        {hasClientName && <div className="mt-1 h-4 w-24 rounded bg-muted" />}

        {/* Lines — one per line to match real card height */}
        <div className="mt-3 space-y-1">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div className="h-4 rounded bg-muted" style={{ width: `${55 + (i % 3) * 15}%` }} />
              <div className="h-4 w-16 shrink-0 rounded bg-muted" />
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-6 w-24 rounded bg-muted" />
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2">
          <div className="h-8 flex-1 rounded bg-muted" />
          <div className="h-8 flex-1 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
