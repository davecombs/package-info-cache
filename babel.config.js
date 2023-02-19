export default {
  plugins: [['@babel/plugin-proposal-decorators', { version: '2021-12' }]],
  presets: [
    ['@babel/preset-env', { targets: { node: process.version } }],
    '@babel/preset-typescript'
  ],
};
