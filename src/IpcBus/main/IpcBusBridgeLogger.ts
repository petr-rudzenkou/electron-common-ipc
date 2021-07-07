import type { IpcPacketBuffer } from 'socket-serializer';

import type * as Client from '../IpcBusClient';
import type { IpcBusCommand, IpcBusMessage } from '../IpcBusCommand';
import type { IpcBusLogMain } from '../log/IpcBusLogConfigMain';
import type { IpcBusRendererContent } from '../renderer/IpcBusRendererContent';

import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';

// This class ensures the messagePorts of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeLogger extends IpcBusBridgeImpl {
    private _ipcBusLog: IpcBusLogMain;

    constructor(contextType: Client.IpcBusProcessType, ipcBusLog: IpcBusLogMain) {
        super(contextType);
        this._ipcBusLog = ipcBusLog;
    }

    addLog(command: IpcBusCommand, args: any[], payload?: number): boolean {
        return this._ipcBusLog.addLog(command, args);
    }

    addLogRawContent(ipcCommand: IpcBusCommand, IpcBusRendererContent: IpcBusRendererContent): boolean {
        return this._ipcBusLog.addLogRawContent(ipcCommand, IpcBusRendererContent);
    }

    addLogPacket(ipcCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        return this._ipcBusLog.addLogPacket(ipcCommand, ipcPacketBuffer);
    }
    
    // _onRendererArgsReceived(ipcCommand: IpcBusCommand, args: any[]) {
    //     if (this._ipcBusLog.addLog(ipcCommand, args)) {
    //         super._onRendererArgsReceived(ipcCommand, args);
    //     }
    // }

    override _onRendererMessageReceived(ipcMessage: IpcBusMessage, data: any, ipcPorts?: Client.IpcBusMessagePort[]) {
        if (this._ipcBusLog.addLogRawContent(ipcMessage, data)) {
            super._onRendererMessageReceived(ipcMessage, data, ipcPorts);
        }
    }

    override _onMainMessageReceived(ipcMessage: IpcBusMessage, data: any, ipcPorts?: Client.IpcBusMessagePort[]) {
        if (this._ipcBusLog.addLog(ipcMessage, data)) {
            super._onMainMessageReceived(ipcMessage, data, ipcPorts);
        }
    }

    override _onSocketMessageReceived(ipcMessage: IpcBusMessage, ipcPacketBuffer: IpcPacketBuffer, ipcPorts?: Client.IpcBusMessagePort[]) {
        if (this._ipcBusLog.addLogPacket(ipcMessage, ipcPacketBuffer)) {
            super._onSocketMessageReceived(ipcMessage, ipcPacketBuffer);
        }
    }

}

