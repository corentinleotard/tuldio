-- Store the actual sent email content on the prospect row
ALTER TABLE god_prospects
  ADD COLUMN sent_subject TEXT,
  ADD COLUMN sent_body_html TEXT;
