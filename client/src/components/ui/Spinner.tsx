import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} />;

export const FullPageSpinner = () => (
  <div className="grid min-h-screen place-items-center bg-bg">
    <Spinner className="h-8 w-8" />
  </div>
);
