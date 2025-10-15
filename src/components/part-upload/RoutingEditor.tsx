import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface RoutingEditorProps {
  routings: string[];
  onRoutingsChange: (routings: string[]) => void;
  analysisReasoning?: string;
}

export function RoutingEditor({ routings, onRoutingsChange, analysisReasoning }: RoutingEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newRouting, setNewRouting] = useState('');
  
  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(routings[index]);
  };
  
  const saveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const updated = [...routings];
      updated[editingIndex] = editValue.trim();
      onRoutingsChange(updated);
      setEditingIndex(null);
      setEditValue('');
    }
  };
  
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };
  
  const removeRouting = (index: number) => {
    const updated = routings.filter((_, i) => i !== index);
    onRoutingsChange(updated);
  };
  
  const addRouting = () => {
    if (newRouting.trim() && !routings.includes(newRouting.trim())) {
      onRoutingsChange([...routings, newRouting.trim()]);
      setNewRouting('');
    }
  };
  
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger className="flex items-center justify-between w-full group">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Process Routing
        </Label>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 mt-3">
        {/* Existing routings */}
        <div className="space-y-2">
          {routings.map((routing, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-md border border-border/50"
            >
              {editingIndex === index ? (
                <>
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit();
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="h-7 text-sm flex-1"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={saveEdit}
                    className="h-7 px-2 text-xs"
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={cancelEdit}
                    className="h-7 px-2 text-xs"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium flex-1">{routing}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(index)}
                    className="h-7 w-7"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRouting(index)}
                    className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
          
          {routings.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No process routings added</p>
          )}
        </div>
        
        {/* Add new routing */}
        <div className="flex gap-2">
          <Input
            placeholder="Add routing (e.g., VMC 3-axis)"
            value={newRouting}
            onChange={(e) => setNewRouting(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addRouting();
            }}
            className="h-9 text-sm flex-1"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={addRouting}
            disabled={!newRouting.trim()}
            className="h-9"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Analysis reasoning */}
        {analysisReasoning && (
          <div className="mt-3 p-2.5 bg-primary/5 border border-primary/20 rounded-md">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">AI Recommendation: </span>
              {analysisReasoning}
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
