import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModelViewer } from './ModelViewer';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface ModelViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  fileSize: number;
}

export const ModelViewerDialog = ({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileSize,
}: ModelViewerDialogProps) => {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-semibold">{fileName}</div>
              <div className="text-sm font-normal text-muted-foreground">
                {formatFileSize(fileSize)}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0">
          <ModelViewer fileUrl={fileUrl} fileName={fileName} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
