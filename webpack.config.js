const webpack = require('webpack');

module.exports = {
    entry: "./src/",
    // watch: true, //webpack-dev-server --inline --hot
    watchOptions: {
        aggregateTimeout: 200
    },
    devtool: 'eval',
    output: {
        filename: "bundle.js"
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                loader: "babel?presets[]=es2015"
            },
            {
                test: /\.html$/,
                loader: "html"
            }
        ]
    },

    plugins: [
        new webpack.NoErrorsPlugin()
    ],

    devServer: {
        host: 'localhost',
        port: 8080,
        hot: true
    }
};