// src/noob/core/noob-root.component.ts
//
// The noob zip's twin of EcSharedRootComponent
// (src/app/shared/components/ec-shared-root): the same always-on features,
// WITHOUT the EC "country scope" pieces (EcScopeChipComponent,
// EcScopeLinksComponent) — those belong to the EC Country Knowledge view and
// carry EC data (country report links in scope-links.data.ts), which must not
// ship to other libraries (scripts/build-noob.cjs checks for EC strings).
//
// When a generic feature is added to EcSharedRootComponent, add it here too.
// Same depth as src/app/custom1-module/ — see the NOTE in mappings.ts.
import { Component } from '@angular/core';
import { EcSessionComponent } from '../../app/shared/components/ec-session/ec-session.component';
import { EcAskLibrarianComponent } from '../../app/shared/components/ec-ask-librarian/ec-ask-librarian.component';
import { EcLastSearchComponent } from '../../app/shared/components/ec-last-search/ec-last-search.component';
import { EcLibChatComponent } from '../../app/shared/components/ec-libchat/ec-libchat.component';
import { EcMenuLinksComponent } from '../../app/shared/components/ec-menu-links/ec-menu-links.component';
import { EcWelcomeMessageComponent } from '../../app/shared/components/ec-welcome-message/ec-welcome-message.component';
import { EcLoansDueComponent } from '../../app/shared/components/ec-loans-due/ec-loans-due.component';
import { EcAccountCountsComponent } from '../../app/shared/components/ec-account-counts/ec-account-counts.component';
import { EcCustomDialogsComponent } from '../../app/shared/components/ec-custom-dialogs/ec-custom-dialogs.component';

@Component({
  selector: 'custom-ec-noob-root',
  standalone: true,
  imports: [EcSessionComponent, EcAskLibrarianComponent, EcLastSearchComponent, EcLibChatComponent, EcMenuLinksComponent, EcWelcomeMessageComponent, EcLoansDueComponent, EcAccountCountsComponent, EcCustomDialogsComponent],
  host: { 'data-component-id': 'custom-ec-noob-root' },
  template: `
    <!-- guest/user + sandbox classes on <html>, data-ec-nav links -->
    <custom-ec-session></custom-ec-session>
    <!-- Ask-a-librarian modal (only when askALibrarian is configured) -->
    <custom-ec-ask-librarian></custom-ec-ask-librarian>
    <!-- remembers the last search ("pick up where you left off") -->
    <custom-ec-last-search></custom-ec-last-search>
    <!-- LibChat widget (only when libchat.hash is set) -->
    <custom-ec-libchat></custom-ec-libchat>
    <!-- main-menu links without http(s) open in the same window -->
    <custom-ec-menu-links></custom-ec-menu-links>
    <!-- welcome message (welcomeMessage.enabled) -->
    <custom-ec-welcome-message></custom-ec-welcome-message>
    <!-- loans due soon / account counts: fill homepage blocks marked
         data-ec-loans-due / data-ec-account-counts, when switched on -->
    <custom-ec-loans-due></custom-ec-loans-due>
    <custom-ec-account-counts></custom-ec-account-counts>
    <!-- Custom dialogs: elements with a dialog's name as class open it (settings: customDialogs). -->
    <custom-ec-custom-dialogs></custom-ec-custom-dialogs>
  `,
})
export class EcNoobRootComponent {}
