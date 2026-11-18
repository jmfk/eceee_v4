---
id: ADR-0072
title: Granska evenemang per version
status: accepted
date: 2026-11-18
related_prds: [PRD-0053]
supersedes: []
superseded_by: []
---

# Granska evenemang per version

## Beslut

Arrangörens inskick knyts till arrangören och arbetsytan. Redaktören godkänner en specifik revision genom befintligt publiceringsflöde. Den senast godkända versionen fortsätter visas under omgranskning. Redaktionens avpublicering använder befintligt flöde.

## Följder

Arrangörer får åtkomst till egna inskick. Granskning och publicering kräver redaktörsbehörighet och kontroll av aktuell revision. Notifieringar länkar till den skyddade granskningen och identifieras per inskickad revision för att undvika dubbelutskick. Inloggningsmetod och leverantör väljs vid implementation.

## Relaterade krav

- [PRD-0053](../../prds/0053-eceee-external-event-submissions.md)
