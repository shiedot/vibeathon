-- Organizers are staff, not in the TravellerBux economy.
UPDATE "participants" SET "personal_bankroll" = 0 WHERE "role" = 'organizer';
