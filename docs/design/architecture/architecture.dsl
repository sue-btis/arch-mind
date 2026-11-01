workspace "arch-mind" "Personal architecture study tool: capture from Claude Code, Markdown store, illustrated layer plates and matrix view, Leitner review." {

    !identifiers hierarchical

    model {
        author = person "Author" "The only user. Captures concepts, studies views, reviews questions, may edit concept files by hand."

        claudeCode = softwareSystem "Claude Code" "The AI coding assistant where concepts come up and where capture runs." "External"

        archMind = softwareSystem "arch-mind" "Captures, stores, shows and reviews architecture concepts on the author's computer." {
            ui = container "Study UI" "Layer plates view, matrix view, concept detail and review screen. Lays out each layer with elkjs and draws the plates as its own SVG (ADR-008)." "React, Vite, TypeScript, Tailwind CSS v4, shadcn CLI, Watermelon UI components (ADR-007)" "Browser" {
                layout = component "Layer layout" "elkjs: computes the 2D layout and orthogonal routes of each layer (ADR-008)."
                plates = component "Plates renderer" "Projects the layout isometrically and draws plates, pictograms, wires and labels as SVG; zoom and Fit change the viewBox; illustrations appear only as img elements (ADR-008, ADR-009)."
                selection = component "Selection" "Holds the selected concept and derives its neighbourhood; every view and the relation drawer read it (FR-039, FR-041)."
                drawer = component "Relation drawer" "Lists the selected concept's incoming and outgoing relations and its detail beside the view; choosing the other end selects that concept (FR-024, FR-040)."
                pictograms = component "Pictogram library" "Isometric pictogram artwork shipped as a UI asset, including the four layer pictograms used as fallback (ADR-009, FR-038)."
            }
            server = container "Local server" "Serves the UI and the JSON API on 127.0.0.1 only; loads concepts, replays review history, appends reviews (ADR-001, ADR-005)." "Node.js, TypeScript" {
                api = component "HTTP API" "JSON endpoints in docs/design/api/openapi.yaml, behind the Host and Origin checks."
                guard = component "Request guard" "Rejects foreign Host, foreign Origin and non-JSON bodies (ADR-005)."
                scheduler = component "Leitner scheduler" "Computes box and due date per recall question by replaying review history (ADR-002)."
                rulesS = component "Rules module" "Shared package: parses and validates concept files against BR-001 to BR-005 and BR-008, and checks illustration SVGs against an element and attribute allowlist when loading (ADR-004, ADR-009)."
            }
            capture = container "Capture server" "Local stdio MCP server bundled in a Claude Code plugin with the capture skill; lists concepts for proposals and saves or extends concepts (ADR-003)." "Node.js, TypeScript, MCP over stdio" {
                tools = component "MCP tools" "list_concepts, get_concept, save_concept, extend_concept, preview_illustration; contract in docs/design/api/capture-tools.schema.json. list_concepts includes the pictogram catalog (ids and meanings)."
                rulesC = component "Rules module" "The same shared package as the local server; also the only validator of pictogram ids and illustration SVGs at save, and the owner of the pictogram catalog (ADR-009)."
                preview = component "Illustration preview" "Validates a proposed illustration with the rules module, writes a temporary HTML page that shows it only as an img element in the operating system temp folder (never in the store), and opens it with the default browser (ADR-009)."
                writer = component "Atomic writer" "Writes a temporary file in the store folder and renames it into place; an illustration SVG is written before its concept file (ADR-002, ADR-009)."
            }
            concepts = container "Concept files" "One Markdown file per concept with YAML frontmatter and the SEE-I in the body; optional illustrations/<id>.svg beside them (ADR-002, ADR-009)." "Folder of .md and .svg files" "Store"
            reviewLog = container "Review log" "Append-only JSON Lines file, one line per review (ADR-002)." "reviews.jsonl" "Store"
            storeConfig = container "Store config" "Holds the absolute path of the store folder as {\"storePath\": ...}; written once by arch-mind setup, read by the local server and the capture server. Either process that finds it missing or invalid exits with a message naming it." "~/.arch-mind/config.json" "Store"
            facets = container "Facet catalog" "Allowed domains and concerns; layers are fixed. Who edits it is open (PD-017)." "YAML file" "Store"
        }

        author -> claudeCode "Asks to capture a concept; confirms or rewrites proposals"
        claudeCode -> archMind.capture "Calls MCP tools" "stdio"
        author -> archMind.ui "Studies views and reviews questions" "Browser"
        author -> archMind.concepts "Edits by hand (optional)" "Text editor"
        archMind.ui -> archMind.server "Reads concepts, illustrations and due questions; records reviews" "HTTP JSON and image/svg+xml on 127.0.0.1"
        archMind.server -> archMind.concepts "Reads"
        archMind.server -> archMind.reviewLog "Reads and appends"
        archMind.server -> archMind.facets "Reads"
        archMind.server -> archMind.storeConfig "Reads the store folder path"
        archMind.capture -> archMind.storeConfig "Reads the store folder path"
        archMind.capture -> archMind.concepts "Reads and writes"
        archMind.capture -> archMind.facets "Reads"

        archMind.ui.plates -> archMind.ui.layout "Asks for each layer's layout and routes"
        archMind.ui.plates -> archMind.ui.pictograms "Draws concept and layer pictograms"
        archMind.ui.plates -> archMind.ui.selection "Reads and sets the selection"
        archMind.ui.drawer -> archMind.ui.selection "Reads and sets the selection"
        archMind.ui.plates -> archMind.server.api "Reads concepts; loads illustrations as images" "HTTP"
        archMind.ui.drawer -> archMind.server.api "Reads concept detail and illustrations" "HTTP"

        archMind.server.api -> archMind.server.guard "Every request passes"
        archMind.server.api -> archMind.server.scheduler "Due questions"
        archMind.server.api -> archMind.server.rulesS "Load and validate concepts"
        archMind.capture.tools -> archMind.capture.rulesC "Validate concept, pictogram and illustration before saving"
        archMind.capture.tools -> archMind.capture.writer "Save"
        archMind.capture.tools -> archMind.capture.preview "Preview a proposed illustration"
        archMind.capture.preview -> archMind.capture.rulesC "Validate the SVG before showing it"
        archMind.capture.preview -> author "Opens the preview page in the default browser" "Browser"

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
        component archMind.ui "StudyUI" {
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
