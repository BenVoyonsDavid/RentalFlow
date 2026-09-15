# Reservation Extras milestone

This dashboard extension is the first merchant-side integration between RentalFlow reservations and the shared Catalog.

It intentionally keeps the public booking widget unchanged until the next milestone.

Current behavior:
- select an active reservation;
- resolve compatible catalog products/add-ons/services from the rental assets;
- avoid duplicating fixed/per-reservation items;
- support quantities for per-unit and per-day items;
- snapshot catalog pricing onto reservation item lines;
- add/remove catalog lines from an existing reservation;
- recalculate subtotal, customer discount, taxable/non-taxable bases, taxes, total and balance due;
- preserve existing payment records and derive the new balance from net paid rental payments.

Legacy reservation item rows without `lineType` are treated as `RENTAL` by the shared helper.
