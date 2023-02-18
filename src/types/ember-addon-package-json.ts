import { getObjectProperty } from '../utils';
import type { EmberAddonFields } from './ember-addon-fields';
import type { EmberPackageJson } from './ember-package-json';
import { isEmberPackageJson } from './ember-package-json';

/**
 * The extra properties denoting an Ember addon (we test for keyword 'ember-addon' in the
 * guard function.)
 */
export type EmberAddonPackageJson = EmberPackageJson & {
  keywords: string[];
  'ember-addon'?: EmberAddonFields;
};

/**
 * Type guard for EmberAddonPackageJson.
 * @param obj - The object to be tested.
 * @returns true if a given PackageJson object is actually an EmberAddonPackageJson object.
 */
export function isEmberAddonPackageJson(
  obj: unknown
): obj is EmberAddonPackageJson {
  if (!isEmberPackageJson(obj)) {
    return false;
  }

  const keywords = getObjectProperty(obj, 'keywords');

  if (!(Array.isArray(keywords) && keywords.includes('ember-addon'))) {
    return false;
  }

  const emberAddonBlock = getObjectProperty(obj, 'ember-addon');

  return emberAddonBlock === undefined || typeof emberAddonBlock === 'object';
}
