export const HELP_LANGUAGES = [
    { code: 'sv', label: 'Svenska' },
    { code: 'en', label: 'English' }
]

const DEFAULT_HELP_UI_LANGUAGE = 'sv'

const UI_TEXT = {
    en: {
        appName: 'EASY v4 Help',
        subtitle: 'Admin how-to documentation',
        openAdmin: 'Open admin',
        helpMenu: 'Help menu',
        collapseMenu: 'Collapse help menu',
        expandMenu: 'Expand help menu',
        indexTitle: 'How-To Help',
        indexSubtitle: 'Short admin walkthroughs with written steps, focused markdown files, and MP4 help videos.',
        videoScriptNote: 'Video script note',
        languageLabel: 'Language',
        scriptEditor: 'Script editor'
    },
    sv: {
        appName: 'EASY v4 Hjälp',
        subtitle: 'Instruktioner för adminverktyget',
        openAdmin: 'Öppna admin',
        helpMenu: 'Hjälpmeny',
        collapseMenu: 'Fäll ihop hjälpmenyn',
        expandMenu: 'Visa hjälpmenyn',
        indexTitle: 'Hjälpguider',
        indexSubtitle: 'Korta genomgångar med steg, fokuserade markdown-manus och MP4-videor.',
        videoScriptNote: 'Manusanteckning för video',
        languageLabel: 'Språk',
        scriptEditor: 'Manuseditor'
    }
}

const SECTION_TRANSLATIONS = {
    sv: {
        pages: {
            title: 'Sidor',
            summary: 'Skapa, organisera, redigera och publicera sidor i sidträdet.'
        },
        widgets: {
            title: 'Widgets',
            summary: 'Lägg till, redigera, flytta, kopiera, dölj och ta bort widgets i sid- och objektredigeraren.'
        },
        objects: {
            title: 'Objekt',
            summary: 'Arbeta med återanvändbart strukturerat innehåll som artiklar, personer, event och andra objekttyper.'
        },
        media: {
            title: 'Media',
            summary: 'Ladda upp, godkänn, organisera och återanvänd mediafiler.'
        },
        tags: {
            title: 'Taggar',
            summary: 'Hantera taggar som används för att organisera sidor, objekt och media.'
        },
        settings: {
            title: 'Inställningar',
            summary: 'Konfigurera layouter, teman, widgets, datastrukturer, publicering och systembeteende.'
        }
    }
}

const GUIDE_TRANSLATIONS = {
    sv: {
        'pages-create': {
            title: 'Skapa en sida',
            summary: 'Starta en ny sida och placera den i sidträdet.',
            steps: [
                'Öppna Sidor från huvudnavigeringen.',
                'Välj åtgärden för att lägga till en vanlig sida, eller skapa en rotsida när du startar ett nytt sidträd.',
                'Fyll i sidtitel, slug, layout och innehållsdetaljer.',
                'Spara sidan som utkast och publicera den först när den är klar.'
            ],
            narration: 'Börja i Sidor, skapa en sida, fyll i de viktigaste fälten och spara den som utkast tills den är redo att publiceras.'
        },
        'pages-organize': {
            title: 'Organisera sidträdet',
            summary: 'Flytta, kopiera, importera, exportera och städa sidor.',
            steps: [
                'Använd sidträdets kontroller för att expandera området du vill arbeta med.',
                'Markera en eller flera sidor när du behöver massåtgärder.',
                'Använd klipp ut, kopiera, duplicera, publicera, avpublicera eller ta bort från åtgärderna.',
                'Uppdatera trädet efter större importer eller exporter om den senaste strukturen inte syns.'
            ]
        },
        'pages-add-venue-travel-child': {
            title: 'Lägg upp en undersida',
            summary: 'Skapa en ny undersida under rätt föräldersida.',
            steps: [
                'Öppna Sidor från huvudnavigeringen.',
                'Sök efter föräldersidan, eller expandera sidträdet tills du hittar den.',
                'Använd åtgärden för att lägga till en undersida på föräldersidans rad.',
                'Fyll i en tydlig titel och slug för den nya undersidan.',
                'Låt sidan vara opublicerad medan du lägger in och granskar innehållet.',
                'Skapa sidan och kontrollera att den ligger under rätt föräldersida.'
            ],
            narration: 'Börja på Sidor, hitta föräldersidan, använd plusknappen för undersida, fyll i titel och slug och skapa sidan som opublicerad tills innehållet är granskat.'
        },
        'widgets-edit': {
            title: 'Lägg till och redigera widgets',
            summary: 'Lägg till en widget i en slot och öppna dess inställningar.',
            steps: [
                'Öppna en sida eller ett objekt som har widget-slots.',
                'Välj plusknappen i den slot där widgeten ska placeras.',
                'Välj widgettyp från widgetbiblioteket.',
                'Använd inställningsknappen på widgetraden för att konfigurera innehåll, layout, länkar och media.',
                'Spara redigeraren när widgeten ser rätt ut.'
            ]
        },
        'widgets-navigation-papers-authors': {
            title: 'Ändra Papers till For authors i navigationen',
            summary: 'Byt namn på en navigationstab och kontrollera att länken går rätt.',
            steps: [
                'Öppna sidredigeraren för sidan som innehåller navigation-widgeten.',
                'Gå till fliken Content om den inte redan är öppen.',
                'Hitta Navbar- eller Navigation-widgeten som visar menyn på webbplatsen.',
                'Öppna widgetens inställningar.',
                'Hitta menyvalet som heter Papers.',
                'Ändra etiketten till For authors.',
                'Kontrollera att länken fortfarande går till rätt sida, till exempel innehållssidan på /pages/71/edit/content.',
                'Spara widgeten eller sidan och förhandsgranska den publika navigationen.'
            ],
            narration: 'Öppna sidredigeraren som äger navigationen, redigera menyvalet Papers, byt etikett till For authors och kontrollera att länken fortfarande pekar rätt.'
        },
        'widgets-sidebar-logos': {
            title: 'Ändra loggor i sidebar',
            summary: 'Byt ut sidebar-loggor och använd bildstorlekar som passar från början.',
            steps: [
                'Öppna sidredigeraren för sidan som innehåller sidebaren.',
                'Hitta Sidebar-widgeten, eller de Image- eller Content-widgets som ligger i sidebarens slot.',
                'Öppna inställningarna för loggan du vill byta.',
                'Välj ersättningsbilden från Media, eller ladda upp den först om den saknas.',
                'Använd konsekventa loggfiler före uppladdning: helst transparent PNG eller SVG.',
                'För en normal sidebar-logga, förbered bilden ungefär 240 px bred. Håll synlig höjd runt 80-120 px om designen inte kräver annat.',
                'För skarpa skärmar, ladda upp en källa runt 480 px bred och visa den ungefär 240 px bred i sidebaren.',
                'Spara och förhandsgranska sidan i desktop- och mobilbredd.'
            ],
            narration: 'Öppna sidredigeraren, hitta Sidebar-widgeten, byt loggbilder i sidebarens innehåll eller underwidgets och kontrollera storleken i desktop och mobil.'
        },
        'widgets-toolbar': {
            title: 'Använd widgetradens åtgärder',
            summary: 'Hantera widgets utan att lämna redigeraren.',
            steps: [
                'Använd upp- och nedknapparna för att ändra ordning på widgets i samma slot.',
                'Använd kopiera när du vill återanvända en widget på en annan plats.',
                'Använd klipp ut när du vill flytta en widget till en annan position.',
                'Använd klistra in för att lägga in kopierat eller urklippt widgetinnehåll nära aktuell rad.',
                'Använd Aktiv/Inaktiv för att dölja eller visa en widget utan att ta bort den.',
                'Ta bara bort en widget när den verkligen ska bort från sidan eller objektet.'
            ]
        },
        'widgets-slots': {
            title: 'Arbeta med slots',
            summary: 'Lägg till underwidgets i container-slots.',
            steps: [
                'Öppna en container-widget eller sektion som visar slots.',
                'Använd slotens plusknapp för att lägga till en underwidget.',
                'Håll varje slot fokuserad på sitt layoutsyfte, till exempel header, hero, sidebar eller footer.',
                'Kopiera eller klistra in hela slotinnehåll när du upprepar en struktur.',
                'Rensa en slot först när du är säker på att alla underwidgets kan tas bort.'
            ]
        },
        'objects-manage': {
            title: 'Hantera objektinnehåll',
            summary: 'Välj en objekttyp och skapa eller redigera dess innehåll.',
            steps: [
                'Öppna Objekt från huvudnavigeringen.',
                'Välj objekttypen du vill hantera.',
                'Använd skapaåtgärden för att lägga till ett nytt objekt, eller öppna ett befintligt objekt.',
                'Kontrollera publicering och version innan objektinnehållet görs live.'
            ]
        },
        'media-upload': {
            title: 'Ladda upp och hantera media',
            summary: 'Lägg till mediafiler i rätt namespace och håll biblioteket städat.',
            steps: [
                'Öppna Media från huvudnavigeringen.',
                'Välj vilket namespace du vill hantera.',
                'Ladda upp filer eller granska väntande filer beroende på arbetsflöde.',
                'Redigera metadata, taggar, godkännandestatus och referenser vid behov.'
            ]
        },
        'tags-manage': {
            title: 'Hantera innehållstaggar',
            summary: 'Skapa och underhåll taggvokabulären som används i CMS:et.',
            steps: [
                'Öppna Taggar från huvudnavigeringen.',
                'Skapa en ny tagg när innehåll behöver en ny kategori.',
                'Redigera namn, slug eller metadata för befintliga taggar.',
                'Kontrollera användning innan du tar bort eller byter namn på en tagg.'
            ]
        },
        'settings-layouts': {
            title: 'Granska layouter',
            summary: 'Inspektera sidlayouter och deras tillgängliga slots.',
            steps: [
                'Öppna Inställningar och sedan Layoutöversikt.',
                'Granska tillgängliga layouter och deras slotstruktur.',
                'Använd layoutinformationen när du väljer rätt struktur för en sida.'
            ]
        },
        'settings-themes': {
            title: 'Redigera teman',
            summary: 'Hantera färger, typografi, komponentstilar och bildstilar.',
            steps: [
                'Öppna Inställningar och sedan Teman.',
                'Välj temat du vill redigera.',
                'Uppdatera rätt temaflik och spara ändringarna.',
                'Förhandsgranska påverkade sidor innan ändringen används i produktion.'
            ]
        },
        'settings-data': {
            title: 'Hantera datastrukturer',
            summary: 'Konfigurera objekttyper, värdelistor, widgets och datakopplingar.',
            steps: [
                'Öppna rätt inställningssektion för datastrukturen.',
                'Granska vilka fält eller värden som redan används.',
                'Uppdatera strukturen försiktigt så befintligt innehåll fortsätter fungera.',
                'Testa ändringen i redigeraren innan den används brett.'
            ]
        },
        'settings-publishing': {
            title: 'Följ publicering',
            summary: 'Granska schemalagda, live och masspublicerade ändringar.',
            steps: [
                'Öppna publiceringsvyerna i Inställningar.',
                'Kontrollera live, schemalagda och väntande ändringar.',
                'Använd tidslinjen för att förstå när ändringar blir synliga.',
                'Använd massåtgärder först när urvalet är korrekt.'
            ]
        }
    }
}

const WIDGET_TITLE_TRANSLATIONS = {
    'widget-banner-widget': 'Banner-widget',
    'widget-bio-widget': 'Bio-widget',
    'widget-content-card-widget': 'Innehållskort-widget',
    'widget-content-widget': 'Innehålls-widget',
    'widget-footer-widget': 'Footer-widget',
    'widget-forms-widget': 'Formulär-widget',
    'widget-header-widget': 'Header-widget',
    'widget-headline-widget': 'Rubrik-widget',
    'widget-hero-widget': 'Hero-widget',
    'widget-image-widget': 'Bild-widget',
    'widget-navbar-widget': 'Navbar-widget',
    'widget-navigation-widget': 'Navigations-widget',
    'widget-news-detail-widget': 'Nyhetsdetalj-widget',
    'widget-news-list-widget': 'Nyhetslista-widget',
    'widget-path-debug-widget': 'Path debug-widget',
    'widget-section-widget': 'Sektions-widget',
    'widget-sidebar-top-news-widget': 'Sidebar top news-widget',
    'widget-sidebar-widget': 'Sidebar-widget',
    'widget-table-widget': 'Tabell-widget',
    'widget-three-columns-widget': 'Tre kolumner-widget',
    'widget-top-news-plug-widget': 'Top news plug-widget',
    'widget-two-columns-widget': 'Två kolumner-widget'
}

const WIDGET_SUMMARY_TRANSLATIONS = {
    'widget-banner-widget': 'Konfigurera en banner med text- och bildlayout.',
    'widget-bio-widget': 'Presentera en person med bild och biografitext.',
    'widget-content-card-widget': 'Konfigurera ett kort med rubrik, text och valfri media.',
    'widget-content-widget': 'Redigera rikt HTML-innehåll i en sidslot.',
    'widget-footer-widget': 'Konfigurera footer-innehåll och dess underliggande slot.',
    'widget-forms-widget': 'Lägg till ett schemastyrt formulär på en sida.',
    'widget-header-widget': 'Konfigurera sidans headerområde.',
    'widget-headline-widget': 'Lägg till strukturerad rubriktext i en sektion.',
    'widget-hero-widget': 'Konfigurera en tydlig hero-sektion med text och media.',
    'widget-image-widget': 'Visa en enskild bild, ett galleri, en karusell eller ett videoliknande mediaobjekt.',
    'widget-navbar-widget': 'Konfigurera en navigationsrad med primära och sekundära menyval.',
    'widget-navigation-widget': 'Konfigurera menyer, dropdowns, mobilnavigering och branding.',
    'widget-news-detail-widget': 'Visa en enskild nyhetsartikel baserat på URL-sökvägen.',
    'widget-news-list-widget': 'Visa en lista med artiklar från valda objekttyper.',
    'widget-path-debug-widget': 'Inspektera sökvägsrelaterad renderingskontext vid setup eller felsökning.',
    'widget-section-widget': 'Skapa en hopfällbar eller ankrad sektion med underinnehåll.',
    'widget-sidebar-top-news-widget': 'Visa kompakta utvalda nyheter i en sidebar.',
    'widget-sidebar-widget': 'Bygg sidebar-innehåll med underwidgets.',
    'widget-table-widget': 'Konfigurera responsiva datatabeller.',
    'widget-three-columns-widget': 'Placera underwidgets i vänster, mitten och höger kolumn.',
    'widget-top-news-plug-widget': 'Visa utvalda nyheter i ett konfigurerbart rutnät.',
    'widget-two-columns-widget': 'Placera underwidgets i vänster och höger kolumn.'
}

export const normalizeHelpLanguage = (language) => {
    const normalized = (language || DEFAULT_HELP_UI_LANGUAGE).toString().trim().toLowerCase()
    return HELP_LANGUAGES.some(candidate => candidate.code === normalized) ? normalized : DEFAULT_HELP_UI_LANGUAGE
}

export const getHelpText = (language = DEFAULT_HELP_UI_LANGUAGE) => UI_TEXT[normalizeHelpLanguage(language)]

export const localizeSection = (section, language = DEFAULT_HELP_UI_LANGUAGE) => {
    const normalized = normalizeHelpLanguage(language)
    const translatedSection = section.translations?.[normalized]
    const localized = SECTION_TRANSLATIONS[normalized]?.[section.id]

    return {
        ...section,
        title: translatedSection?.title || localized?.title || section.title,
        summary: translatedSection?.summary || localized?.summary || section.summary
    }
}

export const localizeGuide = (guide, language = DEFAULT_HELP_UI_LANGUAGE) => {
    const normalized = normalizeHelpLanguage(language)
    const translatedGuide = guide.translations?.[normalized]
    const localized = GUIDE_TRANSLATIONS[normalized]?.[guide.id]
    const widgetTitle = normalized === 'sv' ? WIDGET_TITLE_TRANSLATIONS[guide.id] : ''
    const widgetSummary = normalized === 'sv' ? WIDGET_SUMMARY_TRANSLATIONS[guide.id] : ''

    return {
        ...guide,
        ...(translatedGuide || {}),
        title: translatedGuide?.title || localized?.title || widgetTitle || guide.title,
        summary: translatedGuide?.summary || localized?.summary || widgetSummary || guide.summary,
        steps: translatedGuide?.steps || localized?.steps || guide.steps,
        narration: translatedGuide?.narration || localized?.narration || guide.narration
    }
}
