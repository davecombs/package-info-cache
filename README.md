# package-info-cache

A utility cache for storing and querying `package.json` data inside a (typically
Ember) project.

<hr>

## Overview

The cache is based on the `ember-cli/lib/models/package-info-cache` cache, and
is in fact a port/update of that code from JavaScript to TypeScript. I also
cleaned up and simplified things in several areas.

- Instead of having a single `PackageInfo` class with functions to decide what
  kind, when a `package.json` file is read in and needs to be put into a
  `PackageInfo` instance, a factory class decides which `PackageInfo` subclass
  is most appropriate.

- A number of `PackageInfo` methods were moved from the general `PackageInfo`
  class to one of the subclasses - for example, it doesn't make sense to ask
  about the `ember-addon` field in a `package.json` that's for a non-Ember
  package.

- There is a much more explicit description of the cache process in the
  [PackageInfoCache](./src/objects/package-info-cache.ts) file.

- Because this cache is a modified copy of the one used in `ember-cli`, the
  implemented behavior is exactly what `ember-cli` (and `node`) use to resolve
  packages.

## The `PackageInfoCache` Class

The object that is the whole cache.

### Public Properties

- `entries` - A `Map`, the actual cache of instances of `PackageInfo` and
  `NodeModulesList` objects. Each represents a directory on disk, either for an
  NPM module's root directory or a `node_modules` directory. The `PackageInfo`
  instances each have a `packageJson` field that contains an in-memory copy of
  the associated `package.json` file.

- `rootPackage` - the instance of a `PackageInfo` class that's either an
  `EmberAppPackageInfo`, an `EmberAddonPackageInfo` or an
  `EmberEnginePackageInfo`, depending on the contents of the `package.json`
  file.

### Public Methods

- `constructor()` - takes no parameters and just creates a "blank" instance of
  the cache. One of the `load` methods below is needed to fill it with data.

- `contains(absolutePath)` - indicates if the cache contains an entry, either a
  `PackageInfo` or a `NodeModulesList`, for the given path.

- `findDependency(startPath, dependencyName)` - run the node resolution
  algorithm from the startPath until an entry with the given name is found, then
  return the entry.

- `findErrors()` - return an array of objects in the cache that have errors
  detected during loading, like missing dependencies, bad format, no
  package.json, etc.

- `findPackage(packageName, startPath)` - find a `PackageInfo` instance with the
  given name, starting at the given directory. Searches the cache in node
  resolution order (i.e. going "up" through NodeModulesList objects) until it
  finds an entry with the given name.

- `getEntry(absolutePath)` - return the `PackageInfo` or `NodeModulesList`
  object at the given path, or undefined if none was found.

- `hasErrors()` - indicate if there are any errors in any entries in the cache.

- `loadAddon(addonRootDir, appRelativePath)` - used when you want to base the
  cache on an addon (i.e., AIDE). `addonRootDir` will be considered the root
  package of the cache. `appRelativePath` is the path to the root directory of
  the app. The app and dependencies will be cached, but the app will not be the
  root package of the cache.

- `loadApp(appRootDir, isRoot=true)` - used when you want to load an app into
  the cache. This is called in three cases:

  - as the root package of the cache when the user knows the root directory of
    the app
  - as 'the app' when the user is loading an AIDE-style addon to be the root
    package of the cache
  - as the root package of the cache when the user calls `loadProject()` and the
    `package.json` has an `ember-addon.projectRoot` property (we ignore the
    project's `package.json` unless it's also the app's.)

- `loadProject(projectRootDir)` - used when the user knows where the project is
  (e.g., in a monorepo situation like voyager-web is now), but doesn't
  necessarily know where the app is.
- `showErrors()` - display any errors found during loading to the console. See
  `findErrors()` above for more details.

## The `PackageInfo` Class

The superclass of all the cache entries that represent a directory with a
`package.json` file in it.

### Public Properties

### Public Methods
