import { isEmberAddonPackageJson } from '../types/ember-addon-package-json';
import { isEmberAppPackageJson } from '../types/ember-app-package-json';
import { isEmberEnginePackageJson } from '../types/ember-engine-package-json';
import { isEmberPackageJson } from '../types/ember-package-json';
import { EmberAddonPackageInfo } from './ember-addon-package-info';
import { EmberAppPackageInfo } from './ember-app-package-info';
import { EmberEnginePackageInfo } from './ember-engine-package-info';
import { EmberPackageInfo } from './ember-package-info';
import { PackageInfo } from './package-info';
import { PackageInfoCache } from './package-info-cache';

/**
 * A factory to create the right type of PackageInfo class, based on the
 * data in the incoming package.json data.
 */
export class PackageInfoFactory {
  static create(
    pkgJson: Record<string, unknown>,
    realPath: string,
    cache: PackageInfoCache,
    isRoot: boolean
  ): PackageInfo {
    // we have to do this from most specific up to least, because any superclass tests
    // would pass before the subclass ones would have a chance.
    if (isEmberEnginePackageJson(pkgJson)) {
      return new EmberEnginePackageInfo(pkgJson, realPath, cache, isRoot);
    }

    if (isEmberAddonPackageJson(pkgJson)) {
      return new EmberAddonPackageInfo(pkgJson, realPath, cache, isRoot);
    }

    if (isEmberAppPackageJson(pkgJson)) {
      return new EmberAppPackageInfo(pkgJson, realPath, cache, isRoot);
    }

    if (isEmberPackageJson(pkgJson)) {
      return new EmberPackageInfo(pkgJson, realPath, cache, isRoot);
    }

    return new PackageInfo(pkgJson, realPath, cache, isRoot);
  }
}
