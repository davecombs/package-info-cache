import type { EmberAddonPackageJson } from './ember-addon-package-json';
import { isEmberAddonPackageJson } from './ember-addon-package-json';

/**
 * The extra properties denoting an Ember addon (we test for keyword 'ember-addon' in the
 * guard function.)
 */
export type EmberEnginePackageJson = EmberAddonPackageJson;

/**
 * Type guard for EmberAddonPackageJson.
 * @param obj - The object to be tested.
 * @returns true if a given PackageJson object is actually an EmberAddonPackageJson object.
 */
export function isEmberEnginePackageJson(
  obj: unknown
): obj is EmberEnginePackageJson {
  if (!isEmberAddonPackageJson(obj)) {
    return false;
  }

  const record = obj as unknown as Record<string, unknown>;

  if (!record.keywords || !Array.isArray(record.keywords)) {
    return false;
  }

  const keywords = record.keywords as string[];

  if (!keywords.includes('ember-engine')) {
    return false;
  }

  return true;
}
