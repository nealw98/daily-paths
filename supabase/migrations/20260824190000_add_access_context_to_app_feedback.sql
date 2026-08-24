alter table public.app_feedback
  add column if not exists revenuecat_app_user_id text,
  add column if not exists purchase_history text[] not null default '{}',
  add column if not exists current_entitlement text;

comment on column public.app_feedback.revenuecat_app_user_id is
  'RevenueCat App User ID at the time feedback was submitted.';

comment on column public.app_feedback.purchase_history is
  'RevenueCat allPurchasedProductIdentifiers; entries may be historical or inactive.';

comment on column public.app_feedback.current_entitlement is
  'Active RevenueCat access summarized when feedback was submitted.';
