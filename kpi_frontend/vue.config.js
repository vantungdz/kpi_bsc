const { defineConfig } = require('@vue/cli-service')
const path = require('path'); // Thêm dòng này

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    host: "0.0.0.0",
    port: 8080, // hoặc cổng bạn muốn
    client: {
      overlay: false // Tắt overlay error/warning trên trình duyệt
    },
    proxy: {
      '/documents': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  configureWebpack: { // Thêm cấu hình webpack
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      }
    }
  }
});
