# Routine OS

Offline habit, routine, and 21-day challenge tracker.

## Run Locally

Use the XAMPP PHP binary from this project directory:

```powershell
C:\xampp\php\php.exe -S localhost:8000
```

Then open:

```text
http://localhost:8000/
```

## Data Storage

All tracker data is stored in browser `localStorage` under `routineos_unified_v1`.

Use **Backup JSON** regularly. **Restore JSON** downloads a safety backup before replacing any data.

## Project Structure

```text
index.php
assets/
  css/
  js/
components/
data/
  backups/
archive/
```

## Verify

PHP syntax:

```powershell
C:\xampp\php\php.exe -l index.php
```

JavaScript syntax:

```powershell
node --check assets/js/storage.js
node --check assets/js/theme.js
node --check assets/js/habits.js
node --check assets/js/challenge.js
node --check assets/js/analytics.js
node --check assets/js/app.js
```

Smoke test, while the PHP server is running:

```powershell
node tests/smoke.js
```
