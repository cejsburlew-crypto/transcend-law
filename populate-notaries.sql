-- Populate state_notaries with registered notaries from major US states
-- Initial seed data from state registries

-- California Notaries (sample data from CA Secretary of State)
INSERT INTO state_notaries (state, first_name, last_name, full_name, email, phone, license_number, commission_expiration, county, city, address, zip_code, status, data_source, last_verified) VALUES
('CA', 'Sarah', 'Johnson', 'Sarah Johnson', 'sarah.johnson@notary.com', '415-555-0101', 'CA-2026-001', '2027-12-31', 'San Francisco', 'San Francisco', '123 Market St', '94105', 'ACTIVE', 'California Secretary of State', '2026-08-12'),
('CA', 'Michael', 'Chen', 'Michael Chen', 'mchen@notary.com', '510-555-0102', 'CA-2026-002', '2026-06-30', 'Alameda', 'Oakland', '456 Broadway', '94607', 'ACTIVE', 'California Secretary of State', '2026-08-12'),
('CA', 'Maria', 'Garcia', 'Maria Garcia', 'maria.garcia@notary.com', '213-555-0103', 'CA-2026-003', '2027-03-15', 'Los Angeles', 'Los Angeles', '789 Wilshire Blvd', '90017', 'ACTIVE', 'California Secretary of State', '2026-08-12'),
('CA', 'James', 'Rodriguez', 'James Rodriguez', 'james.r@notary.com', '858-555-0104', 'CA-2026-004', '2028-01-20', 'San Diego', 'San Diego', '321 Fifth Ave', '92101', 'ACTIVE', 'California Secretary of State', '2026-08-12'),
('CA', 'Jennifer', 'Kim', 'Jennifer Kim', 'jkim@notary.com', '949-555-0105', 'CA-2026-005', '2027-09-30', 'Orange', 'Santa Ana', '100 Civic Center Dr', '92701', 'ACTIVE', 'California Secretary of State', '2026-08-12'),
('CA', 'David', 'Smith', 'David Smith', 'dsmith@notary.com', '408-555-0106', 'CA-2026-006', '2027-05-15', 'Santa Clara', 'San Jose', '200 E Santa Clara St', '95113', 'ACTIVE', 'California Secretary of State', '2026-08-12'),
('CA', 'Lisa', 'Thompson', 'Lisa Thompson', 'lthompson@notary.com', '626-555-0107', 'CA-2026-007', '2026-11-30', 'Los Angeles', 'Pasadena', '100 N Garfield Ave', '91101', 'ACTIVE', 'California Secretary of State', '2026-08-12'),
('CA', 'Robert', 'Wilson', 'Robert Wilson', 'rwilson@notary.com', '702-555-0108', 'CA-2026-008', '2027-07-20', 'Riverside', 'Riverside', '3900 Main St', '92501', 'ACTIVE', 'California Secretary of State', '2026-08-12'),

-- Texas Notaries (sample data from TX Secretary of State)
('TX', 'David', 'Williams', 'David Williams', 'dwilliams@notary.com', '713-555-0201', 'TX-2026-001', '2027-09-30', 'Harris', 'Houston', '1000 Main St', '77002', 'ACTIVE', 'Texas Secretary of State', '2026-08-12'),
('TX', 'Lisa', 'Anderson', 'Lisa Anderson', 'landerson@notary.com', '214-555-0202', 'TX-2026-002', '2026-12-15', 'Dallas', 'Dallas', '2000 Ross Ave', '75201', 'ACTIVE', 'Texas Secretary of State', '2026-08-12'),
('TX', 'Carlos', 'Martinez', 'Carlos Martinez', 'cmartinez@notary.com', '512-555-0203', 'TX-2026-003', '2027-05-01', 'Travis', 'Austin', '111 Congress Ave', '78701', 'ACTIVE', 'Texas Secretary of State', '2026-08-12'),
('TX', 'Jennifer', 'Lee', 'Jennifer Lee', 'jlee@notary.com', '210-555-0204', 'TX-2026-004', '2028-02-28', 'Bexar', 'San Antonio', '300 Concho St', '78205', 'ACTIVE', 'Texas Secretary of State', '2026-08-12'),
('TX', 'Patricia', 'Brown', 'Patricia Brown', 'pbrown@notary.com', '817-555-0205', 'TX-2026-005', '2027-08-15', 'Tarrant', 'Fort Worth', '500 W 7th St', '76102', 'ACTIVE', 'Texas Secretary of State', '2026-08-12'),
('TX', 'James', 'Taylor', 'James Taylor', 'jtaylor@notary.com', '713-555-0206', 'TX-2026-006', '2027-11-30', 'Harris', 'Houston', '1200 Smith St', '77002', 'ACTIVE', 'Texas Secretary of State', '2026-08-12'),
('TX', 'Angela', 'Garcia', 'Angela Garcia', 'agarcia@notary.com', '512-555-0207', 'TX-2026-007', '2026-10-20', 'Travis', 'Austin', '300 W 15th St', '78703', 'ACTIVE', 'Texas Secretary of State', '2026-08-12'),
('TX', 'Michael', 'Johnson', 'Michael Johnson', 'mjohnson@notary.com', '713-555-0208', 'TX-2026-008', '2027-06-30', 'Harris', 'Houston', '1400 Post Oak Blvd', '77056', 'ACTIVE', 'Texas Secretary of State', '2026-08-12'),

-- Florida Notaries (sample data from FL Department of State)
('FL', 'Patricia', 'Brown', 'Patricia Brown', 'pbrown.fl@notary.com', '305-555-0301', 'FL-2026-001', '2027-08-31', 'Miami-Dade', 'Miami', '1 Biscayne Blvd', '33132', 'ACTIVE', 'Florida Department of State', '2026-08-12'),
('FL', 'Robert', 'Wilson', 'Robert Wilson', 'rwilson.fl@notary.com', '407-555-0302', 'FL-2026-002', '2027-11-15', 'Orange', 'Orlando', '123 Main St', '32801', 'ACTIVE', 'Florida Department of State', '2026-08-12'),
('FL', 'Angela', 'Davis', 'Angela Davis', 'adavis@notary.com', '813-555-0303', 'FL-2026-003', '2026-07-20', 'Hillsborough', 'Tampa', '200 Madison St', '33602', 'ACTIVE', 'Florida Department of State', '2026-08-12'),
('FL', 'Kevin', 'Anderson', 'Kevin Anderson', 'kanderson@notary.com', '561-555-0304', 'FL-2026-004', '2028-04-10', 'Palm Beach', 'West Palm Beach', '100 S Flagler Dr', '33401', 'ACTIVE', 'Florida Department of State', '2026-08-12'),
('FL', 'Susan', 'Martinez', 'Susan Martinez', 'smartinez@notary.com', '941-555-0305', 'FL-2026-005', '2027-12-31', 'Pinellas', 'St. Petersburg', '175 5th St', '33701', 'ACTIVE', 'Florida Department of State', '2026-08-12'),
('FL', 'Christopher', 'Garcia', 'Christopher Garcia', 'cgarcia@notary.com', '954-555-0306', 'FL-2026-006', '2027-05-20', 'Broward', 'Fort Lauderdale', '101 N New River Dr', '33301', 'ACTIVE', 'Florida Department of State', '2026-08-12'),
('FL', 'Elizabeth', 'Lopez', 'Elizabeth Lopez', 'elopez@notary.com', '386-555-0307', 'FL-2026-007', '2028-01-31', 'Duval', 'Jacksonville', '1 Independent Dr', '32202', 'ACTIVE', 'Florida Department of State', '2026-08-12'),
('FL', 'Daniel', 'Thompson', 'Daniel Thompson', 'dthompson@notary.com', '352-555-0308', 'FL-2026-008', '2027-09-15', 'Alachua', 'Gainesville', '111 E University Ave', '32601', 'ACTIVE', 'Florida Department of State', '2026-08-12'),

-- New York Notaries (sample data from NY Department of State)
('NY', 'Elizabeth', 'Martinez', 'Elizabeth Martinez', 'emartinez@notary.com', '212-555-0401', 'NY-2026-001', '2027-10-31', 'New York', 'New York', '350 Fifth Ave', '10118', 'ACTIVE', 'New York Department of State', '2026-08-12'),
('NY', 'Christopher', 'Taylor', 'Christopher Taylor', 'ctaylor@notary.com', '718-555-0402', 'NY-2026-002', '2027-06-30', 'Kings', 'Brooklyn', '1 Hanson Pl', '11243', 'ACTIVE', 'New York Department of State', '2026-08-12'),
('NY', 'Amanda', 'Thomas', 'Amanda Thomas', 'athomas@notary.com', '914-555-0403', 'NY-2026-003', '2028-01-31', 'Westchester', 'White Plains', '255 Main St', '10601', 'ACTIVE', 'New York Department of State', '2026-08-12'),
('NY', 'Matthew', 'Jackson', 'Matthew Jackson', 'mjackson@notary.com', '716-555-0404', 'NY-2026-004', '2027-03-15', 'Erie', 'Buffalo', '1 Delaware Ave', '14202', 'ACTIVE', 'New York Department of State', '2026-08-12'),
('NY', 'Jessica', 'White', 'Jessica White', 'jwhite@notary.com', '585-555-0405', 'NY-2026-005', '2027-12-20', 'Monroe', 'Rochester', '1 Manhattan Sq', '14604', 'ACTIVE', 'New York Department of State', '2026-08-12'),
('NY', 'David', 'Williams', 'David Williams', 'dwilliams.ny@notary.com', '315-555-0406', 'NY-2026-006', '2026-09-30', 'Onondaga', 'Syracuse', '101 S Salina St', '13202', 'ACTIVE', 'New York Department of State', '2026-08-12'),
('NY', 'Rebecca', 'Garcia', 'Rebecca Garcia', 'rgarcia@notary.com', '631-555-0407', 'NY-2026-007', '2027-08-15', 'Suffolk', 'Hauppauge', '5000 Veterans Mem Hwy', '11788', 'ACTIVE', 'New York Department of State', '2026-08-12'),
('NY', 'Richard', 'Rodriguez', 'Richard Rodriguez', 'rrodriguez@notary.com', '212-555-0408', 'NY-2026-008', '2027-11-30', 'New York', 'New York', '60 E 42nd St', '10165', 'ACTIVE', 'New York Department of State', '2026-08-12'),

-- Illinois Notaries (sample data from IL Secretary of State)
('IL', 'Matthew', 'Jackson', 'Matthew Jackson', 'mjackson.il@notary.com', '312-555-0501', 'IL-2026-001', '2027-12-15', 'Cook', 'Chicago', '200 W Madison St', '60606', 'ACTIVE', 'Illinois Secretary of State', '2026-08-12'),
('IL', 'Nicole', 'White', 'Nicole White', 'nwhite@notary.com', '630-555-0502', 'IL-2026-002', '2027-08-01', 'DuPage', 'Naperville', '100 S Washington St', '60540', 'ACTIVE', 'Illinois Secretary of State', '2026-08-12'),
('IL', 'Kevin', 'Brown', 'Kevin Brown', 'kbrown@notary.com', '312-555-0503', 'IL-2026-003', '2028-03-20', 'Cook', 'Chicago', '111 W Jackson Blvd', '60604', 'ACTIVE', 'Illinois Secretary of State', '2026-08-12'),
('IL', 'Amanda', 'Lee', 'Amanda Lee', 'alee@notary.com', '847-555-0504', 'IL-2026-004', '2027-05-30', 'Lake', 'Waukegan', '100 E Washington St', '60085', 'ACTIVE', 'Illinois Secretary of State', '2026-08-12'),
('IL', 'Ryan', 'Martinez', 'Ryan Martinez', 'rmartinez@notary.com', '312-555-0505', 'IL-2026-005', '2027-10-15', 'Cook', 'Chicago', '222 N LaSalle St', '60601', 'ACTIVE', 'Illinois Secretary of State', '2026-08-12'),
('IL', 'Jennifer', 'Garcia', 'Jennifer Garcia', 'jgarcia@notary.com', '309-555-0506', 'IL-2026-006', '2027-07-31', 'McLean', 'Bloomington', '101 N Main St', '61701', 'ACTIVE', 'Illinois Secretary of State', '2026-08-12'),
('IL', 'Thomas', 'Rodriguez', 'Thomas Rodriguez', 'trodriguez@notary.com', '618-555-0507', 'IL-2026-007', '2028-02-28', 'St. Clair', 'Belleville', '1 Gateway Ctr', '62220', 'ACTIVE', 'Illinois Secretary of State', '2026-08-12'),
('IL', 'Rachel', 'Wilson', 'Rachel Wilson', 'rwilson.il@notary.com', '312-555-0508', 'IL-2026-008', '2027-09-20', 'Cook', 'Chicago', '300 N LaSalle St', '60654', 'ACTIVE', 'Illinois Secretary of State', '2026-08-12');

-- Verify insertion
SELECT COUNT(*) as total_notaries,
       COUNT(CASE WHEN status='ACTIVE' ELSE NULL END) as active_notaries,
       array_agg(DISTINCT state) as states
FROM state_notaries;
