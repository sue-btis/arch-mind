workspace "arch-mind" "Personal architecture study tool: capture from Claude Code, Markdown store, layer and matrix views, Leitner review." {

    !identifiers hierarchical

    model {
        author = person "Author" "The only user. Captures concepts, studies views, reviews questions, may edit concept files by hand."

        claudeCode = softwareSystem "Claude Code" "The AI coding assistant where concepts come up and where capture runs." "External"

        archMind = softwareSystem "arch-mind" "Captures, stores, shows and reviews architecture concepts on the author's computer." {
            ui = container "Study UI" "Layer view, matrix view, concept detail and review screen. Lays out the layer view with elkjs and draws it with React Flow (ADR-006)." "React, Vite, TypeScript, Tailwind CSS v4, shadcn CLI, Watermelon UI components (ADR-007)" "Browser"
            server = container "Local server" "Serves the UI and the JSON API on 127.0.0.1 only; loads concepts, replays review history, appends reviews (ADR-001, ADR-005)." "Node.js, TypeScript" {
                api = component "HTTP API" "JSON endpoints in docs/design/api/openapi.yaml, behind the Host and Origin checks."
                guard = component "Request guard" "Rejects foreign Host, foreign Origin and non-JSON bodies (ADR-005)."
                scheduler = component "Leitner scheduler" "Computes box and due date per recall question by replaying review history (ADR-002)."
                rulesS = component "Rules module" "Shared package: parses and validates concept files against BR-001 to BR-005 (ADR-004)."
            }
            capture = container "Capture server" "Local stdio MCP server bundled in a Claude Code plugin with the capture skill; lists concepts for proposals and saves or extends concepts (ADR-003)." "Node.js, TypeScript, MCP over stdio" {
                tools = component "MCP tools" "list_concepts, get_concept, save_concept, extend_concept; contract in docs/design/api/capture-tools.schema.json."
                rulesC = component "Rules module" "The same shared package as the local server."
                writer = component "Atomic writer" "Writes a temporary file in the store folder and renames it into place (ADR-002)."
            }
            concepts = container "Concept files" "One Markdown file per concept with YAML frontmatter and the SEE-I in the body (ADR-002)." "Folder of .md files" "Store"
            reviewLog = container "Review log" "Append-only JSON Lines file, one line per review (ADR-002)." "reviews.jsonl" "Store"
            storeConfig = container "Store config" "Holds the absolute path of the store folder as {\"storePath\": ...}; written once by arch-mind setup, read by the local server and the capture server. Either process that finds it missing or invalid exits with a message naming it." "~/.arch-mind/config.json" "Store"
            facets = container "Facet catalog" "Allowed domains and concerns; layers are fixed. Who edits it is open (PD-017)." "YAML file" "Store"
        }

        author -> claudeCode "Asks to capture a concept; confirms or rewrites proposals"
        claudeCode -> archMind.capture "Calls MCP tools" "stdio"
        author -> archMind.ui "Studies views and reviews questions" "Browser"
        author -> archMind.concepts "Edits by hand (optional)" "Text editor"
        archMind.ui -> archMind.server "Reads concepts, due questions; records reviews" "HTTP JSON on 127.0.0.1"
        archMind.server -> archMind.concepts "Reads"
        archMind.server -> archMind.reviewLog "Reads and appends"
        archMind.server -> archMind.facets "Reads"
        archMind.server -> archMind.storeConfig "Reads the store folder path"
        archMind.capture -> archMind.storeConfig "Reads the store folder path"
        archMind.capture -> archMind.concepts "Reads and writes"
        archMind.capture -> archMind.facets "Reads"

        archMind.server.api -> archMind.server.guard "Every request passes"
        archMind.server.api -> archMind.server.scheduler "Due questions"
        archMind.server.api -> archMind.server.rulesS "Load and validate concepts"
        archMind.capture.tools -> archMind.capture.rulesC "Validate before saving"
        archMind.capture.tools -> archMind.capture.writer "Save"

        deploymentEnvironment "Author computer" {
            deploymentNode "Windows 11 PC" "" "Windows 11" {
                deploymentNode "Browser" "" "Chromium, Firefox or Safari" {
                    containerInstance archMind.ui
                }
                deploymentNode "Node.js 24" "Started by the author's arch-mind command" "Node.js" {
                    containerInstance archMind.server
                }
                deploymentNode "Claude Code" "Starts the plugin's MCP server as a child process" "Claude Code" {
                    containerInstance archMind.capture
                }
                deploymentNode "Home folder" "The author's operating system home folder" "File system" {
                    containerInstance archMind.storeConfig
                }
                deploymentNode "Store folder" "A folder chosen by arch-mind setup, outside project repositories" "File system" {
                    containerInstance archMind.concepts
                    containerInstance archMind.reviewLog
                    containerInstance archMind.facets
                }
            }
        }
    }

    views {
        systemContext archMind "Context" {
            include *
            autolayout lr
        }
        container archMind "Containers" {
            include *
            autolayout lr
        }
        component archMind.server "LocalServer" {
            include *
            autolayout lr
        }
        component archMind.capture "CaptureServer" {
            include *
            autolayout lr
        }
        deployment archMind "Author computer" "Deployment" {
            include *
            autolayout lr
        }
        styles {
            element "External" {
                background #999999
            }
            element "Store" {
                shape Folder
            }
            element "Browser" {
                shape WebBrowser
            }
        }
    }
}
