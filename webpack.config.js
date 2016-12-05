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
                    'file?hash=sha512&digest=hex&name=[hash].[ext]',
                    'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false'
                ]
            }
        ]
    },

    plugins: [
        new webpack.NoErrorsPlugin(),
    ],

    devServer: {
        host: 'localhost',
        port: 8080,
        hot: true
    }
};