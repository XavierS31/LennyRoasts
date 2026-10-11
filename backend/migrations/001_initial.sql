CREATE TABLE judge_configs (
    judge_version varchar(100) PRIMARY KEY,
    config_sha256 varchar(64) NOT NULL,
    config jsonb NOT NULL
);
CREATE TABLE field_versions (
    pool_version varchar(100) PRIMARY KEY,
    judge_version varchar(100) NOT NULL REFERENCES judge_configs,
    artifact_sha256 varchar(64) NOT NULL,
    manifest jsonb NOT NULL
);
CREATE TABLE pool_projects (
    pool_version varchar(100) NOT NULL REFERENCES field_versions,
    project_id varchar(100) NOT NULL,
    position integer NOT NULL,
    submission jsonb NOT NULL,
    meta jsonb NOT NULL,
    challenge_results jsonb NOT NULL,
    PRIMARY KEY(pool_version, project_id),
    UNIQUE(pool_version, position)
);
CREATE TABLE scores (
    pool_version varchar(100) NOT NULL REFERENCES field_versions,
    project_id varchar(100) NOT NULL,
    challenge_id varchar(100) NOT NULL,
    run integer NOT NULL CHECK(run IN (0,1,2)),
    judge_version varchar(100) NOT NULL REFERENCES judge_configs,
    score jsonb NOT NULL,
    PRIMARY KEY(pool_version, project_id, challenge_id, run),
    FOREIGN KEY(pool_version, project_id) REFERENCES pool_projects(pool_version, project_id)
);
CREATE TABLE active_field (
    slot integer PRIMARY KEY CHECK(slot=1),
    pool_version varchar(100) NOT NULL REFERENCES field_versions
);
CREATE TABLE user_projects (
    id varchar(100) PRIMARY KEY,
    session_hash varchar(64) NOT NULL,
    submission jsonb,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE INDEX ix_user_projects_session_hash ON user_projects(session_hash);
CREATE TABLE evaluation_jobs (
    id varchar(100) PRIMARY KEY REFERENCES user_projects ON DELETE CASCADE,
    session_hash varchar(64) NOT NULL,
    judge_version varchar(100) NOT NULL REFERENCES judge_configs,
    pool_version varchar(100) NOT NULL REFERENCES field_versions,
    status varchar(20) NOT NULL CHECK(status IN ('queued','running','completed','failed')),
    result jsonb,
    error jsonb,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    CHECK((status IN ('queued','running') AND result IS NULL AND error IS NULL)
       OR (status='completed' AND result IS NOT NULL AND error IS NULL)
       OR (status='failed' AND result IS NULL AND error IS NOT NULL))
);
CREATE INDEX ix_evaluation_jobs_session_hash ON evaluation_jobs(session_hash);
CREATE INDEX ix_evaluation_jobs_expires_at ON evaluation_jobs(expires_at);
CREATE FUNCTION reject_frozen_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Frozen field and judge rows are immutable; import a new version';
END;
$$;
CREATE TRIGGER immutable_judge BEFORE UPDATE OR DELETE ON judge_configs FOR EACH ROW EXECUTE FUNCTION reject_frozen_mutation();
CREATE TRIGGER immutable_field BEFORE UPDATE OR DELETE ON field_versions FOR EACH ROW EXECUTE FUNCTION reject_frozen_mutation();
CREATE TRIGGER immutable_project BEFORE UPDATE OR DELETE ON pool_projects FOR EACH ROW EXECUTE FUNCTION reject_frozen_mutation();
CREATE TRIGGER immutable_score BEFORE UPDATE OR DELETE ON scores FOR EACH ROW EXECUTE FUNCTION reject_frozen_mutation();
