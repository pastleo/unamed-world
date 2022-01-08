import * as path from 'path';
import { fileURLToPath } from 'url';

import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';

export default () => {
  const projectRoot = path.dirname(fileURLToPath(import.meta.url));
  const productionMode = process.env.NODE_ENV === 'production';

  return {
    mode: productionMode ? 'production' : 'development',
    entry: {
      main: path.join(projectRoot, 'src/main.ts'),
    },
    module: {
      rules: [
        {
          test: /\.t|jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                }
              },
              env: {
                targets: 'Firefox ESR'
              }
            }
          }
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"],
        },
      ]
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    output: {
      filename: productionMode ? '[name].[contenthash].js' : '[name].js',
      path: path.join(projectRoot, 'dist'),
    },
    plugins: [
      new HtmlWebpackPlugin({
        filename: 'index.html',
        template: 'www/index.html'
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'www',
            to: '.',
            globOptions: {
              ignore: ['**/*.html']
            },
          },
        ]
      }),
      new webpack.ProvidePlugin({ // for IPFS
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      }),

      ...(productionMode ? [
      ] : [
        new webpack.ProgressPlugin(),
      ]),
    ],
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },

    ...(productionMode ? {
    } : {
      devtool: 'inline-source-map',
      devServer: {
        webSocketServer: false,
        static: {
          directory: path.join(projectRoot, 'www'),
        }
      },
    }),
  }
}
