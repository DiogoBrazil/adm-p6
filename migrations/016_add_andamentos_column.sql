-- Migration: Add andamentos column to processos_procedimentos table
-- Description: Adds a JSON column to store progress/notes entries for each process/procedure
-- Date: 2025-01-12
-- Author: Sistema

-- Add the andamentos column to processos_procedimentos table
ALTER TABLE processos_procedimentos 
ADD COLUMN andamentos TEXT DEFAULT '[]';

-- The column will store JSON data in the following format:
-- [
--   {
--     "id": "unique_uuid",
--     "texto": "Progress description text",
--     "data": "2025-01-12 10:30:00",
--     "usuario": "User name or Sistema"
--   },
--   ...
-- ]

-- Update any existing records to have an empty array
UPDATE processos_procedimentos 
SET andamentos = '[]' 
WHERE andamentos IS NULL;

-- Example usage:
-- To add a new andamento:
-- 1. Fetch current andamentos JSON
-- 2. Parse it to array
-- 3. Add new entry at beginning (most recent first)
-- 4. Convert back to JSON
-- 5. Update the record

-- Note: This migration should be applied after all previous migrations
-- to ensure the processos_procedimentos table exists with all required columns
