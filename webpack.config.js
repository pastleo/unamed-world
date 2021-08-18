import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const mode = process.env.NODE_ENV ? 'production' : 'development';
const target = process.env.TARGET || 'web';

console.log({ mode, target });

const pathTo = target => path.resolve(path.dirname(fileURLToPath(import.meta.url)), target);

const webpackSharedConfig = {
  mode, target,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  //devtool: 'inline-source-map',
};

const webpackConfigs = {
  web: {
    ...webpackSharedConfig,
    entry: { 'demo-browser': './src/index.ts' },
    plugins: [
      new HtmlWebpackPlugin({
        template: 'src/index.html',
      }),
    ],
    output: {
      filename: '[name].[contenthash].js',
      path: pathTo('www'),
    },
    devtool: 'inline-source-map',
    devServer: {
      contentBase: pathTo('www'),
      watchOptions: {
        ignored: /node_modules/,
      },
    },
  },
  node: {
    ...webpackSharedConfig,
    entry: { 'demo-node': './src/demo/node.ts' },
    output: {
      filename: '[name].cjs',
      path: pathTo('dist'),
    },
    externals: [{
      'utf-8-validate': 'commonjs utf-8-validate',
      bufferutil: 'commonjs bufferutil',
    }],
  },
};

export default webpackConfigs[target];
