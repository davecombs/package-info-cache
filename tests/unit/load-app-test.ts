import { PackageInfoCache } from '../../src/objects/package-info-cache';

const pic = new PackageInfoCache();

pic.loadProject('/Users/dcombs/dev/package-info-cache/tests/fixtures/simple');

if (pic.hasErrors()) {
  pic.showErrors();
} else {
  console.log('No cache errors were found in the package info cache');
}
