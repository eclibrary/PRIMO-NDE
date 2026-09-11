// src/app/shared/components/ec-libchat/ec-libchat.component.ts
//
// LibAnswers LibChat widget (the floating "Chat with us" button) on every page,
// with the patron's name and e-mail handed to the chat when they open it.
//
// HOW (same mechanism as the VE custom.js):
//   1. Inject `${libanswersHost}/load_chat.php?hash=<hash>` once, plus the
//      container <div id="libchat<hash>"> it renders into. LibAnswers then adds
//      its floating button and, when clicked, an <iframe> with the chat.
//   2. On the first click of that button, wait for the iframe and rewrite its
//      `src` once to the chat URL with `referer`, `patron_name` and
//      `patron_email` — the parameters LibChat reads to prefill the visitor
//      form. Guests only get the referer.
//
// SETTINGS: EC_CONFIG.libchat (config/global.json; a view overrides `hash` in
// config/views/<view>.json — an empty hash disables the chat on that view).
//
// MOUNT POINT: rendered by EcSharedRootComponent (see shared-mappings.ts).
// NOTE: that root sits on a search-bar slot, so the chat button exists on
// pages that have a search bar. Move the root to an every-page slot if the
// button must also appear on account/full-record pages.
import { Component, OnDestroy, inject } from '@angular/core';
import { EC_CONFIG } from '../../ec-config';
import { UserInfoService } from '../../user-info.service';

/** Guard against a second instance (the slot can render more than once). */
let installed = false;

@Component({
  selector: 'custom-ec-libchat',
  standalone: true,
  host: { 'data-component-id': 'custom-ec-libchat' },
  template: '', // headless: LibAnswers renders its own UI into <body>
})
export class EcLibChatComponent implements OnDestroy {
  private readonly userInfo = inject(UserInfoService);
  private readonly onClick = (ev: MouseEvent) => this.handleClick(ev);
  private readonly hash = EC_CONFIG.libchat.hash;

  constructor() {
    if (!this.hash || installed) return;
    installed = true;
    this.inject();
    // Capture phase: run before LibChat's own handler opens the iframe, so our
    // poll below catches the iframe as soon as it appears.
    document.addEventListener('click', this.onClick, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.onClick, true);
    // The widget itself is left in place: it is page-level, not per component.
  }

  /** Add the LibChat loader script and its container once. */
  private inject(): void {
    const cfg = EC_CONFIG.libchat;
    const scriptId = 'ec-libchat-script';
    if (document.getElementById(scriptId)) return;

    // Container first: the loader looks it up by id when it runs.
    const container = document.createElement('div');
    container.id = `libchat${this.hash}`;
    document.body.appendChild(container);

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `${cfg.libanswersHost}/load_chat.php?hash=${encodeURIComponent(this.hash)}`;
    script.async = true;
    document.head.appendChild(script);
  }

  /** First click on the floating button: prefill the chat iframe with patron details. */
  private handleClick(ev: MouseEvent): void {
    const cfg = EC_CONFIG.libchat;
    const target = ev.target as HTMLElement | null;
    if (!target?.closest(cfg.floatButtonSelector)) return;

    // The iframe is created by LibChat right after this click; poll briefly for it.
    let tries = 0;
    const timer = window.setInterval(async () => {
      const iframe = document.querySelector<HTMLIFrameElement>(cfg.iframeSelector);
      if (!iframe) {
        if (++tries > 100) window.clearInterval(timer); // ~10 s: give up quietly
        return;
      }
      window.clearInterval(timer);
      if (iframe.dataset['ecPrefilled']) return; // already done in this page life
      iframe.dataset['ecPrefilled'] = '1';

      const params = new URLSearchParams({ referer: window.location.href });
      const user = await this.userInfo.load(); // null for guests
      if (user?.email) params.set('patron_email', user.email);
      if (user?.displayName) {
        // VE passed "NAME + unit"; keep that so librarians see where the patron sits.
        params.set('patron_name', [user.displayName, user.unit].filter(Boolean).join(' '));
      }
      // Reloads the chat frame with the prefilled visitor form (as VE did).
      iframe.src = `${cfg.libanswersHost}/chat/widget/${encodeURIComponent(this.hash)}?${params.toString()}`;
    }, 100);
  }
}
