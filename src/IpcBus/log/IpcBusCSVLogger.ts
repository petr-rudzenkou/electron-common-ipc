import * as path from 'path';
import * as fs from 'fs';

// const csvWriter = require('csv-write-stream');

import { IpcBusCommand } from '../IpcBusCommand';
import { JSON_stringify } from './IpcBusLogUtils';
import { IpcBusLog } from './IpcBusLog';
import { SetLogLevel } from './IpcBusLogImpl';

/** @internal */
export class CSVLogger {
    private _logger: any;
    private _line: number;

    constructor(logPath: string) {
        this._line = 0;

        !fs.existsSync(logPath) && fs.mkdirSync(logPath);

        this._logger = fs.createWriteStream(path.join(logPath, 'electron-common-ipcbus-bridge.csv.txt'));
        this.writeLine([
            '#',
            'peer id',
            'peer',
            'message id',
            'message channel',
            'message kind',
            'message timestamp',
            'request',
            'arg0',
            'arg1',
            'arg2',
            'arg3',
            'arg4',
            'arg5'
        ]);
    }

    writeLine(cols: string[]) {
        for (let i = 0, l = cols.length; i < l; ++i) {
            this._logger.write(cols[i]);
            this._logger.write('\t');
        }
        this._logger.write('\n');
    }

    addLog(ipcBusCommand: IpcBusCommand, args: any[]): void {
        if (ipcBusCommand.log) {
            const peer = ipcBusCommand.peer;
            ++this._line;
            const cols: string[] = [
                this._line.toString(),
                peer.id,
                JSON.stringify(peer)
            ];

            let remainingArgs = 6;
            if ((args != null) && args.length) {
                remainingArgs -= args.length;
            }

            switch (ipcBusCommand.kind) {
                case IpcBusCommand.Kind.SendMessage: {
                    const current_command = ipcBusCommand;
                    cols.push(
                        current_command.log ? current_command.log.id : '?',
                        current_command.channel,
                        current_command.request ? 'SEND-REQUEST' : 'SEND-MESSAGE',
                        '',
                        current_command.request ? JSON.stringify(current_command.request) : ''
                    );
                    if (args && args.length) {
                        for (let i = 0, l = args.length; i < l; ++i) {
                            cols.push(JSON_stringify(args[i], 255));
                        }
                    }
                    break;
                }
                case IpcBusCommand.Kind.RequestResponse:
                case IpcBusCommand.Kind.LogRequestResponse: {
                    const current_command = ipcBusCommand;
                    let original_command = current_command;
                    while (original_command.log.previous) {
                        original_command = original_command.log.previous;
                    }
                    const local = current_command.log.local;
                    let delay = '?';
                    if (original_command) {
                        delay = ((current_command.log.timestamp - original_command.log.timestamp)).toString();
                    }
                    cols.push(
                        current_command.log ? current_command.log.id : '?',
                        current_command.channel,
                        local ? 'REQUEST-RESPONSE-local' : 'SEND-REQUEST-RESPONSE',
                        delay,
                        JSON.stringify(current_command.request)
                    );
                    if (args && args.length) {
                        for (let i = 0, l = args.length; i < l; ++i) {
                            cols.push(JSON_stringify(args[i], 255));
                        }
                    }
                    break;
                }
                case IpcBusCommand.Kind.LogGetMessage: {
                    const current_command = ipcBusCommand.log.previous;
                    let original_command = current_command;
                    while (original_command?.log?.previous) {
                        original_command = original_command.log.previous;
                    }
                    const local = ipcBusCommand.log.local;
                    const delay = (ipcBusCommand.log.timestamp - original_command.log.timestamp);
                    cols.push(
                        current_command.log.id,
                        current_command.channel
                    );
                    if (current_command.kind === IpcBusCommand.Kind.SendMessage) {
                        cols.push(
                            current_command.request ? local ? 'REQUEST-local' : 'GET-REQUEST' : local ? 'MESSAGE-local' : 'GET-MESSAGE',
                        );
                    }
                    else if (current_command.kind === IpcBusCommand.Kind.RequestResponse) {
                        cols.push(
                            'GET-REQUEST-RESPONSE',
                        );
                    }
                    cols.push(
                        delay.toString(),
                        current_command.request ? JSON.stringify(current_command.request) : ''
                    );
                    break;
                }
            }
            for (let i = 0, l = remainingArgs; i < l; ++i) {
                cols.push('');
            }
            this.writeLine(cols);
        }
    }
}

let cvsLogger: CSVLogger;
export function SetLogLevelCVS(level: IpcBusLog.Level, filename: string): void {
    if (level >= IpcBusLog.Level.None) {
        if (cvsLogger == null) {
            cvsLogger = new CSVLogger(filename);
            const cb = cvsLogger.addLog.bind(cvsLogger);
            SetLogLevel(level, cb);
        }
    }
    else {
        cvsLogger = null;
    }
}