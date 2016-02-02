var ApiConsole = (function(d) {
    function URL(href) {
        var a = d.createElement('a');
        a.href = href;
        this.u = a;
    }
    Object.defineProperties(URL.prototype, {
        href: {
            get: function() { return this.u.href; },
            set: function(href) { this.u.href = href; }
        },
        protocol: {
            get: function() { return this.u.protocol; },
            set: function(protocol) { this.u.protocol = protocol; }
        },
        host: {
            get: function() { return this.u.host; },
            set: function(host) { this.u.host = host; }
        },
        hostname: {
            get: function() { return this.u.hostname; },
            set: function(hostname) { this.u.hostname = hostname; }
        },
        port: {
            get: function() { return this.u.port; },
            set: function(port) { this.u.port = port; }
        },
        pathname: {
            get: function() { return this.u.pathname; },
            set: function(pathname) { this.u.pathname = pathname; }
        },
        search: {
            get: function() { return this.u.search; },
            set: function(search) { this.u.search = search; }
        },
        hash: {
            get: function() { return this.u.hash; },
            set: function(hash) { this.u.hash = hash; }
        },
        username: {
            get: function() { return this.u.username; },
            set: function(username) { this.u.username = username; }
        },
        password: {
            get: function() { return this.u.password; },
            set: function(password) { this.u.password = password; }
        },
        origin: { get: function() {
            return this.protocol + '//' + this.host;
        } },
        base: { get: function() {
            return this.origin + this.pathname.replace(/[^\/]*$/, '');
        } },
        parameters: {
            get: function() {
                return this.search.substring(1).split('&').map(function(p) {
                    var pair = p.split('=').map(decodeURIComponent);
                    return { name: pair[0], value: pair[1] };
                });
            },
            set: function(parameters) {
                var search = parameters.map(function(p) {
                    var pair = [ p.name, p.value ].map(encodeURIComponent);
                    return pair.join('=');
                }).join('&');
                this.search = search.length ? '?'+search : '';
            }
        }
    });
    URL.prototype.toString = function() {
        return [
            this.protocol,
            '//',
            this.host,
            this.pathname,
            this.search,
            this.hash
        ].join('');
    };

    function Request(method, path, headers, parameters, body) {
        this.method = method;
        this.path = path;
        this.headers = headers;
        this.parameters = parameters;
        this.body = body;
    }
    Object.defineProperties(Request.prototype, {
        url: { get: function() {
            var url = new URL(this.path);
            url.parameters = this.parameters;
            return url;
        } },
        serializedBody: { get: function() {
            var getFields = function(path, v) {
                switch (typeof v) {
                case 'object':
                    if (Array.isArray(v) && v.every(function(x) {
                        return (typeof x) !== 'object';
                    })) {
                        return [ {
                            name: path.join('.') + '[]',
                            value: v.map(JSON.stringify).join(', ')
                        } ];
                    }
                    return Object.keys(v).reduce(function(a, k) {
                        return a.concat(getFields(path.concat([k]), v[k]));
                    }, []);
                default:
                    return [ { name: path.join('.'), value: v } ];
                }
            };
            return getFields([], this.body);
        } }
    });
    Request.prototype.send = function(callback) {
        var xhr = new XMLHttpRequest();
        xhr.open(this.method, this.url.toString());

        xhr.setRequestHeader('Accept', '*/*, text/html');
        (this.headers || []).forEach(function(h) {
            xhr.setRequestHeader(h.name, h.value);
        });

        if (callback) xhr.onload = function(e) { return callback(e, xhr); };

        var body;
        try {
            if (this.body) {
                body = JSON.stringify(this.body);
                xhr.setRequestHeader('Content-Type', 'application/json');
            }
        } catch (e) { console.log(e); }
        xhr.send(body);

        return xhr;
    };
    Request.prototype.toJson = function() {
        return JSON.stringify({
            method: this.method,
            path: this.path,
            headers: this.headers,
            parameters: this.parameters,
            body: this.body
        });
    };
    Request.prototype.toCurl = function() {
        var escape = function(s) {
            return s.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
        };
        var quote = function(s) {
            return "'" + escape(s) + "'";
        };

        var cmd = [ 'curl', '-X', this.method ];

        this.headers.forEach(function(h) {
            cmd.push('-H', quote(h.name + ': ' + h.value));
        });

        if (this.body) {
            cmd.push('-H', quote('Content-Type: application/json'));
            cmd.push('-d', quote(JSON.stringify(this.body)));
        }

        var url = new URL(this.path);
        url.parameters = this.parameters;

        cmd.push(quote(url.toString()));
        return cmd.join(' ');
    };
    Request.prototype.toHttp = function() {
        var bytes = function(s) {
            return unescape(encodeURIComponent(s)).length;
        };

        var lines = [];
        var path = this.path;
        var url = new URL(this.path);
        url.parameters = this.parameters;
        lines.push([ this.method, url.pathname, 'HTTP/1.1' ].join(' '));
        lines.push('Host: ' + url.host);
        this.headers.forEach(function(h) {
            lines.push(h.name + ': ' + h.value);
        });

        var body = this.body ? JSON.stringify(this.body) : '';
        lines.push('Content-Length: ' + bytes(body));
        if (body.length > 0) {
            lines.push('Content-Type: application/json');
            lines.push('', body);
        }

        return lines.join("\n");
    };
    Request.fromJson = function(json) {
        try {
            json = JSON.parse(json);
            return new Request(
                json.method,
                json.path,
                json.headers,
                json.parameters,
                json.body
            );
        } catch (e) { /* ignore */ }
    };
    Request.fromHttp = function(http) {
        var method, url, body;
        var parameters = [];
        var headers = [];
        var lines = http.split(/\r?\n/);

        var reqLine = /^([a-zA-Z])+ +([^ ]+) +HTTP\/[0-9.]+/;
        var m = reqLine.exec(lines[0] || '');
        if (m) {
            lines.shift();
            method = m[1];
            url = new URL(m[2]);
            parameters = url.parameters;
            url.search = '';
        }

        var headerLine = /^([0-9a-zA-Z!#$%&'*+.^_`|~-]+) *: *(.+)$/;
        while ((m = headerLine.exec(lines[0] || ''))) {
            lines.shift();
            var name = m[1];
            var value = m[2];
            if (name.toLowerCase() === 'host') {
                if (!url.host) {
                     // in case we are in file://
                    url.protocol = 'http:';
                }
                url.host = value;
            } else if (!(/content-(?:type|length)/.test(name.toLowerCase()))) {
                headers.push({ name: name, value: value });
            }
        }
        while (lines.length && /^[\r\n\t ]*$/.test(lines[0])) lines.shift();

        if (lines.length) {
            try {
                body = JSON.parse(lines.join("\n"));
            } catch (err) {
                console.log(err);
            }
        }
        var path = url.toString();
        var origin = new URL(location.href).origin;
        if (path.startsWith(origin)) path = path.substring(origin.length);

        return new Request(method, path, headers, parameters, body);
    };

    function Form(parent, requester) {
        this.parent = parent;
        this.requester = requester;

        (function(self) {
            var callback = {
                change: [ function(e) { self.grow(); } ],
                send: []
            };
            self.callback = callback;
            self.onChange = throttle(function(e) {
                self.fire('change', e);
            }, 1000);

            self.installChangeListener(parent.querySelector('select.method'));
            self.installChangeListener(parent.querySelector('input.path'));

            parent.addEventListener('submit', function(e) {
                e.stopPropagation();
                e.preventDefault();
                var req = self.toRequest();
                requester.sendBy(req.url, req, function(xhr) {
                    self.fire('send', req.url, xhr);
                });
            });

            var clear = parent.querySelector('input.clear');
            clear.addEventListener('click', function(e) {
                self.clear();
                self.grow();
                self.onChange();
            });
        })(this);
    }
    Form.prototype.fire = function(event, args) {
        args = Array.prototype.slice.call(arguments, 1);
        (this.callback[event] || []).forEach(function(f) {
            f.apply(this, args);
        });
    };
    Form.prototype.section = function(kind) {
        return this.parent.querySelector('.'+kind);
    };
    Form.prototype.collectValues = function(node) {
        if (!node) return [];
        return toArray(node.querySelectorAll('.name')).map(function(thisNode) {
            var nextNode = nextElement(thisNode);
            if (!nextNode) return { name: '' };
            var nameNode = thisNode.querySelector('input') || {};
            var valueNode = nextNode.querySelector('input') || {};
            return {
                name: (nameNode.value || '').trim(),
                value: (valueNode.value || '').trim()
            };
        }).filter(function(p) { return p.name.length > 0; });
    };
    Form.prototype.toRequest = function() {
        return new Request(
            this.parent.querySelector('*[name="method"]').value,
            this.parent.querySelector('*[name="path"]').value,
            this.collectValues(this.section('headers')),
            this.collectValues(this.section('parameters')),
            fieldsToJson(this.collectValues(this.section('body')))
        );
    };
    Form.prototype.importRequest = function(req) {
        this.clear();
        this.parent.querySelector('*[name="method"]').value = req.method;
        this.parent.querySelector('*[name="path"]').value = req.path;
        req.headers.forEach((function(self) { return function(f) {
            self.addField('headers', f.name, f.value);
        }; })(this));
        req.parameters.forEach((function(self) { return function(f) {
            self.addField('parameters', f.name, f.value);
        }; })(this));
        req.serializedBody.forEach((function(self) { return function(f) {
            self.addField('body', f.name, f.value);
        }; })(this));
        this.onChange();
        return this;
    };
    Form.prototype.addField = function(kind, name, value) {
        var section = this.section(kind);
        var tmpl = section.querySelector('template');
        var parent = tmpl.parentNode;
        var data = { name: name || '', value: value || '' };
        var nameNode = Template.render(tmpl, '.name', data);
        var valueNode = Template.render(tmpl, '.value', data);
        [ nameNode, valueNode ].forEach((function(self) { return function(x) {
            var input = x.querySelector('input');
            self.installChangeListener(input);
        }; })(this));
        parent.appendChild(nameNode);
        parent.appendChild(valueNode);
        return this;
    };
    Form.prototype.grow = function(kind) {
        if (!kind) return this.grow('headers').grow('parameters').grow('body');
        var section = this.section(kind);
        var hasValue = function(input) { return (input.value||'').length > 0; };
        if (toArray(section.querySelectorAll('.name input')).every(hasValue)) {
            this.addField(kind);
        }
        return this;
    };
    Form.prototype.clear = function() {
        this.parent.querySelector('*[name="method"]').value = "GET";
        this.parent.querySelector('*[name="path"]').value = '';
        var filter = 'input[type="text"]:not([name="path"])';
        var inputs = this.parent.querySelectorAll(filter);
        toArray(inputs).forEach(function(input) {
            var parent = input.parentNode;
            parent.parentNode.removeChild(parent);
        });
        return this;
    };
    Form.prototype.addEventListener = function(event, callback) {
        this.callback[event] = this.callback[event] || [];
        this.callback[event].push(callback);
    };
    Form.prototype.installChangeListener = function(input) {
        input.addEventListener('change', this.onChange);
        input.addEventListener('keyup', this.onChange);
    };

    function Requester(output) {
        this.output = output;
    }
    Requester.prototype.write = function(url, contentType, body) {
        var iframe = d.createElement('iframe');
        iframe.id = 'response';
        this.output.parentNode.replaceChild(iframe, this.output);
        this.output = iframe;

        if (/html/.test(contentType)) {
            if (!(/<html[ >]/i.test(body)))
                body = '<html>' + body + '</html>';
            if (!(/<head[ >]/i.test(body)))
                body = body.replace(/(<html.*?>)/i, '$1<head></head>');
            if (!(/<base[ >]/i.test(body))) {
                var base = [
                    '<base href="',
                    url.base.replace(/"/g, '&quot;'),
                    '"></base>'
                ].join('');
                body = body.replace(/(<head.*?>)/i, '$1'+base);
            }
        }
        if (body.length <= 0) {
            contentType = 'text/plain';
            body = [ xhr.status, xhr.statusText ].join(' ');
        }
        var base64 = encodeBase64(body);
        iframe.src = 'data:' + contentType + ';base64,' + base64;
    };
    Requester.prototype.sendBy = function(url, req, callback) {
        req.send((function(self) { return function(e, xhr) {
            if (xhr.readyState != 4) return;
            var ct = xhr.getResponseHeader('content-type');
            self.write(url, ct, xhr.responseText);
            callback(xhr);
        }; })(this));
    };

    function Dialog(parent, button) {
        this.parent = parent;
        if (!parent || !button) return;
        (function(self) {
            var overlay = parent.querySelector('.overlay');
            overlay.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                self.hide();
            });

            button.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                self.show();
            });
        })(this);
    }
    Dialog.prototype.show = function() {
        this.parent.style.display = '';
    };
    Dialog.prototype.hide = function() {
        this.parent.style.display = 'none';
    };

    function Exporter(parent, button, form) {
        Dialog.call(this, parent, button);
        this.form = form;
        (function(self) {
            var copyButtons = toArray(parent.querySelectorAll('button.copy'));
            copyButtons.forEach(function(button) {
                button.addEventListener('click', function(e) {
                    e.preventDefault();
                    var input = [ 'input', 'textarea' ].map(function(tag) {
                        return e.target.parentNode.querySelector(tag);
                    }).find(function(x) { return !!x; });
                    input.select();
                    try {
                        document.execCommand('copy');
                    } catch (err) {
                        console.log(err);
                    }
                });
            });
        })(this);
    }
    Exporter.prototype = new Dialog();
    Exporter.prototype.constructor = Exporter;
    Exporter.prototype.show = function() {
        this.parent.querySelector('.permalink input').value = this.permalink;
        this.parent.querySelector('.curl input').value = this.curl;
        this.parent.querySelector('.http textarea').value = this.http;
        Dialog.prototype.show.call(this);
    };
    Object.defineProperty(Exporter.prototype, 'hash', {
        get: function() {
            return encodeURIComponent(this.form.toRequest().toJson());
        }
    });
    Object.defineProperty(Exporter.prototype, 'permalink', {
        get: function() {
            var url = new URL(location.href);
            url.hash = '#' + this.hash;
            return url.toString();
        }
    });
    Object.defineProperty(Exporter.prototype, 'curl', {
        get: function() {
            return this.form.toRequest().toCurl();
        }
    });
    Object.defineProperty(Exporter.prototype, 'http', {
        get: function() {
            return this.form.toRequest().toHttp();
        }
    });

    function Importer(parent, button, form) {
        Dialog.call(this, parent, button);
        this.form = form;
        (function(self) {
            var form = parent.querySelector('form');
            form.addEventListener('submit', function(e) {
                e.stopPropagation();
                e.preventDefault();
                self.importHttp();
                self.hide();
            });
        })(this);
    }
    Importer.prototype = new Dialog();
    Importer.prototype.constructor = Importer;
    Importer.prototype.importHttp = function() {
        var value = this.parent.querySelector('.http textarea').value;
        var original = this.form.toRequest();
        var req = Request.fromHttp(value);
        if (req.method) original.method = req.method;
        if (req.path) original.path = req.path;
        if (req.parameters.length > 0) original.parameters = req.parameters;
        if (req.headers.length > 0) original.headers = req.headers;
        if (req.body) original.body = req.body;
        this.form.importRequest(original);
    };

    // Template

    var Template = (function() {
        var parseBindings = function(str) {
            return str.split(/\s*,\s*/).map(function(b) {
                return b.split(/[=]/);
            });
        };
        var resolve = function(data, keys) {
            return keys.split(/[.]/).reduce(function(r, x) {
                return (r||{})[x];
            }, data);
        };
        return {
            bind: function(node, data) {
                if (!node || !node.getAttribute) return node;
                var bindings =
                    parseBindings(node.getAttribute('data-bind') || '');
                bindings.forEach(function(b) {
                    var k = b[0].substring(1);
                    var v = resolve(data, b[1] || '');
                            /^@/.test(b[0]) && node.setAttribute(k, v);
                            /^%/.test(b[0]) && ( node.style[k] = v );
                    if ('$content' == b[0]) {
                        node.appendChild(document.createTextNode(v));
                    }
                });
                for (var i=0; i < node.childNodes.length; i++) {
                    this.bind(node.childNodes[i], data);
                }
                return node;
            },
            render: function(tmpl, q, data) {
                var container = 'content' in tmpl ? tmpl.content : tmpl;
                var instance = container.querySelector(q).cloneNode(true);
                return this.bind(instance, data);
            }
        };
    })();

    // Utilities

    function toArray(arr) {
        return Array.prototype.slice.call(arr);
    }

    function encodeBase64(s) {
        var escaped = unescape(encodeURIComponent(s));
        return window.btoa(escaped);
    }

    function nextElement(node) {
        while ((node = node.nextSibling)) {
            if (node.nodeType === 1) return node;
        }
    }

    function stringToJsonValue(s) {
        try {
            return JSON.parse(s);
        } catch (e) {
            return s; // as string
        }
    }

    function appendField(o, path, value) {
        if (path.length <= 0) return value;
        var f = path[0];
        var isIndex = /^[0-9]+$/.test(f);
        o = o || (isIndex ? [] : {});
        if (Array.isArray(o) && !isIndex) {
            var o2 = {};
            Object.keys(o).forEach(function(k) { o2[k] = o[k]; });
            o = o2;
        }
        if (path.length === 1 && /\[\]$/.test(f)) {
            f = f.replace(/\[\]$/, '');
            var v;
            try {
                v = JSON.parse('['+value+']');
            } catch (e) {
                v = value.split(/, */).map(stringToJsonValue);
            }
            o[f] = v;
        } else {
            o[f] = appendField(o[f], path.slice(1), value);
        }
        return o;
    }

    function fieldsToJson(fields) {
        return fields.reduce(function(r, f) {
            var path = f.name.split(/[.]/).filter(function(s) {
                return s.length > 0;
            });
            return appendField(r, path, stringToJsonValue(f.value));
        }, null) || {};
    }

    function throttle(f, threshold, scope) {
        threshold || (threshold = 250);
        var last, timer;
        return function () {
            var self = this;
            var args = arguments;
            var now = +new Date();
            var run = function () {
                last = now;
                f.apply(scope || self, args);
            };
            if (last && now < last + threshold) {
                clearTimeout(timer);
                timer = setTimeout(run, threshold);
            } else {
                run();
            }
        };
    }

    return {
        Form: Form,
        Requester: Requester,
        Request: Request,
        Exporter: Exporter,
        Importer: Importer
    };
})(document);

ApiConsole.form = (function(d) {
    var form = new ApiConsole.Form(
        d.querySelector('#request .input'),
        new ApiConsole.Requester(d.querySelector('#response'))
    );

    var hash = location.hash.replace(/^#/, '');
    var req = ApiConsole.Request.fromJson(decodeURIComponent(hash));
    if (req) form.importRequest(req);

    var exporter = new ApiConsole.Exporter(
        d.querySelector('#export'),
        form.parent.querySelector('button.export'),
        form
    );
    var importer = new ApiConsole.Importer(
        d.querySelector('#import'),
        form.parent.querySelector('button.import'),
        form
    );

    form.addEventListener('change', function(e) {
        location.hash = '#' + exporter.hash;
    });

    var collapser = d.querySelector('#request .collapser');
    collapser.addEventListener('click', function(e) {
        e.stopPropagation();
        e.preventDefault();
        if (/\bcollapsed\b/.test(e.target.className)) {
            e.target.className = e.target.className.replace(/ +collapsed/g, '');
        } else {
            e.target.className += ' collapsed';
        }
    });

    return form.grow();
})(document);
