NOOB — NDE OUT OF THE BOX — version {{VERSION}}
====================================================
The EC Library NDE kit: extra Primo NDE features, ready out of the box.

Extra features for your Primo NDE view, made by the European Commission
Library, free to use. Set up and installed by you, in your browser. You do not
need any technical tools or a developer.

WHAT YOU NEED
  - Access to Alma's Primo NDE view configuration for your view
    (the place where the view's "customization package" is uploaded).
  - A recent Microsoft Edge, Google Chrome or Firefox.

WHAT IS IN THIS FOLDER
  START HERE.html   the package maker — double-click it to open it in your browser
  COMMENCER ICI.html  the same package maker in French
  EMPEZAR AQUI.html   the same package maker in Spanish
                    (same result whichever you use; links at the top right
                    switch between them)
  maker\            files the package maker needs. Keep this folder next to
                    START HERE.html, and do not change anything in it.
  examples\         an example home page, header and footer (homepage_en.html,
                    header.html, footer.html) — see "YOUR HOME PAGE" below
  README.txt        this text
  LISEZ-MOI.txt     this text in French
  LEAME.txt         this text in Spanish


INSTALL THE KIT, OR UPDATE IT, OR CHANGE ITS SETTINGS
-----------------------------------------------------
The same four steps every time.

1. DOWNLOAD YOUR PACKAGE FROM ALMA
   In Alma, open your Primo NDE view (View Configuration), tab
   "Manage Customization Package". Under "Download Package", click
   "Download" next to "Current View Customization Package". You get a zip
   file named after your view, for example 44ABC_INST-MAIN.zip.
   Do not unzip it.
   ALWAYS START FROM A FRESH DOWNLOAD. Never reuse an older zip from your
   Downloads folder: whatever was changed in the package since (a new image,
   an edited home page, settings) would be undone when you upload the
   result. The package maker warns you when the zip is more than a day old.
   (The page says "No Package Loaded"? Then the view has no package yet:
   skip this step and choose "Start without a package" in step 2.)

2. OPEN THE PACKAGE MAKER
   Unzip the kit (this folder) if you have not done so, then double-click
   START HERE.html. Drop the zip from step 1 onto the page.
   The page reads the zip in your browser. Nothing is sent anywhere.

3. CHECK THE SETTINGS, THEN CLICK "MAKE PACKAGE"
   - "View code" must be your view, as in the Primo address after vid=,
     for example 44ABC_INST:MAIN. It is filled in from the zip when possible.
   - Every feature has a section. Open it, switch it on or off, adjust the
     texts. Settings marked "new" were added in this version of the kit.
   - "Make package" (bottom right) downloads a new zip with the same name to
     your Downloads folder.

4. UPLOAD THE NEW ZIP IN ALMA
   Same tab as step 1, "Manage Customization Package". Under
   "Upload Package", choose the new zip next to "Customization Package" and
   click "Upload". After a few minutes, open your view in Primo and reload
   the page (Ctrl+F5).

If something is not right: upload the zip from step 1 again. That restores
your view exactly as it was.


GOOD TO KNOW
------------
- YOUR OWN FILES ARE KEPT. Your styles (assets\css\custom.css), your
  scripts (assets\js\custom.js), home page, header, footer and images stay
  exactly as they are. The package maker only replaces
  its own program files and the settings file (assets/settings.js).

- COLOURS. The kit uses the colour theme you pick for the view in Alma
  (tab "Manage Customization Package", "Color Theme"): dialog title bars,
  buttons, header and footer bars and the home page links all follow it.
  Changed the theme? Nothing to do here — reload Primo after a few minutes.

- YOUR STYLES. Put your own CSS in assets\css\custom.css (the file from
  Ex Libris' template package; Primo loads it on every page). It is never
  changed by the package maker, and it wins over the kit's styles. Example —
  a colour of your own instead of the Alma theme:
      :root { --ec-blue: #7a003c; --ec-on-blue: #fff; }
  (--ec-blue = the main colour, --ec-on-blue = text on it.)
  (A custom.css at the top of the package folder is loaded too, so older
  packages keep working; use one of the two, not both.)

- YOUR OWN SCRIPTS. Small scripts of your own go in assets\js\custom.js
  (also from the template; Primo loads it on every page, and the package
  maker never changes it). NOT in the home page, header or footer: Primo
  removes <script> from those. Keep scripts small, and remember that Primo
  draws its pages after your script has started — so wait for the elements
  you need instead of expecting them to be there. Check first whether the kit
  already does what you want (settings, data-ec-… attributes): that is safer.

- NO HOME PAGE, HEADER OR FOOTER YET? When your package has none, the
  package maker offers to add a STARTER home page, header and footer: simple
  pages that work as they are, with the texts to replace marked [YOUR …].
  It never replaces pages you already have.

- YOUR HOME PAGE. The kit can add things to your home page (the part
  below the search box): a "Pick up where you left off" link to the
  visitor's last search, a "Loans due soon" line, links with the number of
  loans, saved records and saved searches, and parts shown only to signed-in
  visitors, only to guests, or only on your own network.
  examples\homepage_en.html shows all of them, with explanations in the file
  (open it with Notepad). Your home page files are in your package, in
  assets\homepage\. The examples folder also has a header (a bar at the top
  of every page) and a footer: they go in assets\header-footer\. To change them: unzip the package from Alma, edit or
  replace the files, zip the folder again, then drop that zip on
  START HERE.html as usual — your home page is kept.
  Switch on "Loans due soon" and "Account counts on the landing page" in the
  settings; "Network check" for the network parts.
  A "Check connection" button (also in the example) lets visitors check
  the network again, e.g. after switching on the VPN; when they are not on
  the network it explains why and what to do. Write that advice (your VPN,
  whom to contact) in the "Network check" settings.

- READING ROOM PCs. Open Primo once on such a PC with &ec_kiosk=1 added to
  the address (&ec_kiosk=0 switches it off). The kit then clears what the
  previous visitor left behind and resets the page after a while without
  activity (settings: "Reading room PCs"). Parts of your home page, header
  or footer can be shown only there, or hidden there — see section 4 of
  examples\homepage_en.html.

- CUSTOM DIALOGS. Pop-up windows with your own text: add them in the
  section "Custom dialogs" of the package maker (as many as you need).
  "Opens from" says what opens each one. Write a word of your choice, e.g.
  dialog-borrowing (letters, digits, - and _, no spaces): then, in your home
  page, header or footer, a link to #dialog-borrowing opens it —
  <a href="#dialog-borrowing">Borrowing rules</a> — and so does any element
  with dialog-borrowing as its class. See section 5 of
  examples\homepage_en.html.
  For the technically minded, "Opens from" also takes a CSS selector, e.g.
  a[href*="calendly.com"] — handy for links you cannot give a class, like
  NDE's own menu links.
  "Widget code" (optional): paste the embed code of a form, chat or booking
  tool exactly as its provider gives it; it appears below the text and
  loads the first time the dialog opens. This code RUNS in your Primo:
  paste only code from providers you trust.

- ASK A LIBRARIAN (LIBANSWERS). For libraries that answer questions with
  LibAnswers (a Springshare product). Your "ask us a question" links to the
  LibAnswers question form (section "Ask a librarian (LibAnswers)"): list
  the start of their address under "Ask a librarian links", e.g.
  https://yourlibrary.libanswers.com/form?queue_id=1234. Every such link in
  your home page, header, footer or menu then carries the signed-in
  visitor's name and e-mail (tick which), other values you choose ("Other
  prefills": a detail from Alma, e.g. address line 2 for a department
  field, or a parameter of the Primo page, e.g. query), and — with "Add
  context to the details" — what they were looking at (record title, search
  terms, link). The form opens filled in, as long as it reads those from
  its address (LibAnswers forms do: use the form's field names, e.g. pname,
  pemail, pdetails).
  No LibAnswers? Leave "Ask a librarian links" empty: nothing happens.
  Another question-form tool only works if its form reads values from its
  address in the same way.
  Tick "Use dialog" to open the form in a pop-up instead: paste the form's
  embed code in "Widget code" (LibAnswers: Admin > Widgets > your question
  form > embed code). Hide or restyle parts of it with "Custom CSS", e.g.
  [name="pdetails"] { display: none; }

- NOTICE BANNERS. Coloured message bars on every page — "Closed on 1 May",
  "New: chat with a librarian". Section "Notice banners" of the package maker:
  add as many as you need. Each has its text (per language), a place (above
  the menu, under the menu, under the search area, or fixed at the bottom of
  the window), a colour (theme colour, three ready-made styles, or your own
  colour with the colour picker — the text turns black or white by itself so
  it stays readable), optional first and last day, and optionally a × to
  close it. A closed banner stays closed in that browser until you change it.

- SEARCH TIPS. A box between the search results when a search contains
  certain words — e.g. "Looking for statistics? Try …" after result 3 for any
  search with "statistics". Section "Search tips": add a tip per subject, with
  its words (one per line; leave empty for EVERY search), whether the search
  must contain one of them or be exactly one of them, after which result it
  goes, its text and colour, and optional dates. Shown on the first page of
  results only.

- OPENING HOURS. Fill in your weekly hours and the exceptions (public
  holidays, closures) in the section "Opening hours". Your home page, header
  or footer then show today's hours with "Open now" / "Closed now", the whole
  week, or a pop-up with the whole week — see section 6 of
  examples\homepage_en.html. Write hours as 09:00-17:00, several periods as
  09:00-12:30, 13:30-17:00; leave a day empty when you are closed.

- SHOW SOMETHING ONLY BETWEEN TWO DATES. Add data-ec-from="2026-12-20"
  and/or data-ec-until="2027-01-04" to any part of your home page, header or
  footer: it shows only on those days. Prepare holiday notices in advance —
  see section 7 of examples\homepage_en.html.

- COLLECTION BADGES. A badge on every record of an Alma collection (e.g.
  "Readable from home"), with an (i) that explains it. Section "Collection
  badges": add a badge per collection, each with its own text and colour.

- FREE VERSIONS (UNPAYWALL). Switched on in the section "Free versions",
  records with a DOI (mostly articles) get a "Free version" link when a legal
  free copy exists — found by Unpaywall (unpaywall.org), a free non-profit
  service. It needs a contact e-mail of your library. PRIVACY: for those
  records, the visitor's browser asks unpaywall.org about the DOI, so
  Unpaywall sees the DOI and the visitor's internet address. Mention it in
  your privacy notice before switching it on.

- ICONS. Your home page, header and footer can use any icon from
  https://fonts.google.com/icons — copy the icon's name, then write
  <span class="material-symbols-outlined">menu_book</span>

- ANOTHER CUSTOM MODULE. Primo NDE can run one custom module per view. If
  your package already has one that was not made with this kit, the package
  maker warns you before replacing it. If nobody built anything for your view,
  it is most likely Ex Libris' empty example, and replacing it is fine. If a
  developer or company made it for you, ask them first.

- LANGUAGES. The kit starts in English only. Add your languages in the
  "Languages" section of the package maker: every text then gets a line for
  each language (an empty line shows the English text). Primo itself needs
  the language switched on for the view in Alma, and NDE needs a home page
  file per language (homepage_fr.html, …).
  (The language of the package maker itself — START HERE, COMMENCER ICI or
  EMPEZAR AQUI — changes nothing in the languages of your view.)

- A NEWER KIT. Download the new kit and repeat steps 1 to 4. Your settings
  are kept; new settings appear marked "new", with sensible defaults.

- CHECKING. In Primo, press F12 and look at the Console: a line
  "[ec] settings: assets/settings.js applied" means your settings are in use.
