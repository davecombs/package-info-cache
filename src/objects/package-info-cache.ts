/*
 * Singleton performance cache for information about packages (projects/addons/"apps"/modules)
 * under an initial root directory and resolving addon/dependency links to other packages.
 *
 * This is based on a package of the same name in 'ember-cli', which is how Ember determines
 * where the packages for its projects, apps and addons are during the build process.
 *
 * The way the cache gets set up is pretty straightforward, and it has a benefit over trying to
 * do it strictly by just parsing package.json files and trying to 'guess' the names of dependencies.
 * It works like this, and assumes you have already done 'yarn/npm install' to load the node_modules.
 *  - start with a directory path that contains either a project/app (like voyager-web) or an addon
 *    as the 'root' object of the cache.
 *  - Read in the package.json file.
 *  - From this you can figure out if this is for a project (like the 'voyager-web' directory),
 *    for an app (like voyager-web root dir used to be_\), or like voyager-web/packages/voyager-web is now)
 *    or an addon (like when you run 'ember serve' from an addon's root directory.)
 *  - If it's for an app starting elsewhere, just start with that other directory as the root.
 *  - Once you have your root directory, see if there is already an entry in the cache for the
 *    given directory. If so, return it and you're done.
 *  - if not, create a 'PackageInfo' object to wrap the package.json object. The PackageInfo
 *    object has various utility methods for doing things with that package in the cache.
 *  - put the PackageInfo object in the cache, keyed by the directory path
 *  - if the package is allowed to have addons as children (i.e. it's not a non-Ember npm package):
 *    - see if the directory has a 'node_modules' subdirectory. If not, go to the last step below.
 *    - create a 'NodeModulesList' object and insert it into the cache keyed on its directory path.
 *    - Go through all the entries in the node_modules directory. For each:
 *      - if its name starts with '@', it's a scoping directory. Recurse into it, reading its children, etc.
 *      - if it has a package.json file, it's an NPM package, possibly an addon or regular npm package.
 *        Recursively call the code to read that package and create its PackageInfo.
 *      - For either of the above, cache that packageInfo in the list maintained by the NodeModulesList.
 *      - if neither, it's either an invalid node_module or a regular file. Cache a 'invalid' entry.
 *  - When all the recursions above unwind, we've loaded the cache except for one thing - we haven't
 *    processed the dependencies/devDependencies/inRepoAddons to find each one's PackageInfo. Do that
 *    now. This is called from the root object's processing, in _resolveDependencies.
 *    - get all the packageInfos in the cache
 *    - for each, add its dependencies. If it is the packageInfo for the root,
 *         add the devDependencies as well.
 *         Mark the package as 'processed' to know not to process it again.
 *      - what 'addDependencies' does is go through the dependencies entries from
 *        the package.json, then for each, try to find the packageInfo for that
 *        dependency, starting from the current directory and going up the
 *        directory tree. At each stop it looks in the 'node_modules' directory
 *        of that directory if there is one (i.e. it does the node resolution
 *        algorithm). The algorithm will go all the way up to the root of the
 *        filesystem if necessary, looking for a package with the right filename.
 *        This is how it works with Voyager-Web now - the packages/voyager-web
 *        directory doesn't itself have a node_modules, but the voyager-web
 *        root directory DOES have node_modules, where we find all the real
 *        packages. Because it finds a package in that directory, it creates an
 *        entry in the cache and does 'readNodeModulesList' to fill it out, so
 *        all the packages that are up there also are added to the cache, even
 *        though they are not strictly in the hierarchy below the app.
 *    - At the end of all this, every packageInfo is in the cache, every 'node_modules'
 *      directory that is either inside a package's directory or is found by the
 *      node resolution algorithm is also in the cache, and every packageInfo
 *      has another PackageInfo for every entry in its 'dependencies'. The root
 *      object (either the app or an addon if running AIDE, also includes PackageInfos
 *      for their 'devDependencies' (this is correct behavior because devDependencies
 *      only apply for whatever you're working on directly, because devDependencies
 *      are only intended to help with its development, not the development of anything
 *      it depends on.)
 *
 *      One nice thing about the cache is that we can find out at any point whether the
 *      devDependencies or peerDependencies for any package WOULD be found in the tree,
 *      just by trying to do the same 'findDependency' using the node resolution algorithm.
 *
 */
import Debug from 'debug';
import fs from 'fs-extra';
import path from 'node:path';
import {
  _resetCache as resetPackagePathCache,
  getRealDirectoryPath,
  getRealFilePath,
} from 'resolve-package-path';

import { isEmberPackageJson } from '../types/ember-package-json';
import { getObjectProperty, isString, isStringArray } from '../utils';
import { EmberAddonPackageInfo } from './ember-addon-package-info';
import { EmberAppPackageInfo } from './ember-app-package-info';
import { ErrorList } from './error-list';
import { ERRORS } from './errors';
import { NodeModulesList } from './node-modules-list';
import { PackageInfo } from './package-info';
import { PackageInfoFactory } from './package-info-factory';

const debug = Debug('PIC:package-info-cache');
const PACKAGE_JSON = 'package.json';

export type PackageInfoCacheEntry = PackageInfo | NodeModulesList;

export class PackageInfoCache {
  entries: Map<string, PackageInfoCacheEntry>;
  projectRootDir: string | undefined;
  rootPackage?: PackageInfo; // it's required, but not set in constructor

  constructor() {
    this.entries = new Map<string, PackageInfoCacheEntry>();
    this.projectRootDir = undefined;
    resetPackagePathCache();
  }

  /**
   * Clear the cache information.
   */
  #clear(): void {
    this.entries = new Map<string, PackageInfoCacheEntry>();
    this.projectRootDir = undefined;
    resetPackagePathCache();
  }

  // simple utility to help shorten debug messages by removing the root path.
  relative(absPath: string): string {
    if (!this.projectRootDir) {
      return absPath;
    }

    return this.projectRootDir
      ? path.relative(this.projectRootDir, absPath)
      : absPath;
  }

  /**
   * Indicates if there is at least one error in any object in the cache.
   */
  hasErrors(): boolean {
    for (const cacheEntry of this.entries.values()) {
      if (cacheEntry.hasErrors()) {
        return true;
      }
    }

    return false;
  }

  /**
   * Return the list of PackageInfoCacheEntry objects that have errors.
   */
  findErrors(): PackageInfoCacheEntry[] {
    const errorEntries: PackageInfoCacheEntry[] = [];

    for (const cacheEntry of this.entries.values()) {
      if (cacheEntry.hasErrors()) {
        errorEntries.push(cacheEntry);
      }
    }

    return errorEntries;
  }

  /**
   * Gather all the errors in the PIC and any cached objects, then dump them
   * out to the console.
   */
  showErrors(): void {
    const errors = this.findErrors();
    errors.forEach((obj) => this.#showObjErrors(obj));
  }

  /**
   * Given an MP's root directory path, load the cache. The root directory,
   * e.g., 'voyager-web', is assumed to either contain the app directly, as
   * it did initially, or define the 'ember-addon'.projectRoot property to
   * point to the directory where the real application root is, as it does
   * after the reorganization to put the app at voyager-web/packages/voyager-web.
   *
   * This is called in 2 circumstances - directly by a caller, to load the cache
   * from the project, in which case 'isRoot' should be true, or by loadAddon(),
   * when something like an AIDE addon is the root, in which case 'isRoot'
   * must be false. loadAddon() is given the project root dir (instead of just
   * the app root dir), so we can do the 'projectRoot' trick if needed, to figure
   * out where the app dir is. We want to keep the project's root dir around
   * as it's useful when processing things like file names relative to the
   * project during lint-staged.
   *
   * @param projectRootDir - the absolute path of the project's root directory.
   * @param isRoot - is the project being loaded as the root package of the cache?
   */
  loadProject(projectRootDir: string, isRoot = true): PackageInfo {
    debug(
      `Initializing packageInfoCache from project root '${projectRootDir}'`
    );

    // Store the project/MP's root dir in the cache for later use, whether or
    // not this is actually the directory of the 'root' package (the app could
    // could be either here, like voyager-web used to be, or at 'ember-addon.projectRoot',
    // like v-web is now, or at some addon's root dir (AIDE addon)).
    // We don't really care about the project's package, unless it also happens
    // to be the app's package, so we just want to store the directory path.
    this.projectRootDir = projectRootDir;

    // In this one case, we need to pre-empt the normal #readPackage mechanism
    // to figure out if we're in the app root directory yet and if not, shift to it.
    const projectPkgJson = fs.readJsonSync(
      path.join(projectRootDir, 'package.json'),
      {
        encoding: 'utf-8',
        throws: false,
      }
    ) as unknown;

    if (!projectPkgJson) {
      debug(`The 'package.json' file is either invalid or does not exist`);
      // we're going to go ahead and allow loading the app anyway, which should put
      // an invalid project entry into the cache.
    } else {
      debug(`Found the 'package.json' file`);

      // allow `package.json` files to specify where the actual project lives
      // via the 'ember-addon.projectRoot setting.
      const projectRoot = this.#findEmberProjectRoot(projectPkgJson);

      if (projectRoot) {
        if (fs.existsSync(path.join(projectRootDir, 'ember-cli-build.js'))) {
          throw new Error(
            `Both 'ember-addon.projectRoot' and 'ember-cli-build.js' exist in the project directory`
          );
        }

        // Load from the real app root (e.g., voyager-web/packages/voyager-web).
        return this.loadApp(path.resolve(projectRootDir, projectRoot), isRoot);
      }
    }

    // We have the case like voyager-web used to be - the app and the project are
    // in the same place.
    return this.loadApp(projectRootDir, isRoot);
  }

  /**
   * Do the initial load from the point of view of the app's root directory.
   * @param appRootDir - the absolute path of the app's root directory (e.g. for voyager-web,
   * it's voyager-web/packages/voyager-web.)
   * @param isRoot - is this the root object of the run? The app is usually considered the
   * 'root' object of the run, i.e. it's the one for whom 'devDependencies' are loaded. When
   * loading from the point of view of an addon, though, the app is loaded because we want to
   * compare against it, but is NOT the root, because the addon is.
   * @returns
   */
  loadApp(appRootDir: string, isRoot = true): PackageInfo {
    const pkgInfo = this.#readPackage(appRootDir, isRoot);

    if (pkgInfo.processed) {
      return pkgInfo;
    }

    // NOTE: the returned val may contain errors, or may contain
    // other packages that have errors. We will try to process
    // things anyway.
    if (isRoot) {
      this.rootPackage = pkgInfo;

      // We're skipping the internal addons defined by ember-cli  (for now)
      // (see ember-cli/lib/models/project.js for the 'supportedInternalAddons' method)
      // We only resolve dependencies when we're the root, so that
      // everything is loaded before that's done.
      this.#resolveDependencies();
    }

    return pkgInfo;
  }

  /**
   * Load the cache from the point of view of a specific addon, e.g., when doing AIDE.
   * Unlike loadProject and loadApp, this function is never called indirectly.
   * @param addonRootDir - the absolute path to the addon's root directory
   * @param projectRelativePath - the relative path from the addon's root directory to the
   * project/MP's root directory. We need to record the project's root dir for later use,
   * and we need the app's package, which may be there or elsewhere - loadProject is the
   * one that does that.
   * @returns the PackageInfo object for the addon.
   */
  loadAddon(addonRootDir: string, projectRelativePath: string): PackageInfo {
    const pkgInfo = this.#readPackage(addonRootDir, true);

    if (pkgInfo.processed) {
      return pkgInfo;
    }

    // NOTE: the returned pkgInfo may contain errors, or may contain
    // other packages that have errors. We will try to process
    // things anyway.
    this.rootPackage = pkgInfo;
    this.loadProject(path.resolve(addonRootDir, projectRelativePath), false);
    this.#resolveDependencies();

    return pkgInfo;
  }

  /**
   * Retrieve an entry from the cache.
   *
   * @param absolutePath - the real path whose PackageInfo or NodeModulesList is desired.
   * @returns the desired entry, or undefined.
   */
  getEntry(absolutePath: string): PackageInfo | NodeModulesList | undefined {
    return this.entries.get(absolutePath);
  }

  /**
   * Indicate if an entry for a given path exists in the cache.
   *
   * @param absolutePath - the real path to check for in the cache.
   * @returns true if the entry is present for the given path, false otherwise.
   */
  contains(absolutePath: string): boolean {
    return this.getEntry(absolutePath) !== undefined;
  }

  /*
   * Find a PackageInfo cache entry with the given path. If there is
   * no entry in the startPath, do as done in resolve.sync() - travel up
   * the directory hierarchy, attaching 'node_modules' to each directory and
   * seeing if the directory exists and has the relevant entry.
   *
   * We'll do things a little differently, though, for speed.
   *
   * If there is no cache entry, we'll try to use _readNodeModulesList to create
   * a new cache entry and its contents. If the directory does not exist,
   * We'll create a NodeModulesList cache entry anyway, just so we don't have
   * to check with the file system more than once for that directory (we
   * waste a bit of space, but gain speed by not hitting the file system
   * again for that path).
   * Once we have a NodeModulesList, check for the package name, and continue
   * up the path until we hit the root or the PackageInfo is found.
   *
   * XXX Need to test whether we support scoped names this way!!! If not, needs
   * to be added ASAP!
   *
   * @private
   * @method _findPackage
   * @param {String} packageName the name/path of the package to search for
   * @param {String} the path of the directory to start searching from
   */
  findPackage(packageName: string, startPath: string): PackageInfo | undefined {
    const parsedPath = path.parse(startPath);
    const root = parsedPath.root;

    let currPath = startPath;

    while (currPath !== root) {
      const endsWithNodeModules = path.basename(currPath) === 'node_modules';

      const nodeModulesPath = endsWithNodeModules
        ? currPath
        : `${currPath}${path.sep}node_modules`;

      const nodeModulesList = this.#readNodeModulesList(nodeModulesPath);

      // _readNodeModulesList only returns a NodeModulesList or null
      if (nodeModulesList) {
        const pkg = nodeModulesList.findPackage(packageName);
        if (pkg) {
          return pkg;
        }
      }

      currPath = path.dirname(currPath);
    }

    return undefined;
  }

  /**
   * Starting from a given directory, determine where a particular dependency
   * is found, given its name. This is the name AS USED IN IMPORTS, not the file name.
   * This is to help with the 'no transient dependencies' issue.
   * @param startPath - the directory path to start from
   * @param dependencyName - the name of the dependency as used in imports.
   */
  findDependency(
    startPath: string,
    dependencyName: string
  ): PackageInfo | undefined {
    console.trace(
      `startPath = ${startPath}, dependencyName = ${dependencyName}`
    );
    return undefined;
  }

  /**
   * Dump all the errors for a single object in the cache out to the console.
   *
   * Special case: because package-info-cache also creates PackageInfo objects for entries
   * that do not actually exist (to allow simplifying the code), if there's a case where
   * an object has only the single error ERROR_PACKAGE_DIR_MISSING, do not print
   * anything. The package will have been found as a reference from some other
   * addon or the root project, and we'll print a reference error there. Having
   * both is just confusing to users.
   */
  #showObjErrors(obj: PackageInfoCacheEntry): void {
    const errorEntries = obj.hasErrors() ? obj.errors.getErrors() : undefined;

    if (errorEntries === undefined) {
      return;
    }

    if (errorEntries.length === 1) {
      const entry = errorEntries[0];

      if (entry && entry.type === ERRORS.ERROR_PACKAGE_DIR_MISSING) {
        return;
      }
    }

    console.info('');

    const typeName = obj instanceof EmberAppPackageInfo ? 'app' : 'addon';

    console.info(
      `Errors for the 'package.json' file for the ${typeName} at ${obj.realPath}`
    );

    const rootPath = obj.realPath;

    errorEntries.forEach((errorEntry) => {
      // for DEPENDENCIES_MISSING: can't declare it in the block - lint error
      let dependencyNames: string[];

      switch (errorEntry.type) {
        case ERRORS.ERROR_PACKAGE_JSON_MISSING:
          console.info(`  does not exist`);
          break;
        case ERRORS.ERROR_PACKAGE_JSON_PARSE:
          console.info(`  could not be parsed`);
          break;
        case ERRORS.ERROR_EMBER_ADDON_MAIN_MISSING:
          console.info(
            `  specifies a missing ember-addon 'main' file at relative path '${path.relative(
              rootPath,
              errorEntry.data as string
            )}'`
          );
          break;
        case ERRORS.ERROR_DEPENDENCIES_MISSING:
          dependencyNames = errorEntry.data as string[];

          if (dependencyNames.length === 1) {
            console.info(
              `  specifies a dependency that was not loaded '${dependencyNames[0]}'`
            );
          } else {
            console.info(`  specifies some dependencies that were not loaded:`);
            dependencyNames.forEach((dependencyName) => {
              console.info(`    '${dependencyName}'`);
            });
          }
          break;
        case ERRORS.ERROR_DEVDEPENDENCIES_MISSING:
          dependencyNames = errorEntry.data as string[];

          if (dependencyNames.length === 1) {
            console.info(
              `  specifies a devDependency that was not loaded '${dependencyNames[0]}'`
            );
          } else {
            console.info(
              `  specifies some devDependencies that were not loaded:`
            );
            dependencyNames.forEach((dependencyName) => {
              console.info(`    '${dependencyName}'`);
            });
          }
          break;

        case ERRORS.ERROR_NODEMODULES_ENTRY_MISSING:
          console.info(
            `  specifies a missing 'node_modules/${errorEntry.data}' directory`
          );
          break;
      }
    });
  }

  /**
   * Given a project package.json, see if it has ember-addon.projectRoot. If so, return it.
   * If not, return undefined.
   * @param packageJson - a supposed packageJson object, though we'll check it anyway
   * @returns a string, the projectRoot value, if it exists, else undefined
   */
  #findEmberProjectRoot(packageJson: unknown): string | undefined {
    if (!isEmberPackageJson(packageJson)) {
      return undefined;
    }

    // Figure out if we have an 'ember-addon' block and it has 'projectRoot' in it.
    // The simplest TS way to do that is to temporarily use it as just a regular JS object.
    const projectRoot = getObjectProperty(
      packageJson,
      'ember-addon.projectRoot'
    );

    return isString(projectRoot) ? projectRoot : undefined;
  }

  /**
   * Resolve the node_modules dependencies across all packages after they have
   * been loaded into the cache, because we don't know when a particular package
   * will enter the cache.
   */
  #resolveDependencies(): void {
    debug('Resolving dependencies...');

    const packageInfos = this.#getPackageInfos();

    packageInfos.forEach((packageInfo) => {
      if (!packageInfo.processed) {
        let pkgs = packageInfo.addDependencies(
          packageInfo.packageJson.dependencies
        );
        packageInfo.dependenciesPackages = pkgs;

        // for roots only, we add the devDependencies
        if (packageInfo.isRoot) {
          pkgs = packageInfo.addDevDependencies(
            packageInfo.packageJson.devDependencies
          );
          packageInfo.devDependenciesPackages = pkgs;
        }

        // XXX do we need to do anything with PeerDependencies?

        packageInfo.processed = true;
      }
    });
  }

  /**
   * Get all the PackageInfo instances from the stored entries and return an array of them
   * @returns an array of all the PackageInfo objects (as opposed to the NodeModulesList objects)
   */
  #getPackageInfos(): PackageInfo[] {
    const result: PackageInfo[] = [];

    this.entries.forEach((entry) => {
      if (entry instanceof PackageInfo) {
        result.push(entry);
      }
    });

    return result;
  }

  /**
   * Add an entry to the cache.
   */
  #addEntry(absolutePath: string, entry: PackageInfo | NodeModulesList): void {
    this.entries.set(absolutePath, entry);
  }

  /**
   * Given a directory that supposedly contains a package, create a PackageInfo
   * object and try to fill it out, EVEN IF the package.json is not readable.
   * Errors will then be stored in the PackageInfo for anything with the package
   * that might be wrong.
   * Because it's possible that the path given to the packageDir is not actually valid,
   * we'll just use the path.resolve() version of that path to search for the
   * path in the cache, before trying to get the 'real' path (which also then
   * resolves links). The cache itself is keyed on either the realPath, if the
   * packageDir is actually a real valid directory path, or the normalized path (before
   * path.resolve()), if it is not.
   *
   * If there is no package.json or the package.json is bad or the package is an addon with
   * no main, the only thing we can do is return an ErrorEntry to the caller.
   * Once past all those problems, if any error occurs with any of the contents
   * of the package, they'll be cached in the PackageInfo itself.
   *
   * In summary, only PackageInfo or ErrorEntry will be returned.
   *
   * @param packageDir - the path of the directory to read the package.json from and
   * process the contents and create a new cache entry or entries.
   * @param isRoot - for when this is to be considered the root package, whose
   * devDependencies we must also consider for discovery.
   */
  #readPackage(packageDir: string, isRoot = false): PackageInfo {
    const normalizedPackageDir = path.normalize(packageDir);

    // Most of the time, normalizedPackageDir is already a real path (i.e. fs.realpathSync
    // will return the same value as normalizedPackageDir if the dir actually exists).
    // Because of that, we'll assume we can test for normalizedPackageDir first and return
    // if we find it.
    let packageInfo = this.getEntry(normalizedPackageDir);

    if (packageInfo instanceof PackageInfo) {
      return packageInfo;
    }

    // at this point it's either a NodeModulesList or undefined
    if (packageInfo) {
      throw new Error(
        `Attempted to read a PackageInfo from path ${normalizedPackageDir}, but the path points to a directory`
      );
    }

    // at this point pkgInfo is undefined.

    // collect errors we hit while trying to create the PackageInfo object.
    // We'll load these into the object once it's created.
    const setupErrors = new ErrorList();

    // We don't already have an entry (bad or otherwise) at normalizedPackageDir. See if
    // we can actually find a real path (including resolving links if needed).
    let pathFailed = false;

    let realPath = getRealDirectoryPath(normalizedPackageDir);

    if (realPath === null) {
      // no realPath, so either nothing is at the path or it's not a directory.
      // We need to use normalizedPackageDir as the real path.
      pathFailed = true;
      setupErrors.addError(
        ERRORS.ERROR_PACKAGE_DIR_MISSING,
        normalizedPackageDir
      );
      realPath = normalizedPackageDir;
    } else if (realPath !== normalizedPackageDir) {
      // getRealDirectoryPath actually changed something in the path (e.g.,
      // by resolving a symlink), so see if we have this entry.
      packageInfo = this.getEntry(realPath);

      if (packageInfo instanceof PackageInfo) {
        return packageInfo;
      }

      if (packageInfo) {
        throw new Error(
          `Attempted to read a PackageInfo from real path ${realPath}, but the path points to a directory`
        );
      }
    }

    // at this point we have realPath set, we don't already have a PackageInfo
    // for the path, and the path may or may not actually correspond to a
    // valid directory (pathFailed tells us which). We need to be able to read
    // the package.json, unless we also dont have a path.
    let packageJson: Record<string, unknown> | undefined;

    if (!pathFailed) {
      const packageJsonPath = path.join(realPath, PACKAGE_JSON);
      const packageDataPath = getRealFilePath(packageJsonPath); // figure out if the path is valid or not
      if (packageDataPath) {
        // we have a real file path. Read the JSON and parse into an object, or null if there
        // was an error. Once we know we have something besides null, convert to a record.
        const pkgObj = fs.readJsonSync(packageDataPath, {
          throws: false,
        }) as unknown;
        if (!pkgObj) {
          setupErrors.addError(
            ERRORS.ERROR_PACKAGE_JSON_PARSE,
            packageDataPath
          );
        } else {
          packageJson = pkgObj as Record<string, unknown>;
        }
      } else {
        setupErrors.addError(
          ERRORS.ERROR_PACKAGE_JSON_MISSING,
          packageJsonPath
        );
      }
    }

    // Some error has occurred resulting in no pkg object, so just
    // create an empty one so we have something to use below.
    if (packageJson === undefined) {
      packageJson = { name: 'invalid package.json' };
    }

    // For storage, force the pkg.root to the calculated path. This will
    // save us from issues where we have a package for a non-existing
    // path and other stuff.
    packageJson.root = realPath;

    // Create a new PackageInfo and load any errors as needed.
    // Note that pkg may be an empty object here.

    debug(
      `Creating new PackageInfo instance for %o at %o`,
      packageJson.name,
      this.relative(realPath)
    );

    const newPackageInfo = PackageInfoFactory.create(
      packageJson,
      realPath,
      this,
      isRoot
    );

    // We need the parent package in the cache before adding children, even if the
    // children might have errors, so we'll add the existing errors here and load it.
    if (setupErrors.hasErrors()) {
      newPackageInfo.errors = setupErrors;
      newPackageInfo.valid = false;
    }

    // The packageInfo itself is now "complete", though we have not
    // yet dealt with any of its "child" packages. Add it to the
    // cache
    this.#addEntry(realPath, newPackageInfo);

    // Set up packageInfos for any in-repo addons
    const paths = getObjectProperty(
      newPackageInfo,
      'packageJson.ember-addon.paths'
    );

    const realPathStr = realPath; // TS insists that realPath below is possibly undefined, so I have to do this.

    if (isStringArray(paths)) {
      paths.forEach((p) => {
        const addonPath = path.join(realPathStr, p); // real path, though may not exist.
        debug('Adding in-repo-addon at %o', this.relative(addonPath));
        const addonPkgInfo = this.#readPackage(addonPath); // may have errors in the addon package.

        if (addonPkgInfo instanceof EmberAddonPackageInfo) {
          (newPackageInfo as EmberAddonPackageInfo).addInRepoAddon(
            addonPkgInfo
          );
        } else {
          newPackageInfo.errors.addError(
            `The addon's 'paths' entry '${p}' is not an addon!`,
            undefined
          );
          newPackageInfo.valid = false;
        }
      });
    }

    if (
      newPackageInfo instanceof EmberAddonPackageInfo ||
      newPackageInfo instanceof EmberAppPackageInfo
    ) {
      debug('Reading "node_modules" for %o', this.relative(realPath));

      // read addon modules from node_modules. We read the whole directory
      // because it's assumed that npm/yarn may have placed addons in the
      // directory from lower down in the project tree, and we want to get
      // the data into the cache ASAP. It may not necessarily be a 'real' error
      // if we find an issue, if nobody below is actually invoking the addon.
      const nodeModules = this.#readNodeModulesList(
        path.join(realPath, 'node_modules')
      );

      if (nodeModules instanceof NodeModulesList) {
        newPackageInfo.nodeModules = nodeModules;
      }
    } else {
      // will not have node_modules addons, so even if there are node_modules here, we can
      // simply pretend there are none.
      newPackageInfo.nodeModules = NodeModulesList.nullInstance;
    }

    return newPackageInfo;
  }

  /**
   * Process a directory of modules in a given package directory.
   *
   * We will allow cache entries for node_modules that actually
   * have no contents, just so we don't have to hit the file system more
   * often than necessary--it's much quicker to check an in-memory object.
   * object.
   *
   * Note: only a NodeModulesList or undefined is returned.
   *
   * @param nodeModulesDir - the path of the node_modules directory
   *  to read the package.json from and process the contents and create a
   *  new cache entry or entries.
   */
  #readNodeModulesList(nodeModulesDir: string): NodeModulesList | undefined {
    const normalizedNodeModulesDir = path.normalize(nodeModulesDir);

    // Much of the time, normalizedNodeModulesDir is already a real path (i.e.
    // fs.realpathSync will return the same value as normalizedNodeModulesDir, if
    // the directory actually exists). Because of that, we'll assume
    // we can test for normalizedNodeModulesDir first and return if we find it.
    let nodeModulesEntry = this.getEntry(normalizedNodeModulesDir);

    if (nodeModulesEntry instanceof NodeModulesList) {
      return nodeModulesEntry;
    }

    if (nodeModulesEntry) {
      throw new Error(
        `Attempted to read a NodeModulesList from path ${normalizedNodeModulesDir}, but there is already another object there`
      );
    }

    // NOTE: because we call this when searching for objects in node_modules
    // directories that may not exist, we'll just return undefined here if the
    // directory is not real. If it actually is an error in some case,
    // the caller can create the error there.
    const realPath = getRealDirectoryPath(normalizedNodeModulesDir);

    if (realPath === null) {
      return undefined;
    }

    // realPath may be different than the original normalizedNodeModulesDir, so
    // we need to check the cache again.
    if (realPath !== normalizedNodeModulesDir) {
      nodeModulesEntry = this.getEntry(realPath);
      if (nodeModulesEntry instanceof NodeModulesList) {
        return nodeModulesEntry;
      }

      if (nodeModulesEntry instanceof PackageInfo) {
        throw new Error(
          `Attempted to read a NodeModulesList from path '${this.relative(
            realPath
          )}', but there is already a PackageInfo there`
        );
      }
    }

    // At this point we know the directory node_modules exists and we can
    // process it. Further errors will be recorded here, or in the objects
    // that correspond to the node_modules entries.

    debug(
      `Creating new NodeModulesList instance for %o`,
      this.relative(realPath)
    );

    // Annoyingly, because we assign 'nodeModulesEntry' above by doing 'getEntry',
    // TS insists that the type is PackageInfo | NodeModulesList | undefined,
    // but I need to force it to narrow to "it's just a NodeModulesList"
    const newNodeModulesList = new NodeModulesList(realPath, this);

    const entries = fs.readdirSync(realPath).filter((fileName) => {
      if (fileName.startsWith('.') || fileName.startsWith('_')) {
        // we explicitly want to ignore these, according to the
        // definition of a valid package name.
        return false;
      } else if (fileName.startsWith('@')) {
        return true;
      } else if (!fs.existsSync(`${realPath}/${fileName}/package.json`)) {
        // a node_module is only valid if it contains a package.json
        return false;
      } else {
        return true;
      }
    }); // should not fail because getRealDirectoryPath passed

    entries.forEach((entryName) => {
      // entries should be either a package or a scoping directory. I think
      // there can also be files, but we'll ignore those.

      const entryPath = path.join(realPath, entryName);

      if (getRealFilePath(entryPath)) {
        // we explicitly want to ignore valid regular files in node_modules.
        // This is a bit slower than just checking for directories, but we need to be sure.
        return;
      }

      // At this point we have an entry name that should correspond to
      // a directory, which should turn into either a NodeModulesList or
      // PackageInfo. If not, it's an error on this NodeModulesList.
      let entryVal;

      if (entryName.startsWith('@')) {
        // we should have a scoping directory.
        entryVal = this.#readNodeModulesList(entryPath);

        // readModulesDir only returns NodeModulesList or null
        if (entryVal instanceof NodeModulesList) {
          newNodeModulesList.addEntry(entryName, entryVal);
        } else {
          // This (null return) really should not occur, unless somehow the
          // dir disappears between the time of fs.readdirSync and now.
          newNodeModulesList.addError(
            ERRORS.ERROR_NODEMODULES_ENTRY_MISSING,
            entryName
          );
        }
      } else {
        // we should have a package. We will always get a PackageInfo
        // back, though it may contain errors.
        entryVal = this.#readPackage(entryPath);
        newNodeModulesList.addEntry(entryName, entryVal);
      }
    });

    this.#addEntry(realPath, newNodeModulesList);

    return newNodeModulesList;
  }
}
