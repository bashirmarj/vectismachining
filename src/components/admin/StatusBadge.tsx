import { Badge } from '@/components/ui/badge';

type QuotationStatus = 'pending' | 'reviewing' | 'quoted' | 'accepted' | 'rejected' | 'expired';

interface StatusBadgeProps {
  status: QuotationStatus;
}

const statusConfig: Record<QuotationStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'default' },
  reviewing: { label: 'Reviewing', variant: 'secondary' },
  quoted: { label: 'Quoted', variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'secondary' },
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status];
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
};
