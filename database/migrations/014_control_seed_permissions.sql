-- Forward-only repair: the control-plane seed resets catalog tables between test runs.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON institution_major_exam_blocks TO smartpath_control;
