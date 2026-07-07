<?php
/**
 * preview.php
 * Renders a Markdown file using Parsedown (offline, no CDN).
 * Only files listed in $allowedFiles OR inside journal/week/ are allowed.
 */

// ---- 1. Security: which files are allowed? ----
$allowedFiles = [
    'README.md',
    'improved_routine.md',
    'agents.txt',
    'FILE_STRUCTURE.md',
    'readme.txt'
];

// ---- 2. Get the requested file ----
$file = $_GET['file'] ?? '';
$file = ltrim($file, '/');
$file = urldecode($file);

// ---- 3. Security checks ----
// a) Prevent directory traversal
if (strpos($file, '..') !== false) {
    http_response_code(403);
    die('<h1>403 Forbidden</h1><p>Invalid file path.</p>');
}

// b) Check if file is in the allowed list OR is a journal entry
$isAllowed = in_array($file, $allowedFiles);

// c) Check if file is a journal entry (any .md file inside journal/ or its subfolders)
$isJournal = false;
if (preg_match('#^journal/.*\.md$#', $file)) {
    $isJournal = true;
}

if (!$isAllowed && !$isJournal) {
    http_response_code(403);
    die('<h1>403 Forbidden</h1><p>This file is not allowed for preview.</p>');
}

$path = __DIR__ . '/' . $file;

// ---- 4. Check if the file actually exists ----
if (!file_exists($path) || !is_readable($path)) {
    http_response_code(404);
    die('<h1>404 Not Found</h1><p>The requested file does not exist.</p>');
}

// ---- 5. Load Parsedown ----
require_once __DIR__ . '/assets/parsedown/Parsedown.php';
$parsedown = new Parsedown();

// ---- 6. Read and convert Markdown to HTML ----
$markdown = file_get_contents($path);
$html = $parsedown->text($markdown);

// ---- 7. Output a clean HTML page with the app’s theme and syntax highlighting ----
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($file) ?> — Preview</title>
    <link rel="stylesheet" href="assets/css/variables.css">
    <link rel="stylesheet" href="assets/css/light-theme.css">
    <link rel="stylesheet" href="assets/css/dark-theme.css">
    <link rel="stylesheet" href="assets/css/app.css">
    <!-- highlight.js for syntax highlighting -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css">
    <style>
        body {
            background: var(--dark-bg);
            color: var(--text-primary);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 30px 20px;
            max-width: 900px;
            margin: 0 auto;
            line-height: 1.6;
        }
        .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 15px;
            border-bottom: 1px solid var(--border);
        }
        .preview-header h1 {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-primary);
            margin: 0;
        }
        .preview-header .back-btn {
            background: var(--card-bg);
            border: 1px solid var(--border);
            padding: 8px 16px;
            border-radius: 8px;
            color: var(--text-primary);
            text-decoration: none;
            font-size: 13px;
            transition: 0.15s;
            cursor: pointer;
        }
        .preview-header .back-btn:hover {
            border-color: var(--primary);
        }
        .markdown-body {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 30px 35px;
            overflow: auto;
        }
        .markdown-body h1,
        .markdown-body h2,
        .markdown-body h3 {
            border-bottom: 1px solid var(--border-soft);
            padding-bottom: 8px;
            margin-top: 28px;
            margin-bottom: 16px;
            color: var(--text-primary);
        }
        .markdown-body h1 { font-size: 28px; }
        .markdown-body h2 { font-size: 22px; }
        .markdown-body h3 { font-size: 18px; }
        .markdown-body p { margin: 12px 0; color: var(--text-secondary); }
        .markdown-body code {
            background: var(--card-bg-soft);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.9em;
            color: var(--text-primary);
        }
        .markdown-body pre {
            background: var(--card-bg-soft);
            padding: 16px 20px;
            border-radius: 8px;
            overflow: auto;
            border: 1px solid var(--border);
        }
        .markdown-body pre code {
            background: transparent;
            padding: 0;
        }
        .markdown-body table {
            border-collapse: collapse;
            width: 100%;
            margin: 16px 0;
        }
        .markdown-body th,
        .markdown-body td {
            border: 1px solid var(--border);
            padding: 8px 12px;
            text-align: left;
        }
        .markdown-body th {
            background: var(--card-bg-soft);
            font-weight: 700;
        }
        .markdown-body img {
            max-width: 100%;
            height: auto;
        }
        .markdown-body blockquote {
            border-left: 4px solid var(--primary);
            margin: 16px 0;
            padding: 8px 20px;
            background: var(--card-bg-soft);
            color: var(--text-secondary);
        }
        .markdown-body ul,
        .markdown-body ol {
            padding-left: 25px;
        }
        .markdown-body hr {
            border: none;
            border-top: 1px solid var(--border);
            margin: 24px 0;
        }
        /* Dark mode tweaks for code */
        [data-theme="dark"] .markdown-body code {
            background: #1e293b;
        }
        [data-theme="dark"] .markdown-body pre {
            background: #0f172a;
            border-color: #334155;
        }
        @media (max-width: 680px) {
            body { padding: 16px; }
            .markdown-body { padding: 16px; }
            .preview-header { flex-wrap: wrap; gap: 10px; }
        }
    </style>
</head>
<body>

    <div class="preview-header">
        <h1>📄 <?= htmlspecialchars($file) ?></h1>
        <div>
            <button class="back-btn" onclick="window.location.href='/'">← Back to App</button>
            <button class="back-btn" onclick="window.print()">🖨️ Print</button>
        </div>
    </div>

    <div class="markdown-body">
        <?= $html ?>
    </div>

    <!-- Theme toggle script (reuse the app’s theme logic) -->
    <script>
        (function() {
            try {
                var theme = localStorage.getItem("routineos_theme_v1");
                document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
            } catch(e) {
                document.documentElement.setAttribute("data-theme", "light");
            }
        })();
    </script>

    <!-- Syntax highlighting -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            document.querySelectorAll('pre code').forEach(function(block) {
                hljs.highlightElement(block);
            });
        });
    </script>
</body>
</html>
