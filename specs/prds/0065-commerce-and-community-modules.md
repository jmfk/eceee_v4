---
id: PRD-0065
title: Handel och kundgemenskap som tilläggsmoduler
status: in-progress
locked: true
created: 2026-11-19
related_adrs: [ADR-0082]
---

# Handel och kundgemenskap som tilläggsmoduler

## Mål och krav

Implementera användarens utökade handelsförslag i ett eget worktree. Produkter beskriver erbjudandet; separata priser anger valuta, belopp och engångs- eller återkommande betalning. Köp och abonnemang hålls åtskilda från åtkomsträtter. En åtkomsträtt kan komma från köp, organisation eller administrativt beslut och kan ha ett slutdatum.

- Tenantadministratörer skapar och uppdaterar produkter, skapar/arkiverar priser och hanterar abonnemang från CMS. Stripe-hostad Checkout säljer en produkt per köp. Kundportalen ger betalningssjälvservice.
- Verifierade serverhändelser aktiverar åtkomst idempotent. Oordnade händelser, fel konto, tenant, miljö, signatur och obekräftade betalningar får inte ge felaktig åtkomst. Återbetalningar och tvister påverkar åtkomst enligt dokumenterad policy.
- Kund och administratör kan öppna kvitton och fakturor från betalningsleverantören.
- Separat kundsupportchatt, FAQ med utkast/publicering samt forum med moderering. Kundsupport är privat. Befintlig intern CMS-support behålls.
- Handel, support, FAQ och forum aktiveras separat per tenant. Appens befintliga identitets- och designkontrakt används.
- Ny serverlogik skrivs i TypeScript. PostgreSQL skyddar tenantägda data. Befintliga data får inte förstöras.

## Acceptans

- CMS kan hantera katalog och abonnemang utan Stripe Dashboard för dessa löpande uppgifter.
- Testköp går från produktsida till verifierad betalning och exakt en rättighet; återspelning ger ingen förlängning eller dubblett.
- Återkommande åtkomst förlängs bara för betalda perioder; kunder kan säga upp förnyelse och nå fakturor och kundportal.
- Organisationstillhörighet och manuella rättigheter respekterar giltighet och återkallelse.
- Supporttrådar läcker inte mellan kunder eller tenants. Forum kan stängas/döljas och FAQ visas först efter publicering.
- Fokuserade tester, verkliga PostgreSQL-kontroller och båda produktionsbyggena passerar. Kvarvarande miljöberoende verifiering redovisas.

## Avgränsning

Ingen varukorg, frakt eller seminariekapacitet. Stripe skapar betalningsunderlagen. Livesäljare, skatter och Stripe-konto konfigureras inför liveaktivering; ingen livebetalning eller driftsättning ingår i detta uppdrag.

## Implementation

- [ADR-0082](../adrs/active/0082-typescript-commerce-and-community.md)
- `publisher/src/modules`, `publisher/migrations`, `/services`, CMS `/settings/modules`.


## Verifiering och kvarvarande miljöarbete

- Worktree `commerce-community-modules`, gren `codex/commerce-community-modules`; bygger på `4ef443f4` utan att flytta originalcheckouts pågående ändringar.
- Publisherns pakettester: 183 passerade, tre miljöberoende SQL-tester hoppades över. Därefter passerade 34 fokuserade modulprov inklusive ytterligare checkout-/abonnemangstester.
- Frontendens modul-/navigationsprov: tio passerade. TypeScript, fokuserad lint och båda produktionsbyggena verifierade. Next.js säkerhetsuppdaterad till 16.4.6.
- PostgreSQL 17 i separat tillfällig instans: ren och upprepad installation, FORCE RLS, tenantfrämmande nycklar, organisationsrättigheter, utgångna rättigheter och eventrollback passerade. Inga befintliga applikationsdatabaser ändrades.
- CMS och kundyta granskade i Chrome med syntetiska API-svar, bred och 390px mobil vy; inga sidfel eller horisontell dokumentoverflow. Detta ersätter inte verkligt Stripe-test.
- Kvar inför aktivering: separat runtime-roll/schema, tenantens Stripe-testkonfiguration och webhook, verkligt kontobaserat betalningstest samt anslutning av den konkreta resursens skyddade nedladdningsflöde. Inga riktiga Stripe-kunder, produkter eller betalningar har skapats och ingen driftsättning har gjorts. PRD hålls därför in-progress.

Se [drift- och integrationsguide](../../docs/commerce-community-modules.md) för konfiguration, åtkomstkontrakt, betalningspolicy och återhämtning.
