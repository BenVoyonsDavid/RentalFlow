# RentalFlow — checklist bêta / App Market v1

Cette checklist couvre la validation de la première version publique de RentalFlow.

## 1. Build et version

- Exécuter `npm run typecheck`.
- Exécuter `npm run build`.
- Corriger toute erreur TypeScript/build avant de continuer.
- Exécuter `npm run release` seulement après validation fonctionnelle.
- Utiliser une version **Major** pour cette mise à jour : de nouvelles Data Collections et de nouveaux index sont ajoutés.
- Attendre jusqu'à 5 minutes après la mise à jour des collections sur le site de test.

## 2. Forfaits Wix et limites

La détection de forfait utilise maintenant Wix App Management (`getAppInstance`, `isFree`, `packageName`). Le mode `BETA_FULL_ACCESS` a été retiré.

Valider les quatre plans configurés dans Wix :

| Plan | Limite d'équipements actifs | Fonctions principales |
| --- | ---: | --- |
| Basic / Free | 5 | Réservations, clients, calendrier, tarif journalier |
| Starter | 25 | + tarif hebdomadaire, documents, paiements Wix, dépôts |
| Business | 100 | + tarif mensuel, rabais longue durée, inspections, historique avancé |
| Pro | Illimité | + inventaire illimité et futures fonctions Pro |

Tests obligatoires :
- Vérifier la détection de chacun des quatre forfaits sur une installation réelle.
- Tester une mise à niveau et une rétrogradation.
- Basic : le 6e équipement actif doit être refusé.
- Starter : le 26e équipement actif doit être refusé.
- Business : le 101e équipement actif doit être refusé.
- Pro : vérifier qu'aucune limite d'inventaire n'est appliquée.
- Vérifier qu'un équipement désactivé peut être réactivé uniquement si la limite du forfait le permet.
- Vérifier les messages de mise à niveau lorsque la limite est atteinte.

## 3. Vérifications fonctionnelles minimales

### Équipements
- Créer et modifier un équipement.
- Vérifier l'unicité du numéro d'actif.
- Tester tarif journalier, hebdomadaire, mensuel et rabais longue durée selon le forfait.
- Désactiver/réactiver un équipement.

### Clients
- Créer et modifier un client.
- Ouvrir la fiche client.
- Supprimer un client sans historique.
- Vérifier qu'un client ayant des réservations ne peut pas être supprimé physiquement.

### Réservations
- Créer une réservation avec un client existant.
- Créer une réservation avec un nouveau client.
- Réserver plusieurs équipements.
- Vérifier le calcul de prix selon le forfait installé.
- Tester buffer avant et buffer après.
- Vérifier qu'une réservation concurrente est refusée pendant la période bloquée.
- Lancer deux réservations publiques simultanées sur le même équipement et vérifier qu'une seule réussit.
- Vérifier que les verrous de réservation expirés sont récupérés et nettoyés.

### Réservation publique
- Tester une réservation Basic sans paiement en ligne immédiat.
- Tester Starter/Business/Pro avec paiement complet Wix.
- Tester le dépôt lorsque configuré.
- Vérifier qu'un tarif mensuel ou un rabais Business n'est pas utilisé sur Basic/Starter.
- Vérifier que le widget affiche correctement le mode « paiement non activé » quand le forfait ne donne pas accès aux paiements.

### Documents
- Créer un devis.
- Marquer le devis envoyé puis accepté.
- Créer un contrat et le signer.
- Créer/émettre une facture.
- Tester Imprimer / Enregistrer PDF.

### Paiements
- Créer une réservation en ligne payante et vérifier la création du Wix Payment Link.
- Effectuer un paiement réel ou de test.
- Ouvrir le tableau de bord RentalFlow et vérifier que le paiement PENDING est réconcilié en PAID.
- Vérifier la mise à jour du solde de la réservation.
- Vérifier que l'étape PAYMENT passe à READY lorsque le solde atteint zéro.
- Enregistrer un dépôt de sécurité et un remboursement manuel.

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
- Vérifier que la synchronisation Wix Payment Links ne bloque pas le chargement du tableau de bord si Wix retourne une erreur temporaire.

## 4. Français / anglais

- Tester `Automatique (langue Wix)`, `Français` et `English` dans Paramètres.
- Tester Dashboard, Calendar, Customers, Equipment, Reservations et Settings dans les deux langues.
- Tester le widget public sur un site Wix français et un site Wix anglais.
- Vérifier les formats de date et de devise dans les deux langues.
- Configurer également les noms d'extensions et textes hébergés par Wix dans App Dashboard → Translations.
- Vérifier les textes App Market en français et en anglais.

## 5. Performance, intégrité et sécurité

- Vérifier la création des nouveaux index des collections.
- Vérifier les index uniques `assetNumber`, `customerNumber`, `reservationNumber` et `paymentNumber` avec des données existantes avant la release Major.
- Confirmer qu'aucune donnée existante en double n'empêche la création d'un index unique.
- Vérifier les requêtes de disponibilité avec plus de 1 000 réservations historiques.
- Vérifier les erreurs réseau et les collections vides.
- Tester Chrome, Edge et Firefox au minimum.
- Confirmer que les endpoints publics exigent une instance Wix valide.
- Vérifier qu'une erreur de création du paiement annule la réservation et ses lignes déjà créées.

## 6. Avant soumission au Wix App Market

- Configurer exactement les plans Basic / Starter / Business / Pro dans le dashboard Wix, avec des `packageName` contenant ces noms.
- Vérifier les prix, les avantages et la table de comparaison Wix.
- Configurer le compte de versement Tipalti.
- Ajouter la permission Wix requise pour gérer les Payment Links.
- Compléter la fiche App Market : icône, captures, catégorie, mots-clés, description et coordonnées.
- Publier une politique de confidentialité et des conditions d'utilisation accessibles publiquement.
- Compléter le questionnaire de sécurité/confidentialité.
- Fournir un site/compte de démonstration fonctionnel pour la révision.
- Ne pas fusionner/publier si le workflow GitHub `Validate RentalFlow` ou les tests Wix réels échouent.

## 7. Après lancement / prochaine étape

- Ajouter un Event Extension Wix `Payment Link Payment Created` pour une synchronisation temps réel; la v1 inclut déjà une réconciliation automatique des paiements en attente au chargement du tableau de bord.
- Génération et stockage serveur des PDF.
- Signature électronique dessinée et preuve de signature.
- Téléversement natif des photos d'inspection au lieu d'URLs manuelles.
- Synchronisation automatique du statut physique des actifs au départ/retour.
- Rapports avancés et revenus par actif.
- QR / codes-barres.
- Automatisations avancées.
- Multi-emplacements.
