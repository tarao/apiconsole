(function(d) {
    var highlightJson = function(json) {
        return [
            '<!DOCTYPE html>',
            '<html><head>',
            '  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.1.0/styles/zenburn.min.css" />',
            '  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.1.0/highlight.min.js"></script>',
            '  <style>',
            '    code.hljs { border-radius: 5px; }',
            '  </style>',
            '</head><body>',
            '<pre><code>' + JSON.stringify(JSON.parse(json), null, 4) + '</code></pre>',
            '<script>',
            '  hljs.initHighlighting();',
            '</script>',
            '</body></html>'
        ].join("\n");
    };
    var form = ApiConsole.form;
    var callback = function(url, xhr) {
        var ct = xhr.getResponseHeader('content-type') || '';
        if (!/json/.test(ct)) return;

        var iframe = d.querySelector('iframe');
        try {
            var doc = iframe.contentDocument;
            if (doc.querySelector('body > pre > *')) return; // structured
            if (doc.querySelector('body').firstChild.tagName !== 'PRE') return;
            throw 'JSON not highlighted';
        } catch (e) {
            var body = highlightJson(xhr.responseText);
            form.requester.write(url, 'text/html', body);
        }
    };
    form.addEventListener('send', function(url, xhr) {
        // Give it a chance to highlight JSON asynchronously by some
        // browser extension.
        setTimeout(function() { callback(url, xhr); }, 800);
    });
})(document);
