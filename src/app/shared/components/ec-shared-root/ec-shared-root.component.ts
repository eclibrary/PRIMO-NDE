// src/app/shared/components/ec-shared-root/ec-shared-root.component.ts
//
// Container for the shared "always-on" pieces. The selector map allows ONE
// component per NDE slot, so instead of fighting over `nde-search-bar-container-after`
// every shared page-level feature is a child of this root:
//
//   - EcSessionComponent      guest/user + sandbox classes on <html>, data-ec-nav links
//   - EcAskLibrarianComponent Ask-a-librarian modal for matching links
//   - EcLastSearchComponent   remembers the last results URL ("pick up where you left off")
//   - EcLibChatComponent      LibChat floating widget with patron prefill
//
// Add future shared features (cookie notice, ...) here.
// Each child is headless or renders its own hidden <dialog>, so this root
// contributes no visible layout to the page.
//
// TODO: this root is mounted on a search-bar slot, so the features above only
// exist on pages with a search bar. Verify `nde-header` renders on every page
// and move the mapping there (shared-mappings.ts) to cover account/full-record.
import { Component } from '@angular/core';
import { EcSessionComponent } from '../ec-session/ec-session.component';
import { EcAskLibrarianComponent } from '../ec-ask-librarian/ec-ask-librarian.component';
import { EcLastSearchComponent } from '../ec-last-search/ec-last-search.component';
import { EcLibChatComponent } from '../ec-libchat/ec-libchat.component';

@Component({
  selector: 'custom-ec-shared-root',
  standalone: true,
  imports: [EcSessionComponent, EcAskLibrarianComponent, EcLastSearchComponent, EcLibChatComponent],
  host: { 'data-component-id': 'custom-ec-shared-root' },
  template: `
    <custom-ec-session></custom-ec-session>
    <custom-ec-ask-librarian></custom-ec-ask-librarian>
    <custom-ec-last-search></custom-ec-last-search>
    <custom-ec-libchat></custom-ec-libchat>
  `,
})
export class EcSharedRootComponent {}
