---
id: ADR-0082
title: TypeScript-moduler för handel och kundgemenskap
status: accepted
date: 2026-11-19
related_prds: [PRD-0065]
supersedes: []
superseded_by: []
---

# TypeScript-moduler för handel och kundgemenskap

## Beslut

Utöka befintlig Next-publisher med tenantisolerade modul-API:er och en kundyta på `/services`. CMS använder samma React-komponent på `/settings/modules`. Detta är ECEEE:s implementation; ingen Bad Herring- eller Staravenir-konfiguration återanvänds.

En separat PostgreSQL-schemaägare installerar ett additivt `modules`-schema genom en uttrycklig migreringsoperation. Runtime får SELECT/INSERT/UPDATE endast på modultabellerna och använder transaktionslokal tenantkontext. Sammansatta nycklar och främmande nycklar hindrar korsande tenantreferenser; tvingad RLS skyddar alla modultabeller. Det befintliga läskontot för publik rendering och det begränsade formulärkontot ändras inte. Next.js uppdateras från 16.4.2 till rättade 16.4.6 eftersom två aktuella cacheläckor annars blockerar bygget. Detta är relationsdata, inte ett införande av ett nytt dokument-/eventramverk.

Befintlig allauth-session verifieras genom serveranrop till backend. CMS-administration kräver dessutom samma användare, exakt vald workspace och `tenant.admin`; kundidentitet innebär inte CMS-medlemskap. Browsermutationer kräver same-origin. Ingen egen inloggningsdatabas införs.

Varje tenant och test/live-miljö har egna Stripe-credentials och externa referenser. Stripe SDK verifierar rå webhookpayload med tidsbegränsad signatur. Händelse-ID dedupliceras i samma transaktion som köp och rättighet. Processorn hämtar aktuellt Stripe-tillstånd i stället för att försöka sortera events. Namn konverteras explicit mellan SQL:s snake_case och TypeScripts camelCase vid store-gränsen.

Produktens rättighet och varaktighet sparas på köpet. Katalogändringar ändrar inte vad tidigare kunder köpte. Prisbelopp ändras genom nya priser, inte genom omskrivning av historik. Första flödet tillåter exakt en produkt och kvantitet ett.

Engångsrättighet börjar vid köp och har fast betalningsförankrat slutdatum eller gäller tills vidare. Återbetalning, även partiell, och tvist återkallar den köprättigheten. Abonnemang får rättighet endast till slutet på en betald fakturarad. `past_due` förlänger inte betald tid; avslutade/obetalda/pausade abonnemang återkallas. Uppsägning vid periodslut lämnar betald period tillgänglig. Andra rättighetskällor påverkas inte.

Stripe är teknisk källa för fakturor och kvitton. Säkra Stripe-länkar hämtas vid behov efter ägarkontroll. Kundportalen hanterar betalningsmetoder och faktureringssjälvservice. CMS skapar portalens tenant-/miljöspecifika konfiguration genom API. Byte av abonnemangspris begränsas till samma produkt, faktureras omedelbart och använder Stripes pending update så att ändringen inväntar betalning. Återbetalning/tvist på aktuell betald abonnemangsfaktura återkallar perioden; en ny betald period kan ge åtkomst igen. Avslutad vunnen tvist kan återställa den ursprungliga rättigheten. Ursprunglig kontoregistrering, verifiering av säljare och betalningsmetodernas aktivering i Stripe ligger kvar som miljöförberedelser.

Support är kund ↔ tenantadministratör, inte den befintliga interna CMS-supporten. Forum kräver inloggning, dold moderering ger 404 för kunder och stängning bevarar historik. Meddelanden är ren text, med storleksgräns och per-kundbegränsning. Pollning var femte sekund används i stället för ytterligare realtidsinfrastruktur.

## Migrering och återhämtning

Ingen backfill eller uppdatering av befintliga affärsdata. Installation kan köras om. Kör först efter befintliga Django-tabeller; använd separat runtime-roll utan ägarskap/superuser/BYPASSRLS. Kontrollera installerat schema och aktivera moduler först när credentials och webhook finns. Vid avstängd handel fortsätter ekonomisk reconciliation och läsning av köphistorik. En misslyckad eventtransaktion återställs och Stripe kan försöka igen. Administratörer kan upprepa reconciliation. Ingen automatisk DROP eller destruktiv down-migration införs; rollback av applikationen bevarar data och moduler kan avaktiveras.

## Aktuella primärkällor

Kontrollerade 2026-11-18/19: [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [webhook-signaturer och ordning](https://docs.stripe.com/webhooks), [produkter](https://docs.stripe.com/api/products/create), [abonnemang](https://docs.stripe.com/api/subscriptions/update). Stripe SDK:s typade kontrakt används. Skatter och juridisk säljare beslutas inför aktivering för aktuell region; koden gör inget eget rättsligt antagande.
