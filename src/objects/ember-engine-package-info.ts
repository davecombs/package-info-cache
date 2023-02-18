import type { EmberEnginePackageJson } from '../types/ember-engine-package-json';
import { EmberAddonPackageInfo } from './ember-addon-package-info';
import { PackageInfoCache } from './package-info-cache';

/**
 * Class that stores information about a single EmberAppPackageJson within the PackageInfoCache.
 * This corresponds in voyager-web to 'voyager-web/packages/voyager-web'.
 */
export class EmberEnginePackageInfo extends EmberAddonPackageInfo {
  // other fields that will be set as needed. For JIT we'll define them here.

  constructor(
    packageJson: EmberEnginePackageJson,
    realPath: string,
    cache: PackageInfoCache,
    isRoot = false
  ) {
    super(packageJson, realPath, cache, isRoot);
  }

  // This will be overridden by subclasses
  typeName(): string {
    return 'ember-engine';
  }
}
