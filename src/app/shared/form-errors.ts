import { AbstractControl, FormGroup } from '@angular/forms';

import { AppApiError } from '../core/interceptors/error.interceptor';

/**
 * Puts server-side validation back on the control that caused it.
 *
 * The API reports failures as `{ fields: { email: ["..."] } }` with the source
 * segment already stripped, so the keys line up with reactive form control
 * names. Anything that does not match a control is returned to be shown as a
 * form-level message, so a server error can never vanish silently.
 */
export function applyApiErrors(form: FormGroup, error: AppApiError): string | null {
  if (!error.fields) {
    return error.message;
  }

  const unmatched: string[] = [];

  for (const [field, messages] of Object.entries(error.fields)) {
    const control = form.get(field);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: messages.join(' ') });
      // Without this the message stays invisible until the field is touched.
      control.markAsTouched();
    } else {
      unmatched.push(...messages);
    }
  }

  return unmatched.length > 0 ? unmatched.join(' ') : null;
}

/** The message to show under a control, or null when it is fine. */
export function controlError(control: AbstractControl | null, label = 'This field'): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) {
    return null;
  }

  const errors = control.errors;
  // The server's own wording wins: it knows the real rule.
  if (errors['server']) {
    return String(errors['server']);
  }
  if (errors['required']) {
    return `${label} is required.`;
  }
  if (errors['email']) {
    return 'Enter a valid email address.';
  }
  if (errors['minlength']) {
    return `${label} must be at least ${errors['minlength'].requiredLength} characters.`;
  }
  if (errors['maxlength']) {
    return `${label} must be at most ${errors['maxlength'].requiredLength} characters.`;
  }
  if (errors['pattern']) {
    return `${label} is not in the expected format.`;
  }
  if (errors['passwordStrength']) {
    return 'Use at least 8 characters, with a letter and a number.';
  }
  if (errors['passwordMismatch']) {
    return 'The two passwords do not match.';
  }
  if (errors['min']) {
    return `${label} must be at least ${errors['min'].min}.`;
  }
  if (errors['max']) {
    return `${label} must be at most ${errors['max'].max}.`;
  }
  return 'Please check this field.';
}

/**
 * Mirrors `security.validate_password_strength` on the backend.
 *
 * Client-side only as a courtesy, so the customer is told before submitting.
 * The server checks again and is the authority.
 */
export function passwordStrength(control: AbstractControl): Record<string, true> | null {
  const value = String(control.value ?? '');
  if (!value) {
    return null;
  }
  const longEnough = value.length >= 8;
  const hasLetter = /[A-Za-z]/.test(value);
  const hasDigit = /\d/.test(value);
  return longEnough && hasLetter && hasDigit ? null : { passwordStrength: true };
}

/** Cross-field check for a "confirm password" control. */
export function passwordsMatch(passwordField: string, confirmField: string) {
  return (group: AbstractControl): Record<string, true> | null => {
    const password = group.get(passwordField)?.value;
    const confirm = group.get(confirmField);
    if (!confirm || !confirm.value) {
      return null;
    }
    if (password === confirm.value) {
      // Clear only our own error, leaving any other untouched.
      const { passwordMismatch: _removed, ...rest } = confirm.errors ?? {};
      confirm.setErrors(Object.keys(rest).length > 0 ? rest : null);
      return null;
    }
    confirm.setErrors({ ...(confirm.errors ?? {}), passwordMismatch: true });
    return { passwordMismatch: true };
  };
}
