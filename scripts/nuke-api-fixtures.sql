-- Delete all fixtures that do NOT come from Sportybet or manual entry
-- Sportybet fixtures start with 'sb_'
-- Manual fixtures start with 'manual_'

DELETE FROM public.predictions 
WHERE fixture_id NOT LIKE 'sb_%' AND fixture_id NOT LIKE 'manual_%';

DELETE FROM public.vip_package_fixtures 
WHERE fixture_id NOT LIKE 'sb_%' AND fixture_id NOT LIKE 'manual_%';

DELETE FROM public.fixtures 
WHERE id NOT LIKE 'sb_%' AND id NOT LIKE 'manual_%';
