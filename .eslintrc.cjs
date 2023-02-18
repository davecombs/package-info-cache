module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  root: true,
  plugins: ['node'],
  ignorePatterns: ['dist/'],
  overrides: [
    {
      files: ['*.ts'],
      extends: [
      ],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: [
          './tsconfig.json',
          './tests/tsconfig.json'
        ],
      },
    },
    {
      files: ['*.js'],
      extends: ['plugin:node/recommended'],
    },
  ],
};
