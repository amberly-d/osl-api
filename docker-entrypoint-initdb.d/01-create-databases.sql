-- Runs only when the Postgres data volume is first created.
-- The default database is created by the image; add the two used by OSL.
CREATE DATABASE osl_dev;
CREATE DATABASE osl_test;
