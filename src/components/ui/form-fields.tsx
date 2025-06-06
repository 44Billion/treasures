import { ReactNode, useRef } from 'react';
import { Upload } from 'lucide-react';
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
  onUpload: (file: File) => void;
}

export function ImageUploadField<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  placeholder = "https://example.com/image.jpg",
  description,
  previewType = 'square',
  onUpload,
}: ImageUploadFieldProps<TFieldValues, TName>) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
              />
            </FormControl>
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onUpload(file);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Image
              </Button>
              {field.value && (
                <div className={`h-10 ${previewType === 'square' ? 'w-10' : 'w-24'} rounded overflow-hidden`}>
                  <BlurredImage
                    src={field.value} 
                    alt={`${label} preview`} 
                    className="h-full w-full"
                    blurIntensity="light"
                    defaultBlurred={true}
                    showToggle={true}
                  />
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