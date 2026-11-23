import { useId, type InputHTMLAttributes } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Short help below the field. */
  hint?: string;
  /** Field error; marks the input invalid and is announced with it. */
  error?: string | undefined;
}

/** Labelled pixel input on parchment (GDD §16): ink border, hard inset shadow. */
export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className={['field', error && 'field--error', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <input
        id={id}
        className="field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...rest}
      />
      {hint && !error && (
        <span id={`${id}-hint`} className="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field__error">
          {error}
        </span>
      )}
    </div>
  );
}
