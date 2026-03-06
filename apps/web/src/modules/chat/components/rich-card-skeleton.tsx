import { Card, CardContent } from '@/components/ui/card';

export function RichCardSkeleton() {
  return (
    <Card className="mt-2 max-w-[88%] rounded-2xl">
      <CardContent className="p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-5 w-20 rounded-full bg-muted" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3.5 w-full rounded bg-muted" />
          <div className="h-3.5 w-3/4 rounded bg-muted" />
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-3">
          <div className="h-3.5 w-16 rounded bg-muted" />
          <div className="h-5 w-24 rounded bg-muted" />
        </div>
        <div className="mt-3 flex gap-2">
          <div className="h-8 flex-1 rounded bg-muted" />
          <div className="h-8 flex-1 rounded bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}
