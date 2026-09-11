import sqlite3

con = sqlite3.connect("app.db")
cur = con.cursor()

# Check what state we're in from the previous partial run
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users_old'")
has_old = cur.fetchone() is not None

cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
has_new = cur.fetchone() is not None

print(f"users_old exists: {has_old}, users exists: {has_new}")

if has_old and has_new:
    # Previous run got as far as creating the new table and copying data,
    # but failed before dropping the old indexes / old table. Finish it.
    print("Resuming from partial migration...")
    cur.execute("DROP INDEX IF EXISTS ix_users_email")
    cur.execute("DROP INDEX IF EXISTS ix_users_id")
    cur.execute("DROP TABLE users_old")
    cur.execute("CREATE UNIQUE INDEX ix_users_email ON users (email)")
    cur.execute("CREATE INDEX ix_users_id ON users (id)")
    con.commit()
    print("done (resumed)")

elif not has_old and has_new:
    # Check if hashed_password is already nullable — if so, nothing to do
    cur.execute("PRAGMA table_info(users)")
    cols = cur.fetchall()
    hp_col = next(c for c in cols if c[1] == "hashed_password")
    is_notnull = hp_col[3]  # 1 = NOT NULL, 0 = nullable
    if is_notnull == 0:
        print("hashed_password is already nullable — nothing to do.")
    else:
        print("Running full migration...")
        cur.execute("ALTER TABLE users RENAME TO users_old")
        cur.execute("DROP INDEX IF EXISTS ix_users_email")
        cur.execute("DROP INDEX IF EXISTS ix_users_id")
        cur.execute("""
            CREATE TABLE users (
                id INTEGER NOT NULL,
                email VARCHAR NOT NULL,
                hashed_password VARCHAR,
                role VARCHAR NOT NULL,
                auth_provider VARCHAR NOT NULL,
                created_at DATETIME,
                PRIMARY KEY (id)
            )
        """)
        cur.execute("""
            INSERT INTO users (id, email, hashed_password, role, auth_provider, created_at)
            SELECT id, email, hashed_password, role, auth_provider, created_at FROM users_old
        """)
        cur.execute("CREATE UNIQUE INDEX ix_users_email ON users (email)")
        cur.execute("CREATE INDEX ix_users_id ON users (id)")
        cur.execute("DROP TABLE users_old")
        con.commit()
        print("done (full run)")

else:
    print("Unexpected state — please paste this output before proceeding.")

print("\nFinal users table:")
for row in cur.execute("SELECT id, email, hashed_password, role, auth_provider FROM users"):
    print(row)

con.close()