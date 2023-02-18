import Debug from 'debug';
import path from 'node:path';
import type { PackageJson } from 'type-fest';

import { lexicographically, pushUnique } from '../utils';
import { ErrorList } from './error-list';
import { ERRORS } from './errors';
import { NodeModulesList } from './node-modules-list';
import { PackageInfoCache } from './package-info-cache';

const debug = Debug('PIC:package-info');

/**
 * Class that stores information about a single PackageJson (directory tree with
 * a package.json and other data) It or one of its subclasses is one of the
 * two types of entries in a PackageInfoCache. It is only created by the
 * PackageInfoCache.
 */
export class PackageInfo {
  packageJson: PackageJson;
  realPath: string;
  cache: PackageInfoCache;
  isRoot: boolean;
  errors: ErrorList;

  // obj keyed by dependency name, PackageInfo. All dependencies, not just addons
  dependenciesPackages?: Map<string, PackageInfo>;

  // obj keyed by devDep name, PackageInfo. All dependencies, not just addons
  devDependenciesPackages?: Map<string, PackageInfo>;

  optionalDependenciesPackages?: Map<string, PackageInfo>;

  // (NodeModulesList, set only if pkg contains node_modules)
  nodeModules?: NodeModulesList;

  // note that we're not defining peerDependenciesPackages, because they're supposed to be provided
  // by another object.

  // live indicator during processing
  processed = false;

  // live indicator during processing
  valid = true;

  #hasDumpedInvalidPackages: boolean;

  constructor(
    pkgObj: PackageJson,
    realPath: string,
    cache: PackageInfoCache,
    isRoot = false
  ) {
    this.packageJson = pkgObj;
    this.realPath = realPath;
    this.cache = cache;
    this.errors = new ErrorList();
    this.isRoot = isRoot;

    // other fields that will be set as needed. For JIT we'll define them here.
    this.dependenciesPackages = undefined;
    this.devDependenciesPackages = undefined;
    this.optionalDependenciesPackages = undefined;
    this.nodeModules = undefined;

    // flag indicating that the packageInfo is considered valid. This will
    // be true as long as we have a valid directory and our package.json file
    // is okay and, if we're an ember addon, that we have a valid 'main' file.
    // Missing dependencies will not be considered an error, since they may
    // not actually be used.
    this.valid = true;

    this.#hasDumpedInvalidPackages = false;
  }

  // Make various fields of the pkg object available.
  get name(): string | undefined {
    return this.packageJson.name;
  }

  // This will be overridden by subclasses
  typeName(): string {
    return 'package';
  }

  /**
   * Given error data, add an ErrorEntry to the ErrorList for this object.
   * This is used by the _readPackage and _readNodeModulesList methods. It
   * should not be called otherwise.
   *
   * @param errorType - one of the Errors.ERROR_* constants.
   * @param errorData - any error data relevant to the type of error
   * being created. See showErrors().
   */
  addError(errorType: string, errorData: unknown): void {
    this.errors.addError(errorType, errorData);
  }

  /**
   * Indicate if there are any errors in the ErrorList for this package. Note that this does
   * NOT indicate if there are any errors in the objects referred to by this package (e.g.,
   * internal addons or dependencies).
   */
  hasErrors(): boolean {
    return this.errors.hasErrors();
  }

  /**
   * For each dependency in the given list, find the corresponding
   * PackageInfo object in the cache (going up the file tree if
   * necessary, as in the node resolution algorithm). Return a map
   * of the dependencyName to PackageInfo object. Caller can then
   * store it wherever they like.
   *
   * Note: this is not to be  called until all packages that can be have
   * been added to the cache.
   *
   * Note: this is for ALL dependencies, not just addons. To get just
   * addons, filter the result by calling ember-addon-package-json.isEmberAddonPackageJson()
   * or check that the dependency's PackageInfo is actually an AddonPackageInfo;
   *
   * Note: this is only intended for use from PackageInfoCache._resolveDependencies.
   * It is not to be called directly by anything else.
   *
   * @param dependenciesObj - value of 'dependencies' or 'devDependencies' attributes
   * of a package.json.
   * @returns a JavaScript object keyed on dependency name/path with
   *    values the corresponding PackageInfo object from the cache.
   */
  doAddDependencies(
    dependenciesObj: Partial<Record<string, string>> | undefined,
    errorType: string,
    listName: string
  ): Map<string, PackageInfo> | undefined {
    if (!dependenciesObj) {
      return undefined;
    }

    const dependencyNames = Object.keys(dependenciesObj);

    if (dependencyNames.length === 0) {
      return undefined;
    }

    const packages: Map<string, PackageInfo> = new Map();

    const missingDependencies: string[] = [];

    dependencyNames.forEach((dependencyName) => {
      debug(
        `%s: From %o, trying to find %o %o`,
        this.packageJson.name,
        this.cache.relative(this.realPath),
        listName,
        dependencyName
      );

      let dependencyPackage: PackageInfo | undefined;

      // much of the time the package will have dependencies in
      // a node_modules inside it, so check there first because it's
      // quicker since we have the reference. Only check externally
      // if we don't find it there.
      if (this.nodeModules) {
        dependencyPackage = this.nodeModules.findPackage(dependencyName);
      }

      if (!dependencyPackage) {
        dependencyPackage = this.cache.findPackage(
          dependencyName,
          path.dirname(this.realPath)
        ) as PackageInfo;
      }

      if (dependencyPackage) {
        packages.set(dependencyName, dependencyPackage);
      } else {
        missingDependencies.push(dependencyName);
      }
    });

    if (missingDependencies.length > 0) {
      this.addError(errorType, missingDependencies);
    }

    return packages;
  }

  addDependencies(
    dependencies: Partial<Record<string, string>> | undefined
  ): Map<string, PackageInfo> | undefined {
    return this.doAddDependencies(
      dependencies,
      ERRORS.ERROR_DEPENDENCIES_MISSING,
      'dependencies'
    );
  }

  addDevDependencies(
    dependencies: Partial<Record<string, string>> | undefined
  ): Map<string, PackageInfo> | undefined {
    return this.doAddDependencies(
      dependencies,
      ERRORS.ERROR_DEVDEPENDENCIES_MISSING,
      'devDependencies'
    );
  }
  /**
   * Add to a list of child PackageInfos for this packageInfo.
   *
   * @param packageList - the list of child PackageInfos being constructed from various
   * sources in this packageInfo.
   * @param packageInfos - a list or map of PackageInfos being considered
   * (e.g., pkgInfo.dependencyPackages) for inclusion in the packageList.
   * @param excludeFn - an optional function. If passed in, each child PackageInfo
   * will be tested against the function and only included in the package map if the function
   * returns a truthy value.
   */
  addPackages(
    packageList: PackageInfo[],
    packageInfos: PackageInfo[] | Map<string, PackageInfo>,
    excludeFn?: ((pkgInfo: PackageInfo) => boolean) | undefined
  ): PackageInfo[] {
    const result: PackageInfo[] = [];

    if (Array.isArray(packageInfos)) {
      packageInfos.forEach((value) => {
        if (!excludeFn || !excludeFn(value)) {
          result.push(value);
        }
      });
    } else {
      for (const value of packageInfos.values()) {
        if (!excludeFn || !excludeFn(value)) {
          result.push(value);
        }
      }
    }

    result
      .sort(lexicographically)
      .forEach((pkgInfo) => pushUnique<PackageInfo>(packageList, pkgInfo));

    return result;
  }

  getValidPackages(packageList: PackageInfo[]): PackageInfo[] {
    return packageList.filter((pkgInfo) => pkgInfo.valid);
  }

  getInvalidPackages(packageList: PackageInfo[]): PackageInfo[] {
    return packageList.filter((pkgInfo) => !pkgInfo.valid);
  }

  dumpInvalidPackages(packageList: PackageInfo[]): void {
    if (this.#hasDumpedInvalidPackages) {
      return;
    }
    this.#hasDumpedInvalidPackages = true;

    const invalidPackages = this.getInvalidPackages(packageList);

    if (invalidPackages.length > 0) {
      let msg = `The 'package.json' file for the ${this.typeName()} at ${
        this.realPath
      }`;

      let relativePath;

      if (invalidPackages.length === 1) {
        relativePath = path.relative(
          this.realPath,
          (invalidPackages[0] as PackageInfo).realPath
        );
        msg = `${msg}\n  specifies an invalid, malformed or missing addon at relative path '${relativePath}'`;
      } else {
        msg = `${msg}\n  specifies invalid, malformed or missing addons at relative paths`;
        invalidPackages.forEach((packageInfo) => {
          relativePath = path.relative(this.realPath, packageInfo.realPath);
          msg = `${msg}\n    '${relativePath}'`;
        });
      }

      console.warn(msg); // this might be something else later.
    }
  }
}
