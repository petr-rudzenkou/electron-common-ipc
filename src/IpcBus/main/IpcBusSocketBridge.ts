/// <reference types='electron' />

import type { IpcPacketBuffer } from 'socket-serializer';

import * as IpcBusUtils from '../IpcBusUtils';
import type * as Client from '../IpcBusClient';
import { IpcBusCommand } from '../IpcBusCommand';
import { IpcBusTransportImpl } from '../IpcBusTransportImpl';
import type { IpcBusTransport } from '../IpcBusTransport';
import { IpcBusConnectorSocket } from '../node/IpcBusConnectorSocket';
import type { IpcBusConnector } from '../IpcBusConnector';

import type { IpcBusBridgeImpl, IpcBusBridgeClient } from './IpcBusBridgeImpl';

const PeerName = 'NetBridge';

class IpcBusTransportSocketBridge extends IpcBusTransportImpl {
    protected _bridge: IpcBusBridgeImpl;
    protected _subscriptions: IpcBusUtils.ChannelConnectionMap<string, string>;

    constructor(connector: IpcBusConnector, bridge: IpcBusBridgeImpl) {
        super(connector);
        this._bridge = bridge;

        this._subscriptions = new IpcBusUtils.ChannelConnectionMap<string, string>(
            `IPCBus:${PeerName}`,
            (conn) => conn
        );
    }

    connect(client: IpcBusTransport.Client | null, options: Client.IpcBusClient.ConnectOptions): Promise<Client.IpcBusPeer> {
        return super.connect(null, { ...options, peerName: PeerName })
        .then((peer) => {
            this._peer = peer;
            const channels = this._bridge.getChannels();
            this.postAdmin({
                peer: this._peer,
                kind: IpcBusCommand.Kind.BridgeConnect,
                channel: undefined,
                channels
            });
            IpcBusUtils.Logger.enable && IpcBusUtils.Logger.info(`[IPCBus:Bridge] Installed`);
            return peer;
        });
    }

    close(client: IpcBusTransport.Client | null, options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        this.postAdmin({
            peer: this._peer,
            kind: IpcBusCommand.Kind.BridgeClose,
            channel: ''
        });
        return super.close(null, options);
    }

    // hasRequestChannel(channel: string): boolean {
    //     return this._subscriptions.hasChannel(channel);
    // }

    hasChannel(channel: string): boolean {
        return this._subscriptions.hasChannel(channel);
    }

    getChannels(): string[] {
        return this._subscriptions.getChannels();
    }

    addChannel(client: IpcBusTransport.Client, channel: string, count?: number): void {
        throw 'not implemented';
    }

    removeChannel(client: IpcBusTransport.Client, channel?: string, all?: boolean): void {
        throw 'not implemented';
    }

    protected onMessageReceived(local: boolean, ipcBusCommand: IpcBusCommand, args: any[]): void {
        throw 'not implemented';
    }

    protected postMessage(ipcBusCommand: IpcBusCommand, args?: any[]): void {
        throw 'not implemented';
    }

    // Come from the main bridge: main or renderer
    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer: Buffer): void {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.SendMessage:
            case IpcBusCommand.Kind.RequestClose:
                if (this.hasChannel(ipcBusCommand.channel)) {
                    this._connector.postBuffer(buffer);
                }
                break;

            case IpcBusCommand.Kind.RequestResponse: {
                const connData = this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel);
                if (connData) {
                    this._connector.postBuffer(buffer);
                }
                break;
            }
        }
    }

    onConnectorPacketReceived(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): boolean {
        switch (ipcBusCommand.kind) {
            case IpcBusCommand.Kind.AddChannelListener:
                this._subscriptions.addRef(ipcBusCommand.channel, PeerName, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelListener:
                this._subscriptions.release(ipcBusCommand.channel, PeerName, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveChannelAllListeners:
                this._subscriptions.releaseAll(ipcBusCommand.channel, PeerName, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.RemoveListeners:
                this._subscriptions.removePeer(PeerName, ipcBusCommand.peer);
                break;

            case IpcBusCommand.Kind.SendMessage:
                if (ipcBusCommand.request) {
                    this._subscriptions.pushResponseChannel(ipcBusCommand.request.replyChannel, PeerName, ipcBusCommand.peer);
                }
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
                break;
            case IpcBusCommand.Kind.RequestClose:
                this._subscriptions.popResponseChannel(ipcBusCommand.request.replyChannel);
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
                break;
            default:
                this._bridge._onNetMessageReceived(ipcBusCommand, ipcPacketBuffer);
                break;
        }
        return true;
    }

    onConnectorContentReceived(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): boolean {
        throw 'not implemented';
    }

    onConnectorShutdown(): void {
        this._bridge._onNetClosed();
    }
}

export class IpcBusSocketBridge implements IpcBusBridgeClient {
    protected _bridge: IpcBusBridgeImpl;
    protected _transport: IpcBusTransportSocketBridge;

    constructor(bridge: IpcBusBridgeImpl) {
        this._bridge = bridge;

        const connector = new IpcBusConnectorSocket('main');
        this._transport = new IpcBusTransportSocketBridge(connector, bridge);
    }

    connect(options: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this._transport.connect(null, options)
        .then(() => {});
    }

    close(options?: Client.IpcBusClient.ConnectOptions): Promise<void> {
        return this._transport.close(null, options);
    }

    hasChannel(channel: string): boolean {
        return this._transport.hasChannel(channel);
    }

    getChannels(): string[] {
        return this._transport.getChannels();
    }

    // broadcastArgs(ipcBusCommand: IpcBusCommand, args: any[]): void {
    //     if (this.hasChannel(ipcBusCommand.channel)) {
    //         this._packet.serializeArray([ipcBusCommand, args]);
    //         this.broadcastBuffer(ipcBusCommand, this._packet.buffer);
    //     }
    // }

    broadcastContent(ipcBusCommand: IpcBusCommand, rawContent: IpcPacketBuffer.RawContent): void {
        this._transport.broadcastBuffer(ipcBusCommand, rawContent.buffer);
    }

    broadcastPacket(ipcBusCommand: IpcBusCommand, ipcPacketBuffer: IpcPacketBuffer): void {
        this._transport.broadcastBuffer(ipcBusCommand, ipcPacketBuffer.buffer);
    }

    broadcastBuffer(ipcBusCommand: IpcBusCommand, buffer: Buffer): void {
        this._transport.broadcastBuffer(ipcBusCommand, buffer);
    }
}

