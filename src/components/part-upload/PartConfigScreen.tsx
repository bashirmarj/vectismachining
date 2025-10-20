import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, ChevronDown, ChevronUp, Mail, Phone, Building2, MapPin, User } from 'lucide-react';
import { CADViewer } from '@/components/CADViewer';
import FeatureTree from '@/components/FeatureTree';
import { RoutingEditor } from './RoutingEditor';

interface FileWithData {
  file: File;
  quantity: number;
  material?: string;
  process?: string;
  meshId?: string;
  meshData?: {
    vertices: number[];
    indices: number[];
    normals: number[];
    vertex_colors?: string[];
    triangle_count: number;
    face_types?: string[];
    feature_edges?: number[][][];
  };
  analysis?: {
    volume_cm3?: number;
    surface_area_cm2?: number;
    complexity_score?: number;
    confidence?: number;
    method?: string;
    detected_features?: Record<string, boolean>;
    manufacturing_features?: any;
    feature_summary?: any;
    recommended_processes?: string[];
    routing_reasoning?: string[];
    machining_summary?: any[];
  };
  quote?: any;
  isAnalyzing?: boolean;
}

interface PartConfigScreenProps {
  files: FileWithData[];
  materials: string[];
  processes: string[];
  onBack: () => void;
  onSubmit: (formData: any) => void;
  onUpdateFile: (index: number, updates: Partial<FileWithData>) => void;
  selectedFileIndex: number;
  onSelectFile: (index: number) => void;
  isSubmitting: boolean;
}

const PartConfigScreen: React.FC<PartConfigScreenProps> = ({
  files,
  materials,
  processes,
  onBack,
  onSubmit,
  onUpdateFile,
  selectedFileIndex,
  onSelectFile,
  isSubmitting,
}) => {
  const [contactFormExpanded, setContactFormExpanded] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
    message: '',
  });

  const selectedFile = files[selectedFileIndex];

  const handleSubmit = () => {
    onSubmit({
      files: files,
      contact: contactInfo,
    });
  };

  const handleContactInfoChange = (field: string, value: string) => {
    setContactInfo(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const isFormValid = () => {
    // Check if all files have material and quantity
    const filesValid = files.every(f => f.material && f.quantity > 0);
    // Check if contact info is filled
    const contactValid = contactInfo.name && contactInfo.email && contactInfo.phone;
    return filesValid && contactValid;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Left Sidebar - 30% */}
        <div className="w-[30%] bg-white border-r overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={onBack}
              className="w-full justify-start"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Upload
            </Button>

            {/* File Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Parts ({files.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {files.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => onSelectFile(index)}
                    className={`w-full p-3 text-left rounded-lg border transition-colors ${
                      index === selectedFileIndex
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium text-sm truncate">
                      {file.file.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Qty: {file.quantity} | {file.material || 'No material'}
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Part Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Material Selection */}
                <div className="space-y-2">
                  <Label htmlFor="material">Material *</Label>
                  <Select
                    value={selectedFile.material || ''}
                    onValueChange={(value) => onUpdateFile(selectedFileIndex, { material: value })}
                  >
                    <SelectTrigger id="material">
                      <SelectValue placeholder="Select material" />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material} value={material}>
                          {material}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quantity */}
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={selectedFile.quantity}
                    onChange={(e) => onUpdateFile(selectedFileIndex, { quantity: parseInt(e.target.value) || 1 })}
                  />
                </div>

                {/* Process (Optional) */}
                <div className="space-y-2">
                  <Label htmlFor="process">Preferred Process (Optional)</Label>
                  <Select
                    value={selectedFile.process || 'auto'}
                    onValueChange={(value) => onUpdateFile(selectedFileIndex, { process: value === 'auto' ? undefined : value })}
                  >
                    <SelectTrigger id="process">
                      <SelectValue placeholder="Auto-select (recommended)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-select (recommended)</SelectItem>
                      {processes.map((process) => (
                        <SelectItem key={process} value={process}>
                          {process}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Routing Editor */}
            {selectedFile.analysis?.recommended_processes && (
              <Card>
                <CardHeader>
                  <CardTitle>Process Routing</CardTitle>
                </CardHeader>
                <CardContent>
                  <RoutingEditor
                    routings={selectedFile.analysis.recommended_processes}
                    onRoutingsChange={(routings) => onUpdateFile(selectedFileIndex, { 
                      analysis: { ...selectedFile.analysis, recommended_processes: routings }
                    })}
                    analysisReasoning={selectedFile.analysis.routing_reasoning?.join('\n')}
                  />
                </CardContent>
              </Card>
            )}

            {/* Analysis Results */}
            {selectedFile.analysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Analysis Results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-xs text-gray-500">Volume</div>
                      <div className="font-medium">
                        {selectedFile.analysis.volume_cm3.toFixed(2)} cm³
                      </div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-xs text-gray-500">Surface Area</div>
                      <div className="font-medium">
                        {selectedFile.analysis.surface_area_cm2.toFixed(2)} cm²
                      </div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-xs text-gray-500">Complexity</div>
                      <div className="font-medium">
                        {selectedFile.analysis.complexity_score}/10
                      </div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-xs text-gray-500">Confidence</div>
                      <div className="font-medium">
                        {(selectedFile.analysis.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Information (Collapsible) */}
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setContactFormExpanded(!contactFormExpanded)}>
                <div className="flex items-center justify-between">
                  <CardTitle>Contact Information *</CardTitle>
                  {contactFormExpanded ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </div>
              </CardHeader>
              {contactFormExpanded && (
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Full Name *
                    </Label>
                    <Input
                      id="name"
                      value={contactInfo.name}
                      onChange={(e) => handleContactInfoChange('name', e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={contactInfo.email}
                      onChange={(e) => handleContactInfoChange('email', e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={contactInfo.phone}
                      onChange={(e) => handleContactInfoChange('phone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Company (Optional)
                    </Label>
                    <Input
                      id="company"
                      value={contactInfo.company}
                      onChange={(e) => handleContactInfoChange('company', e.target.value)}
                      placeholder="Acme Corp"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Shipping Address
                    </Label>
                    <Textarea
                      id="address"
                      value={contactInfo.address}
                      onChange={(e) => handleContactInfoChange('address', e.target.value)}
                      placeholder="123 Main St, City, State, ZIP"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Additional Notes</Label>
                    <Textarea
                      id="message"
                      value={contactInfo.message}
                      onChange={(e) => handleContactInfoChange('message', e.target.value)}
                      placeholder="Any special requirements or notes..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid() || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Quote Request'}
            </Button>
          </div>
        </div>

        {/* Right Panel - 70% */}
        <div className="flex-1 bg-white overflow-hidden">
          <Tabs defaultValue="3d-model" className="h-full flex flex-col">
            <div className="border-b px-6 pt-6">
              <TabsList className="w-full">
                <TabsTrigger value="3d-model" className="flex-1">
                  3D Model
                </TabsTrigger>
                <TabsTrigger value="features" className="flex-1">
                  Features
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* 3D Model Tab */}
              <TabsContent value="3d-model" className="h-full m-0 p-6">
                <div className="h-full min-h-[600px]">
                  <CADViewer
                    file={selectedFile.file}
                    fileName={selectedFile.file.name}
                    meshId={selectedFile.meshId}
                    meshData={selectedFile.meshData}
                    detectedFeatures={selectedFile.analysis?.detected_features}
                  />
                </div>
              </TabsContent>

              {/* Features Tab - UPDATED TO USE NEW PROPS */}
              <TabsContent value="features" className="m-0 p-6">
                <FeatureTree
                  features={selectedFile.analysis?.manufacturing_features}
                  featureSummary={selectedFile.analysis?.feature_summary}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PartConfigScreen;
