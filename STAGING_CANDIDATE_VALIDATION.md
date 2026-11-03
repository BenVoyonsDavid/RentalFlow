# RentalFlow — validation d'une version candidate sur Wix

## Environnement sélectionné

- App Wix : `8ee574c2-70b9-45e9-98ed-9e8439a26e5d`
- Site : `Dev Sitex1646783860` (`7f1ec6c8-4e35-4b19-a55d-21a9009e9386`)
- Branche candidate : `test/wix-staging-candidate-validation`, créée sur la base de la phase 4 (PR #28).
- Ce workflow fait **uniquement** un build et, si autorisé, un **Wix preview**. Il n'appelle ni `wix release` ni aucune commande de publication.

## Automatisation GitHub

Le workflow `.github/workflows/wix-staging-preview.yml` lance à chaque push sur la branche candidate :

1. La validation de l'identifiant de l'application et la sélection du site Wix de développement.
2. Une tentative de build local sans session Wix pour révéler immédiatement d'éventuelles erreurs.
3. **Si le secret GitHub `WIX_API_KEY` existe**, une connexion non interactive avec `wix login --api-key`, `wix env pull`, une vérification du site sélectionné et un nouveau `npm run build`.
4. Un `wix preview`, qui transfère le build dans un aperçu Wix **sans créer de version publique**. Le lien de prévisualisation est disponible dans les journaux / l'artefact GitHub Actions.

Le workflow garde la validation des autres suites dans `.github/workflows/validate.yml`. Si `WIX_API_KEY` est absent, la prévisualisation est **bloquée**, pas validée. Un statut de workflow réussi n'est pas une preuve de succès du build Wix si les étapes d'authentification sont ignorées.

### Autorisation requise

Ajouter une clé d'API Wix valide comme secret GitHub Actions nommé `WIX_API_KEY` dans le dépôt **RentalFlow**, en suivant le processus de clés d'API du compte Wix. Ne jamais insérer la clé dans le code source, un fichier du dépôt, un billet GitHub ou ce chat. Ne pas utiliser la clé d'un environnement de production si une clé à accès limité suffit.

## Premier essai de la CI — 3 novembre 2026

- L'application et le site cible ont été reconnus par le workflow.
- Les suites de tests standard ont toutes réussi : [GitHub Actions #41718718817](https://github.com/BenVoyonsDavid/RentalFlow/actions/runs/41718718817).
- La compilation non authentifiée a échoué avec `WIX_CLIENT_INSTANCE_ID is missing`. Ce champ est géré par Wix CLI; **ne pas le fabriquer ni le renseigner manuellement** dans GitHub.
- La CI a confirmé que `WIX_API_KEY` était absent : aucun `wix login`, `wix env pull`, build authentifié ou `wix preview` n'a eu lieu.
- La porte de validation Wix est désormais explicitement en échec lorsque la clé manque; ceci permet de distinguer un simple succès des tests applicatifs d'un véritable preview vérifié.

Une fois le secret ajouté, relancer le workflow **Wix Staging Candidate Preview (No Release)** sur la branche candidate, ou utiliser l'option de réexécution du job GitHub Actions. Ne jamais copier la valeur du secret dans le chat.

## Phase 5 — reprise des paiements et soldes

La branche `fix/payment-reconciliation-phase5` vérifie :
- Que l'interface ne marque jamais un paiement Wix comme payé depuis le navigateur.
- Que le serveur vérifie l'identité du lien, sa devise et le montant reçu.
- Que le solde affiché tient compte des remboursements locatifs sans y mélanger les dépôts de garantie et les frais de dommage.
- Qu'une réservation clôturée avec solde impayé est explicitement signalée.
- Qu'un paiement confirmé `PAID` dont le solde n'a pas été mis à jour est retrouvé lors des vérifications suivantes, sans nouveau débit ni nouveau champ CMS requis.
- Qu'un second lien de paiement ne peut pas être créé lorsqu'un premier est encore en attente sur la même réservation.

**Contrôle Wix effectué le 3 novembre 2026** : le CMS du site de test ne possède pas le champ `balanceSyncPending`. La phase 5 a donc été ajustée pour fonctionner avec le schéma existant, sans migration nécessaire. La reprise passe par la lecture des paiements Wix confirmés, puis un recalcul idempotent de chaque réservation liée. Vérifier la performance sur un volume important de paiements avant la sortie publique. La reprise est déclenchée à l'ouverture du tableau de bord, pas par un webhook temps réel.

## Vérifications manuelles après la création du preview

- [ ] Confirmer le lien de prévisualisation généré par `wix preview` et la version candidate réellement chargée.
- [ ] Tester en français et en anglais le tableau de bord, les équipements, les clients et les réservations.
- [ ] Tester deux recherches/réservations simultanées du même équipement de test.
- [ ] Tester le refus d'une réservation en cas de conflit de disponibilité.
- [ ] Vérifier Basic (5 équipements), Starter (25), Business (100), Pro (illimité) avec les vrais noms de forfaits.
- [ ] Tester un Wix Payment Link dans un environnement de paiement approprié, uniquement avec une autorisation explicite pour chaque débit réel ou une méthode sandbox validée.
- [ ] Confirmer la réconciliation PENDING → PAID après réception réelle du bon montant et dans la bonne devise.
- [ ] Confirmer le comportement d'une location terminée avec un lien de paiement encore non réglé.
- [ ] Évaluer l'écart entre le paramétrage du site USD et les paramètres métiers CAD.
- [ ] Valider le rendu mobile, l'accessibilité et les extensions Wix Editor.
- [ ] Faire approuver l'ensemble avant toute release Wix ou soumission App Market.

## Résultats de lecture Wix déjà établis

Wix a confirmé que l'application RentalFlow est installée et active, que les 16 collections RentalFlow attendues existent et que les 7 index uniques critiques sont actifs. Le site dispose de Wix Pay Links. **La version exacte de l'instance installée n'a pas pu être obtenue via l'API Wix App Instance**, faute du type d'authentification requis : la version candidate n'est donc pas encore validée sur Wix.

Pour les actions encore nécessaires, suivre `APP_MARKET_RELEASE_READINESS.md`.
