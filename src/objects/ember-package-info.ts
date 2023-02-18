import type { EmberPackageJson } from '../types/ember-package-json';
import { PackageInfo } from './package-info';
import { PackageInfoCache } from './package-info-cache';

/**
 * Class that stores information about a single EmberPackageJson within the PackageInfoCache.
 * The EmberPackage really isn't anything except a marker class to parallel EmberPackageJson
 */
export class EmberPackageInfo extends PackageInfo {
  // other fields that will be set as needed. For JIT we'll define them here.

  // note that we're not defining peerDependencyPackages, because they're supposed to be provided
  // by another object. Same for 'optionalDependencies'.

  constructor(
    packageJson: EmberPackageJson,
    realPath: string,
    cache: PackageInfoCache,
    isRoot = false
  ) {
    super(packageJson, realPath, cache, isRoot);
  }

  // This will be overridden by subclasses
  typeName(): string {
    return 'ember-package';
  }
}
