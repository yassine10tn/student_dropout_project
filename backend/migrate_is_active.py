import sqlite3

con = sqlite3.connect("app.db")
cur = con.cursor()

cur.execute("ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1")
con.commit()
print("done")

for row in cur.execute("SELECT id, email, role, is_active FROM users"):
    print(row)

con.close()