import { PackageJson } from 'type-fest';

import { getObjectProperty, hasDependency, hasDevDependency } from '../utils';
import { EmberAddonFields } from './ember-addon-fields';
import type { EmberPackageJson } from './ember-package-json';
import { isEmberPackageJson } from './ember-package-json';

export type EmberAppPackageJson = PackageJson &
  EmberPackageJson & {
    'ember-addon'?: EmberAddonFields;
  };

/**
 * Type guard for EmberAppPackageJson.
 *
 * Per discussion on #ember-dev, we should be able to distinguish an Ember app
 * package.json by "presence of ember-source and ember-cli in dependencies/devDependencies, and
 * absence of the 'ember-addon' KEYWORD (it is perfectly fine to have the ember-addon BLOCK)."
 *
 * @param obj - The object to be tested.
 * @returns true if a given PackageJson object is actually an EmberAppPackageJson object, false otherwise.
 */
export function isEmberAppPackageJson(
  obj: unknown
): obj is EmberAppPackageJson {
  if (!isEmberPackageJson(obj)) {
    return false;
  }

  const keywords = getObjectProperty(obj, 'keywords');

  if (Array.isArray(keywords) && keywords.includes('ember-addon')) {
    return false;
  }

  const hasEmberCli =
    hasDependency(obj, 'ember-cli') || hasDevDependency(obj, 'ember-cli');

  return hasEmberCli;
}
