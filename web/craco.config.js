const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add polyfills for Node.js core modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "buffer": require.resolve("buffer/"),
        "path": require.resolve("path-browserify"),
        "fs": false,
        "os": require.resolve("os-browserify/browser"),
        "http": false,
        "https": false,
        "zlib": false,
        "process": require.resolve("process/browser"),
      };

      // Add ProvidePlugin to automatically provide Buffer and process
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process',
        })
      );

      return webpackConfig;
    },
  },
};
