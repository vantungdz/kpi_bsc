const { defineConfig } = require('@vue/cli-service')
const path = require('path'); // Thêm dòng này

module.exports = defineConfig({
  transpileDependencies: true,
  productionSourceMap: true,
  devServer: {
    host: "0.0.0.0",
    port: 8080,
    client: {
      overlay: false
    },
    proxy: {
      '/documents': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  configureWebpack: {
    devtool: 'source-map',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    }
  }
});

