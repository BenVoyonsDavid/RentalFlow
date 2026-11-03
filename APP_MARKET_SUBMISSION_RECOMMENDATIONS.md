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
| Add a video | À fournir | Enregistrer une courte démonstration réelle. Proposition de scénario ci-dessous; ne pas présenter le vidéo comme téléversé. |
| Add some webhooks | À configurer/vérifier | Auditer les webhooks déjà définis dans le tableau de bord Wix avant d'en ajouter; ne pas créer de double handler. Voir ci-dessous. |

**Important** : ces réglages de recherche ne deviennent visibles dans le tableau de bord Wix qu'après une **nouvelle version de l'app**. Un `wix preview` n'est pas une release. Aucun `wix release` ni soumission App Market n'est déclenché par cette PR.

## Vidéo de démonstration — scénario proposé (50 à 70 secondes)

- **0–8 s** : titre « RentalFlow — gérez votre entreprise de location depuis Wix » et tableau de bord.
- **8–20 s** : montrer l'ajout d'un équipement, son tarif et son statut.
- **20–34 s** : afficher le calendrier et une réservation test, sans noms ni courriels réels.
- **34–48 s** : présenter le suivi des réservations, des paiements et des soldes (ne pas prétendre qu'un paiement test a été réellement encaissé).
- **48–60 s** : afficher les paramètres et la réservation en ligne, puis conclure « RentalFlow — équipements, clients et réservations au même endroit ».

Prévoir idéalement une capture d'écran en 16:9, avec sous-titres français et anglais et un environnement rempli de données factices. Le montage et le téléversement de la vidéo dans Wix restent à faire.

## Webhooks : validation avant ajout

Wix recommande les événements d'installation, de montée de forfait et de désinstallation. Pour le CLI, préférer des **event extensions** gérées par Wix à un webhook HTTP maison :
1. Relever les événements déjà configurés dans le Wix App Dashboard (il ne peut y avoir deux extensions pour un même événement, y compris celles créées dans Wix).
2. Identifier les types d'événements exacts et SDK applicables à l'app actuelle. Éviter de supposer qu'un module SDK expose un événement particulier.
3. Ajouter les abonnements seulement si non existants. Prévoir la tolérance aux doublons, aux arrivées désordonnées et à la reprise.
4. Tester en environnement de développement; la configuration d'un nouvel événement ne prend effet que sur les installations recevant une nouvelle version.

**Ne jamais supprimer les données d'un locataire sur simple réception d'un webhook « uninstall » sans politique de conservation explicite et mécanisme vérifié.**

## BI : prudence

Le serveur `src/pages/api/bi-event.ts` utilisait déjà le proxy REST Wix. Ce changement y raccorde des points de passage UI réels, sans bloquer les opérations si la télémétrie échoue. Il ne prouve pas que Wix reçoit les événements tant que la version n'est pas testée. Ne pas envoyer `APP_FINISHED_CONFIGURATION` pour simuler un état terminé : selon la documentation Wix, cet événement active aussi le suivi de configuration pour les futures installations.

## Références officielles

- https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/dashboard/dashboard-pages/dashboard-page-extension-files-and-code
- https://dev.wix.com/docs/api-reference/app-management/bi-event/send-bi-event
- https://dev.wix.com/docs/api-reference/app-management/bi-event/sample-flows
- https://dev.wix.com/docs/build-apps/develop-your-app/api-integrations/events-and-webhooks/about-webhooks
- https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/backend/events/add-event-extensions-with-the-wix-cli
