-- Migration: Add andamentos column to processos table
-- Description: Adds a JSON column to store progress/notes entries for each process/procedure
-- Date: 2024-12-08

-- Add the andamentos column to processos table
ALTER TABLE processos 
ADD COLUMN andamentos TEXT DEFAULT '[]';

-- The column will store JSON data in the following format:
-- [
--   {
--     "id": "unique_id",
--     "texto": "Progress text here",
--     "data": "2024-12-08 10:30:00",
--     "usuario": "User name"
--   },
--   ...
-- ]

-- Update existing records to have an empty array
UPDATE processos 
SET andamentos = '[]' 
WHERE andamentos IS NULL;
