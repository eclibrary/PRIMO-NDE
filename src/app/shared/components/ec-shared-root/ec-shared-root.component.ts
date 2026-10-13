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
//   - EcWelcomeMessageComponent welcome modal on opening the view (settings: welcomeMessage)
//   - EcLoansDueComponent     "loans due soon" line on the landing page (settings: loansDue)
//   - EcAccountCountsComponent loans / saved records / saved searches counts on the
//                             landing page, remembered for guests (settings: accountCounts)
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
import { EcScopeChipComponent } from '../ec-scope-chip/ec-scope-chip.component';
import { EcScopeLinksComponent } from '../ec-scope-links/ec-scope-links.component';
import { EcMenuLinksComponent } from '../ec-menu-links/ec-menu-links.component';
import { EcWelcomeMessageComponent } from '../ec-welcome-message/ec-welcome-message.component';
import { EcLoansDueComponent } from '../ec-loans-due/ec-loans-due.component';
import { EcAccountCountsComponent } from '../ec-account-counts/ec-account-counts.component';

@Component({
  selector: 'custom-ec-shared-root',
  standalone: true,
  imports: [EcSessionComponent, EcAskLibrarianComponent, EcLastSearchComponent, EcLibChatComponent, EcScopeChipComponent, EcScopeLinksComponent, EcMenuLinksComponent, EcWelcomeMessageComponent, EcLoansDueComponent, EcAccountCountsComponent],
  host: { 'data-component-id': 'custom-ec-shared-root' },
  template: `
    <custom-ec-session></custom-ec-session>
    <custom-ec-ask-librarian></custom-ec-ask-librarian>
    <custom-ec-last-search></custom-ec-last-search>
    <custom-ec-libchat></custom-ec-libchat>
    <!-- Country chip in NDE's search box while a subject scope is active (headless). -->
    <custom-ec-scope-chip></custom-ec-scope-chip>
    <!-- Country links strip above result #1 while a subject scope is active (headless). -->
    <custom-ec-scope-links></custom-ec-scope-links>
    <!-- Main-menu links without http(s) open in the same window (headless, all views). -->
    <custom-ec-menu-links></custom-ec-menu-links>
    <!-- Welcome message modal on opening the view; renders nothing when switched off or dismissed. -->
    <custom-ec-welcome-message></custom-ec-welcome-message>
    <!-- Fills the "loans due soon" line in the landing page HTML for signed-in patrons (headless). -->
    <custom-ec-loans-due></custom-ec-loans-due>
    <!-- Fills the loans / saved records / saved searches links in the landing page HTML,
         from the API when signed in, from localStorage for guests (headless). -->
    <custom-ec-account-counts></custom-ec-account-counts>
  `,
})
export class EcSharedRootComponent {}
