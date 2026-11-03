# RentalFlow — candidat consolidé de lancement Wix App Market

Date du point de contrôle : 2026-11-03  
Statut : **préparation uniquement — ne pas fusionner et ne pas publier sans décision explicite**.

## 1. Objectif et périmètre

Cette branche consolide l'ensemble des changements des PR #24 à #31 dans une seule comparaison avec `main`. Elle ne remplace pas la revue de sécurité, les essais contrôlés des paiements ni les validations dans Wix.

| PR | Évolution | État au point de contrôle |
| --- | --- | --- |
| #24 | Apparence et thème de réservation | Ouverte |
| #25 | Durcissement authentification / CORS | Brouillon |
| #26 | Parcours public de réservation | Brouillon |
| #27 | Interfaces de gestion et exploitation | Brouillon |
| #28 | Facturation et droits App Market | Brouillon |
| #29 | Validation staging Wix | Brouillon |
| #30 | Réconciliation et soldes financiers | Brouillon |
| #31 | Référencement dashboard, BI, webhooks, kit vidéo | Brouillon |

**Important** : la présence de ces changements dans une branche Github n'installe pas une version publique Wix. L'aperçu `wix preview` est distinct de `Release Version` et `Submit & Publish`.

## 2. Contrôles techniques déjà exécutés

- [x] TypeScript et suites de tests du candidat précédent, incluant domaine, réservation publique, sécurité, interface de gestion, facturation, soldes, référencement et événements : [run 41738620392](https://github.com/BenVoyonsDavid/RentalFlow/actions/runs/41738620392).
- [x] Compilation authentifiée et aperçu Wix en développement du candidat précédent : [run 41738613851](https://github.com/BenVoyonsDavid/RentalFlow/actions/runs/41738613851).
- [x] Compilations Wix antérieures des trois extensions de cycle de vie.
- [ ] CI de la présente branche consolidée et revue du diff complet face à `main`.
- [ ] Revue des permissions demandées et des éventuelles migrations de collections Wix avant publication.

## 3. Vérifications financières et d'abonnement avant tout compte réel

- [ ] Vérifier la cohérence **CAD pour les montants RentalFlow** et la devise configurée du site Wix de développement (précédemment USD). Confirmer le comportement réel des liens Wix dans un environnement de test, surtout si les méthodes de paiement proposées ont une devise différente.
- [ ] Exécuter une transaction contrôlée via l'environnement Wix approprié (ou un site de test isolé autorisé), sans facturer de client réel. Vérifier confirmation, devise, montant, remboursement, dépôt, échec et reprise.
- [ ] Vérifier les droits gratuits et des forfaits Starter, Business et Pro avec les instances réellement attribuées.
- [ ] Vérifier que le compte de versement du partenaire Wix est prêt si l'app est monétisée, selon les obligations Wix.

## 4. Recommandations App Market

Au dernier état partagé par l'utilisateur : **0 blocker, 12 recommandations**. Selon Wix, les recommandations ne sont pas des prérequis de soumission; une nouvelle revue automatisée peut toutefois produire de nouveaux blockers.

- [x] Les **9 pages** de tableau de bord ont un titre, une description et `metaData.searchable: true` dans le code.
- [ ] Vérifier que ces pages sont indexées par la recherche du dashboard Wix **après release**, pas simplement après preview.
- [x] Événements BI ajoutés au chargement du tableau de bord et aux actions primaires / personnalisées. Pas de données personnelles.
- [ ] Vérifier la **réception** des événements BI sur l'instance Wix; des tests de code seuls n'en prouvent pas la réception.
- [x] Extensions événementielles Wix ajoutées : installation, changement de forfait, désinstallation.
- [ ] Vérifier dans le [Developer Center Wix](https://manage.wix.com/account/custom-apps) qu'aucun webhook doublon n'est défini au niveau de l'application. Les API actuellement accessibles ne permettent pas de lire cette configuration.
- [ ] Vérifier la livraison des trois événements dans les logs Wix sans déclencher de désinstallation destructrice.
- [x] Plan vidéo, scripts FR/EN et sous-titres SRT préparés dans `APP_MARKET_VIDEO_PRODUCTION.md`.
- [ ] Enregistrer de vraies captures du produit sur un site de test, monter une courte vidéo promotionnelle et fournir une URL YouTube dans **App Profile > Media**.
- [ ] Contrôler les captures d'écran, descriptions, mentions légales et textes de la fiche App Market.

## 5. Séquence de lancement — bloquée tant que les portes de validation ne sont pas levées

1. Revoir cette PR consolidée face à `main`, régler tout conflit ou changement indésirable.
2. Refaire les vérifications financières et les droits d'accès sur le site de test, et contrôler la configuration des événements dans Wix.
3. Obtenir une **autorisation explicite de fusion vers main**. Fusionner seulement après validation de cette décision.
4. Obtenir une **autorisation explicite de release Wix**, puis ouvrir **Distribute > Versions / App Distribution > Release Version**. Une mise à jour majeure peut demander l'action des sites installés.
5. Vérifier la nouvelle version distribuée (recherche dashboard, droits, événements BI / webhooks, réservation, facturation) avant tout client réel.
6. Obtenir une **autorisation explicite pour `Submit & Publish`**. Wix effectue alors une revue automatisée, et l'application peut devenir accessible sur l'App Market si les conditions sont satisfaites.
7. Vérifier les résultats de la revue, les nouveaux blockers éventuels, les capacités d'installation et le suivi des premiers utilisateurs.

## 6. Repli et suivi

- Conserver le SHA du dernier `main` validé avant fusion et les identifiants de versions Wix testées.
- Prévoir la gestion d'un correctif par nouvelle version Wix, et ne pas supposer que la suppression de l'app ou une rétrogradation des droits restaure des données.
- Ne jamais écrire dans les collections d'utilisateurs, effectuer une transaction financière ou supprimer des installations pour un simple test de soumission.

## Sources Wix

- https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/submit-your-first-app-version
- https://dev.wix.com/docs/build-apps/manage-your-app/versioning/release-a-new-app-version
- https://dev.wix.com/docs/build-apps/launch-your-app/market-listing/add-your-media
- https://dev.wix.com/docs/build-apps/develop-your-app/api-integrations/events-and-webhooks/about-webhooks
