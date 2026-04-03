/* ===================================================
   eDEX-UI Web Blog — Terminal Window
   Uses xterm.js loaded via CDN in index.html
   Supports: demo mode + Web Serial API (Chrome 89+)
   =================================================== */

'use strict';

let _termCounter = 0;

// ─── Command Definitions ─────────────────────────────
const _COMMANDS = {
    help: () => [
        '',
        '\x1b[1mAVAILABLE COMMANDS:\x1b[0m',
        '  help         Show this help message',
        '  clear        Clear terminal screen',
        '  date         Show current date and time',
        '  echo <text>  Print text to terminal',
        '  ls           List blog posts',
        '  cat <post>   Show post summary by index',
        '  theme        Show current theme info',
        '  whoami       Show user info',
        '  uname        Show system info',
        '  serial       Connect to a serial port (Chrome only)',
        '  exit         Close this terminal window',
        '',
    ],
    clear: (term) => { term.clear(); return []; },
    date: () => {
        const now = new Date();
        return ['', now.toString(), ''];
    },
    whoami: () => ['', 'ADMIN_USER @ edex-blog', ''],
    uname: () => ['', 'eDEX-OS 1.0.0 Web/Browser ' + navigator.userAgent.split(' ').slice(-1)[0], ''],
    theme: () => {
        const theme = localStorage.getItem('blog_theme') || 'tron';
        const r = getComputedStyle(document.documentElement).getPropertyValue('--color_r').trim();
        const g = getComputedStyle(document.documentElement).getPropertyValue('--color_g').trim();
        const b = getComputedStyle(document.documentElement).getPropertyValue('--color_b').trim();
        return [
            '',
            `THEME:    ${theme.toUpperCase()}`,
            `COLOR:    rgb(${r}, ${g}, ${b})`,
            '',
        ];
    },
    ls: () => {
        const posts = window._allPosts || [];
        if (!posts.length) return ['', '(no posts loaded)', ''];
        const lines = ['', '\x1b[1mBLOG INDEX:\x1b[0m'];
        posts.forEach((p, i) => {
            lines.push(`  [${String(i+1).padStart(2,'0')}] ${p.title}  \x1b[2m(${p.date})\x1b[0m`);
        });
        lines.push('');
        return lines;
    },
    cat: (term, args) => {
        const posts = window._allPosts || [];
        const idx = parseInt(args[0]) - 1;
        if (isNaN(idx) || idx < 0 || idx >= posts.length) {
            return [`\x1b[31mERROR: Usage: cat <index>  (1–${posts.length})\x1b[0m`, ''];
        }
        const p = posts[idx];
        return [
            '',
            `\x1b[1m${p.title}\x1b[0m`,
            `DATE: ${p.date}  |  READ: ~${p.readTime} min`,
            `TAGS: ${p.tags.join(', ')}`,
            '',
            p.summary,
            '',
        ];
    },
    echo: (term, args) => ['', args.join(' '), ''],
    exit: (term, args, ctx) => { ctx.win.close(); return []; },
    serial: (term) => {
        if (!('serial' in navigator)) {
            return [
                '',
                '\x1b[33mWeb Serial API not available.\x1b[0m',
                'Use Chrome 89+ and serve over HTTPS or localhost.',
                '',
            ];
        }
        // Trigger async serial connect
        _connectSerial(term);
        return ['', 'Opening serial port selector...', ''];
    },
};

// ─── Serial Port Support ─────────────────────────────
async function _connectSerial(term) {
    try {
        const port = await navigator.serial.requestPort();
        const baud = 9600; // default
        await port.open({ baudRate: baud });
        term.writeln(`\x1b[32mSERIAL PORT CONNECTED @ ${baud} baud\x1b[0m`);
        term.writeln('(incoming data appears below — type to send)\r\n');

        const decoder = new TextDecoderStream();
        const encoder = new TextEncoderStream();

        port.readable.pipeTo(decoder.writable);
        encoder.readable.pipeTo(port.writable);

        const writer = encoder.writable.getWriter();
        const reader = decoder.readable.getReader();

        // Read loop
        (async () => {
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    term.write(value);
                }
            } catch (e) {
                term.writeln(`\r\n\x1b[31mSERIAL DISCONNECTED: ${e.message}\x1b[0m\r\n`);
            }
        })();

        // Write: send xterm input directly to serial
        term._serialWriter = writer;
        term._serialMode   = true;

    } catch (e) {
        term.writeln(`\r\n\x1b[31mERROR: ${e.message}\x1b[0m\r\n`);
    }
}

// ─── Terminal Input Handler ───────────────────────────
function _makeInputHandler(term, ctx) {
    let inputBuf = '';
    let history  = [];
    let histIdx  = -1;

    return (data) => {
        // If in serial mode, forward input to serial port
        if (term._serialMode && term._serialWriter) {
            term._serialWriter.write(data);
            return;
        }

        const code = data.charCodeAt(0);

        if (code === 13) {                  // Enter
            term.write('\r\n');
            const line = inputBuf.trim();
            inputBuf = '';
            histIdx  = -1;
            if (line) {
                history.unshift(line);
                if (history.length > 50) history.pop();
                _runCommand(term, ctx, line);
            } else {
                term.write('$ ');
            }

        } else if (code === 127) {          // Backspace
            if (inputBuf.length > 0) {
                inputBuf = inputBuf.slice(0, -1);
                term.write('\b \b');
            }

        } else if (data === '\x1b[A') {    // Arrow Up (history)
            if (histIdx < history.length - 1) {
                histIdx++;
                _replaceInput(term, inputBuf, history[histIdx]);
                inputBuf = history[histIdx];
            }

        } else if (data === '\x1b[B') {    // Arrow Down (history)
            if (histIdx > 0) {
                histIdx--;
                _replaceInput(term, inputBuf, history[histIdx]);
                inputBuf = history[histIdx];
            } else if (histIdx === 0) {
                histIdx = -1;
                _replaceInput(term, inputBuf, '');
                inputBuf = '';
            }

        } else if (data === '\x03') {       // Ctrl+C
            inputBuf = '';
            term.write('^C\r\n$ ');

        } else if (code >= 32) {            // Printable chars
            inputBuf += data;
            term.write(data);
        }
    };
}

function _replaceInput(term, old, next) {
    term.write('\b \b'.repeat(old.length));
    term.write(next);
}

function _runCommand(term, ctx, line) {
    const [cmd, ...args] = line.split(/\s+/);
    const handler = _COMMANDS[cmd.toLowerCase()];

    if (handler) {
        const output = handler(term, args, ctx);
        if (output && output.length) {
            output.forEach(l => term.writeln(l));
        }
    } else {
        term.writeln(`\x1b[31mcommand not found: ${cmd}\x1b[0m`);
        term.writeln("Type 'help' for available commands.");
        term.writeln('');
    }

    term.write('$ ');
}

// ─── Open Terminal Window ────────────────────────────
function openTerminal() {
    _termCounter++;
    const tId = `term_${_termCounter}`;
    const titleLabel = _termCounter > 1 ? `TERMINAL [${_termCounter}]` : 'TERMINAL';

    const bodyHtml = `
        <div class="terminal_toolbar">
            <span>eDEX-SHELL v1.0</span>
            <button id="serial_btn_${tId}" onclick="_openSerialFromBtn('${tId}')">[ SERIAL PORT ]</button>
        </div>
        <div class="window_body" style="flex:1; overflow:hidden;">
            <div id="xterm_${tId}" style="height:100%; width:100%;"></div>
        </div>
    `;

    const win = new BlogWindow({
        title:    titleLabel,
        bodyHtml,
        width:    '620px',
        height:   '440px',
        minWidth: '400px',
    });

    // Init xterm.js after DOM is ready
    setTimeout(() => _initXterm(tId, win), 100);
}

function _initXterm(tId, win) {
    if (typeof Terminal === 'undefined') {
        console.warn('[terminal] xterm.js not loaded yet');
        return;
    }

    // Read current theme colors
    const cs  = getComputedStyle(document.documentElement);
    const r   = cs.getPropertyValue('--color_r').trim();
    const g   = cs.getPropertyValue('--color_g').trim();
    const b   = cs.getPropertyValue('--color_b').trim();
    const bg  = cs.getPropertyValue('--color_light_black').trim() || '#05080d';
    const fg  = `rgb(${r},${g},${b})`;

    const term = new Terminal({
        fontFamily:  'Fira Mono, Fira Code, monospace',
        fontSize:    13,
        lineHeight:  1.4,
        cursorStyle: 'block',
        cursorBlink: true,
        theme: {
            background: bg,
            foreground: fg,
            cursor:     fg,
            selection:  `rgba(${r},${g},${b},0.3)`,
        },
        scrollback: 500,
    });

    const container = document.getElementById(`xterm_${tId}`);
    if (!container) return;

    term.open(container);

    // Fit terminal to container
    const fitToContainer = () => {
        const cols = Math.floor(container.clientWidth  / (term._core._renderService.dimensions.actualCellWidth  || 8));
        const rows = Math.floor(container.clientHeight / (term._core._renderService.dimensions.actualCellHeight || 17));
        if (cols > 0 && rows > 0) {
            try { term.resize(cols, rows); } catch(e) { /* ignore */ }
        }
    };
    setTimeout(fitToContainer, 150);

    // Register terminal for theme updates
    if (window._activeTerminals) window._activeTerminals.push(term);

    // Welcome banner
    term.writeln('\x1b[1meDEX-UI BLOG TERMINAL\x1b[0m');
    term.writeln('─'.repeat(36));
    term.writeln("Type '\x1b[1mhelp\x1b[0m' for available commands.");
    term.writeln('');
    term.write('$ ');

    // Input handler
    const ctx = { win };
    term.onData(_makeInputHandler(term, ctx));

    // Expose for serial btn
    window[`_term_${tId}`] = term;
}

function _openSerialFromBtn(tId) {
    const term = window[`_term_${tId}`];
    if (term) _connectSerial(term);
}

// Expose globally
window.openTerminal = openTerminal;
window._openSerialFromBtn = _openSerialFromBtn;
