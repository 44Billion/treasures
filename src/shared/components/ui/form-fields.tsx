import { ReactNode, useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { BlurredImage } from '@/components/BlurredImage';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

// Base form field wrapper
interface BaseFormFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
  children: (field: any) => ReactNode;
}

export function BaseFormField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
  children,
}: BaseFormFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            {children(field)}
          </FormControl>
          {description && (
            <FormDescription>{description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Text input field
interface TextFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  placeholder?: string;
  description?: string;
  type?: 'text' | 'email' | 'url' | 'password';
}

export function TextField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  placeholder,
  description,
  type = 'text',
}: TextFieldProps<TFieldValues, TName>) {
  return (
    <BaseFormField control={control} name={name} label={label} description={description}>
      {(field: any) => (
        <Input
          type={type}
          placeholder={placeholder}
          {...field}
        />
      )}
    </BaseFormField>
  );
}

// Textarea field
interface TextAreaFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  placeholder?: string;
  description?: string;
  rows?: number;
}

export function TextAreaField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  placeholder,
  description,
  rows = 3,
}: TextAreaFieldProps<TFieldValues, TName>) {
  return (
    <BaseFormField control={control} name={name} label={label} description={description}>
      {(field: any) => (
        <Textarea
          placeholder={placeholder}
          rows={rows}
          className="resize-none"
          {...field}
        />
      )}
    </BaseFormField>
  );
}

// Switch field
interface SwitchFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  description?: string;
}

export function SwitchField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  description,
}: SwitchFieldProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <FormLabel className="text-base">{label}</FormLabel>
            {description && (
              <FormDescription>{description}</FormDescription>
            )}
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

// Image upload field
interface ImageUploadFieldProps<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  placeholder?: string;
  description?: string;
  previewType?: 'square' | 'wide';
  onUpload: (file: File) => Promise<void>;
  isUploading?: boolean;
}

export function ImageUploadField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  placeholder = "https://example.com/image.jpg",
  description,
  previewType = 'square',
  onUpload,
  isUploading = false,
}: ImageUploadFieldProps<TFieldValues, TName>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [localUploading, setLocalUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLocalUploading(true);
      try {
        await onUpload(file);
      } finally {
        setLocalUploading(false);
        // Reset the file input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const uploading = isUploading || localUploading;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex flex-col gap-2">
            <FormControl>
              <Input
                placeholder={placeholder}
                name={field.name}
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                disabled={uploading}
              />
            </FormControl>
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </>
                )}
              </Button>
              {field.value && (
                <div className={`relative h-10 ${previewType === 'square' ? 'w-10' : 'w-24'} rounded overflow-hidden`}>
                  <BlurredImage
                    src={field.value}
                    alt={`${label} preview`}
                    className="h-full w-full"
                    blurIntensity="light"
                    defaultBlurred={true}
                    showToggle={true}
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {description && (
            <FormDescription>{description}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// Coordinate input field (common in location components)
interface CoordinateInputFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  latName: FieldPath<TFieldValues>;
  lngName: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
}

export function CoordinateInputField<TFieldValues extends FieldValues>({
  control,
  latName,
  lngName,
  label = "Coordinates",
  description = "Enter latitude and longitude coordinates",
}: CoordinateInputFieldProps<TFieldValues>) {
  return (
    <div className="space-y-2">
      <FormLabel>{label}</FormLabel>
      <div className="grid grid-cols-2 gap-2">
        <FormField
          control={control}
          name={latName}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Latitude"
                  step="0.000001"
                  min="-90"
                  max="90"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={lngName}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Longitude"
                  step="0.000001"
                  min="-180"
                  max="180"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {description && (
        <FormDescription>{description}</FormDescription>
      )}
    </div>
  );
}