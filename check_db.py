import asyncio, asyncpg, sys

async def main():
    try:
        conn = await asyncpg.connect('postgresql://postgres:postgres@localhost:5433/icfes_db')
        print("=== Tablas ===")
        tables = await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
        for t in tables:
            print(" ", t['tablename'])

        print("\n=== users (primeras 5 filas) ===")
        rows = await conn.fetch("SELECT id, email, role, is_active FROM users LIMIT 5")
        if rows:
            for r in rows:
                print(f"  {r['email']} | role={r['role']} | active={r['is_active']}")
        else:
            print("  (tabla vacía)")
        await conn.close()
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

asyncio.run(main())
