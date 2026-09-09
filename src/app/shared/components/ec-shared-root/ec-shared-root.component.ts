// src/app/shared/components/ec-shared-root/ec-shared-root.component.ts
//
// Container for the shared "always-on" pieces. The selector map allows ONE
// component per NDE slot, so instead of fighting over `nde-search-bar-container-after`
// every shared page-level feature is a child of this root:
//
//   - EcSessionComponent      guest/user class on <html> + data-ec-nav links
//   - EcAskLibrarianComponent Ask-a-librarian modal for matching links
//
// Add future shared features (chat widget, cookie notice, ...) here.
// Each child is headless or renders its own hidden <dialog>, so this root
// contributes no visible layout to the page.
import { Component } from '@angular/core';
import { EcSessionComponent } from '../ec-session/ec-session.component';
import { EcAskLibrarianComponent } from '../ec-ask-librarian/ec-ask-librarian.component';

@Component({
  selector: 'custom-ec-shared-root',
  standalone: true,
  imports: [EcSessionComponent, EcAskLibrarianComponent],
  host: { 'data-component-id': 'custom-ec-shared-root' },
  template: `
    <custom-ec-session></custom-ec-session>
    <custom-ec-ask-librarian></custom-ec-ask-librarian>
  `,
})
export class EcSharedRootComponent {}
