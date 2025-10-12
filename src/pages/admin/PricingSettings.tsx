import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, Trash2, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface ManufacturingProcess {
  id: string;
  name: string;
  base_rate_per_hour: number;
  setup_cost: number;
  complexity_multiplier: number;
  is_active: boolean;
}

interface CrossSection {
  width: number;
  thickness: number;
  cost_per_inch: number;
}

interface MaterialCost {
  id: string;
  material_name: string;
  cost_per_cubic_cm: number;
  cost_per_square_cm: number;
  density: number | null;
  finish_options: any;
  is_active: boolean;
  pricing_method?: string;
  cross_sections?: CrossSection[];
}

const PricingSettings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processes, setProcesses] = useState<ManufacturingProcess[]>([]);
  const [materials, setMaterials] = useState<MaterialCost[]>([]);

  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      if (authLoading) return;

      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (roleError || !roles) {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access this page.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      await fetchPricingData();
    };

    checkAdminAndFetchData();
  }, [user, authLoading, navigate, toast]);

  const fetchPricingData = async () => {
    setLoading(true);
    try {
      const [processesResponse, materialsResponse] = await Promise.all([
        supabase.from('manufacturing_processes').select('*').order('name'),
        supabase.from('material_costs').select('*').order('material_name'),
      ]);

      if (processesResponse.error) throw processesResponse.error;
      if (materialsResponse.error) throw materialsResponse.error;

      setProcesses(processesResponse.data || []);
      
      // Parse finish_options and cross_sections from JSONB to array
      const parsedMaterials = (materialsResponse.data || []).map(m => ({
        ...m,
        finish_options: Array.isArray(m.finish_options) ? m.finish_options : [],
        pricing_method: m.pricing_method || 'weight',
        cross_sections: Array.isArray(m.cross_sections) 
          ? (m.cross_sections as unknown as CrossSection[])
          : []
      }));
      setMaterials(parsedMaterials);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load pricing data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProcess = (id: string, field: keyof ManufacturingProcess, value: any) => {
    setProcesses(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const updateMaterial = (id: string, field: keyof MaterialCost, value: any) => {
    setMaterials(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const saveProcesses = async () => {
    setSaving(true);
    try {
      const updates = processes.map(p => ({
        id: p.id,
        name: p.name,
        base_rate_per_hour: p.base_rate_per_hour,
        setup_cost: p.setup_cost,
        complexity_multiplier: p.complexity_multiplier,
        is_active: p.is_active,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('manufacturing_processes')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Manufacturing processes updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update processes',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const saveMaterials = async () => {
    setSaving(true);
    try {
      const updates = materials.map(m => ({
        id: m.id,
        material_name: m.material_name,
        cost_per_cubic_cm: m.cost_per_cubic_cm,
        cost_per_square_cm: m.cost_per_square_cm,
        density: m.density,
        finish_options: m.finish_options,
        is_active: m.is_active,
        pricing_method: m.pricing_method || 'weight',
        cross_sections: (m.cross_sections || []) as any,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('material_costs')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Material costs updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update materials',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addNewProcess = async () => {
    try {
      const { data, error } = await supabase
        .from('manufacturing_processes')
        .insert({
          name: 'New Process',
          base_rate_per_hour: 50.0,
          setup_cost: 100.0,
          complexity_multiplier: 1.0,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setProcesses(prev => [...prev, data]);
        toast({
          title: 'Success',
          description: 'New process added',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to add process',
        variant: 'destructive',
      });
    }
  };

  const addNewMaterial = async () => {
    try {
      const { data, error } = await supabase
        .from('material_costs')
        .insert({
          material_name: 'New Material',
          cost_per_cubic_cm: 0.1,
          cost_per_square_cm: 0.01,
          density: 1.0,
          finish_options: ['As-machined'],
          is_active: true,
          pricing_method: 'weight',
          cross_sections: [],
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setMaterials(prev => [...prev, {
          ...data,
          finish_options: Array.isArray(data.finish_options) ? data.finish_options : [],
          pricing_method: data.pricing_method || 'weight',
          cross_sections: Array.isArray(data.cross_sections) 
            ? (data.cross_sections as unknown as CrossSection[])
            : []
        }]);
        toast({
          title: 'Success',
          description: 'New material added',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to add material',
        variant: 'destructive',
      });
    }
  };

  const addCrossSection = (materialId: string) => {
    setMaterials(prev =>
      prev.map(m => m.id === materialId 
        ? { 
            ...m, 
            cross_sections: [...(m.cross_sections || []), { width: 1.0, thickness: 0.5, cost_per_inch: 1.0 }] 
          }
        : m
      )
    );
  };

  const removeCrossSection = (materialId: string, index: number) => {
    setMaterials(prev =>
      prev.map(m => m.id === materialId
        ? { 
            ...m, 
            cross_sections: (m.cross_sections || []).filter((_, i) => i !== index) 
          }
        : m
      )
    );
  };

  const updateCrossSection = (materialId: string, index: number, field: keyof CrossSection, value: number) => {
    setMaterials(prev =>
      prev.map(m => m.id === materialId
        ? {
            ...m,
            cross_sections: (m.cross_sections || []).map((cs, i) =>
              i === index ? { ...cs, [field]: value } : cs
            )
          }
        : m
      )
    );
  };

  const deleteProcess = async (id: string) => {
    try {
      const { error } = await supabase
        .from('manufacturing_processes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setProcesses(prev => prev.filter(p => p.id !== id));
      toast({
        title: 'Success',
        description: 'Process deleted',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete process',
        variant: 'destructive',
      });
    }
  };

  const deleteMaterial = async (id: string) => {
    try {
      const { error } = await supabase
        .from('material_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMaterials(prev => prev.filter(m => m.id !== id));
      toast({
        title: 'Success',
        description: 'Material deleted',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete material',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-6 w-6" />
              <h1 className="text-3xl font-bold">Pricing Settings</h1>
            </div>
            <p className="text-muted-foreground">
              Configure manufacturing processes, material costs, and pricing formulas
            </p>
          </div>

          <Tabs defaultValue="processes" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="processes">Manufacturing Processes</TabsTrigger>
              <TabsTrigger value="materials">Material Costs</TabsTrigger>
              <TabsTrigger value="formulas">Pricing Formulas</TabsTrigger>
            </TabsList>

            {/* Manufacturing Processes Tab */}
            <TabsContent value="processes" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Manufacturing Processes</CardTitle>
                      <CardDescription>
                        Set hourly rates, setup costs, and complexity multipliers
                      </CardDescription>
                    </div>
                    <Button onClick={addNewProcess} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Process
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {processes.map((process) => (
                    <div key={process.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Input
                            value={process.name}
                            onChange={(e) => updateProcess(process.id, 'name', e.target.value)}
                            className="font-semibold text-lg w-64"
                          />
                          <Badge variant={process.is_active ? 'default' : 'secondary'}>
                            {process.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateProcess(process.id, 'is_active', !process.is_active)}
                          >
                            {process.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteProcess(process.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor={`rate-${process.id}`}>Hourly Rate ($)</Label>
                          <Input
                            id={`rate-${process.id}`}
                            type="number"
                            step="0.01"
                            value={process.base_rate_per_hour}
                            onChange={(e) =>
                              updateProcess(process.id, 'base_rate_per_hour', parseFloat(e.target.value))
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Cost per hour of machining time
                          </p>
                        </div>
                        <div>
                          <Label htmlFor={`setup-${process.id}`}>Setup Cost ($)</Label>
                          <Input
                            id={`setup-${process.id}`}
                            type="number"
                            step="0.01"
                            value={process.setup_cost}
                            onChange={(e) =>
                              updateProcess(process.id, 'setup_cost', parseFloat(e.target.value))
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            One-time setup cost per job
                          </p>
                        </div>
                        <div>
                          <Label htmlFor={`complexity-${process.id}`}>Complexity Multiplier</Label>
                          <Input
                            id={`complexity-${process.id}`}
                            type="number"
                            step="0.1"
                            value={process.complexity_multiplier}
                            onChange={(e) =>
                              updateProcess(process.id, 'complexity_multiplier', parseFloat(e.target.value))
                            }
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Time adjustment factor (1.0 = normal)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4">
                    <Button onClick={saveProcesses} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save All Processes
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Materials Tab */}
            <TabsContent value="materials" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Material Costs</CardTitle>
                      <CardDescription>
                        Set material pricing per volume and surface area
                      </CardDescription>
                    </div>
                    <Button onClick={addNewMaterial} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Material
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {materials.map((material) => (
                    <div key={material.id} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Input
                            value={material.material_name}
                            onChange={(e) => updateMaterial(material.id, 'material_name', e.target.value)}
                            className="font-semibold text-lg w-64"
                          />
                          <Badge variant={material.is_active ? 'default' : 'secondary'}>
                            {material.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateMaterial(material.id, 'is_active', !material.is_active)}
                          >
                            {material.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteMaterial(material.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mb-4">
                        <Label htmlFor={`pricing-method-${material.id}`}>Pricing Method</Label>
                        <Select
                          value={material.pricing_method || 'weight'}
                          onValueChange={(value) => updateMaterial(material.id, 'pricing_method', value)}
                        >
                          <SelectTrigger id={`pricing-method-${material.id}`}>
                            <SelectValue placeholder="Select pricing method" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50">
                            <SelectItem value="weight">By Weight (Volume)</SelectItem>
                            <SelectItem value="linear_inch">By Linear Inch</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Choose how to calculate material costs
                        </p>
                      </div>

                      {material.pricing_method === 'weight' ? (
                        <ResizablePanelGroup direction="horizontal" className="min-h-[120px] border rounded-lg">
                          <ResizablePanel defaultSize={33} minSize={20}>
                            <div className="p-4 h-full">
                              <Label htmlFor={`volume-${material.id}`}>Cost per cm³ ($)</Label>
                              <Input
                                id={`volume-${material.id}`}
                                type="number"
                                step="0.01"
                                value={material.cost_per_cubic_cm}
                                onChange={(e) =>
                                  updateMaterial(material.id, 'cost_per_cubic_cm', parseFloat(e.target.value))
                                }
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Material cost per cubic centimeter
                              </p>
                            </div>
                          </ResizablePanel>
                          <ResizableHandle withHandle />
                          <ResizablePanel defaultSize={33} minSize={20}>
                            <div className="p-4 h-full">
                              <Label htmlFor={`surface-${material.id}`}>Cost per cm² ($)</Label>
                              <Input
                                id={`surface-${material.id}`}
                                type="number"
                                step="0.01"
                                value={material.cost_per_square_cm}
                                onChange={(e) =>
                                  updateMaterial(material.id, 'cost_per_square_cm', parseFloat(e.target.value))
                                }
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Used for finish/coating costs
                              </p>
                            </div>
                          </ResizablePanel>
                          <ResizableHandle withHandle />
                          <ResizablePanel defaultSize={34} minSize={20}>
                            <div className="p-4 h-full">
                              <Label htmlFor={`density-${material.id}`}>Density (g/cm³)</Label>
                              <Input
                                id={`density-${material.id}`}
                                type="number"
                                step="0.01"
                                value={material.density || ''}
                                onChange={(e) =>
                                  updateMaterial(material.id, 'density', parseFloat(e.target.value) || null)
                                }
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Material density (optional)
                              </p>
                            </div>
                          </ResizablePanel>
                        </ResizablePanelGroup>
                      ) : (
                        <div className="border rounded-lg p-4 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <Label>Cross Sections (Width × Thickness)</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addCrossSection(material.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Section
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">
                            Define standard cross-section sizes and their cost per linear inch
                          </p>
                          {(material.cross_sections || []).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No cross sections defined. Click "Add Section" to create one.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {(material.cross_sections || []).map((section, idx) => (
                                <div key={idx} className="border rounded-md p-4 grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Width (inches)</Label>
                                    <Select
                                      value={section.width?.toString() || "1"}
                                      onValueChange={(value) =>
                                        updateCrossSection(material.id, idx, 'width', parseFloat(value))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select width" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-background z-50 max-h-[300px]">
                                        {Array.from({ length: 40 }, (_, i) => i + 1).map((width) => (
                                          <SelectItem key={width} value={width.toString()}>
                                            {width}"
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label className="text-sm font-medium">Thickness (inches)</Label>
                                    <Select
                                      value={section.thickness?.toString() || "0.0625"}
                                      onValueChange={(value) =>
                                        updateCrossSection(material.id, idx, 'thickness', parseFloat(value))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select thickness" />
                                      </SelectTrigger>
                                      <SelectContent className="bg-background z-50 max-h-[300px]">
                                        <SelectItem value="0.0625">1/16"</SelectItem>
                                        <SelectItem value="0.125">1/8"</SelectItem>
                                        <SelectItem value="0.1875">3/16"</SelectItem>
                                        <SelectItem value="0.25">1/4"</SelectItem>
                                        <SelectItem value="0.3125">5/16"</SelectItem>
                                        <SelectItem value="0.375">3/8"</SelectItem>
                                        <SelectItem value="0.4375">7/16"</SelectItem>
                                        <SelectItem value="0.5">1/2"</SelectItem>
                                        <SelectItem value="0.5625">9/16"</SelectItem>
                                        <SelectItem value="0.625">5/8"</SelectItem>
                                        <SelectItem value="0.6875">11/16"</SelectItem>
                                        <SelectItem value="0.75">3/4"</SelectItem>
                                        <SelectItem value="0.8125">13/16"</SelectItem>
                                        <SelectItem value="0.875">7/8"</SelectItem>
                                        <SelectItem value="0.9375">15/16"</SelectItem>
                                        <SelectItem value="1">1"</SelectItem>
                                        <SelectItem value="1.125">1 1/8"</SelectItem>
                                        <SelectItem value="1.25">1 1/4"</SelectItem>
                                        <SelectItem value="1.375">1 3/8"</SelectItem>
                                        <SelectItem value="1.5">1 1/2"</SelectItem>
                                        <SelectItem value="1.625">1 5/8"</SelectItem>
                                        <SelectItem value="1.75">1 3/4"</SelectItem>
                                        <SelectItem value="1.875">1 7/8"</SelectItem>
                                        <SelectItem value="2">2"</SelectItem>
                                        <SelectItem value="2.25">2 1/4"</SelectItem>
                                        <SelectItem value="2.5">2 1/2"</SelectItem>
                                        <SelectItem value="2.75">2 3/4"</SelectItem>
                                        <SelectItem value="3">3"</SelectItem>
                                        <SelectItem value="3.5">3 1/2"</SelectItem>
                                        <SelectItem value="4">4"</SelectItem>
                                        <SelectItem value="4.5">4 1/2"</SelectItem>
                                        <SelectItem value="5">5"</SelectItem>
                                        <SelectItem value="5.5">5 1/2"</SelectItem>
                                        <SelectItem value="6">6"</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="col-span-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-sm font-medium">Cost per Linear Inch ($)</Label>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeCrossSection(material.id, idx)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={section.cost_per_inch}
                                      onChange={(e) =>
                                        updateCrossSection(material.id, idx, 'cost_per_inch', parseFloat(e.target.value))
                                      }
                                      placeholder="Enter cost per inch"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <Label>Available Finishes</Label>
                        <p className="text-sm text-muted-foreground mb-2">
                          Comma-separated list of finish options
                        </p>
                        <Input
                          value={Array.isArray(material.finish_options) ? material.finish_options.join(', ') : ''}
                          onChange={(e) =>
                            updateMaterial(
                              material.id,
                              'finish_options',
                              e.target.value.split(',').map(f => f.trim())
                            )
                          }
                          placeholder="As-machined, Anodized, Powder Coated"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4">
                    <Button onClick={saveMaterials} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save All Materials
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Formulas Tab */}
            <TabsContent value="formulas" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pricing Formulas</CardTitle>
                  <CardDescription>
                    View and understand the pricing calculation formulas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Unit Price Calculation</h3>
                      <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                        Unit Price = Material Cost + Machining Cost + Setup Cost + Finish Cost
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2">Material Cost</h3>
                      <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                        Material Cost = Volume (cm³) × Material Rate ($/cm³)
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2">Machining Cost</h3>
                      <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-2">
                        <div>Complexity Multiplier = 1 + (Complexity Score - 5) / 10</div>
                        <div>Estimated Hours = (Surface Area / 100) × Complexity Multiplier × Process Multiplier</div>
                        <div>Machining Cost = Estimated Hours × Hourly Rate ($/hr)</div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Complexity Score ranges from 1-10 (5 = average). Higher scores increase time estimates.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2">Setup Cost</h3>
                      <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                        Setup Cost per Unit = Process Setup Cost / Quantity
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Setup costs are amortized across the quantity ordered.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2">Finish Cost</h3>
                      <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                        Finish Cost = Surface Area (cm²) × 0.05 (if finish selected)
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Applies only when a finish other than "As-machined" is selected.
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2">Quantity Discounts</h3>
                      <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                        <div>1,000+ units: 20% discount</div>
                        <div>100-999 units: 15% discount</div>
                        <div>50-99 units: 10% discount</div>
                        <div>10-49 units: 5% discount</div>
                        <div>1-9 units: No discount</div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="font-semibold mb-2">Lead Time Estimation</h3>
                      <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                        <div>Total Hours = Estimated Hours × Quantity</div>
                        <div>Lead Time (days) = max(5, ceil(Total Hours / 8) + 2)</div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Minimum 5 business days. Assumes 8 production hours per day plus 2-day buffer.
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                      <h4 className="font-semibold text-blue-900 mb-2">Note: Editing Formulas</h4>
                      <p className="text-sm text-blue-800">
                        To modify the pricing formulas (e.g., change the surface area divisor from 100, adjust discount tiers, 
                        or modify the finish cost multiplier), you'll need to edit the edge function at:{' '}
                        <code className="bg-blue-100 px-2 py-1 rounded">
                          supabase/functions/calculate-preliminary-quote/index.ts
                        </code>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PricingSettings;
