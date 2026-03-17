-- Add ICP qualification score and website to god_prospects
ALTER TABLE god_prospects ADD COLUMN icp_score INTEGER;
ALTER TABLE god_prospects ADD COLUMN icp_reason TEXT;
ALTER TABLE god_prospects ADD COLUMN website TEXT;
ALTER TABLE god_prospects ADD COLUMN contacted_via TEXT; -- 'email', 'form', null

CREATE INDEX idx_god_prospects_icp_score ON god_prospects (icp_score) WHERE icp_score IS NOT NULL;
CREATE INDEX idx_god_prospects_website ON god_prospects (website) WHERE website IS NOT NULL;
