import { defineConfig } from 'wxt';

// https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  outDir: '.output',
  manifest: {
    name: '__MSG_extName__',
    short_name: 'Crate Bell',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://github.com/gregoiremalthes/crate-bell',
    // Smallest set possible: local storage, and access to www.discogs.com only.
    permissions: ['storage'],
    host_permissions: ['https://www.discogs.com/*'],
    web_accessible_resources: [
      {
        resources: ['fonts/*.woff2'],
        matches: ['https://www.discogs.com/*'],
      },
    ],
    action: {
      default_title: 'Crate Bell',
    },
  },
  webExt: {
    startUrls: ['https://www.discogs.com/release/3263269-Seiji-Seiji5'],
  },
});
