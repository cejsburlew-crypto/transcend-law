-- TRANSCEND LAW - IMPORT CALIFORNIA LAW FIRMS (750 RECORDS)
-- Data Source: California Secretary of State + State Bar Directory
-- Date: August 14, 2026

BEGIN TRANSACTION;

-- Import law firms from California CSV
-- File: california-law-firms.csv
-- Records: 750 firms across 24 California counties

\COPY law_firms (
  external_id,
  state,
  state_name,
  city,
  county,
  name,
  phone,
  website,
  firm_type,
  practice_areas,
  employee_count,
  founded_year,
  avvo_rating,
  google_rating,
  bar_registration_verified,
  status,
  data_source,
  collected_at
)
FROM '/Users/jbconsultingassociatesinc./code/transcend-ssp/california-law-firms.csv'
WITH (
  FORMAT CSV,
  HEADER TRUE,
  DELIMITER ',',
  QUOTE '"',
  ESCAPE '"',
  NULL 'NULL'
);

-- Verify import
SELECT 'Import Summary' as metric, COUNT(*) as count FROM law_firms WHERE state = 'CA'
UNION ALL
SELECT 'Unique Cities', COUNT(DISTINCT city) FROM law_firms WHERE state = 'CA'
UNION ALL
SELECT 'Unique Counties', COUNT(DISTINCT county) FROM law_firms WHERE state = 'CA'
UNION ALL
SELECT 'High-Rated (8+)', COUNT(*) FROM law_firms WHERE state = 'CA' AND avvo_rating >= 8.0
UNION ALL
SELECT 'With Website', COUNT(*) FROM law_firms WHERE state = 'CA' AND website IS NOT NULL
UNION ALL
SELECT 'With Phone', COUNT(*) FROM law_firms WHERE state = 'CA' AND phone IS NOT NULL;

-- Geographic Distribution
SELECT 'Geographic Distribution' as "Analysis";
SELECT
  county,
  COUNT(*) as firm_count,
  ROUND(AVG(avvo_rating)::numeric, 2) as avg_rating,
  MAX(founded_year) as latest_founded
FROM law_firms
WHERE state = 'CA'
GROUP BY county
ORDER BY firm_count DESC
LIMIT 15;

-- Practice Area Summary
SELECT 'Practice Area Summary' as "Analysis";
SELECT
  jsonb_array_elements_text(practice_areas) as practice_area,
  COUNT(*) as firm_count
FROM law_firms
WHERE state = 'CA'
GROUP BY practice_area
ORDER BY firm_count DESC;

-- Firm Type Distribution
SELECT 'Firm Type Distribution' as "Analysis";
SELECT
  firm_type,
  COUNT(*) as count,
  ROUND(AVG(employee_count)::numeric, 1) as avg_employees,
  ROUND(AVG(avvo_rating)::numeric, 2) as avg_rating
FROM law_firms
WHERE state = 'CA'
GROUP BY firm_type
ORDER BY count DESC;

-- Data Quality Metrics
SELECT 'Data Quality Metrics' as "Analysis";
SELECT
  COUNT(*) as total_records,
  ROUND(COUNT(CASE WHEN website IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 1) as pct_with_website,
  ROUND(COUNT(CASE WHEN phone IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 1) as pct_with_phone,
  ROUND(COUNT(CASE WHEN practice_areas IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 1) as pct_with_practice_areas,
  ROUND(COUNT(CASE WHEN avvo_rating IS NOT NULL THEN 1 END)::numeric / COUNT(*) * 100, 1) as pct_with_rating,
  ROUND(AVG(avvo_rating)::numeric, 2) as avg_avvo_rating,
  ROUND(AVG(google_rating)::numeric, 2) as avg_google_rating
FROM law_firms
WHERE state = 'CA';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_law_firms_ca_county ON law_firms(county) WHERE state = 'CA';
CREATE INDEX IF NOT EXISTS idx_law_firms_ca_city ON law_firms(city) WHERE state = 'CA';
CREATE INDEX IF NOT EXISTS idx_law_firms_ca_rating ON law_firms(avvo_rating) WHERE state = 'CA';
CREATE INDEX IF NOT EXISTS idx_law_firms_ca_practice ON law_firms USING GIN(practice_areas) WHERE state = 'CA';

COMMIT;

-- Display final confirmation
SELECT 'California law firms import COMPLETE' as status;
SELECT COUNT(*) as total_california_firms FROM law_firms WHERE state = 'CA';
