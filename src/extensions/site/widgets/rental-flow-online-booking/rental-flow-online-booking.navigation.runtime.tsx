import RentalFlowOnlineBookingElement from './rental-flow-online-booking.runtime';
import { localizeDom, resolveLanguage } from '../../../../intl';

class NavigableRentalFlowOnlineBookingElement extends (RentalFlowOnlineBookingElement as any) {}

function installBookingStepNavigation(root: ShadowRoot): void {
  const main = root.querySelector<HTMLElement>('main');
  if (!main || main.querySelector('[data-rf-step-navigation]')) return;

  const steps = Array.from(root.querySelectorAll<HTMLElement>('.step'));
  if (steps.length < 2) return;

  const nav = root.ownerDocument.createElement('nav');
  nav.setAttribute('data-rf-step-navigation', 'true');
  nav.setAttribute('aria-label', 'Navigation de réservation');
  Object.assign(nav.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    position: 'sticky',
    top: '0',
    zIndex: '20',
    margin: '-24px -24px 24px',
    padding: '12px 24px',
    background: 'rgba(255,255,255,.97)',
    borderBottom: '1px solid #dce3ec',
    backdropFilter: 'blur(8px)',
  });

  steps.forEach((step, index) => {
    const section = step.closest<HTMLElement>('section');
    if (!section) return;

    const targetId = `rf-booking-step-${index + 1}`;
    section.id = targetId;

    const rawLabel = (step.textContent || '').replace(/^\s*\d+\s*·\s*/, '').trim();
    const button = root.ownerDocument.createElement('button');
    button.type = 'button';
    button.textContent = `${index + 1}. ${rawLabel || `Étape ${index + 1}`}`;
    button.setAttribute('aria-controls', targetId);
    Object.assign(button.style, {
      border: '1px solid #dce3ec',
      borderRadius: '999px',
      padding: '8px 12px',
      background: '#fff',
      color: '#162033',
      font: 'inherit',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    });
    button.addEventListener('click', () => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.appendChild(button);
  });

  if (nav.childElementCount >= 2) {
    main.insertBefore(nav, main.firstChild);
    localizeDom(nav, resolveLanguage('site', 'auto'));
  }
}

const Element = NavigableRentalFlowOnlineBookingElement as unknown as {
  new (): HTMLElement;
  prototype: Record<string, unknown>;
};

const originalRender = (Element.prototype as any).render;
if (typeof originalRender === 'function') {
  (Element.prototype as any).render = function navigableRender(...args: unknown[]) {
    const result = originalRender.apply(this, args);
    const root = this.shadowRoot as ShadowRoot | null;
    if (root) installBookingStepNavigation(root);
    return result;
  };
}

export default Element;
