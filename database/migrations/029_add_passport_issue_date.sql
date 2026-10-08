-- Date de délivrance du passeport (carte "Informations Voyageurs") — voir CLAUDE.md.
ALTER TABLE travelers ADD COLUMN passport_issue_date DATE NULL COMMENT 'Date de délivrance du passeport (migration 029)' AFTER passport_number;
