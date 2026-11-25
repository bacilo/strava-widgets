/** Garmin's FIT SDK ships no TypeScript types. Minimal surface used here. */
declare module '@garmin/fitsdk' {
  export class Stream {
    static fromBuffer(buffer: Buffer): Stream;
  }
  export class Decoder {
    constructor(stream: Stream);
    isFIT(): boolean;
    checkIntegrity(): boolean;
    read(): {
      messages: {
        sessionMesgs?: Array<{ startTime?: Date; [key: string]: unknown }>;
        recordMesgs?: Array<{
          timestamp?: Date;
          positionLat?: number;
          positionLong?: number;
          [key: string]: unknown;
        }>;
        [key: string]: unknown;
      };
      errors: unknown[];
    };
  }
  export class Encoder {
    constructor(opts?: { fieldDescriptions?: unknown });
    onMesg(mesgNum: number, mesg: Record<string, unknown>): void;
    writeMesg(mesg: Record<string, unknown>): void;
    close(): Uint8Array;
  }
  export const Profile: { MesgNum: Record<string, number> };
}
