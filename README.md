# OFFHOURS Scorecard V1

1. SUPABASE
Supabase > SQL Editor > New query.
Inhalt von `supabase/setup_dashboard.sql` einfügen und einmal Run drücken.

2. GITHUB
Neues LEERES Repository `OFFHOURS-scorecard` erstellen.
ZIP entpacken. Den INHALT des Ordners hochladen, nicht den Ordner selbst.
Im GitHub-Root müssen direkt liegen:
index.html
dashboard.html
css/
js/
assets/
supabase/
README.md

3. VERCEL
Add New > Project > `OFFHOURS-scorecard` importieren.
Framework Preset: Other.
Root Directory: ./
Deploy.

4. TESTEN
Nach dem Deployment:
Spieler Gruppe 1: https://DEIN-PROJEKT.vercel.app/?group=1
Gruppe 2: ?group=2
Gruppe 3: ?group=3
Gruppe 4: ?group=4
Gruppe 5: ?group=5
Dashboard: https://DEIN-PROJEKT.vercel.app/dashboard.html

5. QR-CODES
Erst nach erfolgreichem Test die 5 endgültigen URLs in QR-Codes umwandeln.

WICHTIG
Dies ist bewusst eine Testversion für euer Probe-Event. Das Dashboard liest Namen und Scores mit
dem öffentlichen Supabase-Client. Vor einem öffentlichen Event sollten wir echte Admin-
Authentifizierung und strengere RLS-Regeln einbauen.
