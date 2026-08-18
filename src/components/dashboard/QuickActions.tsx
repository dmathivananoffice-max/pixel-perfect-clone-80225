import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface QuickActionsProps {
  actions: string[];
}

/**
 * Every quick action must lead somewhere real. Actions without a backing
 * screen are not rendered at all — never a dead "coming soon" button.
 */
const ACTION_ROUTES: Record<string, string> = {
  "Add Candidate": "/candidates/new",
  "Add Nurse": "/candidates/new",
  "Add Student": "/candidates/new",
  "Upload Documents": "/candidates/new",
  "Upload APS": "/candidates/new",
  "Schedule Speaking Assessment": "/sti",
  "Schedule Interview": "/sti",
  "Schedule Employer Interview": "/sti",
  "Assign STI": "/sti",
  "Generate Reports": "/reports",
};

export function QuickActions({ actions }: QuickActionsProps) {
  const navigate = useNavigate();
  const actionable = actions.filter((a) => ACTION_ROUTES[a]);

  if (actionable.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {actionable.map((a) => (
          <Button
            key={a}
            size="sm"
            variant="outline"
            onClick={() => navigate(ACTION_ROUTES[a])}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> {a}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
