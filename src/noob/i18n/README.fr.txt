NOOB — NDE OUT OF THE BOX — version {{VERSION}}
====================================================
Le kit NDE de la Bibliothèque de la Commission européenne : des fonctions
supplémentaires pour Primo NDE, prêtes à l'emploi.

(Traduction française de README.txt. Les noms des menus d'Alma restent en
anglais, tels qu'Alma les affiche : "Manage Customization Package", etc.)

Des fonctions supplémentaires pour votre vue Primo NDE, réalisées par la
Bibliothèque de la Commission européenne, libres d'utilisation. Vous les
installez et les configurez vous-même, dans votre navigateur. Aucun outil
technique ni développeur n'est nécessaire.

CE QU'IL VOUS FAUT
  - Un accès à la configuration de votre vue Primo NDE dans Alma
    (l'endroit où l'on charge le « paquet de personnalisation » de la vue).
  - Une version récente de Microsoft Edge, Google Chrome ou Firefox.

CONTENU DE CE DOSSIER
  START HERE.html     le créateur de paquet, en anglais
  COMMENCER ICI.html  le même créateur de paquet, en français — double-cliquez
                      dessus pour l'ouvrir dans votre navigateur
  EMPEZAR AQUI.html   le même créateur de paquet, en espagnol
                      (le résultat est le même quelle que soit la langue ;
                      des liens en haut à droite permettent de passer de
                      l'une à l'autre)
  maker\              les fichiers dont le créateur de paquet a besoin. Gardez
                      ce dossier à côté de COMMENCER ICI.html et n'y changez rien.
  examples\           un exemple de page d'accueil, d'en-tête et de pied de page
                      (homepage_en.html, header.html, footer.html) — voir
                      « VOTRE PAGE D'ACCUEIL » plus bas
  README.txt          ce texte en anglais
  LISEZ-MOI.txt       ce texte
  LEAME.txt           ce texte en espagnol


INSTALLER LE KIT, LE METTRE À JOUR OU CHANGER SES PARAMÈTRES
------------------------------------------------------------
Les mêmes quatre étapes à chaque fois.

1. TÉLÉCHARGEZ VOTRE PAQUET DEPUIS ALMA
   Dans Alma, ouvrez votre vue Primo NDE (View Configuration), onglet
   "Manage Customization Package". Sous "Download Package", cliquez sur
   "Download" à côté de "Current View Customization Package". Vous obtenez
   un fichier zip qui porte le nom de votre vue, par exemple
   44ABC_INST-MAIN.zip. Ne le décompressez pas.
   PARTEZ TOUJOURS D'UN TÉLÉCHARGEMENT RÉCENT. Ne réutilisez jamais un ancien
   zip de votre dossier Téléchargements : tout ce qui a changé dans le paquet
   depuis (une nouvelle image, une page d'accueil modifiée, des paramètres)
   serait annulé au chargement du résultat. Le créateur de paquet vous
   prévient quand le zip date de plus d'un jour.
   (La page indique "No Package Loaded" ? La vue n'a alors pas encore de
   paquet : sautez cette étape et choisissez « Commencer sans paquet » à
   l'étape 2.)

2. OUVREZ LE CRÉATEUR DE PAQUET
   Décompressez le kit (ce dossier) si ce n'est pas encore fait, puis
   double-cliquez sur COMMENCER ICI.html. Déposez le zip de l'étape 1 sur
   la page. La page lit le zip dans votre navigateur. Rien n'est envoyé
   nulle part.

3. VÉRIFIEZ LES PARAMÈTRES, PUIS CLIQUEZ SUR « CRÉER LE PAQUET »
   - « Code de la vue » doit être votre vue, comme dans l'adresse Primo
     après vid=, par exemple 44ABC_INST:MAIN. Il est rempli à partir du zip
     quand c'est possible.
   - Chaque fonction a sa section. Ouvrez-la, activez-la ou désactivez-la,
     adaptez les textes. Les paramètres marqués « nouveau » ont été ajoutés
     dans cette version du kit.
   - « Créer le paquet » (en bas à droite) télécharge un nouveau zip du même
     nom dans votre dossier Téléchargements.

4. CHARGEZ LE NOUVEAU ZIP DANS ALMA
   Même onglet qu'à l'étape 1, "Manage Customization Package". Sous
   "Upload Package", choisissez le nouveau zip à côté de
   "Customization Package" et cliquez sur "Upload". Après quelques minutes,
   ouvrez votre vue dans Primo et rechargez la page (Ctrl+F5).

En cas de problème : chargez à nouveau le zip de l'étape 1. Votre vue
retrouve exactement son état précédent.


BON À SAVOIR
------------
- VOS PROPRES FICHIERS SONT CONSERVÉS. Vos styles (assets\css\custom.css),
  vos scripts (assets\js\custom.js), votre page d'accueil, en-tête, pied de
  page et vos images restent exactement tels quels. Le créateur de paquet ne
  remplace que ses propres fichiers de programme et le fichier des
  paramètres (assets/settings.js).

- COULEURS. Le kit utilise le thème de couleurs choisi pour la vue dans
  Alma (onglet "Manage Customization Package", "Color Theme") : barres de
  titre des fenêtres, boutons, barres d'en-tête et de pied de page et liens
  de la page d'accueil le suivent tous. Vous avez changé de thème ? Rien à
  faire ici — rechargez Primo après quelques minutes.

- VOS STYLES. Mettez votre propre CSS dans assets\css\custom.css (le
  fichier du paquet modèle d'Ex Libris ; Primo le charge sur chaque page).
  Le créateur de paquet ne le modifie jamais, et il l'emporte sur les styles
  du kit. Exemple — votre propre couleur au lieu du thème d'Alma :
      :root { --ec-blue: #7a003c; --ec-on-blue: #fff; }
  (--ec-blue = la couleur principale, --ec-on-blue = le texte posé dessus.)
  (Un custom.css placé en haut du dossier du paquet est chargé aussi, pour
  que les anciens paquets continuent de fonctionner ; utilisez l'un des
  deux, pas les deux.)

- VOS PROPRES SCRIPTS. Les petits scripts à vous vont dans
  assets\js\custom.js (lui aussi vient du modèle ; Primo le charge sur
  chaque page, et le créateur de paquet ne le modifie jamais). PAS dans la
  page d'accueil, l'en-tête ou le pied de page : Primo en retire les
  <script>. Gardez vos scripts courts, et n'oubliez pas que Primo dessine
  ses pages après le démarrage de votre script — attendez donc les éléments
  dont vous avez besoin au lieu de supposer qu'ils sont déjà là. Vérifiez
  d'abord si le kit fait déjà ce que vous voulez (paramètres, attributs
  data-ec-…) : c'est plus sûr.

- PAS ENCORE DE PAGE D'ACCUEIL, D'EN-TÊTE OU DE PIED DE PAGE ? Quand votre
  paquet n'en a pas, le créateur de paquet propose d'ajouter une page
  d'accueil, un en-tête et un pied de page DE DÉPART : des pages simples qui
  fonctionnent telles quelles, où les textes à remplacer sont marqués
  [YOUR …]. Il ne remplace jamais des pages que vous avez déjà.

- VOTRE PAGE D'ACCUEIL. Le kit peut ajouter des éléments à votre page
  d'accueil (la partie sous le champ de recherche) : un lien « Reprendre là
  où vous vous étiez arrêté » vers la dernière recherche de l'usager, une
  ligne « Prêts bientôt à rendre », des liens avec le nombre de prêts, de
  notices enregistrées et de recherches enregistrées, et des parties
  réservées aux usagers connectés, aux invités ou à votre propre réseau.
  examples\homepage_en.html les montre toutes, avec des explications dans le
  fichier (ouvrez-le avec le Bloc-notes ; l'exemple est en anglais). Les
  fichiers de votre page d'accueil sont dans votre paquet, dans
  assets\homepage\. Le dossier examples contient aussi un en-tête (une barre
  en haut de chaque page) et un pied de page : ils vont dans
  assets\header-footer\. Pour les modifier : décompressez le paquet venant
  d'Alma, modifiez ou remplacez les fichiers, recompressez le dossier, puis
  déposez ce zip sur COMMENCER ICI.html comme d'habitude — votre page
  d'accueil est conservée.
  Activez « Prêts bientôt à rendre » et « Compteurs du compte sur la page
  d'accueil » dans les paramètres ; « Vérification du réseau » pour les
  parties liées au réseau.
  Un bouton « Vérifier la connexion » (présent aussi dans l'exemple) permet
  aux usagers de vérifier à nouveau le réseau, p. ex. après avoir activé le
  VPN ; quand ils ne sont pas sur le réseau, il explique pourquoi et quoi
  faire. Rédigez ces conseils (votre VPN, qui contacter) dans les paramètres
  « Vérification du réseau ».

- PC DE SALLE DE LECTURE. Ouvrez Primo une fois sur un tel PC en ajoutant
  &ec_kiosk=1 à l'adresse (&ec_kiosk=0 le désactive). Le kit efface alors ce
  que l'usager précédent a laissé et réinitialise la page après un moment
  sans activité (paramètres : « PC de salle de lecture »). Des parties de
  votre page d'accueil, de l'en-tête ou du pied de page peuvent n'apparaître
  que là, ou y être masquées — voir la section 4 de
  examples\homepage_en.html.

- FENÊTRES PERSONNALISÉES. Des fenêtres avec votre propre texte : ajoutez-
  les dans la section « Fenêtres personnalisées » du créateur de paquet
  (autant que nécessaire). « S'ouvre depuis » indique ce qui ouvre chacune.
  Écrivez un mot de votre choix, p. ex. dialog-borrowing (lettres, chiffres,
  - et _, sans espaces) : alors, dans votre page d'accueil, en-tête ou pied
  de page, un lien vers #dialog-borrowing l'ouvre —
  <a href="#dialog-borrowing">Règles de prêt</a> — de même que tout élément
  ayant dialog-borrowing comme classe. Voir la section 5 de
  examples\homepage_en.html.
  Pour les plus techniques, « S'ouvre depuis » accepte aussi un sélecteur
  CSS, p. ex. a[href*="calendly.com"] — pratique pour des liens auxquels
  vous ne pouvez pas donner de classe, comme les liens du menu de NDE.
  « Code du widget » (facultatif) : collez le code d'intégration d'un
  formulaire, d'un chat ou d'un outil de réservation exactement tel que son
  fournisseur le donne ; il apparaît sous le texte et se charge la première
  fois que la fenêtre s'ouvre. Ce code S'EXÉCUTE dans votre Primo : ne
  collez que du code de fournisseurs de confiance.

- DEMANDER À UN BIBLIOTHÉCAIRE (LIBANSWERS). Pour les bibliothèques qui
  répondent aux questions avec LibAnswers (un produit de Springshare). Vos
  liens « posez-nous une question » vers le formulaire de question
  LibAnswers (section « Demander à un bibliothécaire (LibAnswers) ») :
  indiquez le début de leur adresse dans « Liens Demander à un
  bibliothécaire », p. ex.
  https://yourlibrary.libanswers.com/form?queue_id=1234. Chacun de ces liens
  dans votre page d'accueil, en-tête, pied de page ou menu transmet alors le
  nom et l'e-mail de l'usager connecté (cochez lesquels), d'autres valeurs
  de votre choix (« Autres préremplissages » : une donnée d'Alma, p. ex. la
  ligne d'adresse 2 pour un champ « service », ou un paramètre de la page
  Primo, p. ex. query) et — avec « Ajouter le contexte aux détails » — ce
  que l'usager consultait (titre de la notice, termes de recherche, lien).
  Le formulaire s'ouvre prérempli, à condition qu'il lise ces valeurs dans
  son adresse (c'est le cas des formulaires LibAnswers : utilisez les noms
  de champs du formulaire, p. ex. pname, pemail, pdetails).
  Pas de LibAnswers ? Laissez « Liens Demander à un bibliothécaire » vide :
  rien ne se passe. Un autre outil de formulaire ne fonctionne que si son
  formulaire lit les valeurs dans son adresse de la même façon.
  Cochez « Utiliser une fenêtre » pour ouvrir plutôt le formulaire dans une
  fenêtre : collez le code d'intégration du formulaire dans « Code du
  widget » (LibAnswers : Admin > Widgets > votre formulaire de question >
  embed code). Masquez ou modifiez certaines parties avec « CSS
  personnalisé », p. ex. [name="pdetails"] { display: none; }

- BANDEAUX D'INFORMATION. Des barres de message colorées sur chaque page —
  « Fermé le 1er mai », « Nouveau : chattez avec un bibliothécaire ».
  Section « Bandeaux d'information » du créateur de paquet : ajoutez-en
  autant que nécessaire. Chacun a son texte (par langue), sa place (au-
  dessus du menu, sous le menu, sous la zone de recherche, ou fixé en bas de
  la fenêtre), sa couleur (couleur du thème, trois styles prêts à l'emploi,
  ou votre propre couleur avec le sélecteur de couleur — le texte passe de
  lui-même en noir ou en blanc pour rester lisible), des dates de début et
  de fin facultatives et, si vous le souhaitez, un × pour le fermer. Un
  bandeau fermé reste fermé dans ce navigateur jusqu'à ce que vous le
  modifiiez.

- CONSEILS DE RECHERCHE. Un encadré entre les résultats de recherche quand
  une recherche contient certains mots — p. ex. « Vous cherchez des
  statistiques ? Essayez… » après le résultat 3 pour toute recherche
  contenant « statistiques ». Section « Conseils de recherche » : ajoutez un
  conseil par sujet, avec ses mots (un par ligne ; laissez vide pour TOUTES
  les recherches), si la recherche doit contenir l'un d'eux ou être
  exactement l'un d'eux, après quel résultat il se place, son texte et sa
  couleur, et des dates facultatives. Affiché uniquement sur la première
  page de résultats.

- HORAIRES D'OUVERTURE. Indiquez vos horaires hebdomadaires et les
  exceptions (jours fériés, fermetures) dans la section « Horaires
  d'ouverture ». Votre page d'accueil, en-tête ou pied de page affichent
  alors les horaires du jour avec « Ouvert » / « Fermé », toute la semaine,
  ou une fenêtre avec toute la semaine — voir la section 6 de
  examples\homepage_en.html. Écrivez les horaires sous la forme 09:00-17:00,
  plusieurs plages sous la forme 09:00-12:30, 13:30-17:00 ; laissez un jour
  vide quand vous êtes fermés.

- AFFICHER UN CONTENU SEULEMENT ENTRE DEUX DATES. Ajoutez
  data-ec-from="2026-12-20" et/ou data-ec-until="2027-01-04" à n'importe
  quelle partie de votre page d'accueil, en-tête ou pied de page : elle
  n'apparaît que ces jours-là. Préparez vos annonces de congés à l'avance —
  voir la section 7 de examples\homepage_en.html.

- BADGES DE COLLECTION. Un badge sur chaque notice d'une collection Alma
  (p. ex. « Lisible depuis chez vous »), avec un (i) qui l'explique.
  Section « Badges de collection » : ajoutez un badge par collection, chacun
  avec son texte et sa couleur.

- VERSIONS GRATUITES (UNPAYWALL). Une fois activée la section « Versions
  gratuites », les notices avec un DOI (surtout des articles) reçoivent un
  lien « Version gratuite » quand une copie gratuite légale existe — trouvée
  par Unpaywall (unpaywall.org), un service gratuit à but non lucratif. Il
  faut une adresse e-mail de contact de votre bibliothèque. VIE PRIVÉE :
  pour ces notices, le navigateur de l'usager interroge unpaywall.org sur le
  DOI, donc Unpaywall voit le DOI et l'adresse internet de l'usager.
  Mentionnez-le dans votre politique de confidentialité avant de l'activer.

- ICÔNES. Votre page d'accueil, en-tête et pied de page peuvent utiliser
  n'importe quelle icône de https://fonts.google.com/icons — copiez le nom
  de l'icône, puis écrivez
  <span class="material-symbols-outlined">menu_book</span>

- UN AUTRE MODULE PERSONNALISÉ. Primo NDE ne peut exécuter qu'un seul
  module personnalisé par vue. Si votre paquet en contient déjà un qui n'a
  pas été fait avec ce kit, le créateur de paquet vous prévient avant de le
  remplacer. Si personne n'a rien développé pour votre vue, il s'agit très
  probablement de l'exemple vide d'Ex Libris, et le remplacer ne pose aucun
  problème. Si un développeur ou une société l'a réalisé pour vous,
  demandez-leur d'abord.

- LANGUES. Le kit démarre en anglais seulement. Ajoutez vos langues dans la
  section « Langues » du créateur de paquet : chaque texte reçoit alors une
  ligne pour chaque langue (une ligne vide affiche le texte anglais). Primo
  lui-même a besoin que la langue soit activée pour la vue dans Alma, et
  NDE a besoin d'un fichier de page d'accueil par langue
  (homepage_fr.html, …).
  (La langue du créateur de paquet lui-même — START HERE, COMMENCER ICI ou
  EMPEZAR AQUI — ne change rien aux langues de votre vue.)

- UN KIT PLUS RÉCENT. Téléchargez le nouveau kit et refaites les étapes 1
  à 4. Vos paramètres sont conservés ; les nouveaux paramètres apparaissent
  marqués « nouveau », avec des valeurs par défaut raisonnables.

- VÉRIFICATION. Dans Primo, appuyez sur F12 et regardez la Console : une
  ligne "[ec] settings: assets/settings.js applied" signifie que vos
  paramètres sont utilisés.
