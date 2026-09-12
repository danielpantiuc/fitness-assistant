ALTER TABLE rep_details
    ADD COLUMN max_pelvic_tilt     REAL,
    ADD COLUMN max_knee_valgus     REAL,
    ADD COLUMN max_heel_lift       REAL,
    ADD COLUMN bar_position_offset REAL,
    ADD COLUMN descent_time_frames INT,
    ADD COLUMN symmetry_diff       REAL;
