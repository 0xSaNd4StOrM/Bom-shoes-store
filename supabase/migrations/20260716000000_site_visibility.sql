-- Admin toggle to hide the /brands page (and its nav link) storefront-wide.
-- Same site_content key/value pattern as checkout_config/shipping.
insert into public.site_content (key, value) values
  ('site_visibility', '{ "brands_page_enabled": true }'::jsonb)
on conflict (key) do nothing;
