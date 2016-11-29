const webpack = require('webpack');

module.exports = {
    entry: "./js/jq.schedule.js",
    watch: true,
    watchOptions: {
        aggregateTimeout: 200
    },
    devtool: 'eval',
    output: {
        path: __dirname + '/dist',
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
    ]
};