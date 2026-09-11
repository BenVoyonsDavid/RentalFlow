import { t } from './index';

// Persist machine codes unchanged; localize only their presentation.
const labels: Record<string, string> = {
  AVAILABLE: 'Disponible', RESERVED: 'Réservé', CONFIRMED: 'Confirmé', RENTED: 'En location',
  RETURNED: 'Retourné', COMPLETED: 'Clôturé', CANCELLED: 'Annulé', ERROR: 'Erreur',
  MAINTENANCE: 'Entretien', INACTIVE: 'Inactif', ACTIVE: 'Actif',
  RESERVATION: 'Réservation', QUOTE: 'Devis', CONTRACT: 'Contrat', INVOICE: 'Facture',
  PAYMENT: 'Paiement', READY: 'Prêt au départ', DRAFT: 'Brouillon', SENT: 'Envoyé',
  ACCEPTED: 'Accepté', SIGNED: 'Signé', ISSUED: 'Émis', PAID: 'Payé', PENDING: 'En attente',
  FAILED: 'Échoué', REFUNDED: 'Remboursé', BOOKING_DEPOSIT: 'Dépôt de réservation',
  SECURITY_DEPOSIT: 'Dépôt de sécurité', REFUND: 'Remboursement', DEPOSIT_REFUND: 'Remboursement du dépôt',
  DAMAGE_CHARGE: 'Frais de dommages', GOOD: 'Bon', FAIR: 'Acceptable', DAMAGED: 'Endommagé',
  DEPARTURE: 'Départ', RETURN: 'Retour', CASH: 'Comptant', CARD: 'Carte', TRANSFER: 'Virement',
  WIX: 'Wix',
};
export function statusLabel(code?: string): string {
  return code ? t(labels[code] ?? code) : '—';
}
