/*
  src/assets/editor/markup-help.js — "HTML features" reference

  The kit's features that work through MARKUP in the library's own HTML (home
  page, header, footer) rather than (only) through a setting: attributes such
  as data-ec-audience, placeholders the kit fills, special links.

  ONE SOURCE for three places, so they never disagree:
    - the "HTML features" tab of the package editor and the package maker
      (src/assets/editor/index.html → helpPanel()),
    - the "HTML features" tab of the npm settings UI
      (scripts/settings-ui/public/app.js → renderMarkupHelp(), served by server.cjs),
    - the Claude knowledge file of the noob kit
      (scripts/build-noob.cjs → markupReference(), section "HTML features").
  Plain script (no modules): it sets window.EC_MARKUP_HELP and works from disk
  (file://) as well. In Node, build-noob.cjs runs it with a stand-in `window`.

  Each entry:
    title    short name
    needs    the setting that must be ON for it to do anything ('' = none:
             works as soon as the kit is installed)
    what     one or two sentences, for library staff
    code     a ready-to-copy example
    notes    optional extra lines
  When a markup feature is added to the kit, add it here.
*/
window.EC_MARKUP_HELP = [
  {
    title: 'Show something only to guests or only to signed-in visitors',
    needs: '',
    what: 'Add data-ec-audience to any element. It stays hidden until Primo knows whether the visitor is signed in, so it never flickers.',
    code: '<p data-ec-audience="guest">Sign in to see your loans.</p>\n<p data-ec-audience="user">Welcome back!</p>',
  },
  {
    title: 'Show something only between two dates',
    needs: '',
    what: 'Add data-ec-from and/or data-ec-until (YEAR-MONTH-DAY) to any element. "until" includes that whole day. A time is possible too: 2026-12-20T14:00. Outside the dates the element is simply not there — prepare notices in advance.',
    code: '<p data-ec-from="2026-12-20" data-ec-until="2027-01-04">Closed for the Christmas holidays.</p>',
    notes: ['Not inside texts typed in the settings (dialogs, banners): banners have their own dates.'],
  },
  {
    title: 'Links to pages inside Primo',
    needs: '',
    what: 'A link with data-ec-nav stays inside Primo and keeps the visitor\'s view and language. data-ec-nav = the Primo page; data-ec-query = extra parameters (name=value, several joined with &). Keep href="#".',
    code: '<a href="#" data-ec-nav="account" data-ec-query="section=loans">My loans</a>\n<a href="#" data-ec-nav="account/favorites">Saved records</a>\n<a href="#" data-ec-nav="search" data-ec-query="query=climate">Books on climate</a>',
    notes: ['In data-ec-query, {currentYear} becomes the current year, e.g. mfacet=creationdate,include,[2020 TO {currentYear}].'],
  },
  {
    title: '"Pick up where you left off"',
    needs: '',
    what: 'A block that appears only when the visitor searched before in this browser, with a link back to that search. The kit fills the three marked parts; the rest is yours.',
    code: '<div data-ec-last-search>\n  Pick up where you left off:\n  <a href="#" data-ec-last-search-link>“<span data-ec-last-search-terms></span>” <span data-ec-last-search-page></span></a>\n</div>',
    notes: ['On the home page it replaces the welcome blocks (see the example home page): one welcome block at a time.'],
  },
  {
    title: 'Live counts',
    needs: '',
    what: 'An element with data-ec-count shows how many elements on the page match a CSS selector — no hand-typed totals. data-ec-count-label adds a word: "singular|plural".',
    code: '<span data-ec-count=".menu li" data-ec-count-label="link|links"></span>',
  },
  {
    title: 'Reading room PCs (kiosk mode)',
    needs: 'Reading room PCs (only to change the minutes and texts)',
    what: 'On PCs switched to kiosk mode (open Primo once with &ec_kiosk=1), show or hide parts of the page. A badge element shows the kiosk minutes.',
    code: '<p data-ec-kiosk="only">You are on a shared PC: your session is cleared after a while.</p>\n<p data-ec-kiosk="hide">Sign in to keep your saved records.</p>\n<span data-ec-kiosk>Reading room PC · reset after <span data-ec-kiosk-minutes>60</span> min</span>',
    notes: ['The badge (data-ec-kiosk without a value) is styled in the header; place it anywhere you like.'],
  },
  {
    title: 'Open one of your custom dialogs',
    needs: 'Custom dialogs (a dialog whose "Opens from" is that word)',
    what: 'A link to # + the word, or any element with the word as a class, opens the dialog.',
    code: '<a href="#dialog-borrowing">Borrowing rules</a>\n<button type="button" class="dialog-borrowing">Borrowing rules</button>',
  },
  {
    title: 'Opening hours',
    needs: 'Opening hours',
    what: 'Today\'s hours with "Open now" / "Closed now", the whole week, or a pop-up with the week. Invisible while the setting is off.',
    code: '<p data-ec-opening-hours></p>\n<div data-ec-opening-hours="week"></div>\n<a href="#ec-opening-hours">Opening hours</a>',
  },
  {
    title: 'Loans due soon',
    needs: 'Loans due soon',
    what: 'For signed-in visitors with loans due soon or overdue: "Loans due within 7 days: 1". Hidden when nothing is due. The kit writes the text into the link.',
    code: '<p class="ec-loans-due" data-ec-loans-due>\n  <span class="material-symbols-outlined" aria-hidden="true">event_upcoming</span>\n  <a href="#" data-ec-nav="account" data-ec-query="section=loans" data-ec-loans-due-text></a>\n</p>',
  },
  {
    title: 'Account counts (loans, saved records, saved searches)',
    needs: 'Account counts on the landing page',
    what: 'Links with the visitor\'s numbers. Guests see the numbers of their last signed-in visit in this browser — as plain labels, not links (the account pages are empty until they sign in), followed by a "Sign in to see them" button. Leave the element empty — the kit fills it.',
    code: '<nav class="ec-account-counts" data-ec-account-counts></nav>',
    notes: [
      'data-ec-account-counts-welcome="off" on that element leaves out the "Welcome back" line above the links.',
      'data-ec-account-counts-signin="off" on that element leaves out the guests\' sign-in button — for a block that already has its own Sign in button.',
    ],
  },
  {
    title: 'On / outside your own network',
    needs: 'Network check',
    what: 'Show content only inside your organisation\'s network, or only outside it. While the check runs, and when it is off, visitors count as outside.',
    code: '<p data-ec-network="ec">You are on our network: e-books open directly.</p>\n<p data-ec-network="external">Outside our network? Sign in first.</p>',
    notes: ['A lock after a link: <span class="material-symbols-outlined ec-network-lock" data-ec-network="external" aria-hidden="true">lock</span>'],
  },
  {
    title: '"Check connection" button',
    needs: 'Network check',
    what: 'A button that checks the network again right now (e.g. after the visitor switched on the VPN): the network parts of the page follow the new result at once. If the visitor is not on the network, a message explains the likely cause and what to do (texts in the Network check settings), with technical details for your helpdesk.',
    code: '<button type="button" data-ec-network-check>Check connection</button>\n<a href="#ec-network-check">Check connection</a>',
    notes: ['The result appears right after the button. To show it elsewhere, add an empty <div data-ec-network-status></div> where you want it.'],
  },
  {
    title: 'Ask a librarian links',
    // `needs` = the section title in config/schema.json, word for word (also a translation key).
    needs: 'Ask a librarian (LibAnswers)',
    what: 'Any ordinary link to your LibAnswers question form — more precisely, whose address starts with one of the "Ask a librarian links" in the settings — is prefilled (and opens the dialog when "Use dialog" is on). Nothing special to add.',
    code: '<a href="https://yourlibrary.libanswers.com/form?queue_id=1234">Ask a librarian</a>',
    notes: ['data-ec-no-modal on such a link: it opens its page normally, without the dialog.'],
  },
  {
    title: 'Icons',
    needs: '',
    what: 'Any icon from https://fonts.google.com/icons — write its name. aria-hidden when it only decorates text next to it.',
    code: '<span class="material-symbols-outlined" aria-hidden="true">schedule</span>',
  },
  {
    title: 'Colours',
    needs: '',
    what: 'The kit follows the Color Theme picked for the view in Alma. To force your own colours, put this in assets/css/custom.css.',
    code: ':root {\n  --ec-blue: #7a003c;      /* main colour: bars, buttons, links */\n  --ec-on-blue: #fff;      /* text on the main colour */\n}',
  },
];
