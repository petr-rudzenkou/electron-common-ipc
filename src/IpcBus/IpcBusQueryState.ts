import type * as Client from './IpcBusClient';

/** @internal */
export interface QueryStateChannel {
    name: string;
    refCount: number
}

/** @internal */
export interface QueryStateChannels {
    [key: string]: QueryStateChannel
}

/** @internal */
export interface QueryStatePeer {
    peer: Client.IpcBusPeer;
    channels: QueryStateChannels
}

/** @internal */
export interface QueryStatePeers {
    [key: string]: QueryStatePeer;
}

/** @internal */
export interface QueryStatePeerProcess {
    peer: Client.IpcBusPeerProcess;
    channels: QueryStateChannels
}

/** @internal */
export interface QueryStatePeerProcesses {
    [key: string]: QueryStatePeerProcess;
}



/** @internal */
export interface QueryStateBase {
    type: 'transport' | 'transport-socket-bridge'
            | 'connector' | 'connector-renderer' | 'connector-socket'
            | 'renderer-bridge'
            | 'broker-bridge' | 'broker',
    process: Client.IpcBusProcess;
}

/** @internal */
export interface QueryStateResponse {
    id: string;
    queryState: QueryStateBase
}

/** @internal */
export interface QueryStateTransport extends QueryStateBase {
    type: 'transport' | 'transport-socket-bridge'
    peers: QueryStatePeers;
    channels: QueryStateChannels;
}

/** @internal */
export interface QueryStateSocketBridge extends QueryStateTransport {
    type: 'transport-socket-bridge',
}


/** @internal */
export interface QueryStateConnector extends QueryStateBase {
    peerProcess: Client.IpcBusPeerProcess;
}


/** @internal */
export interface QueryStateBridge extends QueryStateBase {
    peers: QueryStatePeerProcesses;
    channels: QueryStateChannels;
}

/** @internal */
export interface QueryStateRendererBridge extends QueryStateBridge {
    type: 'renderer-bridge',
}

/** @internal */
export interface QueryStateBroker extends QueryStateBridge {
    type: 'broker' | 'broker-bridge',
}
