import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Mic, GraduationCap, Users, UserPlus, Building2, ArrowRight, Mail,
  MessageCircle, Send, FileText, X, ChevronDown, Download,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  count: number;
  onClear: () => void;
  onAction: (label: string) => void;
}

export function BulkActionsBar({ count, onClear, onAction }: Props) {
  if (count === 0) return null;
  const run = (label: string) => {
    onAction(label);
    toast.success(`${label} queued`, { description: `${count} candidate${count > 1 ? 's' : ''}` });
  };

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-4 z-40 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-1 rounded-full border border-border/60 bg-background/95 px-2 py-2 shadow-xl backdrop-blur">
      <span className="pl-2 pr-1 text-sm font-medium">
        <span className="tabular-nums">{count}</span> selected
      </span>
      <span className="mx-1 h-5 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="rounded-full gap-1">
            Assign <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuLabel className="text-[11px]">Assessments</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => run('Speaking Assessment')}>
            <Mic className="size-4" /> Speaking Assessment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('Training')}>
            <GraduationCap className="size-4" /> Training
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('Interview Round 1')}>
            <Users className="size-4" /> Interview Round 1
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('Interview Round 2')}>
            <Users className="size-4" /> Interview Round 2
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px]">People</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => run('Recruiter')}>
            <UserPlus className="size-4" /> Recruiter
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('Employer')}>
            <Building2 className="size-4" /> Employer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={() => run('Stage move')}>
        <ArrowRight className="size-4" /> Move
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="rounded-full gap-1">
            Message <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuItem onClick={() => run('Email')}><Mail className="size-4"/> Email</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('WhatsApp')}><MessageCircle className="size-4"/> WhatsApp</DropdownMenuItem>
          <DropdownMenuItem onClick={() => run('SMS')}><Send className="size-4"/> SMS</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={() => run('Report')}>
        <FileText className="size-4" /> Report
      </Button>
      <Button size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={() => run('Export')}>
        <Download className="size-4" /> Export
      </Button>

      <span className="mx-1 h-5 w-px bg-border" />
      <Button size="sm" variant="ghost" className="rounded-full" onClick={onClear} aria-label="Clear selection">
        <X className="size-4" />
      </Button>
    </div>
  );
}
