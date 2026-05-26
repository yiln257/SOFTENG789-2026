import net from 'net';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const DEFAULT_SENDER = '2138046969@qq.com';
const DEFAULT_SMTP_HOST = 'smtp.qq.com';
const DEFAULT_SMTP_PORT = 465;

const encodeBase64 = (value) => Buffer.from(value, 'utf8').toString('base64');

const escapeAddress = (address) => address.replace(/[<>\r\n]/g, '').trim();

const formatMailbox = (name, address) => {
    const cleanAddress = escapeAddress(address);
    const cleanName = name?.replace(/["\r\n]/g, '').trim();
    return cleanName ? `"${cleanName}" <${cleanAddress}>` : `<${cleanAddress}>`;
};

const normalizeNewlines = (value) => value.replace(/\r?\n/g, '\r\n');

const dotStuff = (value) => normalizeNewlines(value).replace(/^\./gm, '..');

const readSmtpResponse = (socket) => {
    return new Promise((resolve, reject) => {
        let buffer = '';

        const cleanup = () => {
            socket.off('data', onData);
            socket.off('error', onError);
        };

        const onError = (error) => {
            cleanup();
            reject(error);
        };

        const onData = (chunk) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split(/\r?\n/).filter(Boolean);
            const last = lines[lines.length - 1];

            if (/^\d{3}\s/.test(last)) {
                cleanup();
                resolve({ code: parseInt(last.slice(0, 3), 10), message: buffer.trimEnd() });
            }
        };

        socket.on('data', onData);
        socket.on('error', onError);
    });
};

const createSmtpCommandError = (safeCommand, response) => {
    const message = response.message.replace(/\r?\n/g, ' ');

    if (/5\.7\.139|basic authentication is disabled|SmtpClientAuthentication/i.test(message)) {
        return new Error(
            `Microsoft SMTP rejected password login (${safeCommand}): SMTP AUTH/basic authentication is disabled for this mailbox or tenant. Use Microsoft OAuth/Graph or enable Authenticated SMTP for the sender mailbox. Server said: ${message}`
        );
    }

    if (/^535|authentication|auth/i.test(message) && /^AUTH/i.test(safeCommand)) {
        return new Error(
            `SMTP authentication failed (${safeCommand}). For QQ Mail, enable POP3/SMTP or IMAP/SMTP and set EMAIL_PASS to the QQ Mail authorization code, not the QQ login password. Server said: ${message}`
        );
    }

    return new Error(`SMTP command failed (${safeCommand}): ${message}`);
};

const writeCommand = async (socket, command, expectedCodes, safeCommand = command) => {
    socket.write(`${command}\r\n`);
    const response = await readSmtpResponse(socket);
    if (!expectedCodes.includes(response.code)) {
        throw createSmtpCommandError(safeCommand, response);
    }
    return response;
};

const createSocket = ({ host, port, secure }) => {
    return new Promise((resolve, reject) => {
        const socket = secure
            ? tls.connect({ host, port, servername: host }, () => resolve(socket))
            : net.connect({ host, port }, () => resolve(socket));

        socket.setTimeout(30000);
        socket.once('error', reject);
        socket.once('timeout', () => {
            socket.destroy();
            reject(new Error('SMTP connection timed out.'));
        });
    });
};

const upgradeToTls = (socket, host) => {
    return new Promise((resolve, reject) => {
        const tlsSocket = tls.connect({ socket, servername: host }, () => resolve(tlsSocket));
        tlsSocket.once('error', reject);
    });
};

const readEnvFile = () => {
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (!fs.existsSync(envPath)) return {};
        return dotenv.parse(fs.readFileSync(envPath));
    } catch (error) {
        console.warn('Unable to read .env for email config:', error.message);
        return {};
    }
};

const getEmailConfig = () => {
    const envFile = readEnvFile();
    const source = { ...process.env, ...envFile };
    const user = source.EMAIL_USER || DEFAULT_SENDER;
    const port = parseInt(source.EMAIL_PORT || `${DEFAULT_SMTP_PORT}`, 10);

    return {
        host: source.EMAIL_HOST || DEFAULT_SMTP_HOST,
        port,
        secure: source.EMAIL_SECURE ? source.EMAIL_SECURE === 'true' : port === 465,
        user,
        pass: source.EMAIL_PASS,
        from: source.EMAIL_FROM || `TBL Test System <${user}>`
    };
};

const createPasswordEmail = (student) => {
    const subject = 'TBL Test System login password';
    const text = [
        `Hello ${student.name},`,
        '',
        'Your TBL Test System login details are:',
        `UPI: ${student.upi}`,
        `Password: ${student.password}`,
        '',
        'Please keep this password for future tests.',
        '',
        'TBL Test System'
    ].join('\n');

    return { subject, text };
};

export const sendEmail = async ({ to, subject, text }) => {
    const config = getEmailConfig();

    if (!config.pass || config.pass.includes('your-')) {
        throw new Error('EMAIL_PASS is not configured. Set the QQ Mail authorization code in backend/.env first.');
    }

    let socket = await createSocket(config);

    try {
        await readSmtpResponse(socket);
        await writeCommand(socket, 'EHLO localhost', [250]);

        if (!config.secure) {
            await writeCommand(socket, 'STARTTLS', [220]);
            socket = await upgradeToTls(socket, config.host);
            await writeCommand(socket, 'EHLO localhost', [250]);
        }

        await writeCommand(socket, 'AUTH LOGIN', [334]);
        await writeCommand(socket, encodeBase64(config.user), [334], 'AUTH username');
        await writeCommand(socket, encodeBase64(config.pass), [235], 'AUTH password');
        await writeCommand(socket, `MAIL FROM:<${escapeAddress(config.user)}>`, [250]);
        await writeCommand(socket, `RCPT TO:<${escapeAddress(to)}>`, [250, 251]);
        await writeCommand(socket, 'DATA', [354]);

        const message = [
            `From: ${config.from}`,
            `To: ${formatMailbox('', to)}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
            '',
            text
        ].join('\r\n');

        socket.write(`${dotStuff(message)}\r\n.\r\n`);
        const dataResponse = await readSmtpResponse(socket);
        if (![250].includes(dataResponse.code)) {
            throw new Error(`SMTP DATA failed: ${dataResponse.message}`);
        }

        await writeCommand(socket, 'QUIT', [221]);
    } finally {
        socket.end();
    }
};

export const sendPasswordEmail = async (student) => {
    const email = createPasswordEmail(student);
    await sendEmail({
        to: student.email,
        subject: email.subject,
        text: email.text
    });
};
