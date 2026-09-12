ALTER TABLE analysis_results 
    DROP COLUMN IF EXISTS landmark_summary,
    DROP COLUMN IF EXISTS processing_time_ms;

ALTER TABLE rep_details 
    DROP COLUMN IF EXISTS phase,
    DROP COLUMN IF EXISTS min_knee_angle,
    DROP COLUMN IF EXISTS min_hip_angle,
    DROP COLUMN IF EXISTS max_trunk_lean,
    DROP COLUMN IF EXISTS max_pelvic_tilt,
    DROP COLUMN IF EXISTS max_knee_valgus,
    DROP COLUMN IF EXISTS max_heel_lift,
    DROP COLUMN IF EXISTS bar_position_offset,
    DROP COLUMN IF EXISTS descent_time_frames,
    DROP COLUMN IF EXISTS symmetry_diff;
