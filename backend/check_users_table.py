import sqlite3

con = sqlite3.connect("app.db")
cur = con.cursor()

cur.execute("SELECT COUNT(*) FROM users")
count = cur.fetchone()[0]
print(f"Row count in users table: {count}")

print("\nSchema:")
cur.execute("PRAGMA table_info(users)")
for col in cur.fetchall():
    print(col)

print("\nRows:")
for row in cur.execute("SELECT * FROM users"):
    print(row)

con.close()