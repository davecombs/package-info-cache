/*
 * Small utility class to contain data about a single error found
 * during loading of a package into the PackageInfoCache.
 *
 * @protected
 * @class ErrorEntry
 */
export class ErrorEntry {
  type: string;
  data: unknown;

  constructor(type: string, data: unknown) {
    this.type = type;
    this.data = data;
  }
}
