import { StrKey } from '@stellar/stellar-base';
import { registerDecorator, type ValidationOptions } from 'class-validator';
import { slugProblem } from './slug.js';

/** A valid, reserved-word-free slug. */
export function IsSlug(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isSlug',
      target: target.constructor,
      propertyName: propertyKey as string,
      options,
      validator: {
        validate: (value: unknown) => slugProblem(value) === undefined,
        defaultMessage: (args) =>
          slugProblem(args?.value) ?? 'slug is invalid.',
      },
    });
  };
}

/** A standard Stellar public key (G...), checked with the SDK's StrKey. */
export function IsStellarPublicKey(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isStellarPublicKey',
      target: target.constructor,
      propertyName: propertyKey as string,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && StrKey.isValidEd25519PublicKey(value),
        defaultMessage: () =>
          'paymentAddress must be a valid Stellar public key (G...).',
      },
    });
  };
}
