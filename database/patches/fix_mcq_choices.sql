UPDATE question_versions
SET prompt = jsonb_set(prompt, '{choices}', (prompt->'choices') || '"D"'::jsonb)
WHERE type = 'MULTIPLE_CHOICE'
  AND jsonb_typeof(prompt->'choices') = 'array'
  AND jsonb_array_length(prompt->'choices') = 3;
