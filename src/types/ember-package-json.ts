import { PackageJson } from 'type-fest';

import { getObjectProperty } from '../utils';
/**
 * An ember package
 */
export type EmberPackageJson = PackageJson & {
  ember: {
    edition: 'classic' | 'octane';
  };
};

/**
 * Type guard for EmberPackageJson. There's no guard function I know of for PackageJson, so
 * we're just going to assume it's okay.
 *
 * @param obj - The object to be tested.
 * @returns true if a given PackageJson object is actually an EmberPackageJson object, false otherwise.
 */
export function isEmberPackageJson(obj: unknown): obj is EmberPackageJson {
  const edition = getObjectProperty(obj, 'ember.edition');
  return edition === 'classic' || edition === 'octane';
}
