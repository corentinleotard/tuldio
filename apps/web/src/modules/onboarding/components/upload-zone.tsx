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
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-10 transition-colors',
        isDragging
          ? 'border-primary bg-primary-lightest'
          : 'border-border hover:border-primary hover:bg-primary-lightest',
      )}
    >
      <div className="flex gap-4 text-primary">
        <Upload className="h-6 w-6" />
        <Camera className="h-6 w-6" />
      </div>
      <p className="text-center text-[15px] font-medium text-foreground">{label}</p>
      {hint && <p className="text-center text-[13px] text-muted-foreground">{hint}</p>}
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
