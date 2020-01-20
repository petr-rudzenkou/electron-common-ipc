/// <reference types='electron' />

import { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import * as Client from '../IpcBusClient';
import * as Bridge from './IpcBusBridge';
import { IpcBusCommand } from '../IpcBusCommand';

import { IpcBusRendererBridge } from './IpcBusRendererBridge';
import { IpcBusConnectorNet } from '../node/IpcBusConnectorNet';
import { IpcBusBridgeTransportNet } from './IpcBusNetBridge';
import { IpcBusBridgeConnectorMain, IpcBusBridgeTransportMain } from './IpcBusMainBridge'; 
import { IpcBusTransport } from '../IpcBusTransport'; 
;

// This class ensures the transfer of data between Broker and Renderer/s using ipcMain
/** @internal */
export class IpcBusBridgeImpl implements Bridge.IpcBusBridge {
    protected _mainTransport: IpcBusBridgeTransportMain;
    protected _netTransport: IpcBusBridgeTransportNet;
    protected _netConnector: IpcBusConnectorNet;
    protected _rendererConnector: IpcBusRendererBridge;

    protected _connected: boolean;
    private _packetOut: IpcPacketBuffer;

    constructor(contextType: Client.IpcBusProcessType) {
        this._connected = false;

        this._packetOut = new IpcPacketBuffer();
        const mainConnector = new IpcBusBridgeConnectorMain(contextType);
        this._mainTransport = new IpcBusBridgeTransportMain(mainConnector, this);
        this._netConnector = new IpcBusConnectorNet(contextType);
        this._netTransport = new IpcBusBridgeTransportNet(this._netConnector, this);
        this._rendererConnector = new IpcBusRendererBridge(this);
    }

    protected _reset(endSocket: boolean) {
        this._connected = false;
        // super._reset(endSocket);
    }

    get mainTransport(): IpcBusTransport {
        return this._mainTransport;
    }

    // IpcBusBridge API
    connect(arg1: Bridge.IpcBusBridge.ConnectOptions | string | number, arg2?: Bridge.IpcBusBridge.ConnectOptions | string, arg3?: Bridge.IpcBusBridge.ConnectOptions): Promise<void> {
        // To manage re-entrance
        return this._rendererConnector.connect()
        .then(() => {
            const options = IpcBusUtils.CheckConnectOptions(arg1, arg2, arg3);
            if (!this._connected) {
                if ((options.port != null) || (options.path != null)) {
                    this._connected = true;
                    // this._brokerChannels.clear();
                    return this._netConnector.ipcHandshake(options)
                        .then((handshake) => {
                            this._netTransport.ipcPost(this._netTransport.peer, IpcBusCommand.Kind.BridgeConnect, '');
                            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
                        })
                        .catch(err => {
                            this._connected = false;
                        });
                }
            }
            else {
                if ((options.port == null) && (options.path == null)) {
                    this._netTransport.ipcPost(this._netTransport.peer, IpcBusCommand.Kind.BridgeClose, '');
                    return this._netConnector.ipcShutdown();
                }
            }
            return Promise.resolve();
        });
    }

    close(options?: Bridge.IpcBusBridge.CloseOptions): Promise<void> {
        return this._rendererConnector.close()
        .then(() => {
            if (this._connected) {
                this._netTransport.ipcPost(this._netTransport.peer, IpcBusCommand.Kind.BridgeClose, '');
                return this._netConnector.ipcShutdown(options);
            }
            return Promise.resolve();
        });
    }

    // // Not exposed
    // queryState(): Object {
    //     const queryStateResult: Object[] = [];
    //     this._subscriptions.forEach((connData, channel) => {
    //         connData.peerRefCounts.forEach((peerRefCount) => {
    //             queryStateResult.push({ channel: channel, peer: peerRefCount.peer, count: peerRefCount.refCount });
    //         });
    //     });
    //     return queryStateResult;
    // }

    _onRendererMessagedReceived(webContents: Electron.WebContents, ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent) {
        this._mainTransport.onConnectorBufferReceived(null, ipcBusCommand, rawContent);
        if (this._netTransport.hasChannel(ipcBusCommand.channel)) {
            this._netConnector.ipcPostBuffer(rawContent.buffer);
        }
    }

    _onRendererAddChannels(channels: string[]) {
    }

    _onRendererRemoveChannels(channels: string[]) {
    }

    // This is coming from the Electron Main Process (Electron ipc)
    // =================================================================================================
    _onMainMessageReceived(ipcBusCommand: IpcBusCommand, args?: any[]) {
        // Prevent serializing for main
        if (this._rendererConnector.hasChannel(ipcBusCommand.channel) || this._rendererConnector.hasRequestChannel(ipcBusCommand.channel)) {
            if (args) {
                this._packetOut.serializeArray([ipcBusCommand, args]);
            }
            else {
                this._packetOut.serializeArray([ipcBusCommand]);
            }
            const rawContent = this._packetOut.getRawContent();
            this._rendererConnector.onConnectorBufferReceived(null, ipcBusCommand, rawContent);
            if (this._netTransport.hasChannel(ipcBusCommand.channel)) {
                this._netConnector.ipcPostBuffer(rawContent.buffer);
            }
        }
    }

    _onMainAddChannels(channels: string[]) {
    }

    _onMainRemoveChannels(channels: string[]) {
    }


    // This is coming from the Bus broker (socket)
    // =================================================================================================
    _onNetMessageReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer) {
        this._mainTransport.onConnectorPacketReceived(ipcBusCommand, ipcPacketBuffer);
        this._rendererConnector.onConnectorPacketReceived(ipcBusCommand, ipcPacketBuffer);
    }
}

