import "@angular/compiler";
import { AppModule } from './app/app.module';
import {bootstrap} from "@angular-architects/module-federation-tools";

import { loadRuntimeSettings } from './app/shared/runtime-settings';
import { startKiosk } from './app/shared/kiosk';
import { setEarlyClasses } from './app/shared/early-classes';
import { loadCoreStyles } from './app/shared/core-styles';
import { startScheduledContent } from './app/shared/scheduled-content';
import { startNoticeBanners } from './app/shared/notice-banners';
import { startOpeningHours } from './app/shared/opening-hours';
import { startSearchTips } from './app/shared/search-tips';

// Called by the NDE shell to start our module (exposed in webpack.config.js).
// BEFORE Angular starts:
//   1. assets/settings.js is loaded and merged into EC_CONFIG (runtime-settings.ts),
//      so every component sees the final settings — at most ~2.5 s, usually a few ms;
//   2. the classes that decide conditional content and need no Angular go on
//      <html> (early-classes.ts: kiosk mode, cached / switched-off network
//      check) — after the settings, because settings.js can switch the network
//      check on or off. Until then that content is simply hidden (_ec-conditional.scss);
//   3. reading room (kiosk) mode is started with those settings (kiosk.ts);
//   4. the page-wide features that need no Angular start, so they work on every
//      page (also where none of our components is mounted):
//        scheduled-content.ts  data-ec-from / data-ec-until on any element
//        notice-banners.ts     coloured message bars (settings noticeBanners)
//        opening-hours.ts      [data-ec-opening-hours] + #ec-opening-hours pop-up
//        search-tips.ts        tips between the search results (settings searchTips)
//      Each does nothing when its setting is off (scheduled content has none).
// Noob zip only: our global stylesheet is added first (core-styles.ts), in
// parallel with the settings fetch — the EC views have it in custom.css.
export const bootstrapRemoteApp = async (bootstrapOptions: any) => {
   loadCoreStyles();
   await loadRuntimeSettings();
   setEarlyClasses();
   startKiosk();
   startScheduledContent();
   startNoticeBanners();
   startOpeningHours();
   startSearchTips();
   return bootstrap(AppModule(bootstrapOptions), {
    production: true,
    appType: 'microfrontend'
  }).then(r => {
    console.log('custom remote app bootstrap success!', r);
    return r
  });
}

