'use strict';

import { describe, expect, test } from 'vitest';

import { NodeModulesList } from '../../src/objects/node-modules-list';

describe('models/package-info-cache/node-modules-list-test', function () {
  test('correctly constructs', function () {
    expect(new NodeModulesList('/dev/null')).to.be.ok;
    expect(new NodeModulesList('/some/path')).to.be.ok;
  });

  describe('.nullInstance', function () {
    test('returns a singleton, deeply frozen NodeMoudlesList', function () {
      expect(NodeModulesList.nullInstance).to.equal(
        NodeModulesList.nullInstance
      );
      expect(NodeModulesList.nullInstance).to.be.frozen;
      expect(NodeModulesList.nullInstance.entries).to.be.frozen;
      expect(NodeModulesList.nullInstance.errors).to.be.frozen;
      expect(NodeModulesList.nullInstance.errors.errors).to.be.frozen;
    });
  });

  describe('findPackage', function () {
    test('works with no entries', function () {
      const list = new NodeModulesList('/dev/null');
      expect(list.findPackage('omg')).to.eql(undefined);
    });

    test('supports basic entries (missing, present, scoped)', function () {
      const list = new NodeModulesList('/dev/null');
      const scoped = new NodeModulesList('foobar');
      const omg = new NodeModulesList('omg');
      const scopedOmg = new NodeModulesList('omg');
      scoped.addEntry('omg', scopedOmg);

      list.addEntry('omg', omg);
      list.addEntry('@thescope', scoped);

      expect(list.findPackage('omg')).to.eql(omg);
      expect(list.findPackage('nope')).to.eql(undefined);
      expect(list.findPackage('@thescope/omg')).to.eql(scopedOmg);
      expect(list.findPackage('@thescope/nope')).to.eql(undefined);
      expect(list.findPackage('@nope/nope')).to.eql(undefined);
    });
  });
});
