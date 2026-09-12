"""
Run this ONCE from backend/, with venv activated:
    python migrate_predictions_model_version.py

Adds the missing `model_version_id` column to the predictions table.
The handoff doc for this project describes this column as already having
been added via migrate_model_registry.py in an earlier session, but it
turned out to be missing from this actual app.db file — this script adds
it now. Idempotent: safe to run twice.
"""

import sqlite3

DB_PATH = "app.db"


def column_exists(cursor, table, column):
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    if column_exists(cursor, "predictions", "model_version_id"):
        print("model_version_id column already exists on predictions — nothing to do.")
    else:
        cursor.execute(
            "ALTER TABLE predictions ADD COLUMN model_version_id INTEGER "
            "REFERENCES model_versions(id)"
        )
        conn.commit()
        print("Added model_version_id column to predictions.")

    conn.close()
    print("Done. Restart the backend server now.")


if __name__ == "__main__":
    main()