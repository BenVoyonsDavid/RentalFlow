# RentalFlow — 12 recommandations de Wix (0 bloqueur)

Date de revue : 3 novembre 2026. Cette branche est une **candidature de prévisualisation**, pas une release App Market.

## État des recommandations

| Recommandation Wix | État | Action |
| --- | --- | --- |
| Équipements searchable | Code prêt | `metaData.searchable`, titre et description |
| Extras de réservation searchable | Code prêt | Idem |
| Catalogue searchable | Code prêt | Idem |
| Calendrier searchable | Code prêt | Idem |
| Tableau de bord searchable | Code prêt | Idem |
| Catégories searchable | Code prêt | Idem |
| Clients searchable | Code prêt | Idem |
| Réservations searchable | Code prêt | Idem |
| Paramètres searchable | Code prêt | Idem |
| Add BI events | Instrumentation prête, réception Wix non vérifiée | `APP_DASHBOARD_LOADED` après le chargement réussi du tableau de bord; `PRIMARY_ACTION_PERFORMED` après création d'une réservation; événements personnalisés du premier équipement et des réservations. Aucun renseignement personnel. |
| Add a video | Scénario promotionnel et sous-titres FR/EN préparés; vraie vidéo à produire | Capturer l'application en environnement de test puis publier une courte vidéo de présentation accessible par URL YouTube. Voir `APP_MARKET_VIDEO_PRODUCTION.md` et `app-market/media/`. Ne pas prétendre que la vidéo a été enregistrée ou téléversée. |
| Add some webhooks | 3 gestionnaires codés; présence de doublons non vérifiée | Extensions Wix CLI pour installation, changement de forfait et désinstallation, avec journaux sans données locataires. **Vérifier dans le Wix App Dashboard avant toute release** qu'il n'existe pas déjà des abonnements à ces événements. |

**Compatibilité SDK** : les types fournis par `@wix/astro 2.75.0` omettent encore `metaData` malgré la documentation Wix actuelle. `src/lib/dashboard-search-metadata.ts` contient un type d'adaptation ciblé, tout en conservant `extensions.dashboardPage` et le payload d'origine. Le typecheck et le build peuvent réussir sans prouver que Wix indexera les pages : la vérification finale de la recherche se fait après une release contrôlée.

**Important** : ces réglages de recherche ne deviennent visibles dans le tableau de bord Wix qu'après une **nouvelle version de l'app**. Un `wix preview` n'est pas une release. Aucun `wix release` ni soumission App Market n'est déclenché par cette PR.

## Vidéo promotionnelle — matériel prêt, tournage non effectué

Wix recommande une courte vidéo **promotionnelle** qui présente l'intérêt de l'application plutôt qu'un tutoriel. Le média se renseigne sous **App Profile > Media** à l'aide d'une **URL YouTube**. Le scénario français/anglais, les plans et les fichiers de sous-titres SRT sont maintenant dans :

- [APP_MARKET_VIDEO_PRODUCTION.md](./APP_MARKET_VIDEO_PRODUCTION.md)
- [Sous-titres FR](./app-market/media/rentalflow-promo-fr.srt)
- [English subtitles](./app-market/media/rentalflow-promo-en.srt)

**À faire réellement** : enregistrer les écrans Wix avec uniquement des données de test, réaliser le montage, héberger la vidéo sur YouTube et saisir son URL dans Wix. Aucun enregistrement réel ni téléversement n'a été effectué.

## Webhooks : validation avant ajout

Wix recommande les événements d'installation, de montée de forfait et de désinstallation. Trois extensions CLI sont maintenant préparées dans `src/extensions/backend/events/` : `app-installed`, `app-plan-changed`, `app-removed`. Elles ne suppriment aucune donnée et se limitent à consigner des événements sans identité de locataire. **Attention : un appel Wix peut être livré plusieurs fois et les journaux ne sont pas une base d'événements durable.** Pour le CLI, préférer des **event extensions** gérées par Wix à un webhook HTTP maison :
1. Relever les événements déjà configurés dans le Wix App Dashboard (il ne peut y avoir deux extensions pour un même événement, y compris celles créées dans Wix).
2. Identifier les types d'événements exacts et SDK applicables à l'app actuelle. Éviter de supposer qu'un module SDK expose un événement particulier.
3. Conserver les extensions préparées uniquement si aucun abonnement au même événement n'existe déjà dans le Wix App Dashboard; supprimer le doublon avant la release. Comme elles n'ont aucun effet métier, une livraison en double n'altère pas les données, mais les comptes de logs peuvent être surestimés.
4. Tester en environnement de développement; la configuration d'un nouvel événement ne prend effet que sur les installations recevant une nouvelle version.

**Ne jamais supprimer les données d'un locataire sur simple réception d'un webhook « uninstall » sans politique de conservation explicite et mécanisme vérifié.**

## Vérification sans publication

Le connecteur Wix disponible permet de lire les informations du site de développement, mais **n'expose pas la liste de la configuration des webhooks** de l'application ni un historique consultable de réception des événements BI. Il serait incorrect de déclarer ces éléments validés par API.

- **Webhooks** : ouvrir https://manage.wix.com/account/custom-apps, sélectionner **RentalFlow**, puis la section **Webhooks**. Dans la liste des abonnements, vérifier qu'« App Instance Installed », « Paid Plan Changed » et « App Instance Removed » ne figurent pas déjà en double. L'onglet **Logs** de cette section permet de vérifier les livraisons réelles après publication d'une version contrôlée.
- **BI** : après installation du bon aperçu sur un site de développement, ouvrir la console réseau du navigateur (DevTools) et charger « Tableau de bord ». Contrôler `POST /api/bi-event` et son résultat HTTP; **200 indique que le proxy a accepté l'événement**, mais pas qu'il apparaît déjà dans un rapport BI. La création d'un équipement ou d'une réservation de test déclenche les événements associés; ne pas utiliser d'informations réelles.
- **Aucun déclenchement de paiement, d'achat de forfait, de suppression d'application ou de release** dans cet audit.

## BI : prudence

Le serveur `src/pages/api/bi-event.ts` utilisait déjà le proxy REST Wix. Ce changement y raccorde des points de passage UI réels, sans bloquer les opérations si la télémétrie échoue. Il ne prouve pas que Wix reçoit les événements tant que la version n'est pas testée. Ne pas envoyer `APP_FINISHED_CONFIGURATION` pour simuler un état terminé : selon la documentation Wix, cet événement active aussi le suivi de configuration pour les futures installations.

## Références officielles

- https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/dashboard/dashboard-pages/dashboard-page-extension-files-and-code
- https://dev.wix.com/docs/api-reference/app-management/bi-event/send-bi-event
- https://dev.wix.com/docs/api-reference/app-management/bi-event/sample-flows
- https://dev.wix.com/docs/build-apps/develop-your-app/api-integrations/events-and-webhooks/about-webhooks
- https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/backend/events/add-event-extensions-with-the-wix-cli
- https://dev.wix.com/docs/build-apps/launch-your-app/market-listing/add-your-media
