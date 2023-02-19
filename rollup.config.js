import * as babelPlugin from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

import fs from 'fs';
const extensions = ['.js', '.ts'];
const pkg = JSON.parse(fs.readFileSync('./package.json'));

export default {
  input: ['./src/index.ts'],
  // Treats all "node_modules" as externals and are not bundled
  // delete this line to bundle them
  external: [/node_modules/],
  plugins: [
    resolve({ extensions }),
    commonjs(),
    babelPlugin.babel({
      babelrc: true,
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      extensions: ['.js', '.ts'],
    }),
  ],
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
    {
      file: pkg.exports.require,
      format: 'cjs',
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
    {
      file: pkg.exports.import,
      format: 'es',
      sourcemap: true,
      sourcemapExcludeSources: true,
    },
  ],
};
