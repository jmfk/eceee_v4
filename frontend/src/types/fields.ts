/**
 * Base props interface for form field components
 */
export interface FieldProps {
  /** Field label */
  label?: string;
  /** Error message to display */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Help text to display below the field */
  helpText?: string;
  /** Additional CSS classes */
  className?: string;
}
