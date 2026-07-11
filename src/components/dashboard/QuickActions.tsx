import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionsProps {
  actions: string[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a}
            size="sm"
            variant="outline"
            onClick={() => toast?.(`${a} — coming soon`) ?? window.alert(`${a} — coming soon`)}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {a}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
