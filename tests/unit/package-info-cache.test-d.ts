import { PackageJson } from 'type-fest';
import { describe, expectTypeOf, test } from 'vitest';

import { EmberAddonPackageInfo } from '../../src/objects/ember-addon-package-info';
import { EmberAppPackageInfo } from '../../src/objects/ember-app-package-info';
import { EmberEnginePackageInfo } from '../../src/objects/ember-engine-package-info';
import { EmberPackageInfo } from '../../src/objects/ember-package-info';
import { PackageInfo } from '../../src/objects/package-info';
import { EmberAddonPackageJson } from '../../src/types/ember-addon-package-json';
import { EmberAppPackageJson } from '../../src/types/ember-app-package-json';
import { EmberEnginePackageJson } from '../../src/types/ember-engine-package-json';
import { EmberPackageJson } from '../../src/types/ember-package-json';

describe('package-info-cache-type-test.js', function () {
  // I have to declare the following as 'let', because otherwise TS complains that
  // constants must be initialized. Since we're doing type tests, nothing is going
  // to be initialized.
  let emberEnginePackageJson: EmberEnginePackageJson;
  let emberAddonPackageJson: EmberAddonPackageJson;
  let emberAppPackageJson: EmberAppPackageJson;
  let emberPackageJson: EmberPackageJson;
  let packageJson: PackageJson;

  test('my types work properly', () => {
    expectTypeOf(EmberEnginePackageInfo).toMatchTypeOf(EmberAddonPackageInfo);
    expectTypeOf(EmberAddonPackageInfo).toMatchTypeOf(EmberPackageInfo);
    expectTypeOf(EmberAppPackageInfo).toMatchTypeOf(EmberPackageInfo);
    expectTypeOf(EmberPackageInfo).toMatchTypeOf(PackageInfo);

    expectTypeOf(emberEnginePackageJson).toMatchTypeOf(emberAddonPackageJson);
    expectTypeOf(emberAddonPackageJson).toMatchTypeOf(emberPackageJson);
    expectTypeOf(emberAppPackageJson).toMatchTypeOf(emberPackageJson);
    expectTypeOf(emberPackageJson).toMatchTypeOf(packageJson);
  });
});
