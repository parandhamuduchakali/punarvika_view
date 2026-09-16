import { FormControl, FormGroup, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { AppApiError } from '../core/interceptors/error.interceptor';
import { applyApiErrors, controlError, passwordStrength, passwordsMatch } from './form-errors';

describe('applyApiErrors', () => {
  const buildForm = () =>
    new FormGroup({
      email: new FormControl(''),
      password: new FormControl(''),
    });

  it('puts a server message on the matching control', () => {
    const form = buildForm();
    const error = new AppApiError('VALIDATION_ERROR', 'The request is invalid.', 400, {
      email: ['Enter a valid email address.'],
    });

    const remaining = applyApiErrors(form, error);

    expect(form.get('email')?.errors?.['server']).toBe('Enter a valid email address.');
    expect(remaining).toBeNull();
  });

  it('marks the control touched so the message is actually visible', () => {
    const form = buildForm();
    applyApiErrors(
      form,
      new AppApiError('VALIDATION_ERROR', 'Invalid', 400, { email: ['Bad'] }),
    );

    expect(form.get('email')?.touched).toBe(true);
  });

  it('returns messages for fields that have no control, so none are lost', () => {
    const form = buildForm();

    const remaining = applyApiErrors(
      form,
      new AppApiError('VALIDATION_ERROR', 'Invalid', 400, {
        mystery_field: ['Something is wrong with it.'],
      }),
    );

    expect(remaining).toBe('Something is wrong with it.');
  });

  it('falls back to the top-level message when no fields are given', () => {
    const form = buildForm();
    const error = new AppApiError('EMAIL_ALREADY_REGISTERED', 'That email is taken.', 409);

    expect(applyApiErrors(form, error)).toBe('That email is taken.');
  });
});

describe('controlError', () => {
  it('stays quiet until the control is touched', () => {
    const control = new FormControl('', Validators.required);
    expect(controlError(control, 'Email')).toBeNull();

    control.markAsTouched();
    expect(controlError(control, 'Email')).toBe('Email is required.');
  });

  it('prefers the server message over the local one', () => {
    const control = new FormControl('', Validators.required);
    control.setErrors({ required: true, server: 'That email is already registered.' });
    control.markAsTouched();

    expect(controlError(control, 'Email')).toBe('That email is already registered.');
  });

  it('describes a length rule', () => {
    const control = new FormControl('a', Validators.minLength(8));
    control.markAsTouched();

    expect(controlError(control, 'Password')).toBe('Password must be at least 8 characters.');
  });
});

describe('passwordStrength', () => {
  it.each(['Punarvika1', 'abc12345', 'aB3defgh'])('accepts %s', (value) => {
    expect(passwordStrength(new FormControl(value))).toBeNull();
  });

  it.each([
    ['short1', 'under eight characters'],
    ['allletters', 'no digit'],
    ['12345678', 'no letter'],
  ])('rejects %s (%s)', (value) => {
    expect(passwordStrength(new FormControl(value))).toEqual({ passwordStrength: true });
  });

  it('does not complain about an untouched empty field', () => {
    expect(passwordStrength(new FormControl(''))).toBeNull();
  });
});

describe('passwordsMatch', () => {
  const buildForm = (password: string, confirm: string) => {
    const form = new FormGroup(
      {
        password: new FormControl(password),
        confirm_password: new FormControl(confirm),
      },
      { validators: passwordsMatch('password', 'confirm_password') },
    );
    form.updateValueAndValidity();
    return form;
  };

  it('flags a mismatch on the confirmation field', () => {
    const form = buildForm('Punarvika1', 'Punarvika2');

    expect(form.get('confirm_password')?.errors?.['passwordMismatch']).toBe(true);
  });

  it('clears the error once the two agree', () => {
    const form = buildForm('Punarvika1', 'Punarvika2');
    form.get('confirm_password')?.setValue('Punarvika1');
    form.updateValueAndValidity();

    expect(form.get('confirm_password')?.errors).toBeNull();
  });

  it('says nothing until the confirmation is filled in', () => {
    const form = buildForm('Punarvika1', '');

    expect(form.get('confirm_password')?.errors).toBeNull();
  });
});
