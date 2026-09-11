import sqlite3

con = sqlite3.connect("app.db")
cur = con.cursor()

cur.execute("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'advisor' NOT NULL")
cur.execute("ALTER TABLE users ADD COLUMN auth_provider VARCHAR DEFAULT 'local' NOT NULL")

con.commit()
print("done")

# quick verification
for row in cur.execute("SELECT * FROM users"):
    print(row)

con.close()