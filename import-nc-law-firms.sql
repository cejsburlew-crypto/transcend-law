-- TRANSCEND LAW - NORTH CAROLINA LAW FIRMS IMPORT
-- Imports 750 NC law firms into the law_firms table
-- Source: North Carolina State Bar + Public Registry + Avvo
-- Date: 2026-08-14
-- Total Records: 750 firms across all 100 NC counties

BEGIN TRANSACTION;

-- Import from CSV (adjust path as needed)
-- psql -c "COPY law_firms(...) FROM STDIN WITH (FORMAT csv, HEADER true)" < north-carolina-law-firms.csv

-- Alternatively, use this INSERT with COPY from local file:
COPY law_firms (
    external_id, name, state, state_name, city, county,
    phone, website, firm_type, practice_areas, employee_count, founded_year,
    status, data_source, collected_at
)
FROM STDIN
WITH (FORMAT csv, HEADER true, DELIMITER ',', QUOTE '"');

-- Statistics query
SELECT
    COUNT(*) as total_firms,
    COUNT(DISTINCT county) as counties,
    COUNT(DISTINCT city) as cities,
    AVG(employee_count) as avg_employees,
    MIN(founded_year) as earliest_firm,
    MAX(founded_year) as newest_firm,
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_firms
FROM law_firms
WHERE state = 'NC';

-- View NC firms by county
SELECT
    county,
    COUNT(*) as firm_count,
    AVG(employee_count) as avg_employees,
    MAX(founded_year) as newest_firm
FROM law_firms
WHERE state = 'NC'
GROUP BY county
ORDER BY firm_count DESC
LIMIT 20;

COMMIT;

-- Post-import verification
SELECT 'North Carolina law firms imported successfully' as status,
       COUNT(*) as total_records,
       'Ready for enrichment' as next_step
FROM law_firms
WHERE state = 'NC';
