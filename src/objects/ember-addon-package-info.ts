import path from 'node:path';
import { getRealFilePath } from 'resolve-package-path';

import type { EmberAddonPackageJson } from '../types/ember-addon-package-json';
import { getObjectProperty } from '../utils';
import { EmberPackageInfo } from './ember-package-info';
import { ERRORS } from './errors';
import { PackageInfoCache } from './package-info-cache';

/**
 * Class that stores information about a single EmberAppPackageJson within the PackageInfoCache.
 * This corresponds in voyager-web to 'voyager-web/packages/voyager-web'.
 */
export class EmberAddonPackageInfo extends EmberPackageInfo {
  // other fields that will be set as needed. For JIT we'll define them here.

  // the computed name of the path to the addon entry point file, whether or not
  // it was specified in the package.json. Calculated during PIC.readPackage().
  addonMainPath?: string;

  // both app and addon
  inRepoAddons?: EmberAddonPackageInfo[];

  constructor(
    packageJson: EmberAddonPackageJson,
    realPath: string,
    cache: PackageInfoCache,
    isRoot = false
  ) {
    super(packageJson, realPath, cache, isRoot);

    // Check that the main exists and points to a valid file.
    // Note: when we have both 'main' and ember-addon:main, the latter takes precedence
    const emberAddonMain = getObjectProperty(packageJson, 'ember-addon.main');

    const main = emberAddonMain || packageJson.main;

    let mainFile: string;

    if (!main || main === '.' || main === './' || typeof main !== 'string') {
      mainFile = 'index.js';
    } else if (!path.extname(main)) {
      mainFile = `${main}.js`;
    } else {
      mainFile = main;
    }

    // console.info('Addon entry point is %o', mainFile);
    packageJson.main = mainFile;

    const mainPath = path.join(realPath, mainFile);
    const mainRealPath = getRealFilePath(mainPath);

    if (mainRealPath) {
      this.addonMainPath = mainRealPath;
    } else {
      this.addError(ERRORS.ERROR_EMBER_ADDON_MAIN_MISSING, mainPath);
      this.valid = false;
    }
  }

  // This will be overridden by subclasses
  typeName(): string {
    return 'ember-addon';
  }

  getAddonField(field: string): unknown {
    return getObjectProperty(this.packageJson, 'ember-addon.' + field);
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
