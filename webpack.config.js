const webpack = require('webpack');
const path = require('path');

const NODE_ENV = (process.env.NODE_ENV || 'dev').trim(); // [dev | prod];
console.log(`Enviroment: ${NODE_ENV}`);

module.exports = {
    entry: "./src/",
    devtool: NODE_ENV === 'dev' ? 'eval' : false,
    output: {
        path: path.resolve(__dirname, 'docs'),
        filename: "bundle.js",
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                loader: "babel-loader",
                query: {
                    presets: ['es2015']
                }
            },
            {
                test: /\.ejs$/,
                loader: 'ejs-loader'
            },
            {
                test: /\.scss$/,
                loaders: ["style-loader", "css-loader", "sass-loader"]
            },
            {
                test: /\.(jpe?g|png|gif|svg)$/i,
                loaders: [
                    'file-loader?hash=sha512&digest=hex&name=[hash].[ext]',
                    'image-webpack-loader?bypassOnDebug&optimizationLevel=7&interlaced=false'
                ]
            }
        ]
    },

    plugins: [
        new webpack.NoEmitOnErrorsPlugin(),
        new webpack.LoaderOptionsPlugin({
            minimize: true,
            debug: false
        }),
        new webpack.ProvidePlugin({
            _: 'lodash'
        }),
        new webpack.optimize.UglifyJsPlugin(),
    ],

    devServer: {
        contentBase: path.join(__dirname, "docs"),
        host: 'localhost',
        port: 8080,
        hot: true,
        overlay: true
    }
};