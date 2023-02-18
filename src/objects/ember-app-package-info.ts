import type { EmberAppPackageJson } from '../types/ember-app-package-json';
import { getObjectProperty } from '../utils';
import { EmberAddonPackageInfo } from './ember-addon-package-info';
import { EmberPackageInfo } from './ember-package-info';
import { PackageInfoCache } from './package-info-cache';

/**
 * Class that stores information about a single EmberAppPackageJson within the PackageInfoCache.
 * This corresponds in voyager-web to 'voyager-web/packages/voyager-web'.
 */
export class EmberAppPackageInfo extends EmberPackageInfo {
  // other fields that will be set as needed. For JIT we'll define them here.

  // both app and addon
  inRepoAddons?: EmberAddonPackageInfo[];

  constructor(
    packageJson: EmberAppPackageJson,
    realPath: string,
    cache: PackageInfoCache,
    isRoot = false
  ) {
    super(packageJson, realPath, cache, isRoot);

    this.inRepoAddons = undefined;
  }

  // This will be overridden by subclasses
  typeName(): string {
    return 'ember-app';
  }

  getAddonField(field: string): unknown {
    const val = getObjectProperty(this.packageJson, 'ember-addon.' + field);
    return val;
  }

  /**
   * Add a reference to an in-repo addon PackageInfo object.
   */
  addInRepoAddon(inRepoAddonPkg: EmberAddonPackageInfo): void {
    if (!this.inRepoAddons) {
      this.inRepoAddons = [];
    }
    this.inRepoAddons.push(inRepoAddonPkg);
  }

  // We MAY want to override the definition of addPackages here to limit
  // it to EmberAddonPackageInfo or EmberEnginePackageInfo or regular
  // PackageInfo. If we use this with 'regular' dependencies because they
  // can now use ember-auto-import and webpack5, then we can't really
  // limit it.
}
