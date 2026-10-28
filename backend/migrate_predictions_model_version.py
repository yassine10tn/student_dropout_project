

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
