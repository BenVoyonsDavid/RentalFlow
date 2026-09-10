# RentalFlow — checklist bêta v1

Cette checklist couvre la première distribution privée/non listée avant soumission au Wix App Market.

## 1. Build et version

- `npm run build`
- Corriger toute erreur TypeScript/build avant de continuer.
- `npm run release`
- Utiliser une version **Major** lorsqu'une Data Collections Extension est ajoutée ou modifiée.
- Attendre jusqu'à 5 minutes après la mise à jour des collections sur le site de test.

## 2. Vérifications fonctionnelles minimales

### Équipements
- Créer un équipement.
- Modifier un équipement.
- Tester tarif journalier, hebdomadaire, mensuel et rabais longue durée.
- Désactiver/réactiver un équipement.

### Clients
- Créer un client.
- Modifier un client.
- Ouvrir la fiche client.
- Supprimer un client sans historique.
- Vérifier qu'un client ayant des réservations ne peut pas être supprimé physiquement.

### Réservations
- Créer une réservation avec un client existant.
- Créer une réservation avec un nouveau client.
- Réserver plusieurs équipements.
- Vérifier le calcul de prix.
- Tester buffer avant et buffer après.
- Vérifier qu'une réservation concurrente est refusée pendant la période bloquée.

### Documents
- Créer un devis.
- Marquer le devis envoyé puis accepté.
- Créer un contrat et le signer.
- Créer/émettre une facture.
- Tester Imprimer / Enregistrer PDF.

### Paiements
- Enregistrer un paiement.
- Enregistrer un dépôt de sécurité.
- Enregistrer un remboursement.
- Vérifier solde et dépôt détenu.

### Opérations
- Créer une inspection de départ.
- Confirmer le départ.
- Créer une inspection de retour.
- Ajouter un dommage si nécessaire.
- Confirmer le retour.
- Vérifier que la disponibilité est libérée.
- Clôturer la réservation.
- Vérifier l'historique.

### Tableau de bord
- Vérifier départs du jour.
- Vérifier retours du jour.
- Vérifier retards.
- Vérifier réservations à préparer.
- Vérifier prochaines réservations.

## 3. Bêta privée

La bêta utilise temporairement `BETA_FULL_ACCESS = true` dans `src/lib/plans.ts` afin que toutes les fonctionnalités soient testables sur une version release non listée.

Ne pas soumettre au Wix App Market avec ce mode activé.

## 4. Avant App Market

- Remplacer le mode bêta par la détection réelle du forfait via Wix App Management (`getAppInstance`, `isFree`, `packageName`).
- Configurer les plans Gratuit / Starter / Business / Pro dans le dashboard Wix.
- Tester l'achat, la mise à niveau et la rétrogradation.
- Ajouter les CTA de mise à niveau dans les fonctions verrouillées.
- Configurer le compte de versement si l'app est payante.
- Compléter la fiche App Market : icône, captures, catégorie, mots-clés, description et coordonnées.
- Publier une politique de confidentialité et des conditions d'utilisation accessibles publiquement.
- Compléter le questionnaire de sécurité/confidentialité.
- Tester Chrome, Edge et Firefox au minimum.
- Tester les erreurs réseau et les collections vides.
- Fournir un site/compte de démonstration fonctionnel pour la révision.

## 5. Éléments après bêta, avant ou juste après lancement public

- Intégration Wix Payments réelle au lieu de l'enregistrement manuel des paiements.
- Génération et stockage serveur des PDF.
- Signature électronique dessinée et preuve de signature.
- Téléversement natif des photos d'inspection au lieu d'URLs manuelles.
- Paramètres persistants pour buffers/dépôt/devise par défaut.
- Synchronisation automatique du statut physique des actifs au départ/retour.
- Rapports, QR/code-barres, automatisations et multi-emplacements.
