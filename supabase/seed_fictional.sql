-- =============================================================================
-- XO WORLD — Fictional Seed Data for Branches & Sports
-- =============================================================================

INSERT INTO public.branches (id, name_ar, address_ar, phone) VALUES
  ('branch_gamal', 'ميامي — جمال عبد الناصر', 'شارع جمال عبد الناصر، ميامي، الإسكندرية', '01000001001'),
  ('branch_khalil', 'ميامي — خليل حمادة', 'شارع خليل حمادة، ميامي، الإسكندرية', '01000001002')
ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, address_ar = EXCLUDED.address_ar;

INSERT INTO public.sports (id, name_ar, slug, description_ar, monthly_fee_egp) VALUES
  ('sport_parkour', 'الباركور', 'parkour', 'تنمية الرشاقة والتوازن وتخطي الحواجز بأمان احترافي.', 850),
  ('sport_kickboxing', 'الكيك بوكسينج', 'kickboxing', 'لياقة قتالية عالية وتقنيات اللكم والركل والانضباط.', 800),
  ('sport_mma', 'الفنون القتالية المختلطة (MMA)', 'mma', 'تدريب شامل يجمع المهارات القتالية والأرضية واللياقة البدنية.', 950),
  ('sport_gymnastics', 'الجمباز', 'gymnastics', 'تأسيس المرونة والقوة البدنية والتحكم الحركي للناشئين.', 900),
  ('sport_taekwondo', 'التايكوندو', 'taekwondo', 'أحزمة معتمدة، ركلات دقيقة، وبناء الثقة والروح الرياضية.', 750)
ON CONFLICT (id) DO UPDATE SET name_ar = EXCLUDED.name_ar, monthly_fee_egp = EXCLUDED.monthly_fee_egp;
