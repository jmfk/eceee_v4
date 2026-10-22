# Gemensam klassificering och obligatorisk mediataggning

## Vad förändras?

Sidor, objekt, mediefiler och mediasamlingar använder ett gemensamt taxonomisystem. En tagg är en term i en bestämd klassificeringstyp och ett bestämt namespace. Termer har stabila UUID:n och kan ha överordnad term, alternativa namn, beskrivning och status. Exempelvis kan ämnen och geografiska områden vara olika typer även när termernas namn liknar varandra.

De fem befintliga News-dimensionerna – typ, kategori, källa, ämne och nyckelord – behåller sina olika betydelser. Migreringen slår inte ihop dem till en enda lista. Befintliga äldre identiteter och kopplingar behålls för kompatibilitet och spårbarhet.

Redaktören väljer termer i taxonomiväljaren. Rättigheter avgör vem som får använda, föreslå, skapa, ändra, flytta, slå samman, arkivera och godkänna termer. Vanliga medlemmar får använda och föreslå; förvaltning kräver särskilda rättigheter. Klassificeringsrättigheter ger inte i sig rätt att redigera innehållet.

## Mediataggning är fortfarande obligatorisk

**En godkänd mediefil och en mediasamling måste ha minst en giltig taxonomiterm.** Kravet gäller enskilt godkännande, bulk, samlingsuppladdning, ZIP och import. Servern validerar kravet. Efter namespace-aktivering finns även en uppskjuten PostgreSQL-kontroll som skyddar mot att andra skrivvägar lämnar godkända medier utan klassificering.

En uppladdad fil får finnas som väntande, `pending`, innan redaktören väljer taggar. Den får inte godkännas utan godkända termer som är tillåtna för media i samma tenant och namespace. Fritext och AI-förslag räknas inte som taggning. AI-resultat sparas som förslag; de blir inte automatiskt godkända taxonomitermer.

| Situation | Beteende |
| --- | --- |
| Ny fil utan taggar | Får invänta klassificering som pending; godkännande stoppas. |
| Ny fil med godkänd och tillåten term | Kan godkännas, om användaren också har övriga rättigheter. |
| Föreslagen eller avslagen term | Uppfyller inte mediets taggkrav. |
| Arkiverad term på befintlig fil | Kopplingen bevaras och räknas som historisk klassificering. |
| Arkiverad term vid ny tilldelning | Kan inte väljas som ny tagg. |
| Borttagning av sista taggen | Stoppas; välj en ersättning i samma ändring. |
| Term från annan tenant eller namespace | Avvisas. |
| AI-genererad text | Förslag som måste granskas och motsvara en godkänd term. |

Kravet är minst en giltig term totalt. Det innebär inte att varje klassificeringstyp måste vara ifylld. Sådana ytterligare verksamhetskrav ingår inte i denna förändring.

## Samlingar och uppladdning

En ny samling skapas med taxonomitermer. Uppladdning till samlingen kopierar dess godkända termer som är tillåtna för mediefiler. Finns inga sådana termer stoppas uppladdningen. Arkiverade historiska termer följer inte med till nya filer.

Efter kopieringen är filens och samlingens tilldelningar oberoende. En senare ändring av samlingen skriver inte om alla filer. Att lägga en befintlig fil i en samling ändrar inte automatiskt filens egna taggar. ZIP-godkännande kräver också giltiga termer eller en giltigt klassificerad mål­samling.

De gamla mediataggfälten finns kvar som synkroniserade kompatibilitetskopplingar för äldre API-klienter och paket. De är inte en andra taxonomi som redaktören behöver underhålla. Ett äldre adapter-ID kan ha ett tekniskt namn när samma visningsnamn finns i olika typer; den nya väljaren använder termens riktiga namn, typ och sökväg.

## Sidor, objekt, publicering och sök

Sidors och objekts klassificering hör till respektive version. Ändring i ett utkast ändrar inte den publicerade versionen. Föreslagna termer kan användas i utkast men måste godkännas eller tas bort före publicering och schemaläggning.

Sök och listfilter kan välja en term med underordnade termer. En sammanslagen term hänvisar till sin ersättare utan att historiska kopplingar behöver raderas. Publicerade listor filtreras på den faktiskt publicerade objektversionen innan resultatantalet begränsas.

Miljööverföring tar med typ, hierarki, alternativa namn, hänvisningar och tilldelningarnas ordning. Destinationen kontrollerar sina egna rättigheter och identiteter. Namnkonflikter som inte kan mappas säkert avvisas i stället för att tyst slås samman.

## Vad händer med befintliga medier?

Migreringen kopierar befintlig klassificering och behåller källkopplingarna. Avstämningen rapporterar bland annat otaggade filer/samlingar, felaktiga tilldelningar och osynkroniserade kompatibilitetsfält. Den hittar inte på en standardtagg för att få kontrollen att bli grön.

Äldre otaggade medier måste klassificeras innan deras namespace kan aktiveras. Schemainstallation, datamigrering, avstämning och aktivering är separata steg. Nya obligatoriska databasregler börjar gälla för ett namespace först efter en uttrycklig, verifierad aktivering.

## Migrering och driftsättning

Den tekniska körordningen, stoppvillkoren och återhämtningsvägen finns i [migreringshandboken](shared-classification.md). Produktionsdriftsättning och produktionsdatamigrering kräver separata, uttryckliga ägargodkännanden enligt repositoryts regler.

Lokala tester visar funktionens beteende med testdata. Godkänd avstämning av den faktiska databasen och verifiering i staging är egna driftsättningsunderlag och får inte ersättas av testresultaten.
