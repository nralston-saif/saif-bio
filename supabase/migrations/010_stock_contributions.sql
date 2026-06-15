-- 010: Stock contribution details and reusable public security prices

create table bio_security_prices (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  price_date date not null,
  open_cents bigint check (open_cents >= 0),
  high_cents bigint check (high_cents >= 0),
  low_cents bigint check (low_cents >= 0),
  close_cents bigint not null check (close_cents >= 0),
  adjusted_close_cents bigint check (adjusted_close_cents >= 0),
  volume bigint check (volume >= 0),
  source text not null default 'manual',
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (symbol, price_date, source),
  constraint bio_security_prices_symbol_upper check (symbol = upper(symbol))
);

create trigger set_updated_at before update on bio_security_prices
  for each row execute function bio_set_updated_at();

create index idx_bio_security_prices_symbol_date on bio_security_prices (symbol, price_date desc);

create table bio_stock_contribution_details (
  contribution_id uuid primary key references bio_contributions (id) on delete cascade,
  security_name text not null,
  ticker_symbol text,
  cusip text,
  shares numeric(20, 6) not null check (shares > 0),
  valuation_date date not null,
  fmv_per_share_cents bigint check (fmv_per_share_cents >= 0),
  fmv_total_cents bigint not null check (fmv_total_cents >= 0),
  valuation_source text not null default 'manual'
    check (valuation_source in ('manual', 'api_estimate', 'broker_statement')),
  market_price_source text,
  brokerage_account text,
  transfer_received_date date,
  sale_date date,
  sale_gross_cents bigint check (sale_gross_cents >= 0),
  sale_fees_cents bigint check (sale_fees_cents >= 0),
  sale_net_cents bigint check (sale_net_cents >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bio_stock_contribution_ticker_upper check (
    ticker_symbol is null or ticker_symbol = upper(ticker_symbol)
  )
);

create trigger set_updated_at before update on bio_stock_contribution_details
  for each row execute function bio_set_updated_at();

create index idx_bio_stock_contribution_ticker on bio_stock_contribution_details (ticker_symbol);
create index idx_bio_stock_contribution_valuation_date on bio_stock_contribution_details (valuation_date);

alter table bio_security_prices enable row level security;
alter table bio_stock_contribution_details enable row level security;

create policy "Partners full access" on bio_security_prices
  for all using (bio_is_partner()) with check (bio_is_partner());

create policy "Partners full access" on bio_stock_contribution_details
  for all using (bio_is_partner()) with check (bio_is_partner());
