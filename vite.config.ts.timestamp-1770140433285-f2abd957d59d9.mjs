// vite.config.ts
import { defineConfig } from "file:///C:/Users/Mehedi%20Hasan/OneDrive/Desktop/Android%20app/School-Cricket-Live/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Mehedi%20Hasan/OneDrive/Desktop/Android%20app/School-Cricket-Live/node_modules/@vitejs/plugin-react/dist/index.js";
import path from "path";
var __vite_injected_original_dirname = "C:\\Users\\Mehedi Hasan\\OneDrive\\Desktop\\Android app\\School-Cricket-Live";
var vite_config_default = defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    },
    extensions: [".js", ".jsx", ".ts", ".tsx", ".json"]
  },
  server: {
    port: 3e3,
    host: true,
    open: true
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/react-router")) {
            return "react-vendor";
          }
          if (id.includes("node_modules/firebase")) {
            return "firebase-vendor";
          }
        }
      }
    }
  },
  optimizeDeps: {
    include: ["firebase/app", "firebase/firestore", "firebase/auth"],
    exclude: ["firebase/analytics"]
    // Exclude analytics from optimization (dynamic import)
  },
  preview: {
    port: 3e3,
    host: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxNZWhlZGkgSGFzYW5cXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxBbmRyb2lkIGFwcFxcXFxTY2hvb2wtQ3JpY2tldC1MaXZlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxNZWhlZGkgSGFzYW5cXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxBbmRyb2lkIGFwcFxcXFxTY2hvb2wtQ3JpY2tldC1MaXZlXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9NZWhlZGklMjBIYXNhbi9PbmVEcml2ZS9EZXNrdG9wL0FuZHJvaWQlMjBhcHAvU2Nob29sLUNyaWNrZXQtTGl2ZS92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW3JlYWN0KCldLFxyXG4gIGJhc2U6ICcuLycsXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcclxuICAgIH0sXHJcbiAgICBleHRlbnNpb25zOiBbJy5qcycsICcuanN4JywgJy50cycsICcudHN4JywgJy5qc29uJ10sXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDMwMDAsXHJcbiAgICBob3N0OiB0cnVlLFxyXG4gICAgb3BlbjogdHJ1ZSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiAoaWQpID0+IHtcclxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0JykgfHwgaWQuaW5jbHVkZXMoJ25vZGVfbW9kdWxlcy9yZWFjdC1kb20nKSB8fCBpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzL3JlYWN0LXJvdXRlcicpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAncmVhY3QtdmVuZG9yJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMvZmlyZWJhc2UnKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2ZpcmViYXNlLXZlbmRvcidcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogWydmaXJlYmFzZS9hcHAnLCAnZmlyZWJhc2UvZmlyZXN0b3JlJywgJ2ZpcmViYXNlL2F1dGgnXSxcclxuICAgIGV4Y2x1ZGU6IFsnZmlyZWJhc2UvYW5hbHl0aWNzJ10sIC8vIEV4Y2x1ZGUgYW5hbHl0aWNzIGZyb20gb3B0aW1pemF0aW9uIChkeW5hbWljIGltcG9ydClcclxuICB9LFxyXG4gIHByZXZpZXc6IHtcclxuICAgIHBvcnQ6IDMwMDAsXHJcbiAgICBob3N0OiB0cnVlLFxyXG4gIH0sXHJcbn0pXHJcblxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNaLFNBQVMsb0JBQW9CO0FBQ25iLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFGakIsSUFBTSxtQ0FBbUM7QUFJekMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pCLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLElBQ0EsWUFBWSxDQUFDLE9BQU8sUUFBUSxPQUFPLFFBQVEsT0FBTztBQUFBLEVBQ3BEO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsV0FBVztBQUFBLElBQ1gsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYyxDQUFDLE9BQU87QUFDcEIsY0FBSSxHQUFHLFNBQVMsb0JBQW9CLEtBQUssR0FBRyxTQUFTLHdCQUF3QixLQUFLLEdBQUcsU0FBUywyQkFBMkIsR0FBRztBQUMxSCxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLEdBQUcsU0FBUyx1QkFBdUIsR0FBRztBQUN4QyxtQkFBTztBQUFBLFVBQ1Q7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsZ0JBQWdCLHNCQUFzQixlQUFlO0FBQUEsSUFDL0QsU0FBUyxDQUFDLG9CQUFvQjtBQUFBO0FBQUEsRUFDaEM7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
