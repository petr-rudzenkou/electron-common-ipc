import { Buffer } from 'buffer';

const headerSeparator: number = '['.charCodeAt(0);
export const footerSeparator: number = ']'.charCodeAt(0);
export const HeaderLength: number = 2;
export const FooterLength: number = 1;
export const NumberHeaderLength: number = HeaderLength + 4;
export const StringHeaderLength: number = HeaderLength + 4;
export const BufferHeaderLength: number = HeaderLength + 4;
export const ArrayHeaderLength: number = HeaderLength + 4;
export const ObjectHeaderLength: number = HeaderLength + 4;
export const BooleanHeaderLength: number = HeaderLength;

export enum BufferType {
    NotValid = 'X'.charCodeAt(0),
    String = 's'.charCodeAt(0),
    Buffer = 'B'.charCodeAt(0),
    Boolean = 'b'.charCodeAt(0),
    Array = 'A'.charCodeAt(0),
    Number = 'n'.charCodeAt(0),
    Object = 'O'.charCodeAt(0)
};

export class IpcPacketBufferHeader {
    type: BufferType;
    packetSize: number;
    contentSize: number;
    headerSize: number;
    partial: boolean;

    constructor(buffer: Buffer, offset?: number) {
        if (offset == null) {
            offset = 0;
        }
        this.partial = false;
        this.type = BufferType.NotValid;
        if (buffer[offset++] === headerSeparator) {
            this.read(buffer, offset);
        }
    }

    read(buffer: Buffer, offset: number): void {
        this.type = buffer[offset++];
        switch (this.type) {
            case BufferType.Array:
            case BufferType.Object:
            case BufferType.String:
            case BufferType.Buffer:
            case BufferType.Number: {
                this.headerSize = ObjectHeaderLength;
                if (offset + 4 >= buffer.length) {
                    this.partial = true;
                }
                else {
                    this.packetSize = buffer.readUInt32LE(offset);
                }
                break;
            }
            case BufferType.Boolean: {
                this.headerSize = BooleanHeaderLength;
                if (offset + 1 >= buffer.length) {
                    this.partial = true;
                }
                else {
                    this.packetSize = this.headerSize + 1 + FooterLength;
                }
                break;
            }
            default :
                this.type = BufferType.NotValid;
                break;
        }
        if (this.packetSize > 0) {
            this.contentSize = this.packetSize - FooterLength - this.headerSize;
        }
    }

    isValid(): boolean {
        return this.type !== BufferType.NotValid;
    }

    isArray(): boolean {
        return this.type === BufferType.Array;
    }

    isObject(): boolean {
        return this.type === BufferType.Object;
    }

    isString(): boolean {
        return this.type === BufferType.String;
    }

    isBuffer(): boolean {
        return this.type === BufferType.Buffer;
    }

    isNumber(): boolean {
        return this.type === BufferType.Number;
    }

    isBoolean(): boolean {
        return this.type === BufferType.Boolean;
    }

    static writeHeader(bufferType: BufferType, buffer: Buffer, offset: number): number {
        buffer[offset++] = headerSeparator;
        buffer[offset++] = bufferType;
        return offset;
    }

    static getPacketHeader(buffers: Buffer[], offset: number): IpcPacketBufferHeader {
        let buffer = buffers[0];
        let header = new IpcPacketBufferHeader(buffer, offset);
        if (header.isValid()) {
            // Buffer is too short for containing a header
            if (header.partial) {
                // No hope, there is only one buffer
                if (buffers.length === 1) {
                    return header;
                }
                // Create a buffer buffers with the expected header size
                buffer = Buffer.concat(buffers, offset + header.headerSize);
                // Still not enough !
                if (buffer.length < offset + header.headerSize) {
                    return header;
                }
            }
        }
        return header;
    }
}