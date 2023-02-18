'use strict';

import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { EmberAppPackageInfo } from '../../src/objects/ember-app-package-info';
import { ErrorEntry } from '../../src/objects/error-entry';
import { ErrorList } from '../../src/objects/error-list';
import { NodeModulesList } from '../../src/objects/node-modules-list';
import { PackageInfo } from '../../src/objects/package-info';
import { PackageInfoCache } from '../../src/objects/package-info-cache';
import {
  buildTree,
  getObjectProperty,
  isObject,
  lexicographically,
  NamedObj,
  pushUnique,
} from '../../src/utils';

const addonFixturePath = path.resolve(__dirname, '../fixtures');

describe('package-info-cache-test.js', function () {
  let projectPath: string;
  let packageJsonPath: string;
  // let packageContents: PackageJson | undefined;
  let projectPackageInfo: PackageInfo | NodeModulesList | undefined;
  // let resolvedFile: string;
  let pic: PackageInfoCache;

  describe('lexicographically', function () {
    test('works', function () {
      expect(
        [
          { name: 'c' },
          { foo: 2 },
          { name: 'z/b/z' },
          { name: 'z/b/d' },
          { foo: 1 },
          { name: 'z/a/d' },
          { name: 'z/a/c' },
          { name: 'b' },
          { name: 'z/a/d' },
          { name: 'a' },
          { foo: 3 },
        ].sort(lexicographically)
      ).to.eql([
        { name: 'a' },
        { name: 'b' },
        { name: 'c' },
        { name: 'z/a/c' },
        { name: 'z/a/d' },
        { name: 'z/a/d' },
        { name: 'z/b/d' },
        { name: 'z/b/z' },
        { foo: 2 },
        { foo: 1 },
        { foo: 3 },
      ]);
    });
  });

  describe('pushUnique', function () {
    test('works (and does last write win)', function () {
      const a: NamedObj = { name: 'a' };
      const b: NamedObj = { name: 'b' };
      const c: NamedObj = { name: 'c' };

      const result: NamedObj[] = [];
      [a, a, a, b, a, c, a, c].forEach((entry) =>
        pushUnique<NamedObj>(result, entry)
      );

      expect(result).to.eql([b, a, c]);
    });
  });

  describe('packageInfo contents tests on valid project', function () {
    beforeAll(function () {
      projectPath = path.resolve(addonFixturePath, 'simple');
      packageJsonPath = path.join(projectPath, 'package.json');

      console.info(`Dumping file structure for path ${projectPath}`);
      const tree = buildTree(projectPath);
      const jsonStr = JSON.stringify(
        tree,
        (key, value) => {
          if (key !== 'path') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return value;
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return path.basename(value);
        },
        2
      );
      console.info(jsonStr);

      pic = new PackageInfoCache();
      pic.loadProject(projectPath);

      console.info(`Getting projectPackageInfo for path '${projectPath}'`);
      projectPackageInfo = pic.getEntry(projectPath);

      console.info('\nOverall cache errors:');
      console.info('-----------------------');
      pic.showErrors();
      console.info('-----------------------');

      console.info('');
    });

    test('finds project PackageInfo entry for project root', function () {
      expect(projectPackageInfo, 'PackageInfo exists').to.exist;
    });

    test('project PackageInfo is actually a PackageInfo', function () {
      expect(projectPackageInfo instanceof EmberAppPackageInfo).to.be.true;
    });

    test('projectPackageInfo has a "packageJson" field', function () {
      expect(projectPackageInfo instanceof EmberAppPackageInfo).to.be.true;
      expect(
        getObjectProperty(projectPackageInfo, 'packageJson'),
        'projectPackageInfo has a packageInfo field'
      ).to.exist;
    });

    test('shows projectPackageInfo is considered valid', function () {
      expect(projectPackageInfo instanceof EmberAppPackageInfo).to.be.true;
      expect(getObjectProperty(projectPackageInfo, 'valid')).to.be.true;
    });

    test('shows projectPackageInfo has 1 error', function () {
      expect(projectPackageInfo instanceof EmberAppPackageInfo).to.be.true;
      expect(projectPackageInfo && projectPackageInfo.hasErrors()).to.be.true;

      const errors = getObjectProperty(
        projectPackageInfo,
        'errors'
      ) as ErrorList;

      const errorArray = errors.getErrors();

      expect(errorArray.length).to.equal(1);
    });

    test('shows projectPackageInfo error is "3 devDependencies missing"', function () {
      expect(projectPackageInfo instanceof EmberAppPackageInfo).to.be.true;

      const errors = getObjectProperty(
        projectPackageInfo,
        'errors'
      ) as ErrorList;

      const errorArray = errors.getErrors();

      const error = errorArray[0] as ErrorEntry;
      expect(error.type).to.equal('devDependenciesMissing');

      const errorData = error.data as Array<string>;

      expect(errorData.length, '# missing devDependencies').to.equal(3);
    });

    test('shows projectPackageInfo has 1 dependenciesPackage', function () {
      const dependenciesPackages = getObjectProperty(
        projectPackageInfo,
        'dependenciesPackages'
      );

      expect(dependenciesPackages).to.exist;
      expect(isObject(dependenciesPackages)).to.be.true;
      const map = dependenciesPackages as Map<string, PackageInfo>;
      const keys = [...map.keys()];
      expect(keys.length).to.equal(1);
      expect(map.get('something-else')).to.exist;
    });

    test('shows projectPackageInfo has 8 devDependencyPackages', function () {
      const devDependenciesPackages = getObjectProperty(
        projectPackageInfo,
        'devDependenciesPackages'
      );
      expect(devDependenciesPackages).to.exist;
      expect(isObject(devDependenciesPackages)).to.be.true;
      const map = devDependenciesPackages as Map<string, PackageInfo>;
      const keys = [...map.keys()];
      expect(keys.length).to.equal(8);
    });

    test('shows projectPackageInfo.devDependencyPackages + missing devDependencies = project.devDependencies', function () {
      const devDependenciesPackages = getObjectProperty(
        projectPackageInfo,
        'devDependenciesPackages'
      );

      expect(devDependenciesPackages).to.exist;
      expect(isObject(devDependenciesPackages)).to.be.true;

      const devDepsMap = devDependenciesPackages as Map<string, PackageInfo>;
      const devDependenciesPackageNames = [...devDepsMap.keys()];

      const devDependencies = getObjectProperty(
        projectPackageInfo,
        'packageJson.devDependencies'
      );
      expect(devDependencies).to.exist;
      expect(isObject(devDependencies)).to.be.true;

      const devDepsObj = devDependencies as Record<string, string>;
      const devDependencyNames = Object.keys(devDepsObj);
      devDependencyNames.sort();

      const errorObj = getObjectProperty(projectPackageInfo, 'errors');
      expect(errorObj).to.exist;
      expect(errorObj instanceof ErrorList).to.be.true;

      const errorArray = (errorObj as ErrorList).getErrors();
      const error = errorArray[0] as ErrorEntry;
      expect(error.type).to.equal('devDependenciesMissing');

      const missingDependencies = error.data as string[];

      const packageAndErrorNames = devDependenciesPackageNames
        .concat(missingDependencies)
        .sort();

      expect(packageAndErrorNames).to.deep.equal(devDependencyNames);
    });

    test('shows projectPackageInfo has 2 in-repo addons', function () {
      const inRepoAddons = getObjectProperty(
        projectPackageInfo,
        'inRepoAddons'
      );

      expect(inRepoAddons).to.exist;
      expect(Array.isArray(inRepoAddons)).to.be.true;

      expect((inRepoAddons as []).length).to.equal(2);

      const inRepoArray = inRepoAddons as [PackageInfo, PackageInfo];

      let pkgInfo = inRepoArray[0];
      let realPath = getObjectProperty(pkgInfo, 'realPath') as string;
      let pkgName = getObjectProperty(pkgInfo, 'packageJson.name');

      expect(
        realPath.indexOf(`simple${path.sep}lib${path.sep}ember-super-button`)
      ).to.be.above(0);

      expect(pkgName).to.equal('ember-super-button');

      pkgInfo = inRepoArray[1];
      realPath = getObjectProperty(pkgInfo, 'realPath') as string;
      pkgName = getObjectProperty(pkgInfo, 'packageJson.name');

      expect(
        realPath.indexOf(
          `simple${path.sep}lib${path.sep}ember-super-button${path.sep}lib${path.sep}ember-with-addon-main`
        )
      ).to.be.above(0);
      expect(pkgName).to.equal('ember-with-addon-main');
    });

    // Removed one test for package-info "internal" addons from ember-cli, as we don't support those - they
    // are middleware addons and only available in ember-cli itself.

    test('shows projectPackageInfo has 9 node-module entries', function () {
      const nodeModules = getObjectProperty(projectPackageInfo, 'nodeModules');
      expect(nodeModules).to.exist;

      const nodeModulesObj = nodeModules as NodeModulesList;
      expect(nodeModulesObj.entries).to.exist;

      const map = nodeModulesObj.entries as Map<string, PackageInfo>;
      const keys = [...map.keys()];
      expect(keys.length).to.equal(9);
    });
  });

  /*
  describe('packageInfo', function () {
    describe('project with invalid paths', function () {
      let project, fixturifyProject;
      beforeEach(function () {
        // create a new ember-app
        fixturifyProject = new FixturifyProject(
          'simple-ember-app',
          '0.0.0',
          (project) => {
            project.addAddon('ember-resolver', '^5.0.1');
            project.addAddon('ember-random-addon', 'latest');
            project.addAddon('loader.js', 'latest');
            project.addAddon('something-else', 'latest');
            project.addInRepoAddon(
              'ember-super-button',
              'latest',
              function (project) {
                project.pkg['ember-addon'].paths = ['lib/herp-not-here'];
              }
            );
            project.addDevDependency('ember-cli', 'latest');
            project.addDevDependency('non-ember-thingy', 'latest');
            project.pkg['ember-addon'].paths.push('lib/no-such-path');
          }
        );

        fixturifyProject.writeSync();

        project = fixturifyProject.buildProjectModel(Project);
      });

      afterEach(function () {
        fixturifyProject.dispose();
        delete process.env.EMBER_CLI_ERROR_ON_INVALID_ADDON;
      });

      test('shows a warning with invalid ember-addon#path', function () {
        project.discoverAddons();
        expect(project.cli.ui.output).to.include(
          `specifies an invalid, malformed or missing addon at relative path 'lib${path.sep}no-such-path'`
        );
      });

      test('throws an error with flag on', function () {
        process.env.EMBER_CLI_ERROR_ON_INVALID_ADDON = 'true';
        expect(() => project.discoverAddons()).to.throw(
          /specifies an invalid, malformed or missing addon at relative path 'lib[\\/]no-such-path'/
        );
      });
    });
    describe('valid project', function () {
      let project, fixturifyProject;
      before(function () {
        // create a new ember-app
        fixturifyProject = new FixturifyProject(
          'simple-ember-app',
          '0.0.0',
          (project) => {
            project.addAddon('ember-resolver', '^5.0.1');
            project.addAddon('ember-random-addon', 'latest', (addon) => {
              addon.addAddon('other-nested-addon', 'latest', (addon) => {
                addon.addAddon('ember-resolver', '*');
                addon.toJSON = function () {
                  const json = Object.getPrototypeOf(this).toJSON.call(this);
                  // here we introduce an empty folder in our node_modules.
                  json[this.name].node_modules['ember-resolver'] = {};
                  return json;
                };
              });
            });

            project.addAddon('loader.js', 'latest');
            project.addAddon('something-else', 'latest');

            project.addInRepoAddon('ember-super-button', 'latest');
            project.addDevDependency('ember-cli', 'latest');
            project.addDevDependency('non-ember-thingy', 'latest');
          }
        );

        fixturifyProject.writeSync();

        project = fixturifyProject.buildProjectModel(Project);
        project.discoverAddons();
        pic = project.packageInfoCache;
        projectPackageInfo = pic.getEntry(
          path.join(fixturifyProject.root, 'simple-ember-app')
        );
      });

      after(function () {
        fixturifyProject.dispose();
      });

      test('was able to find ember-resolver even if an empty directory was left', function () {
        const emberResolver = project.findAddonByName('ember-resolver');
        const nestedEmberResolver =
          project.findAddonByName('ember-random-addon').addons[0].addons[0];
        expect(emberResolver.name).to.eql('ember-resolver');
        expect(nestedEmberResolver.name).to.eql('ember-resolver');
        expect(emberResolver.root).to.eql(nestedEmberResolver.root);
      });

      test('has dependencies who have their mayHaveAddons correctly set', function () {
        expect(
          projectPackageInfo.devDependencyPackages['non-ember-thingy']
        ).to.have.property('mayHaveAddons', false);
        expect(
          projectPackageInfo.devDependencyPackages['ember-cli']
        ).to.have.property('mayHaveAddons', false);
        expect(
          projectPackageInfo.dependencyPackages['loader.js']
        ).to.have.property('mayHaveAddons', true);
        expect(
          projectPackageInfo.dependencyPackages['ember-resolver']
        ).to.have.property('mayHaveAddons', true);
        expect(
          projectPackageInfo.dependencyPackages['ember-random-addon']
        ).to.have.property('mayHaveAddons', true);
        expect(
          projectPackageInfo.dependencyPackages['something-else']
        ).to.have.property('mayHaveAddons', true);
      });

      test('validates projectPackageInfo', function () {
        expect(projectPackageInfo).to.exist;
        expect(projectPackageInfo.pkg).to.exist;
        expect(projectPackageInfo.valid).to.be.true;
      });

      test('shows projectPackageInfo has 0 errors', function () {
        expect(projectPackageInfo.hasErrors()).to.be.false;
        expect(projectPackageInfo.errors.getErrors()).to.have.property(
          'length',
          0
        );
      });

      test('shows projectPackageInfo has 1 dependencyPackage', function () {
        let dependencyPackages = projectPackageInfo.dependencyPackages;

        expect(dependencyPackages).to.exist;
        expect(Object.keys(dependencyPackages).length).to.equal(4);
        expect(dependencyPackages['something-else']).to.exist;
      });

      test('shows projectPackageInfo has 82devDependencyPackages', function () {
        let devDependencyPackages = projectPackageInfo.devDependencyPackages;

        expect(devDependencyPackages).to.exist;
        expect(Object.keys(devDependencyPackages).length).to.equal(2);
      });

      test('shows projectPackageInfo has 1 in-repo addon named "ember-super-button"', function () {
        const inRepoAddons = projectPackageInfo.inRepoAddons;

        expect(inRepoAddons).to.exist;
        expect(inRepoAddons.length).to.equal(1);
        expect(inRepoAddons[0].realPath).to.contain(
          path.join('simple-ember-app', 'lib', 'ember-super-button')
        );
        expect(inRepoAddons[0].pkg.name).to.equal('ember-super-button');
      });

      test('shows projectPackageInfo has 7 internal addon packages', function () {
        const internalAddons = projectPackageInfo.internalAddons;

        expect(internalAddons).to.exist;
        expect(internalAddons.length).to.equal(7);
      });

      test('shows projectPackageInfo has 7 node-module entries', function () {
        const nodeModules = projectPackageInfo.nodeModules;

        expect(nodeModules).to.exist;
        expect(nodeModules.entries).to.exist;
        expect(Object.keys(nodeModules.entries).length).to.equal(6);
      });
    });
  });
  */

  /*
  describe('packageInfo contents tests on missing project', function () {
    beforeEach(function () {
      projectPath = path.resolve(addonFixturePath, 'fakepackage');

      let deps = {
        'foo-bar': 'latest',
        'blah-blah': '1.0.0',
      };

      let devDeps = {
        'dev-foo-bar': 'latest',
      };

      packageContents = {
        dependencies: deps,
        devDependencies: devDeps,
      };

      project = new Project(projectPath, packageContents, ui, cli);

      pic = project.packageInfoCache;
      projectPackageInfo = pic.getEntry(projectPath);
    });

    test('creates a packageInfo object for the missing path', function () {
      expect(projectPackageInfo).to.exist;
    });

    test('has 3 errors', function () {
      const errors = projectPackageInfo.errors;
      expect(errors).to.exist;
      expect(errors.hasErrors()).to.be.true;
      expect(errors.getErrors().length).to.equal(3);
    });

    test('has a "packageDirectoryMissing" error', function () {
      const errorArray = projectPackageInfo.errors.getErrors();
      const pkgDirMissingErr = errorArray.find(function (err) {
        return err.type === 'packageDirectoryMissing';
      });
      expect(pkgDirMissingErr).to.exist;
      expect(pkgDirMissingErr.data).to.equal(projectPath);
    });

    test('has empty "dependencyPackages" and "devDependencyPackages" objects', function () {
      expect(projectPackageInfo.dependencyPackages).to.exist;
      expect(projectPackageInfo.devDependencyPackages).to.exist;
      expect(
        Object.keys(projectPackageInfo.dependencyPackages).length
      ).to.equal(0);
      expect(
        Object.keys(projectPackageInfo.devDependencyPackages).length
      ).to.equal(0);
    });
  });
  */

  describe('packageInfo contents tests on with-nested-addons project', function () {
    beforeEach(function () {
      projectPath = path.resolve(addonFixturePath, 'with-nested-addons');
      packageJsonPath = path.join(projectPath, 'package.json');
      //   packageContents = undefined; // there is no actual package.json

      pic = new PackageInfoCache();
      pic.loadProject(projectPath);

      projectPackageInfo = pic.getEntry(projectPath);
    });

    test('shows projectPackageInfo has a "packageJsonMissing" error', function () {
      const errorsObj = getObjectProperty(
        projectPackageInfo,
        'errors'
      ) as ErrorList;
      const errorArray = errorsObj.getErrors();
      const pkgJsonMissingErr = errorArray.find(function (err) {
        return err.type === 'packageJsonMissing';
      }) as ErrorEntry;
      expect(pkgJsonMissingErr).to.exist;
      expect(pkgJsonMissingErr.data).to.equal(packageJsonPath);
    });
  });

  /*
  describe('packageInfo contents tests on external-dependency project', function () {
    beforeEach(function () {
      projectPath = path.resolve(addonFixturePath, 'external-dependency');
      packageJsonPath = path.join(projectPath, 'package.json');
      packageContents = require(packageJsonPath);
      project = new Project(projectPath, packageContents, ui, cli);

      pic = project.packageInfoCache;
      projectPackageInfo = pic.getEntry(projectPath);
    });

    test('shows projectPackageInfo finds a dependency above project root', function () {
      expect(projectPackageInfo.dependencyPackages).to.exist;

      const emberCliStringUtilsPkgInfo =
        projectPackageInfo.dependencyPackages['ember-cli-string-utils'];
      expect(emberCliStringUtilsPkgInfo).to.exist;

      const emberCliRealPath = path.resolve(
        `${projectPackageInfo.realPath}/../../../../`
      );
      expect(emberCliStringUtilsPkgInfo.realPath).to.equal(
        path.join(emberCliRealPath, 'node_modules', 'ember-cli-string-utils')
      );
    });

    test('shows projectPackageInfo finds an external dependency involving a scope', function () {
      expect(projectPackageInfo.dependencyPackages).to.exist;

      const restPkgInfo =
        projectPackageInfo.dependencyPackages['@octokit/rest'];
      expect(restPkgInfo).to.exist;

      const emberCliRealPath = path.resolve(
        `${projectPackageInfo.realPath}/../../../../`
      );
      expect(restPkgInfo.realPath).to.equal(
        path.join(emberCliRealPath, 'node_modules', '@octokit', 'rest')
      );
    });
  });
  */

  /*
  describe('discoverProjectAddons', function () {
    let fixturifyProject;

    afterEach(function () {
      if (fixturifyProject) {
        fixturifyProject.dispose();
      }
    });

    describe('within an addon', function () {
      beforeEach(function () {
        fixturifyProject = new FixturifyProject(
          'external-dependency',
          '0.0.0',
          (project) => {
            project.addDevDependency('ember-cli-string-utils', 'latest');
            project.addDevDependency('@octokit/rest', 'latest');
            project.addAddon('ember-cli-blueprint-test-helpers', 'latest');
            project.addAddon('c', 'latest');
            project.addAddon('a', 'latest');
            project.addAddon('b', 'latest');

            project.addDevAddon('y', 'latest');
            project.addDevAddon('z', 'latest');
            project.addDevAddon('x', 'latest');

            project.addInRepoAddon('t', 'latest');
            project.addInRepoAddon('s', 'latest');

            project.pkg.keywords.push('ember-addon');
            project.pkg.keywords.push('ember-addon');
          }
        );
      });

      test('lock down dependency orderings', function () {
        let project = fixturifyProject.buildProjectModel();

        project.discoverAddons();

        expect(Object.keys(project.addonPackages)).to.deep.equal([
          // itself
          'external-dependency',

          // dev dependencies
          'x',
          'y',
          'z',

          // dependencies
          'a',
          'b',
          'c',
          'ember-cli-blueprint-test-helpers',

          // in repo addons
          's',
          't',
        ]);
      });
    });
  });
  */

  /*
  describe('tests for projectPackageInfo.addonMainPath', function () {
    let origPackageContents: Record<string, unknown> | undefined = undefined;

    beforeEach(async function () {
      projectPath = path.resolve(addonFixturePath, 'external-dependency');
      packageJsonPath = path.join(projectPath, 'package.json');

      // Because we allow the tests to modify packageContents, and the original
      // 'require' of package contents will always return the same structure
      // once it has been required, we must deep-copy that structure before letting
      // the tests modify it, so they modify only the copy.
      if (!origPackageContents) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        origPackageContents = (await import(packageJsonPath)) as Record<
          string,
          unknown
        >;

        setObjectProperty(origPackageContents, 'ember-addon', {});
      }

      packageContents = JSON.parse(JSON.stringify(origPackageContents));
    });

    test('adds .js if not present', function () {
      setObjectProperty(packageContents, 'ember-addon.main', 'index');

      project = new Project(projectPath, packageContents, ui, cli);
      projectPackageInfo = project.packageInfoCache.getEntry(projectPath);

      resolvedFile = path.basename(projectPackageInfo.addonMainPath);
      expect(resolvedFile).to.equal('index.js');
    });

  
    test("doesn't add .js if it is .js", function () {
      packageContents['ember-addon']['main'] = 'index.js';

      project = new Project(projectPath, packageContents, ui, cli);
      projectPackageInfo = project.packageInfoCache.getEntry(projectPath);

      resolvedFile = path.basename(projectPackageInfo.addonMainPath);
      expect(resolvedFile).to.equal('index.js');
    });

    test("doesn't add .js if it has another extension", function () {
      packageContents['ember-addon']['main'] = 'index.coffee';

      project = new Project(projectPath, packageContents, ui, cli);
      projectPackageInfo = project.packageInfoCache.getEntry(projectPath);

      resolvedFile = path.basename(projectPackageInfo.addonMainPath);
      expect(resolvedFile).to.equal('index.coffee');
    });

    test('allows lookup of existing non-`index.js` `main` entry points', function () {
      delete packageContents['ember-addon'];
      packageContents['main'] = 'some/other/path.js';

      project = new Project(projectPath, packageContents, ui, cli);
      projectPackageInfo = project.packageInfoCache.getEntry(projectPath);

      resolvedFile = projectPackageInfo.addonMainPath;
      expect(resolvedFile).to.equal(
        path.join(projectPath, 'some/other/path.js')
      );
    });

    test('fails invalid other `main` entry points', function () {
      delete packageContents['ember-addon'];
      packageContents['main'] = 'some/other/non-existent-file.js';

      project = new Project(projectPath, packageContents, ui, cli);
      projectPackageInfo = project.packageInfoCache.getEntry(projectPath);

      expect(projectPackageInfo.hasErrors()).to.be.true;
      expect(projectPackageInfo.errors.getErrors().length).to.equal(1);
      let error = projectPackageInfo.errors.getErrors()[0];
      expect(error.type).to.equal('emberAddonMainMissing');
    });

    test('falls back to `index.js` if `main` and `ember-addon` are not found', function () {
      delete packageContents['ember-addon'];

      project = new Project(projectPath, packageContents, ui, cli);
      projectPackageInfo = project.packageInfoCache.getEntry(projectPath);

      resolvedFile = projectPackageInfo.addonMainPath;
      expect(resolvedFile).to.equal(path.join(projectPath, 'index.js'));
    });

    test('falls back to `index.js` if `main` and `ember-addon.main` are not found', function () {
      delete packageContents['ember-addon'].main;

      project = new Project(projectPath, packageContents, ui, cli);
      projectPackageInfo = project.packageInfoCache.getEntry(projectPath);

      resolvedFile = projectPackageInfo.addonMainPath;
      expect(resolvedFile).to.equal(path.join(projectPath, 'index.js'));
    });
    
  });
  */
});
