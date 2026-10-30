# Admin CRUD: ruční nasazení a lokální ověření

Tento patch je připraven na `audit-refactor`. Produkční SQL ani Netlify se při jeho vývoji nemění. Historické SQL se nepoužívá.

## Rozsah SQL k review

`supabase/manual/admin-crud.sql` je jednorázový transakční skript, nikoli automatická migrace. Spustit jej smí vlastník DB ručně až po samostatném schválení. Při existujících zapisovacích policies skript skončí chybou; neopakovat jej bez review. Před spuštěním porovnat současné policies s baseline.

- Veřejné SELECT policies CRUD tabulek zůstávají. Zápis products/carriers/services vyžaduje authenticated a vlastní admin_profiles.is_super_admin = true. Legacy hardcoded-UUID policy admin_profiles se odstraní; authenticated uvidí pouze vlastní profil a browser nebude mít žádné write oprávnění. Přímý EXISTS je nerekurzivní; žádný SECURITY DEFINER helper.
- Trigger log_price_changes se nepřepisuje. Pro jeho invoker režim dostává admin SELECT notifikací (kontrola pětisekundového intervalu) a INSERT pouze uvnitř triggeru. Přímý REST INSERT notifikace policy nepovolí. Notifikace nejsou neměnný bezpečnostní audit.
- Produkční FK notifikací zůstávají beze změny s NO ACTION. Dopravce bez cenové historie lze smazat; navázaná notifikace smazání služby i dopravce záměrně odmítne a zachová celou historii.
- Malá invoker RPC create_carrier_with_services ukládá dopravce a služby atomicky pod RLS volajícího. Selhání libovolné služby vrátí celou transakci zpět. Frontend tuto RPC vyžaduje.
- Supabase Auth a Realtime se nemění. Nové CHECK constraints jsou mimo tento patch; frontend a nová RPC validují kapacity/ceny, ale nejsou náhradou budoucích DB constraints pro přímé admin API zápisy.

## Lokální kontroly bez produkce

```sh
npm ci --ignore-scripts
npm test
npm run lint:crud
npm run build
PG_BINDIR=/opt/homebrew/opt/postgresql@17/bin npm run test:db
```

DB test vytvoří vlastní dočasný PostgreSQL cluster, poslouchá pouze na lokálním Unix socketu, ignoruje PG connection proměnné a nepřijímá databázovou URL. Po testu jej zastaví a odstraní. Používá syntetické identity/data a metadata šesti tabulek. Fixture log_price_changes odpovídá potvrzenému produkčnímu chování. Ověřuje admin CRUD, izolaci admin profilů, non-admin/anon zákazy, trigger + cooldown, zákaz přímého INSERT notifikace, oba výsledky mazání, rollback RPC a kapacity.

UI test potřebuje dva terminály a dostupný Playwright s Chromium:

```sh
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=offline-test-placeholder npm exec -- vite --host 127.0.0.1
# Druhý terminál:
npm run test:ui
```

Je-li Playwright mimo projekt, nastavte PLAYWRIGHT_MODULE na jeho absolutní cestu. CHROMIUM_PATH může ukazovat na instalovaný Chromium executable. Test nezavádí novou projektovou závislost. Na portu 5173 musí běžet výše uvedený testovací Vite server.

UI test vykresluje skutečné komponenty s mock Supabase klientem, blokuje externí HTTP a ověřuje reload nad syntetickým úložištěm, cenu až po Save, dvojklik, zamítnutý/zero-row zápis a zachování kapacity. Screenshot: /tmp/doprava-crud-ui.png. Nejde o end-to-end test produkčního Supabase/PostgREST/Auth.

## Acceptance před pozdějším nasazením

1. Admin vytvoří GLS HU se službami; nový fetch a reload vrátí stejné uložené údaje.
2. Psaní ceny samo nic neukládá. Save/Enter uloží cenu; nový fetch a reload ji potvrdí. Trigger vytvoří notifikaci podle stávajícího pětisekundového pravidla.
3. Admin smaže testovacího dopravce bez historie; návrat ID a následná nepřítomnost potvrdí výsledek. Dopravce s navázanou cenovou notifikací smazat nelze: UI zobrazí chybu a po reloadu zůstane dopravce, služba i kompletní vazba historie.
4. Běžný authenticated i anon nemohou vytvářet, měnit ani mazat žádnou ze tří tabulek. Authenticated čte jen vlastní admin profil a browser nemůže měnit is_super_admin. Ověřit také přímým API, nejen skrytím UI. Zero-row UPDATE/DELETE se nesmí považovat za úspěch.
5. Při chybě nebo nepotvrzeném readback zůstává poslední potvrzený stav a viditelná chyba. Výsledek zápisu při ztracené odpovědi může být neurčitý: nejdříve Obnovit data, neopakovat slepě INSERT.
6. Vypnout/zapnout balíky a palety, ověřit zachované kapacity a reload. Oba typy dopravy současně vypnout nelze.
7. S novým service workerem jsou /rest/v1 a /auth/v1 NetworkOnly + no-store. Aktivace odstraní historickou supabase-cache. Nový frontend pod starým workerem odmítne API do potvrzení nové verze; dokončit aktualizaci/reload. Statické assety zůstávají cachované. Starý již otevřený frontend vyžaduje aktualizaci stránky.

Až po schválení SQL a koordinovaném nasazení kompatibilního frontendu lze ověřit skutečnou Supabase integraci. Lokální testy neprokazují stav nasazení v produkci. Tento patch nic automaticky nenasazuje a neobsahuje produkční přihlašovací údaje.

## Rozšíření zvonečku: Historie změn

`supabase/manual/change-history.sql` je další jednorázový transakční skript k ručnímu nasazení vlastníkem DB po `admin-crud.sql`, `carrier-lifecycle.sql` a `price-notifications-read.sql`. Jde o stejný ruční postup jako u ostatních skriptů v této složce; projekt zde nepoužívá historii migrací Supabase CLI. Skript se nespouští automaticky ani proti vzdálenému projektu.

Stávající tabulka `price_change_notifications` dostává `event_type` s výchozí hodnotou `price_changed` a `carrier_name` pro uložený název dopravce. Dosavadní cenové záznamy, trigger, pětisekundový interval, oprávnění, Realtime i RPC pro přečtení zůstávají zachované. Nový invoker trigger zapisuje `carrier_added`, `carrier_deactivated` a `carrier_activated`; běžná editace dopravce nebo opakované nastavení stejného stavu záznam nevytváří. Historické přidání/deaktivace před nasazením se zpětně nedoplňují.

Nové události ukládají název v okamžiku změny a nepoužívají cizí klíče `carrier_id`/`service_id`. Tím zůstává možné trvale smazat dopravce bez cenové historie a jeho nové záznamy přesto zůstanou čitelné. Cenová historie nadále brání smazání příslušného dopravce i služby. Selhání při vytváření dopravce se službami vrátí zpět také nový záznam historie.

`npm run test:db` navíc ověřuje původní cenovou historii po rozšíření schématu, nové události, změny bez efektu, původní název po přejmenování/smazání, přečtení stejnou RPC, zákaz přímého zápisu, rollback a původní pravidla mazání. Skript SQL je potřeba nasadit pro vznik nových událostí; samotná aktualizace frontendu je nevytváří.
