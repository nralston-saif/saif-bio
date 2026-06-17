-- 013: Allow sub-cent precision on the stock FMV per-share price.
-- The total FMV (shares × per-share) must be exact integer cents for the books,
-- but with large share counts a per-share price rounded to whole cents throws the
-- total off by dollars. Widen the per-share column so the multiplication is exact.

alter table bio_stock_contribution_details
  alter column fmv_per_share_cents type numeric(20, 6);
