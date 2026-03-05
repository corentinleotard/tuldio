import { useRef, useState, type DragEvent } from 'react';
import { Upload, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
  hint?: string;
}

export function UploadZone({
  onFile,
  accept = 'image/*,application/pdf',
  label = 'Glissez un fichier ou cliquez pour choisir',
  hint,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 transition-colors',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50',
      )}
    >
      <div className="flex gap-2">
        <Upload className="h-8 w-8 text-primary" />
        <Camera className="h-8 w-8 text-primary" />
      </div>
      <p className="text-center text-sm font-medium text-foreground">{label}</p>
      {hint && <p className="text-center text-xs text-muted-foreground">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
