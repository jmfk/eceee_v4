# Kort översikt: sidversioner och användarflöden

Detta är snabbversionen av [UX-genomgången](PAGE_VERSIONING_UX_REVIEW.md). [PRD 0001](../specs/prds/0001-simplified-page-versioning.md) är kravkällan.

## Fyra begrepp

- **Arbetsversion** är sidans enda redigerbara version.
- **Live** är det oföränderliga innehåll som besökare ser.
- **Schemalagd** är arbetsversionen med ett framtida publiceringsdatum.
- **Historik** innehåller äldre, skrivskyddade versioner för granskning och återställning.

Redaktören behöver inte förstå versionsnummer. De visas bara i Historik.

## Normalprocessen

```text
Öppna sida → Redigera arbetsversion → Spara → Publicera ändringar
```

- Om sidan bara har en liveversion skapas arbetsversionen vid första sparningen.
- **Spara** uppdaterar samma arbetsversion och påverkar aldrig Live.
- **Publicera ändringar** publicerar exakt den arbetsversion som visas.
- Om någon annan hunnit spara stoppas en inaktuell sparning i stället för att skriva över deras arbete.

## Lägen som visas i Pages

- Inte publicerad
- Live
- Live med opublicerade ändringar
- Schemalagd
- Live med schemalagd ändring
- Publicering avslutad

Statusikonen är bara information. Åtgärder för publicering, schema, avpublicering och historik ligger under **Publishing & history**.

## Viktiga processer

### Ändra en livesida

```text
Live → första Spara skapar arbetsversion → fortsatta sparningar uppdaterar den
     → Publicera ändringar → arbetsversionen blir Live
```

### Schemalägga

```text
Arbetsversion → Schemalägg → fortsätt redigera och spara
               → publiceras vid valt datum
```

En sida får ha högst en normal kommande schemaläggning. Äldre data med flera scheman bevaras men måste hanteras innan ett nytt schema kan skapas.

### Återställa

```text
Historik → välj äldre version → Återställ som arbetsversion
         → granska och spara → publicera separat om den ska bli Live
```

Återställning publicerar aldrig automatiskt.

### Avpublicera

Avpublicering tar sidan offline men behåller allt innehåll och all historik. Den gamla liveversionen blir inte ett redigerbart utkast.

### Flera sidor

Bulkpublicering granskar explicita arbetsversioner före körning och redovisar resultat per sida. Körningen är inte atomisk och är inte ett releasepaket.

**Publicera med undersidor** finns under Avancerat med samma varning: sidorna publiceras var för sig.

## Utanför PRD 0001

Sites, site-väljare, Packet, atomiska strukturlanseringar och valbara versionslägen per site eller struktur hör till en framtida PRD. Det nya explicita version-ID-kontraktet gör en sådan fortsättning möjlig utan att introducera paket nu.
