import { useMeasurementStore } from '@/stores/measurementStore';
import { Button } from '@/components/ui/button';
import { Ruler, Triangle, Circle, Eye, EyeOff, X, Download, Trash2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

/**
 * Measurement Panel Component
 * Displays measurement toolbar and list of measurements
 */
export function MeasurementPanel() {
  const { 
    activeTool, 
    measurements,
    setActiveTool,
    removeMeasurement,
    toggleMeasurementVisibility,
    clearAllMeasurements
  } = useMeasurementStore();
  
  // Export measurements to CSV
  const exportToCSV = () => {
    if (measurements.length === 0) return;
    
    // Create CSV content
    const headers = ['Type', 'Value', 'Unit', 'Points', 'Created'];
    const rows = measurements.map(m => [
      m.type,
      m.value.toFixed(3),
      m.unit,
      m.points.length,
      m.createdAt.toLocaleString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `measurements-${Date.now()}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };
  
  return (
    <div className="absolute top-24 right-5 z-30 w-80 bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-200">
      {/* Measurement Toolbar */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Measurements</h3>
          <Badge variant="secondary" className="text-xs">
            {measurements.length}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={activeTool === 'distance' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'distance' ? null : 'distance')}
            className="w-full"
          >
            <Ruler className="w-4 h-4 mr-2" />
            Distance
          </Button>
          
          <Button
            variant={activeTool === 'angle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'angle' ? null : 'angle')}
            className="w-full"
          >
            <Triangle className="w-4 h-4 mr-2" />
            Angle
          </Button>
          
          <Button
            variant={activeTool === 'radius' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'radius' ? null : 'radius')}
            className="w-full"
          >
            <Circle className="w-4 h-4 mr-2" />
            Radius
          </Button>
          
          <Button
            variant={activeTool === 'diameter' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTool(activeTool === 'diameter' ? null : 'diameter')}
            className="w-full"
          >
            <Circle className="w-4 h-4 mr-2" />
            Diameter
          </Button>
        </div>
        
        {activeTool && (
          <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
            <span className="font-semibold">Active: </span>
            Click {activeTool === 'distance' ? '2' : '3'} points on the model
            <div className="text-blue-600 mt-1">Press ESC to cancel</div>
          </div>
        )}
      </div>
      
      {/* Measurements List */}
      <ScrollArea className="h-64">
        {measurements.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">
            <Ruler className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No measurements yet</p>
            <p className="text-xs mt-1">Select a tool to start measuring</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {measurements.map((measurement, index) => (
              <div
                key={measurement.id}
                className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {measurement.type}
                      </Badge>
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {measurement.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {measurement.points.length} points • {measurement.createdAt.toLocaleTimeString()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => toggleMeasurementVisibility(measurement.id)}
                    >
                      {measurement.visible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeMeasurement(measurement.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Actions Footer */}
      {measurements.length > 0 && (
        <>
          <Separator />
          <div className="p-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={exportToCSV}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={clearAllMeasurements}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </>
      )}
    </div>
  );
}