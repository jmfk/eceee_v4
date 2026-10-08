howto-script-editor: ## Start the local video script editor (use: make howto-script-editor [FP=10100])
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-script-editor)
else
	@FP="$${FP:-$${FRONTEND_PORT:-10100}}"; \
	if [ -z "$$FP" ]; then FP="10100"; fi; \
	echo "🎬 Starting video script editor on http://localhost:$$FP$(HOWTO_SCRIPT_EDITOR_PATH)"; \
	cd frontend && VITE_GIT_COMMIT_HASH=$$(git rev-parse --short HEAD) npm run dev -- --host 0.0.0.0 --port "$$FP" --strictPort --open "$(HOWTO_SCRIPT_EDITOR_PATH)"
endif

howto-auth-prod: ## Prompt for production username/password and save auth state for help videos
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-auth-prod)
else
	@AUTH_STATE="$(HOWTO_AUTH_STATE)"; \
	case "$$AUTH_STATE" in /*) ;; *) AUTH_STATE="$(CURDIR)/$$AUTH_STATE";; esac; \
	mkdir -p "$$(dirname "$$AUTH_STATE")"; \
	npm run howto:auth -- --base-url "$(HOWTO_PROD_BASE_URL)" --storage-state "$$AUTH_STATE"
endif

howto-voices: ## List Swedish ElevenLabs voice candidates from repo-root .env
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-voices)
else
	@if [ -z "$$ELEVENLABS_API_KEY" ]; then \
		echo "❌ ELEVENLABS_API_KEY is missing. Add it to repo-root .env."; \
		exit 1; \
	fi
	npm run howto:voices -- --language "$(HOWTO_LANGUAGE)" $(HOWTO_EXTRA_FLAGS)
endif

howto-video-demo: ## Generate one narrated help video against local demo (use: make howto-video-demo MD=frontend/src/docs/how-to/pages/create-page.md)
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-demo)
else
	@if [ -z "$(GUIDE)" ] && [ -z "$(HOWTO_MD)" ]; then \
		echo "❌ GUIDE or MD is required."; \
		echo "   Example: make howto-video-demo MD=frontend/src/docs/how-to/pages/add-subpage-under-venue-travel.md"; \
		echo "   Legacy:  make howto-video-demo GUIDE=pages-create"; \
		exit 1; \
	fi
	@if [ -n "$(HOWTO_MD)" ] && [ ! -f "$(HOWTO_MD)" ]; then \
		echo "❌ Markdown file not found: $(HOWTO_MD)"; \
		exit 1; \
	fi
	@if [ -z "$$ELEVENLABS_API_KEY" ]; then \
		echo "❌ ELEVENLABS_API_KEY is missing. Add it to repo-root .env."; \
		exit 1; \
	fi
	@REQUESTED_LANGUAGE="$(HOWTO_LANGUAGE)"; \
	if [ "$(HOWTO_LANGUAGE_ORIGIN)" = "file" ] && [ -n "$(HOWTO_MD)" ]; then \
		MD_LANGUAGE=$$(awk -F: '/^language:[[:space:]]*/ { value=$$2; sub(/^[[:space:]]+/, "", value); sub(/[[:space:]]+$$/, "", value); gsub(/^["'"'"']|["'"'"']$$/, "", value); print value; exit }' "$(HOWTO_MD)"); \
		if [ -n "$$MD_LANGUAGE" ]; then REQUESTED_LANGUAGE="$$MD_LANGUAGE"; fi; \
	fi; \
	if [ "$$REQUESTED_LANGUAGE" != "en" ] && [ -n "$(filter 1 true yes,$(HOWTO_USE_SCRIPT_TRANSLATION))" ]; then \
		if [ "$(HOWTO_TRANSLATION_PROVIDER)" = "anthropic" ] && [ -z "$$ANTHROPIC_API_KEY" ]; then \
			echo "❌ ANTHROPIC_API_KEY is missing. Add it to repo-root .env for $$REQUESTED_LANGUAGE translation."; \
			exit 1; \
		fi; \
		if [ "$(HOWTO_TRANSLATION_PROVIDER)" = "openai" ] && [ -z "$$OPENAI_API_KEY" ]; then \
			echo "❌ OPENAI_API_KEY is missing. Add it to repo-root .env for $$REQUESTED_LANGUAGE translation."; \
			exit 1; \
		fi; \
	fi
	@REQUESTED_LANGUAGE="$(HOWTO_LANGUAGE)"; \
	if [ "$(HOWTO_LANGUAGE_ORIGIN)" = "file" ] && [ -n "$(HOWTO_MD)" ]; then \
		MD_LANGUAGE=$$(awk -F: '/^language:[[:space:]]*/ { value=$$2; sub(/^[[:space:]]+/, "", value); sub(/[[:space:]]+$$/, "", value); gsub(/^["'"'"']|["'"'"']$$/, "", value); print value; exit }' "$(HOWTO_MD)"); \
		if [ -n "$$MD_LANGUAGE" ]; then REQUESTED_LANGUAGE="$$MD_LANGUAGE"; fi; \
	fi; \
	VOICE_ID="$${HOWTO_VOICE_ID:-$${ELEVENLABS_VOICE_ID:-}}"; \
	case "$$REQUESTED_LANGUAGE" in \
		sv|sv-*|swe|swedish) VOICE_ID="$${VOICE_ID:-$${ELEVENLABS_VOICE_ID_SWE:-$${ELEVENLABS_VOICE_ID_SV:-}}}" ;; \
		en|en-*|eng|english) VOICE_ID="$${VOICE_ID:-$${ELEVENLABS_VOICE_ID_ENG:-$${ELEVENLABS_VOICE_ID_EN:-}}}" ;; \
	esac; \
	if [ -z "$$VOICE_ID" ]; then \
		echo "❌ Voice ID is missing for HOWTO_LANGUAGE=$$REQUESTED_LANGUAGE. Set ELEVENLABS_VOICE_ID_SWE or ELEVENLABS_VOICE_ID_ENG in repo-root .env."; \
		exit 1; \
	fi
	@REQUESTED_LANGUAGE="$(HOWTO_LANGUAGE)"; \
	if [ "$(HOWTO_LANGUAGE_ORIGIN)" = "file" ] && [ -n "$(HOWTO_MD)" ]; then \
		MD_LANGUAGE=$$(awk -F: '/^language:[[:space:]]*/ { value=$$2; sub(/^[[:space:]]+/, "", value); sub(/[[:space:]]+$$/, "", value); gsub(/^["'"'"']|["'"'"']$$/, "", value); print value; exit }' "$(HOWTO_MD)"); \
		if [ -n "$$MD_LANGUAGE" ]; then REQUESTED_LANGUAGE="$$MD_LANGUAGE"; fi; \
	fi; \
	DOCS_DIR="$(HOWTO_DOCS_DIR)"; \
	if [ -z "$$DOCS_DIR" ]; then \
		case "$$REQUESTED_LANGUAGE" in \
			en|en-*|eng|english) DOCS_DIR="$(CURDIR)/frontend/src/docs/how-to" ;; \
			*) DOCS_DIR="$(CURDIR)/frontend/src/docs/how-to-translations/$$REQUESTED_LANGUAGE" ;; \
		esac; \
	fi; \
	case "$$DOCS_DIR" in /*) ;; *) DOCS_DIR="$(CURDIR)/$$DOCS_DIR";; esac; \
	if [ ! -d "$$DOCS_DIR" ]; then \
		echo "❌ Docs folder not found for HOWTO_LANGUAGE=$$REQUESTED_LANGUAGE: $$DOCS_DIR"; \
		echo "   Create the translated markdown first, or set HOWTO_DOCS_DIR=frontend/src/docs/how-to"; \
		exit 1; \
	fi; \
	OUTPUT_DIR="$(HOWTO_DEMO_OUTPUT_DIR)"; \
	if [ "$(HOWTO_DEMO_OUTPUT_DIR_ORIGIN)" = "file" ]; then OUTPUT_DIR="$(HOWTO_DEMO_OUTPUT_BASE_DIR)/$$REQUESTED_LANGUAGE"; fi; \
	case "$$OUTPUT_DIR" in /*) ;; *) OUTPUT_DIR="$(CURDIR)/$$OUTPUT_DIR";; esac; \
	GUIDE_ID="$(GUIDE)"; \
	if [ -n "$(HOWTO_MD)" ]; then \
		GUIDE_ID=$$(awk -F: '/^id:[[:space:]]*/ { value=$$2; sub(/^[[:space:]]+/, "", value); sub(/[[:space:]]+$$/, "", value); gsub(/^["'"'"']|["'"'"']$$/, "", value); print value; exit }' "$(HOWTO_MD)"); \
		if [ -z "$$GUIDE_ID" ]; then \
			echo "❌ Could not read frontmatter id from $(HOWTO_MD)"; \
			exit 1; \
		fi; \
		echo "🎬 Generating demo video for $$GUIDE_ID from $(HOWTO_MD)"; \
	else \
		echo "🎬 Generating demo video for $$GUIDE_ID"; \
	fi; \
	echo "📚 Using $$REQUESTED_LANGUAGE markdown from $$DOCS_DIR"; \
	mkdir -p "$$OUTPUT_DIR"; \
	cd frontend && \
	npm run howto:video -- --guide "$$GUIDE_ID" --base-url "$(HOWTO_DEMO_BASE_URL)" --docs-dir "$$DOCS_DIR" --output-dir "$$OUTPUT_DIR" --public-dir "$$OUTPUT_DIR" --format mp4 --voice elevenlabs --language "$$REQUESTED_LANGUAGE" $(HOWTO_TRANSLATE_FLAGS) --sfx $(HOWTO_EXTRA_FLAGS)
endif

howto-video-demo-both: ## Generate one narrated help video against local demo in Swedish and English (use: make howto-video-demo-both MD=frontend/src/docs/how-to/pages/create-page.md)
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-demo-both)
else
	@if [ -z "$(GUIDE)" ] && [ -z "$(HOWTO_MD)" ]; then \
		echo "❌ GUIDE or MD is required."; \
		echo "   Example: make howto-video-demo-both MD=frontend/src/docs/how-to/pages/add-subpage-under-venue-travel.md"; \
		exit 1; \
	fi
	$(MAKE) howto-video-demo GUIDE="$(GUIDE)" MD="$(HOWTO_MD)" HOWTO_LANGUAGE=en HOWTO_DEMO_OUTPUT_DIR="$(HOWTO_DEMO_OUTPUT_BASE_DIR)/en"
	$(MAKE) howto-video-demo GUIDE="$(GUIDE)" MD="$(HOWTO_MD)" HOWTO_LANGUAGE=sv HOWTO_DEMO_OUTPUT_DIR="$(HOWTO_DEMO_OUTPUT_BASE_DIR)/sv"
endif

howto-video-demo-all: ## Generate all narrated help videos against local demo
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-demo-all)
else
	@if [ -z "$$ELEVENLABS_API_KEY" ]; then \
		echo "❌ ELEVENLABS_API_KEY is missing. Add it to repo-root .env."; \
		exit 1; \
	fi
	@DOCS_DIR="$(HOWTO_DOCS_DIR)"; \
	if [ -z "$$DOCS_DIR" ]; then \
		case "$(HOWTO_LANGUAGE)" in \
			en|en-*|eng|english) DOCS_DIR="$(CURDIR)/frontend/src/docs/how-to" ;; \
			*) DOCS_DIR="$(CURDIR)/frontend/src/docs/how-to-translations/$(HOWTO_LANGUAGE)" ;; \
		esac; \
	fi; \
	case "$$DOCS_DIR" in /*) ;; *) DOCS_DIR="$(CURDIR)/$$DOCS_DIR";; esac; \
	if [ ! -d "$$DOCS_DIR" ]; then \
		echo "❌ Docs folder not found for HOWTO_LANGUAGE=$(HOWTO_LANGUAGE): $$DOCS_DIR"; \
		exit 1; \
	fi; \
	OUTPUT_DIR="$(HOWTO_DEMO_OUTPUT_DIR)"; \
	case "$$OUTPUT_DIR" in /*) ;; *) OUTPUT_DIR="$(CURDIR)/$$OUTPUT_DIR";; esac; \
	mkdir -p "$$OUTPUT_DIR"; \
	cd frontend && \
	npm run howto:video:all -- --base-url "$(HOWTO_DEMO_BASE_URL)" --docs-dir "$$DOCS_DIR" --output-dir "$$OUTPUT_DIR" --public-dir "$$OUTPUT_DIR" --voice elevenlabs --language "$(HOWTO_LANGUAGE)" $(HOWTO_TRANSLATE_FLAGS) --sfx $(HOWTO_EXTRA_FLAGS)
endif

howto-video-demo-all-both: ## Generate all narrated help videos against local demo in Swedish and English
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-demo-all-both)
else
	$(MAKE) howto-video-demo-all HOWTO_LANGUAGE=en HOWTO_DEMO_OUTPUT_DIR="$(HOWTO_DEMO_OUTPUT_BASE_DIR)/en"
	$(MAKE) howto-video-demo-all HOWTO_LANGUAGE=sv HOWTO_DEMO_OUTPUT_DIR="$(HOWTO_DEMO_OUTPUT_BASE_DIR)/sv"
endif

howto-video-edit: ## Trim an existing rendered MP4 (use: make howto-video-edit VIDEO=frontend/public/howto-videos/editor-preview/sv/file.mp4 CUTS=0:10 [OUTPUT=edited.mp4])
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-edit)
else
	@if [ -z "$(HOWTO_VIDEO)" ]; then \
		echo "❌ VIDEO is required. Example: make howto-video-edit VIDEO=frontend/public/howto-videos/editor-preview/sv/pages-pages-create.mp4 CUTS=0:10"; \
		exit 1; \
	fi
	@if [ -z "$(HOWTO_VIDEO_CUTS)" ]; then \
		echo "❌ CUTS is required. Example: CUTS=0:10 or CUTS=0:10,45.5:48"; \
		exit 1; \
	fi
	@INPUT="$(HOWTO_VIDEO)"; \
	OUTPUT="$(HOWTO_VIDEO_OUTPUT)"; \
	case "$$INPUT" in /*) ;; *) INPUT="$(CURDIR)/$$INPUT";; esac; \
	if [ -n "$$OUTPUT" ]; then case "$$OUTPUT" in /*) ;; *) OUTPUT="$(CURDIR)/$$OUTPUT";; esac; fi; \
	if [ -n "$$OUTPUT" ]; then \
		cd frontend && node scripts/edit-howto-video.mjs --input "$$INPUT" --cuts "$(HOWTO_VIDEO_CUTS)" --output "$$OUTPUT"; \
	else \
		cd frontend && node scripts/edit-howto-video.mjs --input "$$INPUT" --cuts "$(HOWTO_VIDEO_CUTS)"; \
	fi
endif

howto-video-prod: ## Generate one narrated help video from production (use: make howto-video-prod GUIDE=pages-create)
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-prod)
else
	@if [ -z "$(GUIDE)" ]; then \
		echo "❌ GUIDE is required. Example: make howto-video-prod GUIDE=pages-create"; \
		exit 1; \
	fi
	@if [ -z "$$ELEVENLABS_API_KEY" ]; then \
		echo "❌ ELEVENLABS_API_KEY is missing. Add it to repo-root .env."; \
		exit 1; \
	fi
	@if [ "$(HOWTO_LANGUAGE)" != "en" ] && [ -n "$(filter 1 true yes,$(HOWTO_USE_SCRIPT_TRANSLATION))" ]; then \
		if [ "$(HOWTO_TRANSLATION_PROVIDER)" = "anthropic" ] && [ -z "$$ANTHROPIC_API_KEY" ]; then \
			echo "❌ ANTHROPIC_API_KEY is missing. Add it to repo-root .env for $(HOWTO_LANGUAGE) translation."; \
			exit 1; \
		fi; \
		if [ "$(HOWTO_TRANSLATION_PROVIDER)" = "openai" ] && [ -z "$$OPENAI_API_KEY" ]; then \
			echo "❌ OPENAI_API_KEY is missing. Add it to repo-root .env for $(HOWTO_LANGUAGE) translation."; \
			exit 1; \
		fi; \
	fi
	@VOICE_ID="$${HOWTO_VOICE_ID:-$${ELEVENLABS_VOICE_ID:-}}"; \
	case "$(HOWTO_LANGUAGE)" in \
		sv|sv-*|swe|swedish) VOICE_ID="$${VOICE_ID:-$${ELEVENLABS_VOICE_ID_SWE:-$${ELEVENLABS_VOICE_ID_SV:-}}}" ;; \
		en|en-*|eng|english) VOICE_ID="$${VOICE_ID:-$${ELEVENLABS_VOICE_ID_ENG:-$${ELEVENLABS_VOICE_ID_EN:-}}}" ;; \
	esac; \
	if [ -z "$$VOICE_ID" ]; then \
		echo "❌ Voice ID is missing for HOWTO_LANGUAGE=$(HOWTO_LANGUAGE). Set ELEVENLABS_VOICE_ID_SWE or ELEVENLABS_VOICE_ID_ENG in repo-root .env."; \
		exit 1; \
	fi
	@AUTH_STATE="$(HOWTO_AUTH_STATE)"; \
	case "$$AUTH_STATE" in /*) ;; *) AUTH_STATE="$(CURDIR)/$$AUTH_STATE";; esac; \
	if [ ! -f "$$AUTH_STATE" ]; then \
		echo "❌ Auth state not found: $$AUTH_STATE"; \
		echo "Run: make howto-auth-prod"; \
		exit 1; \
	fi; \
	DOCS_DIR="$(HOWTO_DOCS_DIR)"; \
	if [ -z "$$DOCS_DIR" ]; then \
		case "$(HOWTO_LANGUAGE)" in \
			en|en-*|eng|english) DOCS_DIR="$(CURDIR)/frontend/src/docs/how-to" ;; \
			*) DOCS_DIR="$(CURDIR)/frontend/src/docs/how-to-translations/$(HOWTO_LANGUAGE)" ;; \
		esac; \
	fi; \
	case "$$DOCS_DIR" in /*) ;; *) DOCS_DIR="$(CURDIR)/$$DOCS_DIR";; esac; \
	if [ ! -d "$$DOCS_DIR" ]; then \
		echo "❌ Docs folder not found for HOWTO_LANGUAGE=$(HOWTO_LANGUAGE): $$DOCS_DIR"; \
		exit 1; \
	fi; \
	OUTPUT_DIR="$(HOWTO_OUTPUT_DIR)"; \
	case "$$OUTPUT_DIR" in /*) ;; *) OUTPUT_DIR="$(CURDIR)/$$OUTPUT_DIR";; esac; \
	mkdir -p "$$OUTPUT_DIR"; \
	npm run howto:video -- --guide "$(GUIDE)" --base-url "$(HOWTO_PROD_BASE_URL)" --storage-state "$$AUTH_STATE" --docs-dir "$$DOCS_DIR" --output-dir "$$OUTPUT_DIR" --public-dir "$$OUTPUT_DIR" --format mp4 --voice elevenlabs --language "$(HOWTO_LANGUAGE)" $(HOWTO_TRANSLATE_FLAGS) --sfx $(HOWTO_EXTRA_FLAGS)
endif

howto-video-prod-both: ## Generate one narrated help video from production in Swedish and English (use: make howto-video-prod-both GUIDE=pages-create)
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-prod-both)
else
	@if [ -z "$(GUIDE)" ]; then \
		echo "❌ GUIDE is required. Example: make howto-video-prod-both GUIDE=pages-create"; \
		exit 1; \
	fi
	$(MAKE) howto-video-prod GUIDE="$(GUIDE)" HOWTO_LANGUAGE=sv HOWTO_OUTPUT_DIR="$(HOWTO_OUTPUT_BASE_DIR)/sv"
	$(MAKE) howto-video-prod GUIDE="$(GUIDE)" HOWTO_LANGUAGE=en HOWTO_OUTPUT_DIR="$(HOWTO_OUTPUT_BASE_DIR)/en"
endif

howto-video-prod-all: ## Generate all narrated help videos from production
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-prod-all)
else
	@if [ -z "$$ELEVENLABS_API_KEY" ]; then \
		echo "❌ ELEVENLABS_API_KEY is missing. Add it to repo-root .env."; \
		exit 1; \
	fi
	@if [ "$(HOWTO_LANGUAGE)" != "en" ] && [ -n "$(filter 1 true yes,$(HOWTO_USE_SCRIPT_TRANSLATION))" ]; then \
		if [ "$(HOWTO_TRANSLATION_PROVIDER)" = "anthropic" ] && [ -z "$$ANTHROPIC_API_KEY" ]; then \
			echo "❌ ANTHROPIC_API_KEY is missing. Add it to repo-root .env for $(HOWTO_LANGUAGE) translation."; \
			exit 1; \
		fi; \
		if [ "$(HOWTO_TRANSLATION_PROVIDER)" = "openai" ] && [ -z "$$OPENAI_API_KEY" ]; then \
			echo "❌ OPENAI_API_KEY is missing. Add it to repo-root .env for $(HOWTO_LANGUAGE) translation."; \
			exit 1; \
		fi; \
	fi
	@VOICE_ID="$${HOWTO_VOICE_ID:-$${ELEVENLABS_VOICE_ID:-}}"; \
	case "$(HOWTO_LANGUAGE)" in \
		sv|sv-*|swe|swedish) VOICE_ID="$${VOICE_ID:-$${ELEVENLABS_VOICE_ID_SWE:-$${ELEVENLABS_VOICE_ID_SV:-}}}" ;; \
		en|en-*|eng|english) VOICE_ID="$${VOICE_ID:-$${ELEVENLABS_VOICE_ID_ENG:-$${ELEVENLABS_VOICE_ID_EN:-}}}" ;; \
	esac; \
	if [ -z "$$VOICE_ID" ]; then \
		echo "❌ Voice ID is missing for HOWTO_LANGUAGE=$(HOWTO_LANGUAGE). Set ELEVENLABS_VOICE_ID_SWE or ELEVENLABS_VOICE_ID_ENG in repo-root .env."; \
		exit 1; \
	fi
	@AUTH_STATE="$(HOWTO_AUTH_STATE)"; \
	case "$$AUTH_STATE" in /*) ;; *) AUTH_STATE="$(CURDIR)/$$AUTH_STATE";; esac; \
	if [ ! -f "$$AUTH_STATE" ]; then \
		echo "❌ Auth state not found: $$AUTH_STATE"; \
		echo "Run: make howto-auth-prod"; \
		exit 1; \
	fi; \
	DOCS_DIR="$(HOWTO_DOCS_DIR)"; \
	if [ -z "$$DOCS_DIR" ]; then \
		case "$(HOWTO_LANGUAGE)" in \
			en|en-*|eng|english) DOCS_DIR="$(CURDIR)/frontend/src/docs/how-to" ;; \
			*) DOCS_DIR="$(CURDIR)/frontend/src/docs/how-to-translations/$(HOWTO_LANGUAGE)" ;; \
		esac; \
	fi; \
	case "$$DOCS_DIR" in /*) ;; *) DOCS_DIR="$(CURDIR)/$$DOCS_DIR";; esac; \
	if [ ! -d "$$DOCS_DIR" ]; then \
		echo "❌ Docs folder not found for HOWTO_LANGUAGE=$(HOWTO_LANGUAGE): $$DOCS_DIR"; \
		exit 1; \
	fi; \
	OUTPUT_DIR="$(HOWTO_OUTPUT_DIR)"; \
	case "$$OUTPUT_DIR" in /*) ;; *) OUTPUT_DIR="$(CURDIR)/$$OUTPUT_DIR";; esac; \
	mkdir -p "$$OUTPUT_DIR"; \
	npm run howto:video:all -- --base-url "$(HOWTO_PROD_BASE_URL)" --storage-state "$$AUTH_STATE" --docs-dir "$$DOCS_DIR" --output-dir "$$OUTPUT_DIR" --public-dir "$$OUTPUT_DIR" --voice elevenlabs --language "$(HOWTO_LANGUAGE)" $(HOWTO_TRANSLATE_FLAGS) --sfx $(HOWTO_EXTRA_FLAGS)
endif

howto-video-prod-all-both: ## Generate all narrated help videos from production in Swedish and English
ifneq ($(HELP_REQUESTED),)
	@$(call print_help,howto-video-prod-all-both)
else
	$(MAKE) howto-video-prod-all HOWTO_LANGUAGE=sv HOWTO_OUTPUT_DIR="$(HOWTO_OUTPUT_BASE_DIR)/sv"
	$(MAKE) howto-video-prod-all HOWTO_LANGUAGE=en HOWTO_OUTPUT_DIR="$(HOWTO_OUTPUT_BASE_DIR)/en"
endif
