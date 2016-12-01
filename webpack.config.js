const webpack = require('webpack');

module.exports = {
    entry: "./js/jq.schedule.js",
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