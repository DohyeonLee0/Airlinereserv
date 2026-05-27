# MariaDB Setup

MariaDB is running on this machine at port `3306`.

If the current MariaDB administrator account uses Windows/GSSAPI authentication, create a password-based app user first:

```powershell
& "C:\Program Files\MariaDB 12.2\bin\mysql.exe" -uroot -p < db-admin-setup.sql
```

Then create `.env.local`:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ars_app
DB_PASSWORD=ars_app_password_change_me
DB_NAME=airline_reservation
```

Load schema, ICN seed data, procedures, and triggers:

```powershell
npm run db:setup
```

Verify the app connection:

```powershell
npm run db:ping
```
