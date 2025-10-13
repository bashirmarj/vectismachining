import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface SurfaceTreatment {
  id: string;
  name: string;
  category: 'heat_treatment' | 'post_process' | 'surface_treatment';
  cost_per_cm2: number;
  description: string | null;
  is_active: boolean;
}

export default function SurfaceTreatmentSettings() {
  const [treatments, setTreatments] = useState<SurfaceTreatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    category: 'heat_treatment' | 'post_process' | 'surface_treatment';
    cost_per_cm2: number;
    description: string;
    is_active: boolean;
  }>({
    name: "",
    category: "surface_treatment",
    cost_per_cm2: 0,
    description: "",
    is_active: true
  });
  const { toast } = useToast();

  useEffect(() => {
    loadTreatments();
  }, []);

  const loadTreatments = async () => {
    try {
      const { data, error } = await supabase
        .from('surface_treatments')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setTreatments((data as SurfaceTreatment[]) || []);
    } catch (error: any) {
      toast({
        title: "Error loading treatments",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        // Update existing treatment
        const { error } = await supabase
          .from('surface_treatments')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;
        
        toast({
          title: "Treatment updated",
          description: "Surface treatment has been updated successfully.",
        });
      } else {
        // Create new treatment
        const { error } = await supabase
          .from('surface_treatments')
          .insert([formData]);

        if (error) throw error;
        
        toast({
          title: "Treatment created",
          description: "New surface treatment has been added.",
        });
      }

      resetForm();
      loadTreatments();
    } catch (error: any) {
      toast({
        title: "Error saving treatment",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (treatment: SurfaceTreatment) => {
    setEditingId(treatment.id);
    setFormData({
      name: treatment.name,
      category: treatment.category,
      cost_per_cm2: treatment.cost_per_cm2,
      description: treatment.description || "",
      is_active: treatment.is_active
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this treatment?")) return;

    try {
      const { error } = await supabase
        .from('surface_treatments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Treatment deleted",
        description: "Surface treatment has been removed.",
      });

      loadTreatments();
    } catch (error: any) {
      toast({
        title: "Error deleting treatment",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: "",
      category: "surface_treatment",
      cost_per_cm2: 0,
      description: "",
      is_active: true
    });
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'heat_treatment': return 'Heat Treatment';
      case 'post_process': return 'Post Process';
      case 'surface_treatment': return 'Surface Treatment';
      default: return category;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Surface Treatment Pricing</h1>
        <p className="text-muted-foreground">
          Manage heat treatments, post-processes, and surface treatments (priced by surface area)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit" : "Add"} Surface Treatment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Treatment Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Anodizing Type II"
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="heat_treatment">Heat Treatment</SelectItem>
                    <SelectItem value="post_process">Post Process</SelectItem>
                    <SelectItem value="surface_treatment">Surface Treatment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="cost_per_cm2">Cost per cm² ($)</Label>
                <Input
                  id="cost_per_cm2"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_per_cm2}
                  onChange={(e) => setFormData({ ...formData, cost_per_cm2: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the treatment..."
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit">
                {editingId ? "Update" : "Add"} Treatment
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Surface Treatments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['heat_treatment', 'post_process', 'surface_treatment'].map((category) => {
              const categoryTreatments = treatments.filter(t => t.category === category);
              if (categoryTreatments.length === 0) return null;

              return (
                <div key={category}>
                  <h3 className="font-semibold text-lg mb-2">{getCategoryLabel(category)}</h3>
                  <div className="space-y-2">
                    {categoryTreatments.map((treatment) => (
                      <div
                        key={treatment.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{treatment.name}</h4>
                            {!treatment.is_active && (
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{treatment.description}</p>
                          <p className="text-sm font-semibold mt-1">
                            ${treatment.cost_per_cm2.toFixed(3)} per cm²
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(treatment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(treatment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
