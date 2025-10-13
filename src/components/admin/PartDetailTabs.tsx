import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Box, Ruler, DollarSign, Sparkles } from 'lucide-react';
import { CADViewer } from '@/components/CADViewer';
import { FeatureTree } from '@/components/FeatureTree';

interface PartDetailTabsProps {
  lineItem: {
    id: string;
    file_name: string;
    file_path: string;
    quantity: number;
    unit_price: number | null;
    lead_time_days: number | null;
    notes: string | null;
    estimated_volume_cm3: number | null;
    estimated_surface_area_cm2: number | null;
    estimated_complexity_score: number | null;
    material_cost: number | null;
    machining_cost: number | null;
    setup_cost: number | null;
    finish_cost: number | null;
    preliminary_unit_price: number | null;
    selected_process: string | null;
    material_type: string | null;
    finish_type: string | null;
    estimated_machine_time_hours: number | null;
    mesh_id: string | null;
  };
  featureTree?: {
    common_dimensions: Array<{ label: string; value: number; unit: string }>;
    oriented_sections: Array<{ orientation: string; features: any[] }>;
  };
  onUpdateLineItem: (id: string, field: string, value: any) => void;
}

export function PartDetailTabs({ lineItem, featureTree, onUpdateLineItem }: PartDetailTabsProps) {
  const hasAIPricing = lineItem.preliminary_unit_price !== null;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const fileUrl = `${supabaseUrl}/storage/v1/object/public/part-files/${lineItem.file_path}`;
  
  return (
    <Tabs defaultValue="pricing" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="model" className="flex items-center gap-2">
          <Box className="h-4 w-4" />
          3D Model
        </TabsTrigger>
        <TabsTrigger value="features" className="flex items-center gap-2">
          <Ruler className="h-4 w-4" />
          Features
          {featureTree && (
            <Badge variant="secondary" className="ml-1">
              {featureTree.oriented_sections.reduce((sum, s) => sum + s.features.length, 0)}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="pricing" className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Pricing
        </TabsTrigger>
      </TabsList>

      <TabsContent value="model" className="mt-4">
        <CADViewer 
          fileUrl={fileUrl}
          fileName={lineItem.file_name}
          meshId={lineItem.mesh_id || undefined}
        />
      </TabsContent>

      <TabsContent value="features" className="mt-4">
        {featureTree ? (
          <FeatureTree 
            partName={lineItem.file_name}
            featureTree={featureTree}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center h-[400px] gap-4">
              <Ruler className="h-16 w-16 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">
                No feature data available for this part
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="pricing" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Pricing Details</span>
              {hasAIPricing && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Suggested
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Part Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">File Name</Label>
                <p className="font-medium">{lineItem.file_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <p className="font-medium">{lineItem.quantity}</p>
              </div>
            </div>

            {/* AI Analysis */}
            {hasAIPricing && (
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  AI Analysis
                </h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Volume</Label>
                    <p className="font-medium">{lineItem.estimated_volume_cm3?.toFixed(2)} cm³</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Surface Area</Label>
                    <p className="font-medium">{lineItem.estimated_surface_area_cm2?.toFixed(2)} cm²</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Complexity</Label>
                    <p className="font-medium">{lineItem.estimated_complexity_score}/10</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-purple-200 dark:border-purple-900">
                  <div>
                    <Label className="text-xs text-muted-foreground">Process</Label>
                    <p className="font-medium">{lineItem.selected_process || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Machine Time</Label>
                    <p className="font-medium">{lineItem.estimated_machine_time_hours?.toFixed(2)} hrs</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-purple-200 dark:border-purple-900">
                  <Label className="text-xs text-muted-foreground">AI Suggested Price</Label>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    ${lineItem.preliminary_unit_price?.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">per unit</p>
                </div>
              </div>
            )}

            {/* Manual Pricing Fields */}
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-semibold text-sm">Manual Quote</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`material-${lineItem.id}`}>Material</Label>
                  <Input
                    id={`material-${lineItem.id}`}
                    value={lineItem.material_type || ''}
                    onChange={(e) => onUpdateLineItem(lineItem.id, 'material_type', e.target.value)}
                    placeholder="e.g., Aluminum 6061"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`process-${lineItem.id}`}>Process</Label>
                  <Input
                    id={`process-${lineItem.id}`}
                    value={lineItem.selected_process || ''}
                    onChange={(e) => onUpdateLineItem(lineItem.id, 'selected_process', e.target.value)}
                    placeholder="e.g., CNC Milling"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`unit-price-${lineItem.id}`}>Unit Price ($)</Label>
                  <Input
                    id={`unit-price-${lineItem.id}`}
                    type="number"
                    step="0.01"
                    value={lineItem.unit_price || ''}
                    onChange={(e) => onUpdateLineItem(lineItem.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`lead-time-${lineItem.id}`}>Lead Time (days)</Label>
                  <Input
                    id={`lead-time-${lineItem.id}`}
                    type="number"
                    value={lineItem.lead_time_days || ''}
                    onChange={(e) => onUpdateLineItem(lineItem.id, 'lead_time_days', parseInt(e.target.value) || null)}
                    placeholder="14"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`notes-${lineItem.id}`}>Notes</Label>
                <Textarea
                  id={`notes-${lineItem.id}`}
                  value={lineItem.notes || ''}
                  onChange={(e) => onUpdateLineItem(lineItem.id, 'notes', e.target.value)}
                  placeholder="Add any notes about this part..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
