<?php
// ---- 1. Recursively scan the journal directory for .md files ----
$journalRoot = __DIR__ . '/../journal/';
$journalEntries = [];

if (is_dir($journalRoot)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($journalRoot, RecursiveDirectoryIterator::SKIP_DOTS)
    );

    foreach ($iterator as $file) {
        // Skip directories and non-.md files
        if ($file->isDir() || $file->getExtension() !== 'md') continue;

        // Get relative path from the journal root (e.g., "week4/2026-06-26(friday).md")
        $relativeSubPath = $iterator->getSubPathname();
        // Build full relative path from project root: "journal/week4/2026-06-26(friday).md"
        $relativePath = 'journal/' . str_replace('\\', '/', $relativeSubPath);

        // Exclude files inside the nested 'challenges-app' folder if it exists
        if (strpos($relativePath, 'journal/challenges-app/') === 0) continue;

        $content = file_get_contents($file->getPathname());
        $filename = $file->getFilename();

        // Extract date from filename (e.g., "2026-06-26(friday).md" -> "2026-06-26")
        preg_match('/^(\d{4}-\d{2}-\d{2})/', $filename, $matches);
        $date = $matches[1] ?? 'Unknown';

        // Get first 200 characters as preview
        $preview = strip_tags(substr($content, 0, 200));
        if (strlen($content) > 200) $preview .= '...';

        $journalEntries[] = [
            'filename' => $filename,
            'date' => $date,
            'preview' => $preview,
            'path' => $relativePath
        ];
    }
}

// Sort by date (newest first)
usort($journalEntries, function($a, $b) {
    return strtotime($b['date']) - strtotime($a['date']);
});
?>

<div class="sec-lbl">Journal History</div>
<div class="card">
    <?php if (empty($journalEntries)): ?>
        <div class="challenge-empty">No journal entries found in <code>journal/</code>.</div>
    <?php else: ?>
        <div class="journal-search">
            <input type="text" id="journalSearch" placeholder="Search journal entries..." class="journal-search-input" />
        </div>
        <div class="journal-list" id="journalList">
            <?php foreach ($journalEntries as $entry): ?>
                <div class="journal-entry" data-date="<?= htmlspecialchars($entry['date']) ?>" data-content="<?= htmlspecialchars($entry['preview']) ?>">
                    <div class="journal-entry-header">
                        <span class="journal-entry-date">📅 <?= htmlspecialchars($entry['date']) ?></span>
                        <span class="journal-entry-filename"><?= htmlspecialchars($entry['filename']) ?></span>
                        <a href="preview.php?file=<?= urlencode($entry['path']) ?>" target="_blank" class="journal-entry-link">📄 View full entry</a>
                    </div>
                    <div class="journal-entry-preview"><?= htmlspecialchars($entry['preview']) ?></div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php endif; ?>
</div>

<style>
.journal-search {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
}
.journal-search-input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--dark-bg);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
}
.journal-search-input:focus {
    border-color: var(--primary);
}
.journal-list {
    max-height: 400px;
    overflow-y: auto;
}
.journal-entry {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border-soft);
    transition: background 0.15s;
}
.journal-entry:hover {
    background: var(--card-bg-soft);
}
.journal-entry:last-child {
    border-bottom: none;
}
.journal-entry-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    flex-wrap: wrap;
    gap: 8px;
}
.journal-entry-date {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
}
.journal-entry-filename {
    font-size: 12px;
    color: var(--text-muted);
    font-family: var(--font-mono);
}
.journal-entry-link {
    font-size: 12px;
    color: var(--primary);
    text-decoration: none;
    padding: 4px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    transition: 0.15s;
}
.journal-entry-link:hover {
    background: var(--primary);
    color: #fff;
    border-color: var(--primary);
}
.journal-entry-preview {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.journal-entry-preview::before {
    content: '"';
    opacity: 0.4;
}
.journal-entry-preview::after {
    content: '"';
    opacity: 0.4;
}
</style>

<script>
// Simple live search for journal entries
document.addEventListener('DOMContentLoaded', function() {
    var searchInput = document.getElementById('journalSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        var query = this.value.toLowerCase().trim();
        var entries = document.querySelectorAll('.journal-entry');
        
        entries.forEach(function(entry) {
            var date = entry.dataset.date || '';
            var content = entry.dataset.content || '';
            var match = date.includes(query) || content.toLowerCase().includes(query);
            entry.style.display = match ? '' : 'none';
        });
    });
});
</script>