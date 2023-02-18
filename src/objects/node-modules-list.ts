import { ErrorList } from './error-list';
import { PackageInfo } from './package-info';
import { PackageInfoCache } from './package-info-cache';

/**
 * Class that stores information about a node_modules directory (i.e., the
 * packages and subdirectories in the directory). It is one of the
 * two types of entries in a PackageInfoCache. It is only created by the
 * PackageInfoCache.
 */
export class NodeModulesList {
  realPath: string;
  hasEntries: boolean;
  entries: Map<string, PackageInfo | NodeModulesList>;
  errors: ErrorList;
  cache?: PackageInfoCache;

  constructor(realPath: string, cache?: PackageInfoCache) {
    this.realPath = realPath;
    this.hasEntries = false; // for speed
    this.entries = new Map();
    this.errors = new ErrorList();
    this.cache = cache;
  }

  // when we encounter a node_modules we will never traverse, we insert a NULL variant.
  // https://en.wikipedia.org/wiki/Null_object_pattern
  // returns a Frozen and Empty NodeModulesList
  static #nullInstance: NodeModulesList;

  static get nullInstance(): NodeModulesList {
    if (NodeModulesList.#nullInstance) {
      return NodeModulesList.#nullInstance;
    }

    NodeModulesList.#nullInstance = new this('/dev/null'); // could be anywhere, why not /dev/null?

    Object.freeze(NodeModulesList.#nullInstance.entries);
    Object.freeze(NodeModulesList.#nullInstance.errors.errors);
    Object.freeze(NodeModulesList.#nullInstance.errors);
    Object.freeze(NodeModulesList.#nullInstance);

    return NodeModulesList.#nullInstance;
  }

  /**
   * Given error data, add an ErrorEntry to the ErrorList for this object.
   *
   * @param errorType - one of the Errors.ERROR_* constants.
   * @param errorData - any error data relevant to the type of error
   * being created. See showErrors().
   */
  addError(errorType: string, errorData: unknown): void {
    this.errors.addError(errorType, errorData);
  }

  /**
   * Indicate if there are any errors in the NodeModulesList itself (not
   * including errors within the individual entries).
   */
  hasErrors(): boolean {
    return this.errors.hasErrors();
  }

  /**
   * Add an entry (PackageInfo or NodeModulesList instance) to the entries
   * for this list. This is only called by PackageInfoCache. It is not intended
   * to be called directly by anything else.
   *
   * @param entryName - the name of the entry, i.e., the name of the
   * file or subdirectory in the directory listing.
   * @param entryVal - the PackageInfo or NodeModulesList tha corresponds
   * to the given entry name in the file system.
   */
  addEntry(entryName: string, entryVal: PackageInfo | NodeModulesList): void {
    this.hasEntries = true;
    this.entries.set(entryName, entryVal);
  }

  /**
   * Return a PackageInfo object for a given package name (which may include
   * a scope)
   *
   * @param packageName - the name of the desired package
   * @returns the associated PackageInfo, or undefined if not found
   */
  findPackage(packageName: string): PackageInfo | undefined {
    if (!this.hasEntries) {
      return undefined;
    } // for speed

    let val: PackageInfo | undefined;

    if (packageName.startsWith('@')) {
      // scoped package name. Should have at least 2 parts.
      const parts = packageName.split('/');

      const entry = this.entries.get(parts[0] as string); // scope
      val =
        entry instanceof NodeModulesList
          ? entry.findPackage(parts[1] as string) // scoped package name
          : undefined;
    } else {
      val = this.entries.get(packageName) as PackageInfo;
    }

    return val;
  }
}
