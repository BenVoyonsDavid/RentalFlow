# RentalFlow — Phase 4 : préparation Wix App Market

Dernière revue de code : 3 novembre 2026. **Aucune publication, fusion vers main ou soumission à Wix n'est autorisée par cette checklist.** La phase 4 améliore la fiabilité et documente les contrôles à effectuer; elle ne certifie pas une application prête à encaisser des paiements réels.

## Paiements et forfaits — changements dans cette PR

- Le reçu d'un Payment Link doit contenir un montant réellement reçu au moins égal à celui du lien; le seul statut PAID ou paymentCount ne suffit plus.
- Le lien et sa devise doivent correspondre à la ligne de paiement locale lorsque Wix retourne ces données.
- On crédite au maximum le montant du lien enregistré. Une URL de paiement est validée en HTTPS avant d'être conservée par le serveur.
- Le solde de location tient compte uniquement des paiements locatifs confirmés et des remboursements locatifs; dépôts de sécurité et dommages sont suivis séparément.
- Les noms de forfait sont reconnus par mots entiers; une chaîne contenant « pro » dans un autre mot ne peut plus donner le forfait Pro.
- Les tests `npm run test:billing` s'ajoutent à GitHub Actions.

## Forfaits à vérifier avec une installation Wix de test

| Forfait | Actifs simultanés | Paiements Wix | Principales fonctions |
| --- | ---: | --- | --- |
| Basic / Free | 5 | Non | Réservations et tarif journalier |
| Starter | 25 | Oui | Tarif hebdomadaire, documents et dépôt |
| Business | 100 | Oui | Tarif mensuel, rabais, inspections |
| Pro | Illimité | Oui | Toutes les fonctions précédentes |

Ce tableau décrit le comportement du code, **pas** une configuration Wix vérifiée. Il faut confirmer le mapping des vrais `packageName`, des droits et de la facturation des abonnements via le système de facturation Wix.

## Liste de validation avant publication

- [ ] Identifier le vrai site de staging RentalFlow et y confirmer la version installée; une simple liste de sites ne suffit pas.
- [ ] Vérifier les 4 forfaits dans le tableau de bord Wix, les tarifs, l'upgrade/downgrade, le plan gratuit et les limites serveur.
- [ ] Vérifier la permission **Manage Paylinks** : les liens Wix nécessitent un site Premium avec une méthode de paiement connectée.
- [ ] Faire un checkout Wix de test : paiement intégral, dépôt, montant partiel, devise différente, paiement refusé et lien expiré.
- [ ] Vérifier PENDING → PAID, le solde et le passage PAYMENT → READY après un règlement complet.
- [ ] Vérifier séparément dépôt de sécurité, remboursement, dommage et remboursement locatif.
- [ ] Confirmer que les écritures intermédiaires en échec sont réparées par réconciliation. La synchronisation n'est actuellement ni atomique ni temps réel.
- [ ] Vérifier le déploiement des collections, index et verrous, les réservations simultanées et plus de 1 000 lignes historiques.
- [ ] Exécuter `npm run typecheck` et toutes les suites de tests, puis `npx wix env pull` et `npm run build` pour le site de staging identifié.
- [ ] Choisir Major/Minor après contrôle des nouveaux schémas, index et permissions; ne jamais utiliser par défaut l'ancienne consigne « minor » du dépôt.
- [ ] Configurer facturation Wix, compte de versement, prix exacts, fiche bilingue FR/EN, captures, icône, descriptions et support.
- [ ] Préparer politiques de confidentialité et conditions accessibles, questionnaire sécurité/confidentialité et compte de démonstration pour la revue.
- [ ] Vérifier accessibilité, responsive, compatibilité Wix Editor et Wix Studio et traduction des extensions hébergées.
- [ ] Obtenir une approbation explicite avant tout merge, release ou soumission App Market.

## Commandes locales (ne publient pas)

```bash
npm ci
npm run typecheck
npm run test:domain
npm run test:booking-design
npm run test:security
npm run test:journey
npm run test:management-ui
npm run test:billing
# Staging Wix identifié uniquement :
npx wix env pull
npm run build
```

## Références officielles Wix

- https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/app-market-guidelines
- https://dev.wix.com/docs/build-apps/launch-your-app/app-distribution/submit-your-first-app-version
- https://dev.wix.com/docs/api-reference/business-management/get-paid/payment-links/payment-links/payment-link-object?apiView=SDK

**Limite connue :** la réconciliation est déclenchée à l'ouverture du dashboard, pas par un événement temps réel. Les mises à jour d'un paiement et d'une réservation sont faites dans deux collections distinctes et ne sont pas atomiques; des échecs partiels doivent être réparés. Les valeurs monétaires testées dans cette phase utilisent 2 décimales : valider explicitement les devises concernées avant le lancement.
