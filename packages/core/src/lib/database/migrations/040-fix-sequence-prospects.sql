-- Fix prospects stuck on WhatsApp step without a valid mobile number
-- They should be completed, not active (the cron will never pick them up)
UPDATE god_prospects
SET sequence_status = 'completed',
    next_step_at = NULL,
    updated_at = now()
WHERE sequence_status = 'active'
  AND NOT (COALESCE(whatsapp_phone, phone, '') ~ '^(\+33[67]|0[67])');

-- Fix accents in the default sequence templates
UPDATE god_sequence_steps
SET body = E'Bonjour {{firstName}},\n\nJe contacte quelques {{professionPlural}} pour leur poser une question : vous faites vos devis comment aujourd''hui ? Word, Excel, papier ?\n\nJ''ai créé un outil qui permet de faire un devis en 30 sec depuis le téléphone, juste en envoyant un message ou un vocal.\n\nSi ça vous parle, votre espace est déjà prêt :\n\nCorentin'
WHERE channel = 'email'
  AND body LIKE '%cree un outil%';

UPDATE god_sequence_steps
SET body = E'Bonjour {{firstName}}, je vous ai envoyé un email il y a quelques jours.\n\nJ''ai créé un outil pour les {{professionPlural}} : devis en 30 sec depuis le téléphone, juste en envoyant un message.'
WHERE channel = 'whatsapp'
  AND body LIKE '%cree un outil%';

-- Add phone to test prospect and make it due now so we can test
UPDATE god_prospects
SET phone = '0631863377', next_step_at = now(), updated_at = now()
WHERE email = 'leotardcorentin+testmagiclink@gmail.com';
