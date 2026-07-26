-- Two new site_content config blobs, reusing the existing public-read /
-- admin-write key/value table (no new tables):
--
--   checkout_config -> which payment methods appear at checkout.
--     { "online_enabled": bool, "cash_enabled": bool }
--
--   shipping -> per-Egyptian-governorate delivery price. The client sends only
--     the chosen region `code`; create-order looks the price up here
--     (authoritative, never trusts a client-sent amount).
--     { "regions": [ { "code", "name_en", "name_ar", "price" }, ... ] }
--
-- All 27 governorates are seeded with price 0 so the checkout region dropdown
-- works immediately; the owner sets real prices in the admin. Price 0 is a
-- valid "free to here" value, so nothing is broken while prices are unset.
--
-- on conflict do nothing: never clobber values an admin already edited if this
-- migration is ever re-run.

insert into public.site_content (key, value) values
  ('checkout_config', '{ "online_enabled": true, "cash_enabled": true }'::jsonb),
  ('shipping', '{
    "regions": [
      { "code": "cairo",        "name_en": "Cairo",          "name_ar": "القاهرة",        "price": 0 },
      { "code": "giza",         "name_en": "Giza",           "name_ar": "الجيزة",         "price": 0 },
      { "code": "alexandria",   "name_en": "Alexandria",     "name_ar": "الإسكندرية",     "price": 0 },
      { "code": "qalyubia",     "name_en": "Qalyubia",       "name_ar": "القليوبية",      "price": 0 },
      { "code": "port_said",    "name_en": "Port Said",      "name_ar": "بورسعيد",        "price": 0 },
      { "code": "suez",         "name_en": "Suez",           "name_ar": "السويس",         "price": 0 },
      { "code": "dakahlia",     "name_en": "Dakahlia",       "name_ar": "الدقهلية",       "price": 0 },
      { "code": "sharqia",      "name_en": "Sharqia",        "name_ar": "الشرقية",        "price": 0 },
      { "code": "gharbia",      "name_en": "Gharbia",        "name_ar": "الغربية",        "price": 0 },
      { "code": "monufia",      "name_en": "Monufia",        "name_ar": "المنوفية",       "price": 0 },
      { "code": "beheira",      "name_en": "Beheira",        "name_ar": "البحيرة",        "price": 0 },
      { "code": "kafr_el_sheikh","name_en": "Kafr El Sheikh","name_ar": "كفر الشيخ",      "price": 0 },
      { "code": "damietta",     "name_en": "Damietta",       "name_ar": "دمياط",          "price": 0 },
      { "code": "ismailia",     "name_en": "Ismailia",       "name_ar": "الإسماعيلية",    "price": 0 },
      { "code": "fayoum",       "name_en": "Fayoum",         "name_ar": "الفيوم",         "price": 0 },
      { "code": "beni_suef",    "name_en": "Beni Suef",      "name_ar": "بني سويف",       "price": 0 },
      { "code": "minya",        "name_en": "Minya",          "name_ar": "المنيا",         "price": 0 },
      { "code": "asyut",        "name_en": "Asyut",          "name_ar": "أسيوط",          "price": 0 },
      { "code": "sohag",        "name_en": "Sohag",          "name_ar": "سوهاج",          "price": 0 },
      { "code": "qena",         "name_en": "Qena",           "name_ar": "قنا",            "price": 0 },
      { "code": "luxor",        "name_en": "Luxor",          "name_ar": "الأقصر",         "price": 0 },
      { "code": "aswan",        "name_en": "Aswan",          "name_ar": "أسوان",          "price": 0 },
      { "code": "red_sea",      "name_en": "Red Sea",        "name_ar": "البحر الأحمر",   "price": 0 },
      { "code": "new_valley",   "name_en": "New Valley",     "name_ar": "الوادي الجديد",  "price": 0 },
      { "code": "matrouh",      "name_en": "Matrouh",        "name_ar": "مطروح",          "price": 0 },
      { "code": "north_sinai",  "name_en": "North Sinai",    "name_ar": "شمال سيناء",     "price": 0 },
      { "code": "south_sinai",  "name_en": "South Sinai",    "name_ar": "جنوب سيناء",     "price": 0 }
    ]
  }'::jsonb)
on conflict (key) do nothing;
