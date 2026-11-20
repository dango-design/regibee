-- ============================================================================
-- Barcode numbers on items and gift ideas
-- ============================================================================
-- Many store pages carry the product's barcode number: the UPC on US
-- packaging, or the EAN on European packaging. The general name for both is
-- GTIN. The same GTIN at two stores means the same product, so saving it now
-- lets Regibee later spot the same product added twice, or find it at other
-- stores. Nothing shows it yet.
--
-- What this adds:
--
-- 1. registry_items.gtin and gift_ideas.gtin. The product readers fill it in
--    when the page has one; most items will have none. It's saved as 14
--    digits, padded with zeros at the front, so a 12-digit UPC and the same
--    product's 13-digit EAN are the same text (src/lib/gtin.ts).
--
-- A barcode belongs to the link it was read from. When someone changes an
-- item's link without a new barcode, the server actions clear it.
--
-- It only adds columns, and the existing access rules cover them. Run it
-- before deploying the code that writes them: until it runs, saving an item
-- with a barcode fails.

begin;

alter table public.registry_items
  add column gtin text check (gtin ~ '^[0-9]{14}$');

alter table public.gift_ideas
  add column gtin text check (gtin ~ '^[0-9]{14}$');

commit;
