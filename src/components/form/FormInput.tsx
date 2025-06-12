/**
 * Standardized form input components
 */

import { forwardRef } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/shared/utils/utils';

interface BaseFormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  description?: string;
}

interface FormInputProps extends BaseFormFieldProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'url';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  name?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, error, required, className, description, ...inputProps }, ref) => {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <Label htmlFor={inputProps.name} className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Input
          ref={ref}
          {...inputProps}
          onChange={(e) => inputProps.onChange(e.target.value)}
          className={cn(error && 'border-destructive focus-visible:ring-destructive')}
        />
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

interface FormTextareaProps extends BaseFormFieldProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  rows?: number;
  name?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, error, required, className, description, ...textareaProps }, ref) => {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <Label htmlFor={textareaProps.name} className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Textarea
          ref={ref}
          {...textareaProps}
          onChange={(e) => textareaProps.onChange(e.target.value)}
          className={cn(error && 'border-destructive focus-visible:ring-destructive')}
        />
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

interface FormSelectProps extends BaseFormFieldProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  options: Array<{ label: string; value: string }>;
}

export function FormSelect({
  label,
  error,
  required,
  className,
  description,
  options,
  ...selectProps
}: FormSelectProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select
        value={selectProps.value}
        onValueChange={selectProps.onChange}
        disabled={selectProps.disabled}
      >
        <SelectTrigger className={cn(error && 'border-destructive focus:ring-destructive')}>
          <SelectValue placeholder={selectProps.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

interface FormNumberInputProps extends BaseFormFieldProps {
  placeholder?: string;
  value: number;
  onChange: (value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  name?: string;
}

export const FormNumberInput = forwardRef<HTMLInputElement, FormNumberInputProps>(
  ({ label, error, required, className, description, ...inputProps }, ref) => {
    return (
      <div className={cn('space-y-2', className)}>
        {label && (
          <Label htmlFor={inputProps.name} className="text-sm font-medium">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
        <Input
          ref={ref}
          type="number"
          {...inputProps}
          value={inputProps.value.toString()}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
              inputProps.onChange(value);
            }
          }}
          className={cn(error && 'border-destructive focus-visible:ring-destructive')}
        />
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

FormNumberInput.displayName = 'FormNumberInput';

interface FormCheckboxProps extends BaseFormFieldProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function FormCheckbox({
  label,
  error,
  className,
  description,
  checked,
  onChange,
  disabled,
}: FormCheckboxProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center space-x-2">
        <Checkbox
          checked={checked}
          onCheckedChange={onChange}
          disabled={disabled}
          className={cn(error && 'border-destructive')}
        />
        {label && (
          <Label className="text-sm font-medium cursor-pointer" onClick={() => !disabled && onChange(!checked)}>
            {label}
          </Label>
        )}
      </div>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}