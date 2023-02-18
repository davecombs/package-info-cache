import { ErrorEntry } from './error-entry';

/*
 * Small utility class to store a list of errors during loading of
 * a package into the PackageInfoCache.
 *
 * @protected
 * @class ErrorList
 */
export class ErrorList {
  errors: ErrorEntry[];

  constructor() {
    this.errors = [];
  }

  /*
   * Add an error. The errorData object is optional, and can be anything.
   * We do this so we don't really need to create a series of error
   * classes.
   *
   * @public
   * @param {String} errorType one of the Errors.ERROR_* constants.
   * @param {Object} errorData any error data relevant to the type of error
   * being created. See showErrors().
   */
  addError(errorType: string, errorData: unknown): void {
    this.errors.push(new ErrorEntry(errorType, errorData));
  }

  getErrors(): ErrorEntry[] {
    return this.errors;
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}
