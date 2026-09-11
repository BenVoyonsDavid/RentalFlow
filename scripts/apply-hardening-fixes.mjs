import fs from 'node:fs';

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    if (!source.includes(from)) {
      throw new Error(`Required patch pattern not found in ${path}: ${from.slice(0, 120)}`);
    }
    source = source.replace(from, to);
  }
  fs.writeFileSync(path, source);
}

patch('src/pages/api/public-booking.ts', [
  [
    "async function elevatedUpdate(collectionId: string, item: Record<string, unknown>): Promise<any> {\n  const update = auth.elevate(items.update);\n  return update(collectionId, item);\n}",
    "async function elevatedUpdate(collectionId: string, item: any): Promise<any> {\n  const update = auth.elevate(items.update);\n  return update(collectionId, item);\n}",
  ],
]);

patch('src/pages/api/reconcile-payments.ts', [
  [
    "async function elevatedUpdate(collectionId: string, item: Record<string, unknown>): Promise<any> {\n  const update = auth.elevate(items.update);\n  return update(collectionId, item);\n}",
    "async function elevatedUpdate(collectionId: string, item: any): Promise<any> {\n  const update = auth.elevate(items.update);\n  return update(collectionId, item);\n}",
  ],
]);

patch('src/extensions/dashboard/pages/customers/customers.tsx', [
  [
    "import '@wix/design-system/styles.global.css';",
    "import '@wix/design-system/styles.global.css';\nimport { getCurrentPlan, hasFeature } from '../../../../lib/plans';",
  ],
  [
    "const CustomersPage: FC = () => {\n  const [customers, setCustomers] = useState<Customer[]>([]);",
    "const CustomersPage: FC = () => {\n  const plan = getCurrentPlan();\n  const customerDiscountEnabled = hasFeature(plan, 'CUSTOMER_DISCOUNT');\n  const [customers, setCustomers] = useState<Customer[]>([]);",
  ],
  [
    "    const discountPercent = Number(form.discountPercent.replace(',', '.'));\n    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {\n      return setFormError('Le rabais client doit être entre 0 et 100 %.');\n    }",
    "    const discountPercent = customerDiscountEnabled ? Number(form.discountPercent.replace(',', '.')) : 0;\n    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {\n      return setFormError('Le rabais client doit être entre 0 et 100 %.');\n    }",
  ],
  [
    "      await items.update(CUSTOMERS, { ...customer, active: next });",
    "      await items.update(CUSTOMERS, { ...customer, active: next } as any);",
  ],
]);

patch('src/extensions/dashboard/pages/reservations/reservations-v2.tsx', [
  [
    "import '@wix/design-system/styles.global.css';\nimport { calculateRentalPrice, getBlockedRange, rangesOverlap } from '../../../../lib/rental-pricing';",
    "import '@wix/design-system/styles.global.css';\nimport { getCurrentPlan, hasFeature } from '../../../../lib/plans';\nimport { calculateRentalPrice, getBlockedRange, rangesOverlap } from '../../../../lib/rental-pricing';",
  ],
  [
    "const ReservationsV2Page: FC = () => {\n  const [view, setView] = useState<ViewMode>('MONTH');",
    "const ReservationsV2Page: FC = () => {\n  const plan = getCurrentPlan();\n  const weeklyEnabled = hasFeature(plan, 'WEEKLY_PRICING');\n  const monthlyEnabled = hasFeature(plan, 'MONTHLY_PRICING');\n  const longTermDiscountEnabled = hasFeature(plan, 'LONG_TERM_DISCOUNT');\n  const customerDiscountEnabled = hasFeature(plan, 'CUSTOMER_DISCOUNT');\n  const documentsEnabled = hasFeature(plan, 'DOCUMENTS');\n  const paymentsEnabled = hasFeature(plan, 'PAYMENTS');\n  const depositEnabledForPlan = hasFeature(plan, 'SECURITY_DEPOSIT');\n  const inspectionsEnabled = hasFeature(plan, 'INSPECTIONS');\n  const fullHistoryEnabled = hasFeature(plan, 'FULL_HISTORY');\n  const [view, setView] = useState<ViewMode>('MONTH');",
  ],
  [
    "  const activeTemplates = useMemo(() => templates.filter((template) => template.active !== false), [templates]);",
    "  const activeTemplates = useMemo(() => documentsEnabled ? templates.filter((template) => template.active !== false) : [], [documentsEnabled, templates]);",
  ],
  [
    "    const depositEnabled = settings.defaultDepositEnabled === true;",
    "    const depositEnabled = paymentsEnabled && depositEnabledForPlan && settings.defaultDepositEnabled === true;",
  ],
  [
    "return [{ asset, ...calculateRentalPrice(asset, formDates.start!, formDates.end!, { allowWeekly: true, allowMonthly: true, allowLongTermDiscount: true }) }];",
    "return [{ asset, ...calculateRentalPrice(asset, formDates.start!, formDates.end!, { allowWeekly: weeklyEnabled, allowMonthly: monthlyEnabled, allowLongTermDiscount: longTermDiscountEnabled }) }];",
  ],
  [
    "  }, [activeAssets, formDates, selectedAssetIds]);",
    "  }, [activeAssets, formDates, longTermDiscountEnabled, monthlyEnabled, selectedAssetIds, weeklyEnabled]);",
  ],
  [
    "  const discountPercent = form?.customerMode === 'EXISTING' ? selectedCustomer?.discountPercent || 0 : 0;",
    "  const discountPercent = customerDiscountEnabled && form?.customerMode === 'EXISTING' ? selectedCustomer?.discountPercent || 0 : 0;",
  ],
  [
    "  const depositPreview = form ? calculateDeposit(taxPreview.totalCents, form.paymentMode, form.depositType, numeric(form.depositValue)) : calculateDeposit(taxPreview.totalCents, 'NONE', 'PERCENT', 0);",
    "  const depositPreview = form ? calculateDeposit(taxPreview.totalCents, paymentsEnabled ? form.paymentMode : 'NONE', form.depositType, numeric(form.depositValue)) : calculateDeposit(taxPreview.totalCents, 'NONE', 'PERCENT', 0);",
  ],
  [
    "      const quoteTemplate = activeTemplates.find((template) => template._id === form.quoteTemplateId);\n      const contractTemplate = activeTemplates.find((template) => template._id === form.contractTemplateId);\n      const invoiceTemplate = activeTemplates.find((template) => template._id === form.invoiceTemplateId);",
    "      const quoteTemplate = documentsEnabled ? activeTemplates.find((template) => template._id === form.quoteTemplateId) : undefined;\n      const contractTemplate = documentsEnabled ? activeTemplates.find((template) => template._id === form.contractTemplateId) : undefined;\n      const invoiceTemplate = documentsEnabled ? activeTemplates.find((template) => template._id === form.invoiceTemplateId) : undefined;",
  ],
  [
    "        depositRequired: form.paymentMode === 'DEPOSIT', depositType: form.depositType, depositValue: numeric(form.depositValue),",
    "        depositRequired: paymentsEnabled && depositEnabledForPlan && form.paymentMode === 'DEPOSIT', depositType: form.depositType, depositValue: numeric(form.depositValue),",
  ],
  [
    "        balanceDueCents: depositPreview.balanceDueCents, paymentMode: form.paymentMode, notes: form.notes.trim(),",
    "        balanceDueCents: depositPreview.balanceDueCents, paymentMode: paymentsEnabled ? form.paymentMode : 'NONE', notes: form.notes.trim(),",
  ],
  [
    "        await items.update(RESERVATION_ITEMS, { ...item, status: 'CANCELLED' });",
    "        await items.update(RESERVATION_ITEMS, { ...item, status: 'CANCELLED' } as any);",
  ],
  [
    "  const linkedActivity = selectedReservation ? activity.filter((row) => row.reservationId === selectedReservation._id).sort((a, b) => asDate(b.eventDate || b._createdDate).getTime() - asDate(a.eventDate || a._createdDate).getTime()) : [];",
    "  const linkedActivity = fullHistoryEnabled && selectedReservation ? activity.filter((row) => row.reservationId === selectedReservation._id).sort((a, b) => asDate(b.eventDate || b._createdDate).getTime() - asDate(a.eventDate || a._createdDate).getTime()) : [];",
  ],
  [
    "  const createDocument = async (type: DocumentType) => {\n    if (!selectedReservation?._id) return;",
    "  const createDocument = async (type: DocumentType) => {\n    if (!documentsEnabled) return setError('Les documents sont disponibles à partir du plan Starter.');\n    if (!selectedReservation?._id) return;",
  ],
  [
    "  const updateDocumentStatus = async (document: RentalDocument, action: 'ACCEPT' | 'SIGN' | 'ISSUE') => {\n    if (!document._id || !selectedReservation) return;",
    "  const updateDocumentStatus = async (document: RentalDocument, action: 'ACCEPT' | 'SIGN' | 'ISSUE') => {\n    if (!documentsEnabled) return setError('Les documents sont disponibles à partir du plan Starter.');\n    if (!document._id || !selectedReservation) return;",
  ],
  [
    "      await items.update(DOCUMENTS, { ...document, ...changes });",
    "      await items.update(DOCUMENTS, { ...document, ...changes } as any);",
  ],
  [
    "  const createWixPaymentLink = async () => {\n    if (!selectedReservation?._id || liveBalance <= 0) return;",
    "  const createWixPaymentLink = async () => {\n    if (!paymentsEnabled) return setError('Les paiements Wix sont disponibles à partir du plan Starter.');\n    if (!selectedReservation?._id || liveBalance <= 0) return;",
  ],
  [
    "  const refreshWixPayment = async (payment: Payment) => {\n    if (!payment._id || !payment.wixPaymentLinkId) return;",
    "  const refreshWixPayment = async (payment: Payment) => {\n    if (!paymentsEnabled) return setError('Les paiements Wix sont disponibles à partir du plan Starter.');\n    if (!payment._id || !payment.wixPaymentLinkId) return;",
  ],
  [
    "      await items.update(PAYMENTS, { ...payment, status: paid ? 'PAID' : payment.status || 'PENDING', paymentDate: paid ? new Date() : payment.paymentDate });",
    "      await items.update(PAYMENTS, { ...payment, status: paid ? 'PAID' : payment.status || 'PENDING', paymentDate: paid ? new Date() : payment.paymentDate } as any);",
  ],
  [
    "  const saveInspection = async (event: FormEvent<HTMLFormElement>) => {\n    event.preventDefault();\n    if (!selectedReservation?._id) return;",
    "  const saveInspection = async (event: FormEvent<HTMLFormElement>) => {\n    event.preventDefault();\n    if (!inspectionsEnabled) return setError('Les inspections sont disponibles à partir du plan Business.');\n    if (!selectedReservation?._id) return;",
  ],
  [
    "    if (!hasDeparture) return setError('Une inspection de départ complétée est requise avant de confirmer le départ.');",
    "    if (inspectionsEnabled && !hasDeparture) return setError('Une inspection de départ complétée est requise avant de confirmer le départ.');",
  ],
  [
    "    if (!hasReturn) return setError('Une inspection de retour complétée est requise avant de confirmer le retour.');",
    "    if (inspectionsEnabled && !hasReturn) return setError('Une inspection de retour complétée est requise avant de confirmer le retour.');",
  ],
  [
    "    for (const item of linkedItems.filter((item) => item._id)) await items.update(RESERVATION_ITEMS, { ...item, status: 'COMPLETED' });",
    "    for (const item of linkedItems.filter((item) => item._id)) await items.update(RESERVATION_ITEMS, { ...item, status: 'COMPLETED' } as any);",
  ],
]);

patch('src/extensions/dashboard/pages/reservations/reservations.tsx', [
  [
    "calculateRentalPrice(asset, formDates.start, formDates.end, pricingOptions)",
    "calculateRentalPrice(asset, formDates.start!, formDates.end!, pricingOptions)",
  ],
  [
    "await items.update(RESERVATIONS, reservationPayload(createdReservation, { status: 'ERROR' }))",
    "await items.update(RESERVATIONS, reservationPayload(createdReservation, { status: 'ERROR' }) as any)",
  ],
]);

console.log('RentalFlow hardening source fixes applied.');
